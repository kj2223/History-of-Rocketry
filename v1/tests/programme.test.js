// Freeze §8: proposal stages, greenlight window, change control, stop, closure, delegation, summary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { END_DAY } from '../js/core/calendar.js';
import { game, greenlightProgramme, fly, groundTest, book } from './game.js';
import { conditions } from '../js/rules/delegation.js';

test('§8.1–8.2: three sources and four stages; greenlight is separate from preliminary acceptance', () => {
  const g = game();
  assert.equal(g.state.programmes.wac.source, 'objective');
  g.cmd('create-programme', 'department-head', { id: 'idea', name: 'Team idea', vehicle: null });
  assert.equal(g.state.programmes.idea.source, 'initiative');
  g.until(1946, 5, 17);
  assert.equal(g.state.programmes.aerobee.source, 'external');
  g.cmd('authorise-feasibility', 'administrator', { programmeId: 'aerobee' });
  assert.match(g.try('submit-dossier', 'administrator', { programmeId: 'aerobee' }).rejection.reason, /both cases/);
  g.cmd('complete-case', 'technical-director', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('complete-case', 'financial-officer', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('record-meeting', 'administrator', { programmeId: 'aerobee', cost: 1, contribution: 'x', timeline: 'y', requirements: 'z' });
  g.approve(g.cmd('submit-dossier', 'administrator', { programmeId: 'aerobee' }));
  const p = g.state.programmes.aerobee;
  assert.equal(p.stage, 'preliminary');
  assert.equal(p.window.closes - p.window.opens, 182);
  g.days(183);
  assert.equal(g.state.programmes.aerobee.stage, 'lapsed', 'the window closes visibly');
});

test('§8.2: an extension needs a stated question and resources', () => {
  const g = game();
  g.until(1946, 5, 17);
  g.cmd('authorise-feasibility', 'administrator', { programmeId: 'aerobee' });
  g.cmd('complete-case', 'technical-director', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('complete-case', 'financial-officer', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('record-meeting', 'administrator', { programmeId: 'aerobee', cost: 1, contribution: 'x', timeline: 'y', requirements: 'z' });
  g.approve(g.cmd('submit-dossier', 'administrator', { programmeId: 'aerobee' }));
  assert.ok(g.try('extend-window', 'administrator', { programmeId: 'aerobee', days: 30 }).rejection);
  g.cmd('extend-window', 'administrator', { programmeId: 'aerobee', question: 'motor supply', resources: 'one engineer', days: 30 });
  assert.equal(g.state.programmes.aerobee.window.closes - g.state.programmes.aerobee.window.opens, 212);
});

test('§3.1: a finance veto blocks preliminary acceptance; two approvals cannot override it', () => {
  const g = game();
  g.until(1946, 5, 17);
  g.cmd('authorise-feasibility', 'administrator', { programmeId: 'aerobee' });
  g.cmd('complete-case', 'technical-director', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('complete-case', 'financial-officer', { programmeId: 'aerobee', summary: 'ok' });
  g.cmd('record-meeting', 'administrator', { programmeId: 'aerobee', cost: 99_000_000, contribution: 'x', timeline: 'y', requirements: 'z' });
  const d = g.cmd('submit-dossier', 'administrator', { programmeId: 'aerobee' });
  const decision = g.state.decisions.find(x => x.id === d);
  assert.equal(decision.positions.technical.stance, 'approve');
  assert.match(g.try('decide', 'administrator', { decisionId: d, choice: 'approve' }).rejection.reason, /Vetoed by finance/);
  assert.ok(g.try('decide', 'technical-director', { decisionId: d, choice: 'approve' }).rejection);
});

test('§8.5: routine changes stay with the project manager; material ones need review and provider agreement', () => {
  const g = game();
  assert.deepEqual(g.cmd('request-change', 'project-manager', { programmeId: 'wac', kind: 'resequence', detail: 'swap firings' }), { applied: true });
  assert.match(g.try('request-change', 'project-manager', { programmeId: 'wac', kind: 'deadline', detail: 'slip', external: true }).rejection.reason, /provider/);
  const r = g.cmd('request-change', 'project-manager', { programmeId: 'wac', kind: 'deadline', detail: 'slip', external: true, providerAgreed: true });
  g.approve(r.decision);
  assert.equal(g.state.programmes.wac.changes.filter(c => !c.routine).length, 1);
});

test('§8.6–8.7: stop is discussed; closure gathers obligations and stays open until each has an owner', () => {
  const g = game();
  g.cmd('commit-funds', 'department-head', { id: 'motors', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 5000, due: g.state.day + 60 }], terms: { cancellable: false, cancelFee: 0 } });
  const stop = g.cmd('recommend-stop', 'financial-officer', { programmeId: 'wac', reason: 'superseded' });
  assert.deepEqual(g.state.decisions.find(d => d.id === stop).options, ['stop', 'further-attempt']);
  g.approve(stop, 'stop');
  const p = () => g.state.programmes.wac;
  assert.equal(p().stage, 'closing');
  assert.ok(p().closure.obligations.some(o => o.kind === 'payment' && o.amount === 5000));
  assert.match(g.try('complete-closure-step', 'administrator', { programmeId: 'wac', step: 'contract-settlements', output: 'x' }).rejection.reason, /financial-officer/);
  for (const s of p().closure.steps.filter(x => !x.done)) g.cmd('complete-closure-step', s.owner, { programmeId: 'wac', step: s.id, output: 'done' });
  assert.equal(p().stage, 'closing', 'unresolved obligation keeps it visible');
  for (const o of p().closure.obligations) g.cmd('resolve-obligation', 'financial-officer', { programmeId: 'wac', obligationId: o.id, owner: 'finance', funded: true });
  assert.equal(p().stage, 'closed');
});

test('B5: delegation opens only when all three conditions hold, and reverses only on repeated failures', () => {
  let g;
  for (let seed = 1; seed < 100; seed++) {
    g = game(seed);
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) {
      g.cmd('build-article', 'production', { id: `w${i}`, programmeId: 'wac' });
      ok = fly(g, 'wac', `w${i}`).outcome === 'success';
    }
    if (ok) break;
  }
  assert.deepEqual(conditions(g.state, 'wac').map(c => c.met), [true, false, false]);
  assert.equal(g.state.delegation.programmes.wac?.active ?? false, false, 'flights alone are not enough');
  assert.ok(g.try('schedule-test', 'department-head', { programmeId: 'wac' }).rejection.reason.includes('may not'));
  g.cmd('appoint', 'administrator', { id: 'head-1', role: 'department-head', person: 'Frank Malina', remit: { programmes: ['wac'], scheduling: true } });
  g.days(1);
  assert.equal(g.state.delegation.programmes.wac.active, false);
  g.cmd('appoint', 'administrator', { id: 'pm-1', role: 'project-manager', person: 'Homer Joe Stewart', programmeId: 'wac' });
  g.days(1);
  assert.equal(g.state.delegation.programmes.wac.active, true);
  // Teams now schedule their own routine work.
  groundTest(g, 'wac', 'short', { stage: 'wac-upper', channels: ['wac-upper.chamber-pressure'], actor: 'department-head' });
  g.cmd('report-delegation-failure', 'technical-director', { programmeId: 'wac', beyondRemit: true, text: 'missed review' });
  assert.equal(g.state.delegation.programmes.wac.active, true, 'one anecdote does not reverse');
  g.cmd('report-delegation-failure', 'technical-director', { programmeId: 'wac', beyondRemit: false, text: 'within tolerance' });
  assert.equal(g.state.delegation.programmes.wac.active, true);
  g.cmd('report-delegation-failure', 'technical-director', { programmeId: 'wac', beyondRemit: true, text: 'second' });
  assert.equal(g.state.delegation.programmes.wac.active, false);
});

test('§8.4: a successor project manager inherits records, commitments and concerns', () => {
  const g = game();
  g.cmd('appoint', 'administrator', { id: 'pm-1', role: 'project-manager', person: 'A', programmeId: 'wac' });
  g.cmd('commit-funds', 'department-head', { id: 'c1', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 100, due: g.state.day + 30 }] });
  const pm2 = g.cmd('appoint', 'administrator', { id: 'pm-2', role: 'project-manager', person: 'B', programmeId: 'wac' });
  const a = g.state.delegation.appointments.find(x => x.id === pm2);
  assert.deepEqual(a.handover.commitments, ['c1']);
  assert.equal(g.state.delegation.appointments.find(x => x.id === 'pm-1').status, 'succeeded');
  assert.ok(a.handover.retrievalQuality > 0 && a.handover.retrievalQuality <= 1);
});

test('§8.8, §10.4: NASA formation ends the campaign with a six-section summary and an inert hook', () => {
  const g = game();
  g.days(END_DAY + 10);
  assert.equal(g.state.day, END_DAY, 'no play past NASA formation');
  assert.equal(g.state.concluded, true);
  const { summary, hook } = g.state.continuation;
  assert.deepEqual(summary.sections.map(s => s.id), ['technical', 'institutional', 'stewardship', 'political', 'narrative', 'open-questions']);
  assert.deepEqual(Object.keys(summary.sections[5].items), ['readinessRestrictions', 'unsettledObligations', 'disagreements', 'untestedClaims']);
  assert.equal(hook.active, false);
  assert.match(g.try('appoint', 'administrator', { id: 'late', role: 'project-manager', person: 'x' }).rejection.reason, /concluded/);
  assert.ok(g.state.memos.some(m => /satellite in orbit/.test(m.text)), 'Sputnik anchor fired');
});

test('§8.8: open questions list what NASA inherits from existing records, without hidden truth', () => {
  const g = game(77);
  g.until(1946, 5, 17);
  greenlightProgramme(g, 'aerobee');
  groundTest(g, 'aerobee', 'long');
  // A future-year commitment goes through a joint decision before it enters the ledger.
  g.approve(g.cmd('commit-funds', 'department-head', { id: 'late-bill', dept: 'propulsion', programmeId: 'aerobee', payments: [{ amount: 500, due: END_DAY + 30 }], terms: { cancellable: false, cancelFee: 0 } }).decision);
  // A trial asked for before any ground evidence stays open under a technical veto.
  g.cmd('propose-revision', 'department-head', { revId: 'aerobee-sustainer/r2', reason: 'liner' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' });
  g.cmd('request-trial', 'department-head', { programmeId: 'aerobee', revId: 'aerobee-sustainer/r2' });
  g.days(END_DAY);
  const section = g.state.continuation.summary.sections[5];
  assert.equal(section.placeholder, undefined);
  const q = section.items;
  assert.ok(q.readinessRestrictions.find(r => r.programmeId === 'aerobee').restrictions.some(t => /adverse/.test(t)));
  assert.ok(q.unsettledObligations.some(o => o.id && o.owner === 'propulsion' && o.amount === 500));
  assert.ok(q.disagreements.some(d => d.type === 'trial' && d.vetoes.some(v => v.who === 'technical')));
  assert.ok(q.untestedClaims.some(c => c.programmeId === 'aerobee' && c.quantity === 'vehicle.apogee'));
  const text = JSON.stringify(section);
  for (const word of ['physical', 'trueDefectMechanism', 'pm-07']) assert.equal(text.includes(word), false, word);
});
