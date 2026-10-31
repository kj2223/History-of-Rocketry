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

// THE CORPORAL CONTRACT.
import { corporalTick, answerCorporal, redstonePayment } from '../js/rules/corporal.js';
import { CORPORAL_MILESTONES, CORPORAL_LATE_SHARE, CORPORAL_REDSTONE_PAYMENT } from '../js/data/history.js';
import { finishJob } from '../js/rules/jobs.js';
import { freeTeams } from '../js/core/state.js';

const offerCorporal = () => {
  createProgramme('aerobee');
  S.progs.aerobee.okf = 3;
  corporalTick();
};

test('the Corporal is offered at the Aerobee hand-off, not before', () => {
  corporalTick();
  assert.equal(S.corp, null);
  offerCorporal();
  assert.equal(S.corp.st, 'offer');
});

test('each Corporal milestone holds a team, pays on time and half when late, and the last one backs the Redstone', () => {
  offerCorporal();
  S.teams = 2;
  answerCorporal(true);
  const cash = S.b;
  for (let index = 0; index < CORPORAL_MILESTONES.length; index++) {
    corporalTick();
    const job = S.jobs.find(each => each.k == 'corp');
    assert.equal(job.m, index);
    assert.equal(freeTeams(), 1, 'the contract holds one team');
    if (index == 1) S.day = S.corp.d + CORPORAL_MILESTONES[1].due + 1;
    S.jobs.splice(S.jobs.indexOf(job), 1);
    finishJob(job);
  }
  const owed = CORPORAL_MILESTONES.reduce((sum, each, index) => sum + each.pay * (index == 1 ? CORPORAL_LATE_SHARE : 1), 0);
  assert.equal(S.corp.st, 'done');
  assert.equal(S.b - cash, owed);
  redstonePayment();
  redstonePayment();
  assert.equal(S.b - cash, owed + CORPORAL_REDSTONE_PAYMENT, 'the Redstone payment comes once');
});

test('a declined Corporal never takes a team', () => {
  offerCorporal();
  answerCorporal(false);
  corporalTick();
  assert.equal(S.jobs.filter(job => job.k == 'corp').length, 0);
});

// THE SOVIET MOON RACE.
import { openMoonRace, moonRaceTick, moonIntel, sovietAdapt } from '../js/rules/moon-race.js';
import { RIVAL_MOON, INTEL_LAG } from '../js/data/history.js';

const startMoonRace = () => {
  S.nasa = 1;
  S.p2 = { secDone: 1 };
  moonRaceTick();
};
const runMoonRace = until => {
  for (; S.day <= until; S.day += 5) moonRaceTick();
};

test('the Moon race opens with Section 2, its attempts dated like the other Section 2 events', () => {
  moonRaceTick();
  assert.equal(S.rm, null);
  startMoonRace();
  const lateness = S.rv.r_gagarin - 5502;
  assert.equal(S.rm.m_luna9.day, RIVAL_MOON[0].day + lateness);
  assert.equal(Object.keys(S.rmi).length, 3);
});

test('attempts wait for what they need, retry after failing, and are abandoned after their last try', () => {
  startMoonRace();
  const always = sovietAdapt.chance;
  sovietAdapt.chance = attempt => attempt.id == 'm_n1' ? 0 : 1;
  try {
    runMoonRace(12000);
  } finally {
    sovietAdapt.chance = always;
  }
  assert.equal(S.rm.m_zond.st, 'done');
  assert.ok(S.rm.m_zond.at >= S.rm.m_soyuz.at + 300, 'Zond waits for Soyuz');
  assert.equal(S.rm.m_n1.st, 'gone');
  assert.equal(S.rm.m_n1.n, 4);
  assert.equal(S.rm.m_l3.st, 'gone', 'no landing without the rocket');
  assert.equal(S.fs.f_moon, undefined);
  assert.equal(S.fs.f_circum, 'them');
});

test('a Soviet first already won by America only makes the news', () => {
  startMoonRace();
  S.fs.f_softland = 'us';
  const always = sovietAdapt.chance;
  sovietAdapt.chance = () => 1;
  try {
    runMoonRace(S.rm.m_luna9.day);
  } finally {
    sovietAdapt.chance = always;
  }
  assert.equal(S.fs.f_softland, 'us');
});

test('intelligence keeps believing in an abandoned rocket for a while', () => {
  startMoonRace();
  const always = sovietAdapt.chance;
  sovietAdapt.chance = () => 0;
  try {
    runMoonRace(S.rm.m_n1.day + 4 * 160);
  } finally {
    sovietAdapt.chance = always;
  }
  assert.equal(S.rm.m_n1.st, 'gone');
  assert.ok(moonIntel().some(estimate => estimate.goal == 'landing'), 'still reported just after it is abandoned');
  S.day = S.rm.m_n1.at + INTEL_LAG + 1;
  assert.ok(!moonIntel().some(estimate => estimate.goal == 'landing'));
});

test('with the historical odds, a Soviet crew rarely reaches the Moon', () => {
  let landed = 0;
  for (let seed = 1; seed <= 200; seed++) {
    Math.random = seeded(seed);
    resetState();
    startMoonRace();
    runMoonRace(10800);
    if (S.rm.m_l3.st == 'done') landed++;
  }
  assert.ok(landed >= 4 && landed <= 40, `Soviet landings: ${landed} of 200`);
});
