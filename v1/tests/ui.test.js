// UI contract (freeze §10.1): the UI imports only the façade, the calendar label and the storage fallback,
// and its source never names hidden-truth identifiers, so it cannot render them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MECHANISMS } from '../js/data/physical.js';

const src = readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');

test('UI imports only the façade, calendar label and storage fallback', () => {
  const imports = [...src.matchAll(/^import .* from '([^']+)';/gm)].map(m => m[1]);
  assert.deepEqual(imports.sort(), ['../js/core/calendar.js', '../js/core/save.js', '../js/rules/index.js']);
  assert.match(src, /import \{ dateLabel \} from/);
  assert.match(src, /import \{ memoryStorage \} from/);
});

test('UI source never names the physical layer or any mechanism id', () => {
  for (const word of ['physical', 'traces', 'trueDefectMechanism', ...Object.keys(MECHANISMS)]) assert.equal(src.includes(word), false, `ui/app.js mentions "${word}"`);
});

test('UI sends only commands the façade knows', async () => {
  const { COMMAND_TYPES } = await import('../js/rules/index.js');
  const used = new Set([...src.matchAll(/(?:act|send)\('([a-z-]+)'/g), ...src.matchAll(/\['([a-z-]+)', '(?:administrator|technical-director|[a-z-]+)', \{/g)].map(m => m[1]));
  assert.ok(used.size > 10);
  for (const type of used) assert.ok(COMMAND_TYPES.includes(type), `UI uses unknown command ${type}`);
});
