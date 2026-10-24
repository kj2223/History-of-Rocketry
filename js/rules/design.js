// THE VEHICLE DESIGN: what an airframe can do from its programme and its packages, and what a launch costs. No DOM.
import { formatMoney } from '../core/util.js';
import { BY_ID, isMilestone } from '../data/research.js';
import { PROPELLANTS, PAYLOADS } from '../data/launch.js';
import { findFix } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, isResearched, withProgramme } from '../core/state.js';
import { programmeOf, believedWindow } from './programs.js';

// The bare rocket of the programme in focus. With `estimated`, the figures the team believes (the middle of each window) instead of the truth.
// Before any programme exists, a small default rocket.
export function baseDesign(estimated) {
  const bundle = S.progs[S.cur];
  if (!bundle || !bundle.T) return { f: 12, g: 6, r: 0, i: 0, c: 1, h: .5, q: 1, dry: 40, thr: 2500 };
  if (!estimated) return bundle.T;
  const believed = { ...bundle.T };
  for (const stat of ['thr', 'dry', 'f', 'g', 'h', 'q', 'r']) {
    const window = believedWindow(S.cur, stat);
    if (window) believed[stat] = window.mid;
  }
  return believed;
}
// THE SPEC: the bare rocket plus every package in `ids`. Keys are the effect keys of data/research.js (EFFECTS):
//   f propellant (kg), t thrust multiplier, g g-limit, d added dry mass (kg), r reliability, i instrumentation, c drag,
//   h heat tolerance, q aero load limit, dry and thr the bare rocket's dry mass and thrust, rc/rv/sv recovery and science,
//   and the Mercury capsule systems. tier: the instrument tier, 0 to 3.
export function designSpec(ids, estimated) {
  const base = baseDesign(estimated);
  const spec = {
    f: base.f, t: 1, g: base.g, d: 0, r: base.r, i: base.i, c: base.c, h: base.h, q: base.q, dry: base.dry, thr: base.thr,
    rc: 0, rv: 700, sv: 1, hs: 0, ec: 0, ac: 0, rr: 0, pc: 0, lb: 0, man: 0, et: 0, as: 0, tj: 0, mr: 0, rq: 0, eg: 0, hb: 0, orb: 0, um: 0, mab: 0, cmd: 0,
  };
  for (const id of ids) {
    const done = S.pk[id];
    if (done) for (const key in done.a) spec[key] += done.a[key];
  }
  spec.tier = Math.max(0, Math.min(3, Math.floor(spec.i + 1e-9)));
  return spec;
}
// What the corrective fixes on an airframe change: t thrust (multiplier), and d dry mass, g, h, c and q (added).
export const fixModifiers = fixes => {
  const modifiers = { t: 1, d: 0, g: 0, h: 0, c: 0, q: 0 };
  for (const mode in fixes) {
    const fix = findFix(mode, fixes[mode]);
    if (fix) {
      modifiers.t *= fix.effects.t || 1;
      for (const key of ['d', 'g', 'h', 'c', 'q']) modifiers[key] += fix.effects[key] || 0;
    }
  }
  return modifiers;
};

// THE DESIGNATION, e.g. "Mk. II.1": the Roman numeral counts milestones, the decimal every three ordinary packages.
export const packageCounts = (ids = Object.keys(S.pk)) => {
  const milestones = ids.filter(isMilestone).length;
  return { packages: ids.length - milestones, milestones };
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const designation = ids => {
  const counts = packageCounts(ids);
  return `Mk. ${ROMAN[Math.min(7, counts.milestones)]}${counts.packages >= 3 ? '.' + Math.floor(counts.packages / 3) : ''}`;
};
export const airframeLabel = (programme, packages, id) => `${PROGRAMMES[programme] ? PROGRAMMES[programme].name + ' ' : ''}${designation(packages)} #${id}`;

// What the flight sends home: g ground tracking tier (radar network, downrange ship), v the airframe's instrument tier.
export const trackingTiers = () => ({ g: (S.fac.radar ? 1 : 0) + (S.fac.ship ? 1 : 0), v: designSpec(Object.keys(S.pk)).tier });
// The era (0 to 2) sets the look of the page: it moves on at directive 2 and directive 4.
export const era = () => S.dir >= 4 ? 2 : S.dir >= 2 ? 1 : 0;
// The range fee for each launch rises from $1,000 to $5,000 as the directives get bigger.
export const rangeFee = () => Math.round(1000 + 4000 * Math.min(1, S.dir / 4));

// Propellant is bought in bulk: the price per kilogram falls as rockets grow.
export const propellantCost = (airframe, name, load = 1) => withProgramme(programmeOf(airframe), () => {
  const propellant = PROPELLANTS[name];
  return Math.round(propellant.handlingCost + propellant.pricePerKg * Math.pow(designSpec(airframe.pk).f * propellant.density * load, .8));
});

// Staging and satellites come with the rocket: a programme either has them or it does not.
export const hasBoosterStage = airframe => !!(PROGRAMMES[programmeOf(airframe)] || {}).booster;
export const cannotOrbit = airframe => !(PROGRAMMES[programmeOf(airframe)] || {}).canOrbit;

// THE LAUNCH QUOTE: the cost of a launch, or why it cannot go. Returns { cost, error }; cost is missing when the choice is impossible.
const STAGING_COST = 8000; // extra for flying the booster stage
const LIFTOFF_MARGIN = 1.05; // thrust must beat weight by 5%
export function quoteLaunch(airframe, propellantName, payloadName, stage, load = 1) {
  if (!airframe) return { error: 'No airframe is ready.' };
  return withProgramme(programmeOf(airframe), () => quoteForProgramme(airframe, propellantName, payloadName, stage, load));
}
function quoteForProgramme(airframe, propellantName, payloadName, stage, load) {
  const programme = PROGRAMMES[programmeOf(airframe)];
  if (!programme.propellants.includes(propellantName)) return { error: `${programme.name} does not burn ${propellantName}.` };
  const propellant = PROPELLANTS[propellantName], payload = PAYLOADS[payloadName];
  if (payload.needs && !isResearched(payload.needs)) return { error: `The ${payloadName} needs ${BY_ID[payload.needs].name}.` };
  const spec = designSpec(airframe.pk), modifiers = fixModifiers(airframe.fix), staged = stage && hasBoosterStage(airframe);
  const cost = propellantCost(airframe, propellantName, load) + payload.cost + (staged ? STAGING_COST : 0) + rangeFee();
  if (S.b < cost) return { cost, error: `Need ${formatMoney(cost - S.b)} more.` };
  // Research reaches the booster stage at half strength (see rules/flight.js).
  const half = x => 1 + (x - 1) * .5, design = programme.design, booster = programme.booster;
  const lift = staged ? booster.thr * half(spec.thr / design.thr * spec.t * modifiers.t) : spec.thr * spec.t * modifiers.t;
  const mass = spec.dry + spec.d + modifiers.d + spec.f * propellant.density * load + payload.mass
    + (staged ? booster.dry * half(spec.dry / design.dry) + booster.fuel * half(spec.f / design.f) * load : 0);
  if (lift < mass * 9.81 * LIFTOFF_MARGIN) return { cost, error: 'Too heavy to lift off. Lighter payload or a stronger engine needed.' };
  return { cost };
}

