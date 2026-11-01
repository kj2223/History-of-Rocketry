// CONGRESSIONAL HEARINGS: one mechanism for every hearing (shared with the balance work). openHearing schedules one about two weeks
// out; the lead who prepares is off their usual work until it sits (game.js skips their ticks). When it sits, the kind's
// outcome reads NASA's record into plain effects, which are applied here and the verdict logged. No randomness, no DOM.
//
// S.p2.hg: the hearing pending, { k: HEARINGS key, d: day it sits, lead } or null.
import { HEARINGS, HEARING_DAYS } from '../data/hearing.js';
import { PRESSURES } from '../data/pressure.js';
import { S, log, formatDate } from '../core/state.js';
import { pressure } from './pressure.js';
import { memberName } from './team.js';

export const hearingOpen = () => S.p2 && S.p2.hg || null;
// Is this lead preparing for a hearing?
export const leadAway = lead => !!hearingOpen() && hearingOpen().lead == lead;

// Schedule a hearing. Returns an error text, or null.
export function openHearing(kind, days = HEARING_DAYS, lead = HEARINGS[kind] && HEARINGS[kind].lead) {
  if (!S.p2 || !HEARINGS[kind]) return 'No such hearing.';
  if (hearingOpen()) return `A hearing already sits on ${formatDate(hearingOpen().d)}.`;
  S.p2.hg = { k: kind, d: Math.round(S.day + days), lead };
  log(`[CONGRESS] ${HEARINGS[kind].name} sits on ${formatDate(S.p2.hg.d)}.${lead ? ` ${memberName(lead)} prepares and is off other work until then.` : ''}`, 'hd');
  return null;
}

// What the committee reads.
export function hearingRecord() {
  const bar = S.p2.sb, sum = table => Object.values(table || {}).reduce((total, count) => total + count, 0);
  const signed = bar ? sum(bar.t) : 0, skipped = bar ? sum(bar.f) : 0;
  return { accepted: (S.p2.acc || []).length, tests: signed - skipped, skipped };
}

// Each second: a hearing whose day has come sits. Returns true if one did.
export function hearingTick() {
  const hearing = hearingOpen();
  if (!hearing || S.day < hearing.d) return false;
  const kind = HEARINGS[hearing.k], effects = kind.outcome(hearingRecord());
  if (effects.rep) S.rep = Math.max(0, S.rep + effects.rep);
  const state = pressure();
  if (state) for (const key of Object.keys(PRESSURES)) state[key] = Math.max(0, Math.min(100, state[key] + (effects[key] || 0)));
  if (kind.apply) kind.apply(effects);
  S.p2.hg = null;
  log(`[CONGRESS] ${effects.verdict}${effects.rep ? ` Reputation ${effects.rep > 0 ? '+' : ''}${effects.rep}.` : ''}`, effects.rep < 0 ? 'bad' : 'cyan');
  return true;
}
