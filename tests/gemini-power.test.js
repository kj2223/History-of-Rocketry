import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { answer, startFlight, tickFlight } from '../js/houston.js';

for (const recovers of [true, false]) {
  test(`Gemini 5 reports the power trend on shift when the cells ${recovers ? 'recover' : 'fail'}`, () => {
    newGame(5);
    g.record.seat = 'flight';
    const c = { kind: 'flight', flightId: 'gem-5', round: g.round };
    const calls = [];
    const speak = (_, who, text) => calls.push(text);
    startFlight(c);
    c.round.flightTruth.flags.fuelcell = true;
    c.round.flightTruth.fuelcellRecovers = recovers;
    for (let step = 0; step < 4 && !c.flight.decision; step++) tickFlight(c, 2, speak);
    assert.equal(c.flight.decision?.id, 'fuelcell1');
    answer(c, 'drift', speak);
    tickFlight(c, 2, speak);
    assert.equal(c.flight.status.EXPERIMENTS?.[0], 'rendezvous cancelled');
    assert.doesNotMatch(calls.at(-1), /on batteries/i);
    tickFlight(c, 2, speak);
    assert.equal(c.flight.at, 21);
    assert.equal(c.flight.status['O2 PRESSURE'][0], recovers ? '12 psi, steady' : 'no usable supply');
    tickFlight(c, 2, speak);
    assert.equal(c.flight.decision?.id, recovers ? 'fuelcell2' : 'navcheck');
    assert.equal(c.flight.at, recovers ? 26 : 22);
  });
}
