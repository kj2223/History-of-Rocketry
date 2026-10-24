// THE RACE: historical firsts, the Soviet timeline, intelligence estimates, and NASA. No DOM.
import { formatMoney } from '../core/util.js';
import { FIRSTS, RIVAL, RIVAL_SECTION_TWO, NASA_DAY } from '../data/history.js';
import { S, log, formatDate, addHistory } from '../core/state.js';

// SOVIET EVENTS land on their (jittered) dates. A first they reach before you is lost: matching it later pays 40% and less reputation.
// Section 2 events count only once their dates are set (openSovietSectionTwo). Returns true if anything happened.
export function sovietEventsTick() {
  let changed = false;
  for (const event of [...RIVAL, ...RIVAL_SECTION_TWO]) {
    if (S.rvd[event.id] || !(event.id in S.rv) || S.day < S.rv[event.id]) continue;
    S.rvd[event.id] = 1;
    changed = true;
    const first = FIRSTS.find(candidate => candidate.rivalEvent == event.id);
    if (first && S.fs[first.id]) {
      log(`[WIRE] ${event.wire} The United States got there first.`, 'wn');
      continue;
    }
    if (first) S.fs[first.id] = 'them';
    addHistory(`Soviet: ${event.wire.split('.')[0]}`);
    log(`[WIRE] ${event.wire}`, 'bad');
    if (event.id == 'r_sat') {
      S.rep = Math.max(0, S.rep - 8);
      log('[PRESS] Panic in Washington. Congress opens the purse: appropriations +30% until America answers.', 'nar');
    } else if (event.id == 'r_gagarin') {
      S.rep = Math.max(0, S.rep - 6);
      log('[PRESS] The world hails the first human in space. Washington demands an answer.', 'nar');
    } else if (event.id == 'r_icbm') {
      S.rep = Math.max(0, S.rep - 3);
      log('[PRESS] The missile gap dominates the news. Appropriations +10% from now on.', 'nar');
    } else if (first) {
      S.rep = Math.max(0, S.rep - 3);
      log(`[PRESS] Another Soviet first. Matching it now will earn less.`, 'nar');
    }
  }
  return changed;
}

// Section 2 opens: the Soviet dates for it are set, running as early or as late as Vostok 1 did in this game (no new random draws).
export function openSovietSectionTwo() {
  const lateness = (S.rv.r_gagarin || 0) - RIVAL.find(event => event.id == 'r_gagarin').day;
  for (const event of RIVAL_SECTION_TWO) if (!(event.id in S.rv)) S.rv[event.id] = event.day + lateness;
}

// AMERICAN FIRSTS: check a flight's outcome against every first not yet claimed.
// outcome: { ok, why, peak, spd, dr, pay, rec, got, staged, human } (see FIRSTS in data/history.js).
const MATCHED_CASH_SHARE = .4;
export function checkFirsts(outcome) {
  for (const first of FIRSTS) {
    if (S.fs[first.id] == 'us' || S.fs[first.id] == 'second' || !first.test(outcome)) continue;
    const lost = S.fs[first.id] == 'them', share = lost ? MATCHED_CASH_SHARE : 1;
    S.fs[first.id] = lost ? 'second' : 'us';
    S.fsd[first.id] = S.day;
    const shortName = first.name.replace(/^First /, '');
    addHistory(lost ? `Matched the Soviets: ${shortName}` : `First: ${shortName}`);
    if (first.cash) S.b += Math.round(first.cash * share);
    S.rep = Math.min(100, S.rep + (lost ? Math.ceil(first.reputation / 3) : first.reputation));
    log(lost
      ? `[PRESS] America answers the Soviets: ${shortName.toLowerCase()}.${first.cash ? ` Bonus +${formatMoney(first.cash * share)}.` : ''}`
      : `[HISTORIC FIRST] ${first.name}!${first.cash ? ` Bonus +${formatMoney(first.cash)}, reputation +${first.reputation}.` : ''}`, 'hd');
  }
}

// What intelligence says about the next Soviet event: a date window (8% of the date either side) that is honest about its uncertainty.
export function intelligenceEstimate() {
  const next = [...RIVAL, ...RIVAL_SECTION_TWO].find(event => !S.rvd[event.id] && event.id in S.rv);
  if (!next) return null;
  const day = S.rv[next.id], width = Math.round(day * .08);
  return { what: next.short, lo: formatDate(Math.max(S.day, day - width)), hi: formatDate(day + width) };
}
// Intelligence estimate of Soviet progress toward the phase's goal (a satellite, then a cosmonaut), as a range of +/- 8%.
export function sovietProgress() {
  const goal = S.nasa ? 'r_gagarin' : 'r_sat';
  if (S.rvd[goal]) return { lo: 1, hi: 1, done: true };
  const progress = S.nasa ? (S.day - S.nasa) / (S.rv[goal] - S.nasa) : S.day / S.rv[goal];
  return { lo: Math.min(1, progress / 1.08), hi: Math.min(1, progress / .92), done: false };
}

// NASA: offered once you reach orbit, or from October 1958 whatever your progress. Establishing it closes Phase One.
// With a satellite up, Congress can pass the Act from about December 1957; without one, Washington acts in October 1958 regardless.
export const SPACE_ACT_DAY = NASA_DAY - 300;
export const nasaReady = () => !S.nasa && (((S.fs.f_orbit == 'us' || S.fs.f_orbit == 'second') && S.day >= SPACE_ACT_DAY) || S.day >= NASA_DAY);
export function formNasa() {
  if (!nasaReady()) return;
  S.nasa = S.day;
  addHistory('NASA established');
  log('[WASHINGTON] The National Aeronautics and Space Act is signed. Your programme becomes the core of NASA.', 'hd');
}
