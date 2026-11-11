// THE HIDDEN TRUTH OF ONE ROUND: a WAC Corporal, a captured V-2, or a Bumper (a V-2 with a WAC on its nose). No DOM, no drawing.
// What is really wrong with the round is decided when the round is made, and never shown to the player directly.
// The player meets it only through what they can see: a mark on a weld, a gauge that drifts, a rough trace, the wreck.
// The rocket's own physics (chamber pressure, apogee, the ignition fault pm-11, the V-2 pump fault pm-03) come from the
// physical layer.
import { newStreams, draw, normal } from '../core/rng.js';
import { initPhysical, runTest, sampleAt, discardTrace } from './physics.js';
import { KITS } from '../data/kits.js';
import { injection } from './lunar.js';
import { SPOTS, EXPLANATIONS } from '../data/wac-round.js';
export { SPOTS, EXPLANATIONS };

const CUE_IF_FAULT = 0.8,
  CUE_IF_SOUND = 0.2;
// A day's work: fixing a real fault the player flagged, or chasing a false alarm.
export const FIX_HOURS = 2,
  FALSE_ALARM_HOURS = 3;
// A spot fault that is flown brings the flight down this often.
export const WELD_FAILURE = 0.45,
  LEAK_FAILURE = 0.6,
  VANE_FAILURE = 0.5,
  SEPARATION_FAILURE = 0.6;
// A Viking with a cracked fin attachment loses it to the airloads this often (Viking 6, December 1950).
export const FIN_FAILURE = 0.5;
// A Ranger whose camera supply arcs over in vacuum sends no pictures (Ranger 6, February 1964).
export const CAMERA_FAILURE = 0.6;
// Hold-down fittings with a flaw let go under a full-duration firing's thrust this often (Viking 8, June 1952).
export const HOLDDOWN_FAILURE = 0.7;
const SPOT_FAILURE = {
  weld: WELD_FAILURE,
  leak: LEAK_FAILURE,
  vanes: VANE_FAILURE,
  separation: SEPARATION_FAILURE,
  fin: FIN_FAILURE,
};
// (A Ranger's camera supply is decided at the Moon, when the cameras are switched on: truth/lunar.js.)

// How each kind of round flies, and how each cause cuts it short: when (s after liftoff) and what share of the peak is left.
// The order is the order the causes can strike in flight: a V-2 that dies early never tests its upper stage.
const PROFILE = {
  wac: {
    burn: 45,
    order: ['ignition', 'weld', 'leak'],
    fail: { ignition: { at: 2, keep: 0.3, dev: 40 }, weld: { at: 14, keep: 0.12 }, leak: { at: 24, keep: 0.35 } },
  },
  v2: {
    burn: 65,
    order: ['turbopump', 'vanes', 'leak'],
    fail: { turbopump: { at: 28, keep: 0.15 }, vanes: { at: 35, keep: 0.12, dev: 25 }, leak: { at: 45, keep: 0.4 } },
  },
  aerobee: {
    burn: 45,
    order: ['liner', 'weld', 'leak'],
    fail: { liner: { at: 31, keep: 0.35 }, weld: { at: 12, keep: 0.1 }, leak: { at: 25, keep: 0.35 } },
  },
  viking: {
    burn: 75,
    order: ['cutoff', 'fin', 'leak'],
    fail: { cutoff: { at: 42, keep: 0.33 }, fin: { at: 30, keep: 0.3, dev: 20 }, leak: { at: 55, keep: 0.5 } },
  },
  // A good Vanguard does not come down: fly() puts it in orbit. The first stage burns for 145 s.
  vanguard: {
    burn: 145,
    order: ['injector', 'leak', 'separation'],
    fail: { injector: { at: 2, keep: 0.0008 }, leak: { at: 60, keep: 0.12 }, separation: { at: 145, keep: 0.35 } },
  },
  // The lunar shots. One that gets away leaves the range plot on its way to the Moon (fly() hands it to launchProbe(), and
  // truth/lunar.js takes over for the cruise and the encounter). An Agena that will not restart is stranded (deep()).
  juno: {
    burn: 180,
    order: ['leak', 'depletion', 'separation'],
    deep: ['depletion'],
    fail: { leak: { at: 60, keep: 0.001 }, depletion: { at: 176, keep: 1 }, separation: { at: 180, keep: 0.005 } },
  },
  ranger: {
    burn: 300,
    order: ['leak', 'agena', 'camera'],
    deep: ['agena', 'camera'],
    fail: { leak: { at: 80, keep: 0.0012 }, agena: { at: 600, keep: 1 }, camera: { at: 900, keep: 1 } },
  },
  bumper: {
    burn: 110,
    order: ['turbopump', 'vanes', 'separation', 'ignition', 'weld', 'leak'],
    fail: {
      turbopump: { at: 30, keep: 0.04 },
      vanes: { at: 40, keep: 0.05, dev: 25 },
      separation: { at: 65, keep: 0.3 },
      ignition: { at: 65, keep: 0.35 },
      weld: { at: 75, keep: 0.38 },
      leak: { at: 85, keep: 0.6 },
    },
  },
};
const MECHANISM_CAUSE = {
  'pm-11': 'ignition',
  'pm-03': 'turbopump',
  'pm-07': 'liner',
  'pm-19': 'cutoff',
  'pm-23': 'injector',
  'pm-29': 'depletion',
  'pm-31': 'agena',
};
// Some faults leave nothing to find: old hardware, a part that passed every test and failed anyway. However carefully a round
// is looked over, it is lost this often, about as often as the real rounds were lost to causes nobody could have caught.
// The early lunar shots failed more often than not: Rangers 1 to 6 all failed.
export const HIDDEN_FAILURE = {
  wac: 0.12,
  v2: 0.3,
  bumper: 0.3,
  aerobee: 0.15,
  viking: 0.15,
  vanguard: 0.3,
  juno: 0.3,
  ranger: 0.35,
};
const usesWac = vehicle => vehicle === 'wac' || vehicle === 'bumper';
const usesV2 = vehicle => vehicle === 'v2' || vehicle === 'bumper';
export const DEFAULT_PROGRAMME = {
  igniter: 'wac-upper/r1',
  turbopump: 'v2/r1',
  sustainer: 'aerobee-sustainer/r1',
  viking: 'viking/r1',
  vanguard: 'vanguard-1/r1',
  juno: 'jupiter/r1',
  ranger: 'agena/r1',
  cameraRisk: 0.4,
  plugRisk: 0.5,
  controlRisk: 0.15,
  loxRisk: 0.15,
  thrustRisk: 0.3,
  guidanceRisk: 0.1,
  shortburnRisk: 0.1,
  shieldRisk: 0.12,
  scannerRisk: 0.25,
  titanctlRisk: 0.08,
  stage2Risk: 0.08,
  fuelcellRisk: 0.2,
  hatchRisk: 0.2,
  computerRisk: 0.15,
  navRisk: 0.1,
  shutdownRisk: 0.05,
  thrusterRisk: 0.08,
  saturnctlRisk: 0.05,
  j2Risk: 0.3,
  pogoRisk: 0.5,
  relightRisk: 0.25,
  spsRisk: 0.05,
  tankRisk: 0.05,
  cabinRisk: 0.15,
  alarmRisk: 0.4,
  ascentRisk: 0.08,
  chuteRisk: 0.1,
  lightningRisk: 0.08,
  // Apollo 16's throttle flutter at the low gate: the engine holds, but the needle will not sit still.
  throttleRisk: 0.25,
  h1Risk: 0.2,
  oringRisk: 0.15,
  foamRisk: 0.3,
  ssmeRisk: 0.1,
  // How often a faulty booster joint actually burns through in flight: cold raises it, and a hold that warms the day lowers it.
  boostRisk: 0.55,
  merlinRisk: 0.15,
  abortRisk: 0.08,
  weldRisk: 0.55,
  finRisk: 0.35,
  holddownRisk: 0.3,
  leakRisk: 0.45,
  vaneRisk: 0.4,
  sepRisk: 0.35,
};

// A new round. seed: a whole number; the same seed always makes the same round. programme: how the team builds rounds now
// (world/programme.js): the chance of each fault, and which igniter and pump standard is in use. vehicle: 'wac', 'v2' or 'bumper'.
export function newRound(seed, programme = DEFAULT_PROGRAMME, vehicle = 'wac') {
  const p = { ...DEFAULT_PROGRAMME, ...programme };
  const rng = newStreams(seed),
    spots = KITS[vehicle].spots;
  // Each round has at most one fault of each kind, at one of the spots where it can be. The draws are taken whatever the
  // risks and the vehicle, so a fix never shifts the rest of the round.
  const faults = {};
  // A cause that brought down a round from the same production lot, and was never fixed, is likelier again
  // (world/programme.js: batch). Only the thresholds move, never the draws.
  const lot = cause => p.lotVehicle === vehicle && !!p.batch?.[cause];
  const put = (kind, risk, chance, where) => {
    const ids = Object.keys(spots).filter(id => spots[id].fault === kind);
    const r = lot(kind) ? Math.min(0.9, risk * 1.6) : risk;
    if (ids.length && chance < r) faults[ids[Math.floor(where * ids.length)]] = kind;
  };
  const latentChance = cause => (lot(cause) ? 0.8 : 0.5);
  const weld = draw(rng.physical),
    weldAt = draw(rng.physical),
    leak = draw(rng.physical),
    leakAt = draw(rng.physical);
  put('weld', p.weldRisk, weld, weldAt);
  put('leak', p.leakRisk, leak, leakAt);
  const igniterFault = draw(rng.physical) < latentChance('ignition');
  const vane = draw(rng.physical),
    vaneAt = draw(rng.physical),
    sep = draw(rng.physical),
    sepAt = draw(rng.physical),
    pumpFault = draw(rng.physical) < latentChance('turbopump');
  const linerFault = draw(rng.physical) < latentChance('liner');
  const fin = draw(rng.physical),
    finAt = draw(rng.physical),
    hold = draw(rng.physical),
    holdAt = draw(rng.physical),
    turbineFault = draw(rng.physical) < latentChance('cutoff');
  put('fin', p.finRisk, fin, finAt);
  put('holddown', p.holddownRisk, hold, holdAt);
  put('vanes', p.vaneRisk, vane, vaneAt);
  put('separation', p.sepRisk, sep, sepAt);
  // Vanguard's injector draw is taken only on a Vanguard round, after the others, so the earlier rounds are unchanged.
  const injectorFault = vehicle === 'vanguard' && draw(rng.physical) < latentChance('injector');
  // Likewise the lunar shots' own draws, taken only on their rounds.
  const depletionFault = vehicle === 'juno' && draw(rng.physical) < latentChance('depletion');
  const agenaFault = vehicle === 'ranger' && draw(rng.physical) < latentChance('agena');
  if (vehicle === 'ranger') {
    const cam = draw(rng.physical),
      camAt = draw(rng.physical);
    put('camera', p.cameraRisk, cam, camAt);
  }
  // The Mercury-Redstone's own draws, taken only on its rounds: the tail plug, the autopilot, the oxygen valve, and the
  // thrust controller (no spot: nothing on the pad shows it).
  let thrust = false;
  if (vehicle === 'redstone') {
    const d = [...Array(7)].map(() => draw(rng.physical));
    put('plug', p.plugRisk, d[0], d[1]);
    put('control', p.controlRisk, d[2], d[3]);
    put('lox', p.loxRisk, d[4], d[5]);
    thrust = d[6] < p.thrustRisk;
  }
  // The Mercury-Atlas's own: the Atlas's guidance and sustainer, the capsule's heat shield and horizon scanner.
  if (vehicle === 'atlas') {
    const d = [...Array(8)].map(() => draw(rng.physical));
    put('guidance', p.guidanceRisk, d[0], d[1]);
    put('shortburn', p.shortburnRisk, d[2], d[3]);
    put('shield', p.shieldRisk, d[4], d[5]);
    put('scanner', p.scannerRisk, d[6], d[7]);
  }
  // Gemini's: the Titan's guidance and second stage, the spacecraft's fuel cells, hatch and computer, and a wrong number
  // from the ground (no spot: nothing in the spacecraft shows it).
  let navdata = false,
    dustcap = false;
  if (vehicle === 'titan') {
    const d = [...Array(16)].map(() => draw(rng.physical));
    put('titanctl', p.titanctlRisk, d[0], d[1]);
    put('stage2', p.stage2Risk, d[2], d[3]);
    put('fuelcell', p.fuelcellRisk, d[4], d[5]);
    put('hatch', p.hatchRisk, d[6], d[7]);
    put('computer', p.computerRisk, d[8], d[9]);
    navdata = d[10] < p.navRisk;
    // Gemini 6's pad shutdown (a tail plug that drops out early, and sometimes a second cause behind it) and Gemini 8's
    // thruster that sticks open.
    put('shutdown', p.shutdownRisk, d[11], d[12]);
    put('thruster', p.thrusterRisk, d[13], d[14]);
    dustcap = d[15] < 0.5;
  }
  // Apollo's: the Saturn V's stages and guidance, the spacecraft's engine, tanks, wiring and parachutes, the lander's
  // computer and ascent engine, and the weather at the pad (no spot: lightning).
  let lightning = false,
    throttle = false;
  // The Saturn IB's own draws, taken only on its rounds: the H-1 turbopumps, the instrument unit, the service engine,
  // the cabin wiring and the parachutes.
  if (vehicle === 'saturnib') {
    const d = [...Array(10)].map(() => draw(rng.physical));
    ['h1', 'saturnctl', 'sps', 'cabin', 'chute'].forEach((k, i) => put(k, p[`${k}Risk`], d[2 * i], d[2 * i + 1]));
  }
  // The Shuttle's own draws, taken only on its rounds: the booster joint, the main engines, the tank's foam, the fuel
  // cells, the computers and the cabin wiring.
  if (vehicle === 'shuttle') {
    const d = [...Array(12)].map(() => draw(rng.physical));
    ['oring', 'ssme', 'foam', 'fuelcell', 'computer', 'cabin'].forEach((k, i) =>
      put(k, p[`${k}Risk`], d[2 * i], d[2 * i + 1]),
    );
  }
  // Dragon's own draws, taken only on its rounds: the first-stage engines, the escape thrusters, the docking system
  // (the computers) and the parachutes.
  if (vehicle === 'dragon') {
    const d = [...Array(8)].map(() => draw(rng.physical));
    ['merlin', 'abort', 'computer', 'chute'].forEach((k, i) => put(k, p[`${k}Risk`], d[2 * i], d[2 * i + 1]));
  }
  // SLS reuses the Shuttle's kinds for her engines and boosters, and Apollo's for the upper stage, Orion and the
  // parachutes. Her draws are her own.
  if (vehicle === 'sls') {
    const d = [...Array(10)].map(() => draw(rng.physical));
    ['ssme', 'oring', 'relight', 'sps', 'chute'].forEach((k, i) => put(k, p[`${k}Risk`], d[2 * i], d[2 * i + 1]));
  }
  if (vehicle === 'saturn5') {
    const d = [...Array(22)].map(() => draw(rng.physical));
    ['saturnctl', 'j2', 'pogo', 'relight', 'sps', 'tank', 'cabin', 'alarm', 'ascent', 'chute'].forEach((k, i) =>
      put(k, p[`${k}Risk`], d[2 * i], d[2 * i + 1]),
    );
    lightning = d[20] < p.lightningRisk;
    // Apollo 16's own draw, taken after the others so no earlier Saturn V round changes: the descent engine's throttle
    // fluttering through the low gate.
    throttle = draw(rng.physical) < p.throttleRisk;
  }
  const latent = [
    igniterFault && usesWac(vehicle) && 'pm-11',
    pumpFault && usesV2(vehicle) && 'pm-03',
    linerFault && vehicle === 'aerobee' && 'pm-07',
    turbineFault && vehicle === 'viking' && 'pm-19',
    injectorFault && 'pm-23',
    depletionFault && 'pm-29',
    agenaFault && 'pm-31',
  ].filter(Boolean);
  // V1's worked-case defect, the Aerobee's debonding liner (pm-07), is a latent fault like the others: some sustainers have it.
  const physical = { ...initPhysical(), latentMechanisms: latent, trueDefectMechanism: null };
  const cues = Object.fromEntries(
    Object.keys(spots).map(id => [id, draw(rng.observation) < (faults[id] ? CUE_IF_FAULT : CUE_IF_SOUND)]),
  );
  return {
    seed,
    rng,
    physical,
    faults,
    cues,
    vehicle,
    igniter: p.igniter, // r3 (reworked igniter) if it is standard or the player asks for it
    turbopump: p.turbopump, // r2 (refurbished pump and steam generator) likewise
    sustainer: p.sustainer, // the Aerobee's: r2 has the rebonded liner
    viking: p.viking, // the Viking's: r2 has the welded turbine casing and reworked steam feed
    vanguard: p.vanguard, // Vanguard's first stage: r2 has the reworked injector
    juno: p.juno, // Juno II's Jupiter: r2 has the recalibrated propellant utilisation
    ranger: p.ranger, // Ranger's Agena: r2 has the reworked restart system
    propellantLoad: 1,
    adopted: [...(p.adopted ?? [])], // the standing fixes this round is built with (truth/physical.js: FIX_EFFECTS)
    wind: windOf(seed),
    ...(vehicle === 'redstone' ? { thrust } : {}),
    ...(vehicle === 'titan' ? { navdata, dustcap } : {}),
    ...(vehicle === 'saturn5' ? { lightning, throttle } : {}),
    ...(vehicle === 'shuttle' ? { cold: !!p.cold, boostRisk: p.boostRisk } : {}),
    ...(vehicle === 'sls' ? { boostRisk: p.boostRisk } : {}),
    events: [], // what the crew did and found
  };
}

const spotsOf = round => KITS[round.vehicle || 'wac'].spots;
export const spotLooksBad = (round, id) => round.cues[id];
export const faultAt = (round, id) => round.faults[id] || null;
export const hasLeak = round => Object.values(round.faults).includes('leak');
export const hasWeldFault = round => Object.values(round.faults).includes('weld');
export const hasIgniterFault = round =>
  round.physical.latentMechanisms.includes('pm-11') && round.igniter === 'wac-upper/r1';
export const hasPumpFault = round => round.physical.latentMechanisms.includes('pm-03') && round.turbopump === 'v2/r1';
export const hasTurbineFault = round =>
  round.physical.latentMechanisms.includes('pm-19') && (round.viking || 'viking/r1') === 'viking/r1';
export const hasInjectorFault = round =>
  round.physical.latentMechanisms.includes('pm-23') && (round.vanguard || 'vanguard-1/r1') === 'vanguard-1/r1';
export const hasDepletionFault = round =>
  round.physical.latentMechanisms.includes('pm-29') && (round.juno || 'jupiter/r1') === 'jupiter/r1';
export const hasAgenaFault = round =>
  round.physical.latentMechanisms.includes('pm-31') && (round.ranger || 'agena/r1') === 'agena/r1';
export const hasHolddownFault = round => Object.values(round.faults).includes('holddown');
export const hasLinerFault = round =>
  round.physical.latentMechanisms.includes('pm-07') &&
  (round.sustainer || 'aerobee-sustainer/r1') === 'aerobee-sustainer/r1';

const FOUND = {
  camera: 'arcing camera supply',
  weld: 'weld flaw',
  leak: 'leak',
  vanes: 'cracked vane',
  separation: 'bad firing lead',
  fin: 'cracked fin fitting',
  holddown: 'flawed hold-down fitting',
};
// The player flags spots for the crew. Real faults are fixed; false alarms cost time. Returns the hours the crew spends.
export function flagSpots(round, ids) {
  const spots = spotsOf(round);
  let hours = 0;
  for (const id of ids) {
    if (round.faults[id]) {
      round.events.push(
        `You flagged the ${spots[id].name.toLowerCase()}: the crew found a real ${FOUND[round.faults[id]]} and fixed it.`,
      );
      delete round.faults[id];
      hours += FIX_HOURS;
    } else {
      round.events.push(`You flagged the ${spots[id].name.toLowerCase()}: nothing wrong with it.`);
      hours += FALSE_ALARM_HOURS;
    }
  }
  return hours;
}

// The player's drawing-board choice is the share of a full propellant load (0.85 to 1): more propellant, higher flight.
// The estimate they see comes from the drawing office and the flights so far (world/programme.js), never from here.

const stages = round =>
  round.vehicle === 'v2'
    ? { v2: round.turbopump }
    : round.vehicle === 'viking'
      ? { viking: round.viking || 'viking/r1' }
      : round.vehicle === 'vanguard'
        ? { 'vanguard-1': round.vanguard || 'vanguard-1/r1' }
        : round.vehicle === 'juno'
          ? { jupiter: round.juno || 'jupiter/r1' }
          : round.vehicle === 'ranger'
            ? { agena: round.ranger || 'agena/r1' }
            : round.vehicle === 'aerobee'
              ? {
                  'aerobee-booster': 'aerobee-booster/r1',
                  'aerobee-sustainer': round.sustainer || 'aerobee-sustainer/r1',
                }
              : round.vehicle === 'bumper'
                ? { v2: round.turbopump, 'wac-upper': round.igniter }
                : { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': round.igniter };
// The stage that goes on the stand: the WAC's upper stage, or the V-2 (alone, or the lower stage of a Bumper).
const standStage = round =>
  round.vehicle === 'juno'
    ? 'jupiter'
    : round.vehicle === 'ranger'
      ? 'agena'
      : round.vehicle === 'vanguard'
        ? 'vanguard-1'
        : round.vehicle === 'viking'
          ? 'viking'
          : round.vehicle === 'aerobee'
            ? 'aerobee-sustainer'
            : usesV2(round.vehicle || 'wac')
              ? 'v2'
              : 'wac-upper';
const NOMINAL_PC = {
  'wac-upper': 20,
  v2: 15.5,
  'aerobee-sustainer': 20.5,
  viking: 21,
  'vanguard-1': 21,
  jupiter: 21,
  agena: 20,
};
// Stages whose fault is a late sag on a full-duration firing, not a rough start: when (s) the sag sets in.
const SAG_AT = { viking: 12, jupiter: 20 };

// A static firing on the stand. Returns the trace the player sees: [{ t, pc, tank, wall? }] with gauge noise.
// burn 'short' (8 s): a start-up check. It shows a rough, low start if the stage has a start-up fault, and a falling tank
// pressure if the round leaks. burn 'long' (30 s, Aerobee only): a full-duration firing with thermocouples on the chamber,
// the only firing that shows the liner's wall temperature.
export function staticFire(round, burn = 'short') {
  const stage = standStage(round);
  runTest(round, 'stand', {
    kind: 'ground',
    vehicle: round.vehicle || 'wac',
    stage,
    stages: stages(round),
    conditions: { burn },
  });
  const samples = Object.fromEntries(
    round.physical.traces.stand.map((x, i) => {
      const v = sampleAt(round, 'stand', i);
      return [v.quantity, v.value];
    }),
  );
  discardTrace(round, 'stand');
  const steady = samples[`${stage}.chamber-pressure`],
    wallEnd = samples[`${stage}.wall-temp`];
  const long = burn === 'long',
    sagAt = SAG_AT[stage],
    leak = hasLeak(round);
  // A Viking's turbine fault, or a Jupiter running short, is not a rough start: the chamber runs normally, then sags.
  const obs = round.rng.observation,
    nominal = NOMINAL_PC[stage],
    rough = sagAt ? 0 : Math.max(0, nominal - 0.5 - steady) / 4;
  const pcAt = t =>
    !sagAt ? steady : t < sagAt ? nominal : steady + (nominal - steady) * Math.exp(-(t - sagAt) / 2.5);
  // A flawed hold-down lets go under full thrust: the firing ends with the round leaving the stand. One physical draw.
  const loose = long && hasHolddownFault(round) && draw(round.rng.physical) < HOLDDOWN_FAILURE ? 9 : null;
  const span = loose ?? (long ? 30 : 8),
    step = long ? 0.25 : 0.1;
  const trace = [];
  for (let i = 0; i <= span / step; i++) {
    const t = i * step,
      rise = Math.min(1, t / 0.6);
    const chug = rough * (t < 3 ? 4 * Math.sin(t * 23) * Math.exp(-t / 2.5) : 0.6 * Math.sin(t * 17));
    const point = {
      t,
      pc: Math.max(0, pcAt(t) * rise + chug + 0.35 * normal(obs)),
      tank: 23 - (leak ? Math.min(6, t * 0.45) : 0) + 0.15 * normal(obs),
    };
    if (long && wallEnd != null) point.wall = 300 + (wallEnd - 300) * (1 - Math.exp(-t / 7)) + 4 * normal(obs);
    trace.push(point);
  }
  if (loose)
    round.events.push('The hold-down fittings let go during the full-duration firing, and the round left the stand.');
  return { trace, steady, wall: long && wallEnd != null ? wallEnd : null, loose };
}

// A round that broke loose on the stand flies until the range cuts its engine: low, short, and lost.
export function flyLoose(round) {
  const path = [];
  for (let t = 0; t <= 120; t++) {
    const h = t <= 55 ? 6.5 * Math.sin((Math.min(1, t / 55) * Math.PI) / 2) : Math.max(0, 6.5 - 0.0049 * (t - 55) ** 2);
    path.push({ t, x: t * 0.055, h });
    if (t > 55 && h <= 0) break;
  }
  const result = {
    apogee: Math.max(...path.map(p => p.h)),
    range: path[path.length - 1].x,
    failure: 'holddown',
    failAt: 55,
    burn: 55,
    path,
  };
  round.flight = result;
  result.radar = radarApogee(round);
  return result;
}

// A station's call in a count: GO when its reading is in band, and sometimes GO anyway, from someone who doesn't look
// twice (lazyGo, their own hidden habit). One observation draw.
export const stationCall = (round, inBand, lazyGo) => {
  const d = draw(round.rng.observation);
  return inBand || d < lazyGo;
};

// A crew member looks the round over instead of you, and reports the spots they think look bad. How careful they are is
// their own (world/people.js); what they find depends on what is really there. Observation draws, one per spot.
export function crewInspect(round, { hit, falseAlarm }) {
  return Object.keys(spotsOf(round)).filter(id => draw(round.rng.observation) < (round.faults[id] ? hit : falseAlarm));
}

// The crew leak-checks the feed and pressurisation system. Finds and fixes a leak if there is one. Returns the hours it takes.
export const LEAK_CHECK_HOURS = 2;
export function leakCheck(round) {
  const id = Object.keys(round.faults).find(k => round.faults[k] === 'leak');
  if (id) {
    const name = spotsOf(round)[id].name;
    delete round.faults[id];
    round.events.push(`A leak check found the leak at the ${name.toLowerCase()} and fixed it.`);
    return { found: name, hours: LEAK_CHECK_HOURS + FIX_HOURS };
  }
  round.events.push('A leak check found nothing.');
  return { found: null, hours: LEAK_CHECK_HOURS };
}

// Ask for the igniter rework (revision wac-upper/r3, which removes the ignition fault).
export function reworkIgniter(round) {
  round.events.push(
    hasIgniterFault(round)
      ? 'The igniter was reworked: the old one had a real hang-fire fault.'
      : 'The igniter was reworked, though the old one was sound.',
  );
  round.igniter = 'wac-upper/r3';
}
// Ask for the V-2 turbopump and steam generator to be refurbished (revision v2/r2, which removes the pump fault).
export function refurbishPump(round) {
  round.events.push(
    hasPumpFault(round)
      ? 'The turbopump and steam generator were refurbished: the old ones were really worn.'
      : 'The turbopump and steam generator were refurbished, though they were sound.',
  );
  round.turbopump = 'v2/r2';
}
// Ask for the Aerobee sustainer's chamber liner to be rebonded (revision aerobee-sustainer/r2, which removes the liner fault).
export function rebondLiner(round) {
  round.events.push(
    hasLinerFault(round)
      ? 'The chamber liner was rebonded: the old bond was really failing.'
      : 'The chamber liner was rebonded, though the old bond was sound.',
  );
  round.sustainer = 'aerobee-sustainer/r2';
}
// The stand's rework for this round: the WAC's igniter, the V-2's pump, or the Aerobee's liner.
// Ask for the Viking's turbine casing to be welded up and its steam feed reworked (viking/r2, which removes the cutoff fault).
export function reworkTurbine(round) {
  round.events.push(
    hasTurbineFault(round)
      ? 'The turbine casing was welded up and the steam feed reworked: it really was leaking steam.'
      : 'The turbine casing was welded up and the steam feed reworked, though it was sound.',
  );
  round.viking = 'viking/r2';
}
// Ask for Vanguard's first stage to get the reworked injector (vanguard-1/r2, which removes the injector fault).
export function reworkInjector(round) {
  round.events.push(
    hasInjectorFault(round)
      ? 'The first-stage injector was replaced: the old one really was burning through.'
      : 'The first-stage injector was replaced, though the old one was sound.',
  );
  round.vanguard = 'vanguard-1/r2';
}
// Juno II's Jupiter: recalibrate the propellant utilisation (jupiter/r2). Ranger's Agena: rework the restart system (agena/r2).
export function recalibrateJupiter(round) {
  round.events.push(
    hasDepletionFault(round)
      ? "The Jupiter's propellant utilisation was recalibrated: it really would have run short."
      : "The Jupiter's propellant utilisation was recalibrated, though it was right.",
  );
  round.juno = 'jupiter/r2';
}
export function reworkAgena(round) {
  round.events.push(
    hasAgenaFault(round)
      ? "The Agena's restart system was reworked: it really would not have lit again."
      : "The Agena's restart system was reworked, though it was sound.",
  );
  round.ranger = 'agena/r2';
}
export const standRework = round => {
  const st = standStage(round);
  return st === 'jupiter'
    ? recalibrateJupiter(round)
    : st === 'agena'
      ? reworkAgena(round)
      : st === 'vanguard-1'
        ? reworkInjector(round)
        : st === 'v2'
          ? refurbishPump(round)
          : st === 'aerobee-sustainer'
            ? rebondLiner(round)
            : st === 'viking'
              ? reworkTurbine(round)
              : reworkIgniter(round);
};

// The tank pressure the blockhouse gauge shows at count second s: steady, or bleeding off if the round leaks.
// The needle's flutter depends only on the round and the moment (it changes every few seconds), so the gauge holds still
// when time does, and reading it every frame takes nothing from the round's streams.
export const tankGauge = (round, s) =>
  23 - (hasLeak(round) ? Math.min(6, s * 0.012) : 0) + flutter((round.seed ?? 1) | 0, Math.floor(s / 4));
// The wind on the range for the count: km/h at the tower, and how far it leans the round off the vertical (degrees: a
// rocket weathercocks into the wind as it leaves the tower). Taken from the seed, not the round's streams, so it moves no
// draw. Mostly light; now and then a stiff breeze.
export function windOf(seed) {
  const u = flutter((seed ?? 1) | 0, 7001) / 0.3 + 0.5,
    kmh = Math.round(4 + 36 * u * u);
  return { kmh, lean: kmh * 0.1 };
}
function flutter(seed, step) {
  let h = Math.imul(seed ^ Math.imul(step + 1, 2654435761), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296 - 0.5) * 0.3;
}

// THE FLIGHT. Decided in full at liftoff: { apogee km, range km, failure: null | cause, failAt s, path, radar }.
// path: [{ t, x, h }] in km, one point a second, for the tracking board.
export function fly(round) {
  const vehicle = round.vehicle || 'wac',
    profile = PROFILE[vehicle];
  runTest(round, 'flight', { kind: 'flight', vehicle, stages: stages(round), conditions: { burn: 'long' } });
  const n = round.physical.traces.flight.length;
  const byQuantity = Object.fromEntries(
    [...Array(n).keys()].map(i => {
      const s = sampleAt(round, 'flight', i);
      return [s.quantity, s.value];
    }),
  );
  discardTrace(round, 'flight');
  const culprit = MECHANISM_CAUSE[round.physical.culprit] || null;
  // The physical layer's generic loss is undone here: the profile below says how this cause cuts this vehicle's flight short.
  let apogee = (byQuantity['vehicle.apogee'] / (culprit ? 0.3 : 1)) * (0.55 + 0.45 * round.propellantLoad) ** 2;
  let deviation = byQuantity['vehicle.deviation'] - (culprit ? 40 : 0);
  const ph = round.rng.physical,
    present = new Set(Object.values(round.faults));
  let failure = null;
  for (const cause of profile.order) {
    if (cause === culprit) {
      failure = cause;
      break;
    }
    if (SPOT_FAILURE[cause] && present.has(cause) && draw(ph) < SPOT_FAILURE[cause]) {
      failure = cause;
      break;
    }
  }
  // A fault nobody could have found: two draws whatever happens, the cause one this kind of round can have.
  const hidden = draw(ph),
    which = draw(ph);
  if (!failure && hidden < (HIDDEN_FAILURE[vehicle] || 0)) {
    failure = profile.order[Math.floor(which * profile.order.length)];
    round.hiddenFailure = true;
    round.events.push('Something failed that no inspection could have found.');
  }
  if (!failure && vehicle === 'vanguard') return orbit(round, apogee);
  if (profile.deep && failure === 'agena') return deep(round, apogee, failure);
  if (profile.deep && (!failure || profile.deep.includes(failure))) return launchProbe(round, failure);
  const cut = failure ? profile.fail[failure] : null,
    failAt = cut ? cut.at : null;
  if (cut) {
    apogee *= cut.keep;
    deviation += cut.dev || 0;
  }
  // A ballistic arc to the apogee: burn for the first part, coast up and fall, tilted by the deviation (degrees off vertical,
  // plus the tower's 3 degrees of tilt downrange).
  const g = 0.00981,
    tilt = ((3 + deviation) * Math.PI) / 180;
  const burn = failure ? failAt : profile.burn,
    hBurn = Math.min(apogee * 0.38, burn * apogee * 0.0085);
  const vUp = Math.sqrt(2 * g * Math.max(0.01, apogee - hBurn)),
    vDown = vUp * Math.tan(tilt);
  const path = [];
  let t = 0,
    h = 0,
    x = 0;
  for (; t <= burn; t++) {
    const f = t / burn;
    h = hBurn * f * f;
    x = hBurn * Math.tan(tilt) * f * f;
    path.push({ t, x, h });
  }
  const t0 = burn,
    h0 = h,
    x0 = x;
  for (t = burn + 1; ; t++) {
    const dt = t - t0;
    h = h0 + vUp * dt - 0.5 * g * dt * dt;
    x = x0 + vDown * dt;
    if (h <= 0) {
      path.push({ t, x, h: 0 });
      break;
    }
    path.push({ t, x, h });
  }
  const result = {
    apogee: Math.max(...path.map(p => p.h)),
    range: path[path.length - 1].x,
    failure,
    failAt,
    burn,
    path,
  };
  round.flight = result;
  // The radar plot is what anyone on the range actually knows of the peak: the call on the net and the write-up both use it.
  result.radar = radarApogee(round);
  return result;
}

// A good Vanguard: the third stage puts the sphere in orbit. perigee: the physical layer's figure for the load flown (km).
// The path climbs and bends over until it leaves the range plot, about ten minutes in. The radar figure is the perigee
// Minitrack works out.
function orbit(round, perigee) {
  const apogee = perigee * (5.4 + 0.6 * draw(round.rng.physical)),
    path = [];
  for (let t = 0; t <= 600; t += 1) {
    const f = t / 600;
    path.push({ t, x: 2400 * f * f, h: perigee * Math.sin((f * Math.PI) / 2) ** 0.8 });
  }
  const result = {
    apogee: perigee,
    range: 2400,
    failure: null,
    failAt: null,
    burn: 600,
    path,
    orbit: { perigee, apogee },
  };
  round.flight = result;
  result.radar = radarApogee(round);
  result.orbit.perigee = result.radar;
  result.orbit.apogee = (apogee * result.radar) / perigee;
  return result;
}

// A lunar shot on its way: the range plot follows her to the last stage's burnout, ten minutes in, and the tracking stations
// take her from there (truth/lunar.js). A Jupiter that ran short climbs a little lower; she is not lost until she falls back.
function launchProbe(round, failure) {
  const r = round.vehicle,
    short = failure === 'depletion',
    top = short ? 250 : 300,
    path = [];
  for (let t = 0; t <= 600; t++) {
    const f = t / 600;
    path.push({ t, x: 1800 * f * f, h: top * Math.sin((f * Math.PI) / 2) ** 0.8 });
  }
  const result = {
    apogee: top,
    range: 1800,
    failure: short ? 'depletion' : null,
    failAt: null,
    burn: PROFILE[r].burn,
    path,
    deep: injection(round, failure),
  };
  round.flight = result;
  result.radar = radarApogee(round);
  return result;
}

// An Agena that never lit again, stranded in its parking orbit. Its plot climbs off the top of the range's board; what happened after that
// is told by the tracking stations, in deep.text. failure: null, or a cause the tracking stations see.
function deep(round, height, failure) {
  const ph = round.rng.physical,
    a = draw(ph),
    b = draw(ph),
    path = [];
  const fallsBack = failure === 'depletion',
    stranded = failure === 'agena';
  const top = stranded ? 190 : fallsBack ? height * 0.85 : height;
  for (let t = 0; t <= 900; t++) {
    const f = t / 900;
    path.push({
      t,
      x: (stranded ? 2600 : 900) * f * f,
      h: stranded ? top * Math.sin((Math.min(1, f * 1.6) * Math.PI) / 2) : top * f ** 1.6,
    });
  }
  const r = round.vehicle,
    km = n => Math.round(n / 1000) * 1000;
  let say;
  if (fallsBack)
    say = `The first stage ran out early. She climbed to about ${km(95000 + 15000 * a).toLocaleString('en-US')} km and fell back to Earth.`;
  else if (stranded) say = 'The Agena never lit again, and she was left in a low orbit.';
  else if (failure === 'camera') say = 'She hit the Moon on time, but the cameras never came on. No pictures.';
  else if (r === 'juno')
    say = `Passed the Moon at about ${km(40000 + 40000 * a).toLocaleString('en-US')} km and went on into orbit round the Sun.`;
  else
    say = `Hit the Moon on target, sending ${Math.round(4000 + 600 * b).toLocaleString('en-US')} pictures in the last minutes.`;
  // say: as the tracking stations put it; text: as your record puts it.
  const text = failure ? `Lost: ${say[0].toLowerCase()}${say.slice(1)}` : say;
  const result = {
    apogee: Math.max(...path.map(p => p.h)),
    range: path[path.length - 1].x,
    failure,
    failAt: failure ? PROFILE[r].fail[failure].at : null,
    burn: PROFILE[r].burn,
    path,
    deep: { text, say },
  };
  round.flight = result;
  result.radar = radarApogee(round);
  return result;
}

// What the recovery party finds at the impact point: the evidence, in the words of someone kneeling by the wreck. At sea
// (the Cape), what the range reads from telemetry and radar instead, where the kit has those words.
export const wreckage = (round, sea = false) => {
  const k = KITS[round.vehicle || 'wac'],
    lines = ((sea && k.sea) || k.wreck)[round.flight.failure || 'nominal'];
  return round.flight.deep ? [...lines, round.flight.deep.say] : lines;
};

// What the range's radar reports for a good flight's peak: the true apogee with a little tracking error.
export const radarApogee = round => round.flight.apogee * (1 + 0.03 * normal(round.rng.observation));

// How Ellis reads the evidence at the review. The wreck is clear most of the time; when it is not, she settles on
// another cause this kind of round can have. Two draws whatever happens, so the round's later draws do not depend on her.
export function ellisReading(round) {
  const truth = round.flight.failure || 'nominal';
  const clear = draw(round.rng.observation),
    pick = draw(round.rng.observation);
  // A round that broke loose on the stand leaves nobody in doubt, and nobody blames the stand for a flight that left it.
  if (clear < 0.8 || truth === 'holddown') return truth;
  const others = Object.keys(KITS[round.vehicle || 'wac'].explanations).filter(
    c => c !== truth && c !== 'unknown' && c !== 'holddown',
  );
  return others[Math.floor(pick * others.length)];
}

export const explanationIsRight = (round, key) => key === (round.flight.failure || 'nominal');
