// Management money and people: the fiscal year and its 1976 switch, the first year prorated, moving money between
// lines, and the posts that open with Mercury.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fiscalYear,
  appropriation,
  lines,
  resplit,
  recordFactor,
  NASA_BUDGET,
  CAPE_SHARE,
  DEFAULT_SPLIT,
} from '../js/manage/budget.js';
import { POSTS, CANDIDATES, staffing } from '../js/manage/people.js';
import { gameSchedule } from '../js/manage/schedule.js';
import { CAPE_1958 } from '../js/manage/manifest.js';
import { START_DAY, checkManagement, newManagement } from '../js/manage/state.js';
import { dayOf } from '../js/core/calendar.js';

test('fiscal years run from 1 July until 1976, then a transition quarter, then from 1 October', () => {
  assert.equal(fiscalYear(dayOf(1958, 10, 1)).fy, 1959);
  assert.equal(fiscalYear(dayOf(1959, 6, 30)).fy, 1959);
  assert.equal(fiscalYear(dayOf(1959, 7, 1)).fy, 1960);
  assert.equal(fiscalYear(dayOf(1976, 6, 30)).fy, 1976);
  assert.equal(fiscalYear(dayOf(1976, 8, 15)).fy, 'TQ');
  assert.equal(fiscalYear(dayOf(1976, 10, 1)).fy, 1977);
  assert.equal(fiscalYear(dayOf(1977, 9, 30)).fy, 1977);
  assert.equal(fiscalYear(dayOf(1977, 10, 1)).fy, 1978);
});

test('the first year is prorated: NASA began a quarter into fiscal 1959', () => {
  const a = appropriation(START_DAY, START_DAY);
  const full = NASA_BUDGET[1959] * CAPE_SHARE;
  assert.ok(Math.abs(a.total / full - 273 / 365) < 0.01, `${a.total} of ${full}`);
  assert.equal(appropriation(dayOf(1959, 7, 1), START_DAY).total, NASA_BUDGET[1960] * CAPE_SHARE);
});

test('the record moves the money by at most a tenth', () => {
  assert.equal(recordFactor([]), 1);
  assert.equal(recordFactor([{ result: 'good' }]), 1.1);
  assert.equal(recordFactor([{ result: 'lost' }, { result: 'lost' }]), 0.9);
});

test('moving money keeps the lines at 100 per cent', () => {
  let split = { ...DEFAULT_SPLIT };
  for (const [id, v] of [
    ['programmes', 75],
    ['staff', 5],
    ['building', 100],
    ['programmes', 0],
    ['staff', 33],
  ]) {
    split = resplit(split, id, v);
    assert.equal(
      Object.values(split).reduce((a, b) => a + b, 0),
      100,
    );
    assert.ok(Object.values(split).every(x => x >= 0));
    assert.equal(split[id], v);
  }
  const g = { ...newManagement(1), split };
  checkManagement(g);
});

test('money goes out evenly through the year', () => {
  const b = appropriation(START_DAY, START_DAY),
    half = Math.round((b.end + START_DAY) / 2),
    l = lines(b, DEFAULT_SPLIT, half, START_DAY);
  assert.ok(Math.abs(l[0].spent / l[0].amount - 0.5) < 0.01);
});

test('five posts are open at the start; the flight director and astronaut office open with Big Joe', () => {
  const flights = gameSchedule({ site: 'cape', flown: [] }, CAPE_1958, START_DAY).flights,
    bigJoe = flights.find(f => f.id === 'big-joe');
  assert.equal(staffing({}, START_DAY, flights).filter(p => p.open).length, 5);
  assert.equal(staffing({}, bigJoe.launch, flights).filter(p => p.open).length, 7);
  for (const p of POSTS) assert.equal(CANDIDATES[p.id].length, 3);
  assert.equal(staffing({ launch: 'albers' }, START_DAY, flights)[0].head.name, 'Konrad Albers');
});
