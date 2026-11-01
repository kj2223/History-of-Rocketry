// THE SOVIET MOON RACE (data/history.js, RIVAL_MOON): attempts that are rolled, not dates that simply arrive. A success is news
// and can take a first; a failure is news too, and the attempt waits for its next try; after its last try, that part of the
// Soviet programme is abandoned, which intelligence learns only later. Intelligence gives one estimate per goal (a crew around the
// Moon, a crew on the Moon, samples home), wrong by an error rolled once per goal, so you can act on a threat that is not real or
// miss one that is. No DOM.
//
// S.rm: { [attempt id]: { day: the next try (game day), n: tries made, st: 'wait'|'done'|'gone', at: the day it worked or was
//          abandoned } }, plus S.rmi: { [goal]: the intelligence error, -1 to 1 }. Both are set when Section 2 opens.
// A success also sets S.rv[id] and S.rvd[id], as the fixed Soviet events do, so the firsts and the summaries read it the same way.
import { RIVAL, RIVAL_MOON, FIRSTS, MOON_GOALS, INTEL_ERROR, INTEL_WIDTH, INTEL_LAG } from '../data/history.js';
import { S, log, addHistory, formatDate } from '../core/state.js';
import { notePressure } from './pressure.js';

// THE HOOKS the adaptive layer (Apollo step 5) replaces: the chance a try works, and the days to the next try (first or retry).
// Each gets the attempt and the base figure, and returns the figure to use.
export const sovietAdapt = { chance: (attempt, base) => base, delay: (attempt, days) => days };

const byId = id => RIVAL_MOON.find(attempt => attempt.id == id);
const worked = id => S.rm && S.rm[id] && S.rm[id].st == 'done';

// Section 2 opens (or an older save is past it): the attempts get their first dates, shifted by how early or late Vostok 1 flew.
export function openMoonRace() {
  if (S.rm) return;
  const lateness = (S.rv.r_gagarin || 0) - RIVAL.find(event => event.id == 'r_gagarin').day;
  S.rm = Object.fromEntries(RIVAL_MOON.map(attempt => [attempt.id, { day: attempt.day + lateness, n: 0, st: 'wait', at: 0 }]));
  S.rmi = Object.fromEntries(Object.keys(MOON_GOALS).map(goal => [goal, Math.random() * 2 - 1]));
}

// Each second after Section 2 opens. Returns true if anything happened.
export function moonRaceTick() {
  if (!S.rm) {
    if (!(S.p2 && S.p2.secDone)) return false;
    openMoonRace();
  }
  let changed = false;
  for (const attempt of RIVAL_MOON) {
    const state = S.rm[attempt.id];
    if (state.st != 'wait' || S.day < state.day) continue;
    const needs = attempt.needs || [];
    if (needs.some(id => S.rm[id].st == 'gone')) {
      Object.assign(state, { st: 'gone', at: Math.round(S.day) });
      continue;
    }
    if (!needs.every(worked)) continue;
    const ready = Math.max(0, ...needs.map(id => S.rm[id].at + (attempt.after || 0)));
    if (S.day < ready) {
      state.day = ready;
      continue;
    }
    changed = true;
    state.n++;
    if (Math.random() < sovietAdapt.chance(attempt, attempt.chance)) succeed(attempt, state);
    else fail(attempt, state);
  }
  return changed;
}

function succeed(attempt, state) {
  Object.assign(state, { st: 'done', at: Math.round(S.day) });
  S.rv[attempt.id] = Math.round(S.day);
  S.rvd[attempt.id] = 1;
  const first = FIRSTS.find(candidate => candidate.rivalEvent == attempt.id);
  if (first && S.fs[first.id]) {
    log(`[WIRE] ${attempt.wire} The United States got there first.`, 'wn');
    return;
  }
  if (first) {
    S.fs[first.id] = 'them';
    notePressure('sovietFirst', attempt.wire);
    S.rep = Math.max(0, S.rep - (attempt.id == 'm_l3' ? 10 : 3));
  }
  addHistory(`Soviet: ${attempt.short}`);
  log(`[WIRE] ${attempt.wire}`, first ? 'bad' : 'nar');
}

function fail(attempt, state) {
  log(`[WIRE] ${attempt.fail.replace('{n}', state.n)}`, attempt.lost ? 'nar' : 'd');
  if (attempt.lost) addHistory(`Soviet: ${attempt.short} attempt ends in tragedy`);
  if (state.n >= attempt.tries) {
    Object.assign(state, { st: 'gone', at: Math.round(S.day) });
    if (attempt.gone) log(`[WIRE] ${attempt.gone}`, 'd');
    return;
  }
  state.day = Math.round(S.day + sovietAdapt.delay(attempt, attempt.retry));
}

// INTELLIGENCE. For each goal not yet reached by either side: { goal, what, lo, hi, est } as game days, or null if intelligence
// has nothing to go on. It believes the next try of the goal's furthest-along chain will come and work, counting the waits ahead of
// it; it keeps believing in an abandoned attempt for INTEL_LAG days.
export function moonIntel() {
  if (!S.rm) return [];
  return Object.keys(MOON_GOALS).flatMap(goal => {
    const chain = RIVAL_MOON.filter(attempt => attempt.goal == goal);
    if (chain.some(attempt => S.rm[attempt.id].st == 'done' && !RIVAL_MOON.some(later => (later.needs || []).includes(attempt.id) && later.goal == goal))) return [];
    const last = chain[chain.length - 1], firstId = FIRSTS.find(first => first.rivalEvent == last.id);
    if (firstId && S.fs[firstId.id] == 'us') return [];
    const believed = chain.filter(attempt => S.rm[attempt.id].st == 'wait' || (S.rm[attempt.id].st == 'gone' && S.day - S.rm[attempt.id].at < INTEL_LAG));
    if (!believed.length) return [];
    // The truth as intelligence reckons it: the next believed try, plus the waits of the attempts still to come after it.
    const next = believed[0], after = believed.slice(1).reduce((sum, attempt) => sum + (attempt.after || 0), 0);
    const truth = Math.max(S.day, S.rm[next.id].day) + after, toGo = Math.max(30, truth - S.day);
    const est = Math.round(truth + S.rmi[goal] * INTEL_ERROR * toGo), width = Math.max(30, Math.round(INTEL_WIDTH * toGo));
    return [{ goal, what: MOON_GOALS[goal], est, lo: Math.max(Math.round(S.day), est - width), hi: est + width }];
  });
}
export const moonIntelText = estimate => `${estimate.what}: between ${formatDate(estimate.lo)} and ${formatDate(estimate.hi)}`;
