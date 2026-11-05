// Freeze §3.2: independent assurance restricts readiness and has a protected challenge route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, book, fly } from './game.js';
import { openQuestions } from '../js/rules/summary.js';

const failedWac = () => {
  for (let seed = 1; seed < 200; seed++) {
    const g = game(seed);
    g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
    if (fly(g, 'wac', 'w1').outcome === 'failure') return g;
  }
  throw new Error('no seed produced a failure');
};

test('an adverse finding on the configuration in use brings an assurance restriction, kept in the inherited record', () => {
  const g = failedWac();
  g.days(1);
  const r = g.state.assurance.restrictions.filter(x => x.status === 'open');
  assert.ok(r.length && r.every(x => x.programmeId === 'wac'));
  assert.ok(g.state.memos.some(m => m.from === 'assurance' && /restricts WAC Corporal/.test(m.text)));
  assert.ok(openQuestions(g.state).readinessRestrictions.find(x => x.programmeId === 'wac').assurance.length);
});

test('accepting a known risk is challenged; standing by it leaves dissent on the record', () => {
  const g = failedWac();
  const review = g.state.decisions.find(d => d.type === 'failure-review');
  g.approve(review.id, 'accept-known-risk');
  const ch = g.state.decisions.find(d => d.type === 'assurance-challenge' && d.status === 'open');
  assert.ok(ch, 'assurance challenges the acceptance');
  assert.equal(g.try('decide', 'technical-director', { decisionId: ch.id, choice: 'stand-by-decision' }).rejection.needed, 'authority', 'only the administrator answers it');
  g.approve(ch.id, 'stand-by-decision');
  assert.equal(g.state.assurance.challenges[0].status, 'overruled');
  assert.ok(openQuestions(g.state).disagreements.some(d => d.type === 'assurance-challenge'));
});

test('upholding the challenge grounds the configuration again', () => {
  const g = failedWac();
  const review = g.state.decisions.find(d => d.type === 'failure-review');
  g.approve(review.id, 'accept-known-risk');
  const assessed = g.state.beliefs.assessed.length;
  assert.ok(assessed > 0);
  g.approve(g.state.decisions.find(d => d.type === 'assurance-challenge').id, 'ground-configuration');
  assert.equal(g.state.beliefs.assessed.length, 0);
  assert.equal(openQuestions(g.state).disagreements.filter(d => d.type === 'assurance-challenge').length, 0);
  g.cmd('build-article', 'production', { id: 'w2', programmeId: 'wac' });
  const pad = book(g, 'pad-1', 'wac', 5), tracking = book(g, 'tracking-1', 'wac', 5);
  const ask = g.cmd('request-launch', 'administrator', { id: 'L2', articleId: 'w2', pad, tracking, cost: 1, replacementCost: 1 }).decision;
  assert.match(g.try('decide', 'administrator', { decisionId: ask, choice: 'approve' }).rejection.reason, /Vetoed by technical/);
});
