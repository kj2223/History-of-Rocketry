// MONEY AND REPUTATION: appropriations, the Defense Department supplement, payroll, range data and reputation losses. No DOM.
// Also the estimate of your progress in the race, which drives the supplement and the calendar catch-up.
import { STATIONS, TRAJECTORY_ANALYSTS } from '../data/launch-site.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, isResearched } from '../core/state.js';
import { instalment } from './budget.js';
import { leadsPayroll } from './leads.js';

// THE APPROPRIATION, paid every 30 seconds: a base, a bonus for the altitude record (up to $9,000), the science bonus,
// $5,000 with the downrange ship; scaled by reputation (never below 20%), +10% per directive met, the Phase Two multiplier,
// and the Soviet scares (+10% after their ICBM test, +30% after Sputnik until America has a satellite up).
// Once NASA has a yearly budget (rules/budget.js), this is that budget's instalment.
export const grant = () => S.fy ? instalment() : phaseOneGrant();
export const phaseOneGrant = () => baseGrant() + defenseSupplement();
const baseGrant = () => Math.round(
  (10000 + Math.min(9000, Math.floor(S.hi / 1000) * 150) + S.pb + (S.fac.ship ? 5000 : 0))
  * Math.max(.2, S.rep / 100)
  * (1 + .1 * S.dir)
  * (S.nasa ? (S.p2 && S.p2.gmul) || 1 : 1)
  * (1 + (S.rvd.r_icbm ? .1 : 0) + (S.rvd.r_sat && !S.fs.f_orbit ? .3 : 0)));

// The Defense Department tops up appropriations when intelligence puts the Soviets ahead: the bigger the gap, the bigger the supplement
// (nothing within 5 points, up to 75% of the base grant).
export const defenseSupplement = () => {
  const gap = sovietGap();
  return gap > .05 ? Math.round(baseGrant() * Math.min(.75, (gap - .05) * 2.5)) : 0;
};
// The Soviet goal of the current phase: a satellite, then a human in orbit.
export const raceGoal = () => S.nasa ? 'r_gagarin' : 'r_sat';
export function sovietGap() {
  const goal = raceGoal();
  if (S.rvd[goal] || (S.nasa ? S.p2 && S.p2.secDone : S.fs.f_orbit)) return 0;
  const sovietProgress = S.nasa ? Math.min(1, (S.day - S.nasa) / (S.rv[goal] - S.nasa)) : Math.min(1, S.day / S.rv[goal]);
  return sovietProgress - programmeProgress();
}
// Estimated progress toward the phase's goal, 0 to 1.
// Phase One: directives met, best speed against orbital speed, and the rocket generation reached.
// Phase Two: Mercury directives, the best astronaut's training and the Man-Rated Booster Program.
export function programmeProgress() {
  if (S.nasa && S.p2) {
    const phaseTwo = S.p2;
    if (phaseTwo.secDone) return 1;
    const training = Math.max(0, ...(phaseTwo.astros || []).map(astronaut => Math.min(1, astronaut.tday / 500)));
    return Math.min(.99, .7 * phaseTwo.dir / 6 + .15 * training + .15 * (isResearched('ms_mrman') ? 1 : 0));
  }
  if (S.fs.f_orbit == 'us' || S.fs.f_orbit == 'second') return 1;
  const generation = Math.max(0, ...Object.keys(S.progs).filter(kind => S.progs[kind].ready).map(kind => PROGRAMMES[kind].generation));
  return Math.min(.99, .45 * S.dir / 5 + .3 * Math.min(1, (S.hs || 0) / 7000) + .25 * Math.min(1, generation / 4));
}

// PAYROLL per 30-second cycle: build teams beyond the first, active astronauts, engineering teams beyond two, specialists,
// trajectory analysts, launch crew and research leads.
export const BUILD_TEAM_SALARY = 800, ASTRONAUT_SALARY = 600, ENGINEERING_TEAM_SALARY = 1200, PR_SALARY = 1000, DIRECTOR_SALARY = 2500;
export const payroll = () => Math.max(0, (S.bteams || 1) - 1) * BUILD_TEAM_SALARY
  + (S.p2 ? (S.p2.astros || []).filter(astronaut => astronaut.st == 'active' || astronaut.st == 'grounded').length * ASTRONAUT_SALARY : 0)
  + Math.max(0, S.teams - 2) * ENGINEERING_TEAM_SALARY
  + (S.staff.pr ? PR_SALARY : 0) + (S.staff.director ? DIRECTOR_SALARY : 0) + (S.staff.ta || 0) * TRAJECTORY_ANALYSTS.salary
  + Object.keys(S.crew).reduce((sum, station) => sum + (S.crew[station] && STATIONS[station] ? STATIONS[station].salary : 0), 0)
  + leadsPayroll();

// The Defense Department buys tracking data from every successful early flight: $2,500 plus $60 per km of peak altitude, up to $6,000.
// Half that from directive 2; nothing once a satellite is up.
export const rangeDataPayment = peak => S.fs.f_orbit ? 0 : Math.round(Math.min(6000, 2500 + 60 * peak / 1000) * (S.dir >= 2 ? .5 : 1));

// Reputation lost to a failure. kind: novel (a new failure), known (one already diagnosed), residual (despite the fix),
// obsolete (an old airframe without the fix), bio (an animal lost). Early failures cost about a third as much.
// The PR specialist halves it; the Range Safety Officer takes 30% off (not for animals).
const REPUTATION_LOSS = { novel: 3, known: 5, residual: 2, obsolete: 3, bio: 6 };
export function loseReputation(kind) {
  const base = REPUTATION_LOSS[kind] || 3, scale = kind == 'bio' ? 1 : .34 + .66 * Math.min(1, S.dir / 4);
  S.rep = Math.max(0, S.rep - Math.max(1, base * scale) * (S.staff.pr ? .5 : 1) * (S.crew.rso && kind != 'bio' ? .7 : 1));
}
