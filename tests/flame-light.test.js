// The flame as a moving light (fx/flame-light.js): the shadow geometry and how wet the ground is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shadowReach, wetness } from '../js/stage/fx/flame-light.js';

test('shadows fall away from the flame and shorten as she climbs', () => {
  // A wall 100 units tall, 300 units left of the flame.
  const low = shadowReach(1000, 120, 700, 100),
    high = shadowReach(1000, 800, 700, 100);
  assert.ok(low < 700 && high < 700, 'away from the flame');
  assert.ok(700 - low > 700 - high, 'longer while she is low');
  // On the other side it falls the other way.
  assert.ok(shadowReach(1000, 300, 1300, 100) > 1300);
  // A flame barely over the wall throws a shadow as long as the cap.
  assert.equal(shadowReach(1000, 60, 700, 100, 500), 200);
});

test('the ground is wet in rain and after storms, dry on a clear day', () => {
  assert.equal(wetness({ kind: 'clear', rain: 0 }), 0);
  assert.ok(wetness({ kind: 'rain', rain: 0.8 }) > 0.9);
  assert.ok(wetness({ kind: 'storms', rain: 0, thunder: 1 }) > 0.2);
  assert.equal(wetness(null), 0);
});
