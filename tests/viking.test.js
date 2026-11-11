// The Viking rounds and the new blockhouse: the turbine's steam leak that shows only as a late sag on a full-duration
// firing, fins that let go, hold-downs that can let a round loose on the stand, the blockhouse going up over the winter,
// and your first budget line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newRound,
  staticFire,
  hasTurbineFault,
  hasHolddownFault,
  standRework,
  fly,
  wreckage,
  flyLoose,
  ellisReading,
} from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { initRecord, standing, shiftTrust } from '../js/career/record.js';
import { LINE, COSTS, planCost, spend, lineFor } from '../js/world/budget.js';
import { SEASON, blockhouseState, SITE_CHANGES } from '../js/data/campaign.js';
import { dayOf } from '../js/core/calendar.js';
import { g, newGame, finishPlan, onBudget, standStart, rideOut, returnFromRecovery, chair } from '../js/game.js';
import { playRound, advance, until } from './play.js';

const viking = (s, p = initProgramme()) => newRound(s, p, 'viking');
const seedWhere = ok => {
  for (let s = 1; s < 800; s++) if (ok(viking(s))) return s;
  throw new Error('no seed');
};
const tail = (trace, n = 12) => trace.slice(-n).reduce((a, p) => a + p.pc, 0) / n;

test('a leaking turbine shows only on a full-duration firing, as chamber pressure sagging late in the burn', () => {
  const r = viking(seedWhere(r => hasTurbineFault(r) && !hasHolddownFault(r)));
  const short = staticFire(r, 'short');
  assert.ok(tail(short.trace) > 19.5, 'a short firing looks normal');
  const long = staticFire(r, 'long');
  assert.ok(long.trace.find(p => p.t === 10).pc > 19.5, 'normal for the first seconds');
  assert.ok(tail(long.trace) < 18, `sags late: ${tail(long.trace)}`);
  standRework(r);
  assert.equal(hasTurbineFault(r), false);
  assert.ok(tail(staticFire(r, 'long').trace) > 19.5);
});

test('flawed hold-downs only let go under a full-duration firing, and the round is lost', () => {
  let loose = 0;
  for (let s = 1; s < 400; s++) {
    const r = viking(s);
    if (!hasHolddownFault(r)) continue;
    assert.equal(staticFire(r, 'short').loose, null, 'a short firing never pulls her loose');
    if (staticFire(r, 'long').loose) {
      loose++;
      const f = flyLoose(r);
      assert.equal(f.failure, 'holddown');
      assert.ok(f.apogee < 10 && f.range < 10);
      assert.match(wreckage(r).join(' '), /hold-down fittings are sheared/);
      assert.equal(ellisReading(r), 'holddown', 'nobody doubts what happened');
    }
  }
  assert.ok(loose > 20, `${loose} breakaways`);
});

test("Vikings fail by turbine cutoff, fins and leaks, and the reviews' fixes carry", () => {
  const seen = new Set();
  for (let s = 1; s < 300; s++) {
    const r = viking(s),
      f = fly(r);
    if (f.failure) seen.add(f.failure);
  }
  assert.deepEqual([...seen].sort(), ['cutoff', 'fin', 'leak']);
  const p = initProgramme();
  adopt(p, 'cutoff');
  for (let s = 1; s < 200; s++) assert.equal(hasTurbineFault(viking(s, p)), false);
  const clean = viking(5);
  clean.faults = {};
  clean.viking = 'viking/r2';
  const f = fly(clean);
  assert.equal(f.failure, null);
  assert.ok(f.apogee > 140 && f.apogee < 200, `apogee ${f.apogee}`);
});

test('the new blockhouse goes up over the winter of 1950-51', () => {
  assert.deepEqual(blockhouseState(dayOf(1950, 6, 1)), { built: false, progress: 0 });
  const mid = blockhouseState(dayOf(1950, 12, 15));
  assert.ok(!mid.built && mid.progress > 0.3 && mid.progress < 0.9);
  assert.equal(blockhouseState(SITE_CHANGES.newBlockhouse.done).built, true);
  const v5 = SEASON.find(r => r.id === 'viking-5'),
    v7 = SEASON.find(r => r.id === 'viking-7');
  assert.ok(
    blockhouseState(v5.start).progress > 0 && !blockhouseState(v5.start).built,
    'Viking 5 flies while it is going up',
  );
  assert.ok(blockhouseState(v7.start).built, 'Viking 7 is counted from the new one');
});

test('your budget line: each fiscal year opens a fresh line, and going over counts against your standing', () => {
  const r = initRecord();
  shiftTrust(r, 2);
  const before = standing(r);
  assert.equal(lineFor(r, dayOf(1950, 11, 20)).fy, 1951);
  assert.equal(
    planCost({ inspector: 'kowalski', burn: 'long', leak: true }),
    COSTS.inspect.kowalski + COSTS.long + COSTS.leak,
  );
  spend(r, dayOf(1950, 11, 20), LINE - 1000, 'firings');
  assert.equal(r.overspent || 0, 0);
  spend(r, dayOf(1951, 2, 1), 5000, 'a slip');
  assert.equal(r.overspent, 1);
  spend(r, dayOf(1951, 3, 1), 5000, 'more');
  assert.equal(r.overspent, 1, 'a year over the line counts once');
  assert.equal(standing(r), before - 1);
  assert.equal(lineFor(r, dayOf(1951, 8, 1)).spent, 0, 'fiscal 1952 starts fresh');
});

// Play to the Viking rounds as test conductor.
function toViking(seed) {
  newGame(seed);
  while (g.vehicle !== 'viking') {
    playRound(() => 'nominal');
    if (g.record.offers.length && !g.record.offers[0].made) {
      g.record.offers[0].made = true;
      g.record.offers[0].answer = null;
    }
    advance(true);
  }
  assert.equal(g.record.seat, 'test-conductor');
}

test('as conductor of a Viking round you spend from your line, and the write-up shows it', () => {
  toViking(6);
  assert.ok(onBudget());
  playRound(() => 'nominal', { inspector: 'kowalski', burn: 'short', leak: true });
  const entry = g.record.rounds.at(-1);
  assert.ok(entry.budget, 'the round carries its budget');
  assert.ok(entry.budget.spent >= COSTS.inspect.kowalski + COSTS.leak);
});

test('a round that breaks loose on the stand goes to the range plot, the recovery and the review', () => {
  // Find a campaign seed whose first Viking breaks loose on a full-duration firing.
  for (let seed = 1; seed < 60; seed++) {
    toViking(seed);
    finishPlan({ inspector: 'you', burn: 'long', leak: false });
    playRound(() => 'holddown', { inspector: 'you' }, 'staticPrep');
    until(() => g.beat === 'static');
    standStart();
    until(() => g.beat === 'flight' || g.stand.phase === 'read');
    if (g.beat !== 'flight') continue;
    assert.equal(g.flight.result.failure, 'holddown');
    until(() => g.beat === 'recovery');
    rideOut();
    until(() => g.room === 'recovery');
    returnFromRecovery();
    chair('holddown');
    assert.match(g.record.rounds.at(-1).flight, /^Lost at 55 seconds/);
    assert.ok(g.programme.adopted.includes('holddown'));
    return;
  }
  assert.fail('no seed broke loose');
});

test('the JPL path, every offer declined, runs from 1945 to the Mars flyby', () => {
  newGame(13);
  for (let i = 0; i < SEASON.length; i++) {
    playRound(() => 'unknown');
    if (i + 1 < SEASON.length) advance(false);
  }
  assert.equal(g.beat, 'seasonEnd');
  assert.equal(g.record.rounds.at(-1).id, 'mariner-4');
});
