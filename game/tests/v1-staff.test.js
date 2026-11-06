// Staff at work from day one (freeze §2.2, §3.2, §5.1, §8.2): teams propose, file their cases and report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { project } from '../js/rules/index.js';
import { dayOf } from '../js/core/calendar.js';
import { game } from './game-1945.js';

const proposals = g => project(g.state).inbox.filter(i => i.kind === 'proposal');

test('on 1 January 1945 the staff have already briefed the administrator and proposed work', () => {
  const g = game();
  const froms = g.state.memos.map(m => m.from);
  assert.ok(froms.includes('technical-director') && froms.includes('financial-officer'));
  const [p] = proposals(g);
  assert.match(p.text, /short-burn ground test of the WAC Corporal upper stage/);
  assert.match(project(g.state).programmes.find(x => x.id === 'wac').team, /go-ahead/);
});

test('the go-ahead carries the step out; "not now" makes the team wait', () => {
  const g = game();
  g.cmd('approve-proposal', 'administrator', { proposalId: proposals(g)[0].id });
  assert.equal(g.state.work.filter(j => j.kind === 'ground-test' && j.status === 'running').length, 1);
  g.finish(g.state.work[0].id);
  g.days(1);
  const next = proposals(g)[0];
  assert.match(next.text, /long-burn/, 'after a short burn the team asks for full duration');
  g.cmd('decline-proposal', 'administrator', { proposalId: next.id });
  g.days(5);
  assert.equal(proposals(g).length, 0);
});

test('before delegation teams never act on their own; they only propose', () => {
  const g = game();
  g.days(60);
  assert.equal(g.state.work.length, 0);
  assert.equal(proposals(g).length, 1, 'one open proposal per programme, not a pile');
});

test('feasibility: the team meets the client, files both cases and raises the dossier without the player writing them', () => {
  const g = game();
  g.until(1946, 5, 17);
  const ask = proposals(g).find(p => p.refs.programme === 'aerobee');
  assert.ok(ask, 'the new request comes as a proposal to authorise feasibility work');
  g.cmd('approve-proposal', 'administrator', { proposalId: ask.id });
  g.days(1);
  const p = () => g.state.programmes.aerobee;
  assert.equal(p().stage, 'investigation');
  assert.equal(p().cases.engineering, null, 'nothing is filed instantly');
  g.days(40);
  assert.ok(p().meeting && p().cases.engineering && p().cases.funding);
  assert.match(p().cases.engineering.summary, /possible/);
  assert.match(p().cases.funding.summary, /\$300,000/);
  const d = g.state.decisions.find(x => x.type === 'preliminary-acceptance' && x.subject === 'aerobee');
  assert.ok(d && d.status === 'open');
  assert.match(d.text, /Engineering: .*Funding: /);
  assert.ok(g.state.day < dayOf(1946, 7, 1));
});

test('staff reason from claims and beliefs only: the module never touches the physical layer', () => {
  const src = readFileSync(new URL('../js/rules/staff.js', import.meta.url), 'utf8');
  assert.equal(/physics\.js|physical|trueDefectMechanism|rng/.test(src), false);
});

test('a stand fault leads the team through cause, fix, trial and adoption, then back to flying', () => {
  const g = game();
  const seen = [];
  for (let d = 0; d < 90; d++) {
    for (const x of proposals(g)) { seen.push(g.state.staff.proposals.find(p => p.id === x.id).step.kind); g.cmd('approve-proposal', 'administrator', { proposalId: x.id }); }
    for (const x of g.state.decisions.filter(d => d.status === 'open')) g.approve(x.id);
    g.days(1);
  }
  assert.ok(seen.includes('develop'), 'the team proposed a fix');
  assert.ok(g.state.decisions.some(d => d.type === 'trial') && g.state.decisions.some(d => d.type === 'deployment'), 'it raised the trial and the adoption');
  assert.equal(g.state.programmes.wac.baseline['wac-upper'], 'wac-upper/r3');
  assert.ok(g.state.launches.filter(l => l.status === 'flown').length >= 2, 'and it kept flying');
  assert.ok(g.state.memos.some(m => /monthly update/.test(m.text)), 'and it sent monthly updates');
});

test('a team does not ask for the pad while an unaccepted finding would make the technical director veto it', async () => {
  const { nextStep } = await import('../js/rules/staff.js');
  const g = game();
  const wac = g.state.programmes.wac, stages = { ...wac.baseline };
  // Pretend the stand work is done and a flight came back off course: the deviation finding is open.
  for (const [quantity, burn] of [['wac-upper.chamber-pressure', 'short'], ['wac-upper.chamber-pressure', 'long']])
    g.state.evidence.observations.push({ id: `x-${burn}`, day: 0, workId: `w-${burn}`, kind: 'ground', vehicle: 'wac', stages, conditions: { burn }, quantity, state: 'measured', value: 20, normal: true });
  assert.equal(nextStep(g.state, wac).kind, 'fly');
  g.state.evidence.observations.push({ id: 'x-dev', day: 0, workId: 'w-f', kind: 'flight', vehicle: 'wac', stages, conditions: { burn: 'long' }, quantity: 'vehicle.deviation', state: 'measured', value: 9, normal: false });
  assert.notEqual(nextStep(g.state, wac).kind, 'fly');
  g.state.beliefs.assessed = ['x-dev'];
  assert.equal(nextStep(g.state, wac).kind, 'fly', 'once you accept the known risk the team may ask again');
});
