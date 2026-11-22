// The decay test (Aaron, 22 November 2026): no leak-check button; lock the tank up, watch the needle, make the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  decayStart,
  decayCall,
  decayNow,
  decayWhere,
  tick,
  countStart,
  countAnswer,
  standStart,
} from '../js/game.js';
import { decayRates, decayReading, DECAY_START } from '../js/truth/decay.js';
import { newRound, hasLeak } from '../js/truth/round.js';
import { playRound, until } from './play.js';

test('a leaking tank falls; a tight one only drifts with the air, which can fool a short watch', () => {
  let wrongAt3 = 0,
    wrongAt15 = 0,
    leaks = 0;
  for (let seed = 1; seed < 500; seed++) {
    const r = newRound(seed, undefined, 'wac');
    const rates = decayRates(r, 600);
    const looksLeaky = m => decayReading(r, rates, m) - DECAY_START < -0.15;
    leaks += hasLeak(r);
    wrongAt3 += looksLeaky(3) !== hasLeak(r);
    wrongAt15 += looksLeaky(15) !== hasLeak(r);
  }
  assert.ok(leaks > 100);
  assert.ok(wrongAt15 < wrongAt3, `${wrongAt3} wrong at 3 min, ${wrongAt15} at 15`);
  assert.ok(wrongAt15 > 0, 'even a long watch is not proof');
});

const toStand = () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
};

test('on the stand the watch spends the crew hours; calling it tight leaves the round as it was', () => {
  toStand();
  const faults = JSON.stringify(g.round.faults),
    spent = g.slot.spent;
  decayStart();
  assert.equal(decayWhere(), 'stand');
  standStart();
  assert.equal(g.stand.phase, 'ready', 'no firing with the tank locked up');
  for (let i = 0; i < 30 * 10; i++) tick(1 / 30);
  assert.ok(g.decay.minutes >= 9 && decayNow() != null);
  decayCall(true);
  assert.equal(g.decay, null);
  assert.ok(g.slot.spent >= spent + 0.15);
  assert.equal(JSON.stringify(g.round.faults), faults);
  assert.ok(g.notes.some(n => /Decay test on the stand/.test(n.text)));
});

test('calling it a leak sends the crew, who fix a real one', () => {
  for (let seed = 1; seed < 60; seed++) {
    newGame(seed);
    playRound(undefined, undefined, 'staticPrep');
    until(() => g.beat === 'static');
    if (!hasLeak(g.round)) continue;
    decayStart();
    tick(1);
    decayCall(false);
    assert.equal(g.stand.phase, 'leakcheck');
    until(() => g.stand.phase === 'ready');
    assert.ok(!hasLeak(g.round));
    return;
  }
  assert.fail('no leaking round');
});

test('in a count hold the watch eats the range window, and the count cannot resume until you call it', () => {
  newGame(7);
  playRound(undefined, undefined, 'countReady');
  countStart();
  until(() => g.count.poll);
  countAnswer(false);
  const clock = g.clock;
  decayStart();
  assert.equal(g.decay.where, 'count');
  for (let i = 0; i < 30 * 5; i++) tick(1 / 30);
  assert.ok(g.clock >= clock + 4);
  decayCall(true);
  assert.equal(g.decay, null);
});
