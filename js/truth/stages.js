// A STACK FLOWN A STAGE AT A TIME. No DOM, no draws: given the stages (data/stacks.js) and where, if anywhere, one of them
// cuts off early, this works out the burn second by second. Each stage burns its own propellant at its own thrust, so the
// stack lightens and the acceleration builds through the burn; at staging the empty stage drops away and the next one
// lights, and the acceleration falls back. A stage that cuts off early stages at once: its unburned propellant goes with
// it, and the speed it would have given her is never flown.
import { ORBITAL_STACKS } from '../data/stacks.js';

export const G0 = 9.80665;
export const stackOf = vehicle => ORBITAL_STACKS[vehicle] || ORBITAL_STACKS.atlas;
// Seconds from liftoff to the last stage's planned cutoff.
export const stackBurn = stack => stack.stages.reduce((a, s) => a + s.burn, 0);
// Tonnes on the pad.
export const liftoffMass = stack => stack.stages.reduce((a, s) => a + s.prop + s.drop, stack.dry);

// The burn, one row a second from liftoff to the last cutoff: { t, stage (index), name, acc (g, what the crew feel) }.
// cut: { stage, at } — that stage shuts down at `at` seconds after liftoff, and the next stage (if any) lights then.
// Returns { rows, staging: [{ t, from, to, call }], burn (s), cutoff (the stage that burned last) }.
export function burnStack(stack, cut = null) {
  const rows = [],
    staging = [];
  let mass = liftoffMass(stack),
    t0 = 0;
  stack.stages.forEach((s, i) => {
    const mdot = s.prop / s.burn,
      len = cut && cut.stage === i ? Math.max(0, Math.min(s.burn, Math.round(cut.at - t0))) : s.burn;
    for (let k = 0; k < len; k++) {
      const m = mass - mdot * k,
        acc = Math.min(stack.maxG ?? Infinity, s.thrust / (m * G0));
      rows.push({ t: t0 + k, stage: i, name: s.name, acc });
    }
    mass -= s.prop + s.drop;
    t0 += len;
    if (i < stack.stages.length - 1) staging.push({ t: t0, from: s.name, to: stack.stages[i + 1].name, call: s.call });
  });
  // The last row: the moment of final cutoff, still on the last stage's thrust.
  const last = rows[rows.length - 1];
  rows.push({ ...last, t: t0, acc: last ? Math.min(stack.maxG ?? Infinity, last.acc * 1.003) : 0 });
  return { rows, staging, burn: t0 };
}

// Speed gained by each second of a burn, m/s: thrust less the share of gravity she is climbing against (gamma: the
// flight-path angle in degrees at second t). The game's planned angle is one curve for every booster, steeper than a
// heavy upper stage really flies just after staging, so the gravity share never takes more than three quarters of the
// thrust: a stage that is burning is always adding speed.
export function speedGained(rows, gamma) {
  const out = [0];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i - 1],
      lift = Math.sin((gamma(r.t) * Math.PI) / 180);
    out.push(out[i - 1] + Math.max(0.25 * r.acc, r.acc - lift) * G0);
  }
  return out;
}

// ---- A ballistic round off the range's tower, a stage at a time ----
const GK = 0.00981, // km/s²
  DT = 0.05;
// Thrust acceleration (km/s²) at second t of the burn, with every stage at its own mass; 0 between and after burns.
function thrustAt(stack, t) {
  let mass = liftoffMass(stack),
    t0 = 0;
  for (const s of stack.stages) {
    if (t < t0) return 0; // coasting before this stage lights
    if (t < t0 + s.burn) return s.thrust / ((mass - (s.prop * (t - t0)) / s.burn) * 1000);
    mass -= s.prop + s.drop;
    t0 += s.burn + (s.coast || 0);
  }
  return 0;
}
const stackEnd = (stack, upTo = stack.stages.length) =>
  stack.stages.slice(0, upTo).reduce((a, s, i) => a + s.burn + (i < upTo - 1 ? s.coast || 0 : 0), 0);

// Fly the round: k scales the thrust (the losses to the air the stack does not model), tilt is radians off vertical,
// cutAt is the second all thrust ends (a failure; null for none), upTo: only the first upTo stages light.
// Returns { path: [{ t, x, h }] one a second until she is down, apogee, burnout (s) }.
function flyStack(stack, k, tilt, cutAt = null, upTo = stack.stages.length, wantPath = true) {
  const end = Math.min(stackEnd(stack, upTo), cutAt ?? Infinity),
    c = Math.cos(tilt),
    sn = Math.sin(tilt);
  let t = 0,
    h = 0,
    x = 0,
    vh = 0,
    vx = 0,
    top = 0;
  const path = wantPath ? [{ t: 0, x: 0, h: 0 }] : null;
  // Powered flight in small steps; a round that cannot lift herself off the tower stays on it.
  while (t < end - 1e-9) {
    const step = Math.min(DT, end - t),
      a = k * thrustAt(stack, t + step / 2);
    vh += (a * c - GK) * step;
    vx += a * sn * step;
    if (h <= 0 && vh < 0) vh = vx = 0;
    h = Math.max(0, h + vh * step);
    x += vx * step;
    t += step;
    top = Math.max(top, h);
    if (wantPath && Math.abs(t - Math.round(t)) < 1e-6) path.push({ t: Math.round(t), x, h });
  }
  const peak = vh > 0 ? h + (vh * vh) / (2 * GK) : top;
  if (!wantPath) return { apogee: Math.max(top, peak), burnout: end };
  // Then the coast, in whole seconds from burnout.
  const t0 = t,
    h0 = h,
    x0 = x;
  for (let s = Math.floor(t0) + 1; ; s++) {
    const dt = s - t0,
      hh = h0 + vh * dt - 0.5 * GK * dt * dt,
      xx = x0 + vx * dt;
    if (hh <= 0) {
      path.push({ t: s, x: xx, h: 0 });
      break;
    }
    path.push({ t: s, x: xx, h: hh });
  }
  return { path, apogee: Math.max(top, peak, ...path.map(p => p.h)), burnout: end };
}

// The thrust scale that makes a good round of this stack reach `apogee` km (or, with the stack's `fit`, makes its first
// stages alone reach the fitted height). Bisection: a fixed number of steps, no draws.
export function fitStack(stack, apogee, tilt) {
  const upTo = stack.fit?.stages ?? stack.stages.length,
    target = stack.fit?.apogee ?? apogee;
  const reach = k => flyStack(stack, k, tilt, null, upTo, false).apogee;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 40 && reach(hi) < target; i++) hi *= 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (reach(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// A round off the tower, flown a stage at a time: to the physical layer's apogee if all goes well, or from the second
// its thrust ended if not (cutAt). fitTilt: the lean the good round's scale is fitted at.
export function flySounding(stack, { apogee, tilt, fitTilt = tilt, cutAt = null }) {
  const k = fitStack(stack, apogee, fitTilt);
  return { ...flyStack(stack, k, tilt, cutAt), burn: Math.min(stackEnd(stack), cutAt ?? Infinity) };
}
