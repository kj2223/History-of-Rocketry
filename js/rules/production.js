// PRODUCTION: blueprint revisions, the production line's learning curve, airframe costs and retrofits. No DOM.
// Player actions that use these (ordering, publishing, upgrades) are in rules/game.js.
import { isMilestone } from '../data/research.js';
import { findFix } from '../data/failures.js';
import { S, today, withProgramme } from '../core/state.js';
import { programmeOf, programmeData } from './programs.js';
import { packageCounts, airframeLabel } from './design.js';
import { itemAsSeen } from './research.js';

// PRODUCTION LINE LEARNING (Wright's law): each doubling of airframes built to the current blueprint cuts time and cost by about 20%, down to 45%.
// Experience counts builds already queued to the current revision, so a batch order gets cheaper unit by unit.
export const lineLearning = experience => Math.max(.45, Math.pow(Math.max(0, experience) + 1, -.322));
const queuedToCurrentRevision = () => S.aq.filter(item => item.k == 'build' && item.prog == S.cur && item.cfg && item.cfg.rev == S.bp.rev).length;
export const lineExperience = (extra = 0) => (S.line ? S.line.xp : 0) + queuedToCurrentRevision() + extra;

// An airframe before line learning: the programme's unit cost and time, plus 4% (3% of time) per package and 20% (15%) per milestone, up to 8.
const baseUnitCost = () => {
  const counts = packageCounts(S.bp.pk), programme = programmeData() || { unitCost: 4000 };
  return programme.unitCost * (1 + .04 * counts.packages + .2 * Math.min(counts.milestones, 8));
};
const baseBuildTime = () => {
  const counts = packageCounts(S.bp.pk), programme = programmeData() || { unitTime: 10 };
  return programme.unitTime * (1 + .03 * counts.packages + .15 * Math.min(counts.milestones, 8));
};
// The cost and factory time of the next airframe (extra: how many more are ordered ahead of it).
export const unitCost = (extra = 0) => Math.round(baseUnitCost() * lineLearning(lineExperience(extra)));
export const batchCost = count => [...Array(count)].reduce((sum, _, index) => sum + unitCost(index), 0);
export const buildTime = (extra = 0) => Math.round(baseBuildTime() * lineLearning(lineExperience(extra)));

// BLUEPRINTS. The draft is everything finished since the published revision: { packages, fixes } (failure modes whose fix changed).
export const draftChanges = () => ({
  packages: Object.keys(S.pk).filter(id => !S.bp.pk.includes(id)),
  fixes: Object.keys(S.fix).filter(mode => S.bp.fix[mode] != S.fix[mode]),
});
// How much line experience publishing the draft keeps: small packages 85% each, a milestone (retooling) 40%, a corrective fix 97%.
export function experienceCarryover() {
  const draft = draftChanges(), milestones = draft.packages.filter(isMilestone).length;
  return Math.pow(.85, draft.packages.length - milestones) * Math.pow(.4, milestones) * Math.pow(.97, draft.fixes.length);
}

// A new airframe built to a blueprint configuration { pk, fix, rev }.
export const makeAirframe = (config, cost, programme = S.cur) => {
  const id = S.nid++;
  return { id, prog: programme, pk: [...config.pk], fix: { ...config.fix }, rev: config.rev || 1, cost, st: 'r', built: today(), label: airframeLabel(programme, config.pk, id) };
};

// Upgrading a built airframe to the published blueprint: one factory job however many changes it carries.
// $600 plus 15% of each missing package's and fix's cost; 6 seconds plus 2 per change; both reduced by line learning.
// Returns { changes, cost, time }, or null if the airframe is up to date.
export function retrofitQuote(airframe) {
  return withProgramme(programmeOf(airframe), () => retrofitQuoteForProgramme(airframe));
}
function retrofitQuoteForProgramme(airframe) {
  const missingPackages = S.bp.pk.filter(id => !airframe.pk.includes(id));
  const changedFixes = Object.keys(S.bp.fix).filter(mode => airframe.fix[mode] != S.bp.fix[mode]);
  const changes = missingPackages.length + changedFixes.length;
  if (!changes) return null;
  let cost = 600;
  missingPackages.forEach(id => cost += itemAsSeen(id).cost * .15);
  changedFixes.forEach(mode => cost += findFix(mode, S.bp.fix[mode]).cost * .15);
  return { changes, cost: Math.round(cost * lineLearning(lineExperience())), time: Math.round((6 + 2 * changes) * lineLearning(lineExperience())) };
}
