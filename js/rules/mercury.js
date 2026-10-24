// PROJECT MERCURY (Phase Two, Sections 1 and 2): the Phase Two state, what each mission needs, boosters, crews, capsules and directives. No DOM.
// The flight itself is in rules/mission.js; selection, the chimpanzees and the office calendar in rules/astronaut-office.js.
//
// Phase Two state, S.p2 (the field names are the save format):
//   v        version (3)                         sec      section (1, 2 once the first American has flown)          dir    Mercury directives met
//   pool     finalists during selection          astros   the astronaut group  selDone 1 once the group is chosen
//   sel      selection: { st: 0 screening, 1 choose testing, 2 testing, 3 choose crew, 4 done; at: day of the next step; reg: regime }
//   veh      capsules ready: { id, mt: mission type, cfg: { pk, rev }, built }     nv  next capsule id
//   flights  missions flown                      mem      the memorial: { name, svc, mission, d }
//   memo     the memorial overlay still to show  stand    crewed flights stood down until this day
//   secDone  day Section 1 was completed         chimp, monk  animals flown (they pick the next name)
//   lj       Little Joe record: { ok: good aborts, mk: a monkey has flown }
//   fl       flags: office decisions taken (life, win, ovr, cock), failures investigated (four, maFail, fx_ + a capsule system), maQual,
//            sec2 (Section 2 is open)
//   mercDone day every Section 2 directive built so far was met
//   oq       office decisions to come: [{ k, at }]   od   the office decision waiting for an answer
//   gmul     appropriation multiplier            ch       chimpanzee colony: { on, t: training 0 to 1 }
//   ma       orbital qualification flights: { ok, n }   elec  0, 1 after the election, 2 after the inauguration
//   lastTx   the last flight's transcript: { n: mission name, call: call sign, tx: lines }
//   The launch planner also keeps its choices here: lv capsule, lb booster, lf propellant, lc crew, lo orbits; secShown once the summary has shown.
import { formatMoney } from '../core/util.js';
import { BY_ID } from '../data/research.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES, ORBIT_CHOICES, BASE_ENDURANCE_ORBITS, sectionDirectives } from '../data/mercury.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, addHistory, isResearched, isConfirmed, formatDate, earn } from '../core/state.js';
import { designSpec, hasBoosterStage } from './design.js';
import { hasFirstMilestone } from './research.js';
import { previewFlight } from './flight.js';
import { anyCertified, isManRated, manRatingRecord } from './manrate.js';
import { assignedPilot } from './astronauts.js';
import { checkFirsts, openSovietSectionTwo } from './race.js';

export const newPhaseTwo = () => ({
  v: 3, sec: 1, dir: 0, pool: [], astros: [], selDone: 0, sel: { st: 0, at: Math.round(S.day + 50), reg: null }, veh: [], flights: 0, mem: [], stand: 0, secDone: 0, memo: null, nv: 1, chimp: 0, monk: 0,
  lj: { ok: 0, mk: 0 }, fl: {}, oq: [], od: null, gmul: 1, ch: { on: 0, t: 0 }, ma: { ok: 0, n: 0 }, elec: 0,
});
export const phaseTwo = () => S.p2;
export const directiveKey = () => {
  const directive = MERCURY_DIRECTIVES[phaseTwo().dir];
  return directive ? directive.key : null;
};
// Has the directive with this key been met?
export const directiveDone = key => phaseTwo().dir > MERCURY_DIRECTIVES.findIndex(directive => directive.key == key);
// The mission an astronaut is assigned to train for: the suborbital flight in Section 1, the orbital flight after it.
export const pilotMissionType = () => phaseTwo().secDone ? 'mo' : 'mr';
// Is any orbital-class booster (one that can launch a satellite) certified for crews?
export const orbitalBoosterCertified = () => Object.keys(S.progs).some(kind => PROGRAMMES[kind] && PROGRAMMES[kind].canOrbit && manRatingRecord(kind).cert.length > 0);

// What a mission type still needs before its capsule can be ordered, or null.
export const requirementText = missionType => {
  const name = id => BY_ID[id].name, state = phaseTwo();
  if (missionType == 'bj' && !isResearched('cap_shape')) return `Needs ${name('cap_shape')}.`;
  if (missionType == 'lj' && !isResearched('esc_tower')) return `Needs ${name('esc_tower')}.`;
  if (missionType == 'mr') for (const id of ['cap_ecs', 'cap_chute', 'esc_tower']) if (!isResearched(id)) return `Needs ${name(id)}.`;
  if (missionType == 'ma') {
    if (state.dir < 1) return 'Opens once Big Joe has flown.';
    if (!isResearched('cap_ecs')) return `Needs ${name('cap_ecs')}.`;
  }
  if (missionType == 'mo') {
    if (!state.secDone) return 'Opens in Section 2, once an American has flown in space.';
    if (!isResearched('ms_ablh') && !isResearched('mo_shield')) return `Needs a heat shield for orbital re-entry: ${name('ms_ablh')} or ${name('mo_shield')}.`;
  }
  return null;
};

// BOOSTERS: what an airframe delivers with a capsule aboard, single stage first, staged if that is not enough.
// A plan must also keep the booster inside its heating and aerodynamic limits. A booster too hot at full load is off-loaded
// (propellant tanks part filled, down to MIN_MERCURY_LOAD) until it is inside them, as long as it still delivers what the mission needs.
// Returns { staged, load, preview, ok, overLimit }: the first plan that meets the mission's needs, or else the fastest at full load.
// Cached per airframe, revision, propellant, mission and (roughly) what the team knows.
export const MIN_MERCURY_LOAD = .5;
// The off-loading step for an orbital flight, which has little speed to spare.
const ORBITAL_LOAD_STEP = .05;
// Lofted climbs an orbital booster may fly when the usual ascent overheats with a capsule aboard (see rules/flight.js plans).
const ORBITAL_ASCENTS = [80, 85].map(elevation => ({ elevation, program: 'lofted', aim: null }));
const planCache = new Map();
export function boosterPlan(airframe, propellant, missionType) {
  const type = MISSION_TYPES[missionType], bundle = S.progs[airframe.prog] || { kn: {} };
  const key = [airframe.id, airframe.rev, propellant, missionType, Math.round(Object.values(bundle.kn).reduce((sum, value) => sum + value, 0) / 5)].join('|');
  if (planCache.has(key)) return planCache.get(key);
  let best = null, fallback = null;
  const loadStep = type.orbital ? ORBITAL_LOAD_STEP : .1;
  // The usual ascent first; an orbital flight that overheats on it tries a lofted climb that leaves the thick air sooner.
  for (const ascent of type.orbital ? [null, ...ORBITAL_ASCENTS] : [null]) {
    for (const staged of hasBoosterStage(airframe) ? [0, 1] : [0]) {
      for (let load = 1; load >= MIN_MERCURY_LOAD && !best; load = Math.round((load - loadStep) * 100) / 100) {
        const preview = previewFlight(airframe, propellant, 'Mercury Capsule', staged, load, 0, ascent);
        const overLimit = preview.maxHeat >= 1 || preview.maxQ >= 1;
        const enough = preview.thrustToWeight > 1.05 && (!type.needs.alt || preview.peakAltitude >= type.needs.alt) && (!type.needs.v || preview.peakSpeed >= type.needs.v);
        const plan = { staged, load, ascent, preview, ok: enough && !overLimit, overLimit };
        if (plan.ok) best = plan;
        else if (load == 1 && !ascent && (!fallback || preview.peakSpeed > fallback.preview.peakSpeed)) fallback = plan;
        // Off-loading only helps a booster that is over its limits and still has speed to spare.
        if (!overLimit || !enough) break;
      }
      if (best) break;
    }
    if (best) break;
  }
  best = best || fallback;
  if (planCache.size > 400) planCache.clear();
  planCache.set(key, best);
  return best;
}
export const needText = missionType => {
  const needs = MISSION_TYPES[missionType].needs;
  return needs.alt ? `${Math.round(needs.alt / 1000)} km` : `${needs.v.toLocaleString()} m/s`;
};
export const readyBoosters = () => S.air.filter(airframe => airframe.st == 'r');

// WHO MAY FLY, or why not. crew: 'none', 'monkey', 'chimp' or an astronaut id. Crews wait for the animal flight, a man-rated booster,
// both first milestones, the tracking network and a trained pilot assigned to the mission type ('mr' suborbital, 'mo' orbital).
export function crewLock(crew, airframe, missionType = 'mr') {
  const state = phaseTwo();
  if (crew == 'none') return null;
  if (crew == 'monkey') return isResearched('cap_ecs') ? null : `A monkey passenger needs ${BY_ID.cap_ecs.name}.`;
  if (crew == 'chimp') {
    if (!hasFirstMilestone('c')) return 'An animal flight needs a heat-shield milestone (Mercury Spacecraft).';
    if (state.ch.t < 1) return state.ch.on ? `The chimpanzees are ${Math.round(state.ch.t * 100)}% through training at Holloman.` : 'Start chimpanzee training in the Astronaut Office.';
    return null;
  }
  if (state.stand > S.day) return `Crewed flights are stood down after the loss of a crew until ${formatDate(state.stand)}.`;
  if (state.dir < 4) return 'NASA will not fly a crew until an animal has flown and been recovered alive.';
  if (missionType == 'mo' && !directiveDone('oanimal')) return 'NASA will not fly a crew into orbit until a chimpanzee has orbited and been recovered alive.';
  if (!anyCertified()) return 'No booster is man-rated yet (see the man-rating board).';
  if (airframe && !isManRated(airframe)) return `${airframe.label} (Rev ${airframe.rev}) is outside the certified booster revisions.`;
  if (!S.fac.trknet) return S.fb && S.fb.trknet ? `The tracking network is still being built (in service around ${formatDate(S.fb.trknet)}).` : 'Needs the Mercury Worldwide Tracking Network (Base desk).';
  if (!hasFirstMilestone('e')) return 'Needs a hatch milestone (Escape & Man-Rating).';
  const pilot = assignedPilot(missionType);
  if (!pilot) return 'Assign a qualified astronaut in the Astronaut Office.';
  if (pilot.mt < 1) return `${pilot.name} is ${Math.round(pilot.mt * 100)}% through mission training.`;
  return null;
}

// CAPSULES are built in the factory to the published spacecraft blueprint, so their systems are fixed when ordered.
export function orderCapsule(missionType) {
  const type = MISSION_TYPES[missionType];
  if (requirementText(missionType) || S.b < type.cost) return;
  S.b -= type.cost;
  S.aq.push({ k: 'msn', mt: missionType, cfg: { pk: Object.keys(S.g.pk), rev: S.g.bp.rev }, cost: type.cost, t: type.buildTime, tot: type.buildTime });
  log(`[FACTORY] Ordered a ${type.capsuleName} (${formatMoney(type.cost)}).`, 'wn');
}
// A capsule leaves the factory. A refurbishment brings its booster back to the hangar too.
export function deliverCapsule(item) {
  const state = phaseTwo();
  const capsule = { id: state.nv++, mt: item.mt, cfg: item.cfg, built: Math.round(S.day) };
  state.veh.push(capsule);
  if (item.af) {
    item.af.st = 'r';
    S.air.push(item.af);
  }
  log(`[FACTORY] ${MISSION_TYPES[item.mt].capsuleName} #${capsule.id} (Rev ${item.cfg.rev})${item.refurb ? ` and ${item.af ? item.af.label : 'its booster'} are refurbished and` : ' is'} ready at the Cape.`, 'ok');
}

// CAPSULE SYSTEMS: each system's reliability is 80% plus what the blueprint's packages add, less 1.2 points for each spacecraft package
// not yet proven in flight, between 50% and 99.5%. Systems: hs heat shield, pc parachutes, et escape tower, as abort sensing,
// tj tower jettison, ac attitude control, ec environmental control, lb landing bag, rr retrorockets.
export function capsuleSystems(config) {
  const spec = designSpec(config.pk), unproven = config.pk.filter(id => BY_ID[id] && BY_ID[id].phase == 2 && !isConfirmed(id)).length;
  const reliability = system => Math.max(.5, Math.min(.995, .8 + (spec[system] || 0) - .012 * unproven));
  return {
    reliability, spec, unproven,
    manual: spec.man > 0 || !!(S.p2 && S.p2.fl.ovr), // manual control: fly-by-wire research, or the astronauts' overrides
    command: spec.cmd > 0, // a command receiver aboard: the ground can send commands (rules/mission.js groundCommandLock)
    explosiveHatch: isResearched('ms_hxp') && config.pk.includes('ms_hxp'),
    orbital: spec.orb > 0,
    endurance: enduranceOrbits(config), // the most orbits the consumables allow
  };
}
// ENDURANCE: three orbits as built, six with the extra consumables, 22 with the long-duration modifications on top (Sigma 7 and
// Faith 7). Set by the packages aboard, not their rolled figures, so a capsule always reaches the next step.
const ENDURANCE_STEPS = [[['mo_cons', 'mo_long'], 22], [['mo_cons'], 6]];
const enduranceOrbits = config => (ENDURANCE_STEPS.find(([ids]) => ids.every(id => config.pk.includes(id))) || [null, BASE_ENDURANCE_ORBITS])[1];
// The orbit counts a capsule can fly.
export const orbitChoices = config => ORBIT_CHOICES.filter(orbits => orbits <= capsuleSystems(config).endurance);

// A Mercury directive is met: the reward, the record, and the Section 1 finale on the last one.
export function fulfilDirective(directive, astronaut) {
  const state = phaseTwo();
  earn(directive.reward);
  S.rep = Math.min(100, S.rep + (directive.key == 'crew' || directive.key == 'ocrew' ? 20 : 8));
  addHistory(`Mercury directive met: ${directive.name}`);
  log(`[DIRECTIVE FULFILLED] ${directive.name}. Reward +${formatMoney(directive.reward)}.`, 'hd');
  state.dir++;
  if (state.dir == sectionDirectives(1)[1]) {
    checkFirsts({ human: 1 });
    state.secDone = Math.round(S.day);
    addHistory('Section 1 complete');
    log(`[NEWS] ${astronaut ? astronaut.name : 'An astronaut'} is the first American in space. Ticker-tape parades are planned.`, 'hd');
    log('[WASHINGTON] The President asks Congress to commit the nation to landing a man on the Moon and returning him safely to the Earth before this decade is out.', 'hd');
    openSectionTwo();
  } else if (state.dir == MERCURY_DIRECTIVES.length) {
    state.mercDone = Math.round(S.day);
    addHistory('Project Mercury complete');
    log('[NASA] Project Mercury is complete: an American has lived in orbit for more than a day. The two-man Gemini spacecraft is next.', 'hd');
  }
}
// SECTION 2 opens: orbital work is proposed to the engineers and the Soviet dates for it are set. Also run for older saves.
export function openSectionTwo() {
  const state = phaseTwo();
  state.sec = 2;
  state.fl.sec2 = 1;
  openSovietSectionTwo();
  log('[NASA] Section 2: Mercury goes to orbit. The engineers propose orbital work for the capsule (R&D desk), and an orbital flight can be ordered once the capsule has a shield for orbital re-entry.', 'hd');
}
