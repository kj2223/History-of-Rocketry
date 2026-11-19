// The management round scheduler: the inherited 1958 manifest flies on its real dates, and a busy pad pushes the
// next flight back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, opening, nextFlight } from '../js/manage/schedule.js';
import { CAPE_1958 } from '../js/manage/manifest.js';
import { START_DAY } from '../js/manage/state.js';
import { dayOf } from '../js/core/calendar.js';

test('the inherited 1958–59 manifest flies on its real dates', () => {
  const s = schedule(CAPE_1958, { from: START_DAY });
  assert.deepEqual(s.unplaced, []);
  assert.equal(s.flights.length, CAPE_1958.flights.length);
  for (const f of s.flights) assert.equal(f.slip, 0, `${f.name} slipped ${f.slip} days`);
  const e6 = s.flights.find(f => f.id === 'explorer-6');
  assert.equal(e6.launch, dayOf(1959, 8, 7));
  assert.equal(e6.start, e6.launch - 2);
  assert.ok(e6.tutorial);
});

test('two flights on one pad too close together: the second waits for the pad', () => {
  const plan = {
    pads: [{ id: 'lc-5', kind: 'redstone' }],
    flights: [
      { id: 'a', vehicle: 'juno', planned: 1000 },
      { id: 'b', vehicle: 'juno', planned: 1005 },
    ],
  };
  const [a, b] = schedule(plan).flights;
  assert.equal(a.launch, 1000);
  assert.equal(b.launch, 1000 + 10 + 21); // cleared after the first, then three weeks of stacking and checkout
  assert.equal(b.slip, 26);
});

test('a second pad of the right kind takes the flight instead of waiting', () => {
  const plan = {
    pads: [
      { id: 'lc-5', kind: 'redstone' },
      { id: 'lc-6', kind: 'redstone' },
    ],
    flights: [
      { id: 'a', vehicle: 'juno', planned: 1000 },
      { id: 'b', vehicle: 'juno', planned: 1005 },
    ],
  };
  const [a, b] = schedule(plan).flights;
  assert.notEqual(a.pad, b.pad);
  assert.equal(b.launch, 1005);
});

test('a flight with no pad for its vehicle is left unplaced, with the reason', () => {
  const s = schedule({
    pads: [{ id: 'lc-5', kind: 'redstone' }],
    flights: [{ id: 'x', vehicle: 'atlas', planned: 1 }],
  });
  assert.equal(s.flights.length, 0);
  assert.match(s.unplaced[0].why, /no pad for a atlas/);
});

test('a late vehicle and the start of the game both hold a flight back', () => {
  const pads = [{ id: 'lc-5', kind: 'redstone' }];
  assert.equal(
    schedule({ pads, flights: [{ id: 'a', vehicle: 'juno', planned: 100, ready: 200 }] }).flights[0].launch,
    221,
  );
  assert.equal(
    schedule({ pads, flights: [{ id: 'a', vehicle: 'juno', planned: 100 }] }, { from: 150 }).flights[0].launch,
    150,
  );
});

test('the scheduler finds the rounds opening on a day and the next one to come', () => {
  const s = schedule(CAPE_1958, { from: START_DAY });
  assert.equal(nextFlight(s, START_DAY).id, 'pioneer-1');
  assert.deepEqual(
    opening(s, dayOf(1958, 12, 4)).map(f => f.id),
    ['pioneer-3'],
  );
  assert.equal(nextFlight(s, dayOf(1960, 1, 1)), null);
});
