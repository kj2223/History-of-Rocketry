// Staff-flown flights: the result is fixed by the game's seed, varies between games, and follows the vehicle's risks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flightOutcome, report, VEHICLE_RISKS, FLOWN_BY_ROUND } from '../js/manage/outcome.js';
import { CAPE_1958 } from '../js/manage/manifest.js';

const e6 = CAPE_1958.flights.find(f => f.id === 'explorer-6');

test('every vehicle on the 1958 manifest has its risks', () => {
  for (const f of CAPE_1958.flights) assert.ok(VEHICLE_RISKS[f.vehicle] || FLOWN_BY_ROUND.has(f.vehicle), f.vehicle);
});

test('Juno and Vanguard are flown by the truth layer, the same way every time', () => {
  for (const vehicle of FLOWN_BY_ROUND) {
    const f = CAPE_1958.flights.find(x => x.vehicle === vehicle);
    assert.deepEqual(flightOutcome(42, f), flightOutcome(42, f));
    const all = Array.from({ length: 120 }, (_, s) => flightOutcome(s, f)),
      results = new Set(all.map(o => o.result));
    assert.ok(results.has('good') && results.has('lost'), vehicle);
    for (const o of all) if (o.result !== 'good') assert.ok(o.text && !o.text.includes('undefined'));
    if (vehicle === 'juno') assert.ok(results.has('short'), 'a Juno can strand its probe short of the Moon');
  }
});

test('the same game gives the same result; different games differ', () => {
  assert.deepEqual(flightOutcome(42, e6), flightOutcome(42, e6));
  const results = new Set(Array.from({ length: 60 }, (_, s) => flightOutcome(s, e6).result));
  assert.ok(results.size >= 2);
});

test('over many games a vehicle fails about as often as its risks say', () => {
  const n = 4000,
    good = Array.from({ length: n }, (_, s) => flightOutcome(s * 7919 + 1, e6)).filter(o => o.result === 'good').length,
    expected = VEHICLE_RISKS['thor-able'].reduce((p, [, r]) => p * (1 - r), 1);
  assert.ok(Math.abs(good / n - expected) < 0.04, `${good / n} vs ${expected}`);
});

test('lowering a cause’s risk to nothing removes it', () => {
  const mods = Object.fromEntries(VEHICLE_RISKS['thor-able'].map(([c]) => [`thor-able:${c}`, 0]));
  for (let s = 0; s < 50; s++) assert.equal(flightOutcome(s, e6, mods).result, 'good');
});

test('a report says what telemetry showed, not the hidden cause name', () => {
  const o = { result: 'lost', cause: 'kick', text: 'the third stage did not fire' };
  assert.equal(report(e6, o), 'Explorer 6: lost. Telemetry shows the third stage did not fire.');
});
