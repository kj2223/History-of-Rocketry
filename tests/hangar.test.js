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

// Aaron's playtest, 9 November: the acid feed fitting's card covered the tank's. No two cards in the hangar overlap.
test('no inspection card in the hangar covers another', async () => {
  const { kit } = await import('../js/game.js');
  for (const looked of [false, true]) {
    newGame(8);
    g.room = 'inspect';
    g.rocket.where = 'hangar';
    if (looked) for (const id of Object.keys(kit().spots)) g.looked[id] = true;
    const cards = [];
    const ctx = new Proxy(
      {
        roundRect(x, y, w, h) {
          if (w === 230) cards.push({ x, y, w, h });
        },
        measureText: text => ({ width: text.length * 6 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
      },
      { get: (target, key) => target[key] ?? (() => {}) },
    );
    drawInterior(ctx, g, { w: 1200, h: 760 });
    assert.ok(cards.length >= 2, `${cards.length} cards`);
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i],
          b = cards[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `cards ${i} and ${j} overlap: ${JSON.stringify([a, b])}`);
      }
  }
});
