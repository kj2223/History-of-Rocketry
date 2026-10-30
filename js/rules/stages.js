// STAGE DESIGNS (Apollo step 3): a rocket listed with stages (data/programmes.js) flies lower stages that are designs of their own.
// Each lower stage keeps a bundle in S.progs under its own key, like a rocket's: true figures and the team's windows on them, flaws,
// knowledge, incidents and fixes. Everything that works on the programme in focus works on a stage with it in focus
// (withProgramme(stage, ...)). Its fixes ride in the rocket's blueprint and airframes under mode@stage keys (rules/programs.js
// fixKeyFor), so one blueprint revision and one retrofit carry every stage. The rocket's own design is its top stage. No DOM.
import { FAILURE_MODES, findFix } from '../data/failures.js';
import { PROGRAMMES, DESIGN_STATS } from '../data/programmes.js';
import { S } from '../core/state.js';
import { baseDesign } from './design.js';
import { believedWindow, traitWeight } from './programs.js';

// A stage's figures: the truth, or (estimated) the middle of each window the team believes.
export function stageDesign(stage, estimated) {
  const bundle = S.progs[stage], figures = { ...bundle.T, isp: PROGRAMMES[stage].design.isp };
  if (estimated) for (const { key } of DESIGN_STATS) figures[key] = believedWindow(stage, key).mid;
  return figures;
}
// The fixes an airframe carries for one stage, by failure mode.
export const stageFixes = (airframe, stage) => Object.fromEntries(Object.entries(airframe.fix || {})
  .filter(([key]) => key.endsWith('@' + stage)).map(([key, id]) => [key.split('@')[0], id]));
// What a stage's fixes change: t thrust (multiplier), d dry mass (added).
const stageModifiers = fixes => {
  const modifiers = { t: 1, d: 0 };
  for (const mode in fixes) {
    const fix = findFix(mode, fixes[mode]);
    modifiers.t *= fix.effects.t || 1;
    modifiers.d += fix.effects.d || 0;
  }
  return modifiers;
};

// THE LOWER STAGE as it flies under the rocket in focus. spec: the rocket's (top stage's) design with its packages; until stages are
// researched on their own, the rocket's thrust and propellant research reach the stage at half strength, as they did a booster.
// Returns the stage for rules/flight.js: { isBooster, stage, dry, fuel, thrust, isp, vacuumIsp, r, modeMultipliers }.
const halfStrength = x => 1 + (x - 1) * .5;
export function lowerStage(kind, airframe, spec, propellant, load = 1, estimated = false) {
  const stage = PROGRAMMES[kind].stages[0], figures = stageDesign(stage, estimated), fixes = stageFixes(airframe, stage), modifiers = stageModifiers(fixes);
  const thrustGain = halfStrength(spec.t) * modifiers.t, isp = figures.isp * (1 + .25 * (spec.t - 1));
  return {
    isBooster: 1, stage,
    dry: figures.dry + modifiers.d,
    fuel: figures.f * halfStrength(spec.f / baseDesign(estimated).f) * load,
    thrust: figures.thr * thrustGain,
    isp, vacuumIsp: isp * propellant.vacuumIsp / propellant.isp,
    r: figures.r,
    modeMultipliers: Object.fromEntries(Object.keys(FAILURE_MODES).map(mode => [mode, (fixes[mode] ? findFix(mode, fixes[mode]).riskMultiplier : 1) * traitWeight(stage, mode, airframe)])),
  };
}
