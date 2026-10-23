// ROCKET PROGRAMMES: starting a new rocket, its hidden true design, maturity and the window of what the team believes. No DOM.
// A programme's true performance sits somewhere inside a window; flights, tests and research narrow it. Traits are flaws rolled
// when the programme starts: they raise one failure mode (or cost performance) until found and cured.
// The programme table itself is in data/programmes.js.
import { formatMoney, gaussian } from '../core/util.js';
import { PACKAGES, BY_ID } from '../data/research.js';
import { PROGRAMMES, PROGRAMME_ORDER, MATURE, FLIGHTS_TO_MATURE, HEAD_START, TRAITS, traitByKey, DESIGN_STATS } from '../data/programmes.js';
import { S, log, addHistory, newBundle, recordRunEvent } from '../core/state.js';

// The four research areas that belong to a rocket (the others are global: see core/state.js).
export const VEHICLE_AREAS = ['p', 's', 'i', 'a'];

// Each programme researches a slice of the package catalogue: later rockets get later work, scaled to their size.
const PACKAGES_BY_AREA = {};
for (const area of VEHICLE_AREAS) PACKAGES_BY_AREA[area] = PACKAGES.filter(item => item.area == area && !item.phase);
export function programmePackages(kind, area) {
  const programme = PROGRAMMES[kind], list = PACKAGES_BY_AREA[area] || [];
  const count = Math.min(programme.packagesPerArea, list.length);
  const start = Math.min(programme.generation * 2, Math.max(0, list.length - count));
  return list.slice(start, start + count);
}
export const isInProgramme = (kind, id) => {
  const item = BY_ID[id];
  return !!item && VEHICLE_AREAS.includes(item.area) && !!programmePackages(kind, item.area).find(other => other.id == id);
};
// A package as this programme sees it: cost and time scaled, kilogram effects (f, d) scaled to the rocket's size.
export function scaledForProgramme(item, kind) {
  const programme = PROGRAMMES[kind];
  if (!programme || !VEHICLE_AREAS.includes(item.area) && item.tier != 1) return item;
  const effects = {};
  for (const key in item.effects) effects[key] = (key == 'f' || key == 'd') ? Math.round(item.effects[key] * programme.sizeScale * 10) / 10 : item.effects[key];
  return { ...item, cost: Math.round(item.cost * programme.costScale / 100) * 100, time: Math.round(item.time * programme.timeScale * .7), effects };
}

// A programme's true design, rolled when it starts: the nominal figures, a deviation inside the window, a bias in what the team
// first believes, and its hidden flaws. T (the true design) keeps the short stat keys of data/programmes.js; it is saved.
export function rollProgramme(kind) {
  const programme = PROGRAMMES[kind], design = programme.design;
  const trueDesign = { c: design.c, i: design.i }, bias = {};
  const traitCount = programme.traitRange[0] + Math.floor(Math.random() * (programme.traitRange[1] - programme.traitRange[0] + 1));
  // Satellite launchers are rolled within a narrower spread: their flaws are in reliability, not in whether orbit is possible at all.
  const spread = programme.canOrbit ? .45 : 1;
  for (const { key, startWidth } of DESIGN_STATS) {
    const deviation = Math.max(-1, Math.min(1, gaussian() * .45));
    trueDesign[key] = key == 'r' ? design.r + deviation * startWidth : design[key] * (1 + deviation * startWidth * spread);
    bias[key] = Math.max(-1.5, Math.min(1.5, gaussian()));
  }
  const pool = TRAITS.filter(trait => !trait.stagedOnly || programme.booster), traits = [];
  while (traits.length < traitCount && pool.length) {
    const trait = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    traits.push({ k: trait.key, found: 0 });
    if (trait.statPenalty) for (const stat in trait.statPenalty) trueDesign[stat] *= 1 + trait.statPenalty[stat];
  }
  return { T: trueDesign, bias, traits };
}

// Start a programme: a fresh bundle, the rolled design, and a head start in knowledge from the rockets already flown
// (a share of the best team's knowledge, or a larger share of the rocket it is derived from: HEAD_START in data/programmes.js).
export function createProgramme(kind) {
  const programme = PROGRAMMES[kind], bundle = newBundle(), rolled = rollProgramme(kind);
  Object.assign(bundle, { kind, start: Math.round(S.day), ...rolled, ready: programme.designTime ? 0 : 1 });
  const earlier = Object.values(S.progs);
  for (const area of VEHICLE_AREAS) {
    const best = Math.max(0, ...earlier.map(other => other.kn[area] || 0));
    const parent = programme.derivedFrom && S.progs[programme.derivedFrom] ? S.progs[programme.derivedFrom].kn[area] || 0 : 0;
    bundle.kn[area] = Math.max(best * HEAD_START.best, parent * HEAD_START.parent);
  }
  S.progs[kind] = bundle;
  return bundle;
}
export const programmeOf = airframe => airframe && airframe.prog || S.cur;
export const programmeData = (kind = S.cur) => PROGRAMMES[kind];

// Programme maturity: the team's average knowledge of the rocket's four systems.
export const maturity = kind => {
  const bundle = S.progs[kind];
  if (!bundle) return 0;
  return VEHICLE_AREAS.reduce((sum, area) => sum + (bundle.kn[area] || 0), 0) / VEHICLE_AREAS.length;
};
// Successful flights of the programme's own airframes (saved in its bundle as okf).
export const successfulFlights = kind => (S.progs[kind] && S.progs[kind].okf) || 0;
// Mature: the team knows the rocket (maturity MATURE) and has flown it successfully FLIGHTS_TO_MATURE times. Once mature, always mature.
export const isMature = kind => {
  const bundle = S.progs[kind];
  return !!bundle && (!!bundle.matured || (!!bundle.ready && maturity(kind) >= MATURE && successfulFlights(kind) >= FLIGHTS_TO_MATURE));
};
// Why a programme cannot be started yet, or null if it can: all prerequisites (or any one) mature, NASA where needed, the money.
export function startLock(kind) {
  const programme = PROGRAMMES[kind];
  if (S.progs[kind]) return 'Already started.';
  if (programme.needsNasa && !S.nasa) return 'Needs NASA.';
  const met = programme.anyRequirement ? programme.requires.some(isMature) : programme.requires.every(isMature);
  if (!met) return `Needs ${programme.requires.map(required => PROGRAMMES[required].name).join(programme.anyRequirement ? ' or ' : ' and ')} to mature (knowledge ${MATURE} and ${FLIGHTS_TO_MATURE} successful flights).`;
  if (S.b < programme.cost) return `Need ${formatMoney(programme.cost - S.b)} more.`;
  return null;
}
// Programmes worth showing as next: not started, and their prerequisites at least started.
export const candidates = () => PROGRAMME_ORDER.filter(kind => {
  const programme = PROGRAMMES[kind];
  return !S.progs[kind] && programme.requires && (programme.anyRequirement ? programme.requires.some(required => S.progs[required]) : programme.requires.every(required => S.progs[required]));
});
export function startProgramme(kind) {
  if (startLock(kind)) return false;
  const programme = PROGRAMMES[kind];
  S.b -= programme.cost;
  createProgramme(kind);
  S.jobs.push({ k: 'dev', prog: kind, id: kind, t: programme.designTime, tot: programme.designTime, free: 1 });
  log(`[PROGRAMME] ${programme.name} programme approved (${formatMoney(programme.cost)}). Engineers begin the detailed design; the first drawings are ready in about ${programme.designTime}s.`, 'hd');
  if (programme.igyFunding) {
    S.b += programme.igyFunding;
    log(`[CONGRESS] ${programme.name} is named the American satellite for the International Geophysical Year. A dedicated appropriation of ${formatMoney(programme.igyFunding)} comes with it.`, 'hd');
  }
  addHistory(`${programme.name} programme started`);
  recordRunEvent({ k: 'prog', id: kind });
  return true;
}
// The detailed design is finished: the programme can build airframes, and it takes the focus.
export function finishDesign(kind) {
  const bundle = S.progs[kind];
  if (!bundle) return;
  bundle.ready = 1;
  const previous = S.cur;
  S.cur = kind;
  log(`[PROGRAMME] ${PROGRAMMES[kind].name}: the drawings are released. Order airframes at the Hangar desk; its true performance is still to be learned.`, 'hd');
  // Each rocket keeps its own research and blueprint, so say plainly that the screens have moved to the new one.
  if (previous && previous != kind) log(`[PROGRAMME] The Design Bureau and Hangar now show the ${PROGRAMMES[kind].name}: new research goes to it. Switch back to the ${PROGRAMMES[previous].name} with the rocket bar at the top of either tab.`, 'wn');
}

// TRAITS. A trait is found when its failure mode is diagnosed or a review flags it; a stat trait surfaces once the team knows that system well (40).
export const traitsOf = kind => (S.progs[kind] || {}).traits || [];
export function revealTraits(kind) {
  const bundle = S.progs[kind];
  if (!bundle) return;
  for (const trait of bundle.traits) {
    if (trait.found) continue;
    const details = traitByKey(trait.k);
    let found = false;
    if (details.mode && bundle.known[details.mode]) found = true;
    if (!details.mode) {
      const stat = Object.keys(details.statPenalty)[0], area = DESIGN_STATS.find(entry => entry.key == stat).area;
      if ((bundle.kn[area] || 0) >= 40) found = true;
    }
    if (found) {
      trait.found = 1;
      log(`[ENGINEERING] ${PROGRAMMES[kind].name}: ${details.name.toLowerCase()}. ${details.why}${details.mode ? ' A fix for it cures the flaw.' : ''}`, 'wn');
    }
  }
}
// How much more likely failure mode `mode` is on this rocket because of a trait (1 = no trait, or the airframe carries the fix).
export const traitWeight = (kind, mode, airframe) => {
  const trait = traitsOf(kind).find(entry => traitByKey(entry.k).mode == mode);
  return trait && !(airframe && airframe.fix && airframe.fix[mode]) ? traitByKey(trait.k).weight : 1;
};

// The window the team believes for a stat: centred near the truth (an early bias that fades) and narrowing with knowledge.
export function believedWindow(kind, stat) {
  const bundle = S.progs[kind], entry = DESIGN_STATS.find(candidate => candidate.key == stat);
  if (!bundle || !entry) return null;
  const value = bundle.T[stat], knowledge = (bundle.kn[entry.area] || 0) / 100, width = entry.startWidth * (1 - .88 * knowledge);
  const half = stat == 'r' ? width : Math.abs(value) * width, mid = value + bundle.bias[stat] * half * .5;
  return { lo: mid - half, hi: mid + half, mid, true: value };
}
