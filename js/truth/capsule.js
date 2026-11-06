// THE HIDDEN TRUTH OF A MERCURY-REDSTONE FLIGHT: the booster's climb, the capsule's arc, where it really comes down and how
// long the recovery forces take to reach it. No DOM, no drawing. The player meets it only through Mercury Control's
// consoles: the flight-path angle and velocity on the trajectory plot, the impact predictions, and the recovery reports.
//
// The figures are the Mercury-Redstone's (MR-3, May 1961): cutoff after about 142 s at about 2.29 km/s, 40 degrees above
// the horizon, about 60 km up; peak about 187 km, splashdown about 486 km downrange, about 11 g on the way back in.
// The arc after cutoff is flat-earth ballistic, scaled to those figures.
import { draw, normal } from '../core/rng.js';

export const PLAN = { burn: 142, v: 2.29, gamma: 40, cutoffH: 60, range: 486, apogee: 187, entryG: 11 };
// Degrees off the planned flight-path angle at which Mercury Control calls an abort.
export const ABORT_LIMIT = 6;
// A control failure that is not caught breaks the booster up when she is this far off her line.
export const BREAKUP = 18;
// The capsule's automatic abort sensing (ASIS) catches a breaking-up booster this often.
export const ASIS = 0.85;
// A fault on the booster brings the flight down this often when it is there.
export const FAILURE = { plug: 0.9, control: 0.6, lox: 0.6, thrust: 0.8 };
// Some faults leave nothing to find. The Redstone was a mature missile by 1960.
export const HIDDEN_FAILURE = 0.05;
// How the capsule is recovered: the carrier at the planned point with its helicopters, destroyers up and down the track.
export const RECOVERY = {
  carrier: { at: 486, name: 'the carrier', helo: 180 },
  uprange: { at: 300, name: 'the uprange destroyer', ship: 45 },
  downrange: { at: 640, name: 'the downrange destroyer', ship: 45 },
  search: 40, // km/h, once the helicopters are at the aim point and the capsule is not in sight
  beacon: 30, // km: within this of the aim point, the capsule's beacon and dye marker bring them straight in
  crane: 1, slow: 0.35, ready: 0.15, // hours before the first helicopter is off the deck: untrained, or trained in the sims that week
};
// An uncrewed capsule left in the water this long may take on water and sink (MR-2 nearly did).
export const SINK_AFTER = 1.5, SINK_CHANCE = 0.3;

const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
export const plannedGamma = t => (t < 12 ? 90 : 90 - (90 - PLAN.gamma) * smooth((t - 12) / (PLAN.burn - 12)));
const RAD = Math.PI / 180, G = 0.00981;

// Where a capsule moving at v km/s, gamma degrees above the horizon, h km up and x km downrange comes down.
export function arc(v, gamma, h, x) {
  const vy = v * Math.sin(gamma * RAD), vx = v * Math.cos(gamma * RAD);
  const top = h + Math.max(0, vy) ** 2 / (2 * G);
  const up = Math.max(0, vy) / G, down = Math.sqrt(2 * top / G);
  const range = x + 0.77 * vx * (up + down);
  return { apogee: top * 1.1, range, entryG: PLAN.entryG * (v / PLAN.v) ** 2 * Math.max(0.15, Math.sin(Math.max(5, gamma) * RAD)) / Math.sin(PLAN.gamma * RAD), coast: up + down };
}

// The climb, decided in full at liftoff. force: for a training sim, the failure the sim supervisor chose (or 'nominal').
// The same number of draws is taken whatever happens, so the round's later draws do not depend on the outcome.
export function ascent(round, force = null) {
  const ph = round.rng.physical, f = round.faults || {}, present = new Set(Object.values(f));
  const d = { plug: draw(ph), control: draw(ph), sign: draw(ph), start: draw(ph), lox: draw(ph), loxAt: draw(ph), thrust: draw(ph), boost: draw(ph),
    hidden: draw(ph), which: draw(ph), asis: draw(ph), v: normal(ph), gamma: normal(ph) };
  let failure = null;
  if (force) failure = force === 'nominal' ? null : force;
  else {
    if (present.has('plug') && d.plug < FAILURE.plug) failure = 'plug';
    else if (present.has('control') && d.control < FAILURE.control) failure = 'control';
    else if (present.has('lox') && d.lox < FAILURE.lox) failure = 'lox';
    else if (round.thrust && d.thrust < FAILURE.thrust) failure = 'thrust';
    else if (d.hidden < HIDDEN_FAILURE) { failure = ['control', 'lox', 'thrust'][Math.floor(d.which * 3)]; round.events.push('Something failed on the booster that no inspection could have found.'); }
  }
  const vEnd = PLAN.v * (1 + 0.012 * d.v) * (failure === 'thrust' ? 1.065 + 0.03 * d.boost : 1);
  const burn = failure === 'thrust' ? 137 : failure === 'lox' ? Math.round(100 + 25 * d.loxAt) : PLAN.burn;
  const disp = 1.2 * d.gamma, drift = failure === 'control' ? (d.sign < 0.5 ? -1 : 1) * 0.35 : 0, t0 = 45 + Math.round(20 * d.start);
  const steps = [];
  let breakupAt = null;
  for (let t = 0; t <= burn; t++) {
    const k = t / (failure === 'thrust' ? burn : PLAN.burn), v = vEnd * k ** 1.4;
    const off = disp * smooth((t - 12) / (PLAN.burn - 12)) + (drift && t > t0 ? drift * (t - t0) : 0);
    const acc = (1.3 + 5 * k ** 1.6) * (failure === 'thrust' ? 1.07 : 1);
    steps.push({ t, v, gamma: plannedGamma(t) + off, off, acc, h: PLAN.cutoffH * k ** 1.8, x: 40 * k ** 2.6 });
    if (drift && Math.abs(off) >= BREAKUP) { breakupAt = t; break; }
  }
  const a = { failure, burn, steps, breakupAt, controlFrom: drift ? t0 : null, asis: d.asis < ASIS, padAbort: failure === 'plug' };
  // The Redstone that rose an inch: the engine shut down as the tail plug came out, and the capsule sat on the pad.
  if (a.padAbort) { a.steps = [{ t: 0, v: 0, gamma: 90, off: 0, acc: 0, h: 0, x: 0 }]; a.burn = 0; }
  // Over-thrust: the booster runs dry early, and the abort sensing trips at depletion (MR-2, Ham's flight).
  if (failure === 'thrust') a.asisAbort = d.asis < 0.7;
  round.ascent = a;
  return a;
}

// The state of the climb at second t (the last step if the climb ended before then).
export const stepAt = (a, t) => a.steps[Math.max(0, Math.min(a.steps.length - 1, Math.floor(t)))];

// How the flight ends, given whether and when Mercury Control called an abort. abortAt: seconds, or null.
// Returns { outcome, landing (km downrange), apogee, entryG, capsule: 'safe' | 'damaged' | 'lost', abortedAt, breakup }.
export function outcome(round, abortAt = null) {
  const a = round.ascent;
  if (a.padAbort) return (round.end = { outcome: 'pad', landing: 0, apogee: 0, entryG: 0, capsule: 'safe', abortedAt: null });
  // An abort called before the booster breaks up: the escape tower pulls the capsule away cleanly.
  if (abortAt != null && (a.breakupAt == null || abortAt < a.breakupAt) && abortAt < a.burn) {
    const s = stepAt(a, abortAt), r = arc(s.v + 0.1, s.gamma, s.h, s.x);
    return (round.end = { outcome: 'aborted', landing: r.range, apogee: r.apogee, entryG: r.entryG, capsule: 'safe', abortedAt: abortAt, coast: r.coast });
  }
  // The booster breaks up off her line: the abort sensing pulls the capsule off late, or nothing does.
  if (a.breakupAt != null) {
    const s = stepAt(a, a.breakupAt), r = arc(s.v * 0.9, s.gamma, s.h, s.x);
    return (round.end = { outcome: 'breakup', landing: r.range, apogee: r.apogee, entryG: r.entryG + 4, capsule: a.asis ? 'damaged' : 'lost', abortedAt: a.asis ? a.breakupAt : null, breakup: a.breakupAt, coast: r.coast });
  }
  const s = a.steps[a.steps.length - 1], push = a.asisAbort ? 0.12 : 0, r = arc(s.v + push, s.gamma, s.h, s.x);
  const kind = a.asisAbort ? 'asis' : a.failure === 'lox' ? 'short' : a.failure === 'thrust' ? 'long' : 'nominal';
  return (round.end = { outcome: kind, landing: r.range, apogee: r.apogee, entryG: r.entryG, capsule: r.entryG > 16 ? 'damaged' : 'safe', abortedAt: a.asisAbort ? a.burn : null, coast: r.coast });
}

// What Mercury Control's computers predict for the splashdown: from the range radars, and from the cutoff velocity and
// angle on telemetry. The radar is better unless its track drops out, and the console shows when it does. Observation draws.
export function impactPredictions(round) {
  const ob = round.rng.observation, truth = round.end.landing;
  const radarErr = 8 * normal(ob), drop = draw(ob), dropBy = draw(ob), teleErr = 25 * normal(ob);
  const intermittent = round.forceRadar ?? drop < 0.15;
  const radar = truth + radarErr + (intermittent ? (dropBy < 0.5 ? -1 : 1) * (60 + 60 * dropBy) : 0);
  return (round.ip = { radar: Math.max(0, radar), intermittent, telemetry: Math.max(0, truth + teleErr), planned: PLAN.range });
}

// Hours from splashdown to the capsule's being picked up, sending the helicopters to `aim` (km downrange).
// conditions: { seaState, late: null | 'uprange' | 'downrange' }, and whether the team ran sims that week (trained).
export function recoveryHours(landing, aim, conditions, trained) {
  const R = RECOVERY, helosFly = conditions.seaState < 5;
  const options = [];
  if (helosFly) {
    const miss = Math.abs(aim - landing);
    options.push(Math.abs(R.carrier.at - aim) / R.carrier.helo + (miss <= R.beacon ? miss / R.carrier.helo : R.beacon / R.carrier.helo + (miss - R.beacon) / R.search));
  }
  for (const id of ['uprange', 'downrange']) if (conditions.late !== id) options.push(Math.abs(R[id].at - landing) / R[id].ship);
  // With the helicopters grounded the carrier steams to the capsule too.
  if (!helosFly) options.push(Math.abs(R.carrier.at - landing) / R.downrange.ship);
  // In a heavy sea a ship has to hook her with its crane: slow, and dangerous for the swimmers.
  return (trained ? R.ready : R.slow) + Math.min(...options) + (helosFly ? 0 : R.crane);
}

// Whether an uncrewed capsule left in the water too long sinks before it is reached. One physical draw.
export function sinks(round, hours) { const d = draw(round.rng.physical); return hours > SINK_AFTER && d < SINK_CHANCE; }

// The capsule on the pad after the engine shut down: what happens if the pad crew goes out to it before the batteries
// have run down and the oxygen has boiled off overnight. One physical draw.
export const TOPPLE = 0.3;
export function padCrewNow(round) { return draw(round.rng.physical) < TOPPLE; }

// The day's conditions in the recovery area, from the forecast stream: the sea state, and whether a ship is late on
// station. A sim supervisor can set them instead.
export function conditions(round, force = null) {
  const fc = round.rng.forecast, rough = draw(fc), sea = draw(fc), late = draw(fc), which = draw(fc);
  if (force === 'seastate') return { seaState: 5, late: null };
  if (force === 'offstation') return { seaState: 2, late: which < 0.5 ? 'uprange' : 'downrange' };
  if (force) return { seaState: 2 + Math.floor(sea * 2), late: null };
  return { seaState: rough < 0.18 ? 5 : 2 + Math.floor(sea * 2), late: late < 0.22 ? (which < 0.5 ? 'uprange' : 'downrange') : null };
}
