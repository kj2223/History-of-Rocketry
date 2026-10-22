// A MERCURY MISSION in flight: setting it up, the air-to-ground transcript, the timeline of events, crew and ground decisions,
// and closing it out. No DOM. The booster flies its real physics (rules/flight.js boosterRun); the capsule follows a scaled profile.
//
// A mission is one object, made by beginMission and advanced by stepMission:
//   capsule (from S.p2.veh), type (a MISSION_TYPES entry), missionType (its key), systems (capsuleSystems), booster (the airframe)
//   propellant, staged, crew (an astronaut, an animal { animalName, species }, or null), crewChoice (what the planner picked)
//   time (mission seconds), events: [{ time, kind }] still to happen, script: scripted transcript lines still to come
//   transcript: [{ t: seconds, w: speaker, x: text, c: style }] (saved as S.p2.lastTx, so the keys stay short)
//   log: what happened, in words; pending: { key, question, ground } a decision waiting for an answer
//   outcome: what went wrong or right (see newOutcome); latent: a fault the poll missed; overNoGo: launched over a NO-GO
//   altitudeScale, speedScale: the profile scaled to the booster; callSign; boost: the booster run; rescued: the man-rating
//   redundancy rode out a booster fault; retroWillFail; trace: altitudes for the plotting board; done
import { formatMoney, gaussian, clamp } from '../core/util.js';
import { BY_ID } from '../data/research.js';
import { FAILURE_MODES } from '../data/failures.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES, CHIMPANZEE_NAMES, MONKEY_NAMES, CAPSULE_NAMES, DECISIONS } from '../data/mercury.js';
import { S, log, addHistory, save, isResearched, isConfirmed, recordRunEvent } from '../core/state.js';
import { designSpec, quoteLaunch } from './design.js';
import { loseReputation } from './economy.js';
import { boosterRun, boosterFailed, boosterSucceeded } from './flight.js';
import { recordBoosterFlight, isManRated } from './manrate.js';
import { learn, teachingValue } from './knowledge.js';
import { phaseTwo, boosterPlan, capsuleSystems, fulfilDirective } from './mercury.js';
import { astronautById, simulatorTier } from './astronauts.js';

// Where the profile puts the capsule at a mission time: { alt (km), v (m/s), g }, interpolated between its points.
const profileAt = (profile, time) => {
  let index = 0;
  while (index < profile.length - 2 && profile[index + 1][0] < time) index++;
  const from = profile[index], to = profile[index + 1], share = Math.max(0, Math.min(1, (time - from[0]) / (to[0] - from[0] || 1)));
  return { alt: from[1] + (to[1] - from[1]) * share, v: from[2] + (to[2] - from[2]) * share, g: from[3] + (to[3] - from[3]) * share };
};
const between = (low, high) => low + Math.random() * (high - low);
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
  if (mission.missionType == 'mr' && pilot) {
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

// BEGIN A MISSION: pay for the launch, take the capsule and booster, and roll every capsule failure up front with a time.
// crew: 'none', 'chimp', 'monkey' or an astronaut id. options: { af: booster id, fuel, latent, over, wind }. Returns null if it cannot fly.
export function beginMission(capsuleId, crewChoice, options = {}) {
  const state = phaseTwo(), capsule = state.veh.find(candidate => candidate.id == capsuleId), booster = S.air.find(airframe => airframe.id == options.af && airframe.st == 'r');
  if (!capsule || !booster) return null;
  const type = MISSION_TYPES[capsule.mt], systems = capsuleSystems(capsule.cfg), propellant = options.fuel || 'Alcohol & LOX';
  const plan = boosterPlan(booster, propellant, capsule.mt);
  if (!plan.ok) return null;
  const quote = quoteLaunch(booster, propellant, 'Mercury Capsule', plan.staged, 1);
  if (quote.error) return null;
  S.b -= quote.cost;
  state.veh.splice(state.veh.indexOf(capsule), 1);
  S.air.splice(S.air.indexOf(booster), 1);
  S.day += 3;
  const crew = crewChoice == 'none' || !crewChoice ? null
    : crewChoice == 'chimp' ? { animalName: CHIMPANZEE_NAMES[state.chimp++ % CHIMPANZEE_NAMES.length], species: 'chimpanzee' }
    : crewChoice == 'monkey' ? { animalName: MONKEY_NAMES[state.monk++ % MONKEY_NAMES.length], species: 'rhesus monkey' }
    : astronautById(crewChoice);
  const mission = {
    capsule, type, missionType: capsule.mt, systems, booster, propellant, staged: plan.staged, crew, crewChoice, time: 0, events: [], log: [], transcript: [], pending: null,
    outcome: newOutcome(), latent: options.latent || null, overNoGo: !!options.over, done: 0, trace: [],
    altitudeScale: clamp(plan.preview.peakAltitude / 1000 / type.reference.alt, .4, 2.5), speedScale: clamp(plan.preview.peakSpeed / type.reference.v, .4, 2.5),
  };
  if (crew && !isAnimal(crew)) {
    crew.cap = crew.cap || `${CAPSULE_NAMES[(crew.id * 7) % CAPSULE_NAMES.length]} ${state.astros.length}`;
    mission.callSign = crew.cap;
  }
  const schedule = (time, kind) => mission.events.push({ time, kind });
  log(`--- ${type.fullName.toUpperCase()}: capsule #${capsule.id} on ${booster.label}${crew ? ` with ${isAnimal(crew) ? animalName(crew) : crew.name}` : ''} ---`, 'wn');
  transmit(mission, '', `${type.fullName} on ${booster.label}${mission.callSign ? `. Call sign ${mission.callSign}` : ''}${isAnimal(crew) ? `, with ${animalName(crew)} aboard` : ''}.`);
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
  const rescueChance = Math.min(.6, ((rocketSpec.mr || 0) + (capsule.mt == 'ma' ? rocketSpec.mab || 0 : 0)) * 2.5);
  let boost = boosterRun(booster, propellant, plan.staged, { latent: mission.latent, wind: options.wind || 0 });
  if ((boost.failure || boost.short) && Math.random() < rescueChance) {
    boost = boosterRun(booster, propellant, plan.staged, { wind: options.wind || 0 });
    mission.rescued = 1;
  }
  mission.boost = boost;
  if (boost.failure || boost.short) schedule(Math.max(3, Math.min(boostEnd - 2, boost.fraction * boostEnd)), 'boosterFailure');
  else schedule(boostEnd - .5, 'cutoff');
  if (type.abortAt) schedule(type.abortAt, 'plannedAbort');
  if (type.sep && capsule.mt == 'mr' && Math.random() < 1 - systems.reliability('tj')) schedule(type.sep + 2, 'tj');
  if (capsule.mt == 'mr') {
    if (!isManRated(booster) && Math.random() < .2) schedule(boostEnd - 10, 'overspeed');
    if (Math.random() < 1 - systems.reliability('ac')) schedule(between(180, 260), 'att');
    if (Math.random() < 1 - systems.reliability('ec')) schedule(between(170, 400), 'ecs');
    schedule(300, 'retro');
    if (Math.random() < 1 - systems.reliability('rr')) mission.retroWillFail = 1;
  }
  if (type.reentry) schedule(type.reentry + 10, 'reentry');
  if (type.chute > 40) schedule(type.chute - 30, 'drogue');
  schedule(type.chute, 'chute');
  schedule(type.end - 2, 'splash');
  mission.events.sort((first, second) => first.time - second.time);
  mission.script = scriptFor(mission);
  return mission;
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
};
export const isGroundDecision = key => !!DECISIONS[key].ground;
// The options as offered: each with its index, and available unless it needs manual control or a CAPCOM that is not there.
export function decisionOptions(mission, key) {
  return DECISIONS[key].options.map((option, index) => ({
    ...option, index, available: !(option.needs == 'man' && !mission.systems.manual) && !(option.needs == 'capcom' && !S.crew.capcom),
  }));
}
// The chance an option works, between 4% and 97% (a soft ground option always works).
export function decisionOdds(mission, key, option) {
  const bounded = chance => Math.max(.04, Math.min(.97, chance));
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
// A decision lands. With a person aboard (or on the ground) it waits for an answer and returns true;
// with no one aboard the automatics take the best available option at once.
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
  const best = decisionOptions(mission, key).filter(option => option.available && !option.needs).sort((first, second) => decisionOdds(mission, key, second) - decisionOdds(mission, key, first))[0];
  resolveDecision(mission, key, best, true);
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
  mission.pending = null;
  const option = decisionOptions(mission, pending.key).find(candidate => candidate.index == index);
  resolveDecision(mission, pending.key, option, false);
}
function resolveDecision(mission, key, option, automatic) {
  const worked = Math.random() < decisionOdds(mission, key, option), pilot = pilotAboard(mission), outcome = mission.outcome, state = phaseTwo();
  const who = DECISIONS[key].ground ? 'Test Conductor' : pilot ? pilot.name.split(' ')[1] : 'The automatic sequence';
  if (!automatic) {
    mission.log.push(`${who}: "${option.text}."`);
    log(`T+${Math.round(mission.time)}s | ${who}: "${option.text}."`, 'cyan');
    transmit(mission, DECISIONS[key].ground ? 'TC' : 'P', `${option.text}.`, 'cyan');
  }
  if (key == 'abort') {
    if (worked) towerFires(mission);
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
      report(mission, 'Retros fired by hand.', 'ok');
      if (pilot) transmit(mission, 'P', 'Retros fired on the manual switch. I felt all three.');
    } else report(mission, 'The manual retro switch does nothing.', 'wn');
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
  } else if (key == 'pad') {
    mission.done = 1;
    resolvePadEmergency(mission, option, worked, state);
  }
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
// The escape tower fires: if it works, the capsule skips straight to its parachutes.
function towerFires(mission) {
  const outcome = mission.outcome;
  outcome.aborted = 1;
  if (Math.random() < mission.systems.reliability('et')) {
    report(mission, 'ESCAPE TOWER FIRES. The capsule is pulled clear of the booster.', 'wn');
    if (pilotAboard(mission)) transmit(mission, 'P', 'Tower fired! I\'m off the booster. Waiting on the chutes.');
    mission.time = Math.max(mission.time, mission.type.chute - 1);
    mission.events = mission.events.filter(event => event.kind == 'chute' || event.kind == 'splash');
    mission.events.forEach(event => {
      if (event.kind == 'splash') event.time = mission.type.chute + 60;
    });
  } else {
    outcome.lost = mission.crew ? (Math.random() < .7 ? 1 : 0) : 1;
    if (!outcome.lost) outcome.injured = 1;
    report(mission, 'The escape tower fails to pull the capsule clear.', 'bad');
    mission.done = 1;
  }
}
function boosterDown(mission) {
  const boost = mission.boost;
  mission.outcome.boosterFailed = 1;
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
// What each event does. Each returns 'decide' or 'end' to stop the step there, or nothing to carry on.
const EVENTS = {
  stray(mission, pilot, outcome) {
    outcome.strayLaunch = 1;
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
    if (mission.missionType == 'bj' || mission.missionType == 'ma') {
      outcome.lost = 1;
      report(mission, 'With no escape tower on this flight, the capsule is lost with the booster.', 'bad');
      mission.done = 1;
      return 'end';
    }
    if (Math.random() < mission.systems.reliability('as')) {
      report(mission, 'Abort sensing trips automatically.', 'wn');
      towerFires(mission);
    } else if (raiseDecision(mission, 'abort')) return 'decide';
    if (mission.done) return 'end';
  },
  plannedAbort(mission, pilot, outcome) {
    report(mission, 'Maximum aerodynamic load: abort commanded.', 'wn');
    if (Math.random() < mission.systems.reliability('as')) towerFires(mission);
    else {
      report(mission, 'Abort sensing fails to fire the tower.', 'bad');
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
    if (raiseDecision(mission, 'tj')) return 'decide';
  },
  att(mission) {
    report(mission, 'Attitude control fault.', 'wn');
    if (raiseDecision(mission, 'att')) return 'decide';
  },
  ecs(mission) {
    report(mission, 'Environmental control fault: temperatures rising.', 'wn');
    if (raiseDecision(mission, 'ecs')) return 'decide';
  },
  retro(mission, pilot) {
    if (mission.retroWillFail) {
      report(mission, 'Retrofire signal sent; no retro ignition.', 'wn');
      if (raiseDecision(mission, 'retro')) return 'decide';
    } else {
      report(mission, 'Retrorockets fire on time.', 'ok');
      if (pilot) transmit(mission, 'P', 'Retro one... retro two... retro three. All three fired. Good kick.');
    }
  },
  // Re-entry: the heat shield may run hot (worse on the fast flights and off attitude), and the g-load may grey out a pilot
  // with poor endurance and no centrifuge training.
  reentry(mission, pilot, outcome) {
    const heatChance = (1 - mission.systems.reliability('hs')) * (mission.missionType == 'bj' ? 1.3 : mission.missionType == 'ma' ? 1.4 : 1) * (outcome.offAttitude ? 1.8 : 1);
    const gLoad = outcome.overspeed ? 15 : 11;
    if (Math.random() < heatChance) {
      outcome.heatDamage = 1;
      report(mission, 'Heat-shield temperatures far above prediction.', 'bad');
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
    report(mission, outcome.overspeed ? 'Splashdown, 200 km beyond the planned area. The ships are hours away.' : 'Splashdown.', outcome.overspeed ? 'wn' : 'ok');
    if (pilot) {
      transmit(mission, 'P', 'Impact. Capsule is upright, no leaks.');
      transmit(mission, 'CC', `Welcome home, ${mission.callSign}.`);
    }
    if (Math.random() > mission.systems.reliability('lb')) {
      report(mission, 'Hard landing: the landing bag did not deploy properly.', 'wn');
      if (mission.crew && Math.random() < .25) outcome.injured = 1;
      if (!mission.crew && Math.random() < (S.fac.recov ? .2 : .4)) outcome.sank = 1;
    }
    if (outcome.overspeed && !outcome.sank && Math.random() < (S.fac.recov ? .1 : .25)) {
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

// The flight director asks for an abort. Only possible while the escape tower is still on and there is one.
export function manualAbort(mission) {
  if (mission.done || mission.pending) return;
  if (mission.missionType == 'bj' || mission.missionType == 'ma' || mission.time > (mission.type.sep || mission.type.abortAt || 0)) {
    report(mission, 'Abort requested, but there is no escape tower to fire. The flight continues.', 'wn');
    return;
  }
  report(mission, 'MANUAL ABORT commanded.', 'bad');
  mission.outcome.boosterFailed = 1;
  towerFires(mission);
}

// CLOSE OUT a mission: the crew, reputation, spacecraft packages confirmed, the directive, what was learned, and the record.
// Returns { ok, met, lost }.
export function endMission(mission) {
  const state = phaseTwo(), outcome = mission.outcome, pilot = pilotAboard(mission), animal = isAnimal(mission.crew) ? mission.crew : null;
  state.flights++;
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
  else if (pilot) recordPilotFlight(mission, pilot, outcome, state);
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
  if (mission.missionType == 'ma' && outcome.boosterFailed && !state.fl.maFail) {
    state.fl.maFail = 1;
    log('[INVESTIGATION] The booster skin buckled where it meets the capsule adapter. New package proposed: booster stiffening band.', 'hd');
  }
  if (mission.missionType == 'ma') {
    state.ma.n++;
    if (ok) {
      state.ma.ok++;
      if (!state.fl.maQual) {
        state.fl.maQual = 1;
        S.b += 50000;
        S.rep = Math.min(100, S.rep + 3);
        addHistory('Orbital booster qualified with a capsule');
        log('[MERCURY] Capsule and orbital booster fly together and the capsule is recovered. Orbital Mercury has a head start. Bonus +$50,000.', 'hd');
      }
    }
  }
  const directive = MERCURY_DIRECTIVES[state.dir];
  let met = false;
  if (directive && directive.missionType == mission.missionType) met = directiveMet(directive.key, mission, { ok, crewSafe, recovered, pilot, animal, state });
  if (met) fulfilDirective(directive, pilot);
  if (!outcome.padShutdown && !outcome.strayLaunch) {
    const value = teachingValue(mission.boost && mission.boost.flight.tracking);
    learn('c', (outcome.heatDamage || outcome.parachuteFailed || outcome.overheated || outcome.offAttitude ? 3 : 1.5) * value);
    learn('e', (outcome.aborted ? 4 : 1) * value);
  }
  state.lastTx = { n: mission.type.fullName, call: mission.callSign || '', tx: mission.transcript.slice(-200) };
  recordRunEvent({
    k: 'mission', n: state.flights, type: mission.missionType, crew: pilot ? pilot.name : animal ? animal.species : 'none', booster: mission.booster.label, ok,
    abort: outcome.aborted || undefined, lost: outcome.lost || undefined, met: met || undefined, four: outcome.padShutdown || undefined, over: outcome.overspeed || undefined,
    bfail: outcome.boosterFailed ? (mission.boost.failure || 'short') : undefined,
  });
  save();
  return { ok, met, lost: !!outcome.lost };
}
// The pilot comes home tired, or is lost (the memorial, a stand-down and a heavy reputation cost), or is grounded injured.
function recordPilotFlight(mission, pilot, outcome, state) {
  pilot.flights++;
  pilot.asg = null;
  pilot.mt = 0;
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
// Has this flight met the current directive? Little Joe counts good aborts toward three, one with a monkey.
function directiveMet(key, mission, { ok, crewSafe, recovered, pilot, animal, state }) {
  const outcome = mission.outcome;
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
  return false;
}
