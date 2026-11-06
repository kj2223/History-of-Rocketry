// Freeze §7, including the five §7.7 acceptance cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayOf, fiscalQuarter } from '../js/core/calendar.js';
import { capacityRemaining, protectedBaseline, available } from '../js/rules/fiscal.js';
import { game, greenlightProgramme, fly } from './game-1945.js';

const ledgerTotal = s => s.fiscal.ledger.filter(e => e.status !== 'cancelled').reduce((a, e) => a + e.amount, 0);

test('B2: quarterly capacity limits payments, not commitments; capacity carries forward in the year', () => {
  const g = game();
  const cap = capacityRemaining(g.state);
  g.cmd('commit-funds', 'department-head', { id: 'big-order', dept: 'engineering', payments: [{ amount: 90000, due: dayOf(1945, 5, 1) }, { amount: 90000, due: dayOf(1945, 6, 1) }] });
  assert.ok(180000 > cap, 'commitment larger than this quarter\'s capacity is accepted');
  g.until(1945, 4, 2);
  assert.equal(capacityRemaining(g.state) > cap, true, 'unused Q3 capacity carried into Q4');
});

test('B2: no commitment above the annual award without multi-year authority', () => {
  const g = game();
  const r = g.try('commit-funds', 'financial-officer', { id: 'huge', dept: 'engineering', payments: [{ amount: 10_000_000, due: dayOf(1945, 5, 1) }] });
  assert.match(r.rejection.reason, /annual award/);
});

test('B2: future-year and consequential commitments go to a joint decision first', () => {
  const g = game();
  const r = g.cmd('commit-funds', 'department-head', { id: 'next-year', dept: 'engineering', payments: [{ amount: 10000, due: dayOf(1946, 1, 1) }] });
  const d = g.state.decisions.find(x => x.id === r.decision);
  assert.match(d.positions.finance.reason, /presented to the administrator/);
  assert.equal(g.state.fiscal.commitments['next-year'], undefined);
  g.approve(r.decision);
  assert.ok(g.state.fiscal.commitments['next-year']);
});

test('§7.3: a protected invoice, once paid, reduces both funds and the requirement, not twice', () => {
  const g = game();
  const due = g.state.day + 3;
  g.cmd('commit-funds', 'department-head', { id: 'inv', dept: 'engineering', payments: [{ amount: 5000, due }] });
  const [cap0, prot0, avail0] = [capacityRemaining(g.state), protectedBaseline(g.state), available(g.state)];
  g.until(1945, 1, 4);
  assert.equal(capacityRemaining(g.state), cap0 - 5000);
  assert.equal(protectedBaseline(g.state), prot0 - 5000);
  assert.equal(available(g.state), avail0);
});

test('§7.7 case 1: two affordable orders whose combined payments exceed a release escalate', () => {
  const g = game();
  const room = available(g.state);
  const due = fiscalQuarter(g.state.day).end;
  g.cmd('commit-funds', 'department-head', { id: 'a', dept: 'propulsion', payments: [{ amount: room * 0.7, due }] });
  assert.equal(g.state.decisions.filter(d => d.type === 'timing-conflict').length, 0);
  g.cmd('commit-funds', 'department-head', { id: 'b', dept: 'instruments', payments: [{ amount: room * 0.7, due }] });
  const conflict = g.state.decisions.find(d => d.type === 'timing-conflict');
  assert.ok(conflict, 'finance escalates');
  assert.ok(conflict.options.includes('reschedule'));
});

test('§7.7 case 2: material bought for one programme is used by another; cash changes once', () => {
  const g = game();
  g.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second WAC series', vehicle: 'wac' });
  g.cmd('commit-funds', 'department-head', { id: 'alcohol', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 8000, due: g.state.day + 1, delivers: { material: 'alcohol', qty: 10, compatible: ['wac'] } }] });
  g.days(1);
  const cashAfterPurchase = g.state.fiscal.cash;
  const item = Object.values(g.state.stock.items)[0];
  assert.deepEqual(item.provenance.programmeId, 'wac');
  g.cmd('reserve-stock', 'department-head', { itemId: item.id, programmeId: 'wac-2', qty: 4 });
  g.cmd('consume-stock', 'department-head', { itemId: item.id, programmeId: 'wac-2', qty: 4, vehicle: 'wac' });
  const after = g.state.stock.items[item.id];
  assert.equal(after.qty, 6);
  assert.deepEqual(after.reserved, {});
  assert.equal(g.state.fiscal.cash, cashAfterPurchase);
  const conflict = g.cmd('reserve-stock', 'department-head', { itemId: item.id, programmeId: 'wac', qty: 7 });
  assert.ok(conflict.decision, 'over-reservation escalates');
});

test('§7.7 case 3: cancellation stops avoidable work and payments; supplier terms hold; no refund', () => {
  const g = game();
  g.cmd('commit-funds', 'department-head', { id: 'motor', dept: 'propulsion', payments: [{ amount: 3000, due: g.state.day + 1 }, { amount: 3000, due: g.state.day + 40 }], terms: { cancellable: true, cancelFee: 500 } });
  g.cmd('commit-funds', 'department-head', { id: 'casting', dept: 'propulsion', payments: [{ amount: 4000, due: g.state.day + 40 }], terms: { cancellable: false, cancelFee: 0 } });
  g.days(2);
  const m = g.cmd('cancel-commitment', 'financial-officer', { commitmentId: 'motor' });
  assert.deepEqual(m, { stopped: 1, remaining: 1, paid: 3000 }, 'fee remains, first payment not refunded');
  const c = g.cmd('cancel-commitment', 'financial-officer', { commitmentId: 'casting' });
  assert.equal(c.remaining, 1, 'non-cancellable obligation stays');
});

test('§7.7 case 4 and §7.4: a failed flight exposes options and charges nothing extra', () => {
  for (let seed = 1; seed < 200; seed++) {
    const g = game(seed);
    g.until(1946, 5, 17);
    greenlightProgramme(g, 'aerobee');
    g.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
    const before = ledgerTotal(g.state);
    const l = fly(g, 'aerobee', 'a1', { cost: 20000, replacementCost: 40000 });
    if (l.outcome !== 'failure') continue;
    assert.equal(ledgerTotal(g.state) - before, 20000, 'only the flight cost is charged');
    const d = g.state.decisions.find(x => x.type === 'replacement');
    assert.deepEqual(d.options, ['defer', 'fund-replacement', 'seek-supplementary']);
    assert.match(d.text, /readings were recovered/);
    assert.equal(g.state.fiscal.exposures.find(x => x.launchId === l.id).status, 'realised');
    assert.equal(g.state.hardware.articles.a1.status, 'lost');
    return;
  }
  assert.fail('no seed produced a failure');
});

test('§7.4: a successful flight does not incur the conditional exposure', () => {
  for (let seed = 1; seed < 200; seed++) {
    const g = game(seed);
    g.until(1946, 6, 1);
    greenlightProgramme(g, 'bumper');
    g.cmd('build-article', 'production', { id: 'b1', programmeId: 'bumper' });
    const l = fly(g, 'bumper', 'b1');
    if (l.outcome !== 'success') continue;
    assert.equal(g.state.fiscal.exposures[0].status, 'lapsed');
    assert.equal(g.state.decisions.some(d => d.type === 'replacement'), false);
    return;
  }
  assert.fail('no seed produced a success');
});

test('§7.7 case 5: the fiscal year closes with obligations and stock intact; retention is a case', () => {
  const g = game();
  g.cmd('commit-funds', 'department-head', { id: 'stock', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 2000, due: g.state.day + 1, delivers: { material: 'steel', qty: 5, compatible: ['wac'] } }] });
  g.approve(g.cmd('commit-funds', 'department-head', { id: 'later', dept: 'propulsion', payments: [{ amount: 7000, due: dayOf(1945, 9, 1) }] }).decision);
  g.until(1945, 6, 30);
  const open = JSON.stringify(g.state.fiscal.ledger.filter(e => e.status === 'open' && e.commitmentId));
  const stock = JSON.stringify(g.state.stock);
  g.days(1);
  assert.equal(g.state.fiscal.fy, 1946);
  assert.equal(JSON.stringify(g.state.fiscal.ledger.filter(e => e.status === 'open' && e.commitmentId)), open);
  assert.equal(JSON.stringify(g.state.stock), stock);
  const r = g.state.fiscal.retentions[0];
  assert.ok(r.granted <= r.unspent && r.continuing === 7000);
  assert.equal(g.state.fiscal.award, 900000, 'economy does not cut the next award');
});
