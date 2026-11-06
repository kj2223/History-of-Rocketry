// Contract tests carried from V1 into V2: §9 continuation and saves, §10 commands in / projections out,
// the hidden-truth guard. They run on V2 content: a fresh 1958 start and the Mercury-Redstone programme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dispatch, project, saveGame, loadGame, exportGame, checkSave, newGame } from '../js/rules/index.js';
import { memoryStorage } from '../js/core/save.js';
import { LAUNCH_TIERS } from '../js/rules/authority.js';
import { game, groundTest, fly, book, assertNoLeak, mercuryRedstone } from './game.js';

const reload = s => checkSave(exportGame(s));
// A short campaign that exercises stand and chamber tests and a flight.
const scripted = () => {
  const g = mercuryRedstone();
  const frames = [g.state];
  groundTest(g, 'mercury-redstone', 'short', { stage: 'redstone', channels: ['redstone.chamber-pressure'] }); frames.push(g.state);
  groundTest(g, 'mercury-redstone', 'short', { stage: 'mercury-capsule', channels: ['mercury-capsule.cabin-pressure'], unit: 'env-1' }); frames.push(g.state);
  g.cmd('build-article', 'production', { id: 'mr1', programmeId: 'mercury-redstone' });
  fly(g, 'mercury-redstone', 'mr1'); frames.push(g.state);
  return { g, frames };
};

test('FRZ-08 / AC01: no projection at any point contains physical truth, mechanism ids or hidden traits', () => {
  for (const s of scripted().frames) assertNoLeak(s);
});

test('§4.1: only physics.js reads the physical layer or its data', () => {
  const dir = new URL('../js/rules/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (f !== 'physics.js') assert.doesNotMatch(src, /data\/physical\.js/, `${f} imports physical data`);
    if (!['physics.js', 'index.js'].includes(f)) assert.doesNotMatch(src, /\.physical\b|physical:/, `${f} touches state.physical`);
  }
});

test('§10.1: dispatch never mutates its input; rejections return the same state; ids are stable', () => {
  const s = newGame(3);
  const before = JSON.stringify(s);
  const ok = dispatch(s, { id: 'x1', type: 'appoint', actor: 'administrator', payload: { id: 'pm', role: 'project-manager', person: 'A', programmeId: 'mercury-redstone' } });
  assert.equal(JSON.stringify(s), before);
  assert.notEqual(ok.state, s);
  const again = dispatch(ok.state, { id: 'x1', type: 'appoint', actor: 'administrator', payload: { id: 'pm2', role: 'project-manager', person: 'B', programmeId: 'mercury-redstone' } });
  assert.match(again.rejection.reason, /already applied/);
  assert.equal(again.state, ok.state);
  assert.match(dispatch(s, { id: 'x2', type: 'appoint', actor: 'crew', payload: {} }).rejection.reason, /may not/);
  assert.match(dispatch(s, { type: 'appoint', actor: 'administrator' }).rejection.reason, /stable id/);
});

test('§9.4: reload mid-flight continues the same work; nothing rerolls', () => {
  const g = mercuryRedstone(12);
  g.cmd('build-article', 'production', { id: 'mr1', programmeId: 'mercury-redstone' });
  const pad = book(g, 'pad-1', 'mercury-redstone', 5), tracking = book(g, 'tracking-1', 'mercury-redstone', 5);
  g.approve(g.cmd('request-launch', 'administrator', { id: 'L1', articleId: 'mr1', pad, tracking, cost: 1000, replacementCost: 1000 }).decision);
  g.days(2);
  const midway = g.state;
  assert.equal(midway.work.find(j => j.id === 'flight-L1').status, 'running');
  const straight = game(); straight.state = midway; straight.days(6);
  const reloaded = game(); reloaded.state = reload(midway); reloaded.days(6);
  assert.equal(JSON.stringify(reloaded.state), JSON.stringify(straight.state));
});

test('FRZ-08 / AC07: projections are stable across reload; raw records are never rewritten', () => {
  const { g, frames } = scripted();
  assert.deepEqual(project(reload(g.state)), project(g.state));
  const early = frames[1].evidence.observations;
  assert.deepEqual(g.state.evidence.observations.slice(0, early.length), early);
});

test('§12: V2 saves use only V2 keys and leave V1 and legacy saves alone', () => {
  const storage = memoryStorage();
  storage.setItem('vg3', 'legacy campaign');
  storage.setItem('pa-v1', 'a V1 campaign');
  const s = scripted().g.state;
  saveGame(s, storage);
  assert.deepEqual(loadGame(storage), JSON.parse(JSON.stringify(s)));
  assert.equal(storage.getItem('vg3'), 'legacy campaign');
  assert.equal(storage.getItem('pa-v1'), 'a V1 campaign');
  assert.throws(() => checkSave(exportGame({ ...s, rng: {} })), /damaged/);
  assert.throws(() => checkSave(exportGame({ ...s, people: undefined })), /damaged/);
});

test('FRZ-06: launch tiers are all recorded; with no crew aboard the crew tier is inactive', () => {
  const l = scripted().g.state.launches[0];
  assert.deepEqual(Object.keys(l.tiers), LAUNCH_TIERS.map(t => t.tier));
  assert.deepEqual(l.tiers.flight, { stance: 'inactive', reason: 'no crew aboard' });
  assert.notEqual(l.tiers['ground-technical'].stance, 'inactive');
});

test('FRZ-06: Flight Control holds a launch without a pad, before any decision is raised', () => {
  const g = mercuryRedstone();
  const decisions = g.state.decisions.length;
  g.cmd('build-article', 'production', { id: 'mr1', programmeId: 'mercury-redstone' });
  const r = g.try('request-launch', 'administrator', { id: 'L', articleId: 'mr1', pad: 'none', tracking: 'none', cost: 1, replacementCost: 1 });
  assert.match(r.rejection.reason, /Flight Control holds/);
  assert.equal(g.state.decisions.length, decisions);
});
