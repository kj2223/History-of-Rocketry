// UI contract (freeze §10.1): the UI imports only the façade, the calendar label, the storage fallback and
// its own side panels, and its source never names hidden-truth identifiers, so it cannot render them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MECHANISMS } from '../js/data/physical.js';

const read = f => readFileSync(new URL(`../ui/${f}`, import.meta.url), 'utf8');
const src = read('app.js');
const sides = { 'panels.js': read('panels.js'), 'world.js': read('world.js') };

const importsOf = text => [...text.matchAll(/^import .* from '([^']+)';/gm)].map(m => m[1]).sort();

test('UI imports only the façade, calendar label, storage fallback and side panels', () => {
  assert.deepEqual(importsOf(src), ['../js/core/calendar.js', '../js/core/save.js', '../js/rules/index.js', './panels.js']);
  assert.match(src, /import \{ dateLabel \} from/);
  assert.match(src, /import \{ memoryStorage \} from/);
});

test('UI source never names the physical layer or any mechanism id', () => {
  for (const [file, text] of Object.entries({ 'app.js': src, 'panels.js': sides['panels.js'] }))
    for (const word of ['physical', 'traces', 'trueDefectMechanism', ...Object.keys(MECHANISMS)]) assert.equal(text.includes(word), false, `ui/${file} mentions "${word}"`);
});

test('Side panels read only the calendar and their headlines, and send no commands', () => {
  assert.deepEqual(importsOf(sides['panels.js']), ['../js/core/calendar.js', './world.js']);
  assert.deepEqual(importsOf(sides['world.js']), []); // plain period text (it says "Geophysical"), so it can reach no state
  assert.doesNotMatch(sides['panels.js'], /dispatch|advance\(|act\(|send\(/);
});

test('UI sends only commands the façade knows', async () => {
  const { COMMAND_TYPES } = await import('../js/rules/index.js');
  const used = new Set([...src.matchAll(/(?:act|send)\('([a-z-]+)'/g), ...src.matchAll(/\['([a-z-]+)', '(?:administrator|technical-director|[a-z-]+)', \{/g)].map(m => m[1]));
  assert.ok(used.size > 10);
  for (const type of used) assert.ok(COMMAND_TYPES.includes(type), `UI uses unknown command ${type}`);
});
