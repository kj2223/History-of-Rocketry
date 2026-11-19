// Depth in the rooms (fx/room-depth.js): the haze follows the years the rooms were smoky.
import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeOf } from '../js/stage/fx/room-depth.js';

test('the control rooms are smokiest through Apollo and clear by the glass years', () => {
  assert.equal(smokeOf(1969), 1);
  assert.ok(smokeOf(1981) < smokeOf(1969));
  assert.ok(smokeOf(2028) < smokeOf(1981));
  assert.ok(smokeOf(2028) > 0, 'a little dust in the light');
});
