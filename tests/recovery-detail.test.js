// The recovery scene's detail pass (js/stage/recovery.js): which craft Recovery sees, by vehicle. The drawing itself
// needs a browser and is checked by eye; the module must load without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { craftOf } from '../js/stage/recovery.js';

test('each vehicle brings home the craft Recovery expects', () => {
  assert.equal(craftOf({ vehicle: 'redstone' }), 'mercury');
  assert.equal(craftOf({ vehicle: 'titan' }), 'gemini');
  assert.equal(craftOf({ vehicle: 'saturn5' }), 'apollo');
  assert.equal(craftOf({ vehicle: 'shuttle' }), 'shuttle');
  assert.equal(craftOf({ vehicle: 'dragon' }), 'dragon');
  assert.equal(craftOf({ vehicle: 'sls' }), 'orion');
});
