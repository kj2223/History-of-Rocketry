// The last midcourse correction on a flight home from the Moon is judged on the entry angle, so the call carries it
// (issue: the angle was measured onto the flight's board, but the call never showed it and the wall board's four lamps
// were the launch's, so from Apollo 10 on the player never saw the figure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, checkpoint } from '../js/game.js';
import '../js/mercury.js';
import { FLIGHTS } from '../js/data/flights.js';
import { startFlight, tickFlight, callBoardLines } from '../js/houston.js';
import { drawControlRoom } from '../js/site/draw.js';

const LUNAR = Object.entries(FLIGHTS)
  .filter(([, p]) => p.steps.some(s => s.decide === 'mcc'))
  .map(([id]) => id);

// Runs the flight plan up to its midcourse call, and returns the console with the call open.
function atTheCall(id, seed = 5) {
  newGame(seed);
  const save = checkpoint();
  save.record.seat = 'flight';
  newGame(seed, save);
  const c = { kind: 'flight', flightId: id, round: g.round, phase: 'mission' };
  startFlight(c);
  const steps = FLIGHTS[id].steps;
  const measure = steps.findIndex(s => s.measure === 'entryAngle');
  const mcc = steps.findIndex(s => s.decide === 'mcc');
  for (const i of [measure, mcc]) {
    c.flight.step = i;
    c.flight.wait = 0;
    tickFlight(c, 2, () => {});
  }
  return c;
}

test('every flight with a midcourse call measures the entry angle first', () => {
  assert.ok(LUNAR.length >= 11, LUNAR.join());
  for (const id of LUNAR) {
    const steps = FLIGHTS[id].steps;
    const measure = steps.findIndex(s => s.measure === 'entryAngle');
    assert.ok(measure >= 0 && measure < steps.findIndex(s => s.decide === 'mcc'), id);
  }
});

test('the midcourse call reads out the entry angle and the corridor, on every lunar flight', () => {
  for (const id of LUNAR) {
    const c = atTheCall(id);
    const d = c.flight.decision;
    assert.equal(d?.id, 'mcc', id);
    assert.ok(d.mine, id);
    const lines = callBoardLines(c.flight, d).map(l => l.text);
    assert.match(lines[0] || '', /^ENTRY ANGLE: -\d\.\d\d° \((inside|OUTSIDE)/, id);
    assert.match(lines[1] || '', /^CORRIDOR: -7\.2° to -5\.5° \(aim -6\.2°/, id);
  }
});

test('the console panel draws the entry angle with the call, and the wall board shows it', () => {
  const drawn = [];
  const ctx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: s => ({ width: String(s).length * 7 }),
      fillText: s => drawn.push(String(s)),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  for (const id of ['apollo-11', 'apollo-17', 'artemis-4']) {
    const c = atTheCall(id);
    g.room = 'console';
    g.console = { ...c, clock: 0, lines: [], chatter: [], lamps: {}, calls: {}, cond: {}, live: true };
    drawn.length = 0;
    drawControlRoom(ctx, g, { w: 1600, h: 900 });
    const text = drawn.join('\n');
    assert.match(text, /ENTRY ANGLE: -\d\.\d\d°/, id);
    // The wall board: the lamp itself, among the four it has room for.
    assert.ok(drawn.includes('ENTRY ANGLE'), `${id}: ${drawn.join(' | ')}`);
  }
});
