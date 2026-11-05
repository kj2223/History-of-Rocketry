import test from 'node:test';
import assert from 'node:assert/strict';
import { runTest } from '../js/rules/physics.js';
import { claimStatus } from '../js/rules/evidence.js';
import { readiness } from '../js/rules/belief.js';
import { bareState, fire, aerobee, ground, flight } from './helpers.js';

test('AC01: same physical state and stream give the same trace whatever the beliefs or channels', () => {
  const a = bareState(11), b = bareState(11);
  b.beliefs.anomalies.fake = { id: 'fake', hypotheses: {} };
  runTest(a, 'x', ground(aerobee(), 'long'));
  runTest(b, 'x', ground(aerobee(), 'long', ['aerobee-sustainer.wall-temp']));
  assert.deepEqual(a.physical, b.physical);
  assert.deepEqual(a.rng.physical, b.rng.physical);
});

test('AC02: unknown, unmeasured, lost and measured-normal stay distinct; missing is not zero', () => {
  const s = bareState(3);
  const config = aerobee();
  assert.equal(claimStatus(s, config, 'aerobee-sustainer.chamber-pressure').status, 'unknown');
  fire(s, ground(config, 'short', ['aerobee-sustainer.wall-temp']));
  const unmeasured = claimStatus(s, config, 'aerobee-sustainer.chamber-pressure');
  assert.equal(unmeasured.status, 'unmeasured');
  assert.ok(s.evidence.observations.filter(o => o.state !== 'measured').every(o => !('value' in o)));
  // A telemetry dropout is 'lost', not unmeasured and not zero.
  let lost = null;
  for (let seed = 1; !lost && seed < 200; seed++) {
    const t = bareState(seed);
    fire(t, flight(config, ['vehicle.apogee']));
    if (claimStatus(t, config, 'vehicle.apogee').status === 'lost') lost = t;
  }
  assert.ok(lost, 'some seed loses the apogee channel');
  fire(s, ground(config, 'short'));
  assert.equal(claimStatus(s, config, 'aerobee-sustainer.chamber-pressure').status, 'measured-normal');
});

test('AC03: an uninformative repeat leaves both explanations; a representative test separates them', () => {
  const s = bareState(5);
  const config = aerobee();
  fire(s, ground(config, 'long', ['aerobee-sustainer.wall-temp']));
  const anomaly = s.beliefs.anomalies['sustainer-overtemp'];
  assert.equal(anomaly.status, 'competing');
  assert.ok(anomaly.proposedTests.length > 0);
  const repeat = fire(s, ground(config, 'long', ['aerobee-sustainer.wall-temp']));
  assert.equal(repeat.changed, false, 'repeat changes nothing');
  assert.equal(anomaly.status, 'competing');
  fire(s, ground(config, 'short'));
  assert.equal(anomaly.status, 'leading');
  assert.equal(anomaly.hypotheses['injector-blockage'].status, 'ruled-out');
  assert.equal(anomaly.hypotheses['liner-debond'].status, 'open');
});

test('§4.5: one serious adverse finding is not averaged away by favourable results', () => {
  const s = bareState(8);
  const config = aerobee();
  fire(s, ground(config, 'long'));
  for (let i = 0; i < 5; i++) fire(s, ground(config, 'short'));
  assert.equal(claimStatus(s, config, 'aerobee-sustainer.wall-temp').status, 'adverse');
  assert.equal(claimStatus(s, config, 'aerobee-sustainer.wall-temp', { burn: 'short' }).status, 'measured-normal');
});

test('§4.2: a revision keeps evidence for unaffected claims and re-opens affected ones; no borrowing back', () => {
  const s = bareState(9);
  fire(s, ground(aerobee(), 'long'));
  const r2 = aerobee('aerobee-sustainer/r2');
  assert.equal(claimStatus(s, r2, 'aerobee-sustainer.chamber-pressure').status, 'measured-normal', 'reused');
  assert.equal(claimStatus(s, r2, 'aerobee-sustainer.wall-temp').status, 'unknown', 'affected claim needs re-test');
  fire(s, ground(r2, 'long'));
  assert.equal(claimStatus(s, r2, 'aerobee-sustainer.wall-temp').status, 'measured-normal');
  assert.equal(claimStatus(s, aerobee(), 'aerobee-sustainer.wall-temp').status, 'adverse', 'r1 cannot borrow r2 evidence');
});

test('§4.4: readiness depends on the decision', () => {
  const s = bareState(4);
  const r1 = aerobee(), r2 = aerobee('aerobee-sustainer/r2');
  fire(s, ground(r1, 'long'));
  assert.equal(readiness(s, 'investigate', r1).ready, true);
  assert.equal(readiness(s, 'prototype', r2, 'aerobee-sustainer/r2').ready, true);
  assert.equal(readiness(s, 'prototype', r1, 'aerobee-booster/r1').ready, false, 'unguided booster is not developed');
  assert.equal(readiness(s, 'experimental-flight', r2, 'aerobee-sustainer/r2').ready, false, 'no ground evidence yet');
  fire(s, ground(r2, 'long'));
  assert.equal(readiness(s, 'experimental-flight', r2, 'aerobee-sustainer/r2').ready, true);
  assert.equal(readiness(s, 'routine-use', r2).ready, false);
  assert.equal(readiness(s, 'experimental-flight', r1).ready, false, 'r1 carries an adverse finding');
});
