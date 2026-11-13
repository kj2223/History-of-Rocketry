// Raising a round into the tower (js/site/draw.js): she pivots up from lying on the truck to upright over the job,
// eased at both ends, and only while that job is running.
import test from 'node:test';
import assert from 'node:assert/strict';
import { raiseShare, raiseAngle } from '../js/site/draw.js';

test('she lies flat at the start of the raise and stands upright at the end, with no jerk at either end', () => {
  assert.ok(Math.abs(raiseAngle(0) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(raiseAngle(1)) < 1e-9);
  const step = k => Math.abs(raiseAngle(k + 0.01) - raiseAngle(k));
  assert.ok(step(0) < step(0.5) / 5 && step(0.99) < step(0.5) / 5);
});

test('the raise follows the job, and there is no raise without it', () => {
  assert.equal(raiseShare({ jobs: [] }), null);
  assert.equal(raiseShare({ jobs: [{ label: 'Mating the booster', minutes: 60, left: 30 }] }), null);
  assert.equal(raiseShare({ jobs: [{ label: 'Raising into the tower', minutes: 45, left: 45 }] }), 0);
  assert.equal(raiseShare({ jobs: [{ label: 'Raising into the tower', minutes: 40, left: 10 }] }), 0.75);
});
