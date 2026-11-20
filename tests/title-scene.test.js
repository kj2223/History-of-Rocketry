import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftAt, DRIFT_SPAN, DRIFT_PERIOD, titleShowing } from '../js/site/title-scene.js';
import { WORLD_W } from '../js/data/white-sands.js';

test('the camera drifts slowly about where you left it, and stays on the site', () => {
  const viewW = 1000;
  for (const x0 of [0, 400, 1500, WORLD_W - viewW]) {
    let lo = Infinity,
      hi = -Infinity,
      prev = x0;
    assert.equal(driftAt(x0, 0, viewW), x0);
    for (let t = 0; t <= DRIFT_PERIOD; t += 0.5) {
      const x = driftAt(x0, t, viewW);
      assert.ok(x >= 0 && x <= WORLD_W - viewW);
      assert.ok(Math.abs(x - prev) < 30, 'no jumps: a slow pan');
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
      prev = x;
    }
    assert.ok(
      hi - lo <=
        DRIFT_SPAN + Math.abs(x0 - Math.max(DRIFT_SPAN / 2, Math.min(WORLD_W - viewW - DRIFT_SPAN / 2, x0))) + 1e-6,
    );
    assert.ok(hi - lo > DRIFT_SPAN * 0.5);
  }
});

test('with Calm effects the camera holds still', () => {
  for (const t of [0, 10, 33]) assert.equal(driftAt(700, t, 1000, true), 700);
});

test('the title is not showing until a frame draws it', () => {
  assert.equal(titleShowing(), false);
});
