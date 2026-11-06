// V2 freeze §5: Mercury and Gemini hardware, military flight records and where spacecraft are tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, project } from '../js/rules/index.js';
import { claimStatus } from '../js/rules/evidence.js';
import { VEHICLES, BASELINE, testFacility } from '../js/data/vehicles.js';
import { MILITARY_FLIGHTS } from '../js/data/scenario.js';
import { FLIGHT_CONDITIONS } from '../js/data/engineering.js';
import { game, book, mercuryRedstone } from './game.js';

test('§5: Redstone, Atlas and Titan II boosters with Mercury and Gemini spacecraft, all crewed vehicles', () => {
  assert.deepEqual(VEHICLES['mercury-redstone'].stages, ['redstone', 'mercury-capsule']);
  assert.deepEqual(VEHICLES['mercury-atlas'].stages, ['atlas', 'mercury-capsule']);
  assert.deepEqual(VEHICLES['gemini-titan'].stages, ['titan-ii', 'gemini']);
  for (const v of ['mercury-redstone', 'mercury-atlas', 'gemini-titan']) assert.equal(VEHICLES[v].crewed, true);
  const s = game().state;
  for (const rev of Object.values(BASELINE['mercury-atlas'])) assert.equal(s.hardware.revisions[rev].status, 'defined', rev);
});

test('§5: military Atlas records count for the crewed Atlas engines, never for its flight outcome', () => {
  const last = MILITARY_FLIGHTS.filter(f => f.vehicle === 'atlas-icbm').at(-1);
  const g = game(5);
  g.state = advance(g.state, last.day - g.state.day).state;
  const flown = project(g.state).military.filter(f => f.vehicle === 'atlas-icbm');
  assert.equal(flown.length, MILITARY_FLIGHTS.filter(f => f.vehicle === 'atlas-icbm').length);
  const crewed = { vehicle: 'mercury-atlas', stages: BASELINE['mercury-atlas'] };
  assert.notEqual(claimStatus(g.state, crewed, 'atlas.chamber-pressure', FLIGHT_CONDITIONS).status, 'unknown');
  assert.equal(claimStatus(g.state, crewed, 'vehicle.deviation', FLIGHT_CONDITIONS).status, 'unknown');
  assert.equal(claimStatus(g.state, crewed, 'vehicle.apogee', FLIGHT_CONDITIONS).status, 'unknown');
});

test('§5: spacecraft are ground-tested in the environmental chamber, boosters on a stand', () => {
  assert.equal(testFacility('mercury-capsule'), 'environmental-chamber');
  assert.equal(testFacility('redstone'), 'static-stand');
  const g = mercuryRedstone();
  const plan = { programmeId: 'mercury-redstone', stage: 'mercury-capsule', stages: {}, conditions: { burn: 'short' }, channels: ['mercury-capsule.cabin-pressure'] };
  const onStand = g.try('schedule-test', 'administrator', { jobId: 'x1', ...plan, reservation: book(g, 'stand-1', 'mercury-redstone') });
  assert.match(onStand.rejection.reason, /environmental-chamber reservation/);
  assert.ok(g.cmd('schedule-test', 'administrator', { jobId: 'x2', ...plan, reservation: book(g, 'env-1', 'mercury-redstone') }));
});
