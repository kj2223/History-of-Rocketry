// Freeze §8.3, §10.3: Flight Control invites the administrator to watch a launch; answering changes nothing physical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, book } from './game-1945.js';
import { project } from '../js/rules/index.js';

const launch = g => {
  g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
  const pad = book(g, 'pad-1', 'wac', 5), tracking = book(g, 'tracking-1', 'wac', 5);
  g.approve(g.cmd('request-launch', 'administrator', { id: 'L1', articleId: 'w1', pad, tracking, cost: 20000, replacementCost: 20000 }).decision);
};
const invitation = g => project(g.state).inbox.find(i => i.kind === 'invitation');

test('an approved launch brings an invitation; it lapses if the flight ends unanswered', () => {
  const g = game();
  launch(g);
  assert.equal(invitation(g).refs.launch, 'L1');
  g.finish('flight-L1');
  assert.equal(invitation(g), undefined);
  assert.equal(g.state.launches[0].invitation, 'lapsed');
  assert.match(g.try('answer-invitation', 'administrator', { launchId: 'L1', attend: true }).rejection.reason, /no open invitation/);
});

test('attending or sending apologies leaves the flight exactly as it would have been', () => {
  const outcome = attend => {
    const g = game();
    launch(g);
    if (attend !== null) g.cmd('answer-invitation', 'administrator', { launchId: 'L1', attend });
    g.finish('flight-L1');
    return [g.state.launches[0].invitation, JSON.stringify(g.state.evidence.observations), g.state.launches[0].outcome];
  };
  const [a, b, c] = [outcome(true), outcome(false), outcome(null)];
  assert.deepEqual([a[0], b[0], c[0]], ['attending', 'apologies', 'lapsed']);
  assert.equal(a[1], c[1]); assert.equal(b[1], c[1]); assert.equal(a[2], c[2]);
});

test('only the administrator answers an invitation', () => {
  const g = game();
  launch(g);
  assert.equal(g.try('answer-invitation', 'flight-control', { launchId: 'L1', attend: true }).rejection.needed, 'authority');
});
