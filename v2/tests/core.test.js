import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dayOf, dateOf, dateLabel, START_DAY, END_DAY, fiscalQuarter } from '../js/core/calendar.js';
import { newStreams, withStreams, draw, STREAMS } from '../js/core/rng.js';
import { exportSave, parseSave, writeSave, readSave, importSave, resetSave, memoryStorage, KEYS, SaveError } from '../js/core/save.js';

test('calendar: day 0 is still 1 Jan 1945; V2 runs from NASA formation to the end of 1966', () => {
  assert.deepEqual(dateOf(0), { year: 1945, month: 1, date: 1 });
  assert.equal(dateLabel(START_DAY), '1 October 1958');
  assert.equal(dateLabel(END_DAY), '31 December 1966');
});

test('calendar: fiscal quarters run July to June', () => {
  const jul = fiscalQuarter(dayOf(1945, 7, 15));
  assert.deepEqual(jul, { fy: 1946, q: 1, start: dayOf(1945, 7, 1), end: dayOf(1945, 9, 30) });
  const nov = fiscalQuarter(dayOf(1945, 11, 2));
  assert.deepEqual(nov, { fy: 1946, q: 2, start: dayOf(1945, 10, 1), end: dayOf(1945, 12, 31) });
  assert.deepEqual(fiscalQuarter(dayOf(1946, 6, 30)), { fy: 1946, q: 4, start: dayOf(1946, 4, 1), end: dayOf(1946, 6, 30) });
});

test('rng: streams are independent and resume from saved state', () => {
  const a = newStreams(7), b = newStreams(7);
  draw(a.observation); draw(a.observation);
  assert.equal(draw(a.physical), draw(b.physical), 'drawing observation does not move physical');
  const saved = JSON.parse(JSON.stringify(a.forecast));
  assert.equal(draw(a.forecast), draw(saved));
});

test('rng: V2 adds intelligence, crew and operations streams and keeps the streams a V1 save already has', () => {
  assert.deepEqual(STREAMS, ['physical', 'observation', 'forecast', 'intelligence', 'crew', 'operations']);
  const v1 = { physical: { algorithm: 'mulberry32-v1', state: 42 }, observation: { algorithm: 'mulberry32-v1', state: 43 }, forecast: { algorithm: 'mulberry32-v1', state: 44 } };
  const merged = withStreams(v1, 9);
  assert.equal(merged.physical.state, 42);
  assert.deepEqual(merged.crew, newStreams(9).crew);
  assert.notEqual(merged.physical, v1.physical, 'copied, not shared');
});

const ok = () => {};
const state = { day: 3, hello: 'world' };

test('save: round trip, last-good fallback and unreadable stash', () => {
  const s = memoryStorage();
  assert.equal(readSave(s, ok), null);
  writeSave(s, state);
  assert.deepEqual(readSave(s, ok), state);
  s.setItem(KEYS.current, '{broken');
  assert.deepEqual(readSave(s, ok), state);
  assert.equal(s.getItem(KEYS.unreadable), '{broken');
});

test('save: V2 has its own format and keys and starts at content version 1; unknown versions are rejected', () => {
  const env = JSON.parse(exportSave(state));
  assert.deepEqual([env.format, env.scenario, env.contentVersion], ['per-aspera-v2', 'v2-1958-1966', 1]);
  assert.deepEqual(KEYS, { current: 'pa-v2', lastGood: 'pa-v2-last-good', unreadable: 'pa-v2-unreadable' });
  for (const cv of [0, 2, 4]) assert.throws(() => parseSave(JSON.stringify({ ...env, contentVersion: cv }), ok), SaveError);
  assert.throws(() => parseSave(JSON.stringify({ ...env, contentVersion: 2 }), ok), /newer version/);
  assert.throws(() => parseSave(JSON.stringify({ ...env, format: 'per-aspera-v1' }), ok), /This is a V1 save/);
});

test('save: import rejects another scenario before touching active state', () => {
  const s = memoryStorage();
  writeSave(s, state);
  const before = s.getItem(KEYS.current);
  const fork = JSON.stringify({ ...JSON.parse(exportSave(state)), scenario: 'wac-research' });
  assert.throws(() => importSave(s, fork, ok), /another scenario/);
  assert.throws(() => importSave(s, exportSave(state), () => { throw new Error('bad'); }), /damaged/);
  assert.equal(s.getItem(KEYS.current), before);
});

test('save: reset touches only this scenario\'s keys', () => {
  const s = memoryStorage();
  s.setItem('vg3', 'legacy');
  writeSave(s, state);
  resetSave(s);
  assert.deepEqual(s.keys(), ['vg3']);
});

test('layering: js/core never imports rules or data', () => {
  const dir = new URL('../js/core/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /from\s+['"][^'"]*(rules|data)\//, f);
  }
});
