// Twilight launches (fx/twilight.js), the lingering smoke column (fx/launch.js) and the Moon's real phase
// (fx/daylight.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { twilightOf } from '../js/stage/fx/twilight.js';
import { moonPhase, moonAt, SUNSET, SUNRISE } from '../js/stage/fx/daylight.js';
import { shear, LINGER } from '../js/stage/fx/launch.js';

test('the high sky is sunlit only in the hour or two around sunset and sunrise', () => {
  assert.equal(twilightOf(12), 0);
  assert.equal(twilightOf(0), 0);
  assert.ok(twilightOf(SUNSET + 0.3) > 0.8);
  assert.ok(twilightOf(SUNRISE - 0.3) > 0.8);
  assert.ok(twilightOf(SUNSET + 1.5) < twilightOf(SUNSET + 0.5));
});

test('the Moon has the phase it really had', () => {
  // Full moon on 6 December 1957 (Vanguard TV-3); Apollo 11 landed under a waxing crescent about six days old.
  const near = (p, want, tol = 0.04) => Math.abs(((((p - want) % 1) + 1.5) % 1) - 0.5) < tol;
  assert.ok(near(moonPhase(1957, 12, 6), 0.5));
  assert.ok(near(moonPhase(1969, 7, 20), 0.22, 0.05));
  assert.ok(near(moonPhase(2024, 4, 8, 18), 0, 0.03)); // the April 2024 solar eclipse: new moon
  // A full moon rises at sunset in the east and is up all night; a new moon is down at midnight.
  assert.ok(moonAt(0.5, 19).along !== null && moonAt(0.5, 19).along < 0.2);
  assert.equal(moonAt(0, 0).along, null);
  assert.ok(moonAt(0.5, 0).lit > 0.99 && moonAt(0, 12).lit < 0.01);
});

test('the smoke column lingers and leans more higher up', () => {
  assert.ok(LINGER >= 20);
  assert.ok(shear(20, 1200) > shear(20, 200));
  assert.equal(shear(0, 500), 0);
});
