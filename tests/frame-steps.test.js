import test from 'node:test';
import assert from 'node:assert/strict';
import { frameSteps, MAX_STEP, MAX_CATCH_UP } from '../js/core/frame-steps.js';
import { g, newGame, tick, finishInspection, finishBoard, endDay, standStart } from '../js/game.js';

const sum = a => a.reduce((x, y) => x + y, 0);

test('a slow frame is played in full, in small steps', () => {
  for (const secs of [0.016, 0.05, 0.125, 0.4]) {
    const steps = frameSteps(secs);
    assert.ok(Math.abs(sum(steps) - secs) < 1e-9, `${secs} s played as ${sum(steps)}`);
    assert.ok(steps.every(s => s > 0 && s <= MAX_STEP + 1e-12));
  }
  assert.ok(Math.abs(sum(frameSteps(5)) - MAX_CATCH_UP) < 1e-9, 'a long stall is not caught up');
  assert.deepEqual(frameSteps(-1), []);
});

// Aaron, 12 Nov: the static firing took ten times as long to start. At 8 frames a second the count must still take
// about ten real seconds, as it does at 60.
test('the static fire count takes ten real seconds even at 8 frames a second', () => {
  newGame(42);
  const until = (done, limit = 20000) => {
    g.speed = 16;
    for (let i = 0; i < limit && !done(); i++) tick(0.05);
    assert.ok(done(), `stuck at beat ${g.beat}`);
  };
  finishInspection({});
  finishBoard();
  endDay();
  until(() => !g.fading);
  until(() => g.beat === 'static');
  standStart();
  g.speed = 1;
  let real = 0;
  while (g.stand.phase === 'count' && real < 60) {
    for (const s of frameSteps(1 / 8)) tick(s);
    real += 1 / 8;
  }
  assert.equal(g.stand.phase, 'firing');
  assert.ok(real >= 9.5 && real <= 10.5, `count took ${real} s`);
});
