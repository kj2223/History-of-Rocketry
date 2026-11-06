// A season of WAC rounds: what the review decides carries into how the next rounds are built, the drawing office's
// estimate sharpens with each good flight, and Ellis's trust in your calls is earned and lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, tick, finishInspection, finishBoard, endDay, standStart, standDecide, countStart, countAnswer, rideOut, returnFromRecovery,
  present, nextRound, closeAway, checkpoint, checkCheckpoint, dateText } from '../js/game.js';
import { SEASON } from '../js/data/campaign.js';
import { initProgramme, adopt, recordFlight, estimate } from '../js/world/programme.js';
import { newRound, hasIgniterFault } from '../js/truth/round.js';

import { playRound, advance } from './play.js';

test('a season runs through every round on its own dates and ends with your record', () => {
  newGame(11);
  for (let i = 0; i < SEASON.length; i++) {
    assert.equal(g.roundIndex, i);
    assert.equal(dateText(g.roundStart), dateText(SEASON[i].start));
    playRound();
    if (i + 1 < SEASON.length) { assert.equal(g.beat, 'roundEnd'); advance(); assert.equal(g.room, 'away'); }
  }
  assert.equal(g.beat, 'seasonEnd');
  assert.equal(g.record.rounds.length, SEASON.length);
  assert.ok(g.record.rounds.every(r => /Radar peak|Lost|In orbit|Passed the Moon|Hit the Moon/.test(r.flight)));
});

test('the review\'s conclusion becomes a fix that changes how later rounds are built, even if it is the wrong one', () => {
  const p = initProgramme();
  assert.match(adopt(p, 'ignition'), /reworked igniter/);
  assert.equal(adopt(p, 'ignition'), null, 'a fix is adopted once');
  // With the igniter fixed, no later round carries the ignition fault.
  for (let s = 1; s < 60; s++) assert.equal(hasIgniterFault(newRound(s, p)), false);
  // A weld fix makes bad welds rarer; it does nothing for leaks.
  const count = (prog, kind) => { let n = 0; for (let s = 1; s < 400; s++) n += Object.values(newRound(s, prog).faults).includes(kind) ? 1 : 0; return n; };
  const welded = initProgramme(); adopt(welded, 'weld');
  assert.ok(count(welded, 'weld') < count(initProgramme(), 'weld') * 0.6);
  assert.equal(count(welded, 'leak'), count(initProgramme(), 'leak'));
});

test('the drawing office\'s estimate moves toward what the radar saw and narrows with each good flight', () => {
  const p = initProgramme();
  const first = estimate(p, 1);
  recordFlight(p, { load: 1, apogee: 71, failure: null });
  recordFlight(p, { load: 0.9, apogee: 62, failure: 'leak' });
  const second = estimate(p, 1);
  assert.ok(second.high - second.low < first.high - first.low);
  assert.ok((second.low + second.high) / 2 > (first.low + first.high) / 2);
  assert.equal(second.flights, 1, 'a failed flight tells the office nothing about performance');
});

test('Ellis overrules you when she reads it differently, until your record earns her trust; then she goes with you', () => {
  newGame(21);
  playRound(game => (game.round.flight.failure ? 'nominal' : 'leak')); // a call she will not share unless her reading slips
  const first = g.record.rounds[0];
  if (!first.agreed) assert.equal(g.record.trust, -1);
  // With trust earned, a call she reads differently goes in the report as yours.
  newGame(21);
  g.record.trust = 3;
  playRound(game => (game.round.flight.failure ? 'nominal' : 'leak'));
  const r = g.record.rounds[0];
  assert.ok(r.agreed || r.wentWithYou);
  if (r.wentWithYou) assert.equal(r.ellis, r.yourCall);
});

test('a finished round is saved, and resuming shows its outcome with the next round still to come', () => {
  newGame(5);
  playRound();
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  checkCheckpoint(saved);
  assert.equal(saved.beat, 'roundEnd');
  newGame(saved.seed, saved);
  assert.equal(g.beat, 'roundEnd');
  assert.equal(g.room, 'roundEnd');
  assert.equal(g.record.rounds.length, 1);
  nextRound();
  assert.equal(g.roundIndex, 1);
});
