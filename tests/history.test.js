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

// RIDE-ALONGS AND BUMPER.
import { bookRide, rideCost, answerBumper, separationChance } from '../js/rules/neighbours.js';
import { BUMPER_FLIGHTS, BUMPER_OFFER, BUMPER_COST, V2_PROGRAMME as V2 } from '../js/data/history.js';
import { createProgramme } from '../js/rules/programs.js';

// Fly V-2s until n more have flown.
const flyNext = (n = 1) => {
  const target = S.v2.n + n;
  while (S.v2.n < target && S.day <= V2.end + 60) { S.day++; neighboursTick(); }
};

test('a payload booked on a V-2 costs its price and the fee, and comes back only if the V-2 does', () => {
  S.b = 50000;
  S.day = V2.start;
  neighboursTick();
  assert.equal(bookRide('Sensor Suite'), null);
  assert.equal(S.b, 50000 - rideCost('Sensor Suite'));
  assert.notEqual(bookRide('Sensor Suite'), null, 'only one booking at a time');
  assert.notEqual(bookRide('Film Camera'), null, 'film needs its research first');
  const before = S.b, good = S.v2.ok;
  flyNext();
  assert.equal(S.v2.ride, null);
  assert.ok(S.v2.ok > good ? S.b > before : S.b == before);
});

test('Bumper is offered once the WAC Corporal is proven, flies on the next V-2s and can win the multi-stage first', () => {
  S.b = 500000;
  createProgramme('wac');
  S.progs.wac.okf = BUMPER_OFFER.proven;
  S.day = BUMPER_OFFER.day;
  S.v2.n = 1;
  S.v2.next = BUMPER_OFFER.day + 1;
  neighboursTick();
  assert.equal(S.v2.bump.st, 'offer');
  answerBumper(true);
  assert.notEqual(bookRide('Sensor Suite'), null, 'no nose space while Bumper flies');
  const cash = S.b;
  flyNext(BUMPER_FLIGHTS);
  assert.equal(S.v2.bump.st, 'done');
  assert.equal(S.v2.bump.n, BUMPER_FLIGHTS);
  const firstsCash = ['f_stage', 'f_range'].filter(id => S.fs[id] == 'us').reduce((sum, id) => sum + FIRSTS.find(first => first.id == id).cash, 0);
  assert.equal(S.b, cash - BUMPER_FLIGHTS * BUMPER_COST + firstsCash);
  if (S.v2.bump.ok) assert.equal(S.fs.f_stage, 'us');
  assert.equal(S.fs.f_space, undefined, 'Bumper never wins the altitude firsts');
  assert.ok(separationChance() > .5 && separationChance() < .95);
});

test('Bumper is never offered before the WAC Corporal is proven', () => {
  createProgramme('wac');
  S.day = BUMPER_OFFER.day;
  S.v2.n = 1;
  neighboursTick();
  assert.equal(S.v2.bump, null);
});
