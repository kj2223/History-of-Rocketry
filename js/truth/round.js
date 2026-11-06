// THE HIDDEN TRUTH OF ONE ROUND: a WAC Corporal, a captured V-2, or a Bumper (a V-2 with a WAC on its nose). No DOM, no drawing.
// What is really wrong with the round is decided when the round is made, and never shown to the player directly.
// The player meets it only through what they can see: a mark on a weld, a gauge that drifts, a rough trace, the wreck.
// The rocket's own physics (chamber pressure, apogee, the ignition fault pm-11, the V-2 pump fault pm-03) come from the
// physical layer.
import { newStreams, draw, normal } from '../core/rng.js';
import { initPhysical, runTest, sampleAt, discardTrace } from './physics.js';
import { KITS } from '../data/kits.js';
import { SPOTS, EXPLANATIONS } from '../data/wac-round.js';
export { SPOTS, EXPLANATIONS };

const CUE_IF_FAULT = 0.8, CUE_IF_SOUND = 0.2;
// A day's work: fixing a real fault the player flagged, or chasing a false alarm.
export const FIX_HOURS = 2, FALSE_ALARM_HOURS = 3;
// A spot fault that is flown brings the flight down this often.
export const WELD_FAILURE = 0.45, LEAK_FAILURE = 0.6, VANE_FAILURE = 0.5, SEPARATION_FAILURE = 0.6;
const SPOT_FAILURE = { weld: WELD_FAILURE, leak: LEAK_FAILURE, vanes: VANE_FAILURE, separation: SEPARATION_FAILURE };

// How each kind of round flies, and how each cause cuts it short: when (s after liftoff) and what share of the peak is left.
// The order is the order the causes can strike in flight: a V-2 that dies early never tests its upper stage.
const PROFILE = {
  wac: { burn: 45, order: ['ignition', 'weld', 'leak'],
    fail: { ignition: { at: 2, keep: 0.3, dev: 40 }, weld: { at: 14, keep: 0.12 }, leak: { at: 24, keep: 0.35 } } },
  v2: { burn: 65, order: ['turbopump', 'vanes', 'leak'],
    fail: { turbopump: { at: 28, keep: 0.15 }, vanes: { at: 35, keep: 0.12, dev: 25 }, leak: { at: 45, keep: 0.4 } } },
  bumper: { burn: 110, order: ['turbopump', 'vanes', 'separation', 'ignition', 'weld', 'leak'],
    fail: { turbopump: { at: 30, keep: 0.04 }, vanes: { at: 40, keep: 0.05, dev: 25 }, separation: { at: 65, keep: 0.3 },
      ignition: { at: 65, keep: 0.35 }, weld: { at: 75, keep: 0.38 }, leak: { at: 85, keep: 0.6 } } },
};
const MECHANISM_CAUSE = { 'pm-11': 'ignition', 'pm-03': 'turbopump' };
const usesWac = vehicle => vehicle !== 'v2';
const usesV2 = vehicle => vehicle !== 'wac';
export const DEFAULT_PROGRAMME = { igniter: 'wac-upper/r1', turbopump: 'v2/r1', weldRisk: 0.55, leakRisk: 0.45, vaneRisk: 0.4, sepRisk: 0.35 };

// A new round. seed: a whole number; the same seed always makes the same round. programme: how the team builds rounds now
// (world/programme.js): the chance of each fault, and which igniter and pump standard is in use. vehicle: 'wac', 'v2' or 'bumper'.
export function newRound(seed, programme = DEFAULT_PROGRAMME, vehicle = 'wac') {
  const p = { ...DEFAULT_PROGRAMME, ...programme };
  const rng = newStreams(seed), spots = KITS[vehicle].spots;
  // Each round has at most one fault of each kind, at one of the spots where it can be. The draws are taken whatever the
  // risks and the vehicle, so a fix never shifts the rest of the round.
  const faults = {};
  const put = (kind, risk, chance, where) => {
    const ids = Object.keys(spots).filter(id => spots[id].fault === kind);
    if (ids.length && chance < risk) faults[ids[Math.floor(where * ids.length)]] = kind;
  };
  const weld = draw(rng.physical), weldAt = draw(rng.physical), leak = draw(rng.physical), leakAt = draw(rng.physical);
  put('weld', p.weldRisk, weld, weldAt);
  put('leak', p.leakRisk, leak, leakAt);
  const igniterFault = draw(rng.physical) < 0.5;
  const vane = draw(rng.physical), vaneAt = draw(rng.physical), sep = draw(rng.physical), sepAt = draw(rng.physical), pumpFault = draw(rng.physical) < 0.5;
  put('vanes', p.vaneRisk, vane, vaneAt);
  put('separation', p.sepRisk, sep, sepAt);
  const latent = [igniterFault && usesWac(vehicle) && 'pm-11', pumpFault && usesV2(vehicle) && 'pm-03'].filter(Boolean);
  const physical = { ...initPhysical(), latentMechanisms: latent };
  // V1's worked-case defect belongs to the Aerobee and never touches these rounds.
  physical.trueDefectMechanism = 'pm-07';
  const cues = Object.fromEntries(Object.keys(spots).map(id => [id, draw(rng.observation) < (faults[id] ? CUE_IF_FAULT : CUE_IF_SOUND)]));
  return {
    seed, rng, physical, faults, cues, vehicle,
    igniter: p.igniter, // r3 (reworked igniter) if it is standard or the player asks for it
    turbopump: p.turbopump, // r2 (refurbished pump and steam generator) likewise
    propellantLoad: 1,
    events: [], // what happened, for the debrief
  };
}

const spotsOf = round => KITS[round.vehicle || 'wac'].spots;
export const spotLooksBad = (round, id) => round.cues[id];
export const faultAt = (round, id) => round.faults[id] || null;
export const hasLeak = round => Object.values(round.faults).includes('leak');
export const hasWeldFault = round => Object.values(round.faults).includes('weld');
export const hasIgniterFault = round => round.physical.latentMechanisms.includes('pm-11') && round.igniter === 'wac-upper/r1';
export const hasPumpFault = round => round.physical.latentMechanisms.includes('pm-03') && round.turbopump === 'v2/r1';
// The faults the round really has right now, by cause.
export const causesPresent = round => [...new Set(Object.values(round.faults))].concat(hasIgniterFault(round) ? ['ignition'] : [], hasPumpFault(round) ? ['turbopump'] : []);

const FOUND = { weld: 'weld flaw', leak: 'leak', vanes: 'cracked vane', separation: 'bad firing lead' };
// The player flags spots for the crew. Real faults are fixed; false alarms cost time. Returns the hours the crew spends.
export function flagSpots(round, ids) {
  const spots = spotsOf(round);
  let hours = 0;
  for (const id of ids) {
    if (round.faults[id]) { round.events.push(`You flagged the ${spots[id].name.toLowerCase()}: the crew found a real ${FOUND[round.faults[id]]} and fixed it.`); delete round.faults[id]; hours += FIX_HOURS; }
    else { round.events.push(`You flagged the ${spots[id].name.toLowerCase()}: nothing wrong with it.`); hours += FALSE_ALARM_HOURS; }
  }
  return hours;
}

// The player's drawing-board choice is the share of a full propellant load (0.85 to 1): more propellant, higher flight.
// The estimate they see comes from the drawing office and the flights so far (world/programme.js), never from here.

const stages = round => round.vehicle === 'v2' ? { v2: round.turbopump }
  : round.vehicle === 'bumper' ? { v2: round.turbopump, 'wac-upper': round.igniter }
  : { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': round.igniter };
// The stage that goes on the stand: the WAC's upper stage, or the V-2 (alone, or the lower stage of a Bumper).
const standStage = round => (usesV2(round.vehicle || 'wac') ? 'v2' : 'wac-upper');
const NOMINAL_PC = { 'wac-upper': 20, v2: 15.5 };

// A short static firing on the stand. Returns the chamber-pressure trace the player sees: [{ t, pc, tank }] every 0.1 s
// over 8 s, with gauge noise, a rough, low start if the stage has a start-up fault, and a falling tank pressure if the
// round leaks.
export function staticFire(round) {
  const stage = standStage(round);
  runTest(round, 'stand', { kind: 'ground', vehicle: round.vehicle || 'wac', stage, stages: stages(round), conditions: { burn: 'short' } });
  const steady = sampleAt(round, 'stand', 0).value;
  discardTrace(round, 'stand');
  const obs = round.rng.observation, rough = Math.max(0, NOMINAL_PC[stage] - 0.5 - steady) / 4, leak = hasLeak(round);
  const trace = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 10, rise = Math.min(1, t / 0.6);
    const chug = rough * (t < 3 ? 4 * Math.sin(t * 23) * Math.exp(-t / 2.5) : 0.6 * Math.sin(t * 17));
    trace.push({ t, pc: Math.max(0, steady * rise + chug + 0.35 * normal(obs)), tank: 23 - (leak ? t * 0.45 : 0) + 0.15 * normal(obs) });
  }
  return { trace, steady };
}

// The crew leak-checks the feed and pressurisation system. Finds and fixes a leak if there is one. Returns the hours it takes.
export const LEAK_CHECK_HOURS = 2;
export function leakCheck(round) {
  const id = Object.keys(round.faults).find(k => round.faults[k] === 'leak');
  if (id) { const name = spotsOf(round)[id].name; delete round.faults[id]; round.events.push(`A leak check found the leak at the ${name.toLowerCase()} and fixed it.`); return { found: name, hours: LEAK_CHECK_HOURS + FIX_HOURS }; }
  round.events.push('A leak check found nothing.');
  return { found: null, hours: LEAK_CHECK_HOURS };
}

// Ask for the igniter rework (revision wac-upper/r3, which removes the ignition fault).
export function reworkIgniter(round) {
  round.events.push(hasIgniterFault(round) ? 'The igniter was reworked: the old one had a real hang-fire fault.' : 'The igniter was reworked, though the old one was sound.');
  round.igniter = 'wac-upper/r3';
}
// Ask for the V-2 turbopump and steam generator to be refurbished (revision v2/r2, which removes the pump fault).
export function refurbishPump(round) {
  round.events.push(hasPumpFault(round) ? 'The turbopump and steam generator were refurbished: the old ones were really worn.' : 'The turbopump and steam generator were refurbished, though they were sound.');
  round.turbopump = 'v2/r2';
}
// The stand's rework for this round: the WAC's igniter, or the V-2's pump.
export const standRework = round => (standStage(round) === 'v2' ? refurbishPump(round) : reworkIgniter(round));

// The tank pressure the blockhouse gauge shows at count second s: steady, or bleeding off if the round leaks.
export const tankGauge = (round, s) => 23 - (hasLeak(round) ? Math.min(6, s * 0.012) : 0) + 0.12 * normal(round.rng.observation);

// THE FLIGHT. Decided in full at liftoff: { apogee km, range km, failure: null | cause, failAt s, path, radar }.
// path: [{ t, x, h }] in km, one point a second, for the tracking board.
export function fly(round) {
  const vehicle = round.vehicle || 'wac', profile = PROFILE[vehicle];
  runTest(round, 'flight', { kind: 'flight', vehicle, stages: stages(round), conditions: { burn: 'long' } });
  const n = round.physical.traces.flight.length;
  const byQuantity = Object.fromEntries([...Array(n).keys()].map(i => { const s = sampleAt(round, 'flight', i); return [s.quantity, s.value]; }));
  discardTrace(round, 'flight');
  const culprit = MECHANISM_CAUSE[round.physical.culprit] || null;
  // The physical layer's generic loss is undone here: the profile below says how this cause cuts this vehicle's flight short.
  let apogee = byQuantity['vehicle.apogee'] / (culprit ? 0.3 : 1) * (0.55 + 0.45 * round.propellantLoad) ** 2;
  let deviation = byQuantity['vehicle.deviation'] - (culprit ? 40 : 0);
  const ph = round.rng.physical, present = new Set(Object.values(round.faults));
  let failure = null;
  for (const cause of profile.order) {
    if (cause === culprit) { failure = cause; break; }
    if (SPOT_FAILURE[cause] && present.has(cause) && draw(ph) < SPOT_FAILURE[cause]) { failure = cause; break; }
  }
  const cut = failure ? profile.fail[failure] : null, failAt = cut ? cut.at : null;
  if (cut) { apogee *= cut.keep; deviation += cut.dev || 0; }
  // A ballistic arc to the apogee: burn for the first part, coast up and fall, tilted by the deviation (degrees off vertical,
  // plus the tower's 3 degrees of tilt downrange).
  const g = 0.00981, tilt = (3 + deviation) * Math.PI / 180;
  const burn = failure ? failAt : profile.burn, hBurn = Math.min(apogee * 0.38, burn * apogee * 0.0085);
  const vUp = Math.sqrt(2 * g * Math.max(0.01, apogee - hBurn)), vDown = vUp * Math.tan(tilt);
  const path = [];
  let t = 0, h = 0, x = 0;
  for (; t <= burn; t++) { const f = t / burn; h = hBurn * f * f; x = hBurn * Math.tan(tilt) * f * f; path.push({ t, x, h }); }
  const t0 = burn, h0 = h, x0 = x;
  for (t = burn + 1; ; t++) {
    const dt = t - t0; h = h0 + vUp * dt - 0.5 * g * dt * dt; x = x0 + vDown * dt;
    if (h <= 0) { path.push({ t, x, h: 0 }); break; }
    path.push({ t, x, h });
  }
  const result = { apogee: Math.max(...path.map(p => p.h)), range: path[path.length - 1].x, failure, failAt, burn, path };
  round.flight = result;
  // The radar plot is what anyone on the range actually knows of the peak: the call on the net and the write-up both use it.
  result.radar = radarApogee(round);
  return result;
}

// What the recovery party finds at the impact point: the evidence, in the words of someone kneeling by the wreck.
export const wreckage = round => KITS[round.vehicle || 'wac'].wreck[round.flight.failure || 'nominal'];

// What the range's radar reports for a good flight's peak: the true apogee with a little tracking error.
export const radarApogee = round => round.flight.apogee * (1 + 0.03 * normal(round.rng.observation));

// How Ellis reads the evidence at the review. The wreck is clear most of the time; when it is not, she settles on
// another cause this kind of round can have. Two draws whatever happens, so the round's later draws do not depend on her.
export function ellisReading(round) {
  const truth = round.flight.failure || 'nominal';
  const clear = draw(round.rng.observation), pick = draw(round.rng.observation);
  if (clear < 0.8) return truth;
  const others = Object.keys(KITS[round.vehicle || 'wac'].explanations).filter(c => c !== truth && c !== 'unknown');
  return others[Math.floor(pick * others.length)];
}

export const explanationIsRight = (round, key) => key === (round.flight.failure || 'nominal');
