// Fixes from playtesting: talking to anyone on site, and a tank gauge that holds still when time does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { talk } from '../js/data/talk.js';
import { newRound, tankGauge } from '../js/truth/round.js';
import { g, newGame, say } from '../js/game.js';

test('everyone on site has something to say, at every beat', () => {
  newGame(3);
  const beats = ['brief', 'board', 'evening1', 'staticPrep', 'static', 'afterStatic', 'rollout', 'countReady', 'flight', 'recovery', 'review', 'roundEnd', 'seasonEnd'];
  for (const id of Object.keys(g.people).filter(id => id !== 'you'))
    for (const beat of beats) assert.equal(typeof talk(id, beat), 'string', `${id} at ${beat}`);
});

test('nothing to say puts no bubble on the site', () => {
  newGame(3);
  const before = g.loop.length;
  say('hoyt', undefined);
  assert.equal(g.loop.length, before);
  assert.equal(g.people.hoyt.bubble, null);
});

test('the tank gauge reads the same for the same moment, and takes nothing from the round', () => {
  const r = newRound(11);
  const state = JSON.stringify(r.rng);
  const a = tankGauge(r, 10.2), b = tankGauge(r, 10.2);
  assert.equal(a, b);
  assert.equal(JSON.stringify(r.rng), state);
  assert.ok(Math.abs(a - 23) < 0.2);
});
