// Golden traces for the port's orbital-era truth (ad-astra: AdAstra.Rules/Truth/{Entry,Capsule,Orbit,Flights}.cs and
// World/Race.cs). record(write) writes:
//   space-race.json     world/race.js: the race for many seeds, its news, what Houston has heard, and the seeded hazards.
//   space-entry.json    truth/entry.js: Mercury, Gemini (steered, ballistic, mis-aimed), suborbital and lunar entries.
//   space-capsule.json  truth/capsule.js: Mercury-Redstone climbs (every failure, forced and drawn), their outcomes for a
//                       spread of abort times, the impact predictions, conditions, recovery, sinking and the crew's fate.
//   space-orbit.json    truth/orbit.js: every orbital booster's climb, outcomes, Goddard, insertion, orbit, retrofire,
//                       predictions and recovery.
//   space-flights.json  truth/flights.js: flightTruth for every flight with its own flags, the Gemini and lunar entries,
//                       predictions, recovery, and measure.
//   space-resolve.json  truth/flights.js: every answer of the RESOLVE table, for every choice it names, a spread of draws,
//                       flags, states and the S-IVB's short propellant. Cases point into a table of distinct results.
// Stream states are recorded after each step that draws, so a wrong draw count fails. Long climbs are sampled (every 7th
// second and the last three) to keep the files small; the C# samples the same seconds.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newRound } from '../../js/truth/round.js';
import * as race from '../../js/world/race.js';
import * as entry from '../../js/truth/entry.js';
import * as capsule from '../../js/truth/capsule.js';
import * as orbit from '../../js/truth/orbit.js';
import * as flights from '../../js/truth/flights.js';

const here = dirname(fileURLToPath(import.meta.url));
const copy = v => JSON.parse(JSON.stringify(v));
const SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
const streams = r => ({
  physical: r.rng.physical.state,
  observation: r.rng.observation.state,
  forecast: r.rng.forecast.state,
});
const DEG = Math.PI / 180;

// A climb's steps, sampled: { count, at: [indexes], and one column per key }.
function sampled(steps) {
  const at = steps.map((_, i) => i).filter(i => i % 7 === 0 || i >= steps.length - 3);
  const cols = { count: steps.length, at };
  for (const k of Object.keys(steps[0] || {})) cols[k] = at.map(i => steps[i][k] ?? null);
  return cols;
}
const ascentRecord = a => ({ ...copy(a), steps: sampled(a.steps) });
// What newRound put on the round that the C# keeps beside it (RoundSpace), and its faults, as a check on newRound.
const roundFacts = r => ({
  faults: r.faults,
  thrust: r.thrust ?? null,
  navdata: r.navdata ?? null,
  lightning: r.lightning ?? null,
  throttle: r.throttle ?? null,
  extra: Object.fromEntries(['boostRisk', 'cold'].filter(k => k in r).map(k => [k, r[k]])),
});

// ---- world/race.js ----
function recordRace() {
  const seeds = [...SEEDS, ...Array.from({ length: 120 }, (_, i) => i * 7919 + 3)];
  const days = [race.RACE_FROM - 1, 365 * -4, 0, 365 * -2.5, 365, 365 * 1.5, 400, 900];
  const lines = ['luna', 'soyuz', 'zond', 'n1', 'lander', 'nope'];
  const ids = ['luna9', 'soyuz1', 'zond-crewed', 'n1-1', 'luna15', 'n1-2', 'lander', 'nope'];
  const fires = [{}, { cabinRisk: 0.15 }, { cabinRisk: 0.5 }, { cabinRisk: 0.9 }, { cabinRisk: 0 }];
  return {
    attempts: race.ATTEMPTS,
    raceFrom: race.RACE_FROM,
    intelWrong: race.INTEL_WRONG,
    seeds: seeds.map(seed => {
      const all = race.raceOf(seed);
      const span = all.length ? [all[0].at, all[all.length - 1].at] : [0, 0];
      const windows = [
        [race.RACE_FROM, race.RACE_FROM + 5000],
        [span[0] - 1, span[0]],
        [span[0], span[1]],
        [span[0] + 200, span[0] + 900],
      ];
      return {
        seed,
        race: all,
        orionChar: race.orionChar(seed),
        skylabShield: race.skylabShield(seed),
        apolloFire: fires.map(p => race.apolloFire(seed, p)),
        news: windows.map(([from, to]) => ({ from, to, lines: race.raceNews(seed, from, to) })),
        heard: lines.map(line => days.map(day => [day + race.RACE_FROM, race.raceHeard(seed, line, day + race.RACE_FROM)])),
        has: ids.map(id =>
          [...days, ...all.map(e => e.at), ...all.map(e => e.at - 1)].map(day => [
            day,
            race.sovietHas(seed, id, day + 0),
          ]),
        ),
      };
    }),
    fireCases: fires,
    heardDays: days,
    lines,
    ids,
  };
}

// ---- truth/entry.js ----
function recordEntry() {
  const cases = [];
  const add = (kind, v, retro, nav) => {
    const out = kind === 'lunar' ? entry.flyLunarEntry(v, retro, nav) : entry.flyEntry(v, retro, nav);
    cases.push({ kind, v, retro: retro ?? null, nav: nav ?? null, out });
  };
  for (const retro of [
    undefined,
    {},
    { dvScale: 0.01 },
    { dvScale: -0.33 },
    { yawError: 10 * DEG },
    { pitchError: 2 * DEG, late: 3 },
    { yawError: -25 * DEG, late: 0.3, dvScale: -0.005 },
  ])
    add('mercury', entry.MERCURY_ENTRY, retro);
  for (const nav of [0, -129000, 20000, 2e6, -2e6])
    for (const retro of [{}, { dvScale: 0.004, yawError: 0.5 * DEG, pitchError: -0.3 * DEG, late: 0.3 }])
      add('gemini', entry.GEMINI_ENTRY, retro, nav);
  add(
    'gemini',
    { ...entry.GEMINI_ENTRY, ld: 0, nominalBank: 0 },
    { dvScale: -0.004, yawError: 3 * DEG, late: 2 },
    -129000,
  );
  add('suborbital', { suborbital: true, apogee: 187e3, apogeeSpeed: 1500, beta: 260, ld: 0, noseRadius: 2.4 });
  add('suborbital', {
    suborbital: true,
    apogee: 120e3,
    apogeeSpeed: 2400,
    beta: 300,
    ld: 0.2,
    bank: 0.5,
    noseRadius: 2,
  });
  for (const g of [-1.5, -1, -0.6, 0, 0.4, 0.6, 0.7, 1.2])
    for (const nav of [0, 12000, -12000]) add('lunar', entry.LUNAR_ENTRY, g, nav);
  // Math.hypot as V8 computes it, which the C# copies.
  const hyp = [
    [3, 4],
    [0, 0],
    [-1e-3, 7.84e3],
    [7801.123, -123.4567],
    [1e-300, 1e-300],
    [0.1, 0.2],
    [123456.789, 98765.4321],
  ].map(([a, b]) => [a, b, Math.hypot(a, b)]);
  return {
    mercury: entry.MERCURY_ENTRY,
    gemini: entry.GEMINI_ENTRY,
    lunar: entry.LUNAR_ENTRY,
    kmPerMile: entry.KM_PER_MILE,
    hypot: hyp,
    cases,
  };
}

// ---- truth/capsule.js ----
const REDSTONE_PROGRAMMES = {
  default: null,
  risky: { plugRisk: 1, controlRisk: 1, loxRisk: 1, thrustRisk: 1 },
  control: { plugRisk: 0, controlRisk: 1, loxRisk: 0, thrustRisk: 0 },
  lox: { plugRisk: 0, controlRisk: 0, loxRisk: 1, thrustRisk: 0 },
  thrust: { plugRisk: 0, controlRisk: 0, loxRisk: 0, thrustRisk: 1 },
  sound: { plugRisk: 0, controlRisk: 0, loxRisk: 0, thrustRisk: 0 },
};

function capsuleCase(seed, programme, force, extra = {}) {
  const r = newRound(seed, REDSTONE_PROGRAMMES[programme], 'redstone');
  Object.assign(r, extra);
  const rec = { seed, programme, force, extra, round: roundFacts(r) };
  const a = capsule.ascent(r, force);
  rec.ascent = ascentRecord(a);
  rec.events = [...r.events];
  rec.afterAscent = streams(r);
  const aborts = [null, 0, 5, 30, 60, 100, 136, 137, 141, 142, 150, 12.5];
  if (a.breakupAt != null) aborts.push(a.breakupAt - 1, a.breakupAt);
  rec.outcomes = aborts.map(at => ({ at, end: copy(capsule.outcome(r, at)) }));
  // stepAt directly, past both ends.
  rec.stepAt = [-3, 0, 2.7, 70, 1000].map(t => [t, copy(capsule.stepAt(a, t))]);
  const end = capsule.outcome(r, null);
  rec.ip = [];
  for (const force of [undefined, true, false]) {
    if (force === undefined) delete r.forceRadar;
    else r.forceRadar = force;
    rec.ip.push({ force: force ?? null, ip: copy(capsule.impactPredictions(r)), after: streams(r) });
  }
  delete r.forceRadar;
  rec.conditions = [null, 'seastate', 'offstation', 'radar', null].map(f => ({
    force: f,
    out: capsule.conditions(r, f),
    after: streams(r),
  }));
  rec.sinks = [1, 2].map(h => ({ hours: h, out: capsule.sinks(r, h), after: streams(r) }));
  rec.padCrewNow = { out: capsule.padCrewNow(r), after: streams(r) };
  const ends = [
    end,
    { capsule: 'lost', entryG: 3 },
    { capsule: 'damaged', entryG: 5 },
    { capsule: 'safe', entryG: 16 },
    { capsule: 'safe', entryG: 15 },
  ];
  rec.fates = [];
  for (const e of ends)
    for (const hours of [1, 3])
      for (const sank of [false, true])
        rec.fates.push({ end: copy(e), hours, sank, out: capsule.crewFate(r, e, hours, sank), after: streams(r) });
  return rec;
}

// The first seed from `from` whose climb on this programme does `want`.
function findSeed(programme, want, from = 0, vehicle = 'redstone', run = r => capsule.ascent(r)) {
  for (let s = from; s < from + 20000; s++) {
    const r = newRound(s, programme, vehicle);
    if (want(run(r), r)) return s;
  }
  throw new Error('no seed found');
}

function recordCapsule() {
  const cases = [];
  for (const seed of SEEDS) {
    cases.push(capsuleCase(seed, 'default', null));
    cases.push(capsuleCase(seed, 'risky', null));
  }
  for (const seed of SEEDS.slice(0, 3))
    for (const force of ['nominal', 'plug', 'control', 'lox', 'thrust'])
      cases.push(capsuleCase(seed, 'default', force));
  for (const p of ['control', 'lox', 'thrust'])
    for (const seed of SEEDS.slice(3, 6)) cases.push(capsuleCase(seed, p, null));
  // Drawn hidden failures (each kind), and control breakups with and without the abort sensing.
  const sound = REDSTONE_PROGRAMMES.sound;
  for (const kind of ['control', 'lox', 'thrust'])
    cases.push(
      capsuleCase(
        findSeed(sound, (a, r) => a.failure === kind && r.events.length > 0),
        'sound',
        null,
      ),
    );
  const ctl = REDSTONE_PROGRAMMES.control;
  cases.push(
    capsuleCase(
      findSeed(ctl, a => a.breakupAt != null && a.asis),
      'control',
      null,
    ),
  );
  cases.push(
    capsuleCase(
      findSeed(ctl, a => a.breakupAt != null && !a.asis),
      'control',
      null,
    ),
  );
  const thr = REDSTONE_PROGRAMMES.thrust;
  cases.push(
    capsuleCase(
      findSeed(thr, a => a.asisAbort === true),
      'thrust',
      null,
    ),
  );
  cases.push(
    capsuleCase(
      findSeed(thr, a => a.asisAbort === false),
      'thrust',
      null,
    ),
  );
  // A steep entry that damages the capsule (entryG > 16).
  const recovery = [];
  for (const landing of [0, 300, 470, 486, 500, 520, 640, 900])
    for (const aim of [486, 400, 520, 600])
      for (const sea of [2, 4, 5])
        for (const late of [null, 'uprange', 'downrange'])
          for (const trained of [false, true])
            recovery.push({
              landing,
              aim,
              cond: { seaState: sea, late },
              trained,
              out: capsule.recoveryHours(landing, aim, { seaState: sea, late }, trained),
            });
  return {
    plan: capsule.PLAN,
    abortLimit: capsule.ABORT_LIMIT,
    breakup: capsule.BREAKUP,
    asis: capsule.ASIS,
    failure: capsule.FAILURE,
    hiddenFailure: capsule.HIDDEN_FAILURE,
    recovery: capsule.RECOVERY,
    sink: [capsule.SINK_AFTER, capsule.SINK_CHANCE],
    topple: capsule.TOPPLE,
    drown: [capsule.DROWN_AFTER, capsule.DROWN_CHANCE],
    programmes: REDSTONE_PROGRAMMES,
    plannedGamma: [0, 11, 12, 13, 50, 77, 141, 142, 150].map(t => [t, capsule.plannedGamma(t)]),
    arcs: [
      [2.29, 40, 60, 40],
      [2.4, 35, 55, 38],
      [0.5, 85, 3, 0],
      [1.2, -10, 30, 5],
      [3.2, 2, 61, 41],
      [0, 90, 0, 0],
    ].map(args => [args, capsule.arc(...args)]),
    cases,
    recoveryHours: recovery,
  };
}

// ---- truth/orbit.js ----
// The boosters' own names for their failures (mercury.js: BOOSTERS).
const NAMES = {
  atlas: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Atlas' },
  titan: { guidance: 'titanctl', shortburn: 'stage2', booster: 'Titan II' },
  saturn5: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn V' },
  saturnib: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn IB' },
  shuttle: { guidance: 'computer', shortburn: 'ssme', boost: 'oring', booster: 'Shuttle' },
  dragon: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Falcon 9' },
  sls: { guidance: 'guidance', shortburn: 'shortburn', booster: 'SLS' },
};
// Every orbital risk at certain, so the climb's own faults are there to be drawn.
const ORBIT_RISKY = {
  guidanceRisk: 1,
  shortburnRisk: 1,
  shieldRisk: 1,
  scannerRisk: 1,
  titanctlRisk: 1,
  stage2Risk: 1,
  saturnctlRisk: 1,
  oringRisk: 1,
  ssmeRisk: 1,
  computerRisk: 1,
};
const ORBIT_SOUND = Object.fromEntries(Object.keys(ORBIT_RISKY).map(k => [k, 0]));
const ORBIT_PROGRAMMES = {
  default: null,
  risky: ORBIT_RISKY,
  sound: ORBIT_SOUND,
  shieldOnly: { ...ORBIT_SOUND, shieldRisk: 1 },
  scannerOnly: { ...ORBIT_SOUND, scannerRisk: 1 },
  oring: { ...ORBIT_SOUND, oringRisk: 1 },
};

function orbitCase(
  seed,
  vehicle,
  programme,
  force,
  { names = NAMES[vehicle], extra = {}, how = 'auto', pack = 'jettison' } = {},
) {
  const r = newRound(seed, ORBIT_PROGRAMMES[programme], vehicle);
  Object.assign(r, extra);
  const rec = { seed, vehicle, programme, force, names: names === 'default' ? null : names, extra, how, pack, round: roundFacts(r) };
  const a = names === 'default' ? orbit.atlasAscent(r, force) : orbit.atlasAscent(r, force, names);
  rec.ascent = ascentRecord(a);
  rec.events = [...r.events];
  rec.afterAscent = streams(r);
  const aborts = [null, 0, 50, 100, 200, 299, a.burn - 1, a.burn];
  if (a.breakupAt != null) aborts.push(a.breakupAt - 1, a.breakupAt);
  rec.outcomes = aborts.map(at => ({ at, end: copy(orbit.atlasOutcome(r, at)) }));
  const end = orbit.atlasOutcome(r, null);
  rec.end = copy(end);
  if (end.outcome === 'orbit') {
    rec.goddard = { out: copy(orbit.goddard(r)), after: streams(r) };
    const saved = copy(end);
    rec.insertion = [];
    for (const [go, corr] of [
      [true, 0],
      [false, 0],
      [true, -1],
      [true, 0.05],
      [false, 1],
    ]) {
      r.end = copy(saved);
      rec.insertion.push({ go, corr, out: copy(orbit.insertion(r, go, corr)) });
    }
    r.end = copy(saved);
  }
  rec.inOrbit = { out: copy(orbit.inOrbit(r)), after: streams(r) };
  rec.fuelAfter = [0, 1, 3, 10].map(n => orbit.fuelAfter(r.orbit, n));
  rec.retrofire = { out: copy(orbit.retrofire(r, how, pack)), after: streams(r) };
  rec.predictions = { out: copy(orbit.orbitPredictions(r)), after: streams(r) };
  return rec;
}

function recordOrbit() {
  const cases = [];
  const combos = [
    ['auto', 'jettison'],
    ['manual', 'keep'],
    ['auto', 'keep'],
    ['manual', 'jettison'],
  ];
  let n = 0;
  const next = () => {
    const [how, pack] = combos[n++ % combos.length];
    return { how, pack };
  };
  for (const vehicle of Object.keys(NAMES)) {
    const names = NAMES[vehicle];
    for (const seed of SEEDS.slice(0, 4)) cases.push(orbitCase(seed, vehicle, 'default', null, next()));
    for (const seed of SEEDS.slice(4, 7)) cases.push(orbitCase(seed, vehicle, 'risky', null, next()));
    for (const force of ['nominal', names.guidance, names.shortburn, ...(names.boost ? [names.boost] : [])])
      cases.push(orbitCase(SEEDS[7], vehicle, 'default', force, next()));
    // A failure no inspection could have found, of each kind.
    const sound = ORBIT_PROGRAMMES.sound;
    for (const kind of [names.guidance, names.shortburn]) {
      const s = findSeed(
        sound,
        (a, r) => a.failure === kind && r.events.length > 0,
        0,
        vehicle,
        r => orbit.atlasAscent(r, null, names),
      );
      cases.push(orbitCase(s, vehicle, 'sound', null, next()));
    }
  }
  // The atlas with the default names, the shield and the scanner each alone, a Segment 51 risk set, and every
  // retrofire combination on a loose shield with a bad scanner.
  cases.push(orbitCase(3, 'atlas', 'default', null, { names: 'default' }));
  for (const [how, pack] of combos) {
    cases.push(orbitCase(11, 'atlas', 'risky', 'nominal', { how, pack }));
    cases.push(orbitCase(12, 'atlas', 'shieldOnly', 'nominal', { how, pack }));
    cases.push(orbitCase(13, 'atlas', 'scannerOnly', 'nominal', { how, pack }));
    cases.push(orbitCase(14, 'atlas', 'sound', 'nominal', { how, pack, extra: { seg51Risk: 0.6 } }));
  }
  cases.push(orbitCase(15, 'atlas', 'sound', 'nominal', { extra: { seg51Risk: 1 } }));
  cases.push(orbitCase(16, 'atlas', 'sound', 'nominal', { extra: { seg51Risk: 0 } }));
  // The Shuttle's booster joint: drawn at its risk, and warm.
  for (const seed of SEEDS.slice(0, 6)) {
    cases.push(orbitCase(seed, 'shuttle', 'oring', null));
    cases.push(orbitCase(seed, 'shuttle', 'oring', null, { extra: { warm: true } }));
  }
  // An unknown vehicle flies the Atlas's stack.
  cases.push(orbitCase(5, 'wac', 'default', null, { names: NAMES.atlas }));
  const recovery = [];
  const ends = [
    { outcome: 'entry', miss: 0 },
    { outcome: 'entry', miss: 25 },
    { outcome: 'entry', miss: -80 },
    { outcome: 'entry', miss: 400 },
    { outcome: 'decay', landing: 6100 },
    { outcome: 'nogo', landing: 2280 },
    { outcome: 'aborted', landing: 860 },
    { outcome: 'breakup', landing: 3000 },
  ];
  for (const end of ends)
    for (const aim of [0, 20, -60, 300])
      for (const sea of [2, 5])
        for (const late of [null, 'uprange', 'downrange'])
          for (const trained of [false, true])
            for (const waited of [false, true])
              recovery.push({
                end,
                aim,
                cond: { seaState: sea, late },
                trained,
                waited,
                out: orbit.orbitRecoveryHours(end, aim, { seaState: sea, late }, trained, waited),
              });
  return {
    programmes: ORBIT_PROGRAMMES,
    plan: orbit.ORBIT_PLAN,
    limits: [orbit.ORBIT_ABORT_LIMIT, orbit.ORBIT_BREAKUP, orbit.ORBIT_HIDDEN, orbit.FUEL_LOW],
    failure: orbit.ORBIT_FAILURE,
    shield: orbit.SHIELD,
    scanner: orbit.SCANNER,
    recovery: orbit.ORBIT_RECOVERY,
    orbitGamma: [0, 9, 10, 11, 100, 150, 299, 300, 350].flatMap(t => [
      [t, null, orbit.orbitGamma(t)],
      [t, 520, orbit.orbitGamma(t, 520)],
    ]),
    plannedBurn: Object.fromEntries([...Object.keys(NAMES), 'wac'].map(v => [v, orbit.plannedBurn(v)])),
    margins: [
      [7.84, 0],
      [7.78, 0],
      [7.8, -0.5],
      [7.79, 1.5],
    ].map(([v, g]) => [v, g, orbit.insertionMargin(v, g)]),
    cases,
    recoveryHours: recovery,
  };
}

// ---- truth/flights.js: truth, entries, predictions, recovery, measure ----
const FLIGHTS = [
  ['titan', 'gemini-4'],
  ['titan', 'gemini-5'],
  ['titan', 'gemini-6a'],
  ['saturn5', 'apollo-11'],
  ['saturn5', 'apollo-13'],
  ['saturnib', 'skylab-2'],
  ['saturnib', 'skylab-3'],
  ['saturnib', 'skylab-4'],
  ['dragon', 'demo-2'],
  ['shuttle', 'sts-26'],
  ['shuttle', 'sts-61'],
  ['shuttle', 'sts-31'],
  ['sls', 'artemis-1'],
  ['sls', 'artemis-2'],
  ['sls', 'artemis-3'],
  ['sls', 'artemis-4'],
];
const ALL_FLIGHT_RISKS = {
  fuelcellRisk: 1,
  hatchRisk: 1,
  computerRisk: 1,
  thrusterRisk: 1,
  pogoRisk: 1,
  j2Risk: 1,
  relightRisk: 1,
  spsRisk: 1,
  tankRisk: 1,
  cabinRisk: 1,
  alarmRisk: 1,
  ascentRisk: 1,
  chuteRisk: 1,
  throttleRisk: 1,
  navRisk: 1,
  lightningRisk: 1,
};
const WORKSHOPS = {
  none: undefined,
  null: null,
  cooked: { attitude: 'sun', crew: 'rush' },
  kept: { attitude: 'edge', crew: 'wait' },
};

function recordFlights() {
  const truths = [];
  for (const [vehicle, id] of FLIGHTS)
    for (const seed of SEEDS.slice(0, 6))
      for (const programme of [null, ALL_FLIGHT_RISKS]) {
        const shops = id === 'skylab-2' ? Object.keys(WORKSHOPS) : ['none'];
        for (const shop of shops)
          for (const campaignSeed of [undefined, 1945, 0xffffffff]) {
            const r = newRound(seed, programme, vehicle);
            if (WORKSHOPS[shop] !== undefined) r.workshop = WORKSHOPS[shop];
            const t = flights.flightTruth(r, id, campaignSeed);
            truths.push({
              vehicle,
              id,
              seed,
              risky: !!programme,
              workshop: shop,
              campaignSeed: campaignSeed ?? null,
              round: roundFacts(r),
              truth: copy(t),
              flags: ['hatch', 'navdata', 'shield', 'nope'].map(f => flights.flag(r, f)),
              after: streams(r),
            });
          }
      }
  const gemini = [];
  const geminiStates = [
    {},
    { computer: 'down' },
    { navFixed: true },
    { hurt: 0.5 },
    { hurt: 1, secondary: true },
    { computer: 'down', hurt: 0.3 },
  ];
  for (const seed of SEEDS.slice(0, 5))
    for (const programme of [null, { navRisk: 1 }]) {
      const r = newRound(seed, programme, 'titan');
      flights.flightTruth(r, 'gemini-5');
      const states = seed === SEEDS[0] ? geminiStates : geminiStates.slice(0, 3);
      for (const [i, state] of states.entries()) {
        if (i % 2 === 1) r.end = { outcome: 'orbit', margin: 0.1, capsule: 'safe' };
        else delete r.end;
        const end = copy(flights.geminiEntry(r, state));
        gemini.push({
          seed,
          navRisk: !!programme,
          prior: i % 2 === 1,
          state,
          end,
          ip: copy(flights.flightPredictions(r)),
          after: streams(r),
        });
      }
    }
  const lunar = [];
  const lunarStates = [
    {},
    { gammaError: -1.5 },
    { gammaError: 1 },
    { gammaError: 0.5 },
    { lost: true },
    { stranded: true },
    { hurt: 0.9 },
    { lmLost: true, gammaError: -0.4 },
    { gammaError: -0.9 },
  ];
  for (const seed of SEEDS.slice(0, 4))
    for (const programme of [null, { chuteRisk: 1 }]) {
      const r = newRound(seed, programme, 'saturn5');
      flights.flightTruth(r, 'apollo-11');
      const states = seed === SEEDS[0] ? lunarStates : lunarStates.slice(0, 4);
      for (const [i, state] of states.entries()) {
        if (i % 2 === 1) r.end = { outcome: 'orbit', margin: 0.1, capsule: 'safe' };
        else delete r.end;
        const end = copy(flights.lunarEntry(r, state));
        lunar.push({
          seed,
          chuteRisk: !!programme,
          prior: i % 2 === 1,
          state,
          end,
          ip: copy(flights.flightPredictions(r)),
          after: streams(r),
        });
      }
    }
  const recovery = [];
  for (const end of [
    { outcome: 'entry', miss: 30, secondary: true },
    { outcome: 'entry', miss: -150, secondary: true },
    { outcome: 'entry', miss: 12 },
    { outcome: 'decay', landing: 6000 },
  ])
    for (const aim of [0, 40])
      for (const sea of [2, 5])
        for (const trained of [false, true])
          for (const waited of [false, true]) {
            const cond = { seaState: sea, late: null };
            recovery.push({
              end,
              aim,
              cond,
              trained,
              waited,
              out: flights.flightRecoveryHours(end, aim, cond, trained, waited, orbit.orbitRecoveryHours),
            });
          }
  const measure = [];
  for (const d11 of [0, 0.05, 0.068, 0.2, 0.27, 0.3, 0.5, 0.6, 0.72, 0.73, 0.8, 0.9, 0.999])
    for (const d10 of [0, 0.5, 0.999]) {
      const d = Array(27).fill(0.5);
      d[10] = d10;
      d[11] = d11;
      const r = { flightTruth: { id: 'apollo-11', d, flags: {} } };
      measure.push({
        d10,
        d11,
        err: flights.entryAngleError(r.flightTruth),
        angle: flights.measure(r, 'entryAngle'),
        other: flights.measure(r, 'tracking'),
      });
    }
  return {
    flightDraws: flights.FLIGHT_DRAWS,
    odds: flights.ODDS,
    navErrorKm: flights.NAV_ERROR_KM,
    allRisks: ALL_FLIGHT_RISKS,
    workshops: Object.fromEntries(Object.entries(WORKSHOPS).map(([k, v]) => [k, v === undefined ? 'absent' : v])),
    truths,
    gemini,
    lunar,
    recovery,
    measure,
  };
}

// ---- truth/flights.js: the RESOLVE table ----
// The answers, their choices and the flags and state keys they read, read from the source (RESOLVE is not exported).
function resolveTable() {
  const src = readFileSync(join(here, '../../js/truth/flights.js'), 'utf8');
  const body = src.slice(src.indexOf('const RESOLVE = {'), src.indexOf('\n};\n', src.indexOf('const RESOLVE = {')));
  const heads = [...body.matchAll(/^ {2}(\w+)\(choice/gm)];
  return heads.map((h, i) => {
    const text = body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.length);
    const choices = new Set([...text.matchAll(/choice === '([\w-]+)'/g)].map(m => m[1]));
    for (const m of text.matchAll(/\{ (csm): [\d.]+, (lmburn): [\d.]+, (wait): [\d.]+ \}/g))
      m.slice(1).forEach(c => choices.add(c));
    const flags = new Set([...text.matchAll(/\bf\.(\w+)/g)].map(m => m[1]));
    // tlii and tlio read tli's flags through it.
    if (/RESOLVE\.tli\(/.test(text)) {
      flags.add('relight');
      choices.add('nogo');
    }
    return { id: h[1], choices: [...choices, 'other'], flags: [...flags] };
  });
}

function recordResolve() {
  const table = resolveTable();
  const D = [
    0, 0.04, 0.1, 0.13, 0.17, 0.22, 0.27, 0.32, 0.37, 0.42, 0.47, 0.52, 0.57, 0.62, 0.67, 0.72, 0.77, 0.82, 0.87, 0.99,
  ];
  const STATES = [{}, { reserve: 50, groundFix: 'provisional', lateEva: true }];
  const allFlags = [...new Set(table.flatMap(e => e.flags))];
  const outs = [],
    seen = new Map(),
    cases = [];
  const outIndex = o => {
    const k = JSON.stringify(o);
    if (!seen.has(k)) {
      seen.set(k, outs.length);
      outs.push(o);
    }
    return seen.get(k);
  };
  for (const e of [...table, { id: 'nope', choices: ['go'], flags: [] }]) {
    const flagSets = [[], allFlags, ...e.flags.map(f => [f])];
    const tids = e.id === 'traverse' ? ['apollo-15', 'apollo-16', 'apollo-17', 'artemis-4'] : ['x'];
    const shorts = /^tli/.test(e.id) ? [false, true] : [false];
    for (const choice of e.choices)
      for (const [di, dv] of D.entries())
        for (const flagSet of flagSets)
          for (const [si, state] of STATES.entries())
            for (const tid of tids)
              for (const tliShort of shorts) {
                const d = Array(27).fill(dv);
                const flags = Object.fromEntries(flagSet.map(f => [f, true]));
                const round = {
                  flightTruth: { id: tid, d, flags, fuelcellRecovers: d[0] < flights.ODDS.fuelcellRecovers },
                  ascent: { tliShort },
                };
                const out = flights.resolve(round, e.id, choice, copy(state));
                cases.push(
                  [e.id, choice, di, flagSet.join(','), si, tid, tliShort ? 1 : 0, outIndex(copy(out))].join('|'),
                );
              }
  }
  return { d: D, states: STATES, table, outs, cases };
}

export function record(write) {
  write('space-race.json', recordRace());
  write('space-entry.json', recordEntry());
  write('space-capsule.json', recordCapsule());
  write('space-orbit.json', recordOrbit());
  write('space-flights.json', recordFlights());
  write('space-resolve.json', recordResolve());
}
