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
