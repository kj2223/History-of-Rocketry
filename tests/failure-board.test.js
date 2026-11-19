// The failure board: the first look at the tapes is free; the board has time for two of three lines of inquiry, and each
// turns up only the evidence from its own source. Earlier ledger reports for the hardware are pinned up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { evidence, failureBoard, inquire, INQUIRY_LIMIT } from '../js/mercury.js';
import { toRoundId, playMission } from './play.js';

test('the board opens with the first look at the tapes, and inquiries add their own evidence', async () => {
  const { CONTROL_ROOMS } = await import('../js/scenes/control.js');
  newGame(3);
  toRoundId('mr-1');
  let seen = null;
  playMission({
    call: () => {
      const b = failureBoard();
      seen = { first: b, html: CONTROL_ROOMS.mreview() };
      const got = inquire('hardware');
      seen.after = failureBoard();
      seen.got = got;
      return 'unknown';
    },
  });
  assert.ok(seen, 'the review was reached');
  assert.ok(seen.first.cards.length >= 1 && seen.first.cards[0].source === 'tapes');
  assert.equal(seen.first.left, INQUIRY_LIMIT);
  assert.match(seen.html, /Where do you look/);
  assert.equal(seen.after.left, INQUIRY_LIMIT - 1);
  assert.ok(seen.after.cards.length >= seen.first.cards.length);
  assert.ok(
    seen.after.cards.every(c => c.source !== 'crew'),
    'nothing from the crew until asked',
  );
});

test('two inquiries at most, each once', () => {
  newGame(5);
  g.beat = 'mReview';
  g.mission = g.mission || {};
  g.round.ascent = g.round.ascent || {};
  g.round.end = g.round.end || {};
  const all = evidence().length;
  assert.ok(Array.isArray(inquire('hardware')));
  assert.equal(inquire('hardware'), null, 'once');
  assert.ok(Array.isArray(inquire('crew')));
  assert.equal(inquire('tapes'), null, 'no third');
  const b = failureBoard();
  assert.equal(b.left, 0);
  assert.ok(b.cards.length <= all);
});
