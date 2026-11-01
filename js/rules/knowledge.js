// INSTITUTIONAL KNOWLEDGE: how well your engineers understand each system of the vehicle, 0 to 100. No DOM.
// It grows from research, tests, flights, investigations and fixes (failures teach most), and it makes every later judgement better.
import { S, log } from '../core/state.js';
import { FAILURE_MODES } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { traitsOf, revealTraits, VEHICLE_AREAS } from './programs.js';
import { traitByKey } from '../data/programmes.js';
import { countFlight } from './cures.js';

// Each research area is a system of the vehicle; the booster's failure modes belong to the system that would catch them.
export const SYSTEMS = {
  p: { name: 'Propulsion', modes: 'cpiv' },
  s: { name: 'Structures & staging', modes: 'sx' },
  a: { name: 'Aerodynamics & heating', modes: 'hf' },
  i: { name: 'Instrumentation & guidance', modes: '' },
  r: { name: 'Recovery', modes: '' },
  c: { name: 'Mercury spacecraft', modes: '' },
  e: { name: 'Escape & man-rating', modes: '' },
};
// The system a failure mode belongs to (propulsion if none claims it).
export const systemOf = mode => Object.keys(SYSTEMS).find(area => SYSTEMS[area].modes.includes(mode)) || 'p';
export const knowledge = area => (S.kn && S.kn[area]) || 0;
export const knowledgeFraction = area => knowledge(area) / 100; // 0 to 1, the form most formulas use

// The level names the player sees. A value below the first number gets that name.
export const LEVELS = [[15, 'Unfamiliar'], [35, 'Familiar'], [60, 'Understood'], [85, 'Well understood'], [101, 'Mastered']];
export const levelName = value => LEVELS.find(level => value < level[0])[1];

// Gains shrink as a system becomes well known: the last few points come slowly.
// A small, simple rocket is learned faster than a big new one (the programme's learning rate).
export function learn(area, points) {
  if (!SYSTEMS[area] || points <= 0) return;
  const isVehicleArea = VEHICLE_AREAS.includes(area), programme = isVehicleArea && PROGRAMMES[S.cur];
  points *= programme ? programme.learningRate : 1;
  const value = knowledge(area), before = levelName(value);
  S.kn[area] = Math.min(100, value + points * (1 - value / 130));
  const after = levelName(S.kn[area]);
  if (after != before) log(`[ENGINEERING] ${programme ? programme.name + ' ' : ''}${SYSTEMS[area].name.toLowerCase()}: the team now rates its knowledge as ${after.toLowerCase()}.`, 'cyan');
  if (isVehicleArea) revealTraits(S.cur);
}
// What a flight teaches depends on how much it sends home: instruments aboard (tracking.v) and tracking on the ground (tracking.g).
export const teachingValue = tracking => .6 + .3 * (tracking ? tracking.v : 0) + .2 * (tracking ? tracking.g : 0) + (S.fac.trknet ? .3 : 0);
export function learnFromFlight(flight, ok) {
  const value = teachingValue(flight.tracking), bundle = S.progs[flight.programme];
  if (ok && bundle) bundle.okf = (bundle.okf || 0) + 1;
  countFlight(flight.programme);
  for (const area of ['p', 's', 'a']) learn(area, .8 * value);
  if (!ok && flight.failure) learn(systemOf(flight.failure), 2.5 * value);
}
// A new booster milestone means re-learning part of what the team knew about the old design (it keeps 80%).
export function redesign(area) {
  if (!S.kn || !S.kn[area]) return;
  S.kn[area] *= .8;
  log(`[ENGINEERING] ${SYSTEMS[area].name}: the new design means re-learning part of what the team knew.`, 'wn');
}

// The failure modes a system's engineering file lists: cured, diagnosed, or blamed for an incident that waits for (or is getting) a fix.
// It goes by the engineers' diagnosis, not the true cause, so a wrong diagnosis is filed where they think it belongs and stays visible.
export const filedModes = area => [...SYSTEMS[area].modes]
  .filter(mode => S.fix[mode] || S.known[mode] || S.inc.some(incident => incident.dx == mode && (incident.st == 'diag' || incident.st == 'fixing')));

// DESIGN REVIEWS: a team studies one system for failure modes that have not happened yet.
export const REVIEW_COST = 3000;
export const reviewOdds = area => Math.min(.9, .2 + .65 * knowledgeFraction(area));
export const reviewTime = area => Math.round(40 * (1 - .35 * knowledgeFraction(area)));
// Failure modes in a system that have never been fixed and are not already under investigation: what a review can turn up.
// The rocket's own flaws count three times: they are what a review is most likely to find.
export const hiddenModes = area => {
  const traitModes = traitsOf(S.cur).map(trait => traitByKey(trait.k).mode);
  return [...SYSTEMS[area].modes]
    .filter(mode => !S.fix[mode] && !S.inc.some(incident => incident.mode == mode && incident.st != 'done'))
    .flatMap(mode => traitModes.includes(mode) ? [mode, mode, mode] : [mode]);
};
export function finishReview(area) {
  const pool = hiddenModes(area);
  if (pool.length && Math.random() < reviewOdds(area)) {
    const mode = pool[Math.floor(Math.random() * pool.length)], id = S.inc.reduce((highest, incident) => Math.max(highest, incident.id), 0) + 1;
    S.inc.push({ id, mode, sym: [], cand: [mode], ev: 0, st: 'diag', dx: mode, conf: 'high', t: 0, lab: 'Design review', review: 1 });
    S.known[mode] = 1;
    learn(area, 3);
    revealTraits(S.cur);
    log(`[DESIGN REVIEW] ${SYSTEMS[area].name}: the engineers flag ${FAILURE_MODES[mode].name.toLowerCase()} as a risk before it has ever failed in flight. Remedies are on the table.`, 'hd');
  } else {
    learn(area, 4);
    log(`[DESIGN REVIEW] ${SYSTEMS[area].name}: no new concerns found. The team knows the system a little better.`, 'ok');
  }
}
