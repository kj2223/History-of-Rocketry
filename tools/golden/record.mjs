// GOLDEN TRACES: what the JS game does, written down so the C# port (unity/AdAstra.Rules) can be checked against it.
// Each part the port has reached adds a recorder here; the C# tests in unity/AdAstra.Rules.Tests replay the same seeds
// and compare. Run after any rules change on the JS side:  node tools/golden/record.mjs
// Writes unity/AdAstra.Rules.Tests/Golden/*.json (checked in).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newStreams, draw, normal } from '../../js/core/rng.js';
import { exportSave, FLIGHT, MANAGEMENT, DESK } from '../../js/core/save.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../unity/AdAstra.Rules.Tests/Golden');
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

console.log(`Golden traces written to ${out}`);
