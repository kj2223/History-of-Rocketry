// Fixes from playtesting: talking to anyone on site, and a tank gauge that holds still when time does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { talk } from '../js/data/talk.js';
import { newRound, tankGauge } from '../js/truth/round.js';
import { g, newGame, say } from '../js/game.js';

test('everyone on site has something to say, at every beat', () => {
  newGame(3);
  const beats = [
    'brief',
    'board',
    'evening1',
    'staticPrep',
    'static',
    'afterStatic',
    'rollout',
    'countReady',
    'flight',
    'recovery',
    'review',
    'roundEnd',
    'seasonEnd',
  ];
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
  const a = tankGauge(r, 10.2),
    b = tankGauge(r, 10.2);
  assert.equal(a, b);
  assert.equal(JSON.stringify(r.rng), state);
  assert.ok(Math.abs(a - 23) < 0.2);
});

test("the notebook clears earlier rounds' notes, keeps this round's, and never grows past its limit", async () => {
  const { note, clearNotes, NOTEBOOK_MAX, checkpoint } = await import('../js/game.js');
  const { playRound, advance } = await import('./play.js');
  newGame(5);
  playRound(() => 'unknown');
  advance();
  const now = g.notes.filter(n => n.round === g.roundIndex).length;
  assert.ok(g.notes.length > now && now > 0);
  assert.ok(clearNotes() > 0);
  assert.equal(g.notes.length, now);
  assert.ok(
    checkpoint().notes.every(n => n.round === g.roundIndex),
    'the save is cleared too',
  );
  for (let i = 0; i < NOTEBOOK_MAX + 50; i++) note(`filler ${i}`);
  assert.equal(g.notes.length, NOTEBOOK_MAX);
  assert.equal(g.notes.at(-1).text, `filler ${NOTEBOOK_MAX + 49}`);
});
