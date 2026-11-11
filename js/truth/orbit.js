// THE HIDDEN TRUTH OF A MERCURY-ATLAS FLIGHT: the Atlas's climb to orbit, whether the orbit is good, what the capsule's
// heat shield and horizon scanner are really doing, the retrofire as it really happens, and where the capsule really
// comes down. No DOM, no drawing. Mercury Control meets it only through telemetry, the ground stations' reports, the
// radars and the recovery forces.
//
// The figures are Mercury-Atlas's (MA-6, February 1962): sustainer cutoff after about 300 s at about 7.84 km/s, level,
// about 160 km up. Three orbits of about 88 minutes. Retrofire over California; splashdown in the Atlantic near Grand Turk.
// Retrofire and entry are flown by the point-mass model in truth/entry.js.
import { draw, normal } from '../core/rng.js';
import { arc } from './capsule.js';
import { flyEntry, MERCURY_ENTRY } from './entry.js';
import { stackOf, stackBurn, burnStack, speedGained } from './stages.js';

const DEG = Math.PI / 180;
export const ORBIT_PLAN = { burn: 300, v: 7.84, gamma: 0, cutoffH: 160, need: 7.78, orbits: 3, period: 88, entryG: 8 };
export const ORBIT_ABORT_LIMIT = 6,
  ORBIT_BREAKUP = 18;
// A fault on the Atlas or the capsule brings trouble this often when it is there.
export const ORBIT_FAILURE = { guidance: 0.6, shortburn: 0.6, boost: 0.65 };
export const ORBIT_HIDDEN = 0.04;
// The heat shield: if it is really loose and the retro pack is jettisoned as planned, the shield can come off in entry.
export const SHIELD = { offIfJettisoned: 0.8, damagedIfKept: 0.15, debrisIfKept: 0.05 };
// The horizon scanners: a bad one leaves the automatic system holding the wrong attitude and burning fuel to do it.
export const SCANNER = { yaw: [18, 30], fuelPerOrbit: 0.3, nominalFuelPerOrbit: 0.12 };
// Below this fuel at retrofire a man flying by hand runs dry in the entry and she oscillates down.
export const FUEL_LOW = 0.15;
// The recovery forces for an orbital flight: the carrier on the planned point, destroyers up and down the track, and the
// ships in the Atlantic abort areas under the climb (km downrange of the Cape).
export const ORBIT_RECOVERY = {
  carrier: { at: 0, helo: 180 },
  uprange: { at: -300, ship: 45 },
  downrange: { at: 300, ship: 45 },
  abortAreas: [500, 1200, 2400],
  abortShip: 45,
  search: 40,
  beacon: 30,
  radarWait: 0.35,
  crane: 1,
  slow: 0.35,
  ready: 0.15,
};

const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
// The planned flight-path angle at second t, for a climb whose planned cutoff is at `burn` seconds.
export const orbitGamma = (t, burn = ORBIT_PLAN.burn) =>
  t < 10 ? 90 : 90 - 90 * smooth((t - 10) / (burn - 10)) ** 0.8;
// The planned cutoff of this booster's climb, seconds after liftoff: the sum of its stages' burns.
export const plannedBurn = vehicle => stackBurn(stackOf(vehicle));

// The climb to orbit, decided in full at liftoff. A fixed 9 draws.
// names: the booster's own fault kinds for a control failure and an early cutoff (the Titan II's are its own).
export function atlasAscent(
  round,
  force = null,
  names = { guidance: 'guidance', shortburn: 'shortburn', booster: 'Atlas' },
) {
  const ph = round.rng.physical,
    present = new Set(Object.values(round.faults || {}));
  const d = {
    guidance: draw(ph),
    sign: draw(ph),
    start: draw(ph),
    sustainer: draw(ph),
    cutAt: draw(ph),
    hidden: draw(ph),
    which: draw(ph),
    v: normal(ph),
    gamma: normal(ph),
  };
  let failure = null;
  if (force) failure = force === 'nominal' ? null : force;
  else if (present.has(names.guidance) && d.guidance < ORBIT_FAILURE.guidance) failure = names.guidance;
  else if (present.has(names.shortburn) && d.sustainer < ORBIT_FAILURE.shortburn) failure = names.shortburn;
  else if (names.boost && present.has(names.boost)) {
    // The booster-joint draw is taken only where a booster joint is in the model (the Shuttle), so no other vehicle's
    // draws move.
    if (draw(ph) < (round.warm ? 0.15 : (round.boostRisk ?? 0.6))) failure = names.boost;
  } else if (d.hidden < ORBIT_HIDDEN) {
    failure = d.which < 0.5 ? names.guidance : names.shortburn;
    round.events.push(`Something failed on the ${names.booster} that no inspection could have found.`);
  }
  // The climb is flown a stage at a time (truth/stages.js, data/stacks.js). An early cutoff strikes the booster's own
  // stage for it, somewhere past the middle of that stage's burn; the stages above it still light, but the speed it
  // never gave her is lost.
  const P = ORBIT_PLAN,
    stack = stackOf(round.vehicle),
    planned = stackBurn(stack),
    gammaOf = t => orbitGamma(t, planned);
  const nominal = burnStack(stack),
    cutStage = stack.shortburn ?? stack.stages.length - 1;
  const cutStart = stack.stages.slice(0, cutStage).reduce((a, s) => a + s.burn, 0);
  const flown =
    failure === names.shortburn
      ? burnStack(stack, { stage: cutStage, at: cutStart + (0.59 + 0.35 * d.cutAt) * stack.stages[cutStage].burn })
      : nominal;
  // Losses to gravity and air are taken off in proportion, so that a good climb cuts off at the planned speed.
  const vEnd = P.v * (1 + 0.002 * d.v),
    full = speedGained(nominal.rows, gammaOf),
    gained = flown === nominal ? full : speedGained(flown.rows, gammaOf),
    scale = vEnd / full[full.length - 1];
  const burn = flown.burn;
  const disp = 0.6 * d.gamma,
    drift = failure === names.guidance ? (d.sign < 0.5 ? -1 : 1) * 0.25 : 0,
    t0 = 60 + Math.round(90 * d.start);
  const steps = [];
  let breakupAt = null;
  for (let t = 0; t <= burn; t++) {
    const k = t / planned,
      row = flown.rows[t];
    const off = disp * smooth((t - 10) / (planned - 10)) + (drift && t > t0 ? drift * (t - t0) : 0);
    steps.push({
      t,
      v: Math.max(0, gained[t] * scale),
      gamma: gammaOf(t) + off,
      off,
      acc: row.acc,
      stage: row.name,
      h: P.cutoffH * Math.min(1, k) ** 1.3,
      x: 1400 * Math.min(1, k) ** 2.4,
    });
    if (drift && Math.abs(off) >= ORBIT_BREAKUP) {
      breakupAt = t;
      break;
    }
  }
  // A booster that fails structurally (the Shuttle's field joints) breaks the stack where it stands: the burn ends there.
  const boostBreak = failure === names.boost ? 58 + Math.round(20 * d.cutAt) : null;
  const a = {
    failure,
    burn,
    planned,
    staging: flown.staging,
    tower: stack.tower ?? null,
    steps,
    breakupAt,
    controlFrom: drift ? t0 : null,
    asis: true,
    orbital: true,
  };
  if (boostBreak != null) {
    a.boostFailure = true;
    a.breakupAt = boostBreak;
    steps.length = Math.min(steps.length, boostBreak + 1);
  }
  round.ascent = a;
  return a;
}

// Whether the orbit at cutoff is good: velocity against what the angle needs. Positive: a good orbit.
export const insertionMargin = (v, gammaOff) => v - ORBIT_PLAN.need - 0.04 * Math.abs(gammaOff);

// How the climb ends: in orbit, or aborted into the Atlantic. abortAt: seconds, or null.
// Returns round.end with outcome orbit | aborted | breakup, and for aborts the landing (km downrange) and capsule state.
export function atlasOutcome(round, abortAt = null) {
  const a = round.ascent;
  const atlantic = (s, extra = 0) => {
    const r = arc(Math.min(s.v, 6) + 0.1, Math.max(2, s.gamma), s.h, s.x);
    return {
      landing: Math.min(3000, r.range + extra),
      apogee: r.apogee,
      entryG: Math.min(16, 6 + 1.5 * s.v),
      coast: Math.min(1200, r.coast),
    };
  };
  if (abortAt != null && (a.breakupAt == null || abortAt < a.breakupAt) && abortAt < a.burn) {
    return (round.end = {
      outcome: 'aborted',
      ...atlantic(a.steps[Math.min(abortAt, a.steps.length - 1)]),
      capsule: 'safe',
      abortedAt: abortAt,
    });
  }
  if (a.breakupAt != null)
    return (round.end = {
      outcome: 'breakup',
      ...atlantic(a.steps[Math.min(a.breakupAt, a.steps.length - 1)]),
      // A crew riding the stack (the Shuttle, no tower) goes with it.
      capsule: a.boostFailure ? 'lost' : 'damaged',
      abortedAt: a.breakupAt,
      breakup: a.breakupAt,
    });
  const s = a.steps[a.steps.length - 1];
  return (round.end = {
    outcome: 'orbit',
    margin: insertionMargin(s.v, s.off),
    v: s.v,
    gammaOff: s.off,
    capsule: 'safe',
  });
}

// The Goddard computers' go/no-go for orbit, from the cutoff velocity and angle on telemetry. Right nearly always.
// Two observation draws.
export function goddard(round) {
  const ob = round.rng.observation,
    wrong = draw(ob) < 0.03,
    noise = 0.01 * normal(ob),
    e = round.end;
  const seen = { v: e.v + noise, gammaOff: e.gammaOff };
  const go = insertionMargin(seen.v, seen.gammaOff) >= 0 !== wrong;
  // need: the planned figure Goddard checks against, which the room knows; it goes up on the console with the reading.
  return (round.goddard = { ...seen, need: ORBIT_PLAN.need, go });
}

// What happens at insertion: 'go' keeps her up, 'nogo' fires the retros at once and brings her down in the last abort area.
// A go on an orbit that will not hold brings her down within the first orbit, far from any ship.
export function insertion(round, go, correction = 0) {
  const e = round.end;
  if (!go)
    return Object.assign(e, {
      outcome: 'nogo',
      landing: 2400 + 120 * (e.margin < 0 ? -1 : 1),
      capsule: 'safe',
      entryG: 9,
    });
  if (e.margin + correction < 0)
    return Object.assign(e, {
      outcome: 'decay',
      landing: 5500 + 3000 * Math.min(1, -e.margin * 10),
      capsule: 'damaged',
      entryG: 12,
    });
  return e;
}

// What the capsule is really doing in orbit, decided when it gets there. A fixed 6 draws.
// signal: whether Segment 51 (landing bag deployed) shows, and whether it flickers. scanner: a bad horizon scanner.
export function inOrbit(round) {
  const ph = round.rng.physical,
    present = new Set(Object.values(round.faults || {}));
  const d = {
    falseAlarm: draw(ph),
    flicker: draw(ph),
    yaw: draw(ph),
    sign: draw(ph),
    hand: normal(ph),
    late: draw(ph),
  };
  const loose = present.has('shield'),
    scanner = present.has('scanner');
  const falseAlarm = !loose && d.falseAlarm < (round.seg51Risk ?? 0.12);
  const o = {
    loose,
    scanner,
    signal: loose || falseAlarm,
    flicker: loose ? d.flicker < 0.25 : d.flicker < 0.7,
    scannerYaw: (d.sign < 0.5 ? -1 : 1) * (SCANNER.yaw[0] + (SCANNER.yaw[1] - SCANNER.yaw[0]) * d.yaw),
    handYaw: 4 * d.hand,
    handLate: 1 + 3 * d.late,
    fuelPerOrbit: scanner ? SCANNER.fuelPerOrbit : SCANNER.nominalFuelPerOrbit,
  };
  round.orbit = o;
  return o;
}
export const fuelAfter = (o, orbits) => Math.max(0, 1 - o.fuelPerOrbit * orbits);

// Retrofire and entry. how: 'auto' (on the automatic system) or 'manual' (fired by hand, lined up on the window).
// pack: 'keep' (retro pack left on through entry) or 'jettison'. A fixed 5 draws.
export function retrofire(round, how, pack) {
  const ph = round.rng.physical,
    o = round.orbit;
  const d = { dv: normal(ph), yaw: normal(ph), short: draw(ph), shield: draw(ph), osc: draw(ph) };
  const retro =
    how === 'auto'
      ? { yawError: (o.scanner ? o.scannerYaw : 1.5 * d.yaw) * DEG, late: 0.3, dvScale: 0.01 * d.dv }
      : { yawError: o.handYaw * DEG, late: o.handLate, dvScale: 0.01 * d.dv };
  if (d.short < 0.02) retro.dvScale -= 0.33;
  const e = flyEntry(MERCURY_ENTRY, retro);
  let capsule = 'safe';
  if (o.loose && pack === 'jettison') capsule = d.shield < SHIELD.offIfJettisoned ? 'lost' : 'damaged';
  else if (o.loose) capsule = d.shield < SHIELD.damagedIfKept ? 'damaged' : 'safe';
  else if (pack === 'keep' && d.shield < SHIELD.debrisIfKept) capsule = 'damaged';
  const fuel = fuelAfter(o, ORBIT_PLAN.orbits);
  const oscillated = how === 'manual' && fuel < FUEL_LOW;
  // Out of fuel she swings through the entry; now and then hard enough to hurt.
  if (oscillated && d.osc < 0.25 && capsule === 'safe') capsule = 'damaged';
  Object.assign(round.end, {
    outcome: 'entry',
    miss: e.miss / 1000,
    entryG: e.peakG + (oscillated ? 2 : 0),
    heat: e.heatLoad,
    blackout: e.blackout,
    capsule,
    how,
    pack,
    retro: { yaw: retro.yawError / DEG, late: retro.late, dv: retro.dvScale },
    oscillated,
  });
  return round.end;
}

// Where Mercury Control predicts the splashdown, km along the track from the planned point. 'retro': from the retrofire as
// telemetry reported it (the attitude as the scanner saw it); 'radar': the radars after blackout, accurate but later.
// Four observation draws.
export function orbitPredictions(round) {
  const ob = round.rng.observation,
    e = round.end,
    o = round.orbit;
  const n1 = normal(ob),
    n2 = normal(ob),
    n3 = normal(ob);
  draw(ob);
  const seenYaw = e.how === 'auto' && o.scanner ? 1.5 * n3 : e.retro.yaw + 2 * n3;
  const predicted =
    flyEntry(MERCURY_ENTRY, { yawError: seenYaw * DEG, late: e.retro.late, dvScale: e.retro.dv }).miss / 1000;
  return (round.ip = { planned: 0, retro: predicted + 10 * n1, radar: e.miss + 12 * n2 });
}

// Hours from splashdown to pickup. aim: km from the planned point where the helicopters go; waited: whether Recovery held
// them for the radar. An aborted or decayed flight is found by the nearest ship in the abort areas.
export function orbitRecoveryHours(end, aim, cond, trained, waited = false) {
  const R = ORBIT_RECOVERY,
    prep = trained ? R.ready : R.slow;
  // Down within the first orbit, far from any ship: the search aircraft find her, and a merchant ship or a destroyer
  // runs to her.
  if (end.outcome === 'decay') return prep + 6 + (end.landing - 5500) / 750 + (cond.seaState > 4 ? R.crane : 0);
  if (end.outcome !== 'entry') {
    const near = Math.min(...R.abortAreas.map(a => Math.abs(a - end.landing)));
    return prep + near / R.abortShip + (cond.seaState > 4 ? R.crane : 0);
  }
  const helosFly = cond.seaState < 5,
    options = [];
  if (helosFly) {
    const miss = Math.abs(aim - end.miss);
    options.push(
      Math.abs(aim) / R.carrier.helo +
        (miss <= R.beacon ? miss / R.carrier.helo : R.beacon / R.carrier.helo + (miss - R.beacon) / R.search) +
        (waited ? R.radarWait : 0),
    );
  }
  for (const id of ['uprange', 'downrange'])
    if (cond.late !== id) options.push(Math.abs(R[id].at - end.miss) / R[id].ship);
  if (!helosFly) options.push(Math.abs(end.miss) / R.uprange.ship);
  return prep + Math.min(...options) + (helosFly ? 0 : R.crane);
}
