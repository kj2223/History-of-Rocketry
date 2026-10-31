// HISTORY TESTS: the Army's captured V-2s beside you on the range (rules/neighbours.js). Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, resetState, logSink } from '../js/core/state.js';
import { V2_PROGRAMME, FIRSTS } from '../js/data/history.js';
import { neighboursTick } from '../js/rules/neighbours.js';
import { checkFirsts } from '../js/rules/race.js';

const seeded = seed => () => {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let mixed = Math.imul(seed ^ seed >>> 15, 1 | seed);
  mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
  return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
};
beforeEach(() => {
  Math.random = seeded(7);
  resetState();
});
// Run the calendar one day a tick from the first V-2 to the last.
const flyTheV2s = () => {
  for (S.day = 0; S.day <= V2_PROGRAMME.end + 60; S.day++) neighboursTick();
};

test('the V-2s fly about sixty times from 1946 to 1952, a third failing, never above their record', () => {
  flyTheV2s();
  assert.ok(S.v2.n >= 50 && S.v2.n <= 70, `flights: ${S.v2.n}`);
  assert.ok(S.v2.ok / S.v2.n > .5 && S.v2.ok / S.v2.n < .9, `good: ${S.v2.ok}/${S.v2.n}`);
  assert.ok(S.v2.hi >= V2_PROGRAMME.peak[0] && S.v2.hi <= V2_PROGRAMME.record);
  assert.ok(S.v2.next > V2_PROGRAMME.end);
});

test('the V-2s never claim a first', () => {
  flyTheV2s();
  assert.deepEqual(S.fs, {});
});

test('a save opened years in skips the V-2 launches it missed without a word', () => {
  const lines = [];
  logSink.fn = text => lines.push(text);
  S.day = 1500;
  neighboursTick();
  logSink.fn = null;
  assert.equal(S.v2.n, 0);
  assert.equal(lines.length, 0);
  assert.ok(S.v2.next >= 1500 - 60);
});

test('a monkey recovered alive from 72 km is the first animal home, as Yorick was', () => {
  checkFirsts({ ok: true, pay: 'Primate Capsule', rec: 1, peak: 72000 });
  assert.equal(S.fs.f_bio, 'us');
  assert.ok(FIRSTS.find(first => first.id == 'f_space').name.includes('American-built'));
});
