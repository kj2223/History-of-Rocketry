import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpoint, g, newGame } from '../js/game.js';
import { consoleAim, consolePoll } from '../js/mercury.js';

function geminiSeat(seat) {
  newGame(6);
  const save = checkpoint();
  save.record.seat = seat;
  newGame(6, { ...save, roundId: 'gem-6', beat: 'mBrief' });
  return (g.console = {
    kind: 'flight',
    phase: 'count',
    poll: 'recovery',
    clock: 600,
    orbital: true,
    flightId: 'gem-6',
    cond: { seaState: 2 },
    calls: { poll: [] },
  });
}

test('Gemini Flight gives launch clearance while a Retro player reports Retro status', () => {
  geminiSeat('flight');
  consolePoll(true);
  assert.match(g.people.you.bubble.text, /Flight is go/);
  geminiSeat('retro');
  consolePoll(true);
  assert.equal(g.people.you.bubble.text, 'Retro is go.');
});

test('Flight authorizes recovery while Retro supplies the splashdown solution', () => {
  const c = geminiSeat('flight');
  c.phase = 'ip';
  c.ip = { retro: 14 };
  consoleAim('retro');
  assert.match(g.people.tate.bubble?.text || '', /14 km/);
  assert.match(g.people.you.bubble.text, /Flight.*proceed/i);
  assert.equal(c.calls.ip, 'retro');
});
