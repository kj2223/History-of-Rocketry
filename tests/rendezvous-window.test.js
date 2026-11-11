import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { answer, startFlight, tickFlight } from '../js/houston.js';

function chase(fault) {
  newGame(17);
  g.record.seat = 'flight';
  const c = { kind: 'flight', flightId: 'gem-6', round: g.round };
  const calls = [];
  const speak = (_, who, text) => calls.push(text);
  startFlight(c);
  c.round.flightTruth.flags.computer = fault;
  for (let step = 0; step < 10 && !c.flight.decision; step++) tickFlight(c, 2, speak);
  assert.equal(c.flight.decision?.id, 'rdvplan');
  return { c, calls, speak };
}

test('a fresh fix takes time and reaches Flight before the rendezvous window closes', () => {
  const { c, calls, speak } = chase(true);
  const before = g.clock;
  answer(c, 'request-fix', speak);
  tickFlight(c, 8, speak);
  assert.ok(g.clock > before);
  assert.match(calls.at(-1), /reset/i);
  assert.ok(c.flight.decision.remaining < 30);
  answer(c, 'ground', speak);
  tickFlight(c, 2, speak);
  assert.equal(c.flight.phase, 'Station-keeping');
  assert.ok(c.flight.capabilities.includes('rendezvous'));
});

test('committing to the provisional ground fix costs an extra correction', () => {
  const { c, calls, speak } = chase(true);
  answer(c, 'ground', speak);
  assert.match(calls.at(-1), /extra trim/);
  assert.equal(c.flight.decisions.at(-1).verdict, 'fair');
});

test('a clean onboard solution works immediately, while an expired window skips station-keeping', () => {
  let { c, speak } = chase(false);
  answer(c, 'onboard', speak);
  assert.ok(c.flight.capabilities.includes('rendezvous'));
  ({ c, speak } = chase(false));
  tickFlight(c, 31, speak);
  assert.equal(c.flight.decision, null);
  tickFlight(c, 2, speak);
  assert.notEqual(c.flight.phase, 'Station-keeping');
  assert.equal(c.flight.capabilities.includes('rendezvous'), false);
});
