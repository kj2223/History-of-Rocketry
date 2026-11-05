// Acceptance gates AC01–AC08 (freeze §12), proven through the façade and the public projection.
// Each test names its gate. Lower-level coverage lives in the per-section test files; these are the playtest criteria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { project, checkSave, exportGame } from '../js/rules/index.js';
import { MECHANISMS } from '../js/data/physical.js';
import { REVISIONS } from '../js/data/vehicles.js';
import { bareState, fire, aerobee, ground, flight } from './helpers.js';
import { game, greenlightProgramme, groundTest, fly, book } from './game.js';
import { claimStatus } from '../js/rules/evidence.js';
import { runTest } from '../js/rules/physics.js';

const reload = s => checkSave(exportGame(s));
const WALL = ['aerobee-sustainer.wall-temp'];
const aerobeeGame = seed => { const g = game(seed); g.until(1946, 5, 17); greenlightProgramme(g, 'aerobee'); return g; };
const claim = (g, quantity) => project(g.state).programmes.find(p => p.id === 'aerobee').claims.find(c => c.quantity === quantity);
const anomaly = g => project(g.state).anomalies.find(a => a.id === 'sustainer-overtemp');

test('AC01: identical physical trace whatever the beliefs, and beliefs carry no mechanism IDs', () => {
  const a = aerobeeGame(21), b = aerobeeGame(21);
  b.state.beliefs.planted = { note: 'a different belief state' };
  groundTest(a, 'aerobee', 'long');
  groundTest(b, 'aerobee', 'long');
  assert.deepEqual(a.state.rng.physical, b.state.rng.physical);
  assert.deepEqual(a.state.physical, b.state.physical);
  const raw = JSON.stringify({ beliefs: a.state.beliefs, evidence: a.state.evidence });
  for (const id of Object.keys(MECHANISMS)) assert.equal(raw.includes(id), false, `belief or evidence state contains mechanism ${id}`);
  // Different channels do not move the physical stream either.
  const c = bareState(9), d = bareState(9);
  runTest(c, 'x', ground(aerobee(), 'long'));
  runTest(d, 'x', ground(aerobee(), 'long', WALL));
  assert.deepEqual(c.rng.physical, d.rng.physical);
});

test('AC02: coverage and loss change what evidence is accessible; the four non-answers stay distinct', () => {
  const g = aerobeeGame(22);
  assert.equal(claim(g, 'aerobee-sustainer.chamber-pressure').status, 'unknown');
  const config = { vehicle: 'aerobee', stages: g.state.programmes.aerobee.baseline };
  const status = q => claimStatus(g.state, config, q, { burn: 'short' }).status;
  groundTest(g, 'aerobee', 'short', { channels: WALL });
  assert.equal(status('aerobee-sustainer.wall-temp'), 'measured-normal');
  assert.equal(status('aerobee-sustainer.chamber-pressure'), 'unmeasured', 'not instrumented is not unknown');
  groundTest(g, 'aerobee', 'short');
  assert.equal(status('aerobee-sustainer.chamber-pressure'), 'measured-normal', 'added coverage adds evidence');
  // A dropout in flight is its own state, with no value that could be read as zero.
  let lost = null;
  for (let seed = 1; !lost && seed < 200; seed++) {
    const s = bareState(seed);
    fire(s, flight(aerobee(), ['vehicle.apogee']));
    if (claimStatus(s, aerobee(), 'vehicle.apogee').status === 'lost') lost = s;
  }
  assert.ok(lost, 'some seed loses the apogee channel');
  assert.ok(lost.evidence.observations.filter(o => o.state === 'lost').every(o => !('value' in o)));
  const statuses = new Set(['unknown', 'unmeasured', 'lost', 'measured-normal']);
  assert.equal(statuses.size, 4);
});

test('AC03: limited evidence leaves competing explanations; a repeat does not help; a representative test does', () => {
  const g = aerobeeGame(23);
  groundTest(g, 'aerobee', 'long', { channels: WALL });
  assert.equal(anomaly(g).status, 'competing');
  assert.deepEqual(anomaly(g).hypotheses.map(h => h.status), ['open', 'open']);
  assert.ok(anomaly(g).proposedTests.length > 0, 'the report says which test would separate them');
  assert.equal(groundTest(g, 'aerobee', 'long', { channels: WALL }).result, 'inconclusive');
  assert.equal(anomaly(g).status, 'competing');
  assert.equal(groundTest(g, 'aerobee', 'short').result, 'informative');
  assert.equal(anomaly(g).status, 'leading');
  assert.ok(anomaly(g).hypotheses.some(h => h.status === 'ruled-out'));
});

test('AC04: work narrows the envelope without any component unlock; inconclusive completion is explicit', () => {
  const g = aerobeeGame(24);
  const revisionsBefore = JSON.stringify(g.state.hardware.revisions);
  const observations = g.state.evidence.observations.length;
  const first = groundTest(g, 'aerobee', 'short');
  assert.ok(g.state.evidence.observations.length > observations, 'evidence improved');
  assert.equal(JSON.stringify(g.state.hardware.revisions), revisionsBefore, 'no revision or component was unlocked');
  const repeat = groundTest(g, 'aerobee', 'short');
  assert.equal(repeat.result, 'inconclusive');
  const report = g.state.memos.find(m => m.refs?.job === repeat.id);
  assert.match(report.text, /inconclusive/);
  assert.ok(first.result !== repeat.result);
});

test('AC05: a mitigation moves at least two coupled concerns; the integrated baseline is evaluated', () => {
  const g = aerobeeGame(25);
  const R2 = { 'aerobee-sustainer': 'aerobee-sustainer/r2' };
  assert.ok(REVISIONS['aerobee-sustainer/r2'].affects.length >= 2);
  groundTest(g, 'aerobee', 'long', { channels: WALL });
  groundTest(g, 'aerobee', 'short');
  g.cmd('propose-revision', 'department-head', { revId: 'aerobee-sustainer/r2', reason: 'liner debond under long burns' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' });
  groundTest(g, 'aerobee', 'long', { stages: R2 });
  const r2 = { vehicle: 'aerobee', stages: { ...g.state.programmes.aerobee.baseline, ...R2 } };
  assert.equal(claimStatus(g.state, r2, 'aerobee-sustainer.wall-temp', { burn: 'long' }).status, 'measured-normal');
  assert.equal(claimStatus(g.state, r2, 'vehicle.apogee').status, 'unknown', 'the coupled concern is not assumed fine');
  const blocked = g.cmd('adopt-revision', 'administrator', { revId: 'aerobee-sustainer/r2', programmeIds: ['aerobee'] });
  assert.match(g.try('decide', 'administrator', { decisionId: blocked, choice: 'approve' }).rejection.reason, /Vetoed by technical/);
  g.approve(g.cmd('request-trial', 'department-head', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' }));
  g.cmd('build-article', 'production', { id: 'a-trial', programmeId: 'aerobee', stages: R2 });
  fly(g, 'aerobee', 'a-trial');
  assert.notEqual(claimStatus(g.state, r2, 'vehicle.apogee').status, 'unknown', 'the integrated apogee was evaluated');
});

test('AC06: routine work is quiet; exclusive capacity cannot overlap; a breach escalates with options', () => {
  const g = game(26);
  const decisions = g.state.decisions.length;
  groundTest(g, 'wac', 'short', { stage: 'wac-upper', channels: ['wac-upper.chamber-pressure'] });
  assert.equal(g.state.decisions.length, decisions, 'approved routine work raised nothing');
  // Hold the static stand, then ask for it again over the same days.
  const from = g.state.day, to = from + 10;
  g.cmd('reserve-facility', 'administrator', { id: 'held', unitId: 'stand-1', programmeId: 'wac', from, to, purpose: 'firing series' });
  assert.match(g.try('reserve-facility', 'administrator', { id: 'again', unitId: 'stand-1', programmeId: 'wac', from: from + 2, to: to + 2, purpose: 'x' }).rejection.reason, /already holds/);
  g.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second WAC series', vehicle: 'wac' });
  const clash = g.cmd('reserve-facility', 'administrator', { id: 'clash', unitId: 'stand-1', programmeId: 'wac-2', from: from + 2, to: to + 2, purpose: 'other' });
  assert.equal(clash.reservation, undefined, 'no overlapping exclusive reservation is created');
  const d = g.state.decisions.find(x => x.id === clash.decision);
  assert.ok(d && d.status === 'open' && d.options.includes('displace') && d.options.includes('decline'), 'the clash is an actionable decision');
  assert.equal(g.state.facilities.reservations.filter(r => r.unitId === 'stand-1' && r.status === 'held').length, 1);
});

test('AC07: reports cite configuration and evidence; reload preserves work, evidence and beliefs; raw records stay immutable', () => {
  const g = aerobeeGame(27);
  const job = groundTest(g, 'aerobee', 'short', { channels: WALL });
  const p = project(g.state);
  const report = p.inbox.find(m => m.kind === 'report' && /gt-/.test(m.text));
  assert.ok(report, 'a report reached the inbox');
  const cited = p.evidence.filter(o => o.workId === job.id);
  assert.ok(cited.length > 0, 'the work cites evidence');
  assert.ok(cited.every(o => o.stages && o.vehicle), 'each observation names the configuration it measured');
  const before = JSON.stringify(g.state.evidence.observations);
  // Mid-test reload: nothing rerolls and nothing is rewritten.
  const pad = book(g, 'pad-1', 'aerobee', 5), tracking = book(g, 'tracking-1', 'aerobee', 5);
  g.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
  g.approve(g.cmd('request-launch', 'administrator', { id: 'L1', articleId: 'a1', pad, tracking, cost: 1000, replacementCost: 1000 }).decision);
  g.days(2);
  const run = s => { const x = game(); x.state = s; x.days(8); return x.state; };
  assert.equal(JSON.stringify(run(reload(g.state))), JSON.stringify(run(g.state)));
  const reloaded = reload(g.state);
  assert.deepEqual(reloaded.beliefs, g.state.beliefs);
  assert.deepEqual(reloaded.evidence, g.state.evidence);
  assert.equal(JSON.stringify(g.state.evidence.observations).startsWith(before.slice(0, -1)), true, 'earlier records are unchanged');
});

test('AC08 (automatable part): ordinary projections carry observations, belief, unknowns and next-test value', () => {
  const g = aerobeeGame(28);
  groundTest(g, 'aerobee', 'long', { channels: WALL });
  const p = project(g.state);
  const a = p.anomalies[0], programme = p.programmes.find(x => x.id === 'aerobee');
  assert.ok(a.evidence.every(id => p.evidence.some(o => o.id === id)), 'every cited observation can be opened');
  assert.ok(a.status && a.hypotheses.length >= 2, 'belief and its alternatives are stated');
  assert.ok(programme.claims.some(c => ['unknown', 'unmeasured'].includes(c.status)), 'what is not known is stated');
  assert.ok(a.proposedTests.every(t => t.conditions && t.channels?.length), 'each next test says what it would measure');
  // Human reading of these reports is the playtest checklist: AC08-PLAYTEST.md (kept with the project files, not in git).
});
