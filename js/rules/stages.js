// STAGE DESIGNS (Apollo step 3): a rocket listed with stages (data/programmes.js) flies lower stages that are designs of their own.
// Each lower stage keeps a bundle in S.progs under its own key, like a rocket's: true figures and the team's windows on them, flaws,
// research, knowledge, incidents and fixes. Everything that works on the programme in focus works on a stage with it in focus
// (withProgramme(stage, ...)). Its packages get a blueprint revision of their own (bundle.bp, airframe.stg), published with the
// rocket's; its fixes ride in the rocket's blueprint and airframes under mode@stage keys (rules/programs.js fixKeyFor), so one
// publication and one upgrade carry every stage. The rocket's own design is its top stage. No DOM.
import { FAILURE_MODES, findFix } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { withProgramme } from '../core/state.js';
import { designSpec } from './design.js';
import { stagePackages } from './production.js';
import { traitWeight } from './programs.js';

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

// THE LOWER STAGE as it flies under the rocket in focus: the stage's own design with the packages and fixes this airframe's stage
// carries (estimated: the figures the team believes). The rocket's own research belongs to its top stage.
// Returns the stage for rules/flight.js: { isBooster, stage, dry, fuel, thrust, isp, vacuumIsp, r, modeMultipliers }.
export function lowerStage(kind, airframe, propellant, load = 1, estimated = false) {
  const stage = PROGRAMMES[kind].stages[0], fixes = stageFixes(airframe, stage), modifiers = stageModifiers(fixes);
  const spec = withProgramme(stage, () => designSpec(stagePackages(airframe, stage), estimated));
  const isp = PROGRAMMES[stage].design.isp * (1 + .25 * (spec.t - 1));
  return {
    isBooster: 1, stage,
    dry: spec.dry + spec.d + modifiers.d,
    fuel: spec.f * load,
    thrust: spec.thr * spec.t * modifiers.t,
    isp, vacuumIsp: isp * propellant.vacuumIsp / propellant.isp,
    r: spec.r,
    modeMultipliers: Object.fromEntries(Object.keys(FAILURE_MODES).map(mode => [mode, (fixes[mode] ? findFix(mode, fixes[mode]).riskMultiplier : 1) * traitWeight(stage, mode, airframe)])),
  };
}
