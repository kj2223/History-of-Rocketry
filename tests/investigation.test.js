// Every failure traceable (Aaron, 22 November 2026): after a loss, the write-up says where it could have been caught.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { playRound } from './play.js';

const lostRounds = (n = 120) => {
  const out = [];
  for (let seed = 1; seed < n; seed++) {
    newGame(seed);
    playRound();
    const r = g.record.rounds.at(-1);
    if (/^Lost/.test(r.flight)) out.push({ seed, r, hidden: !!g.round.hiddenFailure, cause: g.round.flight.failure });
  }
  return out;
};

test('every lost round says where it could have been caught, or that nothing could', () => {
  const lost = lostRounds();
  assert.ok(lost.length > 10, `${lost.length} losses`);
  for (const { seed, r, hidden } of lost) {
    assert.ok(r.caught?.length, `seed ${seed} has no investigation`);
    if (hidden) assert.match(r.caught[0], /Nothing on the ground/);
  }
  const spots = lost.filter(l => ['weld', 'leak'].includes(l.cause) && !l.hidden);
  assert.ok(
    spots.some(l => l.r.caught.some(c => /In the hangar/.test(c))),
    'a hangar fault names the hangar',
  );
  const stand = lost.filter(l => l.cause === 'ignition' && !l.hidden);
  if (stand.length) assert.ok(stand.some(l => l.r.caught.some(c => /On the stand/.test(c))));
});

test('a good flight has no investigation', () => {
  for (let seed = 1; seed < 40; seed++) {
    newGame(seed);
    playRound();
    const r = g.record.rounds.at(-1);
    if (!/^Lost/.test(r.flight)) {
      assert.equal(r.caught, undefined);
      return;
    }
  }
});
