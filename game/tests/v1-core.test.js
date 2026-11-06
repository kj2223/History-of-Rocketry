import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dayOf, dateOf, dateLabel, END_DAY, fiscalQuarter } from '../js/core/calendar.js';
import { newStreams, draw } from '../js/core/rng.js';
import { exportSave, parseSave, writeSave, readSave, importSave, resetSave, memoryStorage, KEYS, SaveError } from '../js/core/save.js';

test('calendar: day 0 is 1 Jan 1945 and the campaign ends at NASA formation', () => {
  assert.deepEqual(dateOf(0), { year: 1945, month: 1, date: 1 });
  assert.equal(dateLabel(END_DAY), '1 October 1958');
  assert.equal(dayOf(1957, 10, 4) < END_DAY, true);
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

test('save: version policy accepts cv 4 only, rejects future and fork versions', () => {
  const env = JSON.parse(exportSave(state));
  assert.equal(env.contentVersion, 4);
  for (const cv of [1, 3, 5]) {
    assert.throws(() => parseSave(JSON.stringify({ ...env, contentVersion: cv }), ok), SaveError);
  }
  assert.throws(() => parseSave(JSON.stringify({ ...env, contentVersion: 5 }), ok), /newer version/);
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
