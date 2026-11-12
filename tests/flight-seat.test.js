import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpoint, g, newGame } from '../js/game.js';
import { consoleAim, consolePoll, tickConsole } from '../js/mercury.js';

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

test('Retro gives Recovery the splashdown point while Flight listens', () => {
  const c = geminiSeat('flight');
  c.phase = 'ip';
  c.ip = { retro: 14 };
  g.people.you.bubble = null;
  consoleAim('retro');
  assert.match(g.people.tate.bubble?.text || '', /Recovery, Retro.*14 km/);
  assert.match(g.people.reyes.bubble?.text || '', /Recovery copies/);
  assert.equal(g.people.you.bubble, null);
  assert.equal(c.calls.ip, 'retro');
});

test("From Flight's console, Tate makes Retro's landing-point call on his own", () => {
  const c = geminiSeat('flight');
  c.live = true;
  c.phase = 'ip';
  c.ip = { retro: 14, radar: 3 };
  tickConsole(1);
  assert.equal(c.phase, 'ip');
  tickConsole(2);
  assert.equal(c.phase, 'coast');
  assert.equal(c.calls.ip, 'radar');
});
