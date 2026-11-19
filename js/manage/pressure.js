// MANAGEMENT MODE: PRESSURE AND PROMISES. Every real loss had a schedule behind it. Here the centre can announce a
// flight's date in public; Congress and the press then hold it to that day. A promise kept on the day earns standing; a
// promise slipped or a flight lost in public costs it. Flights nobody announced count for little either way. When Moscow
// scores a first, the country is watching: for half a year every public promise counts double. Standing moves the
// centre's money at the next fiscal year, next to its flight record (budget.js), at most a tenth either way.
import { dayOf, dateLabel } from '../core/calendar.js';

// The Soviet firsts the country heard about in the management years, with the day the news broke.
export const SOVIET_FIRSTS = [
  { day: dayOf(1959, 1, 2), text: 'Moscow announces Luna 1 is past the Moon and into orbit round the Sun.' },
  { day: dayOf(1959, 9, 14), text: 'Moscow announces Luna 2 has hit the Moon.' },
  { day: dayOf(1959, 10, 7), text: 'Luna 3 photographs the far side of the Moon. The pictures are in every paper.' },
  {
    day: dayOf(1960, 8, 19),
    text: 'Two dogs, Belka and Strelka, orbit the Earth in Korabl-Sputnik 2 and come home alive.',
  },
  { day: dayOf(1961, 4, 12), text: 'Yuri Gagarin orbits the Earth in Vostok 1. The first man in space is Soviet.' },
  { day: dayOf(1961, 8, 6), text: 'Gherman Titov spends a whole day in orbit in Vostok 2.' },
];
export const WATCHED_DAYS = 180; // how long the country watches after a Soviet first
export const STANDING_LIMIT = 5;
export const FACTOR_PER_STANDING = 0.02; // each point of standing moves next year's money by 2 percent
export const SWING_LIMIT = 0.1; // record and standing together move the money at most a tenth either way

export const initPressure = () => ({ standing: 0, announced: {}, news: 0 });
const pressureOf = game => (game.pressure ??= initPressure());
const clamp = s => Math.max(-STANDING_LIMIT, Math.min(STANDING_LIMIT, s));

// Is the country watching on this day (within half a year of a Soviet first)?
export const watched = day => SOVIET_FIRSTS.some(s => day >= s.day && day < s.day + WATCHED_DAYS);

// Announce a flight's date in public: the day it is scheduled to fly now. Returns the line for the log, or null.
export function announce(game, flight) {
  const p = pressureOf(game);
  if (p.announced[flight.id] != null || flight.launch <= game.day) return null;
  p.announced[flight.id] = flight.launch;
  return `The centre announces ${flight.name} for ${dateLabel(flight.launch)}. The papers have the date now.`;
}

// A flight has flown: what it does to the centre's standing. result: 'good', 'short' or 'lost'. Returns a line or null.
export function settle(game, flight, result) {
  const p = pressureOf(game),
    promised = p.announced[flight.id],
    double = watched(flight.launch) ? 2 : 1;
  let change = 0,
    line = null;
  if (promised == null) {
    change = result === 'good' ? 0.25 : result === 'lost' ? -0.5 : 0;
  } else {
    const late = flight.launch - promised;
    if (result === 'lost') {
      change = -2 * double;
      line = `${flight.name} was lost in public, on a date the centre announced. Congress will ask about it.`;
    } else if (late <= 0) {
      change = (result === 'good' ? 1 : 0.25) * double;
      line = `${flight.name} flew on the day the centre promised.${double > 1 ? ' With Moscow in the news, Washington noticed.' : ''}`;
    } else {
      change = -Math.min(2, 0.5 * Math.ceil(late / 7)) * double + (result === 'good' ? 0.25 : 0);
      line = `${flight.name} flew ${late} day${late === 1 ? '' : 's'} after the date the centre announced. The papers counted every one.`;
    }
  }
  p.standing = clamp(p.standing + change);
  return line;
}

// The Soviet news up to this day that the base has not heard yet. Returns the lines.
export function news(game) {
  const p = pressureOf(game),
    out = [];
  while (p.news < SOVIET_FIRSTS.length && SOVIET_FIRSTS[p.news].day <= game.day) {
    out.push(`${SOVIET_FIRSTS[p.news].text} For six months every date the centre announces will be watched.`);
    p.news++;
  }
  return out;
}

// The centre's standing as a money factor, combined with the flight record's factor and capped.
export const standingFactor = standing => 1 + FACTOR_PER_STANDING * clamp(standing ?? 0);
export const combined = (recordFactor, standing) =>
  Math.max(1 - SWING_LIMIT, Math.min(1 + SWING_LIMIT, recordFactor * standingFactor(standing)));

// Standing in words, for the budget panel.
export function standingText(standing = 0) {
  if (standing >= 3) return 'Congress and the press trust the centre’s dates.';
  if (standing >= 1) return 'The centre is keeping its word, and Washington has noticed.';
  if (standing > -1) return 'Washington is waiting to see what the centre can do.';
  if (standing > -3) return 'The papers have stopped believing the centre’s dates.';
  return 'Congress is asking whether the centre can be trusted with the money.';
}

// Is this saved pressure readable?
export function checkPressure(p) {
  if (p === undefined) return;
  if (!p || typeof p !== 'object' || typeof p.standing !== 'number' || typeof p.announced !== 'object')
    throw new Error('bad pressure');
}
