// THE FACTORY: build teams, ordering airframes, publishing blueprints, upgrades in the queue, and the queue's progress each second. No DOM.
// The cost and time of each airframe come from rules/production.js.
import { formatMoney } from '../core/util.js';
import { BY_ID, isMilestone } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, withProgramme, earn } from '../core/state.js';
import { designation, airframeLabel } from './design.js';
import { batchCost, buildTime, draftChanges, experienceCarryover, makeAirframe, retrofitQuote, rocketFixes } from './production.js';
import { startNewFamilyIfRedesigned } from './manrate.js';
import { redesign } from './knowledge.js';
import { deliverCapsule } from './mercury.js';

// BUILD TEAMS: each works one queue item at a time. Tooling upgrades speed every build; the clean room speeds capsules.
export const buildTeams = () => S.bteams || 1;
export const MAX_BUILD_TEAMS = 4;
export const buildTeamCost = () => 15000 * buildTeams();
export const buildRate = item => (S.fac.jigs ? 1.25 : 1) * (S.fac.nc ? 1.25 : 1) * (item && item.k == 'msn' && S.fac.clean ? 1.3 : 1);

// ORDERING: a batch of airframes to the published blueprint, each unit a little cheaper and quicker than the last.
export function orderAirframes(count) {
  if (!S.progs[S.cur] || !S.progs[S.cur].ready) return;
  const cost = batchCost(count);
  if (S.b < cost) return;
  S.b -= cost;
  const config = { pk: [...S.bp.pk], fix: { ...S.bp.fix }, rev: S.bp.rev }, times = [...Array(count)].map((_, index) => buildTime(index));
  for (let i = 0; i < count; i++) S.aq.push({ k: 'build', prog: S.cur, cfg: config, cost: Math.round(cost / count), t: times[i], tot: times[i] });
  log(`[FACTORY] Ordered x${count} ${PROGRAMMES[S.cur].name} ${designation(config.pk)} to blueprint Rev ${config.rev} (${formatMoney(cost)}).`, 'wn');
}

// PUBLISHING a blueprint puts the draft (finished packages and fixes) into every airframe built from now on.
// A booster milestone starts a new man-rating family and a redesign of the system it changes.
export const autoPublishDue = () => {
  const draft = draftChanges();
  return S.ap.on && draft.packages.length + draft.fixes.length >= S.ap.n;
};
export function publishBlueprint(automatic) {
  const draft = draftChanges(), changes = draft.packages.length + draft.fixes.length;
  if (!changes) return;
  const keep = experienceCarryover(), before = S.line.xp;
  S.line.xp = Math.round(before * keep * 10) / 10;
  S.bp = { rev: S.bp.rev + 1, pk: Object.keys(S.pk), fix: rocketFixes() };
  startNewFamilyIfRedesigned(draft.packages, S.bp.rev);
  for (const id of draft.packages) if (BY_ID[id] && isMilestone(id) && BY_ID[id].phase != 2 && BY_ID[id].area) redesign(BY_ID[id].area);
  log(`[DRAWING OFFICE] ${automatic ? 'Auto-published' : 'Published'} blueprint Rev ${S.bp.rev} with ${changes} change${changes > 1 ? 's' : ''}. The line keeps ${Math.round(keep * 100)}% of its experience (${before.toFixed(1)} to ${S.line.xp.toFixed(1)} units).`, 'ok');
}

// HELD FOR LAUNCH: an airframe you mean to fly yourself (airframe.hold, set from the launch form or by starting its count), or the
// booster picked for the next Mercury or Gemini mission. Reed does not take it for an upgrade and Ellis does not fly it; you still can.
export const heldForLaunch = airframe => !!airframe.hold || !!(S.p2 && S.p2.lb == airframe.id);
export function holdForLaunch(id, on = true) {
  const airframe = S.air.find(candidate => candidate.id == id);
  if (airframe) airframe.hold = on ? 1 : 0;
}

// UPGRADES: a built airframe goes back through the factory queue to the published blueprint.
export function queueRetrofit(id) {
  const airframe = S.air.find(candidate => candidate.id == id && candidate.st == 'r'), quote = airframe && retrofitQuote(airframe);
  if (!quote || S.b < quote.cost) return;
  withProgramme(airframe.prog, () => {
    S.b -= quote.cost;
    airframe.st = 'queued';
    S.aq.push({ k: 'retro', af: airframe.id, prog: airframe.prog, cfg: { pk: [...S.bp.pk], fix: { ...S.bp.fix }, rev: S.bp.rev }, cost: quote.cost, t: quote.time, tot: quote.time });
    log(`[FACTORY] ${airframe.label} queued for upgrade to Rev ${S.bp.rev} (${formatMoney(quote.cost)}).`, 'wn');
  });
}

// CANCELLING refunds everything for work not yet started, half for a job already on the floor.
export const refundFor = index => {
  const item = S.aq[index];
  return item ? Math.round(item.cost * (index < buildTeams() && item.t < item.tot ? .5 : 1)) : 0;
};
export function cancelQueueItem(index) {
  const item = S.aq[index];
  if (!item) return;
  const refund = refundFor(index);
  earn(refund);
  S.aq.splice(index, 1);
  if (item.k == 'retro') {
    const airframe = S.air.find(candidate => candidate.id == item.af);
    if (airframe) airframe.st = 'r';
  }
  log(`[FACTORY] Cancelled ${item.k == 'retro' ? `the upgrade of airframe #${item.af}` : `a Rev ${(item.cfg && item.cfg.rev) || 1} airframe`}. Refund ${formatMoney(refund)}.`, 'wn');
}

// One second on the factory floor: each build team advances its item; finished items are delivered. Returns true if any finished.
export function factoryTick() {
  let changed = false;
  for (const item of S.aq.slice(0, buildTeams())) {
    item.t -= buildRate(item);
    if (item.t > 0) continue;
    S.aq.splice(S.aq.indexOf(item), 1);
    changed = true;
    if (item.k == 'msn') deliverCapsule(item);
    else if (item.k == 'retro') finishUpgrade(item);
    else deliverAirframe(item);
  }
  return changed;
}
function finishUpgrade(item) {
  const airframe = S.air.find(candidate => candidate.id == item.af);
  if (!airframe) return;
  airframe.pk = [...item.cfg.pk];
  airframe.fix = { ...item.cfg.fix };
  airframe.rev = item.cfg.rev;
  airframe.st = 'r';
  airframe.label = airframeLabel(airframe.prog, airframe.pk, airframe.id);
  log(`[FACTORY] ${airframe.label} upgraded to blueprint Rev ${airframe.rev}.`, 'ok');
}
function deliverAirframe(item) {
  withProgramme(item.prog, () => {
    const airframe = makeAirframe(item.cfg, item.cost, item.prog || S.cur);
    S.air.push(airframe);
    S.prod++;
    if (item.cfg.rev == S.bp.rev) S.line.xp++;
    log(`[FACTORY] ${airframe.label} (Rev ${airframe.rev}) delivered to the hangar.`, 'ok');
  });
}
