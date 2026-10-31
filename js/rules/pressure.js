// PRESSURE ON APOLLO: from the day Apollo opens, the press, the public and Congress each push on NASA (GDD review, 31 Oct 2026:
// three pressures, each with its own effect). Soviet firsts, failures, scrubs and a slipping schedule raise them; American firsts
// and clean flights ease them; left alone they settle. Congress trims the budget, the press leaks what NASA would rather keep
// quiet, and the public's interest makes a first count for more or less. Mail shows them as words and headlines, never numbers.
// No DOM.
//
// S.p2.pr: { press, pub, cong: 0 to 100, hl: the latest headlines [{ d: game day, t: text }] }
import { PRESSURES, BASELINE, SETTLE_PER_MONTH, EVENTS, SLIP_PER_MONTH, EFFECT_FROM, CONGRESS_TRIM, LEAK_REPUTATION, PUBLIC_RANGE, HEADLINES } from '../data/pressure.js';
import { S, log } from '../core/state.js';
import { apollo, estimate } from './apollo.js';

export const pressure = () => S.p2 && S.p2.pr || null;
const clamp = value => Math.max(0, Math.min(100, value));
// How far a pressure is into its effect: 0 at EFFECT_FROM or below, 1 at 100.
const effect = value => Math.max(0, (value - EFFECT_FROM) / (100 - EFFECT_FROM));

// Something happened: an EVENTS key. Only once Apollo is open. text: a headline in place of the event's own.
export function notePressure(kind, text = '') {
  const state = pressure(), event = EVENTS[kind];
  if (!state || !event) return;
  for (const key of Object.keys(PRESSURES)) state[key] = clamp(state[key] + event[key]);
  if (text || event.headline) {
    state.hl.push({ d: Math.round(S.day), t: text || event.headline });
    state.hl = state.hl.slice(-HEADLINES);
  }
}

// The words for a pressure's level, and the level's index (0 calm to 3).
export const pressureLevel = key => Math.min(3, Math.floor(pressure()[key] / 25));
export const pressureWords = key => PRESSURES[key].words[pressureLevel(key)];

// THE EFFECTS.
// The share Congress takes off the budget request it grants.
export const congressTrim = () => pressure() ? CONGRESS_TRIM * effect(pressure().cong) : 0;
// Reputation a first wins, scaled by the public's interest (calm to full).
export const publicScale = () => pressure() ? PUBLIC_RANGE[0] + (PUBLIC_RANGE[1] - PUBLIC_RANGE[0]) * pressure().pub / 100 : 1;
// A crewed launch ordered past the safety bar: the press may get hold of it. Returns the reputation lost.
export function pressLeak(what) {
  const state = pressure();
  if (!state) return 0;
  notePressure('overBar');
  const loss = Math.round(LEAK_REPUTATION * effect(state.press));
  if (!loss) return 0;
  S.rep = Math.max(0, S.rep - loss);
  notePressure('overBar', `Leaked: ${what}.`);
  log(`[PRESS] The papers have it: ${what}. Reputation -${loss}.`, 'bad');
  return loss;
}

// The day the study expects the first landing attempt, once the architecture is chosen.
const landingDue = () => {
  const state = apollo(), years = state && state.arch && estimate(state.arch, 'years');
  return years ? state.ad + years.mid * 360 : null;
};
// Each second, with the days that passed: open with Apollo, settle towards calm, and let a late schedule tell on Congress.
// Returns true if anything changed that Mail shows.
export function pressureTick(days) {
  if (!apollo()) return false;
  if (!S.p2.pr) {
    S.p2.pr = { press: BASELINE, pub: BASELINE, cong: BASELINE, hl: [] };
    return true;
  }
  const state = S.p2.pr, before = Object.keys(PRESSURES).map(pressureLevel).join();
  for (const key of Object.keys(PRESSURES)) state[key] += (BASELINE - state[key]) * Math.min(1, SETTLE_PER_MONTH * days / 30);
  const due = landingDue();
  if (due && S.day > due) {
    state.cong = clamp(state.cong + SLIP_PER_MONTH * days / 30);
    state.press = clamp(state.press + SLIP_PER_MONTH / 2 * days / 30);
  }
  return Object.keys(PRESSURES).map(pressureLevel).join() != before;
}
