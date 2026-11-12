// When a flight or a count ends while you sit at your console, the console room closes with it. Left open, the site was
// drawn while every click still went to console buttons that were gone (MR-1 on the pad: only walking off with D freed it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { padChoose, shutdownChoose, consolePoll } from '../js/mercury.js';
import { openRoom } from '../js/scenes/rooms.js';
import { toRoundId, nextDay, until } from './play.js';

// Walk into Mercury Control on launch day, as the player does, and work the count to `stop`.
function countFromConsole(stop, set = () => {}) {
  openRoom('office');
  assert.equal(g.room, 'console');
  assert.ok(g.console, 'the console opened');
  set(g.console);
  const done = () => !g.console || stop(g.console);
  const go = () => g.console.cond.seaState <= 4 && !g.console.cond.late;
  until(() => done() || g.console.poll);
  for (let n = 0; n < 20 && !done(); n++) {
    consolePoll(go());
    until(() => done() || g.console?.poll);
  }
  assert.ok(done(), `the count never reached its end: ${g.console?.phase}`);
}
function toMr1PadAbort() {
  newGame(919316); // Aaron's playtest seed: the tail plug drops out at ignition
  toRoundId('mr-1');
  g.round.faults = { 'tail-plug': 'plug' };
  nextDay();
  assert.equal(g.beat, 'mLaunch');
  countFromConsole(c => c.phase === 'pad');
  assert.equal(g.console.phase, 'pad');
}

test('MR-1 back on the pad, pad crew sent at once: the review opens where you sit', () => {
  toMr1PadAbort();
  padChoose('now');
  assert.equal(g.beat, 'mReview');
  assert.equal(g.console, null);
  assert.equal(g.room, 'mreview');
});

test('MR-1 back on the pad, left overnight: the console closes and the day can end', () => {
  toMr1PadAbort();
  padChoose('wait');
  assert.equal(g.beat, 'mPadNight');
  assert.equal(g.room, null);
});

test('a count scrubbed from the console leaves you on the site', () => {
  newGame(919316);
  toRoundId('mr-1');
  nextDay();
  countFromConsole(
    () => false,
    c => (c.cond.seaState = 6),
  );
  assert.equal(g.beat, 'mScrub');
  assert.equal(g.console, null);
  assert.equal(g.room, null);
});
