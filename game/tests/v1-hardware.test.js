// §5.3 multi-stage change (Bumper), §5.4 production findings, §5.5 storage, reuse and recycling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { claimStatus } from '../js/rules/evidence.js';
import { nominalFlights, bareState, fire, bumper, flight } from './helpers.js';
import { game, greenlightProgramme, fly, book, groundTest } from './game-1945.js';

const ALL = ['v2.chamber-pressure', 'wac-upper.chamber-pressure', 'v2|wac-upper.separation', 'vehicle.apogee', 'vehicle.deviation'];

test('§5.3: revising the upper stage keeps the V-2 evidence and re-opens interface and integrated claims', () => {
  const s = nominalFlights([flight(bumper(), ALL), flight(bumper(), ALL)]);
  const r2 = bumper('wac-upper/r2');
  const status = q => claimStatus(s, r2, q).status;
  assert.equal(status('v2.chamber-pressure'), 'measured-normal', 'other stage untouched');
  assert.equal(status('wac-upper.chamber-pressure'), 'measured-normal', 'unaffected claim on the revised stage carries');
  assert.equal(status('v2|wac-upper.separation'), 'unknown', 'interface re-assessed');
  assert.equal(status('vehicle.apogee'), 'unknown', 'integrated re-assessed');
});

test('§5.3: the flown configuration records which stage revisions actually flew', () => {
  const g = game(1950);
  g.until(1946, 6, 1);
  greenlightProgramme(g, 'bumper');
  g.cmd('propose-revision', 'department-head', { revId: 'wac-upper/r2', reason: 'separation timing' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: 'bumper', revId: 'wac-upper/r2' });
  g.approve(g.cmd('request-trial', 'department-head', { programmeId: 'bumper', revId: 'wac-upper/r2' }));
  g.cmd('build-article', 'production', { id: 'b1', programmeId: 'bumper', stages: { 'wac-upper': 'wac-upper/r2' } });
  const l = fly(g, 'bumper', 'b1');
  assert.deepEqual(l.stages, { v2: 'v2/r1', 'wac-upper': 'wac-upper/r2' });
  assert.deepEqual(g.state.programmes.bumper.baseline, { v2: 'v2/r1', 'wac-upper': 'wac-upper/r1' });
});

test('§5.4: findings feed engineering; holds inform early; a recurring defect escalates with options', () => {
  const g = game();
  g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
  g.cmd('build-article', 'production', { id: 'w2', programmeId: 'wac' });
  g.cmd('record-finding', 'production', { source: 'inspection', articleId: 'w1', hypothesis: 'liner-debond', note: 'liner lifting at seam' });
  assert.equal(g.state.decisions.filter(d => d.type === 'recurring-defect').length, 0, 'one finding stays within remit');
  g.cmd('hold-batch', 'production', { batchId: 'batch-1', reason: 'inspect liners' });
  assert.ok(g.state.memos.some(m => /Holding batch-1/.test(m.text)));
  assert.match(g.try('build-article', 'production', { id: 'w3', programmeId: 'wac' }).rejection.reason, /on hold/);
  g.cmd('record-finding', 'production', { source: 'acceptance', articleId: 'w2', hypothesis: 'liner-debond', note: 'same seam' });
  const d = g.state.decisions.find(x => x.type === 'recurring-defect');
  assert.deepEqual(d.options, ['corrective-revision', 'hold-and-inspect', 'accept-with-limits']);
  assert.equal(d.evidence.length, 2);
});

test('§5.5: reuse needs integration work and recycling recovers by yield; neither is free', () => {
  const g = game();
  g.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second WAC series', vehicle: 'wac' });
  g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
  g.cmd('build-article', 'production', { id: 'w2', programmeId: 'wac' });
  g.cmd('store-article', 'production', { articleId: 'w1' });
  g.cmd('reuse-article', 'production', { jobId: 'reuse-1', articleId: 'w1', programmeId: 'wac-2', reservation: book(g, 'integration-1', 'wac-2', 20) });
  assert.equal(g.state.hardware.articles.w1.programmeId, 'wac', 'not moved until the assessment is done');
  g.finish('reuse-1');
  assert.equal(g.state.hardware.articles.w1.programmeId, 'wac-2');
  g.cmd('recycle-article', 'production', { jobId: 'rec-1', articleId: 'w2' });
  g.finish('rec-1');
  assert.equal(g.state.hardware.articles.w2.status, 'recycled');
  const recovered = Object.values(g.state.stock.items).find(i => i.provenance.recycledFrom === 'w2');
  assert.ok(recovered.qty < 1);
});

test('latent defects: teams can trace the WAC Corporal fault and fix it through trial', () => {
  const g = game(31);
  const pressure = { stage: 'wac-upper', channels: ['wac-upper.chamber-pressure'] };
  groundTest(g, 'wac', 'short', pressure);
  const anomaly = () => g.state.beliefs.anomalies['upper-stage-loss'];
  assert.equal(anomaly().status, 'competing', 'a rough short firing opens the investigation');
  groundTest(g, 'wac', 'long', pressure);
  assert.equal(anomaly().status, 'leading');
  assert.equal(anomaly().hypotheses['feed-starvation'].status, 'ruled-out');
  g.cmd('propose-revision', 'department-head', { revId: 'wac-upper/r3', reason: 'igniter hang-fire' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: 'wac', revId: 'wac-upper/r3' });
  groundTest(g, 'wac', 'long', { ...pressure, stages: { 'wac-upper': 'wac-upper/r3' } });
  g.approve(g.cmd('request-trial', 'department-head', { programmeId: 'wac', revId: 'wac-upper/r3' }));
  assert.equal(g.state.hardware.revisions['wac-upper/r3'].trial, true);
});

test('latent defects: corrected revisions stop the in-flight losses they remedy', () => {
  const rate = config => {
    const s = bareState(2);
    let lost = 0;
    for (let i = 0; i < 300; i++) if (fire(s, flight(config, ['vehicle.deviation'])).obs.find(o => o.quantity === 'vehicle.deviation').normal === false) lost++;
    return lost / 300;
  };
  const wac = upper => ({ vehicle: 'wac', stages: { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': upper } });
  assert.ok(rate(wac('wac-upper/r1')) > 0.1);
  assert.equal(rate(wac('wac-upper/r3')), 0);
  const both = { vehicle: 'bumper', stages: { v2: 'v2/r2', 'wac-upper': 'wac-upper/r3' } };
  assert.equal(rate(both), 0);
});
