// GOLDEN TRACES: what the JS game does, written down so the C# port (kj2223/ad-astra: AdAstra.Rules) can be checked against it.
// Each part the port has reached adds a recorder here; the C# tests in ad-astra's AdAstra.Rules.Tests replay the same seeds
// and compare. Run after any rules change on the JS side:  node tools/golden/record.mjs
// Writes <ad-astra>/AdAstra.Rules.Tests/Golden/*.json, checked in to the Unity repo.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newStreams, draw, normal } from '../../js/core/rng.js';
import { exportSave, FLIGHT, MANAGEMENT, DESK } from '../../js/core/save.js';
import { newRound, meterReading, crewInspect, flagSpots, leakCheck, tankGauge, spotLooksBad, staticFire } from '../../js/truth/round.js';
import { KITS } from '../../js/data/kits.js';

const here = dirname(fileURLToPath(import.meta.url));
// The output folder is given on the command line: the Unity repo (kj2223/ad-astra) passes its own AdAstra.Rules.Tests/Golden.
if (!process.argv[2]) {
  console.error('Usage: node tools/golden/record.mjs <Unity repo>/AdAstra.Rules.Tests/Golden');
  process.exit(2);
}
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data, null, 1) + '\n');

// Random streams: for a spread of seeds, the first draws and normals of each stream.
const SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff];
write(
  'rng.json',
  SEEDS.map(seed => {
    const streams = newStreams(seed);
    const rec = { seed, start: Object.fromEntries(Object.entries(streams).map(([k, s]) => [k, s.state])) };
    rec.draws = Object.fromEntries(Object.entries(streams).map(([k, s]) => [k, Array.from({ length: 16 }, () => draw(s))]));
    rec.normals = Array.from({ length: 8 }, () => normal(streams.physical));
    rec.end = Object.fromEntries(Object.entries(streams).map(([k, s]) => [k, s.state]));
    return rec;
  }),
);

// Save envelopes: exactly the text each mode writes.
const checkpoint = { day: 3, year: 1946, round: { id: 'wac-1', ok: true, apogee: 70.25 }, people: ['vega', 'morgan'] };
write('saves.json', {
  checkpoint,
  flight: exportSave(checkpoint, FLIGHT),
  management: exportSave(checkpoint, MANAGEMENT),
  desk: exportSave(checkpoint, DESK),
});

// Round creation and inspection, for every vehicle: faults, cues, latent mechanisms, the streams' end states, and the
// meter/crew/flag/leak actions after. The C# tests replay these in the same order (ad-astra: AdAstra.Rules/Truth/Round.cs).
const ROUND_SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
const VEHICLES = Object.keys(KITS);
const PROGRAMMES = {
  default: null,
  // A production lot that already shipped a weld flaw: higher risk, latents likelier (world/programme.js: batch).
  lot: { lotVehicle: 'wac', batch: { weld: true }, weldRisk: 0.9 },
};
write('round.json', [
  ...VEHICLES.map(vehicle =>
    ROUND_SEEDS.map(seed => ({ programme: 'default', vehicle, case: recordRound(seed, vehicle, null) })),
  ).flat(),
  ...ROUND_SEEDS.map(seed => ({ programme: 'lot', vehicle: 'wac', case: recordRound(seed, 'wac', PROGRAMMES.lot) })),
]);

function recordRound(seed, vehicle, programme) {
  const r = newRound(seed, programme, vehicle);
  const spots = Object.keys(KITS[vehicle].spots);
  const out = {
    seed,
    vehicle,
    spots,
    faults: { ...r.faults },
    cues: Object.fromEntries(spots.map(id => [id, spotLooksBad(r, id)])),
    latent: r.physical.latentMechanisms,
    wind: r.wind,
    streamEnd: { physical: r.rng.physical.state, observation: r.rng.observation.state, forecast: r.rng.forecast.state },
    thrust: r.thrust ?? null,
    navdata: r.navdata ?? null,
    dustcap: r.dustcap ?? null,
    lightning: r.lightning ?? null,
    throttle: r.throttle ?? null,
    meters: Object.fromEntries(spots.map(id => [id, meterReading(r, id)])),
    tank: [0, 10, 60, 120].map(s => tankGauge(r, s)),
  };
  out.crew1 = crewInspect(r, { hit: 0.9, falseAlarm: 0.1 });
  out.streamAfterCrew = { physical: r.rng.physical.state, observation: r.rng.observation.state, forecast: r.rng.forecast.state };
  out.crew2 = crewInspect(r, { hit: 0.4, falseAlarm: 0.5 });
  out.leak = leakCheck(r);
  out.faultsAfterLeak = { ...r.faults };
  const flagIds = [];
  const faulty = Object.keys(r.faults)[0];
  if (faulty != null) flagIds.push(faulty);
  const sound = spots.find(id => !r.faults[id] && !flagIds.includes(id));
  if (sound != null) flagIds.push(sound);
  out.flagIds = flagIds;
  out.flagHours = flagSpots(r, flagIds);
  out.events = r.events;
  out.faultsAfterFlags = { ...r.faults };
  return out;
}

// The stand: static firings on a fresh round of the same seed, short and long burns. Only the vehicles with a
// physical layer yet (data/vehicles.js VEHICLE_QUANTITIES): the sounding-era fleet. The recorder replays creation
// itself, so the C# test does NewRound then StaticFire and compares trace, steady, wall, the hold-down outcome, the
// events and the streams' end states.
const STAND_VEHICLES = ['wac', 'aerobee', 'v2', 'bumper', 'viking', 'vanguard', 'juno', 'ranger'];
write('stand.json', [
  ...STAND_VEHICLES.map(vehicle =>
    ROUND_SEEDS.map(seed => ({
      vehicle,
      seed,
      short: recordStand(seed, vehicle, 'short', null),
      long: recordStand(seed, vehicle, 'long', null),
    })),
  ).flat(),
  ...ROUND_SEEDS.map(seed => ({ vehicle: 'wac', seed, programme: 'lot', short: recordStand(seed, 'wac', 'short', PROGRAMMES.lot) })),
]);

function recordStand(seed, vehicle, burn, programme) {
  const r = newRound(seed, programme, vehicle);
  const fire = staticFire(r, burn);
  return {
    trace: fire.trace.map(p => (p.wall != null ? { t: p.t, pc: p.pc, tank: p.tank, wall: p.wall } : { t: p.t, pc: p.pc, tank: p.tank })),
    steady: fire.steady,
    wall: fire.wall ?? null,
    loose: fire.loose ?? null,
    events: r.events,
    streamEnd: { physical: r.rng.physical.state, observation: r.rng.observation.state, forecast: r.rng.forecast.state },
  };
}

// The parts of the port recorded in their own modules (tools/golden/<part>.mjs), each exporting record(write).
// One of them alone: node tools/golden/run-one.mjs <part> <folder>.
export const PARTS = ['count', 'fly', 'programme', 'rework', 'jsmath', 'calendar', 'campaign', 'datafns', 'desk', 'roundjson', 'space', 'world', 'manage', 'console-panel'];
for (const part of PARTS) (await import(`./${part}.mjs`)).record(write);

console.log(`Golden traces written to ${out}`);
