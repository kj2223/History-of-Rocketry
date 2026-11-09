// Aaron's playtest, 9 November: on a full-duration Aerobee firing the dugout's strip-chart recorder drew only the
// chamber and tank, while the stand panel's chart also drew the amber wall-temperature track. The recorder on the
// dugout wall now draws it too, with the limit dashed, and its caption says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { drawInterior } from '../js/site/interiors.js';

const render = () => {
  const strokes = [],
    texts = [];
  const ctx = new Proxy(
    {
      stroke() {
        strokes.push(this.strokeStyle);
      },
      fillText: t => texts.push(t),
      measureText: text => ({ width: text.length * 6 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  drawInterior(ctx, g, { w: 1200, h: 760 });
  return { strokes, texts };
};

test('a full-duration firing draws the amber wall track on the dugout recorder', () => {
  newGame(8);
  g.vehicle = 'aerobee';
  g.room = 'static';
  const trace = [...Array(30)].map((_, t) => ({ t, tank: 22, pc: 20, wall: 300 + t * 10 }));
  g.stand = { phase: 'firing', burn: 'long', trace, shown: 20 };
  const long = render();
  assert.ok(long.strokes.includes('#c98a1c'), 'amber track drawn');
  assert.ok(long.texts.some(t => /amber wall temperature/.test(t)));
  // A start-up firing has no wall pickup in use: no amber, and the caption stays as it was.
  g.stand = { phase: 'firing', burn: 'short', trace: trace.map(({ wall, ...p }) => p), shown: 5 };
  const short = render();
  assert.ok(!short.strokes.includes('#c98a1c'));
  assert.ok(short.texts.includes('Recorder: red chamber, blue tank'));
});
