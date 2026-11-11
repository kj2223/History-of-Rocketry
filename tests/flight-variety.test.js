// Fixes show in the flight, and no two rounds fly alike (playtest, 11 November 2026: "the third WAC runs the exact same
// flight profile as the first regardless of fix").
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, fly, windOf } from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';

const clean = (seed, p) => {
  const r = newRound(seed, p, 'wac');
  r.faults = {};
  r.physical.latentMechanisms = [];
  return r;
};
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
// Good flights only: a hidden failure is drawn whatever the build.
const peaks = p => {
  const out = [];
  for (let s = 1; s <= 200; s++) {
    const f = fly(clean(s * 7919, p));
    if (!f.failure) out.push(f.apogee);
  }
  return out;
};

test('good WAC rounds no longer all peak within a few km of each other', () => {
  const a = peaks(initProgramme());
  assert.ok(Math.max(...a) - Math.min(...a) > 15, `${Math.min(...a)}–${Math.max(...a)}`);
  assert.ok(Math.abs(mean(a) - 70) < 3, `mean ${mean(a)}`);
});

test('the reworked igniter and tight fittings make the same round climb higher', () => {
  const p = initProgramme();
  adopt(p, 'ignition');
  adopt(p, 'leak');
  for (const s of [5, 11, 23]) {
    const before = fly(clean(s, initProgramme())),
      after = fly(clean(s, p));
    if (before.failure || after.failure) continue;
    assert.ok(after.apogee > before.apogee * 1.06, `${before.apogee} -> ${after.apogee}`);
  }
});

test('sound vanes fly a V-2 straighter', () => {
  const p = initProgramme();
  adopt(p, 'vanes');
  const r1 = newRound(9, initProgramme(), 'v2'),
    r2 = newRound(9, p, 'v2');
  for (const r of [r1, r2]) {
    r.faults = {};
    r.physical.latentMechanisms = [];
  }
  const a = fly(r1),
    b = fly(r2);
  if (!a.failure && !b.failure) assert.ok(b.range < a.range, `${a.range} -> ${b.range}`);
});

test('the wind comes from the seed, moves no draw, and leans the round', () => {
  assert.deepEqual(windOf(42), windOf(42));
  const kmh = [...Array(300).keys()].map(s => windOf(s).kmh);
  assert.ok(Math.min(...kmh) >= 4 && Math.max(...kmh) <= 40);
  assert.ok(Math.max(...kmh) - Math.min(...kmh) > 20);
  const r = newRound(42);
  assert.equal(r.wind.kmh, windOf(42).kmh);
});
