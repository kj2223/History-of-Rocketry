// Golden traces for the port's flight (ad-astra: AdAstra.Rules/Truth/RoundFly.cs, Stages.cs, Physical.cs). Writes fly.json:
//   fly       newRound then fly() for the sounding-era fleet, every ROUND_SEEDS seed, then Ellis's two readings, including
//             the rounds that leave the sounding path (a good Vanguard to orbit, a lunar shot on its way or stranded:
//             orbit(), launchProbe(), deep()) with what they hand the tracking stations (orbit, deep).
//   loose     flyLoose() on a fresh round.
//   staff     flyStaffRound().
//   stacks    truth/stages.js directly: liftoffMass, stackBurn, burnStack, speedGained, fitStack, flySounding.
//   runTest   the flight branch of truth/physics.js runTest, with the standing fixes and revisions it reads.
// Paths are recorded whole, one point a second, as three parallel arrays (t, x, h) to keep the file small.
import { newRound, fly, flyLoose, ellisReading, flyStaffRound } from '../../js/truth/round.js';
import { runTest, sampleAt, discardTrace } from '../../js/truth/physics.js';
import { G0, liftoffMass, stackBurn, burnStack, speedGained, fitStack, flySounding } from '../../js/truth/stages.js';
import { SOUNDING_STACKS, ORBITAL_STACKS } from '../../js/data/stacks.js';

const ROUND_SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
const VEHICLES = ['wac', 'aerobee', 'v2', 'bumper', 'viking', 'vanguard', 'juno', 'ranger'];
const LOT = { lotVehicle: 'wac', batch: { weld: true }, weldRisk: 0.9 };
// A build with the standing fixes in it and a short propellant load: the fixes move apogee and deviation in runTest, the
// load scales fly()'s apogee.
const FIXED = { adopted: ['weld', 'leak', 'fin'] };
const streams = r => ({
  physical: r.rng.physical.state,
  observation: r.rng.observation.state,
  forecast: r.rng.forecast.state,
});
const columns = path => ({ t: path.map(p => p.t), x: path.map(p => p.x), h: path.map(p => p.h) });

const branchOf = f => (f.orbit ? 'orbit' : f.deep ? (f.failure === 'agena' ? 'deep' : 'probe') : 'sounding');

function recordFly(seed, vehicle, programmeName, programme, load = 1) {
  const r = newRound(seed, programme, vehicle);
  r.propellantLoad = load;
  const base = { vehicle, seed, programme: programmeName, load };
  const f = fly(r);
  // The flights that leave the range plot go through `Math.sin(..) ** 0.8` and `f ** 1.6`, and V8's pow on a fraction
  // can differ between Windows and Linux in the last bit. Written to 12 significant figures their numbers come out the
  // same on every machine; the C# compares them within 1e-10.
  const n = f.orbit || f.deep ? x => (x == null ? x : Number(x.toPrecision(12))) : x => x;
  const last = f.path[f.path.length - 1];
  const out = {
    ...base,
    branch: branchOf(f),
    orbit: f.orbit ? { perigee: n(f.orbit.perigee), apogee: n(f.orbit.apogee) } : null,
    deep: f.deep ?? null,
    culprit: r.physical.culprit,
    apogee: n(f.apogee),
    range: n(f.range),
    failure: f.failure,
    failAt: f.failAt,
    burn: f.burn,
    landing: { t: last.t, x: n(last.x), h: n(last.h) },
    path: { t: f.path.map(p => p.t), x: f.path.map(p => n(p.x)), h: f.path.map(p => n(p.h)) },
    radar: n(f.radar),
    hidden: !!r.hiddenFailure,
    events: [...r.events],
    streamEnd: streams(r),
  };
  // Ellis's reading at the review: plain, then with the wreck unfound and with and without the tracking film.
  out.ellis = [ellisReading(r)];
  r.unfound = true;
  out.ellis.push(ellisReading(r));
  r.filmed = true;
  out.ellis.push(ellisReading(r));
  out.streamAfterEllis = streams(r);
  return out;
}

function recordLoose(seed, vehicle) {
  const r = newRound(seed, null, vehicle);
  const f = flyLoose(r);
  const out = {
    vehicle,
    seed,
    apogee: f.apogee,
    range: f.range,
    failure: f.failure,
    failAt: f.failAt,
    burn: f.burn,
    path: columns(f.path),
    radar: f.radar,
  };
  out.ellis = ellisReading(r);
  out.streamEnd = streams(r);
  return out;
}

// stages.js directly. gamma for speedGained: a pitch programme from vertical to level over 300 s, the same in the C# test.
const gamma = t => Math.max(0, 90 - 0.3 * t);
function recordStacks() {
  const out = [];
  const burnCases = (name, stack, cuts) =>
    cuts.map(([cut, extra]) => {
      const b = burnStack(stack, cut, extra);
      return {
        kind: 'burnStack',
        family: name.family,
        stack: name.vehicle,
        cut,
        extra,
        rows: { t: b.rows.map(r => r.t), stage: b.rows.map(r => r.stage ?? null), acc: b.rows.map(r => r.acc) },
        names: b.rows.map(r => r.name ?? null),
        staging: b.staging,
        burn: b.burn,
        speed: speedGained(b.rows, gamma),
      };
    });
  for (const [vehicle, stack] of Object.entries(SOUNDING_STACKS)) {
    out.push({
      kind: 'mass',
      family: 'sounding',
      stack: vehicle,
      liftoffMass: liftoffMass(stack),
      stackBurn: stackBurn(stack),
    });
    out.push(
      ...burnCases({ family: 'sounding', vehicle }, stack, [
        [null, 0],
        [{ stage: 0, at: 1.4 }, 0],
        [{ stage: stack.stages.length - 1, at: 30 }, 3],
      ]),
    );
    // fitStack over a spread of apogees and leans; flySounding good, cut early, and leaned further than it was fitted.
    for (const apogee of [20, 70, 165, 390, 650])
      for (const deg of [3, 5.5, 12, 43])
        out.push({
          kind: 'fitStack',
          stack: vehicle,
          apogee,
          tilt: (deg * Math.PI) / 180,
          k: fitStack(stack, apogee, (deg * Math.PI) / 180),
        });
    for (const [apogee, deg, extraDeg, cutAt] of [
      [70, 5, 0, null],
      [110, 4, 0, 12],
      [165, 6, 25, 35],
      [390, 3.5, 40, 2],
      [170, 4, 20, 30],
      [650, 4, 0, 145],
      [120000, 4, 0, 60],
      [50, 4, 0, 0],
    ]) {
      // The lunar shots' figure (120000 km) only where the stack's own fit overrides it: a sounding stack would fly there.
      if (apogee > 10000 && !stack.fit) continue;
      const fitTilt = ((3 + deg) * Math.PI) / 180,
        tilt = ((3 + deg + extraDeg) * Math.PI) / 180;
      const f = flySounding(stack, { apogee, fitTilt, tilt, cutAt });
      out.push({
        kind: 'flySounding',
        stack: vehicle,
        apogee,
        fitTilt,
        tilt,
        cutAt,
        out: { apogee: f.apogee, burnout: f.burnout, burn: f.burn, path: columns(f.path) },
      });
    }
    // flySounding with fitTilt left to default to tilt.
    const f = flySounding(stack, { apogee: 100, tilt: 0.1 });
    out.push({
      kind: 'flySounding',
      stack: vehicle,
      apogee: 100,
      fitTilt: null,
      tilt: 0.1,
      cutAt: null,
      out: { apogee: f.apogee, burnout: f.burnout, burn: f.burn, path: columns(f.path) },
    });
  }
  for (const vehicle of ['atlas', 'titan', 'saturn5', 'shuttle']) {
    const stack = ORBITAL_STACKS[vehicle];
    if (!stack) continue;
    out.push({
      kind: 'mass',
      family: 'orbital',
      stack: vehicle,
      liftoffMass: liftoffMass(stack),
      stackBurn: stackBurn(stack),
    });
    out.push(
      ...burnCases({ family: 'orbital', vehicle }, stack, [
        [null, 0],
        [{ stage: 1, at: 200.4 }, 0],
        [null, 25],
      ]),
    );
  }
  return { G0, cases: out };
}

// runTest's flight branch, straight: the stages a round would fly with, and the same with later revisions, and the fixes.
const STAGES = {
  wac: { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': 'wac-upper/r1' },
  aerobee: { 'aerobee-booster': 'aerobee-booster/r1', 'aerobee-sustainer': 'aerobee-sustainer/r1' },
  v2: { v2: 'v2/r1' },
  bumper: { v2: 'v2/r1', 'wac-upper': 'wac-upper/r1' },
  viking: { viking: 'viking/r1' },
  vanguard: { 'vanguard-1': 'vanguard-1/r1' },
  juno: { jupiter: 'jupiter/r1' },
  ranger: { agena: 'agena/r1' },
};
const REVISED = {
  wac: { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': 'wac-upper/r3' },
  aerobee: { 'aerobee-booster': 'aerobee-booster/r1', 'aerobee-sustainer': 'aerobee-sustainer/r2' },
  v2: { v2: 'v2/r2' },
  bumper: { v2: 'v2/r2', 'wac-upper': 'wac-upper/r2' },
  viking: { viking: 'viking/r2' },
  vanguard: { 'vanguard-1': 'vanguard-1/r2' },
  juno: { jupiter: 'jupiter/r2' },
  ranger: { agena: 'agena/r2' },
};
const ADOPTED = [
  [],
  ['weld'],
  ['vanes'],
  ['weld', 'leak'],
  ['fin', 'vanes', 'separation'],
  ['leak', 'separation', 'weld', 'fin', 'vanes', 'holddown'],
];
function recordRunTest(seed, vehicle, revised, adopted, defect) {
  const r = newRound(seed, null, vehicle);
  r.adopted = adopted;
  if (defect) r.physical.trueDefectMechanism = defect;
  const stages = (revised ? REVISED : STAGES)[vehicle];
  const n = runTest(r, 'flight', { kind: 'flight', vehicle, stages, conditions: { burn: 'long' } });
  const samples = [...Array(n).keys()].map(i => sampleAt(r, 'flight', i));
  discardTrace(r, 'flight');
  return {
    vehicle,
    seed,
    stages,
    adopted,
    defect: defect ?? null,
    wind: r.wind,
    latent: r.physical.latentMechanisms,
    culprit: r.physical.culprit,
    samples,
    streamEnd: streams(r),
  };
}

export function record(write) {
  const flights = [
    ...VEHICLES.flatMap(vehicle => ROUND_SEEDS.map(seed => recordFly(seed, vehicle, 'default', null))),
    ...ROUND_SEEDS.map(seed => recordFly(seed, 'wac', 'lot', LOT)),
    ...VEHICLES.flatMap(vehicle => ROUND_SEEDS.slice(0, 4).map(seed => recordFly(seed, vehicle, 'fixed', FIXED, 0.9))),
  ];
  const loose = VEHICLES.flatMap(vehicle => ROUND_SEEDS.slice(0, 3).map(seed => recordLoose(seed, vehicle)));
  const staff = ['wac', 'aerobee', 'v2', 'bumper', 'viking', 'vanguard', 'juno', 'ranger', 'redstone'].flatMap(
    vehicle =>
      ROUND_SEEDS.slice(0, 5).map(seed => {
        try {
          const r = newRound(seed, undefined, vehicle);
          const branch = r && vehicle !== 'redstone' ? branchOf(fly(r)) : null;
          const out = flyStaffRound(vehicle, seed);
          // Off the range plot, the apogee goes through pow: 12 significant figures, as in recordFly.
          if (out && branch && branch !== 'sounding') out.apogee = Number(out.apogee.toPrecision(12));
          return { vehicle, seed, branch, out };
        } catch (e) {
          return { vehicle, seed, error: String(e) };
        }
      }),
  );
  const runTests = VEHICLES.flatMap(vehicle =>
    ROUND_SEEDS.slice(0, 5).flatMap(seed =>
      ADOPTED.map((adopted, i) =>
        recordRunTest(seed, vehicle, i % 2 === 1, adopted, vehicle === 'aerobee' && i === 3 ? 'pm-07' : null),
      ),
    ),
  );
  write('fly.json', { flights, loose, staff, stacks: recordStacks(), runTests });
}
