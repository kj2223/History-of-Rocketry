// Fewer, bigger moments: a day with nothing left ends on its own, the walk-up days run faster, and the launch
// flow can be handed to the team in one jump.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  tick,
  flowTeamAll,
  closeAway,
  finishBoard,
  finishInspection,
  AUTO_END_SECONDS,
  HURRY,
} from '../js/game.js';
import { passFlow, nextDay } from './play.js';

function toEvening(seed) {
  newGame(seed);
  passFlow();
  closeAway();
  if (g.beat === 'brief') finishInspection({});
  finishBoard();
}

test('a finished day ends on its own after a moment, but never under an open room', () => {
  toEvening(7);
  assert.equal(g.beat, 'evening1');
  assert.ok(g.dayDone);
  const day = g.day;
  g.room = 'notebook';
  for (let n = 0; n < (AUTO_END_SECONDS + 1) * 10; n++) tick(0.1);
  assert.equal(g.day, day, 'an open room holds the day');
  g.room = null;
  g.autoEnd = g.time + AUTO_END_SECONDS;
  for (let n = 0; n < (AUTO_END_SECONDS + 1) * 10 && !g.fading; n++) tick(0.1);
  assert.ok(g.fading, 'the day ends without a click');
});

test('the walk-up to the static fire runs faster than an ordinary day', () => {
  toEvening(7);
  nextDay();
  assert.equal(g.beat, 'staticPrep');
  g.room = null;
  const c0 = g.clock;
  tick(0.1);
  const hurried = g.clock - c0;
  g.room = 'notebook';
  const c1 = g.clock;
  tick(0.1);
  const plain = g.clock - c1;
  assert.ok(hurried > plain * (HURRY - 1), `${hurried} vs ${plain}`);
});

test('handing the rest of the flow to the team reaches the brief in one go and tells you what happened', () => {
  newGame(42);
  assert.equal(g.beat, 'flow');
  flowTeamAll();
  assert.notEqual(g.beat, 'flow');
  assert.equal(g.room, 'away');
  assert.ok(g.away.lines.length >= 1);
  assert.ok(
    g.flow.tests.every(t => t.status),
    'every test was run',
  );
});
