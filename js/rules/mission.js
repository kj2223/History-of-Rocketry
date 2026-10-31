// A MERCURY MISSION in flight: setting it up, the air-to-ground transcript, the timeline of events, crew and ground decisions,
// and closing it out. No DOM. The booster flies its real physics (rules/flight.js boosterRun); the capsule follows a scaled profile.
//
// A mission is one object, made by beginMission and advanced by stepMission:
//   capsule (from S.p2.veh), type (a MISSION_TYPES entry), missionType (its key), systems (capsuleSystems), booster (the airframe)
//   propellant, staged, crew (an astronaut, an animal { animalName, species }, or null), crewChoice (what the planner picked)
//   second (Gemini: the pilot beside the command pilot, or null), evaPlanned (Gemini: a spacewalk is in the flight plan),
//   targetPlan (Gemini: 'rdv' to rendezvous with the Agena target, 'dock' to dock with it, or null)
//   time (mission seconds), events: [{ time, kind }] still to happen, script: scripted transcript lines still to come
//   transcript: [{ t: seconds, w: speaker, x: text, c: style }] (saved as S.p2.lastTx, so the keys stay short)
//   log: what happened, in words; pending: { key, question, ground } a decision waiting for an answer
//   outcome: what went wrong or right (see newOutcome); latent: a fault the poll missed; overNoGo: launched over a NO-GO
//   altitudeScale, speedScale: the profile scaled to the booster; callSign; boost: the booster run; rescued: the man-rating
//   redundancy rode out a booster fault; retroWillFail; trace: altitudes for the plotting board; done
//   faults: spacecraft systems that failed (keys of SYSTEM_FAULTS), investigated when the mission ends; pad: the launch complex used (rules/site.js)
//   In orbit (Section 2) also: fuel (attitude-control fuel, %), orbitsFlown, drifting (fuel-saving drift flight), retroTries,
//   missKm (how far from the recovery ships the capsule will come down), shieldLoose, retropackKept, fuelAsked, oamsRetried (Gemini)
//   outcome on Gemini also: manoeuvred (an orbit change), eva (a spacewalk done), ejected (the crew rode the ejection seats out),
//   rendezvous (closed in on the target), docked
import { formatMoney, gaussian, clamp } from '../core/util.js';
import { BY_ID } from '../data/research.js';
import { FAILURE_MODES } from '../data/failures.js';
import { MISSION_TYPES, CHIMPANZEE_NAMES, MONKEY_NAMES, CAPSULE_NAMES, DECISIONS, ORBIT_SECONDS, RETROFIRE_AFTER_ORBITS, ORBITAL_ASCENT, ORBITAL_DESCENT,
  ORBITAL_TIMES, FUEL_PER_ORBIT, DRIFTING_FUEL_PER_ORBIT, THRUSTER_FAULT_FUEL, RETRO_FUEL, LOW_FUEL, SPLASH_SPREAD_KM, LONG_WAIT_KM,
  OAMS_BURN_FUEL, EVA_FUEL, RENDEZVOUS_FUEL, TARGET_DAYS } from '../data/mercury.js';
import { S, log, addHistory, save, isResearched, isConfirmed, recordRunEvent, earn } from '../core/state.js';
import { designSpec, quoteLaunch } from './design.js';
import { loseReputation } from './economy.js';
import { boosterRun, boosterFailed, boosterSucceeded } from './flight.js';
import { recordBoosterFlight, isManRated } from './manrate.js';
import { learn, teachingValue } from './knowledge.js';
import { phaseTwo, boosterPlan, capsuleSystems, fulfilDirective, openDirectives, targetLock, recordCapability } from './mercury.js';
import { astronautById, simulatorTier, promoteBackup, assignedPilot } from './astronauts.js';
import { recordMercuryFlight } from './budget.js';
import { usePad, damagePad } from './site.js';
import { checkFirsts } from './race.js';

// Where the profile puts the capsule at a mission time: { alt (km), v (m/s), g }, interpolated between its points.
const profileAt = (profile, time) => {
  let index = 0;
  while (index < profile.length - 2 && profile[index + 1][0] < time) index++;
  const from = profile[index], to = profile[index + 1], share = Math.max(0, Math.min(1, (time - from[0]) / (to[0] - from[0] || 1)));
  return { alt: from[1] + (to[1] - from[1]) * share, v: from[2] + (to[2] - from[2]) * share, g: from[3] + (to[3] - from[3]) * share };
};
const between = (low, high) => low + Math.random() * (high - low);

// AN ORBITAL FLIGHT'S TIMELINE: the orbital mission type with this flight's retrofire, re-entry, parachute and splashdown times
// and its profile (the climb to orbit, the orbits, then the descent counted from retrofire). Each flight gets its own copy.
export function orbitalTimeline(orbits, missionType = 'mo') {
  const retro = orbits * ORBIT_SECONDS + RETROFIRE_AFTER_ORBITS;
  return {
    ...MISSION_TYPES[missionType], orbits, retro, reentry: retro + ORBITAL_TIMES.reentry, chute: retro + ORBITAL_TIMES.chute, end: retro + ORBITAL_TIMES.end,
    profile: [...ORBITAL_ASCENT, ...ORBITAL_DESCENT.map(([time, ...point]) => [retro + time, ...point])],
  };
}
// Move everything still to come in an orbital flight by some seconds: a whole orbit later when the retros fail, earlier when it comes home early.
function shiftTimeline(mission, seconds) {
  const type = mission.type;
  for (const key of ['retro', 'reentry', 'chute', 'end']) type[key] += seconds;
  type.profile = [...ORBITAL_ASCENT, ...ORBITAL_DESCENT.map(([time, ...point]) => [type.retro + time, ...point])];
  for (const event of mission.events) if (event.time > mission.time) event.time += seconds;
  for (const line of mission.script || []) if (line.time > mission.time) line.time += seconds;
  mission.events.sort((first, second) => first.time - second.time);
}
// HOW FAR ONE STEP MOVES THE MISSION CLOCK: five seconds with a pilot aboard, ten without. In orbit, from insertion to the run-up
// to retrofire, the clock runs faster, so a flight of any length takes about ORBIT_STEPS steps there (a minute and a half on screen).
const ORBIT_STEPS = 360;
export function missionStepSeconds(mission) {
  const normal = mission.crew && !mission.crew.species ? 5 : 10, type = mission.type;
  if (!type.orbital || mission.time < type.sep + 60 || mission.time > type.retro - 180) return normal;
  return Math.max(normal, Math.min(Math.round((type.retro - type.sep) / ORBIT_STEPS), Math.floor(type.retro - 180 - mission.time)));
}
// THE QUIET STRETCH IN ORBIT: from insertion to the run-up to retrofire, nothing is scheduled but the orbits themselves. It flies in
// the background: the game keeps your chosen speed and the mission keeps pace, as many steps a tick as the speed (ui/launch-view.js).
export const inQuietOrbit = mission => !!mission.type.orbital && mission.time >= mission.type.sep + 60 && mission.time <= mission.type.retro - 180;
// Which orbit the capsule is on (1 to the planned count), or 0 before insertion.
export const currentOrbit = mission => mission.type.orbital && mission.time > mission.type.sep ? Math.min(mission.type.orbits, 1 + Math.floor((mission.time - mission.type.sep) / ORBIT_SECONDS)) : 0;
const animalName = animal => `the ${animal.species} ${animal.animalName}`;
const isAnimal = crew => !!(crew && crew.species);
// The astronaut aboard, if a person is.
const pilotAboard = mission => mission.crew && !isAnimal(mission.crew) ? mission.crew : null;
const newOutcome = () => ({
  boosterFailed: 0, aborted: 0, heatDamage: 0, parachuteFailed: 0, sank: 0, lost: 0, injured: 0, offAttitude: 0, recovered: 0, overheated: 0,
  // set as they happen: strayLaunch (escape rocket fired on the pad), padShutdown (engine cut off at liftoff), overspeed (booster ran hot),
  // towerStuck (the tower would not jettison), conserved (the crew cut the experiments to save cooling)
});

// AIR-TO-GROUND. Speakers: CC (CAPCOM, or the Cape before there is one), P (the pilot, by call sign), SURG, FLT, TLM, TC; '' is an editor's note.
export function speakerName(mission, speaker) {
  return speaker == 'CC' ? (S.crew.capcom ? 'CAPCOM' : 'CAPE') : speaker == 'P' ? (mission.callSign || 'PILOT').toUpperCase() : speaker;
}
// A nervous pilot (composure under 45) sometimes hesitates.
function transmit(mission, speaker, text, style = '') {
  if (!mission.transcript) mission.transcript = [];
  const pilot = pilotAboard(mission);
  if (speaker == 'P' && pilot && pilot.t.com < 45 && Math.random() < .3) text = text.replace(/^(\w)/, first => 'Uh... ' + first.toLowerCase());
  mission.transcript.push({ t: Math.round(mission.transcriptTime ?? mission.time), w: speaker, x: text, c: style });
}
// SCRIPTED CALLS, keyed to mission time: each fires once if its condition holds. Events and decisions add their own lines as they happen.
function scriptFor(mission) {
  const pilot = pilotAboard(mission), onPlan = () => !mission.outcome.boosterFailed && !mission.outcome.aborted && !mission.done, lines = [];
  const add = (time, speaker, text, condition = onPlan) => lines.push({ time, speaker, text, condition });
  if (mission.type.orbital) orbitalScript(mission, add);
  else if (mission.missionType == 'mr' && pilot) {
    const heartRate = () => Math.round(88 + (60 - pilot.t.com) * .9 + Math.random() * 12);
    add(0, 'CC', 'Liftoff. The clock is running.');
    add(2, 'P', 'Roger, clock is running. She\'s off the pad.');
    add(15, 'P', 'All systems go. Fuel go, oxygen go, cabin pressure holding at five point five.');
    add(40, 'P', 'Getting some vibration... a little rough here.');
    add(46, 'CC', 'Copy. That\'s max q. Should smooth out.');
    add(75, 'P', 'Smoothing out now. Pressures steady.');
    add(105, 'CC', () => `You are go, ${mission.callSign}. Right down the line.`);
    add(156, 'P', 'Capsule separation, green light. Turnaround has started.');
    add(178, 'P', () => phaseTwo().fl.win ? 'Out the window I can see the whole coastline. Clouds out over the Atlantic. What a view.' : 'On the periscope. Mostly cloud cover, some coastline to the west.');
    add(205, 'P', () => mission.systems.manual ? 'Going to manual. Pitch is OK... yaw is OK... roll is OK.' : 'Automatic control is holding attitude nicely.');
    add(212, 'CC', 'Roger. Looks good from here.');
    if (S.crew.surg) add(235, 'SURG', () => `Pulse ${heartRate()}, respiration steady. He sounds fine.`);
    add(258, 'CC', 'Stand by for retro sequence.');
    add(266, 'P', 'Retro attitude set. Retro sequence is green.');
    add(335, 'P', 'Retro jettison. I heard it go.', () => onPlan() && !mission.retroWillFail);
    add(425, 'CC', () => `${mission.callSign}, your re-entry attitude looks good.`);
    add(468, 'P', 'Periscope is in. Here come the g\'s.');
    add(605, 'P', 'Landing bag is out. Green light.');
    add(660, 'CC', 'Recovery forces have you on radar. Helicopter is on the way.', () => !mission.done);
    if (S.crew.surg) add(700, 'SURG', () => `Pulse back down to ${heartRate() - 25}.`, () => !mission.done);
  } else {
    const littleJoe = mission.missionType == 'lj', animal = isAnimal(mission.crew) ? mission.crew : null, type = mission.type;
    add(0, 'FLT', 'Liftoff. Clock has started.');
    add(littleJoe ? 20 : 40, 'TLM', 'Max q. Vehicle stable.');
    if (!littleJoe) {
      add(type.sep + 8, 'TLM', 'Capsule separation. Turnaround under way.');
      add(type.sep + 60, 'TLM', 'Capsule attitude holding on the automatics.');
      if (animal && animal.species == 'chimpanzee') add(type.sep + 90, 'SURG', () => `${animal.animalName} is working the levers. Right on cue, heart rate steady.`);
      if (mission.missionType != 'mr') add(type.sep + 150, 'FLT', 'Coasting. Range has the capsule on radar.');
      add(type.reentry - 20, 'TLM', 'Entering the atmosphere.');
    }
  }
  return lines.sort((first, second) => first.time - second.time);
}

// AN ORBITAL FLIGHT'S CALLS: the climb, insertion, the tracking stations on the first orbits and the run-up to retrofire.
// Later orbits report from the orbit events, one line each, so a long flight does not flood the loop.
function orbitalScript(mission, call) {
  const pilot = pilotAboard(mission), type = mission.type, animal = isAnimal(mission.crew) ? mission.crew : null;
  if (pilot) {
    call(0, 'CC', 'Liftoff. The clock is running.');
    call(3, 'P', 'Roger. The clock is operating. We\'re under way.');
    call(45, 'P', 'Little bumpy along about here.');
    call(130, 'CC', 'Booster engines off. Sustainer is pushing you on.');
    call(type.sep + 25, 'P', 'Zero g and I feel fine. Capsule is turning around.');
    call(type.sep + 40, 'CC', () => `${mission.callSign}, you have a go, at least ${type.orbits} orbit${type.orbits > 1 ? 's' : ''}.`);
    if (S.fac.trknet) {
      const stationCalls = [[900, 1, 'Canary CAPCOM. We have you on radar. Your systems look good.'], [1900, 3, 'Zanzibar here. Reading you loud and clear.'], [2700, 4, () => `Muchea CAPCOM. ${mission.callSign}, how are you doing?`], [3900, 5, 'Hawaii has you. Give us a fuel reading.'], [4800, 7, 'Texas CAPCOM. Everything looks fine from here.']];
      for (let orbit = 0; orbit < Math.min(2, type.orbits); orbit++) for (const [offset, station, text] of stationCalls) call(type.sep + orbit * ORBIT_SECONDS + offset, 'CC', text);
      call(type.sep + 2800, 'P', 'This is quite a view. I can see the lights of a city down there.');
    }
    if (S.crew.surg) call(type.sep + 1400, 'SURG', () => `Pulse ${Math.round(80 + (60 - pilot.t.com) * .6 + Math.random() * 10)}, blood pressure normal. He is doing fine.`);
    call(type.retro - 120, 'CC', () => `${mission.callSign}, two minutes to retrofire. Retro attitude, please.`);
    call(type.retro - 60, 'P', 'Retro attitude set. Retro warning light is on.');
    call(type.retro + 600, 'P', 'Here comes the heat. A real fireball outside.');
  } else {
    call(0, 'FLT', 'Liftoff. Clock has started.');
    call(40, 'TLM', 'Max q. Vehicle stable.');
    call(type.sep + 8, 'TLM', 'Sustainer cutoff. Capsule separation. Orbit insertion under way.');
    call(type.sep + 120, 'FLT', S.fac.trknet ? 'Bermuda confirms the orbit. Handing over down the network.' : 'Range has lost the capsule over the Atlantic. Waiting for it to come round.');
    if (animal && animal.species == 'chimpanzee') call(type.sep + 900, 'SURG', () => `${animal.animalName} is working the levers on cue. Heart rate steady.`);
    call(type.retro + 580, 'TLM', 'Entering the atmosphere.');
  }
}

// BEGIN A MISSION: pay for the launch, take the capsule and booster, and roll every capsule failure up front with a time.
// crew: 'none', 'chimp', 'monkey' or an astronaut id (on Gemini, the command pilot; the pilot is whoever is assigned the other seat).
// options: { af: booster id, fuel, latent, over, wind, orbits (orbital flights), eva (Gemini: plan a spacewalk),
//   target (Gemini: 'rdv' or 'dock' with the Agena target in orbit, given the rendezvous radar aboard) }.
// Returns null if it cannot fly.
export function beginMission(capsuleId, crewChoice, options = {}) {
  const state = phaseTwo(), capsule = state.veh.find(candidate => candidate.id == capsuleId), booster = S.air.find(airframe => airframe.id == options.af && airframe.st == 'r');
  if (!capsule || !booster) return null;
  const systems = capsuleSystems(capsule.cfg, capsule.mt), propellant = options.fuel || 'Alcohol & LOX';
  if (MISSION_TYPES[capsule.mt].orbital && !(options.orbits >= 1 && options.orbits <= systems.endurance)) return null;
  const type = MISSION_TYPES[capsule.mt].orbital ? orbitalTimeline(options.orbits, capsule.mt) : MISSION_TYPES[capsule.mt];
  const plan = boosterPlan(booster, propellant, capsule.mt), payload = type.payload || 'Mercury Capsule';
  if (!plan.ok) return null;
  const quote = quoteLaunch(booster, propellant, payload, plan.staged, plan.load);
  if (quote.error) return null;
  S.b -= quote.cost;
  state.veh.splice(state.veh.indexOf(capsule), 1);
  S.air.splice(S.air.indexOf(booster), 1);
  const pad = usePad(booster);
  S.day += 3;
  const crew = crewChoice == 'none' || !crewChoice ? null
    : crewChoice == 'chimp' ? { animalName: CHIMPANZEE_NAMES[state.chimp++ % CHIMPANZEE_NAMES.length], species: 'chimpanzee' }
    : crewChoice == 'monkey' ? { animalName: MONKEY_NAMES[state.monk++ % MONKEY_NAMES.length], species: 'rhesus monkey' }
    : astronautById(crewChoice);
  const second = type.gemini && crew ? assignedPilot('gtp') || null : null;
  const mission = {
    capsule, type, missionType: capsule.mt, systems, booster, propellant, staged: plan.staged, crew, crewChoice, time: 0, events: [], log: [], transcript: [], pending: null,
    outcome: newOutcome(), latent: options.latent || null, overNoGo: !!options.over, done: 0, trace: [], pad, second, evaPlanned: !!(second && options.eva),
    targetPlan: second && options.target && !targetLock(capsule, options.target, crew, second) ? options.target : null,
    altitudeScale: clamp(plan.preview.peakAltitude / 1000 / type.reference.alt, .4, 2.5), speedScale: clamp(plan.preview.peakSpeed / type.reference.v, .4, 2.5),
  };
  // An orbit is an orbit: the profile is not scaled to the booster.
  if (type.orbital) mission.altitudeScale = mission.speedScale = 1;
  if (crew && !isAnimal(crew)) {
    crew.cap = crew.cap || `${CAPSULE_NAMES[(crew.id * 7) % CAPSULE_NAMES.length]} ${state.astros.length}`;
    mission.callSign = crew.cap;
  }
  const schedule = (time, kind) => mission.events.push({ time, kind });
  const orbitText = type.orbital ? `, ${type.orbits} orbit${type.orbits > 1 ? 's' : ''} planned` : '';
  const crewText = crew ? ` with ${isAnimal(crew) ? animalName(crew) : crew.name}${second ? ` and ${second.name}` : ''}` : '';
  log(`--- ${type.fullName.toUpperCase()}: capsule #${capsule.id} on ${booster.label}${crewText}${orbitText} ---`, 'wn');
  transmit(mission, '', `${type.fullName} on ${booster.label}${mission.callSign ? `. Call sign ${mission.callSign}` : ''}${isAnimal(crew) ? `, with ${animalName(crew)} aboard` : ''}${orbitText}.`);
  // Two failures end a flight before it starts: the escape rocket firing on the pad (less likely with abort-sensing research),
  // and a booster shutting down after rising a few inches (the umbilical sequencing package prevents it).
  if (capsule.mt == 'lj' && Math.random() < .12 * (1 - Math.min(1, (systems.spec.as || 0) * 5))) {
    schedule(.1, 'stray');
    return mission;
  }
  if (capsule.mt != 'lj' && !(systems.spec.um > 0) && Math.random() < (state.fl.four ? .06 : .12)) {
    schedule(1, 'padShutdown');
    return mission;
  }
  // The booster: your airframe's own physics and failure model. The man-rating modifications give a failing booster a chance to ride it out.
  const boostEnd = type.boostEnd, rocketSpec = designSpec(Object.keys(S.pk));
  const rescueChance = Math.min(.6, ((rocketSpec.mr || 0) + (capsule.mt == 'ma' || type.orbital ? rocketSpec.mab || 0 : 0)) * 2.5);
  let boost = boosterRun(booster, propellant, plan.staged, { latent: mission.latent, wind: options.wind || 0, load: plan.load, plan: plan.ascent, payload });
  if ((boost.failure || boost.short) && Math.random() < rescueChance) {
    boost = boosterRun(booster, propellant, plan.staged, { wind: options.wind || 0, load: plan.load, plan: plan.ascent, payload });
    mission.rescued = 1;
  }
  mission.boost = boost;
  if (boost.failure || boost.short) schedule(Math.max(3, Math.min(boostEnd - 2, boost.fraction * boostEnd)), 'boosterFailure');
  else schedule(boostEnd - .5, 'cutoff');
  if (type.abortAt) schedule(type.abortAt, 'plannedAbort');
  if (type.sep && type.crewed && !type.gemini && Math.random() < 1 - systems.reliability('tj')) schedule(type.sep + 2, 'tj');
  if (capsule.mt == 'mr') {
    if (!isManRated(booster) && Math.random() < .2) schedule(boostEnd - 10, 'overspeed');
    if (Math.random() < 1 - systems.reliability('ac')) schedule(between(180, 260), 'att');
    if (Math.random() < 1 - systems.reliability('ec')) schedule(between(170, 400), 'ecs');
    schedule(300, 'retro');
    if (Math.random() < 1 - systems.reliability('rr')) mission.retroWillFail = 1;
  }
  if (type.orbital) scheduleOrbit(mission, schedule);
  if (type.reentry) schedule(type.reentry + 10, 'reentry');
  if (type.chute > 40) schedule(type.chute - 30, 'drogue');
  schedule(type.chute, 'chute');
  schedule(type.end - 2, 'splash');
  mission.events.sort((first, second) => first.time - second.time);
  mission.script = scriptFor(mission);
  return mission;
}

// IN ORBIT: insertion, one event as each orbit is completed (it spends attitude fuel), faults placed across the flight,
// the heat-shield signal, and retrofire. Long flights are harder on the environmental control system.
const SHIELD_SIGNAL_CHANCE = .2; // a faulty landing-bag switch, until the rewiring package is aboard
function scheduleOrbit(mission, schedule) {
  const type = mission.type, systems = mission.systems;
  mission.fuel = 100;
  mission.orbitsFlown = 0;
  schedule(type.sep + 20, 'insertion');
  for (let orbit = 1; orbit <= type.orbits; orbit++) schedule(type.sep + orbit * ORBIT_SECONDS, 'orbit');
  if (Math.random() < 1 - systems.reliability('ac')) schedule(between(type.sep + 600, type.retro - 900), 'att');
  if (Math.random() < (1 - systems.reliability('ec')) * (type.orbits > 3 ? 1.6 : 1)) schedule(between(type.sep + 300, type.retro - 600), 'ecs');
  if (!(systems.spec.sg > 0) && Math.random() < SHIELD_SIGNAL_CHANCE) {
    schedule(between(type.sep + 400, type.retro - 400), 'shieldSignal');
    mission.shieldLoose = Math.random() < (1 - systems.reliability('lb')) * 2 ? 1 : 0; // the signal is usually false
  }
  if (type.gemini) scheduleGemini(mission, schedule);
  schedule(type.retro, 'retro');
  if (Math.random() < 1 - systems.reliability('rr')) mission.retroWillFail = 1;
}
// GEMINI IN ORBIT, with a crew: the orbit change on the first orbit (with the manoeuvring system aboard), the spacewalk on the third
// (if planned and the suit is aboard), the rendezvous with the Agena target before the third orbit is out (if planned), and on
// flights beyond four days the fuel cells may falter.
const GEMINI_LONG_FLIGHT = 62;
function scheduleGemini(mission, schedule) {
  const type = mission.type, config = mission.capsule.cfg;
  if (!mission.crew) return;
  if (config.pk.includes('gm_oams')) schedule(type.sep + ORBIT_SECONDS * .6, 'oams');
  if (mission.evaPlanned && type.orbits >= 3) schedule(type.sep + ORBIT_SECONDS * 2.2, 'eva');
  if (mission.targetPlan) schedule(type.sep + Math.min(type.orbits - .6, 2.4) * ORBIT_SECONDS, 'rdv');
  if (type.orbits > GEMINI_LONG_FLIGHT && Math.random() < 1 - mission.systems.reliability('ec')) schedule(between(type.sep + ORBIT_SECONDS * 2, type.sep + ORBIT_SECONDS * 12), 'cells');
}
// The fuel one orbit costs: full attitude hold for the first three, drifting after that, less with the fuel-economy work.
// Gemini carries its own figures (MISSION_TYPES fuel).
function orbitFuel(mission, orbit) {
  const own = mission.type.fuel, perOrbit = orbit <= 3 ? (own ? own.hold : FUEL_PER_ORBIT) : (own ? own.drift : DRIFTING_FUEL_PER_ORBIT);
  return perOrbit * (1 - (mission.systems.spec.af || 0)) * (mission.drifting ? .4 : 1);
}
// RETROFIRE in orbit decides where the capsule comes down. On the timer and on attitude it lands near the ships; fired by hand or
// on the backup timer it runs long, and with too little fuel to hold attitude it can come down hundreds of km away, off attitude.
function retrofire(mission, how) {
  const outcome = mission.outcome, accuracy = 1 - .6 * (mission.systems.spec.rt || 0);
  let miss = Math.abs(gaussian()) * SPLASH_SPREAD_KM * accuracy;
  if (how != 'timer') miss += (how == 'backup' ? 30 : 50) + Math.random() * 60 * accuracy;
  if (mission.fuel < RETRO_FUEL) {
    miss += 150 + Math.random() * 250;
    if (Math.random() < .5) outcome.offAttitude = 1;
    report(mission, 'Not enough attitude fuel to hold the capsule steady while the retros burn.', 'wn');
  }
  if (outcome.offAttitude) miss += 80;
  mission.fuel = Math.max(0, mission.fuel - RETRO_FUEL);
  mission.missKm = Math.round(miss);
  report(mission, `Retrofire. Recovery predicts splashdown ${mission.missKm} km from the ships.`, mission.missKm > LONG_WAIT_KM ? 'wn' : 'ok');
}

// THE CHANNELS Mission Control sees: a reading from the scaled profile with a little noise. { alt (km), v (m/s), g, temp (°C) }
export function reading(mission) {
  const outcome = mission.outcome, point = outcome.padShutdown || outcome.strayLaunch ? { alt: 0, v: 0, g: 1 } : profileAt(mission.type.profile, mission.time);
  const noisy = value => value * (1 + .02 * gaussian());
  return {
    alt: Math.max(0, noisy(point.alt * (mission.altitudeScale || 1))),
    v: Math.max(0, noisy(point.v * (mission.speedScale || 1)) * (outcome.overspeed ? 1.08 : 1)),
    g: Math.max(0, point.g * (outcome.overspeed && mission.time > 480 ? 1.35 : 1) + .1 * gaussian()),
    temp: Math.round(24 + (outcome.overheated ? 14 : 0) + (mission.time > (mission.type.reentry || 9e9) && mission.time < (mission.type.chute || 0) ? 6 : 0) + gaussian()),
  };
}

// DECISIONS. Crew decisions lean on a skill and a base chance; training, rehearsal, CAPCOM and simulator fidelity add to it.
// Ground decisions are yours as Test Conductor, whoever is aboard.
// What the pilot says when a decision lands on them, and how CAPCOM answers.
const PILOT_CALLS = {
  abort: ['Abort light! Abort light is on!', 'Abort, abort, abort!'],
  tj: ['No tower jettison light. The tower is still on.', 'Copy. Use the manual jettison.'],
  att: ['Attitude\'s wandering. The automatics aren\'t holding me.', 'We see it here. Your call.'],
  ecs: [mission => `Suit temperature is climbing. Reading ${reading(mission).temp} degrees.`, 'Copy. Watch it.'],
  retro: ['No retro fire. Repeat, no retros.', 'We confirm, no retro fire.'],
  hatch: ['Hatch is gone! Water\'s coming in!', 'Helicopter is right over you!'],
  oretro: ['No retros. I have no retro fire.', 'We confirm, no retro fire. Stand by.'],
  shield: ['Say again? You want me to keep the retropack on?', 'We have a landing-bag light down here. Do not jettison until we are sure.'],
  fuel: [mission => `Fuel is down to ${Math.round(mission.fuel)} percent on the automatic side.`, 'Copy. We are looking at a fuel plan.'],
  eva: ['He\'s working hard out here. Visor\'s fogging up.', 'Copy. Watch his heart rate.'],
  cells: ['Fuel cell oxygen pressure is falling. We\'re losing power.', 'We see it. Stand by for a power plan.'],
  rdv: ['Radar\'s lost lock. I\'ve got the target visually, I think.', 'Copy. We\'re working a solution.'],
  spin: ['We have serious problems here. We\'re tumbling end over end. We\'re disengaged from the Agena.', 'Roger. We\'re standing by.'],
};
// THE GROUND COMMAND LINK (data uplink): a capsule built with a command receiver takes commands from the ground while a station
// can reach it and the Uplink Engineer is on console to send it. The Cape and Bermuda cover a Little Joe or a suborbital arc; Big Joe and the orbital flights run far downrange,
// out of their reach, so those need the worldwide tracking network. Returns why no command can be sent, or null.
const NEAR_RANGE_MISSIONS = ['lj', 'mr'];
export function groundCommandLock(mission) {
  if (!mission.systems.command) return 'no command receiver aboard';
  if (!S.crew.upl) return 'no Uplink Engineer on console';
  if (!NEAR_RANGE_MISSIONS.includes(mission.missionType) && !S.fac.trknet) return 'no ground station in range';
  return null;
}
// The options as offered: each with its index, and available unless it needs manual control, a CAPCOM that is not there,
// or a ground command that cannot get through. With a crew aboard the ground command (once researched) is one more option;
// with no one aboard the ground chooses between leaving it to the automatics and sending the command.
export function decisionOptions(mission, key) {
  const decision = DECISIONS[key];
  const command = decision.command && { ...decision.command, needs: 'cmd', index: decision.options.length, available: !groundCommandLock(mission) };
  if (mission.pending && mission.pending.uncrewed) return [{ text: 'Leave it to the automatic sequence', automatic: 1, index: -1, available: true }, command];
  const options = decision.options.map((option, index) => ({
    ...option, index, available: !(option.needs == 'man' && !mission.systems.manual) && !(option.needs == 'capcom' && !S.crew.capcom),
  }));
  return command && pilotAboard(mission) && isResearched('cmd') ? [...options, command] : options;
}
// What the automatic sequence does with no one aboard: the option most likely to work that needs no one's hands.
const automaticChoice = (mission, key) => DECISIONS[key].options.map((option, index) => ({ ...option, index })).filter(option => !option.needs)
  .sort((first, second) => decisionOdds(mission, key, second) - decisionOdds(mission, key, first))[0];
// The chance an option works, between 4% and 97% (a soft ground option always works).
export function decisionOdds(mission, key, option) {
  const bounded = chance => Math.max(.04, Math.min(.97, chance));
  if (option.automatic) return decisionOdds(mission, key, automaticChoice(mission, key));
  if (option.needs == 'cmd') return bounded(option.baseChance);
  if (DECISIONS[key].ground) return option.soft ? 1 : bounded(option.baseChance + (option.crew && S.crew.bstr ? .15 : 0));
  const pilot = pilotAboard(mission), state = phaseTwo();
  let chance = option.backup == 'tjb' ? (isResearched('esc_jett') ? .75 : .3) : option.baseChance;
  if (pilot && option.skill) chance += (pilot.t[option.skill] - 50) / 100 * .7;
  if (pilot && pilot.reh[key]) chance += .15;
  if (S.crew.capcom) chance += .05;
  if (S.fac.trknet && pilot) chance += .03;
  chance += simulatorTier() * .03;
  if (pilot && pilot.fat > 60) chance -= .08;
  if (state.fl.win && (key == 'att' || key == 'retro')) chance += .04;
  if (option.heli && S.fac.recov) chance += .25;
  return bounded(chance);
}
// A decision lands. With a person aboard (or on the ground) it waits for an answer and returns true; with no one aboard it
// waits for the Test Conductor if a ground command can reach the capsule, otherwise the automatics take the best option at once.
const raiseDecision = (mission, key) => {
  if (DECISIONS[key].ground || pilotAboard(mission)) {
    mission.pending = { key, question: DECISIONS[key].question, ground: !!DECISIONS[key].ground };
    const call = PILOT_CALLS[key];
    if (call && pilotAboard(mission)) {
      transmit(mission, 'P', typeof call[0] == 'function' ? call[0](mission) : call[0], 'bad');
      transmit(mission, 'CC', call[1]);
    }
    return true;
  }
  if (DECISIONS[key].command && !groundCommandLock(mission)) {
    mission.pending = { key, question: DECISIONS[key].question, ground: true, uncrewed: true };
    return true;
  }
  resolveDecision(mission, key, automaticChoice(mission, key), true);
  return false;
};
const report = (mission, text, style = '') => {
  mission.log.push(text);
  log(`T+${Math.round(mission.time)}s | ${text}`, style);
  transmit(mission, '', text, style);
};
export function chooseOption(mission, index) {
  const pending = mission.pending;
  if (!pending) return;
  const option = decisionOptions(mission, pending.key).find(candidate => candidate.index == index);
  mission.pending = null;
  if (option.automatic) {
    announce(mission, 'Test Conductor', 'TC', option.text);
    return resolveDecision(mission, pending.key, automaticChoice(mission, pending.key), true);
  }
  resolveDecision(mission, pending.key, option, false);
}
// A choice said on the loop: in the mission log, the game log and the transcript.
function announce(mission, who, speaker, text) {
  mission.log.push(`${who}: "${text}."`);
  log(`T+${Math.round(mission.time)}s | ${who}: "${text}."`, 'cyan');
  transmit(mission, speaker, `${text}.`, 'cyan');
}
function resolveDecision(mission, key, option, automatic) {
  const worked = Math.random() < decisionOdds(mission, key, option), pilot = pilotAboard(mission), outcome = mission.outcome, state = phaseTwo();
  const fromGround = DECISIONS[key].ground || option.needs == 'cmd';
  const who = fromGround ? 'Test Conductor' : pilot ? pilot.name.split(' ')[1] : 'The automatic sequence';
  if (!automatic) announce(mission, who, fromGround ? 'TC' : 'P', option.text);
  if (key == 'abort') {
    if (worked) abortFires(mission);
    else {
      outcome.lost = 1;
      report(mission, 'The booster breaks up with the capsule still attached.', 'bad');
    }
  } else if (key == 'tj') {
    if (worked) {
      report(mission, 'Tower clear. Parachute sequence armed.', 'ok');
      if (pilot) transmit(mission, 'P', 'Tower\'s gone. I felt it go.');
    } else {
      outcome.towerStuck = 1;
      report(mission, 'The tower is still attached.', 'bad');
    }
  } else if (key == 'att') {
    if (worked || option.soft) {
      report(mission, 'Attitude recovered.', 'ok');
      if (pilot) transmit(mission, 'P', 'Got it. Holding attitude now.');
    } else {
      outcome.offAttitude = 1;
      report(mission, 'The capsule is still off attitude going into re-entry.', 'wn');
    }
  } else if (key == 'ecs') {
    if (worked) {
      report(mission, 'Temperatures are coming down.', 'ok');
      if (pilot) transmit(mission, 'P', 'Better. Suit\'s cooling off.');
    } else {
      outcome.overheated = 1;
      report(mission, 'Cabin temperatures stay high.', 'wn');
    }
    if (option.soft) outcome.conserved = 1;
  } else if (key == 'retro') {
    if (option.soft) report(mission, 'Retros left unfired. Re-entry continues on the ballistic arc.', 'wn');
    else if (worked) {
      report(mission, fromGround ? 'Retros fired on the ground command.' : 'Retros fired by hand.', 'ok');
      if (pilot) transmit(mission, 'P', fromGround ? 'There they go. All three fired on your command, Cape.' : 'Retros fired on the manual switch. I felt all three.');
    } else report(mission, fromGround ? 'The retrofire command does not get through.' : 'The manual retro switch does nothing.', 'wn');
  } else if (key == 'hatch') {
    if (worked) {
      outcome.sank = 1;
      report(mission, isAnimal(mission.crew) ? 'The capsule sinks; the recovery swimmers get the animal out.' : option.heli ? 'The helicopter hooks the capsule and lifts it clear before it floods.' : 'Out of the capsule and into the water. The capsule sinks, but the recovery helicopter has the crew.', 'wn');
      if (option.heli) outcome.sank = 0;
    } else {
      outcome.sank = 1;
      if (Math.random() < .12) outcome.lost = 1;
      else outcome.injured = 1;
      report(mission, outcome.lost ? 'The crew could not get clear of the flooding capsule.' : 'Pulled from the water exhausted and half-drowned.', 'bad');
    }
  } else if (key == 'oretro') {
    if (!worked) return retroMissed(mission);
    if (pilot) transmit(mission, 'P', fromGround ? 'There they go on your command. I felt all three.' : 'Retros are firing. I can feel them. Good kick.');
    retrofire(mission, fromGround ? 'ground' : option.backup ? 'backup' : 'manual');
  } else if (key == 'shield') {
    resolveShield(mission, option, worked);
  } else if (key == 'fuel') {
    if (option.soft) comeHomeEarly(mission);
    else if (worked) {
      mission.drifting = 1;
      report(mission, 'Powered down and drifting. The fuel should last the flight.', 'ok');
    } else report(mission, 'The fuel keeps falling.', 'wn');
  } else if (key == 'eva') {
    if (option.soft) report(mission, 'The spacewalker is back inside. The spacewalk was cut short with its tasks unfinished.', 'wn');
    else if (worked) spacewalkDone(mission);
    else {
      mission.second.fat = Math.min(100, mission.second.fat + 30);
      report(mission, 'Exhausted and half blind, the spacewalker struggles back in. The tasks are not done.', 'wn');
    }
  } else if (key == 'rdv') {
    if (option.soft) report(mission, 'The rendezvous is called off. The target drifts on ahead.', 'wn');
    else if (worked) rendezvousDone(mission);
    else report(mission, 'The target slides away. The fuel for another try is gone.', 'wn');
  } else if (key == 'spin') {
    if (worked) report(mission, option.text.startsWith('Undock') ? 'Undocked, the crew stop the spin on the re-entry thrusters. Using them means coming home at the next chance.' : 'The spin slows once the Agena is shut down.', 'ok');
    else {
      outcome.injured = 1;
      report(mission, 'The spin is stopped only after the crew have greyed out. They come home at the next chance.', 'bad');
    }
    if (!worked || option.text.startsWith('Undock')) comeHomeEarly(mission);
  } else if (key == 'cells') {
    if (option.soft || !worked) comeHomeEarly(mission);
    else report(mission, 'The fuel cells are holding at low power. The flight goes on.', 'ok');
  } else if (key == 'pad') {
    mission.done = 1;
    resolvePadEmergency(mission, option, worked, state);
  }
}
// The rendezvous is made: a docking follows a quarter of an orbit later if one is planned.
function rendezvousDone(mission) {
  mission.outcome.rendezvous = 1;
  recordCapability('rdv', mission.capsule, mission.booster);
  checkFirsts({ rendezvous: 1 });
  report(mission, 'Rendezvous: the Gemini is holding station a few metres from the Agena.', 'ok');
  if (pilotAboard(mission)) transmit(mission, 'P', 'We\'re sitting here at about forty metres. No sweat.');
  if (mission.targetPlan == 'dock') {
    mission.events.push({ time: mission.time + ORBIT_SECONDS / 4, kind: 'dock' });
    mission.events.sort((first, second) => first.time - second.time);
  }
}
const spacewalkDone = mission => {
  mission.outcome.eva = 1;
  recordCapability('eva', mission.capsule, mission.booster);
  report(mission, `${mission.second.name} is back inside after the spacewalk. The hatch is closed and the cabin repressurised.`, 'ok');
};
// The retros did not fire in orbit. The next chance is an orbit later; after a second miss the capsule cannot come home.
function retroMissed(mission) {
  mission.retroTries = (mission.retroTries || 0) + 1;
  if (mission.retroTries >= 2) {
    mission.outcome.lost = 1;
    report(mission, `The retros will not fire. The capsule is stranded in orbit${mission.crew ? ', and its oxygen will not last' : ''}.`, 'bad');
    mission.done = 1;
    return;
  }
  report(mission, 'The retros still have not fired. Mission Control sets up another try one orbit later.', 'wn');
  shiftTimeline(mission, ORBIT_SECONDS);
  mission.fuel = Math.max(0, mission.fuel - orbitFuel(mission, 4));
  mission.events.push({ time: mission.type.retro, kind: 'retro' });
  mission.events.sort((first, second) => first.time - second.time);
}
// The heat-shield signal. Kept on, the retropack holds a loose shield in place (if its straps hold); jettisoned as planned, all is
// well if the signal was false and deadly if the shield really is loose.
function resolveShield(mission, option, worked) {
  if (option.retropack == 'keep' && worked) {
    mission.retropackKept = 1;
    report(mission, 'The retropack stays on through re-entry.', 'ok');
    return;
  }
  report(mission, option.retropack == 'keep' ? 'The retropack straps let go anyway: it falls away after retrofire.' : 'The retropack is jettisoned on schedule.', 'wn');
  if (mission.shieldLoose) mission.shieldGone = 1;
}
// Short of fuel: retrofire at the end of the orbit just flown, and the orbits still planned are not flown.
function comeHomeEarly(mission) {
  const type = mission.type, oldRetro = type.retro;
  const newRetro = Math.max(mission.time + 60, mission.orbitsFlown * ORBIT_SECONDS + RETROFIRE_AFTER_ORBITS);
  mission.events = mission.events.filter(event => event.time <= mission.time || event.time >= oldRetro);
  mission.script = (mission.script || []).filter(line => line.time <= mission.time || line.time >= oldRetro - 180);
  shiftTimeline(mission, newRetro - oldRetro);
  report(mission, `Coming home early: retrofire after orbit ${mission.orbitsFlown} of ${type.orbits}.`, 'wn');
}
// The booster that shut down on the pad: wait overnight (refurbish both), send a crew (risky), or vent the tanks (scrap the booster).
function resolvePadEmergency(mission, option, worked, state) {
  if (option.soft) {
    const fee = 10000;
    S.b = Math.max(0, S.b - fee);
    S.aq.push({ k: 'msn', mt: mission.missionType, cfg: mission.capsule.cfg, cost: fee, t: 110, tot: 110, refurb: 1, af: mission.booster });
    report(mission, `Overnight the batteries run down and the pad crew safes the booster. Capsule and booster go back for refurbishment (${formatMoney(fee)}).`, 'wn');
  } else if (option.crew) {
    if (worked) {
      S.b = Math.max(0, S.b - 3000);
      state.veh.push(mission.capsule);
      mission.booster.st = 'r';
      S.air.push(mission.booster);
      report(mission, 'The pad crew disarms the booster in two tense hours. Capsule and booster can be readied to fly again.', 'ok');
    } else {
      S.rep = Math.max(0, S.rep - 3);
      state.veh.push(mission.capsule);
      report(mission, 'A squib fires as the crew works. Nobody is badly hurt, but the booster is scrapped. The capsule is saved.', 'bad');
    }
  } else {
    state.veh.push(mission.capsule);
    report(mission, 'The tanks are vented and the booster scrapped. The capsule is saved for reuse.', 'wn');
  }
}
// An abort: the escape tower on Mercury, the ejection seats or separation on Gemini.
const abortFires = mission => mission.type.gemini ? geminiAbort(mission) : towerFires(mission);
// Gemini 6A's pad shutdown: with no tower to fire, the crew keep their hands off the ejection handles, the pad crew safe the
// booster, and spacecraft (or Agena) and booster can be readied to fly again.
function geminiPadShutdown(mission, pilot) {
  if (pilot) transmit(mission, 'P', 'Engine shutdown. We\'re staying put. Not pulling the ring.', 'bad');
  report(mission, `${pilot ? 'The crew stay in their seats. ' : ''}The pad crew safe the booster, and ${mission.type.target ? 'the Agena' : 'spacecraft'} and booster go back to be readied again.`, 'wn');
  phaseTwo().veh.push(mission.capsule);
  mission.booster.st = 'r';
  S.air.push(mission.booster);
  mission.done = 1;
  return 'end';
}
// The escape tower fires: if it works, the capsule skips straight to its parachutes.
function towerFires(mission) {
  const outcome = mission.outcome;
  outcome.aborted = 1;
  if (Math.random() < mission.systems.reliability('et')) {
    report(mission, 'ESCAPE TOWER FIRES. The capsule is pulled clear of the booster.', 'wn');
    if (pilotAboard(mission)) transmit(mission, 'P', 'Tower fired! I\'m off the booster. Waiting on the chutes.');
    parachutesNext(mission);
  } else {
    outcome.lost = mission.crew ? (Math.random() < .7 ? 1 : 0) : 1;
    if (!outcome.lost) outcome.injured = 1;
    report(mission, 'The escape tower fails to pull the capsule clear.', 'bad');
    mission.done = 1;
  }
}
// After a good abort the spacecraft skips straight to its parachutes. An orbital flight's parachutes are hours away on its
// timeline: an abort brings them forward.
function parachutesNext(mission) {
  if (mission.type.orbital) Object.assign(mission.type, { chute: mission.time + 40, end: mission.time + 340 });
  mission.time = Math.max(mission.time, mission.type.chute - 1);
  mission.events = mission.events.filter(event => event.kind == 'chute' || event.kind == 'splash');
  mission.events.forEach(event => {
    if (event.kind == 'chute') event.time = mission.type.chute;
    if (event.kind == 'splash') event.time = mission.type.chute + 60;
  });
}
// GEMINI HAS NO ESCAPE TOWER. Low down the crew ride the ejection seats out (they come down on their own parachutes and the spacecraft
// is lost); higher up the spacecraft separates and fires its retrorockets to pull clear, then comes down on its parachute.
const EJECTION_SEAT_LIMIT = 70; // seconds after liftoff
const STUCK_THRUSTER_SHARE = 4; // a stuck thruster while docked: this many times the attitude system's failure rate
function geminiAbort(mission) {
  const outcome = mission.outcome;
  outcome.aborted = 1;
  if (mission.time < EJECTION_SEAT_LIMIT) {
    if (Math.random() < mission.systems.reliability('es')) {
      outcome.ejected = 1;
      if (Math.random() < .25) outcome.injured = 1;
      report(mission, `EJECT. Both seats fire and the crew ride their parachutes down clear of the booster${outcome.injured ? ', one of them hurt on landing' : ''}. The spacecraft is lost.`, 'wn');
    } else {
      outcome.lost = 1;
      report(mission, 'The ejection seats do not get the crew clear of the booster.', 'bad');
    }
    mission.done = 1;
    return;
  }
  if (Math.random() < mission.systems.reliability('rr')) {
    report(mission, 'The spacecraft separates and fires its retrorockets to pull clear of the booster.', 'wn');
    if (pilotAboard(mission)) transmit(mission, 'P', 'We\'re off the booster. Waiting on the chute.');
    parachutesNext(mission);
  } else {
    outcome.lost = 1;
    report(mission, 'The spacecraft cannot pull clear of the breaking booster.', 'bad');
    mission.done = 1;
  }
}
function boosterDown(mission) {
  const boost = mission.boost;
  mission.outcome.boosterFailed = 1;
  damagePad(mission.pad, mission.time);
  boosterFailed(boost.flight);
  recordBoosterFlight(mission.booster, false);
  report(mission, `BOOSTER MALFUNCTION: ${boost.short ? 'the booster cannot hold the climb with the capsule aboard' : FAILURE_MODES[boost.failure] ? FAILURE_MODES[boost.failure].name.toLowerCase() : 'cause unknown'}.`, 'bad');
}

// STEP the mission clock by some seconds: scripted calls first, then each event that falls due.
// Returns 'decide' when someone must choose, 'end' when the flight is over, otherwise 'tick'.
export function stepMission(mission, seconds) {
  if (mission.done) return 'end';
  if (mission.pending) return 'decide';
  mission.time += seconds;
  mission.transcriptTime = null;
  while (mission.script && mission.script.length && mission.script[0].time <= mission.time) {
    const line = mission.script.shift();
    mission.transcriptTime = line.time;
    if (!line.condition || line.condition()) transmit(mission, line.speaker, typeof line.text == 'function' ? line.text() : line.text);
  }
  mission.transcriptTime = null;
  while (mission.events.length && mission.events[0].time <= mission.time) {
    const event = mission.events.shift();
    mission.transcriptTime = Math.min(mission.time, event.time);
    const result = EVENTS[event.kind](mission, pilotAboard(mission), mission.outcome);
    if (result) return result;
  }
  if (mission.time >= mission.type.end) {
    mission.done = 1;
    return 'end';
  }
  return 'tick';
}
// SPACECRAFT FAULTS: each capsule system that failed in flight is noted, and after the flight the engineers investigate it.
// The first failure of each system proposes a corrective package (data/research.js, the fx_ packages), as real Mercury
// failures did: a clogged thruster screen, a parachute that streamed, a landing bag strap that tore.
const SYSTEM_FAULTS = {
  hs: 'Sectioning the recovered shield shows voids where the resin did not bond',
  pc: 'Drop tests show the main canopy opening too violently and tearing',
  rr: 'The retropack igniter circuit has a single point of failure',
  ec: 'The suit coolant loop freezes up at its heat-exchanger valve',
  ac: 'Debris in the thruster fuel lines blocks the small jets',
  lb: 'The landing bag straps tear under the shock of opening',
  tj: 'The tower-jettison circuit has no backup path',
  as: 'The abort-sensing circuit misreads the booster\'s signals',
  sg: 'The heat shield never moved: a faulty landing-bag switch sent the signal',
};
const systemFault = (mission, system) => {
  mission.faults = mission.faults || [];
  if (!mission.faults.includes(system)) mission.faults.push(system);
};
// After the flight: the first time a system fails, its investigation proposes the package that cures it.
function investigateFaults(mission, state) {
  for (const system of mission.faults || []) {
    const flag = 'fx_' + system;
    if (state.fl[flag]) continue;
    state.fl[flag] = 1;
    log(`[INVESTIGATION] ${SYSTEM_FAULTS[system]}. New package proposed: ${BY_ID[flag].name}.`, 'hd');
  }
}
// What each event does. Each returns 'decide' or 'end' to stop the step there, or nothing to carry on.
const EVENTS = {
  stray(mission, pilot, outcome) {
    outcome.strayLaunch = 1;
    systemFault(mission, 'as');
    outcome.lost = mission.crew ? 0 : 1;
    mission.booster.st = 'r';
    S.air.push(mission.booster);
    report(mission, 'Half an hour before launch, the escape rocket fires on its own. It carries the capsule a few hundred metres up and drops it in the scrub. The booster never leaves the pad.', 'bad');
    if (mission.crew) report(mission, `Recovery crews find ${animalName(mission.crew)} shaken but alive.`, 'wn');
    mission.done = 1;
    return 'end';
  },
  padShutdown(mission, pilot, outcome) {
    outcome.padShutdown = 1;
    mission.time = 1;
    report(mission, 'Ignition. The booster rises a few inches, the engine shuts down, and it settles back onto the pad.', 'bad');
    if (mission.type.gemini || mission.type.target) return geminiPadShutdown(mission, pilot);
    if (pilot) transmit(mission, 'P', 'Engine\'s shut down. I\'m still on the pad. Everything is quiet up here.', 'bad');
    report(mission, 'The escape tower jettisons and flies off; the drogue and main parachutes spill out over the side of the booster.', 'bad');
    if (raiseDecision(mission, 'pad')) return 'decide';
    return 'end';
  },
  cutoff(mission, pilot) {
    boosterSucceeded(mission.boost.flight);
    recordBoosterFlight(mission.booster, true);
    report(mission, `Booster cutoff. ${mission.rescued ? 'The man-rating redundancy rode out a fault on the way up. ' : ''}${mission.booster.label} did its job.`, 'ok');
    if (pilot) transmit(mission, 'P', 'Cutoff. Tower jettison... green light.');
  },
  boosterFailure(mission, pilot, outcome) {
    boosterDown(mission);
    if (mission.missionType == 'bj' || mission.missionType == 'ma' || (mission.type.gemini || mission.type.target) && !mission.crew) {
      outcome.lost = 1;
      report(mission, `With no escape tower on this flight, the ${mission.type.target ? 'Agena' : mission.type.gemini ? 'spacecraft' : 'capsule'} is lost with the booster.`, 'bad');
      mission.done = 1;
      return 'end';
    }
    if (Math.random() < mission.systems.reliability('as')) {
      report(mission, 'Abort sensing trips automatically.', 'wn');
      abortFires(mission);
    } else {
      systemFault(mission, 'as');
      if (raiseDecision(mission, 'abort')) return 'decide';
    }
    if (mission.done) return 'end';
  },
  plannedAbort(mission, pilot, outcome) {
    report(mission, 'Maximum aerodynamic load: abort commanded.', 'wn');
    if (Math.random() < mission.systems.reliability('as')) towerFires(mission);
    else {
      report(mission, 'Abort sensing fails to fire the tower.', 'bad');
      systemFault(mission, 'as');
      outcome.lost = 1;
      mission.done = 1;
      return 'end';
    }
    if (mission.done) return 'end';
  },
  overspeed(mission, pilot, outcome) {
    outcome.overspeed = 1;
    report(mission, 'The booster is burning hot: velocity well above plan at cutoff.', 'wn');
    report(mission, 'The capsule will overshoot the landing area. Recovery forces are moving downrange.', 'wn');
    if (pilot) {
      transmit(mission, 'P', 'Harder ride than the simulator. Lot more push than I expected.');
      transmit(mission, 'CC', 'You\'re running long. Recovery is moving downrange.');
    }
  },
  tj(mission) {
    report(mission, 'Tower jettison did not fire.', 'bad');
    systemFault(mission, 'tj');
    if (raiseDecision(mission, 'tj')) return 'decide';
  },
  att(mission) {
    report(mission, 'Attitude control fault.', 'wn');
    systemFault(mission, 'ac');
    if (mission.type.orbital) mission.fuel = Math.max(0, mission.fuel - THRUSTER_FAULT_FUEL * (1 - (mission.systems.spec.af || 0)));
    if (raiseDecision(mission, 'att')) return 'decide';
  },
  ecs(mission) {
    report(mission, 'Environmental control fault: temperatures rising.', 'wn');
    systemFault(mission, 'ec');
    if (raiseDecision(mission, 'ecs')) return 'decide';
  },
  retro(mission, pilot) {
    if (mission.retroWillFail) {
      report(mission, 'Retrofire signal sent; no retro ignition.', 'wn');
      systemFault(mission, 'rr');
      if (raiseDecision(mission, mission.type.orbital ? 'oretro' : 'retro')) return 'decide';
      if (mission.done) return 'end';
    } else {
      report(mission, 'Retrorockets fire on time.', 'ok');
      if (pilot) transmit(mission, 'P', 'Retro one... retro two... retro three. All three fired. Good kick.');
      if (mission.type.orbital) retrofire(mission, 'timer');
    }
  },
  // ORBITAL EVENTS (Section 2).
  // In orbit. An Agena target's flight ends here: it stays up for TARGET_DAYS.
  insertion(mission, pilot, outcome) {
    if (mission.type.target) {
      phaseTwo().tgt = Math.round(S.day + TARGET_DAYS);
      report(mission, `The Agena is in orbit, its lights on and its docking collar ready. It will last about three months.`, 'ok');
      outcome.recovered = 1;
      mission.done = 1;
      return 'end';
    }
    report(mission, `Orbit insertion. ${mission.booster.label} has put the capsule in orbit: go for ${mission.type.orbits} orbit${mission.type.orbits > 1 ? 's' : ''}.`, 'ok');
  },
  // One orbit flown: the fuel it cost, a line on the loop, and the fuel decision if the tanks run low with orbits still to fly.
  orbit(mission, pilot) {
    mission.orbitsFlown++;
    mission.fuel = Math.max(0, mission.fuel - orbitFuel(mission, mission.orbitsFlown));
    const left = mission.type.orbits - mission.orbitsFlown;
    transmit(mission, pilot ? 'CC' : 'TLM', `Orbit ${mission.orbitsFlown} complete over the Cape. ${left ? `${left} to go.` : 'Retrofire is next.'} Attitude fuel ${Math.round(mission.fuel)}%.`);
    if (left > 0 && mission.fuel < LOW_FUEL && !mission.fuelAsked) {
      mission.fuelAsked = 1;
      report(mission, `Attitude-control fuel is down to ${Math.round(mission.fuel)}% with ${left} orbit${left > 1 ? 's' : ''} to go.`, 'wn');
      if (raiseDecision(mission, 'fuel')) return 'decide';
    }
  },
  // GEMINI EVENTS. The orbit change (Gemini 3): the manoeuvring thrusters fire, spending fuel. A misfire is tried once more an
  // orbit later, if the flight lasts that long.
  oams(mission, pilot) {
    mission.fuel = Math.max(0, mission.fuel - OAMS_BURN_FUEL);
    if (Math.random() < mission.systems.reliability('om')) {
      mission.outcome.manoeuvred = 1;
      report(mission, 'OAMS burn complete: the spacecraft has changed its orbit.', 'ok');
      if (pilot) transmit(mission, 'P', 'Burn complete. We felt that one. New orbit coming up on the computer.');
      return;
    }
    const retry = !mission.oamsRetried && mission.time + ORBIT_SECONDS < mission.type.retro - 600;
    report(mission, `The manoeuvring thrusters misfire: the burn is cut short and the orbit barely changes.${retry ? ' The crew will try again next orbit.' : ''}`, 'wn');
    if (retry) {
      mission.oamsRetried = 1;
      mission.events.push({ time: mission.time + ORBIT_SECONDS, kind: 'oams' });
      mission.events.sort((first, second) => first.time - second.time);
    }
  },
  // The spacewalk (Gemini 4): the cabin is depressurised and the pilot goes outside. Overheating and a fogged visor can cut it short.
  eva(mission) {
    report(mission, `Cabin depressurised. The hatch is open: ${mission.second.name} is outside the spacecraft.`, 'hd');
    transmit(mission, 'CC', 'You look great out there. Take your time.');
    checkFirsts({ eva: 1 });
    mission.fuel = Math.max(0, mission.fuel - EVA_FUEL);
    if (Math.random() < mission.systems.reliability('ev')) return void spacewalkDone(mission);
    report(mission, 'The spacewalker is overheating and the visor is fogging.', 'wn');
    if (raiseDecision(mission, 'eva')) return 'decide';
  },
  // The rendezvous (Gemini 6A): the burns to catch the target, then the radar's lock on it may fail.
  rdv(mission) {
    report(mission, 'The Gemini is closing on the Agena: radar lock, and the computer is working the burns.', 'cyan');
    mission.fuel = Math.max(0, mission.fuel - RENDEZVOUS_FUEL);
    if (Math.random() < mission.systems.reliability('rv')) return void rendezvousDone(mission);
    if (raiseDecision(mission, 'rdv')) return 'decide';
  },
  // Docking (Gemini 8): the latches may not catch, and once docked a thruster may stick open and spin the pair.
  dock(mission) {
    if (Math.random() > mission.systems.reliability('rv')) return void report(mission, 'The docking latches do not catch. The crew back off; there is not the fuel for another try.', 'wn');
    mission.outcome.docked = 1;
    recordCapability('dock', mission.capsule, mission.booster);
    checkFirsts({ dock: 1 });
    report(mission, 'Docked: the Gemini\'s nose is latched into the Agena\'s collar, two spacecraft joined in orbit.', 'hd');
    if (pilotAboard(mission)) transmit(mission, 'P', 'Flight, we are docked. It\'s a real smoothie.');
    if (Math.random() < (1 - mission.systems.reliability('ac')) * STUCK_THRUSTER_SHARE) {
      report(mission, 'A thruster has stuck open. The docked pair are rolling.', 'bad');
      if (raiseDecision(mission, 'spin')) return 'decide';
    }
  },
  // Failing fuel cells (Gemini 5): nursed along, or the flight comes home early.
  cells(mission) {
    report(mission, 'Fuel cell oxygen pressure is falling.', 'wn');
    if (raiseDecision(mission, 'cells')) return 'decide';
  },
  // Friendship 7's Segment 51. Usually a faulty switch (investigated after the flight); sometimes the shield really has come loose.
  shieldSignal(mission) {
    report(mission, 'Telemetry: the landing-bag deploy signal is on. The heat shield may be loose.', 'bad');
    systemFault(mission, mission.shieldLoose ? 'lb' : 'sg');
    if (raiseDecision(mission, 'shield')) return 'decide';
  },
  // Re-entry: the heat shield may run hot (worse on the fast flights and off attitude), and the g-load may grey out a pilot
  // with poor endurance and no centrifuge training.
  reentry(mission, pilot, outcome) {
    if (mission.shieldGone) return shieldLost(mission, pilot, outcome);
    if (mission.retropackKept) report(mission, 'Burning pieces of the retropack stream past the capsule.', 'wn');
    const heatChance = (1 - mission.systems.reliability('hs')) * (mission.missionType == 'bj' ? 1.3 : mission.missionType == 'ma' || mission.type.orbital ? 1.4 : 1) * (outcome.offAttitude ? 1.8 : 1) * (mission.retropackKept ? 1.3 : 1);
    const gLoad = outcome.overspeed ? 15 : mission.type.gLoad || 11;
    if (Math.random() < heatChance) {
      outcome.heatDamage = 1;
      report(mission, 'Heat-shield temperatures far above prediction.', 'bad');
      systemFault(mission, 'hs');
      if (pilot) transmit(mission, 'P', 'Getting hot in here. Orange glow all around.', 'bad');
      if (mission.crew && Math.random() < .12) {
        outcome.lost = 1;
        report(mission, 'Signal lost during re-entry.', 'bad');
        transmit(mission, 'CC', `${mission.callSign || 'Capsule'}, Cape. Do you read? ... ${mission.callSign || 'Capsule'}, do you read?`, 'bad');
        mission.done = 1;
        return 'end';
      } else if (mission.crew) outcome.injured = 1;
    } else {
      report(mission, 'Re-entry: heat shield holding. ' + (pilot ? `${pilot.name.split(' ')[1]} reports ${gLoad} g.` : `Peak deceleration ${outcome.overspeed ? 'far above' : 'nominal at'} ${gLoad} g.`), 'ok');
      if (pilot) transmit(mission, 'P', `g's building... ${gLoad} g... OK... still with you.`);
    }
    if (pilot && pilot.t.end < (outcome.overspeed ? 55 : 40) && !S.fac.centrifuge && Math.random() < .4) {
      report(mission, 'The pilot greyed out briefly under the g-load.', 'wn');
      transmit(mission, 'CC', `${mission.callSign}, Cape. Say your status.`);
      transmit(mission, 'P', '...I\'m here. Lost my vision for a second. OK now.');
      if (outcome.overspeed && Math.random() < .3) outcome.injured = 1;
    }
  },
  drogue(mission, pilot) {
    if (pilot) transmit(mission, 'P', 'Drogue is out.');
    else transmit(mission, 'TLM', 'Drogue deployed.');
  },
  // The main parachute (much less likely with the tower still attached), then the reserve.
  chute(mission, pilot, outcome) {
    const mainChance = mission.systems.reliability('pc') * (outcome.towerStuck ? .3 : 1);
    if (Math.random() < mainChance) {
      report(mission, 'Main parachute good.', 'ok');
      if (pilot) transmit(mission, 'P', 'Main chute is out. Beautiful chute!');
      return;
    }
    report(mission, 'MAIN PARACHUTE FAILURE. Reserve deployed.', 'bad');
    systemFault(mission, 'pc');
    if (pilot) transmit(mission, 'P', 'Main is streaming! Going to the reserve!', 'bad');
    if (Math.random() > mainChance * .95) {
      outcome.parachuteFailed = 1;
      outcome.lost = mission.crew ? (Math.random() < .85 ? 1 : 0) : 0;
      if (mission.crew && !outcome.lost) outcome.injured = 1;
      outcome.sank = 1;
      report(mission, 'The reserve parachute fails.', 'bad');
      mission.done = 1;
      return 'end';
    }
    report(mission, 'Reserve parachute good.', 'ok');
    if (pilot) transmit(mission, 'P', 'Reserve is good. Reserve is good.');
  },
  // Splashdown: a hard landing, a long wait for the ships after an overshoot, and an early hatch on capsules with the explosive hatch.
  splash(mission, pilot, outcome) {
    const farOff = mission.missKm > LONG_WAIT_KM; // an orbital flight that came down far from the ships
    report(mission, outcome.overspeed ? 'Splashdown, 200 km beyond the planned area. The ships are hours away.' : mission.missKm != null ? `Splashdown, ${mission.missKm} km from the recovery ships.${farOff ? ' They are hours away.' : ''}` : 'Splashdown.', outcome.overspeed || farOff ? 'wn' : 'ok');
    if (pilot) {
      transmit(mission, 'P', 'Impact. Capsule is upright, no leaks.');
      transmit(mission, 'CC', `Welcome home, ${mission.callSign}.`);
    }
    if (Math.random() > mission.systems.reliability('lb')) {
      report(mission, 'Hard landing: the landing bag did not deploy properly.', 'wn');
      systemFault(mission, 'lb');
      if (mission.crew && Math.random() < .25) outcome.injured = 1;
      if (!mission.crew && Math.random() < (S.fac.recov ? .2 : .4)) outcome.sank = 1;
    }
    if ((outcome.overspeed || farOff) && !outcome.sank && Math.random() < (S.fac.recov ? .1 : .25)) {
      report(mission, 'The capsule is taking on water while it waits for the ships.', 'wn');
      if (!mission.crew || isAnimal(mission.crew)) outcome.sank = Math.random() < .5 ? 1 : 0;
    }
    if (mission.systems.explosiveHatch && mission.crew && Math.random() < .05 + (mission.systems.spec.hb || 0)) {
      report(mission, 'The hatch blows early. Water is pouring in.', 'bad');
      if (raiseDecision(mission, 'hatch')) return 'decide';
    }
    outcome.recovered = outcome.sank && !mission.crew ? 0 : 1;
    mission.done = 1;
    return 'end';
  },
};

// The heat shield falls away in re-entry: almost always fatal for whoever is aboard.
function shieldLost(mission, pilot, outcome) {
  outcome.heatDamage = 1;
  systemFault(mission, 'hs');
  report(mission, 'The heat shield breaks away in re-entry.', 'bad');
  if (pilot) transmit(mission, 'P', 'That\'s a real fireball outside. Something just went past the window!', 'bad');
  outcome.lost = mission.crew ? (Math.random() < .8 ? 1 : 0) : 1;
  if (!outcome.lost) {
    outcome.injured = 1;
    report(mission, 'The capsule holds together on what is left of the shield. Badly burned, but whole.', 'bad');
    return;
  }
  report(mission, 'Signal lost during re-entry.', 'bad');
  if (mission.crew) transmit(mission, 'CC', `${mission.callSign || 'Capsule'}, do you read? ... ${mission.callSign || 'Capsule'}, do you read?`, 'bad');
  mission.done = 1;
  return 'end';
}

// The flight director asks for an abort. Only possible while the escape tower is still on and there is one.
export function manualAbort(mission) {
  if (mission.done || mission.pending) return;
  if (mission.missionType == 'bj' || mission.missionType == 'ma' || mission.time > (mission.type.sep || mission.type.abortAt || 0)) {
    report(mission, 'Abort requested, but there is no escape tower to fire. The flight continues.', 'wn');
    return;
  }
  report(mission, 'MANUAL ABORT commanded.', 'bad');
  mission.outcome.boosterFailed = 1;
  abortFires(mission);
}

// CLOSE OUT a mission: the crew, reputation, spacecraft packages confirmed, the directive, what was learned, and the record.
// Returns { ok, met, lost }.
export function endMission(mission) {
  const state = phaseTwo(), outcome = mission.outcome, pilot = pilotAboard(mission), animal = isAnimal(mission.crew) ? mission.crew : null;
  state.flights++;
  recordMercuryFlight();
  const crewSafe = !outcome.lost, recovered = outcome.recovered || (mission.crew && crewSafe && !outcome.parachuteFailed);
  const ok = !outcome.boosterFailed && !outcome.aborted && !outcome.heatDamage && !outcome.parachuteFailed && !outcome.lost && !outcome.padShutdown && !outcome.strayLaunch && recovered;
  log('=== MISSION COMPLETE ===', ok ? 'ok' : 'wn');
  // A flight that got past separation (or succeeded) confirms every spacecraft package aboard.
  if (!outcome.padShutdown && !outcome.strayLaunch && (mission.time > (mission.type.sep || 30) || ok)) for (const id of mission.capsule.cfg.pk) if (BY_ID[id] && BY_ID[id].phase == 2 && !isConfirmed(id)) {
    const done = S.pk[id];
    if (done) {
      done.c = 1;
      done.m = {};
      for (const key in done.a) done.m[key] = done.a[key] * (1 + .08 * gaussian());
      log(`[DESIGN] Flight data confirms ${BY_ID[id].name}.`, 'cyan');
    }
  }
  if (pilot && (outcome.padShutdown || outcome.strayLaunch)) log(`[ASTRONAUT OFFICE] ${pilot.name} climbs out once the booster is safe. The flight does not count; mission training stands.`, 'wn');
  else for (const astronaut of [pilot, mission.second]) if (astronaut) recordPilotFlight(mission, astronaut, outcome, state);
  if (animal) {
    if (outcome.lost) {
      loseReputation('bio');
      log(`[PRESS] ${animalName(animal)} was lost. The press is critical.`.replace('[PRESS] the', '[PRESS] The'), 'nar');
    } else log(`[PRESS] ${animalName(animal)} is recovered alive.${animal.species == 'chimpanzee' && !outcome.overspeed && !outcome.padShutdown ? ' It pulled its levers on cue all through the flight.' : ''}`.replace('[PRESS] the', '[PRESS] The'), 'ok');
  }
  if (!ok && !outcome.lost) S.rep = Math.max(0, S.rep - (outcome.boosterFailed ? 4 : 2));
  // What the failures teach: each investigation proposes the package that cures it.
  if (outcome.padShutdown && !state.fl.four) {
    state.fl.four = 1;
    log('[INVESTIGATION] The tail-plug cables pulled out in the wrong order and the booster read it as a cutoff command. New package proposed: Umbilical disconnect sequencing.', 'hd');
  }
  investigateFaults(mission, state);
  if ((mission.missionType == 'ma' || mission.type.orbital && !mission.type.gemini) && outcome.boosterFailed && !state.fl.maFail) {
    state.fl.maFail = 1;
    log('[INVESTIGATION] The booster skin buckled where it meets the capsule adapter. New package proposed: booster stiffening band.', 'hd');
  }
  if (mission.missionType == 'ma') {
    state.ma.n++;
    if (ok) {
      state.ma.ok++;
      if (!state.fl.maQual) {
        state.fl.maQual = 1;
        earn(50000);
        S.rep = Math.min(100, S.rep + 3);
        addHistory('Orbital booster qualified with a capsule');
        log('[MERCURY] Capsule and orbital booster fly together and the capsule is recovered. Orbital Mercury has a head start. Bonus +$50,000.', 'hd');
      }
    }
  }
  if (mission.type.orbital) orbitalRecords(mission, { crewSafe, recovered, pilot });
  // One flight can meet more than one open directive (a fourteen-day flight that also docks).
  let met = false;
  for (const directive of openDirectives().filter(each => each.missionType == mission.missionType)) if (directiveMet(directive, mission, { ok, crewSafe, recovered, pilot, animal, state })) {
    fulfilDirective(directive, pilot);
    met = true;
  }
  if (!outcome.padShutdown && !outcome.strayLaunch) {
    const value = teachingValue(mission.boost && mission.boost.flight.tracking);
    learn('c', (outcome.heatDamage || outcome.parachuteFailed || outcome.overheated || outcome.offAttitude ? 3 : 1.5) * value);
    learn('e', (outcome.aborted ? 4 : 1) * value);
  }
  state.lastTx = { n: mission.type.fullName, call: mission.callSign || '', tx: mission.transcript.slice(-200) };
  recordRunEvent({
    k: 'mission', n: state.flights, type: mission.missionType, crew: pilot ? pilot.name : animal ? animal.species : 'none', booster: mission.booster.label, ok,
    abort: outcome.aborted || undefined, lost: outcome.lost || undefined, met: met || undefined, four: outcome.padShutdown || undefined, over: outcome.overspeed || undefined,
    bfail: outcome.boosterFailed ? (mission.boost.failure || 'short') : undefined, orbits: mission.type.orbital ? mission.orbitsFlown : undefined,
  });
  save();
  return { ok, met, lost: !!outcome.lost };
}
// The pilot comes home tired (the backup moves up), or is lost (the memorial, a stand-down and a heavy reputation cost), or is grounded injured.
function recordPilotFlight(mission, pilot, outcome, state) {
  pilot.flights++;
  if (mission.type.gemini) pilot.gem = 1;
  const missionType = pilot.asg;
  pilot.asg = null;
  pilot.mt = 0;
  promoteBackup(missionType);
  pilot.focus = 'rest';
  pilot.fat = Math.min(100, pilot.fat + 30);
  if (outcome.lost) {
    pilot.st = 'lost';
    state.mem.push({ name: pilot.name, svc: pilot.svc, mission: `${mission.type.fullName} (${pilot.cap || 'capsule #' + mission.capsule.id})`, d: Math.round(S.day) });
    state.memo = { name: pilot.name, mission: mission.type.fullName };
    state.stand = Math.round(S.day + 180);
    S.rep = Math.max(0, S.rep - 25 - (state.fl.life ? 8 : 0));
    addHistory(`Astronaut ${pilot.name} lost on the ${mission.type.fullName}`);
    log(`[NASA] ${pilot.name} (${pilot.svc}) was lost on the ${mission.type.fullName}. Crewed flights are stood down while a review board investigates.`, 'bad');
  } else if (outcome.injured) {
    pilot.st = 'grounded';
    pilot.gd = S.crew.surg ? 60 : 120;
    log(`[FLIGHT SURGEON] ${pilot.name} is injured and grounded for about ${S.crew.surg ? 'two' : 'four'} months.`, 'wn');
  }
}
// After an orbital flight: a day in orbit and a crew of two are contested firsts.
const ORBITS_IN_A_DAY = 16;
function orbitalRecords(mission, { crewSafe, recovered, pilot }) {
  if (!pilot || !crewSafe || !recovered) return;
  if (mission.orbitsFlown >= ORBITS_IN_A_DAY) checkFirsts({ dayInOrbit: 1 });
  if (mission.second && mission.orbitsFlown >= 1) checkFirsts({ crew2: 1 });
}
// Has this flight met the current directive? Little Joe counts good aborts toward three, one with a monkey; orbital directives
// need their number of orbits flown.
function directiveMet(directive, mission, { ok, crewSafe, recovered, pilot, animal, state }) {
  const outcome = mission.outcome, key = directive.key, orbitsDone = mission.orbitsFlown >= (directive.orbits || 0);
  if (key == 'bj') return recovered && !outcome.heatDamage && !outcome.boosterFailed;
  if (key == 'lj') {
    if (outcome.aborted && !outcome.parachuteFailed && !outcome.lost && !outcome.strayLaunch) {
      state.lj.ok++;
      if (animal) state.lj.mk = 1;
      log(`[LITTLE JOE] Good abort: ${state.lj.ok} of 3${state.lj.mk ? ', monkey flight done' : ', a monkey flight still needed'}.`, 'ok');
    }
    return state.lj.ok >= 3 && !!state.lj.mk;
  }
  if (key == 'mr') return !mission.crew && ok;
  if (key == 'animal') return !!animal && animal.species == 'chimpanzee' && crewSafe && recovered && !outcome.boosterFailed && !outcome.padShutdown;
  if (key == 'crew') return !!pilot && crewSafe && recovered && !outcome.boosterFailed && !outcome.aborted;
  if (key == 'mo') return !mission.crew && ok && orbitsDone;
  if (key == 'oanimal') return !!animal && animal.species == 'chimpanzee' && crewSafe && recovered && !outcome.boosterFailed && orbitsDone;
  if (key == 'ocrew' || key == 'oday') return !!pilot && crewSafe && recovered && !outcome.boosterFailed && !outcome.aborted && orbitsDone;
  // Gemini: uncrewed, or both seats filled, with the orbit change and the spacewalk when the directive asks for them.
  if (directive.project == 'gemini') {
    const flown = directive.crew ? !!pilot && !!mission.second && crewSafe && recovered && !outcome.boosterFailed && !outcome.aborted : !mission.crew && ok;
    return flown && orbitsDone && (!directive.manoeuvre || !!outcome.manoeuvred) && (!directive.eva || !!outcome.eva)
      && (!directive.rendezvous || !!outcome.rendezvous) && (!directive.dock || !!outcome.docked);
  }
  return false;
}
