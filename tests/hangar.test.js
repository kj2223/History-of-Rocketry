import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { drawInterior } from '../js/site/interiors.js';

test('the WAC fitting drawing follows observed inspection and repair evidence', () => {
  newGame(8);
  g.room = 'inspect';
  g.rocket.where = 'hangar';
  const fills = [];
  const rotations = [];
  const ctx = new Proxy(
    {
      fill() {
        fills.push(this.fillStyle);
      },
      rotate(angle) {
        rotations.push(angle);
      },
      measureText: text => ({ width: text.length * 6 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  const render = () => {
    fills.length = 0;
    drawInterior(ctx, g, { w: 1200, h: 760 });
  };
  render();
  assert.ok(rotations.includes(-Math.PI / 2), 'the WAC points left, as it does in the site view');
  assert.ok(!fills.includes('#698744'));
  g.looked.fitting = false;
  render();
  assert.ok(!fills.includes('#698744'));
  g.looked.fitting = true;
  render();
  assert.ok(fills.includes('#698744'));
  g.decided.leakFixed = 'Acid feed fitting';
  render();
  assert.ok(!fills.includes('#698744'));
});
