// Apollo 13's power-up from cold: switch systems on within the entry batteries, then read it up. The plan decides the
// call: a clean sequence needs the lander's top-up; leaving a must-have off, or running past the batteries, hurts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POWER_SYSTEMS, powerTotal, powerPlan } from '../js/data/powerup.js';
import { DECISIONS, FLIGHTS } from '../js/data/flights.js';

const musts = Object.fromEntries(
  Object.entries(POWER_SYSTEMS)
    .filter(([, s]) => s.need === 'must')
    .map(([k]) => [k, true]),
);

test('the musts fit the batteries; the full sequence needs the top-up; everything does not fit', () => {
  assert.equal(powerPlan(musts), 'margin');
  assert.equal(powerPlan({ ...musts, telemetry: true, early: true }), 'over');
  assert.equal(powerPlan({ ...musts, telemetry: true, early: true, topup: true }), 'clean');
  const all = Object.fromEntries(Object.keys(POWER_SYSTEMS).map(k => [k, true]));
  assert.equal(powerPlan({ ...all, topup: true }), 'over');
  assert.equal(powerPlan({ ...musts, guidance: false }), 'blind');
  assert.equal(powerPlan({ ...musts, quads: false }), 'cold');
  assert.ok(powerTotal(musts).used < powerTotal(musts).budget);
});

test('every plan is an option of the call, and the call is on the lifeboat flight', () => {
  for (const k of ['clean', 'margin', 'cold', 'blind', 'over']) assert.ok(DECISIONS.powerup.options[k], k);
  assert.ok(FLIGHTS['apollo-13'].steps.some(s => s.decide === 'powerup' && s.when === 'lifeboat'));
});

// Fly the lifeboat to the power-up, work the board in the room and read it up.
import { g, newGame } from '../js/game.js';
import { startFlight, tickFlight, answer } from '../js/houston.js';

test('on the lifeboat, the board in the room makes the call', async () => {
  const { CONTROL_ROOMS, CONTROL_ACTS } = await import('../js/scenes/control.js');
  newGame(5);
  g.record.seat = 'flight';
  const c = { kind: 'flight', flightId: 'apollo-13', round: g.round, phase: 'mission', calls: {} };
  startFlight(c);
  Object.assign(c.round.flightTruth.flags, { tank: true, sps: false, alarm: false, relight: false });
  g.console = c;
  const speak = () => {};
  let reached = false;
  for (let i = 0; i < 4000 && c.phase === 'mission'; i++) {
    const d = c.flight.decision;
    if (d && d.id === 'powerup') {
      reached = true;
      d.mine = true;
      CONTROL_ACTS['pu-open']();
      assert.match(CONTROL_ROOMS.powerup(), /power-up from cold/);
      for (const k of Object.keys(musts)) CONTROL_ACTS['pu-toggle'](k);
      CONTROL_ACTS['pu-read']();
      assert.equal(c.flight.decisions.at(-1).id, 'powerup');
      assert.equal(c.flight.decisions.at(-1).choice, 'margin');
      break;
    }
    if (d) answer(c, Object.keys(d.options)[0], speak);
    else tickFlight(c, 2, speak);
  }
  assert.ok(reached, 'the power-up came up on the lifeboat');
});
