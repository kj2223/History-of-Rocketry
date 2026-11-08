// The walk-in rooms: which rooms leave the site for a scene of their own inside.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interiorOf } from '../js/site/interiors.js';

test('the blockhouse, the hangar and the dugout open into their own scenes; the office stays a panel over the site', () => {
  const at = (room, crewed = false, extra = {}) => interiorOf({ room, crewed, ...extra });
  assert.equal(at('count'), 'blockhouse');
  assert.equal(at('watch:blockhouse'), 'blockhouse');
  assert.equal(at('inspect'), 'hangar');
  assert.equal(at('watch:hangar'), 'hangar');
  assert.equal(at('static'), 'dugout');
  assert.equal(at('watch:dugout'), 'dugout');
  assert.equal(at('board'), null);
  assert.equal(at('watch:office'), null);
  assert.equal(at(null), null);
  // The crewed years: Hangar S's checkout and the simulator; Mercury Control keeps its own scene.
  assert.equal(at('checkout', true), 'hangar');
  assert.equal(at('sim', true), 'sim');
  assert.equal(at('console', true), null);
  assert.equal(at('watch:blockhouse', true), null);
  // The range plot takes the screen while she flies.
  assert.equal(at('count', false, { flight: { view: 'board' } }), null);
});
