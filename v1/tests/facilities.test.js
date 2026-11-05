// Freeze §6: reservations, displacement, interrupted work and phased upgrades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITY_KINDS } from '../js/data/facilities.js';
import { TUNING } from '../js/data/tuning.js';
import { game } from './game.js';

const res = (g, id, unitId, programmeId, from, to) =>
  g.cmd('reserve-facility', 'administrator', { id, unitId, programmeId, from, to, purpose: 'firing' });

test('§6.1: the catalogue has the eight facility kinds', () => {
  assert.equal(Object.keys(FACILITY_KINDS).length, 8);
});

test('§6.2: exclusive reservations never overlap; displacement escalates; reservation is not consumption', () => {
  const g = game();
  g.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second WAC series', vehicle: 'wac' });
  assert.ok(res(g, 'r1', 'stand-1', 'wac', 10, 20).reservation);
  assert.match(g.try('reserve-facility', 'administrator', { id: 'r2', unitId: 'stand-1', programmeId: 'wac', from: 15, to: 25 }).rejection.reason, /already holds/);
  const out = res(g, 'r3', 'stand-1', 'wac-2', 15, 25);
  assert.ok(out.decision, 'displacing another programme goes to the administrator');
  assert.equal(g.state.facilities.reservations.filter(r => r.status === 'held').length, 1);
  assert.equal(g.state.facilities.reservations[0].status, 'held', 'held, not consumed');
  g.approve(out.decision, 'displace');
  assert.deepEqual(g.state.facilities.reservations.map(r => [r.id, r.status]), [['r1', 'displaced'], ['r3', 'held']]);
  // Shared capacity: the integration space takes two overlapping reservations, not three.
  res(g, 'i1', 'integration-1', 'wac', 0, 5);
  res(g, 'i2', 'integration-1', 'wac', 0, 5);
  assert.ok(res(g, 'i3', 'integration-1', 'wac-2', 0, 5).decision);
});

test('§6.1: existence is not readiness; a new facility must be commissioned first', () => {
  const g = game();
  g.cmd('add-facility', 'administrator', { jobId: 'build-stand-2', id: 'stand-2', kind: 'static-stand' });
  assert.match(g.try('reserve-facility', 'administrator', { id: 'x', unitId: 'stand-2', programmeId: 'wac', from: 1, to: 2 }).rejection.reason, /commissioning/);
  g.finish('build-stand-2');
  assert.ok(res(g, 'x', 'stand-2', 'wac', g.state.day, g.state.day + 1).reservation);
});

test('§6.4: a phased pad upgrade keeps the other pad open and is not counted as available', () => {
  const g = game();
  g.cmd('add-facility', 'administrator', { jobId: 'pad-2-build', id: 'pad-2', kind: 'range' });
  g.finish('pad-2-build');
  g.cmd('begin-upgrade', 'administrator', { jobId: 'up-1', unitId: 'pad-1', capacityAfter: 1 });
  assert.match(g.try('reserve-facility', 'administrator', { id: 'p', unitId: 'pad-1', programmeId: 'wac', from: g.state.day, to: g.state.day + 1 }).rejection.reason, /upgrading/);
  assert.ok(res(g, 'p2', 'pad-2', 'wac', g.state.day, g.state.day + 1).reservation);
  g.finish('up-1');
  assert.equal(g.state.facilities.units['pad-1'].status, 'operational');
});

test('§6.3: paused work is assessed; preservation is funded, declining it adds rework but keeps the work', () => {
  const g = game();
  g.cmd('add-facility', 'administrator', { jobId: 'job-a', id: 'stand-a', kind: 'static-stand' });
  g.cmd('add-facility', 'administrator', { jobId: 'job-b', id: 'stand-b', kind: 'static-stand' });
  g.days(12);
  const keep = g.cmd('pause-work', 'administrator', { jobId: 'job-a', preserve: true });
  const drop = g.cmd('pause-work', 'administrator', { jobId: 'job-b', preserve: false });
  for (const a of [keep, drop]) for (const k of ['completedPreserved', 'materials', 'records', 'reworkDays', 'preservationCostPerDay']) assert.ok(k in a, k);
  assert.equal(drop.completedPreserved, 12, 'declining preservation does not destroy the work');
  assert.ok(drop.reworkDays > 0 && keep.reworkDays === 0);
  g.days(10);
  const ledger = g.state.fiscal.ledger.length;
  g.cmd('resume-work', 'administrator', { jobId: 'job-a' });
  assert.equal(g.state.fiscal.ledger.length, ledger + 1, 'preservation is billed');
  g.cmd('resume-work', 'administrator', { jobId: 'job-b' });
  assert.equal(g.state.fiscal.ledger.length, ledger + 1, 'no preservation bill when declined');
  assert.equal(g.state.work.find(j => j.id === 'job-b').total, 30 + drop.reworkDays);
});

test('§6.4, §7.2: facility work is paid for, a deposit at the start and the balance on completion', () => {
  const g = game();
  const owed = () => g.state.fiscal.ledger.filter(e => e.kind === 'facility');
  g.cmd('add-facility', 'administrator', { jobId: 'b', id: 'stand-2', kind: 'static-stand' });
  const build = owed();
  assert.equal(build.reduce((a, e) => a + e.amount, 0), TUNING.facilityBuildCost['static-stand']);
  assert.deepEqual(build.map(e => e.due), [g.state.day, g.state.day + TUNING.jobDays.commissioning]);
  g.finish('b');
  assert.ok(build.every(e => g.state.fiscal.ledger.find(x => x.id === e.id).status === 'paid'));
  g.cmd('begin-upgrade', 'technical-director', { jobId: 'u', unitId: 'integration-1', capacityAfter: 4 });
  assert.equal(owed().length, 4);
  assert.equal(owed().slice(2).reduce((a, e) => a + e.amount, 0), TUNING.facilityBuildCost['integration-space'] * TUNING.facilityUpgradeShare * 2);
});

test('§3.1, §7.2: a consequential facility commitment waits for a decision before work starts', () => {
  const g = game();
  const out = g.cmd('add-facility', 'administrator', { jobId: 'big', id: 'pad-2', kind: 'range', capacity: 3 });
  assert.ok(out.decision);
  assert.equal(g.state.facilities.units['pad-2'], undefined, 'nothing is built before approval');
  assert.equal(g.state.work.some(j => j.id === 'big'), false);
  g.approve(out.decision);
  assert.equal(g.state.facilities.units['pad-2'].status, 'commissioning');
  assert.equal(g.state.fiscal.commitments['facility-big'].total, TUNING.facilityBuildCost.range * 3);
});

test('§7.7: cancelling facility work stops the balance; an upgrade returns the unit to service as it was', () => {
  const g = game();
  g.cmd('begin-upgrade', 'technical-director', { jobId: 'u', unitId: 'stand-1', capacityAfter: 1 });
  g.days(3);
  const r = g.cmd('cancel-commitment', 'administrator', { commitmentId: 'facility-u' });
  assert.equal(r.stopped, 1);
  assert.equal(r.paid, TUNING.facilityBuildCost['static-stand'] * TUNING.facilityUpgradeShare * TUNING.facilityDepositShare);
  assert.equal(g.state.facilities.units['stand-1'].status, 'operational');
  assert.equal(g.state.work.find(j => j.id === 'u').status, 'cancelled');
});
