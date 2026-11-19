// MANAGEMENT MODE: the money. One budget a year from Congress (Aaron's answer 3A), sized from NASA's real
// appropriations scaled to the Cape's share (answer 7A). You split it between programmes, building and staff, and can
// move money between them at any time. Rules for later (overspending slips dates, capped; probe windows) are in the
// project's management/BUDGET-RULES.md.
import { dayOf } from '../core/calendar.js';
import { combined } from './pressure.js';

// NASA's appropriations by fiscal year, millions of dollars of the day (NASA historical data books, rounded). Years past
// the table carry the last figure until it is extended.
export const NASA_BUDGET = {
  1959: 331,
  1960: 524,
  1961: 964,
  1962: 1825,
  1963: 3674,
  1964: 5100,
  1965: 5250,
  1966: 5175,
  1967: 4968,
  1968: 4589,
  1969: 3995,
  1970: 3749,
};
// The part of NASA's money that goes through the launch centre. An assumed round figure, to be tuned in play.
export const CAPE_SHARE = 0.12;
export const LINES = { programmes: 'Programmes', building: 'Building', staff: 'Staff' };
export const DEFAULT_SPLIT = { programmes: 60, building: 20, staff: 20 };

// The fiscal year containing a day. Until FY1976 it ran 1 July to 30 June, named for the year it ends in; then came
// the transition quarter (1 July to 30 September 1976); from FY1977 it runs 1 October to 30 September.
export function fiscalYear(day) {
  const tqStart = dayOf(1976, 7, 1),
    tqEnd = dayOf(1976, 9, 30);
  if (day >= tqStart && day <= tqEnd) return { fy: 'TQ', start: tqStart, end: tqEnd };
  const d = new Date(Date.UTC(1945, 0, 1) + day * 86400000),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth() + 1;
  if (day < tqStart) {
    const fy = m >= 7 ? y + 1 : y;
    return { fy, start: dayOf(fy - 1, 7, 1), end: dayOf(fy, 6, 30) };
  }
  const fy = m >= 10 ? y + 1 : y;
  return { fy, start: dayOf(fy - 1, 10, 1), end: dayOf(fy, 9, 30) };
}

const lastYear = () => Math.max(...Object.keys(NASA_BUDGET).map(Number));
const nasaFor = fy => NASA_BUDGET[Math.min(fy === 'TQ' ? 1976 : fy, lastYear())];

// How Congress treats the centre: your record moves the money, at most a tenth either way. (Your request and the race
// join this when they are built.)
export function recordFactor(flown = []) {
  if (!flown.length) return 1;
  const score = flown.reduce((s, f) => s + (f.result === 'good' ? 1 : f.result === 'lost' ? -1 : 0), 0) / flown.length;
  return 1 + 0.1 * score;
}

// The centre's money for the fiscal year containing `day`: the year's figure, the part of the year left when the game
// began (the first year is prorated), moved by the record and the centre's standing with Congress and the press
// (pressure.js), together at most a tenth either way. Millions of dollars.
export function appropriation(day, startDay, flown = [], standing = 0) {
  const year = fiscalYear(day),
    days = year.end - year.start + 1,
    quarter = year.fy === 'TQ' ? 0.25 : 1, // a quarter's money for the transition quarter
    left = Math.min(1, (year.end - Math.max(year.start, startDay) + 1) / days);
  return {
    fy: year.fy,
    total: nasaFor(year.fy) * quarter * CAPE_SHARE * left * combined(recordFactor(flown), standing),
    start: year.start,
    end: year.end,
  };
}

// Each line's money and how much of it is spent by `day` (money goes out evenly through the year).
export function lines(budget, split, day, startDay) {
  const from = Math.max(budget.start, startDay),
    gone = Math.min(1, Math.max(0, (day - from) / (budget.end - from + 1)));
  return Object.keys(LINES).map(id => {
    const amount = (budget.total * split[id]) / 100;
    return { id, name: LINES[id], share: split[id], amount, spent: amount * gone };
  });
}

// Moving money between lines: set one line's share, and the other two take up the difference in proportion.
export function resplit(split, id, share) {
  const set = Math.max(0, Math.min(100, Math.round(share))),
    others = Object.keys(split).filter(k => k !== id),
    before = others.reduce((s, k) => s + split[k], 0),
    out = { ...split, [id]: set };
  let left = 100 - set;
  others.forEach((k, i) => {
    if (i === others.length - 1) out[k] = left;
    else {
      out[k] = Math.round(before ? ((100 - set) * split[k]) / before : (100 - set) / others.length);
      left -= out[k];
    }
  });
  return out;
}

export const money = m => (m >= 100 ? `$${Math.round(m)} million` : `$${m.toFixed(1)} million`);
