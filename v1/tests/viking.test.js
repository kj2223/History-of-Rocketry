// Freeze §2.1: the Viking sounding-rocket programme is playable. Its vehicle arrives after design work,
// and the early motor carries a latent fault the team can find on the stand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, greenlightProgramme, groundTest, fly } from './game.js';
import { TUNING } from '../js/data/tuning.js';
import { project } from '../js/rules/index.js';

const vikingReady = () => {
  const g = game();
  g.until(1946, 8, 1);
  greenlightProgramme(g, 'viking');
  assert.equal(g.state.programmes.viking.vehicle, null, 'no vehicle at greenlight');
  assert.match(g.try('build-article', 'production', { id: 'v1', programmeId: 'viking' }).rejection.reason, /no vehicle/);
  g.days(TUNING.designDays.viking);
  return g;
};

test('while Viking is being designed the team says so and when the vehicles are due', () => {
  const g = game();
  g.until(1946, 8, 1);
  greenlightProgramme(g, 'viking');
  assert.match(project(g.state).programmes.find(p => p.id === 'viking').team, /Design and contractor work under way; the first vehicles are due/);
});

test('a save greenlit before design work existed starts it instead of stalling', () => {
  const g = game();
  g.until(1946, 8, 1);
  greenlightProgramme(g, 'viking');
  delete g.state.programmes.viking.designReady;
  g.days(1);
  assert.ok(g.state.programmes.viking.designReady > g.state.day);
  g.days(TUNING.designDays.viking);
  assert.equal(g.state.programmes.viking.vehicle, 'viking');
});

test('Viking gets its vehicle when the design work after greenlight is done', () => {
  const g = vikingReady();
  const p = g.state.programmes.viking;
  assert.equal(p.vehicle, 'viking');
  assert.deepEqual(p.baseline, { viking: 'viking/r1' });
  assert.ok(project(g.state).inbox.some(m => /first Viking vehicles are delivered/.test(m.text)));
  g.cmd('build-article', 'production', { id: 'v1', programmeId: 'viking' });
  const l = fly(g, 'viking', 'v1');
  assert.equal(l.status, 'flown');
});

test('a long stand firing shows the Viking motor fault and leaves two explanations open', () => {
  const g = vikingReady();
  const opts = { stage: 'viking', channels: ['viking.chamber-pressure'] };
  const short = groundTest(g, 'viking', 'short', opts);
  assert.ok(short.observations.length);
  assert.equal(g.state.beliefs.anomalies['viking-loss'], undefined, 'a short firing looks normal');
  groundTest(g, 'viking', 'long', opts);
  const a = g.state.beliefs.anomalies['viking-loss'];
  assert.ok(a, 'the long firing opens an investigation');
  assert.deepEqual(Object.keys(a.hypotheses).sort(), ['viking-gimbal-fault', 'viking-steam-generator']);
});
