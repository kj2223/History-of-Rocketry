// Records one part of the golden traces on its own: node tools/golden/run-one.mjs <part> <folder>.
// The parts are the modules beside this file that export record(write); record.mjs runs them all.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [part, folder] = process.argv.slice(2);
if (!part || !folder) {
  console.error('Usage: node tools/golden/run-one.mjs <part> <folder>');
  process.exit(2);
}
const out = resolve(folder);
mkdirSync(out, { recursive: true });
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data, null, 1) + '\n');
(await import(`./${part}.mjs`)).record(write);
console.log(`Golden traces for ${part} written to ${out}`);
