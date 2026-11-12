import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { consoleShift, tickConsole } from '../js/mercury.js';

test('Flight can request a delayed Booster report and set the objective before cutoff', () => {
  newGame(11);
  const c = (g.console = {
    phase: 'ascent',
    kind: 'flight',
    flightId: 'gem-6',
    live: true,
    t: 130,
    orbital: true,
    round: g.round,
    trace: [{ t: 130, stage: 'Second stage', acc: 1.4, off: 0 }],
    shift: { plan: 'rendezvous', reports: {} },
  });
  c.round.ascent = {
    burn: 300,
    steps: Array.from({ length: 301 }, () => ({ gamma: 30, off: 0, v: 2, acc: 1.4, stage: 'Second stage' })),
  };
  consoleShift('booster');
  consoleShift('checkout');
  assert.equal(c.shift.plan, 'checkout');
  assert.equal(c.shift.reports.booster, undefined);
  tickConsole(0.1);
  assert.equal(c.shift.reports.booster, undefined);
  tickConsole(12); // twelve flight seconds: the climb plays in real time (v0.8 pacing)
  assert.match(c.shift.reports.booster, /second stage/i);
  assert.ok(c.t > 130);
});
