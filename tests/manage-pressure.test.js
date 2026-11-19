// Management mode, pressure and promises: a public date kept earns standing, slipped or lost costs it, and Moscow's
// firsts make every promise count double for half a year. Standing moves next year's money, capped with the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { announce, settle, news, watched, combined, SOVIET_FIRSTS, SWING_LIMIT } from '../js/manage/pressure.js';
import { appropriation } from '../js/manage/budget.js';
import { checkManagement, newManagement, START_DAY } from '../js/manage/state.js';
import { dayOf } from '../js/core/calendar.js';

const flight = (launch, id = 'pioneer-4') => ({ id, name: 'Pioneer 4', launch });

test('a kept promise earns standing; a lost one costs more than an unannounced loss', () => {
  const g = newManagement(1);
  const f = flight(dayOf(1959, 8, 7)); // outside the months after a Soviet first
  assert.match(announce(g, f), /announces Pioneer 4/);
  assert.equal(announce(g, f), null, 'once');
  settle(g, f, 'good');
  assert.equal(g.pressure.standing, 1);
  const h = newManagement(1);
  announce(h, f);
  settle(h, f, 'lost');
  const k = newManagement(1);
  settle(k, f, 'lost');
  assert.ok(h.pressure.standing < k.pressure.standing);
});

test('a slipped promise costs by the week', () => {
  const g = newManagement(1);
  announce(g, flight(dayOf(1959, 8, 7)));
  const line = settle(g, flight(dayOf(1959, 8, 24)), 'good');
  assert.match(line, /17 days after/);
  assert.ok(g.pressure.standing < 0);
});

test("Moscow's firsts are news once, and promises count double while the country watches", () => {
  const g = newManagement(1);
  g.day = dayOf(1959, 1, 3);
  assert.equal(news(g).length, 1);
  assert.equal(news(g).length, 0);
  assert.ok(watched(dayOf(1959, 2, 1)));
  const f = flight(dayOf(1959, 3, 3));
  announce(g, f);
  settle(g, f, 'good');
  assert.equal(g.pressure.standing, 2);
  assert.equal(SOVIET_FIRSTS.length >= 5, true);
});

test('standing moves the money, capped together with the record', () => {
  const day = dayOf(1960, 7, 2);
  const base = appropriation(day, START_DAY, [], 0).total;
  assert.ok(appropriation(day, START_DAY, [], 5).total > base);
  assert.ok(appropriation(day, START_DAY, [], -5).total < base);
  assert.equal(combined(1.1, 5), 1 + SWING_LIMIT);
  assert.equal(combined(0.9, -5), 1 - SWING_LIMIT);
});

test('saves with and without promises load', () => {
  const g = newManagement(1);
  checkManagement(g);
  announce(g, flight(dayOf(1959, 3, 3)));
  checkManagement(JSON.parse(JSON.stringify(g)));
  assert.throws(() => checkManagement({ ...g, pressure: { standing: 'x' } }));
});
