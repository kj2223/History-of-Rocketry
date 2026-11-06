// Staff behaviour carried from V1 into V2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStep } from '../js/rules/staff.js';
import { mercuryRedstone } from './game.js';

// Ported from V1 (cc012ee).
test('a team does not ask for the pad while an unaccepted finding would make the technical director veto it', () => {
  const g = mercuryRedstone();
  const p = g.state.programmes['mercury-redstone'], stages = { ...p.baseline };
  // Pretend the stand and chamber work is done and a flight came back off course: the deviation finding is open.
  for (const [quantity, value] of [['redstone.chamber-pressure', 22], ['mercury-capsule.cabin-pressure', 0.38]])
    for (const burn of ['short', 'long'])
      g.state.evidence.observations.push({ id: `x-${quantity}-${burn}`, day: 0, workId: `w-${quantity}-${burn}`, kind: 'ground', vehicle: 'mercury-redstone', stages, conditions: { burn }, quantity, state: 'measured', value, normal: true });
  assert.equal(nextStep(g.state, p).kind, 'fly');
  g.state.evidence.observations.push({ id: 'x-dev', day: 0, workId: 'w-f', kind: 'flight', vehicle: 'mercury-redstone', stages, conditions: { burn: 'long' }, quantity: 'vehicle.deviation', state: 'measured', value: 9, normal: false });
  assert.notEqual(nextStep(g.state, p).kind, 'fly');
  g.state.beliefs.assessed = ['x-dev'];
  assert.equal(nextStep(g.state, p).kind, 'fly', 'once you accept the known risk the team may ask again');
});
