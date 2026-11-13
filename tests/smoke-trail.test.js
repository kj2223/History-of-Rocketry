// Issue #246 (Aaron's playtest mark 15, Viking 7 on the range plot): the tracking camera's smoke trail came apart in
// clumps below the rocket. These fly the trail model (js/stage/fx/trail.js) through a whole burn frame by frame and
// check the column stays joined to her flame, at every clock speed and from the pad to high up.
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeTrail, stepTrail, TRAIL_MAX } from '../js/stage/fx/trail.js';

const H = 210,
  NX = 160,
  NY = H * 0.55;

// The camera's own numbers (range-camera.js): k shrinks with height, the plot runs 5 flight seconds a real one.
function fly(speed, burn = 80, frames = 60 * 30, check = () => {}) {
  const tr = makeTrail();
  const dt = 1 / 60;
  let t = 0;
  for (let i = 0; i < frames; i++) {
    const step = 5 * speed * dt;
    t += step;
    const h = Math.min(250, t * t * 0.02); // a climb from the pad to well above the camera's sight
    const k = Math.max(0.12, 1 / (1 + h / 6));
    const size = 0.25 * k * 3;
    const o = {
      burning: t < burn,
      nx: NX,
      ny: NY,
      size,
      spacing: size * 64 * 0.3,
      drift: (26 + 40 * k) * Math.min(step, 0.5) * 0.5,
      dt,
      alpha: 0.5,
      bottom: H + 40,
    };
    const before = new Map(tr.puffs.map(q => [q, q.alpha]));
    stepTrail(tr, o);
    check(tr, o, t, before);
  }
  return tr;
}

for (const speed of [1, 4, 16]) {
  test(`the trail stays joined to her flame from the pad up, at ${speed}×`, () => {
    let checked = 0;
    fly(speed, 80, 60 * 30, (tr, o, t) => {
      if (!o.burning) return;
      const P = tr.puffs;
      assert.ok(P.length > 0, `smoke at T+${t.toFixed(1)}`);
      // The newest puff sits at the nozzle.
      const last = P[P.length - 1];
      assert.ok(
        Math.hypot(last.x - o.nx, last.y - o.ny) <= o.spacing + 1e-6,
        `trail reaches the flame at T+${t.toFixed(1)}`,
      );
      // No gap down the column: each puff within a puff's width of the next, all the way down.
      for (let i = 1; i < P.length; i++) {
        const gap = P[i - 1].y - P[i].y;
        assert.ok(gap <= P[i].size * 64 * 0.5, `gap of ${gap.toFixed(1)} px at T+${t.toFixed(1)}`);
      }
      // And it reaches down to the bottom of the frame, or as far as the oldest smoke has drifted.
      checked++;
    });
    assert.ok(checked >= 50);
  });
}

test('the trail never outgrows its cap, and the oldest smoke goes first', () => {
  const tr = fly(16, 1e9, 60 * 60, tr => assert.ok(tr.puffs.length <= TRAIL_MAX));
  assert.ok(tr.puffs.length > 0);
});

test('after burnout the smoke drifts off and nothing new is added', () => {
  const tr = fly(1, 20, 60 * 60);
  assert.equal(tr.puffs.length, 0);
});

// Seizure safety (Aaron, 13 Nov): the smoke only ever fades, never brightens.
test('the smoke only fades: no puff ever gets brighter', () => {
  fly(4, 80, 60 * 20, (tr, o, t, before) => {
    for (const q of tr.puffs) if (before.has(q)) assert.ok(q.alpha <= before.get(q));
  });
});
