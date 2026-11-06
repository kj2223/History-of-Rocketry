// The site prototype's hidden truth: rounds are repeatable, the player's actions really remove faults, and the evidence
// (the static-fire trace, the gauges, the wreck) follows the truth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, flagSpots, staticFire, reworkIgniter, leakCheck, hasLeak, hasIgniterFault, hasWeldFault, fly, wreckage, explanationIsRight, tankGauge } from '../js/truth.js';

const findSeed = test => { for (let s = 1; s < 500; s++) if (test(newRound(s))) return s; throw new Error('no seed'); };

test('the same seed makes the same round and the same flight', () => {
  const a = newRound(77), b = newRound(77);
  assert.deepEqual(a.faults, b.faults);
  assert.deepEqual(fly(a), fly(b));
});

test('flagging a real fault removes it; a false alarm costs more time and changes nothing', () => {
  const r = newRound(findSeed(r => hasWeldFault(r)));
  const bad = Object.keys(r.faults).find(k => r.faults[k] === 'weld');
  assert.equal(flagSpots(r, [bad]), 2);
  assert.equal(hasWeldFault(r), false);
  const sound = newRound(findSeed(r => !r.faults.fins));
  const before = { ...sound.faults };
  assert.equal(flagSpots(sound, ['fins']), 3);
  assert.deepEqual(sound.faults, before);
});

test('the ignition fault shows on the stand as a low, rough start, and the rework removes it', () => {
  const r = newRound(findSeed(r => hasIgniterFault(r)));
  assert.ok(staticFire(r).steady < 17);
  reworkIgniter(r);
  assert.equal(hasIgniterFault(r), false);
  assert.ok(staticFire(r).steady > 18);
});

test('a leak bleeds the tank gauge down, and a leak check finds it', () => {
  const r = newRound(findSeed(r => hasLeak(r)));
  assert.ok(tankGauge(r, 400) < 20);
  assert.ok(leakCheck(r).found);
  assert.equal(hasLeak(r), false);
  assert.ok(tankGauge(r, 400) > 22);
});

test('a clean round flies about 70 km and the wreck shows nothing wrong', () => {
  const r = newRound(5);
  r.faults = {}; r.igniter = 'wac-upper/r3';
  const f = fly(r);
  assert.equal(f.failure, null);
  assert.ok(f.apogee > 60 && f.apogee < 80, `apogee ${f.apogee}`);
  assert.match(wreckage(r).join(' '), /even burn/);
  assert.ok(explanationIsRight(r, 'nominal'));
});

test('flown faults bring some rounds down, and the wreck points at the cause', () => {
  let failures = 0;
  for (let s = 1; s < 200; s++) {
    const r = newRound(s), f = fly(r);
    if (!f.failure) continue;
    failures++;
    const words = { ignition: /igniter/, weld: /weld seam/, leak: /feed fitting/ }[f.failure];
    assert.match(wreckage(r).join(' '), words);
  }
  assert.ok(failures > 40 && failures < 160, `${failures} failures`);
});
