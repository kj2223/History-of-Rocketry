import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { consoleInsertion } from '../js/mercury.js';
import { answer, tickFlight } from '../js/houston.js';

function atCutoff(margin) {
  newGame(11);
  g.record.seat = 'flight';
  g.round.end = { outcome: 'orbit', margin, v: 7.8, gammaOff: 0, capsule: 'safe' };
  return (g.console = {
    phase: 'insertion',
    kind: 'flight',
    flightId: 'gem-6',
    round: g.round,
    goddard: { go: margin >= 0 },
    calls: {},
    log: [],
  });
}

test('a correction saves a marginal orbit but leaves no reserve for a second rendezvous approach', () => {
  const c = atCutoff(-0.01);
  consoleInsertion('correct');
  assert.equal(c.phase, 'mission');
  assert.equal(c.flight.status.RESERVE[0], '55%');
  c.round.flightTruth.flags.computer = true;
  c.round.flightTruth.d[10] = 0.9;
  for (let step = 0; step < 8 && !c.flight.decision; step++) tickFlight(c, 2, () => {});
  answer(c, 'onboard', () => {});
  assert.equal(c.flight.state.rendezvousMissed, true);
});

test('waiting for another fix spends time and a reduced plan skips rendezvous', () => {
  const c = atCutoff(0.01);
  const before = g.clock;
  consoleInsertion('fix');
  assert.equal(c.phase, 'insertion');
  assert.equal(g.clock - before, 4);
  consoleInsertion('fix');
  assert.equal(g.clock - before, 4);
  consoleInsertion('reduced');
  assert.equal(c.flight.status.OBJECTIVE[0], 'orbital checkout');
  for (let step = 0; step < 8 && !c.flight.decision; step++) tickFlight(c, 2, () => {});
  assert.equal(c.flight.decision?.id, 'navcheck');
  assert.equal(c.flight.capabilities.includes('rendezvous'), false);
});

test('a second insertion fix leaves a shorter rendezvous window', () => {
  const c = atCutoff(0.02);
  consoleInsertion('fix');
  consoleInsertion(true);
  for (let step = 0; step < 8 && !c.flight.decision; step++) tickFlight(c, 2, () => {});
  assert.equal(c.flight.decision?.remaining, 26);
  assert.equal(c.flight.status.RESERVE[0], '100%');
});

test('a correction cannot save an orbit outside its modeled margin, and no-go still returns early', () => {
  let c = atCutoff(-0.06);
  consoleInsertion('correct');
  assert.equal(c.round.end.outcome, 'decay');
  assert.equal(c.phase, 'coast');
  c = atCutoff(0.02);
  consoleInsertion(false);
  assert.equal(c.round.end.outcome, 'nogo');
  assert.equal(c.phase, 'coast');
});
