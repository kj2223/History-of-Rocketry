// Contract tests: §9 continuation and saves, §10 commands in / projections out, the hidden-truth guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dispatch, project, saveGame, loadGame, exportGame, checkSave, newGame } from '../js/rules/index.js';
import { memoryStorage } from '../js/core/save.js';
import { MECHANISMS } from '../js/data/physical.js';
import { VEHICLES } from '../js/data/vehicles.js';
import { LAUNCH_TIERS } from '../js/rules/authority.js';
import { game, greenlightProgramme, groundTest, fly, book } from './game-1945.js';

const reload = s => checkSave(exportGame(s));
const HIDDEN = ['physical', 'trueDefectMechanism', 'latentMechanisms', 'traces', ...Object.keys(MECHANISMS)];
const assertNoLeak = s => {
  const text = JSON.stringify(project(s));
  for (const word of HIDDEN) assert.equal(text.includes(word), false, `projection leaks "${word}"`);
};

// A short campaign that exercises tests, a trial, flights and an anomaly.
const scripted = () => {
  const g = game(77);
  const frames = [g.state];
  g.until(1946, 5, 17); frames.push(g.state);
  greenlightProgramme(g, 'aerobee'); frames.push(g.state);
  g.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
  fly(g, 'aerobee', 'a1'); frames.push(g.state);
  groundTest(g, 'aerobee', 'long'); frames.push(g.state);
  // After an adverse long-burn finding the technical director vetoes further r1 flights.
  g.cmd('build-article', 'production', { id: 'a2', programmeId: 'aerobee' });
  const pad = book(g, 'pad-1', 'aerobee', 5), tracking = book(g, 'tracking-1', 'aerobee', 5);
  const d = g.cmd('request-launch', 'administrator', { id: 'L2', articleId: 'a2', pad, tracking, cost: 1, replacementCost: 1 }).decision;
  assert.match(g.state.decisions.find(x => x.id === d).consequence, /Scrubbed: vetoed by technical/);
  assert.equal(g.state.launches.find(l => l.id === 'L2').status, 'scrubbed');
  frames.push(g.state);
  return { g, frames };
};

test('FRZ-08 / AC01: no projection at any point contains physical truth or mechanism IDs', () => {
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
  const ok = dispatch(s, { id: 'x1', type: 'appoint', actor: 'administrator', payload: { id: 'pm', role: 'project-manager', person: 'A', programmeId: 'wac' } });
  assert.equal(JSON.stringify(s), before);
  assert.notEqual(ok.state, s);
  const again = dispatch(ok.state, { id: 'x1', type: 'appoint', actor: 'administrator', payload: { id: 'pm2', role: 'project-manager', person: 'B', programmeId: 'wac' } });
  assert.match(again.rejection.reason, /already applied/);
  assert.equal(again.state, ok.state);
  assert.match(dispatch(s, { id: 'x2', type: 'appoint', actor: 'crew', payload: {} }).rejection.reason, /may not/);
  assert.match(dispatch(s, { type: 'appoint', actor: 'administrator' }).rejection.reason, /stable id/);
});

test('§9.4: reload mid-test continues the same work; nothing rerolls', () => {
  const g = game(12);
  g.until(1946, 5, 17);
  greenlightProgramme(g, 'aerobee');
  g.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
  const pad = book(g, 'pad-1', 'aerobee', 5), tracking = book(g, 'tracking-1', 'aerobee', 5);
  g.approve(g.cmd('request-launch', 'administrator', { id: 'L1', articleId: 'a1', pad, tracking, cost: 1000, replacementCost: 1000 }).decision);
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
  const early = frames[3].evidence.observations;
  assert.deepEqual(g.state.evidence.observations.slice(0, early.length), early);
});

test('§9.5: saves use only this scenario\'s keys and leave the legacy vg3 save alone', () => {
  const storage = memoryStorage();
  storage.setItem('vg3', 'legacy campaign');
  const s = scripted().g.state;
  saveGame(s, storage);
  assert.deepEqual(loadGame(storage), JSON.parse(JSON.stringify(s)));
  assert.equal(storage.getItem('vg3'), 'legacy campaign');
  assert.throws(() => checkSave(exportGame({ ...s, rng: {} })), /damaged/);
});

test('FRZ-06: ground tiers are exercised; the crew tier exists but is inactive', () => {
  const l = scripted().g.state.launches[0];
  assert.deepEqual(Object.keys(l.tiers), LAUNCH_TIERS.map(t => t.tier));
  assert.equal(l.tiers.flight.stance, 'inactive');
  assert.notEqual(l.tiers['ground-technical'].stance, 'inactive');
});

test('FRZ-06: Flight Control holds a launch without a pad, before any decision is raised', () => {
  const g = game();
  g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
  const r = g.try('request-launch', 'administrator', { id: 'L', articleId: 'w1', pad: 'none', tracking: 'none', cost: 1, replacementCost: 1 });
  assert.match(r.rejection.reason, /Flight Control holds/);
  assert.equal(g.state.decisions.length, 0);
});

test('FRZ-01: v1 content has no crewed vehicles', () => {
  assert.equal(Object.values(VEHICLES).some(v => v.crewed), false);
});

test('AC06: approved routine work proceeds quietly, with one report and no decisions', () => {
  const g = game(5);
  const decisions = g.state.decisions.length, memos = g.state.memos.length;
  groundTest(g, 'wac', 'long', { stage: 'wac-upper', channels: ['wac-upper.chamber-pressure'] });
  assert.equal(g.state.decisions.length, decisions);
  assert.deepEqual(g.state.memos.slice(memos).map(m => m.kind), ['report']);
});

test('§4.4: after a failure, experimental flights are held until the failure risk is reviewed', () => {
  for (let seed = 1; seed < 200; seed++) {
    const g = game(seed);
    g.cmd('build-article', 'production', { id: 'w1', programmeId: 'wac' });
    if (fly(g, 'wac', 'w1').outcome !== 'failure') continue;
    const review = g.state.decisions.find(d => d.type === 'failure-review');
    assert.deepEqual(review.options, ['accept-known-risk', 'ground']);
    g.cmd('build-article', 'production', { id: 'w2', programmeId: 'wac' });
    const ask = () => {
      const pad = book(g, 'pad-1', 'wac', 5), tracking = book(g, 'tracking-1', 'wac', 5);
      return g.cmd('request-launch', 'administrator', { id: `L${g.state.day}`, articleId: 'w2', pad, tracking, cost: 1, replacementCost: 1 }).decision;
    };
    const held = ask();
    assert.match(g.state.decisions.find(x => x.id === held).consequence, /Scrubbed: vetoed by technical/);
    g.approve(review.id, 'accept-known-risk');
    g.days(6);
    const clearedId = ask();
    const cleared = g.state.decisions.find(d => d.id === clearedId);
    assert.equal(cleared.positions.technical.stance, 'approve');
    assert.match(cleared.positions.technical.reason, /assessed failure risk/);
    return;
  }
  assert.fail('no seed produced a failure');
});

test('a launch that is refused, or whose pad is given away, clears the pad', () => {
  const g = game(3);
  g.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second WAC series', vehicle: 'wac' });
  for (const id of ['w1', 'w2']) g.cmd('build-article', 'production', { id, programmeId: 'wac' });
  const ask = (id, articleId) => {
    const pad = book(g, 'pad-1', 'wac', 5), tracking = book(g, 'tracking-1', 'wac', 5);
    return g.cmd('request-launch', 'administrator', { id, articleId, pad, tracking, cost: 1, replacementCost: 1 }).decision;
  };
  const padFree = () => !g.state.facilities.reservations.some(r => r.unitId === 'pad-1' && r.status === 'held');
  g.approve(ask('refused', 'w1'), 'reject');
  assert.equal(g.state.launches.find(l => l.id === 'refused').status, 'scrubbed');
  assert.ok(padFree(), 'refusing releases the pad at once');
  assert.equal(g.state.hardware.articles.w1.status, 'built', 'the article can fly another day');
  const waiting = ask('bumped', 'w2');
  const clash = g.cmd('reserve-facility', 'administrator', { id: 'next', unitId: 'pad-1', programmeId: 'wac-2', from: g.state.day, to: g.state.day + 2, purpose: 'launch' });
  g.approve(clash.decision, 'displace');
  g.days(1);
  assert.equal(g.state.launches.find(l => l.id === 'bumped').status, 'scrubbed');
  assert.equal(g.state.decisions.find(d => d.id === waiting).decidedBy, 'flight-control');
  assert.equal(g.state.facilities.reservations.find(r => r.id === 'next').status, 'held');
});

test('a save whose sections are present but whose contents cannot be shown is refused on import and load', () => {
  const env = JSON.parse(exportGame(newGame()));
  env.state.memos.push(null);
  const text = JSON.stringify(env);
  assert.throws(() => checkSave(text), /damaged/);
  const storage = memoryStorage();
  storage.setItem('pa-v1', text);
  assert.throws(() => loadGame(storage), /damaged/);
});
