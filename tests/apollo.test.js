// Apollo 16 and 17, the last two landings: the Descartes throttle flutter and the early ascent, the Taurus-Littrow
// orange soil, and the site-specific notes the rover's traverse leaves on the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound } from '../js/truth/round.js';
import { flightTruth, resolve } from '../js/truth/flights.js';
import { initProgramme } from '../js/world/programme.js';
import { FLIGHTS } from '../js/data/flights.js';

const round = (id, s, withFaults = {}) => {
  const r = newRound(s, initProgramme(), 'saturn5');
  r.faults = withFaults;
  flightTruth(r, id);
  return r;
};

test('the throttle flutter is the hidden layer\u2019s on Apollo 16: some rounds have it, some do not', () => {
  const seen = new Set();
  for (let s = 1; s <= 40; s++) {
    const r = newRound(s, { ...initProgramme(), throttleRisk: 0.75 }, 'saturn5');
    flightTruth(r, 'apollo-16');
    seen.add(!!r.flightTruth.flags.throttle);
  }
  assert.deepEqual([...seen], [true, false].sort(), [...seen].join());
});

test('pressing through the flutter lands on time; the abort branch goes round once and lands late', () => {
  const r = round('apollo-16', 5);
  r.throttle = true;
  const on = resolve(r, 'throttle', 'descend', {});
  assert.equal(on.verdict, 'good');
  assert.ok(!on.set.linspect);
  const off = resolve(r, 'throttle', 'abort', {});
  assert.equal(off.set.linspect, true);
  assert.equal(off.verdict, 'fair');
});

test('the early ascent is the call that buys the margin back; holding costs surface time', () => {
  const r = round('apollo-16', 5);
  const early = resolve(r, 'ascentEarly', 'early', {});
  assert.equal(early.verdict, 'good');
  assert.ok(early.set.ascentNow);
  const hold = resolve(r, 'ascentEarly', 'hold', {});
  assert.equal(hold.verdict, 'fair');
});

test('the rover\u2019s record notes the ground it actually covered: Stone Mountain at Descartes, orange soil at Shorty', () => {
  const r16 = round('apollo-16', 5);
  const stay16 = resolve(r16, 'traverse', 'stay', {});
  assert.match(stay16.note, /Stone Mountain/);
  assert.match(stay16.lines.at(-1)[1], /House Rock/);
  const r17 = round('apollo-17', 5);
  const stay17 = resolve(r17, 'traverse', 'stay', {});
  assert.match(stay17.note, /orange soil/);
  assert.match(stay17.note, /Shorty/);
  // Apollo 15 keeps its own ground.
  const r15 = round('apollo-15', 5);
  assert.match(resolve(r15, 'traverse', 'stay', {}).note, /Apennine Front/);
});

test('Apollo 17 hears about the second stage\u2019s centre engine only when the roll landed', () => {
  const withJ2 = round('apollo-17', 5, { 's2-engines': 'j2' });
  assert.ok(withJ2.flightTruth.flags.j2);
  const plan = FLIGHTS['apollo-17'];
  assert.ok(plan.steps.some(st => st.if === 'j2' && /centre engine/.test(st.say[0][1])));
  const clean = round('apollo-17', 5);
  assert.ok(!clean.flightTruth.flags.j2);
});
