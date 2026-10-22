// RESEARCH RULES: which packages and milestones can be commissioned, what they cost, breakthroughs and earmarks. No DOM.
// The catalogue itself is in data/research.js.
import { formatMoney, gaussian } from '../core/util.js';
import { PACKAGES, MILESTONES, BY_ID, isMilestone, AREAS, formatEffect, breakthroughNeeds } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, addHistory, isResearched, isConfirmed, freeTeams, findJob } from '../core/state.js';
import { learn, knowledgeFraction } from './knowledge.js';
import { programmePackages, isInProgramme, scaledForProgramme, VEHICLE_AREAS, programmeData } from './programs.js';
import { trackingTiers } from './design.js';

export const isVehicleArea = area => VEHICLE_AREAS.includes(area);
// The packages on offer in an area: a vehicle area shows the focused programme's slice, other areas the whole catalogue.
export const itemsInArea = area => isVehicleArea(area) ? (S.cur ? programmePackages(S.cur, area) : []) : PACKAGES.filter(item => item.area == area);
// A package or milestone as the focused programme sees it (cost, time and kilogram effects scaled to the rocket).
export const itemAsSeen = id => isVehicleArea(BY_ID[id].area) && S.cur ? scaledForProgramme(BY_ID[id], S.cur) : BY_ID[id];
// Confirmed packages needed for [a breakthrough, the second milestone]. A rocket needs about 45% of its packages (at least 2).
export const breakthroughNeedsHere = area => isVehicleArea(area) && S.cur ? [Math.max(2, Math.ceil(programmeData().packagesPerArea * .45)), 99] : breakthroughNeeds(area);
// How many packages in an area are done, confirmed and on offer in all (hidden ones count once they are done).
export const areaCounts = area => {
  const items = itemsInArea(area).filter(item => !item.hiddenUntil || isResearched(item.id));
  return { done: items.filter(item => isResearched(item.id)).length, confirmed: items.filter(item => isConfirmed(item.id)).length, total: items.length };
};
// The research job for a package, if one is running. Vehicle work belongs to the programme in focus; global work to none.
const researchJob = item => findJob(job => job.k == 'pk' && job.id == item.id && job.prog == (isVehicleArea(item.area) ? S.cur : null));

// MILESTONE RULES: tier-1 approaches are exclusive per area; tier 2 follows a tier-1 milestone plus confirmed packages; joint programmes need tier 1 in both areas.
export const hasFirstMilestone = area => MILESTONES.some(milestone => milestone.area == area && milestone.tier == 1 && isResearched(milestone.id));
// Staging, the Atlas balloon tanks and the Thor-class engine are rockets of their own now, not milestones.
export const RETIRED_MILESTONES = ['ms_stg', 'ms_clu', 'ms_balloon', 'ms_tp'];
export const firstMilestoneOptions = area => MILESTONES.filter(milestone => milestone.area == area && milestone.tier == 1 && !RETIRED_MILESTONES.includes(milestone.id));
// Why a milestone cannot be started, or null.
export function milestoneLock(milestone) {
  if (isResearched(milestone.id)) return 'Complete.';
  if (RETIRED_MILESTONES.includes(milestone.id)) return 'Superseded: new rocket programmes take its place.';
  if ((isVehicleArea(milestone.area) && milestone.tier != 1) || milestone.tier == 'x') return 'Superseded: new rocket programmes take its place.';
  if (isVehicleArea(milestone.area) && !(programmeData() || {}).hasMilestones) return 'This rocket is too simple for a major programme.';
  if (milestone.tier == 1) {
    const otherChosen = MILESTONES.some(other => other.area == milestone.area && other.tier == 1 && other.id != milestone.id
      && (isResearched(other.id) || findJob(job => job.k == 'pk' && job.id == other.id && job.prog == (isVehicleArea(milestone.area) ? S.cur : null))));
    if (otherChosen) return 'Another approach was chosen.';
    if (!S.bt[milestone.area]) return `Needs a breakthrough (${areaCounts(milestone.area).confirmed}/${breakthroughNeedsHere(milestone.area)[0]} confirmed).`;
  } else if (milestone.tier == 2) {
    if (!hasFirstMilestone(milestone.area)) return 'Needs a first milestone in this area.';
    const needed = breakthroughNeeds(milestone.area)[1];
    if (areaCounts(milestone.area).confirmed < needed) return `Needs ${needed} confirmed packages in this area (${areaCounts(milestone.area).confirmed}/${needed}).`;
  } else {
    const missing = [...milestone.jointAreas].filter(area => !hasFirstMilestone(area));
    if (missing.length) return `Needs a first milestone in ${missing.map(area => AREAS[area]).join(' and ')}.`;
  }
  return null;
}

// ESTIMATES: how uncertain the engineers' estimate of a package is (a fraction of each effect).
// Milestones are well understood, experimental work least; better instruments and knowledge narrow it.
export const estimateSpread = item => {
  const tiers = trackingTiers();
  return Math.max(.05, (isMilestone(item.id) ? .1 : item.dud ? .45 : .25) * (1 - .1 * (tiers.g + tiers.v)) * (1 - .5 * knowledgeFraction(item.area)));
};
// A package's effects as text: measured once confirmed, otherwise an estimate with its uncertainty.
export function describeResearch(item) {
  item = itemAsSeen(item.id);
  const done = S.pk[item.id];
  if (done && done.c) return Object.entries(done.m).map(([key, value]) => formatEffect(key, value)).join(', ') + ' (measured)';
  const spread = estimateSpread(item);
  return Object.entries(item.effects).map(([key, value]) => formatEffect(key, value, Math.abs(value) * spread)).join(', ') + (done ? ' (awaiting flight)' : ' (estimate)');
}

// Why a package or milestone cannot be commissioned now, or null if it can.
export function researchLock(id) {
  const item = itemAsSeen(id);
  if (item.phase == 2 && !S.nasa) return 'Opens when NASA is established.';
  if (isVehicleArea(item.area) && !S.cur) return 'No rocket programme.';
  if (isVehicleArea(item.area) && S.progs[S.cur] && !S.progs[S.cur].ready) return 'The programme is still in detailed design.';
  if (isVehicleArea(item.area) && !isMilestone(id) && !isInProgramme(S.cur, id)) return 'Not part of this rocket programme.';
  if (isResearched(id)) return 'Complete.';
  if (researchJob(item)) return 'In progress.';
  if (isMilestone(id)) {
    const lock = milestoneLock(item);
    if (lock) return lock;
  } else if (!isProposed(item)) return 'Not yet proposed by the engineers.';
  if (item.needsMilestone && !isVehicleArea(item.area) && !hasFirstMilestone(item.area)) return 'Unlocks after a first milestone in this area.';
  if (S.b < costAfterEarmark(item)) return `Need ${formatMoney(costAfterEarmark(item) - S.b)} more.`;
  if (freeTeams() < 1) return 'All teams busy.';
  return null;
}
export const commission = id => {
  const lock = researchLock(id);
  if (lock) return log(lock, 'bad');
  const item = itemAsSeen(id), cost = costAfterEarmark(item);
  if (cost < item.cost) {
    log(`[CONGRESS] Earmarked funds cover ${formatMoney(item.cost - cost)} of ${item.name}.`, 'ok');
    S.ear[item.area] = 0;
  }
  S.b -= cost;
  S.jobs.push({ k: 'pk', id, prog: isVehicleArea(item.area) ? S.cur : null, t: item.time, tot: item.time });
  log(`[DESIGN] Started: ${item.name} (${formatMoney(item.cost)}).`, 'wn');
};

// Research is proposed gradually: two ideas per area at first, one more each time a package in that area is confirmed.
// Second-generation ideas follow the same rule (starting from one) after the first milestone.
export function isProposed(item) {
  if (isMilestone(item.id) || isResearched(item.id) || researchJob(item)) return true;
  if (item.hiddenUntil) return !!(S.p2 && S.p2.fl && S.p2.fl[item.hiddenUntil]);
  if (isVehicleArea(item.area)) {
    const own = itemsInArea(item.area);
    return own.indexOf(own.find(other => other.id == item.id)) < 2 + areaCounts(item.area).confirmed;
  }
  const own = PACKAGES.filter(other => other.area == item.area && !!other.needsMilestone == !!item.needsMilestone && !other.hiddenUntil);
  if (item.needsMilestone) {
    if (!hasFirstMilestone(item.area)) return false;
    return own.indexOf(item) < 1 + own.filter(other => isConfirmed(other.id)).length;
  }
  return own.indexOf(item) < 2 + areaCounts(item.area).confirmed;
}

// A research job is done: roll the package's true effect (a dud rolls between -30% and +15% of the estimate).
const MILESTONE_SPREAD = .1, EXPERIMENTAL_SPREAD = .4, PACKAGE_SPREAD = .25;
export function finishResearch(id) {
  const item = itemAsSeen(id), effects = {}, dud = !!item.dud && Math.random() < item.dud;
  const spread = isMilestone(id) ? MILESTONE_SPREAD : item.dud ? EXPERIMENTAL_SPREAD : PACKAGE_SPREAD;
  for (const key in item.effects) effects[key] = item.effects[key] * (dud ? -.3 + .45 * Math.random() : Math.max(-.25, Math.min(1.8, 1 + spread * gaussian())));
  S.pk[id] = { a: effects, c: 0, m: null, dud };
  learn(item.area, isMilestone(id) ? 6 : 3);
  log(`[DESIGN] Complete: ${item.name}${isVehicleArea(item.area) && S.cur ? ` for the ${PROGRAMMES[S.cur].name}` : ''}. Publish a new blueprint revision to build it into airframes; its real effect is confirmed when one flies.`, 'ok');
  if (isMilestone(id)) addHistory(`Milestone: ${item.name}`);
  if (item.contract) {
    S.b += item.contract;
    log(`[CONTRACT] ${item.name} delivered. Contract payment +${formatMoney(item.contract)}.`, 'hd');
  }
  checkBreakthroughs();
}
// Confirm a package's real effect (from a flight or the test stand): the measured figure is within about 8% of the truth.
export function confirmPackage(id, how = 'Flight') {
  const done = S.pk[id];
  if (!done || done.c) return;
  done.c = 1;
  if (BY_ID[id]) learn(BY_ID[id].area, 2);
  done.m = {};
  for (const key in done.a) done.m[key] = done.a[key] * (1 + .08 * gaussian());
  if (done.dud) log(`[DEAD END] ${BY_ID[id].name} did not pan out. The engineers learned what NOT to build.`, 'bad');
  log(`[DESIGN] ${how} data on ${BY_ID[id].name}: ${Object.entries(done.m).map(([key, value]) => formatEffect(key, value)).join(', ')}.`, 'cyan');
}
// Check each area for a breakthrough (enough confirmed packages) and for a second milestone becoming feasible.
export function checkBreakthroughs() {
  for (const area in AREAS) {
    if (isVehicleArea(area) && (!(programmeData() || {}).hasMilestones || !firstMilestoneOptions(area).length)) continue;
    if (!S.bt[area] && areaCounts(area).confirmed >= breakthroughNeedsHere(area)[0]) {
      S.bt[area] = 1;
      giveEarmark(area);
      log(`[BREAKTHROUGH] ${AREAS[area]}: the engineers see the pattern. Choose an approach: ${firstMilestoneOptions(area).map(milestone => milestone.name).join(' or ')}.`, 'hd');
    }
    const secondMilestone = !isVehicleArea(area) && MILESTONES.find(milestone => milestone.area == area && milestone.tier == 2);
    if (secondMilestone && !S.bt[area + '2'] && !milestoneLock(secondMilestone)) {
      S.bt[area + '2'] = 1;
      log(`[DESIGN] ${AREAS[area]}: ${secondMilestone.name} is now feasible.`, 'hd');
    }
  }
}

// EARMARKS: Congress sets money aside for an area's first milestone when its breakthrough lands: 70% of the cheaper approach.
export function giveEarmark(area) {
  const cheapest = Math.min(...firstMilestoneOptions(area).map(milestone => milestone.cost));
  S.ear[area] = Math.round(cheapest * .7 / 1000) * 1000;
  log(`[CONGRESS] A special appropriation of ${formatMoney(S.ear[area])} is earmarked for the ${AREAS[area].toLowerCase()} programme.`, 'hd');
}
export const costAfterEarmark = item => isMilestone(item.id) && item.tier == 1 && S.ear && S.ear[item.area] ? Math.max(0, item.cost - S.ear[item.area]) : item.cost;
