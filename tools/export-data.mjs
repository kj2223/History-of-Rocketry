// THE DATA FOR THE UNITY GAME: every export of js/data/*.js written out as JSON, so the history text, dates and
// numbers reach the C# port by copying, never retyping. Functions cannot be JSON: each one is listed in
// _functions.json with its source, so the port translates those few by hand and none are missed.
// Run after any change to js/data:  node tools/export-data.mjs
// Writes unity/AdAstra/Assets/AdAstra/Data/*.json (checked in).
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../js/data');
const out = join(here, '../unity/AdAstra/Assets/AdAstra/Data');
mkdirSync(out, { recursive: true });

const functions = [];
const nonFinite = [];
// Walk a value, replacing functions with a marker and remembering where they were.
const clean = (v, path, seen) => {
  if (typeof v === 'function') {
    functions.push({ path, source: v.toString().slice(0, 4000) });
    return { $function: path };
  }
  if (typeof v === 'number' && !Number.isFinite(v)) {
    nonFinite.push(path);
    return { $number: String(v) };
  }
  if (v === undefined) return null;
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return { $ref: seen.get(v) };
  seen.set(v, path);
  if (v instanceof Map) return { $map: [...v].map(([k, x], i) => [k, clean(x, `${path}<${i}>`, seen)]) };
  if (v instanceof Set) return { $set: [...v].map((x, i) => clean(x, `${path}{${i}}`, seen)) };
  if (Array.isArray(v)) return v.map((x, i) => clean(x, `${path}[${i}]`, seen));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x, `${path}.${k}`, seen)]));
};

const files = readdirSync(src)
  .filter(f => f.endsWith('.js'))
  .sort();
for (const f of files) {
  const mod = await import(pathToFileURL(join(src, f)).href);
  const name = basename(f, '.js');
  const seen = new Map();
  const data = Object.fromEntries(Object.entries(mod).map(([k, v]) => [k, clean(v, `${name}.${k}`, seen)]));
  writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 1) + '\n');
}
writeFileSync(join(out, '_functions.json'), JSON.stringify(functions, null, 1) + '\n');
if (nonFinite.length) writeFileSync(join(out, '_non-finite.json'), JSON.stringify(nonFinite, null, 1) + '\n');
console.log(`${files.length} data modules exported to ${out}; ${functions.length} functions to translate by hand.`);
