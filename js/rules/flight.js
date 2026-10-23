// FLIGHT: setting up a launch, the physics and failure model second by second, instrument readings, and the results. No DOM.
//
// A flight is one object, created by makeFlight and advanced one second at a time by step():
//   airframe, spec (designSpec of its packages), programme, label, propellant, payload, load (share of a full tank)
//   stages: [booster, core] or [core]; each { isBooster, dry, fuel, thrust, isp }. stageIndex: the stage burning now.
//   time (s), altitude (m), verticalSpeed, horizontalSpeed (m/s), downrange (m), peakAltitude, peakSpeed, peakHorizontalSpeed
//   latent: a fault the poll missed (a failure-mode key), wind (0 to 2), overNoGo: launched over a NO-GO call
//   plan: the trajectory panel's { elevation (degrees), program (a PITCH_PROGRAMS key), aim (the upper stage's degrees above the
//         horizon, or null for the guidance's own) }, or null to fly the default
//   reliability, gLimit, aeroLimitScale, heatLimit, dragArea, deformation (heat damage), maxQ and maxHeat (shares of their limits)
//   modeMultipliers: each failure mode's weight on this airframe (fixes lower it, traits raise it)
//   tracking: { v: instrument tier, g: ground tracking tier }; lastReadings and lostChannels for the instruments; trace, rangeTrace: altitudes and downrange distances for the plot
//   failure: the mode that struck, if any; pending: a failure showing its warning signs, { mode, from, at } (seconds)
import { formatMoney, gaussian } from '../core/util.js';
import { PROPELLANTS, PAYLOADS, PITCH_PROGRAMS } from '../data/launch.js';
import { DIRECTIVES, DIRECTIVE_NEWS } from '../data/history.js';
import { BY_ID } from '../data/research.js';
import { FAILURE_MODES, SYMPTOMS, visibleSymptoms, findFix } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, save, isConfirmed, addHistory, recordRunEvent, withProgramme } from '../core/state.js';
import { designSpec, fixModifiers, trackingTiers, quoteLaunch } from './design.js';
import { recoveryPlan, recoverPayload } from './recovery.js';
import { FAILURE_WARNINGS, WARNING_SECONDS } from './telemetry.js';
import { confirmPackage, checkBreakthroughs } from './research.js';
import { loseReputation, rangeDataPayment } from './economy.js';
import { checkFirsts } from './race.js';
import { recordBoosterFlight } from './manrate.js';
import { programmeOf, traitWeight, revealTraits, maturity } from './programs.js';
import { learn, learnFromFlight, knowledgeFraction, systemOf } from './knowledge.js';
import { recordCampaignFlight } from './campaign.js';

// What is in the air right now: the UI's launch view (and the launch director) keep the flight or Mercury mission here.
export const airborne = { flight: null, mission: null };

const GRAVITY = 9.81, EARTH_RADIUS = 6371e3, SEA_LEVEL_DENSITY = 1.225, SCALE_HEIGHT = 8500;
const ORBIT_ALTITUDE = 120000, ORBIT_SPEED = 7000; // horizontal speed above 120 km that counts as orbit
const LATENT_FAULT_CHANCE = .09; // chance per second that a latent fault strikes while its window is open
const DEFAULT_LEAN = .15; // radians off vertical the rail leans a rocket flown without a plan, from T+2
// The upper stage fires this far off vertical (radians): closer to horizontal with better guidance (instrument tier).
const guidedPitch = tier => Math.min(1.5708, 1.35 + .08 * tier);
// The flattest upper stage aim the guidance can hold, in whole degrees above the horizon: a plan may aim higher, never lower.
export const flattestAim = tier => Math.ceil(90 - guidedPitch(tier) * 180 / Math.PI);

// INCIDENTS: a failure opens one (or adds evidence to one already open). Incidents are saved:
//   { id, mode, sym: symptoms seen, cand: modes that fit them, ev: failures on file, st: open | inv | diag | fixing | done,
//     t: time of failure, lab: airframe, plot: last altitude, dx: the diagnosis, conf: confidence, review: 1 if from a design review }
function openIncident(flight, tracking, lastPlot) {
  const mode = flight.failure, carried = flight.airframe.fix[mode];
  if (carried) {
    loseReputation('residual');
    return log(`[INCIDENT] ${FAILURE_MODES[mode].name} struck despite the corrective design. Residual risk.`, 'wn');
  }
  if (S.fix[mode]) {
    loseReputation('obsolete');
    return log(`[INCIDENT] This airframe predates the fix for ${FAILURE_MODES[mode].name.toLowerCase()}. Retrofit older airframes.`, 'wn');
  }
  const existing = S.inc.find(incident => incident.mode == mode && incident.st != 'done');
  if (existing) {
    existing.ev++;
    loseReputation(S.known[mode] ? 'known' : 'novel');
    if (existing.st == 'diag' && existing.dx != mode) {
      existing.st = 'open';
      existing.dx = null;
      log(`[INCIDENT #${existing.id}] The same failure recurred. The earlier diagnosis is ruled out.`, 'bad');
    } else log(`[INCIDENT #${existing.id}] Another failure with the same signature adds evidence.`, 'wn');
    return;
  }
  // Every mode whose visible symptoms look the same is a candidate.
  const symptoms = visibleSymptoms(mode, tracking), signature = symptoms.join();
  const candidates = Object.keys(FAILURE_MODES).filter(other => visibleSymptoms(other, tracking).join() == signature);
  const incident = { id: S.inc.reduce((highest, other) => Math.max(highest, other.id), 0) + 1, mode, sym: symptoms, cand: candidates, ev: 1, st: 'open', t: flight.time, lab: flight.airframe.label, plot: lastPlot };
  S.inc.push(incident);
  loseReputation(S.known[mode] ? 'known' : 'novel');
  log(`[INCIDENT #${incident.id}] Records show: ${symptoms.length ? symptoms.map(symptom => SYMPTOMS[symptom].text).join('; ') : 'carrier and track lost, nothing more'}.`, 'wn');
  if (candidates.length == 1) {
    incident.dx = mode; incident.conf = 'high'; incident.st = 'diag'; S.known[mode] = 1;
    log(`[INCIDENT #${incident.id}] Telemetry is unambiguous: ${FAILURE_MODES[mode].name.toLowerCase()}.`, 'wn');
  } else if (Math.random() < .7 * knowledgeFraction(systemOf(mode))) {
    incident.dx = mode; incident.conf = 'high'; incident.st = 'diag'; S.known[mode] = 1;
    learn(systemOf(mode), 4);
    log(`[INCIDENT #${incident.id}] The engineers recognise the signature at once: ${FAILURE_MODES[mode].name.toLowerCase()}.`, 'wn');
  }
}

// SETTING UP A FLIGHT. The flight uses the programme's true design; a preview (estimated) uses what the team believes the rocket can do.
function makeFlight(airframe, propellantName, payloadName, stage, load, options = {}) {
  return withProgramme(programmeOf(airframe), () => makeFlightForProgramme(airframe, propellantName, payloadName, stage, load, options));
}
// The booster stage shares the design's fortunes: thrust and propellant scale with the rocket's own figures and its research.
// Research reaches the booster stage at half strength: most packages are aimed at the upper stage.
const halfStrength = x => 1 + (x - 1) * .5;
const boosterStage = (programme, spec, modifiers, load = 1) => {
  const booster = programme.booster, design = programme.design;
  return {
    isBooster: 1,
    dry: booster.dry * halfStrength(spec.dry / design.dry),
    fuel: booster.fuel * halfStrength(spec.f / design.f) * load,
    thrust: booster.thr * halfStrength(spec.thr / design.thr * spec.t * modifiers.t),
    isp: booster.isp * (1 + .25 * (spec.t * modifiers.t - 1)),
  };
};
// NO TWO FLIGHTS ALIKE: the airframe's own build variation (rules/production.js), and on the day the engine runs typically
// 1.5% hotter or cooler (never more than 3%). The pre-flight estimate uses the drawings: the engineers don't know a particular airframe's quirks.
const DAY_TO_DAY_THRUST = .015;
const AS_DRAWN = { t: 1, m: 1, d: 1 };
const withVariation = (eachStage, build, onTheDay) => ({ ...eachStage, dry: eachStage.dry * build.m, thrust: eachStage.thrust * build.t * onTheDay });
function makeFlightForProgramme(airframe, propellantName, payloadName, stage, load, options) {
  const programmeKey = programmeOf(airframe), programme = PROGRAMMES[programmeKey] || {};
  const spec = designSpec(airframe.pk, options.estimated), modifiers = fixModifiers(airframe.fix);
  const propellant = PROPELLANTS[propellantName], payload = PAYLOADS[payloadName];
  const build = options.estimated ? AS_DRAWN : airframe.vr || AS_DRAWN;
  const onTheDay = options.estimated ? 1 : 1 + DAY_TO_DAY_THRUST * Math.max(-2, Math.min(2, gaussian()));
  const core = {
    dry: (spec.dry + spec.d + modifiers.d) * build.m,
    fuel: spec.f * propellant.density * load,
    thrust: spec.thr * spec.t * modifiers.t * build.t * onTheDay,
    isp: propellant.isp * (1 + .5 * (spec.t * modifiers.t - 1)),
  };
  const coreBurnTime = core.fuel / (core.thrust / (core.isp * GRAVITY));
  // Reliability: the propellant's base, up to +15 points of experience with it, the design's offset,
  // up to -8 points for unproven packages, and up to +7 points as the programme matures.
  const unproven = airframe.pk.filter(id => !isConfirmed(id)).length;
  const reliability = Math.min(.99, propellant.reliability + Math.min(.15, (S.fr[propellantName] || 0) * .015) + spec.r - Math.min(.08, unproven * .012) + .07 * maturity(programmeKey) / 100);
  return {
    airframe, spec, latent: options.latent || null, wind: options.wind || 0, overNoGo: !!options.over, plan: options.plan || null,
    propellant: propellantName, payload: payloadName, satellite: !!payload.satellite, payloadMass: payload.mass, separationRisk: 1,
    stages: stage && programme.booster ? [withVariation(boosterStage(programme, spec, modifiers, load), build, onTheDay), core] : [core], stageIndex: 0,
    altitude: 0, verticalSpeed: 0, horizontalSpeed: 0, time: 0, peakAltitude: 0, peakSpeed: 0, peakHorizontalSpeed: 0, downrange: 0, load, noFail: false,
    aeroLimitScale: spec.q + modifiers.q, heatLimit: spec.h + modifiers.h, dragArea: .004 * Math.max(.35, spec.c + modifiers.c) * build.d,
    deformation: 0, maxQ: 0, maxHeat: 0, heatWarned: 0, reliability,
    referenceThrust: Math.max(1, spec.thr / 2.5) * 1.2, // pump trouble grows as thrust rises past this
    gLimit: spec.g + modifiers.g,
    hazardScale: Math.pow(20 / Math.max(5, coreBurnTime), .6), // short burns pack the same risk into fewer seconds
    modeMultipliers: Object.fromEntries(Object.keys(FAILURE_MODES).map(mode => [mode, (airframe.fix[mode] ? findFix(mode, airframe.fix[mode]).riskMultiplier : 1) * traitWeight(programmeKey, mode, airframe)])),
    programme: programmeKey, tracking: { v: spec.tier, g: trackingTiers().g }, burnTime: Math.round(coreBurnTime),
    lastReadings: {}, lostChannels: {}, trace: [], rangeTrace: [], countdown: 3, countdownTicks: 0, label: airframe.label, failure: null,
  };
}
// Launch: pay, take the airframe out of the hangar, a week passes on the calendar. Returns the flight, or null if the quote fails.
export function beginFlight(airframe, propellantName, payloadName, stage, load = 1, options = {}) {
  const quote = quoteLaunch(airframe, propellantName, payloadName, stage, load);
  if (quote.error) return null;
  S.b -= quote.cost;
  S.air.splice(S.air.indexOf(airframe), 1);
  S.day += 7;
  const flight = makeFlight(airframe, propellantName, payloadName, stage, load, options);
  log(`--- LAUNCH SEQUENCE: ${airframe.label} (propellant ${Math.round(load * 100)}%) ---`, 'wn');
  log(`[DISPATCH] ${DIRECTIVE_NEWS[Math.min(4, S.dir)]}`, 'nar');
  if (flight.overNoGo) log('[TC] Proceeding over a NO-GO call.', 'bad');
  return flight;
}
// THE PRE-FLIGHT ESTIMATE: a failure-free run of the same vehicle, as the engineers believe it. uncertainty: the ± the UI shows.
// path: the predicted altitudes and downrange distances, second by second, for the plotting board.
export function previewFlight(airframe, propellantName, payloadName, stage, load, wind = 0, plan = null) {
  const flight = makeFlight(airframe, propellantName, payloadName, stage, load, { wind, estimated: 1, plan });
  flight.noFail = true;
  let liftoffMass = flight.payloadMass;
  flight.stages.forEach(eachStage => liftoffMass += eachStage.dry + eachStage.fuel);
  const lastStage = flight.stages[flight.stages.length - 1];
  const thrustToWeight = flight.stages[0].thrust / liftoffMass / GRAVITY, burnoutG = lastStage.thrust / (lastStage.dry + flight.payloadMass) / GRAVITY;
  const path = { altitude: [], downrange: [] };
  let result;
  do {
    result = step(flight);
    path.altitude.push(Math.max(0, flight.altitude));
    path.downrange.push(flight.downrange);
  } while (result == 'tick' || result == 'sep');
  const tiers = trackingTiers();
  return {
    thrustToWeight, burnoutG, gLimit: flight.gLimit, peakAltitude: flight.peakAltitude, peakSpeed: flight.peakSpeed,
    peakHorizontalSpeed: flight.peakHorizontalSpeed || 0, orbit: result == 'orbit', downrange: flight.downrange, burnTime: flight.burnTime,
    flattestAim: flight.stages.length > 1 ? flattestAim(flight.tracking.v) : null, // null: no upper stage to aim
    maxQ: flight.maxQ, maxHeat: flight.maxHeat, recovery: recoveryPlan(flight), scienceMultiplier: flight.spec.sv, path,
    uncertainty: Math.max(.03, .2 * (1 - .1 * (tiers.g + tiers.v)) * (S.fac.comp ? .5 : 1) * (S.fac.wall ? .8 : 1) * (S.crew.fido ? .8 : 1)),
  };
}

// INSTRUMENT CHANNELS: what the range can measure, from what (value), and how well (quality, from the ground and instrument tiers).
// A quality is { noise: typical error (fraction), every: seconds between readings, rounding: the step readings come in, dropout: chance of losing the track }.
// No quality means the channel is not available.
export const CHANNELS = {
  alt: { value: flight => Math.max(0, flight.altitude), quality: ground => [{ noise: .12, every: 4, rounding: 250, dropout: .15 }, { noise: .06, every: 2, rounding: 100, dropout: .05 }, { noise: .03, every: 1, rounding: 25, dropout: 0 }][ground] },
  vel: { value: flight => flight.verticalSpeed, quality: (ground, vehicle) => vehicle >= 2 ? { noise: .04, every: 1, rounding: 10, dropout: 0 } : ground >= 1 ? { noise: .12, every: 2, rounding: 50, dropout: .05 } : null },
  hor: { value: flight => Math.max(0, flight.horizontalSpeed), quality: (ground, vehicle) => vehicle >= 3 ? { noise: .03, every: 1, rounding: 10, dropout: 0 } : ground >= 2 ? { noise: .1, every: 2, rounding: 50, dropout: .05 } : null },
  fuel: { value: flight => Math.max(0, flight.stages.reduce((sum, eachStage) => sum + eachStage.fuel, 0)), quality: (ground, vehicle) => vehicle >= 2 ? { noise: .03, every: 1, rounding: 1, dropout: 0 } : vehicle >= 1 ? { noise: .1, every: 2, rounding: 5, dropout: .05 } : null },
};
// An altitude as the range reports it: "~12.5 km" (the ~ marks a rough reading).
export const formatAltitude = (value, quality) => (quality && quality.noise >= .05 ? '~' : '') + (value >= 1000 ? (value / 1000).toFixed(quality && quality.rounding >= 100 ? 1 : 2) + ' km' : value + ' m');

// Take this second's instrument readings, and log them every other second (unless quiet).
export function takeReadings(flight, quiet) {
  const parts = [];
  for (const channel in CHANNELS) {
    const quality = CHANNELS[channel].quality(flight.tracking.g, flight.tracking.v);
    if (!quality) continue;
    if (flight.time % quality.every && flight.lastReadings[channel]) continue;
    if (quality.dropout && Math.random() < quality.dropout) {
      flight.lostChannels[channel] = 1;
      if (channel == 'alt') parts.push('RADAR: NO TRACK');
      continue;
    }
    flight.lostChannels[channel] = 0;
    const value = Math.max(channel == 'vel' ? -1e9 : 0, Math.round(CHANNELS[channel].value(flight) * (1 + quality.noise * gaussian()) / quality.rounding) * quality.rounding);
    flight.lastReadings[channel] = { value, quality };
    const source = channel == 'alt' ? 'RADAR' : channel == 'vel' ? (flight.tracking.v >= 2 ? 'ACCEL' : 'DOPPLER') : channel == 'hor' ? (flight.tracking.v >= 3 ? 'INERTIAL' : 'RANGE-RATE') : 'PROP';
    parts.push(`${source} ${channel == 'alt' ? formatAltitude(value, quality) : (quality.noise >= .05 ? '~' : '') + value + (channel == 'fuel' ? ' kg' : ' m/s')}`);
  }
  // The plotting board's track: the radar altitude, and how far downrange the radar has the rocket at the same moment.
  if (flight.lastReadings.alt) {
    flight.trace.push(flight.lastReadings.alt.value);
    flight.rangeTrace.push(flight.downrange);
  }
  if (parts.length && flight.time % 2 == 0 && !quiet) log(`T+${flight.time}s | ${parts.join(' | ')}`);
}

// A failure strikes: at once (returns true), or, for a mode with a warning, after a few seconds of signs on its part channel
// (flight.pending: { mode, from, at }; rules/telemetry.js shows the signs, and you can abort in the meantime).
function strike(flight, mode) {
  if (!FAILURE_WARNINGS[mode]) {
    flight.failure = mode;
    return true;
  }
  flight.pending = { mode, from: flight.time, at: flight.time + WARNING_SECONDS.least + Math.floor(Math.random() * (WARNING_SECONDS.most - WARNING_SECONDS.least + 1)) };
  return false;
}

// ONE SECOND OF FLIGHT. Returns 'tick', 'sep' (a booster stage separated), 'fail', 'orbit' or 'land'.
export function step(flight) {
  flight.time++;
  const stage = flight.stages[flight.stageIndex];
  let thrust = 0;
  if (stage.fuel > 0) {
    const fullBurn = stage.thrust / (stage.isp * GRAVITY), burned = Math.min(fullBurn, stage.fuel);
    stage.fuel -= burned;
    thrust = stage.thrust * burned / fullBurn;
  } else if (stage.isBooster) {
    flight.stageIndex++;
    flight.separationTime = flight.time;
    return 'sep';
  }
  let mass = flight.payloadMass;
  for (let index = flight.stageIndex; index < flight.stages.length; index++) mass += flight.stages[index].dry + flight.stages[index].fuel;

  // Aerodynamic load and heating, as shares of what the airframe can take.
  const airDensity = SEA_LEVEL_DENSITY * Math.exp(-flight.altitude / SCALE_HEIGHT), speed = Math.hypot(flight.verticalSpeed, flight.horizontalSpeed);
  const aeroLoad = .5 * airDensity * speed * speed / (flight.gLimit * 40000 * flight.aeroLimitScale) * (1 + .3 * flight.wind);
  const heating = Math.sqrt(airDensity / SEA_LEVEL_DENSITY) * Math.pow(speed / 1e3, 3) / flight.heatLimit;
  // This second's loads, for the part channels and the crew's callouts (rules/telemetry.js, rules/callouts.js).
  Object.assign(flight, { aeroLoad, heating, thrustShare: thrust / stage.thrust, gLoad: thrust / mass / GRAVITY });
  // Overheating deforms the skin; it slowly recovers when the heating eases.
  if (thrust > 0) {
    if (heating > 1) flight.deformation += (heating - 1) * .6;
    else if (flight.deformation > 0) flight.deformation = Math.max(0, flight.deformation - .02);
    flight.maxQ = Math.max(flight.maxQ, aeroLoad);
    flight.maxHeat = Math.max(flight.maxHeat, heating);
  } else if (flight.deformation > 0) flight.deformation = Math.max(0, flight.deformation - .02);
  if (heating > 1 && !flight.heatWarned && !flight.noFail && flight.tracking.v >= 2) {
    flight.heatWarned = 1;
    log(`T+${flight.time}s | [TLM] SKIN TEMPERATURE ABOVE LIMIT`, 'bad');
  }

  // A failure already showing on its channel strikes when its warning runs out, powered or not.
  if (flight.pending && flight.time >= flight.pending.at) {
    flight.failure = flight.pending.mode;
    return 'fail';
  }
  // A latent fault strikes only in its window: ignition (i), just after separation (x), through the dense air (h, f), or any time after T+3.
  if (thrust > 0 && !flight.noFail && flight.latent && !flight.pending) {
    const mode = flight.latent;
    const inWindow = mode == 'i' ? flight.time <= 3
      : mode == 'x' ? !!(flight.separationTime && flight.time - flight.separationTime <= 3)
      : (mode == 'h' || mode == 'f') ? (aeroLoad > .25 || heating > .25 || (flight.time > 8 && flight.time < 25))
      : flight.time > 3;
    if (inWindow && Math.random() < LATENT_FAULT_CHANCE && strike(flight, mode)) return 'fail';
  }
  // THE FAILURE MODEL: a chance of failing this second, then which mode, weighted by what the vehicle is going through.
  if (thrust > 0 && !flight.noFail && !flight.pending) {
    const justSeparated = flight.separationTime && flight.time - flight.separationTime <= 2;
    const spike = (flight.time <= 3 ? .012 : 0) + (justSeparated ? .04 : 0); // ignition and staging are risky moments
    const gLoad = thrust / mass / GRAVITY;
    const stress = Math.max(0, gLoad / (flight.gLimit * (1 - .35 * Math.min(1, flight.deformation))) - .85) + Math.max(0, aeroLoad - .8) * .5;
    const unreliability = 1 - flight.reliability;
    const weights = {
      c: unreliability,
      p: unreliability * .8 * Math.min(2, thrust / flight.referenceThrust),
      s: stress * 2 + .02,
      i: flight.time <= 3 ? unreliability * 4 : 0,
      v: unreliability * .4,
      h: heating > .8 ? (heating - .8) * 6 + flight.deformation * 5 : 0,
      f: aeroLoad > .6 ? (aeroLoad - .6) * 6 : 0,
      x: justSeparated ? unreliability * 6 * flight.separationRisk : 0,
    };
    let weighted = 0, total = 0;
    for (const mode in weights) {
      total += weights[mode];
      weighted += weights[mode] * (flight.modeMultipliers[mode] || 1);
    }
    const chance = (unreliability * .15 + (flight.time < 40 ? flight.wind * .003 : 0) + stress * .05 + spike + Math.max(0, heating - .85) * .12 + flight.deformation * .15 + Math.max(0, aeroLoad - .7) * .1) * flight.hazardScale * weighted / total;
    if (Math.random() < chance) {
      let roll = Math.random() * weighted;
      let pick = 'c';
      for (const mode in weights) {
        roll -= weights[mode] * (flight.modeMultipliers[mode] || 1);
        if (roll <= 0) { pick = mode; break; }
      }
      if (strike(flight, pick)) return 'fail';
    }
  }

  // THE TRAJECTORY. On a staged flight the booster lofts the stack and the upper stage fires toward the horizon, as the real satellite
  // launchers did. Better guidance (instrument tier) flies a tighter turn and aims the upper stage closer to horizontal.
  // The plan sets the launcher's lean, the pitch program and the upper stage's aim; without one the rocket flies the default lean,
  // the standard program and the guidance's aim.
  const radius = EARTH_RADIUS + flight.altitude, density = SEA_LEVEL_DENSITY * Math.exp(-flight.altitude / SCALE_HEIGHT);
  const staged = flight.stages.length > 1, plan = flight.plan, program = PITCH_PROGRAMS[plan ? plan.program : 'standard'];
  const lean = plan ? (90 - plan.elevation) * Math.PI / 180 : DEFAULT_LEAN;
  const pitch = staged && flight.stageIndex > 0
    ? Math.min(guidedPitch(flight.tracking.v), plan && plan.aim != null ? (90 - plan.aim) * Math.PI / 180 : Infinity)
    : Math.max(flight.time > 2 ? lean : 0, Math.min(.97, Math.max(0, (flight.altitude - program.start) / (staged ? program.span - 3500 * flight.tracking.v : program.span))) * 1.5);
  const drag = .5 * density * flight.dragArea * (flight.stages[flight.stageIndex].isBooster ? 1.8 : 1) * flight.verticalSpeed * Math.abs(flight.verticalSpeed);
  const previousVerticalSpeed = flight.verticalSpeed;
  flight.verticalSpeed += thrust / mass * Math.cos(pitch) - GRAVITY * Math.pow(EARTH_RADIUS / radius, 2) + flight.horizontalSpeed * flight.horizontalSpeed / radius - drag / mass;
  flight.altitude += flight.verticalSpeed;
  flight.horizontalSpeed += thrust / mass * Math.sin(pitch) - previousVerticalSpeed * flight.horizontalSpeed / radius - (flight.horizontalSpeed > 0 ? .5 * density * flight.dragArea * flight.horizontalSpeed * flight.horizontalSpeed / mass : 0);
  flight.peakAltitude = Math.max(flight.peakAltitude, flight.altitude);
  flight.peakSpeed = Math.max(flight.peakSpeed, Math.hypot(flight.verticalSpeed, flight.horizontalSpeed));
  flight.peakHorizontalSpeed = Math.max(flight.peakHorizontalSpeed || 0, flight.horizontalSpeed);
  flight.downrange += flight.horizontalSpeed;
  if (flight.altitude >= ORBIT_ALTITUDE && flight.horizontalSpeed >= ORBIT_SPEED && flight.satellite) return 'orbit';
  flight.coasting = thrust == 0 && flight.altitude > 90000;
  if ((flight.altitude <= 0 && flight.time > 2) || flight.time > 5000) return 'land';
  return 'tick';
}

// SCIENCE pays on landing (if recovered, or the telemetered share) or in orbit. Animal payloads make headlines either way.
// Value: the payload's science, scaled by peak altitude against 30 km (20% to 250%) and the airframe's science return.
function scienceReturn(flight, peak, why) {
  const payload = PAYLOADS[flight.payload], spec = flight.spec;
  if (!payload.science) return { rec: false, got: 0 };
  let earned = 0, recovered = false;
  const value = payload.science * (payload.satellite ? 1 : Math.max(.2, Math.min(2.5, peak / 30000))) * spec.sv;
  if (why == 'orbit') earned = value;
  else {
    const recovery = recoverPayload(flight);
    recovered = recovery.recovered;
    log('[RECOVERY] ' + recovery.text, recovered ? 'ok' : recovery.step == 'none' ? 'wn' : 'bad');
    earned = recovered ? value : value * (payload.telemetryShare || 0) * (.4 + .2 * flight.tracking.v);
  }
  if (earned > 0) {
    // Half the value is paid now; 30% becomes the science bonus in every grant, if it beats the current one.
    const cash = Math.round(earned * .5);
    S.b += cash;
    S.pb = Math.max(S.pb, Math.round(earned * .3));
    log(`[SCIENCE] ${recovered || why == 'orbit' ? 'Full data return' : 'Telemetered data only'} from the ${flight.payload}: research contract +${formatMoney(cash)}.`, 'ok');
  } else if (!recovered && why != 'orbit') log(`[SCIENCE] The ${flight.payload} returned no usable data.`, 'wn');
  if (payload.animal) {
    if (recovered) {
      S.rep = Math.min(100, S.rep + 6);
      log('[PRESS] The primate is recovered alive! Headlines across the country.', 'hd');
    } else {
      loseReputation('bio');
      log('[PRESS] The primate was lost. The press and animal-welfare groups are critical.', 'nar');
    }
  }
  return { rec: recovered, got: earned };
}

// THE END OF A FLIGHT: records, money, directives, firsts, incidents, confirmed packages and what the team learns.
// why: the result of step() ('fail', 'orbit', 'land') or 'abort'.
export function endFlight(flight, ok, why) {
  return withProgramme(flight.programme, () => endFlightForProgramme(flight, ok, why));
}
function endFlightForProgramme(flight, ok, why) {
  const tracking = flight.tracking;
  if (S.dev) {
    S.dev.fl++;
    recordRunEvent({ k: 'flight', n: S.dev.fl, af: flight.label, out: why, fail: flight.failure || undefined, peak: Math.round(flight.peakAltitude), spd: Math.round(flight.peakSpeed), dr: Math.round(flight.downrange), fuel: flight.propellant, load: +flight.load.toFixed(2), pay: flight.payload, stg: flight.stages.length, over: flight.overNoGo || undefined, plan: flight.plan ? `${flight.plan.elevation}° ${flight.plan.program}${flight.plan.aim != null ? ` aim ${flight.plan.aim}°` : ''}` : undefined });
  }
  log('=== FLIGHT TERMINATED ===', ok ? 'ok' : 'bad');
  // The peak as the range measured it (half the channel's usual error).
  const altitudeQuality = CHANNELS.alt.quality(tracking.g);
  let peak = Math.max(0, Math.round(flight.peakAltitude * (1 + altitudeQuality.noise / 2 * gaussian()) / altitudeQuality.rounding) * altitudeQuality.rounding);
  if (why == 'fail' || why == 'abort') {
    if (why == 'fail') {
      const lastPlot = flight.lastReadings.alt ? formatAltitude(flight.lastReadings.alt.value, flight.lastReadings.alt.quality) : null;
      log(`T+${flight.time}s | TRACK LOST. Radio carrier lost.${lastPlot ? ' Last plot ' + lastPlot + '.' : ''}`, 'bad');
      if (S.crew.rso) log('[RSO] Destruct command sent. Debris fell inside the range.', 'wn');
      visibleSymptoms(flight.failure, tracking).forEach(symptom => log(`[ANALYSIS] Records indicate ${SYMPTOMS[symptom].text}.`, 'wn'));
      log(`[PRESS] Congressional critics question oversight after the launch anomaly.`, 'nar');
      openIncident(flight, tracking, lastPlot);
      if (flight.overNoGo) {
        loseReputation('known');
        log('[PRESS] Reporters learn the launch went ahead over a NO-GO call.', 'nar');
      }
    } else {
      log('Flight aborted by range safety.', 'bad');
      // Aborting ahead of a failure that was showing its signs: the vehicle was failing, so the engineers still investigate.
      if (flight.pending) {
        flight.failure = flight.pending.mode;
        log(`T+${flight.time}s | Aborted ahead of a failure.`, 'wn');
        visibleSymptoms(flight.failure, tracking).forEach(symptom => log(`[ANALYSIS] Records indicate ${SYMPTOMS[symptom].text}.`, 'wn'));
        openIncident(flight, tracking, null);
      }
    }
    // An abort fires the nose cone clear, so a payload with a recovery system can still come home (rules/recovery.js).
    if (why == 'abort' && PAYLOADS[flight.payload].science) scienceReturn(flight, peak, why);
    else if (PAYLOADS[flight.payload].animal) {
      loseReputation('bio');
      log('[PRESS] The primate was lost with the vehicle. The press is critical.', 'nar');
    }
  } else {
    log(why == 'orbit' ? 'ORBITAL INSERTION SUCCESSFUL! Satellite in stable orbit.' : 'Vehicle impact recorded. Radar track reduced for the report.', 'ok');
    S.ok++;
    S.rep = Math.min(100, S.rep + 1);
    // Records, each as measured: range (a tracking ship measures it to 1 km), speed and altitude.
    const rangeQuality = tracking.g >= 2 ? { noise: .04, rounding: 1000 } : { noise: .12, rounding: 5000 };
    const range = Math.max(0, Math.round(flight.downrange * (1 + rangeQuality.noise / 2 * gaussian()) / rangeQuality.rounding) * rangeQuality.rounding);
    if (range > (S.hd || 0)) {
      S.hd = range;
      log(`[RECORD] New range record: ${rangeQuality.noise >= .05 ? '~' : ''}${(range / 1000).toFixed(range < 1e5 ? 1 : 0)} km downrange.`, 'ok');
    }
    const speedQuality = CHANNELS.vel.quality(tracking.g, tracking.v) || { noise: .15, rounding: 100 };
    const speed = Math.max(0, Math.round(flight.peakSpeed * (1 + speedQuality.noise / 2 * gaussian()) / speedQuality.rounding) * speedQuality.rounding);
    if (speed > (S.hs || 0)) {
      S.hs = speed;
      log(`[RECORD] New speed record: ${speedQuality.noise >= .05 ? '~' : ''}${speed.toLocaleString()} m/s.`, 'ok');
    }
    if (peak > S.hi) {
      S.hi = peak;
      log(`[RECORD] New altitude record: ${formatAltitude(peak, altitudeQuality)}.`, 'ok');
    }
    S.fr[flight.propellant] = (S.fr[flight.propellant] || 0) + 1;
    const rangeData = rangeDataPayment(peak);
    if (rangeData) {
      S.b += rangeData;
      log(`[DOD] Range data contract for the flight: +${formatMoney(rangeData)}.`, 'ok');
    }
    const science = scienceReturn(flight, peak, why);
    // The current directive: reach its altitude, or (the satellite directive) reach orbit. Orbit pays 130%, or 60% if the Soviets got there first.
    const directive = DIRECTIVES[S.dir];
    if (directive && (why == 'orbit' || (peak >= directive.altitudeKm * 1000 && directive.altitudeKm < 120))) {
      const reward = why == 'orbit' ? Math.round(directive.reward * (S.rvd.r_sat ? .6 : 1.3)) : directive.reward;
      S.b += reward;
      S.rep = Math.min(100, S.rep + 10);
      addHistory(`Directive met: ${directive.name}`);
      log(`[DIRECTIVE FULFILLED] ${directive.name}. Reward +${formatMoney(reward)}${why == 'orbit' ? (S.rvd.r_sat ? ' (cut: the Soviets were first)' : ' (bonus: first in orbit)') : ''}.`, 'hd');
      S.dir++;
      if (why == 'orbit') log('[FLASH DISPATCH] AP Wire: a new moon circles the Earth. Scope of this build complete!', 'hd');
    }
    checkFirsts({ ok: true, why, peak, spd: flight.peakSpeed, dr: flight.downrange, pay: flight.payload, rec: science.rec, got: science.got, staged: flight.stages.length > 1 });
  }
  // A flight confirms its packages if it worked, or if it flew at least 40% of its burn before failing.
  if (ok || flight.time >= .4 * flight.burnTime) for (const id of flight.airframe.pk) confirmPackage(id, 'Flight');
  checkBreakthroughs();
  recordBoosterFlight(flight.airframe, ok && why != 'abort');
  learnFromFlight(flight, ok);
  recordCampaignFlight(flight, ok && why != 'abort', peak, !!flight.byDirector);
  revealTraits(flight.programme);
  save();
}

// MERCURY BOOSTERS: one of your airframes flies its normal physics and failure model with a capsule aboard, from liftoff to burnout.
// options.load: the propellant load the mission plan chose (rules/mercury.js boosterPlan), full by default.
export const totalBurnTime = flight => flight.stages.reduce((sum, eachStage) => sum + eachStage.fuel / (eachStage.thrust / (eachStage.isp * GRAVITY)), 0);
// Returns { flight, failure: the mode or null, short: it fell back before burnout, fraction: share of the burn flown, altitude, speed }.
export function boosterRun(airframe, propellantName, stage, options = {}) {
  return withProgramme(programmeOf(airframe), () => boosterRunForProgramme(airframe, propellantName, stage, options));
}
function boosterRunForProgramme(airframe, propellantName, stage, options) {
  const flight = makeFlight(airframe, propellantName, 'Mercury Capsule', stage, options.load || 1, options), burn = totalBurnTime(flight);
  let result;
  // A failure already showing its warning at burnout still strikes.
  do result = step(flight); while ((result == 'tick' || result == 'sep') && (flight.stages[flight.stages.length - 1].fuel > 0 || flight.pending) && flight.time < 2000);
  return { flight, failure: result == 'fail' ? flight.failure : null, short: result == 'land', fraction: Math.min(1, flight.time / Math.max(1, burn)), altitude: flight.altitude, speed: Math.hypot(flight.verticalSpeed, flight.horizontalSpeed) };
}
// A booster failure on a Mercury flight opens an incident like any other flight; a good boost confirms the airframe's packages and adds to the propellant record.
export function boosterFailed(flight) {
  withProgramme(flight.programme, () => {
    openIncident(flight, flight.tracking, null);
    learnFromFlight(flight, false);
    revealTraits(flight.programme);
  });
  S.fr[flight.propellant] = S.fr[flight.propellant] || 0;
}
export function boosterSucceeded(flight) {
  withProgramme(flight.programme, () => {
    S.fr[flight.propellant] = (S.fr[flight.propellant] || 0) + 1;
    learnFromFlight(flight, true);
    for (const id of flight.airframe.pk) if (BY_ID[id] && BY_ID[id].phase != 2) confirmPackage(id, 'Flight');
    checkBreakthroughs();
    revealTraits(flight.programme);
  });
}
