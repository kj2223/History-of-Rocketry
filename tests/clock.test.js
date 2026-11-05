import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, catchUpSeconds, MAX_CATCHUP_SECONDS } from '../js/core/clock.js';

function harness() {
  let t = 0, cb = null, timers = 0;
  const steps = [];
  const clock = createClock(n => steps.push(n), {
    now: () => t,
    setTimer: f => { cb = f; return ++timers; },
    clearTimer: () => { cb = null; },
  });
  return { clock, steps, advance: ms => { t += ms; }, fire: () => cb && cb(), running: () => cb != null };
}

test('clock ticks one second per interval while visible', () => {
  const h = harness();
  h.fire(); h.fire();
  assert.deepEqual(h.steps, [1, 1]);
});

test('hiding the page stops the tick', () => {
  const h = harness();
  h.clock.pause();
  assert.equal(h.running(), false);
  h.fire();
  assert.deepEqual(h.steps, []);
});

test('returning applies one catch-up of the whole seconds hidden', () => {
  const h = harness();
  h.clock.pause(); h.advance(12500); h.clock.resume();
  assert.deepEqual(h.steps, [12]);
  assert.equal(h.running(), true);
});

test('a long absence is clamped to one capped delta', () => {
  const h = harness();
  h.clock.pause(); h.advance(8 * 3600 * 1000); h.clock.resume();
  assert.deepEqual(h.steps, [MAX_CATCHUP_SECONDS]);
});

test('a sub-second absence applies nothing; repeated pause/resume do not double count', () => {
  const h = harness();
  h.clock.pause(); h.clock.pause(); h.advance(500); h.clock.resume(); h.clock.resume();
  assert.deepEqual(h.steps, []);
  assert.equal(catchUpSeconds(-5000), 0);
});
