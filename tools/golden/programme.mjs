// Golden traces for the port's programme carry-over (js/world/programme.js): scripted runs of what a programme goes
// through between rounds (flights recorded, fixes adopted, estimates asked, fixes told) with the whole programme state
// after every step, the return values, and for some steps the faults newRound builds from that programme.
// record(write) writes programme.json; the C# replays it in ad-astra's AdAstra.Rules.Tests/ProgrammeGoldenTests.cs.
import {
  initProgramme,
  adopt,
  recordFlight,
  estimate,
  withSeasonRisk,
  fixesInForce,
  fixesForCard,
  newFixes,
  earlierTracks,
  rangeRecord,
  LOT_ROUNDS,
  PAPER,
  PAPER_APOGEE,
} from '../../js/world/programme.js';
import { newRound, DEFAULT_PROGRAMME } from '../../js/truth/round.js';

const copy = v => JSON.parse(JSON.stringify(v));

// A synthetic flight track of n points: smooth, with fractions that land on the .x5 rounding edges, and a drift
// downrange that goes negative for a while (wind), so Math.round's half-up on negatives is covered.
const path = (n, scale = 1) =>
  Array.from({ length: n }, (_, i) => ({
    t: i * 0.5,
    x: Math.round((i * 0.35 - 3) * scale * 100) / 100 + (i % 4 === 0 ? 0.05 : 0.001 * i),
    h: Math.max(0, Math.round((i * 2.25 - i * i * 0.01) * scale * 1000) / 1000 + (i % 3 === 0 ? 0.25 : 0)),
  }));

// A script: a starting programme and steps. Each step records what it returned and the programme after it.
function run(name, start, steps) {
  const p = start;
  const out = { name, start: copy(p), steps: [] };
  for (const s of steps) {
    const rec = { ...s };
    switch (s.op) {
      case 'recordFlight':
        recordFlight(p, s.flight);
        break;
      case 'adopt':
        rec.ret = adopt(p, s.cause);
        break;
      case 'estimate':
        rec.ret = s.vehicle === undefined ? estimate(p, s.load) : estimate(p, s.vehicle, s.load);
        break;
      case 'newFixes':
        rec.ret = newFixes(p);
        break;
      case 'fixesForCard':
        rec.ret = fixesForCard(p);
        break;
      case 'fixesInForce':
        rec.ret = fixesInForce(p);
        break;
      case 'earlierTracks':
        rec.ret = s.n === undefined ? earlierTracks(p, s.vehicle) : earlierTracks(p, s.vehicle, s.n);
        break;
      case 'rangeRecord':
        rec.ret = rangeRecord(p);
        break;
      case 'withSeasonRisk':
        rec.ret = withSeasonRisk(p, s.risk, DEFAULT_PROGRAMME);
        break;
      case 'newRound': {
        const r = newRound(s.seed, p, s.vehicle);
        rec.ret = { faults: { ...r.faults }, latent: r.physical.latentMechanisms, physicalEnd: r.rng.physical.state };
        break;
      }
      default:
        throw new Error(`unknown op ${s.op}`);
    }
    rec.after = copy(p);
    out.steps.push(copy(rec));
  }
  return out;
}

const flight = (vehicle, load, apogee, more = {}) => ({
  op: 'recordFlight',
  flight: { vehicle, load, apogee, ...more },
});
const est = (vehicle, load) => ({ op: 'estimate', vehicle, load });

// Every fix the reviews can decide, in order, on one programme: each cause's text and what it changes.
const CAUSES = [
  'ignition',
  'weld',
  'leak',
  'turbopump',
  'vanes',
  'liner',
  'cutoff',
  'injector',
  'depletion',
  'agena',
  'oring',
  'miss',
  'camera',
  'plug',
  'control',
  'lox',
  'thrust',
  'guidance',
  'shortburn',
  'shield',
  'scanner',
  'titanctl',
  'stage2',
  'fuelcell',
  'hatch',
  'computer',
  'navdata',
  'shutdown',
  'thruster',
  'saturnctl',
  'j2',
  'pogo',
  'relight',
  'sps',
  'tank',
  'cabin',
  'alarm',
  'ascent',
  'chute',
  'lightning',
  'fin',
  'holddown',
  'separation',
];

export function record(write) {
  const scripts = [];

  // The WAC season as game.js plays it: flights with tracks, a weld failure that taints the lot, the jump that tells the
  // fixes, rounds built from the programme, and the estimate as it narrows.
  scripts.push(
    run('wac season', initProgramme(), [
      est('wac', 1),
      est('wac', 0.85),
      { op: 'rangeRecord' },
      { op: 'newRound', seed: 1945, vehicle: 'wac' },
      flight('wac', 1, 70.25, { path: path(40), failAt: null, name: 'WAC 1' }),
      est('wac', 1),
      est('wac', 0.9),
      { op: 'rangeRecord' },
      flight('wac', 0.92, 64.4, { path: path(130), failure: 'weld', failAt: 12.5, name: 'WAC 2' }),
      { op: 'newRound', seed: 42, vehicle: 'wac' },
      { op: 'newRound', seed: 7, vehicle: 'wac' },
      flight('wac', 0.95, 66.8, { path: path(61, 0.9), name: 'WAC 3', tracked: true }),
      { op: 'newRound', seed: 42, vehicle: 'wac' },
      est('wac', 0.95),
      flight('wac', 1, 0, { path: path(5), failure: 'ignition', failAt: 0, name: 'WAC 4' }),
      { op: 'newRound', seed: 123456789, vehicle: 'wac' },
      { op: 'adopt', cause: 'ignition' },
      { op: 'adopt', cause: 'ignition' },
      { op: 'newRound', seed: 123456789, vehicle: 'wac' },
      { op: 'fixesForCard' },
      { op: 'newFixes' },
      { op: 'fixesForCard' },
      { op: 'newFixes' },
      { op: 'adopt', cause: 'weld' },
      { op: 'fixesForCard' },
      { op: 'fixesInForce' },
      { op: 'newRound', seed: 1945, vehicle: 'wac' },
      flight('wac', 1, 72.5, { path: path(60), name: 'WAC 5', tracked: true }),
      flight('wac', 0.88, 55.1, { path: path(240), name: 'WAC 6' }),
      flight('wac', 1, 71, { path: path(241), name: 'WAC 7' }),
      { op: 'earlierTracks', vehicle: 'wac' },
      { op: 'earlierTracks', vehicle: 'wac', n: 1 },
      { op: 'earlierTracks', vehicle: 'wac', n: 0 },
      { op: 'earlierTracks', vehicle: 'v2' },
      est('wac', 1),
      est('wac', 0.85),
      { op: 'estimate', load: 0.9 },
      { op: 'rangeRecord' },
      { op: 'newFixes' },
    ]),
  );

  // Lots: a failure fills the lot for LOT_ROUNDS rounds, a hidden failure or one already fixed says nothing, a second
  // failure of the same cause refills it, and a new vehicle starts clean.
  scripts.push(
    run('lots', initProgramme(), [
      flight('v2', 1, 0, { failure: 'turbopump' }),
      { op: 'newRound', seed: 0, vehicle: 'v2' },
      { op: 'newRound', seed: 0, vehicle: 'wac' },
      flight('v2', 1, 0, { failure: 'vanes' }),
      { op: 'newRound', seed: 314159, vehicle: 'v2' },
      flight('v2', 1, 150, {}),
      flight('v2', 0.9, 0, { failure: 'vanes', hidden: true }),
      flight('v2', 1, 0, { failure: 'leak' }),
      flight('v2', 1, 0, { failure: 'leak' }),
      { op: 'newRound', seed: 2, vehicle: 'v2' },
      { op: 'adopt', cause: 'leak' },
      flight('v2', 1, 0, { failure: 'leak' }),
      flight('v2', 1, 0, { failure: 'weld' }),
      { op: 'newRound', seed: 2, vehicle: 'v2' },
      flight('wac', 1, 66, {}),
      { op: 'newRound', seed: 2, vehicle: 'v2' },
      flight('wac', 1, 0, { failure: 'weld', hidden: false }),
      flight('v2', 1, 0, { failure: '' }),
      flight('v2', 1, 132.75, { failure: null }),
      // A good flight the radar did not fix (game.js passes apogee: null), and one with a null load (loadFactor(null)
      // reads it as 0), then the estimate that takes it in.
      flight('v2', 1, null, {}),
      est('v2', 1),
      flight('v2', null, 120, {}),
      est('v2', 1),
      est('v2', 0.9),
      { op: 'adopt', cause: 'turbopump' },
      { op: 'adopt', cause: 'nothing' },
      { op: 'adopt', cause: 'unknown' },
      est('v2', 1),
      est('v2', 0.87),
      est('wac', 1),
      { op: 'rangeRecord' },
      { op: 'newRound', seed: 1, vehicle: 'v2' },
    ]),
  );

  // The drawing office's estimate for every vehicle, before anything has flown and after good, failed and tracked
  // flights of its own kind.
  const vehicles = Object.keys(PAPER);
  const estimateSteps = [];
  const loads = [0.85, 0.9, 0.97, 1];
  for (const v of vehicles) for (const l of loads) estimateSteps.push(est(v, l));
  vehicles.forEach((v, i) => {
    const full = PAPER[v].apogee;
    estimateSteps.push(flight(v, 0.9 + (i % 3) * 0.05, full * (0.93 + 0.01 * i)));
    estimateSteps.push(flight(v, 1, 0, { failure: 'weld' }));
    estimateSteps.push(flight(v, 0.95, full * 1.07, { tracked: i % 2 === 0 }));
  });
  for (const v of vehicles) for (const l of loads) estimateSteps.push(est(v, l));
  estimateSteps.push({ op: 'rangeRecord' });
  scripts.push(run('estimates', initProgramme(), estimateSteps));

  // Every fix, in turn, with a repeat of each: the texts, what each changes, and the lot it clears.
  const fixSteps = [flight('wac', 1, 0, { failure: 'weld' }), flight('wac', 1, 0, { failure: 'leak' })];
  for (const c of CAUSES) fixSteps.push({ op: 'adopt', cause: c }, { op: 'adopt', cause: c });
  fixSteps.push({ op: 'fixesForCard' }, { op: 'fixesInForce' }, { op: 'newFixes' }, { op: 'newFixes' });
  for (const v of ['wac', 'v2', 'redstone', 'atlas', 'saturn5', 'shuttle'])
    fixSteps.push({ op: 'newRound', seed: 1945, vehicle: v });
  scripts.push(run('every fix', initProgramme(), fixSteps));

  // A season's risk on top of the programme: the fix made so far still counts.
  scripts.push(
    run('season risk', initProgramme(), [
      { op: 'withSeasonRisk', risk: { plugRisk: 0.7, thrustRisk: 0.5 } },
      { op: 'adopt', cause: 'plug' },
      { op: 'adopt', cause: 'thrust' },
      {
        op: 'withSeasonRisk',
        risk: { plugRisk: 0.7, thrustRisk: 0.5, controlRisk: 0.3, seg51Risk: 0.4, igniter: 'x/r9' },
      },
      { op: 'withSeasonRisk', risk: {} },
      { op: 'adopt', cause: 'oring' },
      { op: 'withSeasonRisk', risk: { oringRisk: 0.6, foamRisk: 0.5 } },
    ]),
  );

  // Programmes the game can meet that do not start from initProgramme: a lot from the old shape (batch values true),
  // one whose build standard lacks the O-ring figure, and one whose fixes were told past what is adopted.
  const noOring = initProgramme();
  delete noOring.oringRisk;
  scripts.push(
    run('odd starts', { ...initProgramme(), lotVehicle: 'wac', batch: { weld: true, leak: 3 }, weldRisk: 0.9 }, [
      { op: 'newRound', seed: 42, vehicle: 'wac' },
      flight('wac', 1, 66, {}),
      { op: 'newRound', seed: 42, vehicle: 'wac' },
      flight('wac', 1, 66, {}),
      flight('wac', 1, 66, {}),
    ]),
    run('no o-ring figure', noOring, [{ op: 'adopt', cause: 'oring' }, { op: 'fixesForCard' }]),
    run('told ahead', { ...initProgramme(), adopted: ['weld'], told: 3 }, [
      { op: 'fixesForCard' },
      { op: 'adopt', cause: 'leak' },
      { op: 'fixesForCard' },
      { op: 'newFixes' },
      { op: 'fixesForCard' },
    ]),
  );

  write('programme.json', { LOT_ROUNDS, PAPER, PAPER_APOGEE, scripts });
}
