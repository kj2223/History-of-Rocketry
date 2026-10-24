// THE TRAJECTORY TEAM: trajectory analysts on FIDO's staff work candidate flight plans for the rocket on the launch form and keep
// the best one for the goal the player picks. Each candidate is one engineers' prediction (previewFlight), so the team finds the
// best plan the engineers can see, not the flight the day will bring. No DOM: the UI keeps the search and feeds it the days that pass.
//
// A search: { key: the rocket, load and goal it is for, untried: candidate plans not yet worked, total: candidates in all,
//   worked: candidates worked, best: { plan, score, preview } or null, carry: runs owed but not yet worked (a fraction of one) }
import { formatMoney } from '../core/util.js';
import { FACILITIES, STATIONS, TRAJECTORY_ANALYSTS } from '../data/launch-site.js';
import { PITCH_PROGRAMS, ELEVATION_RANGE, AIM_RANGE } from '../data/launch.js';
import { S, log } from '../core/state.js';

export const analysts = () => S.staff.ta || 0;

// Why another analyst cannot be hired, or null.
export function analystLock() {
  if (analysts() >= TRAJECTORY_ANALYSTS.max) return 'Fully staffed.';
  if (!S.fac[TRAJECTORY_ANALYSTS.requires]) return `Needs ${FACILITIES[TRAJECTORY_ANALYSTS.requires].name}.`;
  if (!S.crew[TRAJECTORY_ANALYSTS.worksFor]) return `Needs a ${STATIONS[TRAJECTORY_ANALYSTS.worksFor].name} on console.`;
  if (S.b < TRAJECTORY_ANALYSTS.cost) return `Need ${formatMoney(TRAJECTORY_ANALYSTS.cost - S.b)} more.`;
  return null;
}
export function hireAnalyst() {
  if (analystLock()) return;
  S.b -= TRAJECTORY_ANALYSTS.cost;
  S.staff.ta = analysts() + 1;
  log(`[PERSONNEL] A trajectory analyst joins FIDO's staff (${S.staff.ta} on the team).`, 'ok');
}
export function releaseAnalyst() {
  if (!analysts()) return;
  S.staff.ta--;
  log(`[PERSONNEL] A trajectory analyst leaves FIDO's staff (${S.staff.ta} on the team).`, 'wn');
}

// GOALS: what the team searches for. score rates an engineers' prediction; higher is better.
// Orbit: reaching it beats any miss; among orbits, more horizontal speed (margin); short of it, horizontal speed counted only
// in proportion to the height reached toward 120 km.
const ORBIT_ALTITUDE = 120000, ORBIT_BONUS = 1e6;
export const TRAJECTORY_GOALS = {
  height: { name: 'Height', describe: 'the highest apogee', score: preview => preview.peakAltitude },
  range: { name: 'Range', describe: 'the longest trip downrange', score: preview => preview.downrange },
  orbit: { name: 'Orbit', describe: 'orbit with the most speed to spare', score: preview => (preview.orbit ? ORBIT_BONUS : 0) + preview.peakHorizontalSpeed * Math.min(1, preview.peakAltitude / ORBIT_ALTITUDE) },
};
// A plan that takes the airframe past this share of its aerodynamic or heating limit is out: it scores below every plan inside
// the margin, the smallest overshoot first, so the team still names the gentlest one if nothing fits.
export const SAFE_LOAD = .85;
export function scorePlan(preview, goal) {
  const overshoot = Math.max(0, preview.maxQ - SAFE_LOAD, preview.maxHeat - SAFE_LOAD);
  return overshoot ? -overshoot : TRAJECTORY_GOALS[goal].score(preview);
}

// Every plan the panel could set: each launcher elevation, each pitch program and, on a staged rocket, each upper stage aim
// from the flattest the guidance holds (flattestAim, null when there is no upper stage) up to the steepest allowed.
export function candidatePlans(flattestAim) {
  const aims = [];
  if (flattestAim == null) aims.push(null);
  else for (let aim = flattestAim; aim <= AIM_RANGE.max; aim++) aims.push(aim);
  const plans = [];
  for (let elevation = ELEVATION_RANGE.min; elevation <= ELEVATION_RANGE.max; elevation++)
    for (const program in PITCH_PROGRAMS)
      for (const aim of aims) plans.push(aim == null ? { elevation, program } : { elevation, program, aim });
  return plans;
}
export function newSearch(key, flattestAim) {
  const untried = candidatePlans(flattestAim);
  return { key, untried, total: untried.length, worked: 0, best: null, carry: 0 };
}

// THE TEAM AT WORK: over days, each analyst works runsPerDay candidates, picked at random from those not yet tried.
// evaluate(plan) returns the engineers' prediction for a plan. Returns true if the best plan changed.
// The analysts work only while FIDO is on console.
export function workSearch(search, days, goal, evaluate) {
  if (!analysts() || !S.crew[TRAJECTORY_ANALYSTS.worksFor]) return false;
  search.carry += analysts() * TRAJECTORY_ANALYSTS.runsPerDay * days;
  let improved = false;
  while (search.carry >= 1 && search.untried.length) {
    search.carry--;
    const plan = search.untried.splice(Math.floor(Math.random() * search.untried.length), 1)[0];
    const preview = evaluate(plan), score = scorePlan(preview, goal);
    search.worked++;
    if (!search.best || score > search.best.score) {
      search.best = { plan, score, preview };
      improved = true;
    }
  }
  return improved;
}
