// §5.2 single-stage worked case: the Aerobee sustainer revision, end to end through the façade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, greenlightProgramme, groundTest, fly } from './game-1945.js';
import { claimStatus } from '../js/rules/evidence.js';
import { REVISIONS } from '../js/data/vehicles.js';

const R2 = { 'aerobee-sustainer': 'aerobee-sustainer/r2' };

test('§5.2 Aerobee sustainer revision: identify, ground test, review, trial flight, partial deployment, reuse', () => {
  const g = game(1946);
  g.until(1946, 5, 17);
  greenlightProgramme(g, 'aerobee');
  g.cmd('create-programme', 'administrator', { id: 'aerobee-navy', name: 'Navy Aerobee', vehicle: 'aerobee' });

  // A long firing shows the sustainer running hot; repeating it tells us nothing new; a short firing
  // separates the explanations.
  const wallOnly = { channels: ['aerobee-sustainer.wall-temp'] };
  assert.equal(groundTest(g, 'aerobee', 'long', wallOnly).result, 'informative');
  assert.equal(g.state.beliefs.anomalies['sustainer-overtemp'].status, 'competing');
  assert.equal(groundTest(g, 'aerobee', 'long', wallOnly).result, 'inconclusive');
  groundTest(g, 'aerobee', 'short');
  assert.equal(g.state.beliefs.anomalies['sustainer-overtemp'].status, 'leading');

  // 1. The team identifies an improvement within its remit; the technical director approves a prototype.
  g.cmd('propose-revision', 'department-head', { revId: 'aerobee-sustainer/r2', reason: 'liner debond under long burns' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' });

  // 3. Before ground evidence, the technical director vetoes a trial; the administrator cannot override.
  const early = g.cmd('request-trial', 'department-head', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' });
  assert.match(g.try('decide', 'administrator', { decisionId: early, choice: 'approve' }).rejection.reason, /Vetoed by technical/);
  g.approve(early, 'reject');

  // 2. A bounded ground test produces evidence scoped to r2 for the affected claim.
  groundTest(g, 'aerobee', 'long', { stages: R2 });
  const r2 = { vehicle: 'aerobee', stages: { ...g.state.programmes.aerobee.baseline, ...R2 } };
  assert.equal(claimStatus(g.state, r2, 'aerobee-sustainer.wall-temp', { burn: 'long' }).status, 'measured-normal');
  // 6. The unaffected chamber-pressure claim reuses r1's evidence; apogee (coupled cost) needs re-test.
  assert.ok(claimStatus(g.state, r2, 'aerobee-sustainer.chamber-pressure').tests >= 2);
  assert.equal(claimStatus(g.state, r2, 'vehicle.apogee').status, 'unknown');

  g.approve(g.cmd('request-trial', 'department-head', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' }));
  assert.equal(g.state.hardware.revisions['aerobee-sustainer/r2'].trial, true);
  assert.equal(g.state.programmes.aerobee.baseline['aerobee-sustainer'], 'aerobee-sustainer/r1', 'trial approval is not adoption');

  // An r1 article is built before deployment and keeps r1 afterwards.
  g.cmd('build-article', 'production', { id: 'a-r1', programmeId: 'aerobee' });
  // 4. Authorised experimental flight on a shared vehicle.
  g.cmd('build-article', 'production', { id: 'a-trial', programmeId: 'aerobee', stages: R2 });
  const flight = fly(g, 'aerobee', 'a-trial');
  assert.equal(flight.experimental, true);
  assert.deepEqual(flight.stages, { 'aerobee-booster': 'aerobee-booster/r1', 'aerobee-sustainer': 'aerobee-sustainer/r2' });
  assert.equal(flight.outcome, 'success');
  // AC05: the remedy moves two coupled concerns, and the integrated apogee is evaluated in flight.
  assert.ok(REVISIONS['aerobee-sustainer/r2'].affects.length >= 2);
  assert.equal(claimStatus(g.state, r2, 'vehicle.apogee').status, 'measured-normal');

  // 5. Deployment affects the Aerobee programme's future vehicles, not the Navy's, and not built articles.
  g.approve(g.cmd('adopt-revision', 'administrator', { revId: 'aerobee-sustainer/r2', programmeIds: ['aerobee'] }));
  assert.equal(g.state.programmes.aerobee.baseline['aerobee-sustainer'], 'aerobee-sustainer/r2');
  assert.equal(g.state.programmes['aerobee-navy'].baseline['aerobee-sustainer'], 'aerobee-sustainer/r1');
  assert.equal(g.state.hardware.articles['a-r1'].stages['aerobee-sustainer'], 'aerobee-sustainer/r1');
  g.cmd('build-article', 'production', { id: 'a-new', programmeId: 'aerobee' });
  assert.equal(g.state.hardware.articles['a-new'].stages['aerobee-sustainer'], 'aerobee-sustainer/r2');
});

test('§5.2: the unguided booster is not a development target', () => {
  const g = game();
  assert.match(g.try('propose-revision', 'department-head', { revId: 'aerobee-booster/r1', reason: 'x' }).rejection.reason, /not developed/);
});
