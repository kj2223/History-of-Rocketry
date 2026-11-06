// THE HIDDEN TRUTH OF ONE WAC CORPORAL ROUND. No DOM, no drawing.
// What is really wrong with the round is decided when the round is made, and never shown to the player directly.
// The player meets it only through what they can see: a mark on a weld, a gauge that drifts, a rough trace, the wreck.
// The rocket's own physics (chamber pressure, apogee, the ignition fault pm-11) come from V1's physical layer, unchanged.
import { newStreams, draw, normal } from '../../v1/js/core/rng.js';
import { initPhysical, runTest, sampleAt, discardTrace } from '../../v1/js/rules/physics.js';

// The spots the player can look at in the hangar. fault: the real defect when present; cue: what a careful look shows.
// A real fault shows its cue most of the time; a sound part sometimes shows something that looks like one.
export const SPOTS = {
  'weld-fwd': { name: 'Forward tank weld', fault: 'weld', sound: 'The bead is even all the way round.', cue: 'A hairline of discolouration runs along part of the seam.' },
  'weld-mid': { name: 'Tank girth weld', fault: 'weld', sound: 'Clean, regular ripples in the bead.', cue: 'The bead thins out and there is a pinhole you could miss.' },
  'weld-aft': { name: 'Aft tank weld', fault: 'weld', sound: 'Smooth and bright, ground flush.', cue: 'Spatter and a slight undercut at the edge of the bead.' },
  'fitting': { name: 'Acid feed fitting', fault: 'leak', sound: 'Dry to the touch, safety wire in place.', cue: 'A faint green stain under the union nut.' },
  'pressure': { name: 'Helium pressurisation line', fault: 'leak', sound: 'Tight, no hiss with the line charged.', cue: 'You think you hear a faint hiss, but the hangar is noisy.' },
  'fins': { name: 'Fin attachment', fault: null, sound: 'Rivets tight, fins true.', cue: 'One fin looks a degree off true by eye.' },
};
const CUE_IF_FAULT = 0.8, CUE_IF_SOUND = 0.2;
// A day's work: fixing a real fault the player flagged, or chasing a false alarm.
export const FIX_HOURS = 2, FALSE_ALARM_HOURS = 3;
// A tank weld that is never found lets go under load in flight this often; a leak that is flown has this chance of stopping the burn.
export const WELD_FAILURE = 0.45, LEAK_FAILURE = 0.6;

// A new round. seed: a whole number; the same seed always makes the same round.
export function newRound(seed) {
  const rng = newStreams(seed);
  const phys = draw(rng.physical);
  // Each round has at most one bad weld and at most one leak, and about half of rounds have the ignition fault.
  const faults = {};
  if (phys < 0.55) faults[['weld-fwd', 'weld-mid', 'weld-aft'][Math.floor(draw(rng.physical) * 3)]] = 'weld';
  if (draw(rng.physical) < 0.45) faults[['fitting', 'pressure'][Math.floor(draw(rng.physical) * 2)]] = 'leak';
  const igniterFault = draw(rng.physical) < 0.5;
  const physical = { ...initPhysical(), latentMechanisms: igniterFault ? ['pm-11'] : [] };
  // V1's worked-case defect belongs to the Aerobee and never touches a WAC round.
  physical.trueDefectMechanism = 'pm-07';
  const cues = Object.fromEntries(Object.keys(SPOTS).map(id => [id, draw(rng.observation) < (faults[id] ? CUE_IF_FAULT : CUE_IF_SOUND)]));
  return {
    seed, rng, physical, faults, cues,
    igniter: 'wac-upper/r1', // becomes r3 (reworked igniter) if the player asks for it
    propellantLoad: 1,
    events: [], // what happened, for the debrief
  };
}

export const spotLooksBad = (round, id) => round.cues[id];
export const faultAt = (round, id) => round.faults[id] || null;
export const hasLeak = round => Object.values(round.faults).includes('leak');
export const hasWeldFault = round => Object.values(round.faults).includes('weld');
export const hasIgniterFault = round => round.physical.latentMechanisms.includes('pm-11') && round.igniter === 'wac-upper/r1';

// The player flags spots for the crew. Real faults are fixed; false alarms cost time. Returns the hours the crew spends.
export function flagSpots(round, ids) {
  let hours = 0;
  for (const id of ids) {
    if (round.faults[id]) { round.events.push(`You flagged the ${SPOTS[id].name.toLowerCase()}: the crew found a real ${round.faults[id] === 'weld' ? 'weld flaw' : 'leak'} and fixed it.`); delete round.faults[id]; hours += FIX_HOURS; }
    else { round.events.push(`You flagged the ${SPOTS[id].name.toLowerCase()}: nothing wrong with it.`); hours += FALSE_ALARM_HOURS; }
  }
  return hours;
}

// The player's drawing-board choice: the share of a full propellant load (0.85 to 1). More propellant, higher flight.
// The estimate the player sees is the drawing office's figure with its honest spread, not the truth.
export const apogeeEstimate = load => { const mid = 70 * (0.55 + 0.45 * load) ** 2; return { low: Math.round(mid * 0.8), high: Math.round(mid * 1.15) }; };

const stages = round => ({ 'tiny-tim': 'tiny-tim/r1', 'wac-upper': round.igniter });

// A short static firing of the upper stage on the stand. Returns the chamber-pressure trace the player sees:
// [{ t, pc, tank }] every 0.1 s over 8 s, with gauge noise, a rough start if the ignition fault is there and a falling tank
// pressure if the round leaks.
export function staticFire(round) {
  runTest(round, 'stand', { kind: 'ground', vehicle: 'wac', stage: 'wac-upper', stages: stages(round), conditions: { burn: 'short' } });
  const steady = sampleAt(round, 'stand', 0).value;
  discardTrace(round, 'stand');
  const obs = round.rng.observation, rough = Math.max(0, 20 - steady) / 5, leak = hasLeak(round);
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
  if (id) { delete round.faults[id]; round.events.push(`A leak check found the leak at the ${SPOTS[id].name.toLowerCase()} and fixed it.`); return { found: SPOTS[id].name, hours: LEAK_CHECK_HOURS + FIX_HOURS }; }
  round.events.push('A leak check found nothing.');
  return { found: null, hours: LEAK_CHECK_HOURS };
}

// Ask for the igniter rework (V1's revision wac-upper/r3, which removes the ignition fault).
export function reworkIgniter(round) {
  round.events.push(hasIgniterFault(round) ? 'The igniter was reworked: the old one had a real hang-fire fault.' : 'The igniter was reworked, though the old one was sound.');
  round.igniter = 'wac-upper/r3';
}

// The tank pressure the blockhouse gauge shows at count second s: steady, or bleeding off if the round leaks.
export const tankGauge = (round, s) => 23 - (hasLeak(round) ? Math.min(6, s * 0.012) : 0) + 0.12 * normal(round.rng.observation);

// THE FLIGHT. Decided in full at liftoff: { apogee km, range km, failure: null | 'ignition' | 'weld' | 'leak', failAt s, path }.
// path: [{ t, x, h }] in km, one point a second, for the tracking board.
export function fly(round) {
  runTest(round, 'flight', { kind: 'flight', vehicle: 'wac', stages: stages(round), conditions: { burn: 'long' } });
  const byQuantity = Object.fromEntries([0, 1, 2].map(i => { const s = sampleAt(round, 'flight', i); return [s.quantity, s.value]; }));
  discardTrace(round, 'flight');
  let apogee = byQuantity['vehicle.apogee'] * (0.55 + 0.45 * round.propellantLoad) ** 2, failure = null, failAt = null;
  const ph = round.rng.physical;
  if (apogee < 40) { failure = 'ignition'; failAt = 2; }
  else if (hasWeldFault(round) && draw(ph) < WELD_FAILURE) { failure = 'weld'; failAt = 14; apogee *= 0.12; }
  else if (hasLeak(round) && draw(ph) < LEAK_FAILURE) { failure = 'leak'; failAt = 24; apogee *= 0.35; }
  const deviation = byQuantity['vehicle.deviation'];
  // A ballistic arc to the apogee: burn for the first part, coast up and fall, tilted by the deviation (degrees off vertical,
  // plus the tower's 3 degrees of tilt downrange).
  const g = 0.00981, tilt = (3 + deviation) * Math.PI / 180;
  const burn = failure ? failAt : 45, hBurn = Math.min(apogee * 0.38, burn * apogee * 0.0085);
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
  return result;
}

// What the recovery party finds at the impact point: the evidence, in the words of someone kneeling by the wreck.
export function wreckage(round) {
  const f = round.flight.failure;
  if (f === 'ignition') return ['The upper stage came down close in, nearly whole.', 'The injector face is streaked with unburnt propellant.', 'The igniter housing is scorched on one side only.'];
  if (f === 'weld') return ['Pieces are spread over a long strip of the range.', 'The propellant tank is torn open along a weld seam, the edges peeled outward.', 'The motor itself looks undamaged.'];
  if (f === 'leak') return ['The round came down short of the planned impact.', 'Green acid staining runs back from the feed fitting along the skin.', 'The motor shows a clean burn that simply stopped.'];
  return ['The round dug itself a crater well downrange.', 'The motor nozzle shows an even burn all the way round.', 'Nothing unusual on what is left of the tank.'];
}

// The explanations the player can put forward at the review, and whether each one matches the truth.
export const EXPLANATIONS = {
  nominal: 'The round flew as planned. Nothing to fix.',
  ignition: 'A rough ignition. The igniter needs reworking.',
  weld: 'A tank weld let go under load.',
  leak: 'A propellant leak starved the motor.',
  unknown: 'Not enough evidence. I want another static firing.',
};
export const explanationIsRight = (round, key) => key === (round.flight.failure || 'nominal');
