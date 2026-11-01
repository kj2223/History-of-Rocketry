// THE SOVIET MOON PROGRAMME ADAPTS (Apollo step 5, Aaron's direction of 30 Oct 2026): it reads the race from the firsts of the
// crewed era. Behind, it pushes: attempts come sooner and are riskier, so they fail more often, crews included. Far ahead, it
// coasts and its attempts slip. Nothing is scripted: the race itself is rolled (rules/moon-race.js), and this layer only moves
// the odds and the dates, through the hooks moon-race.js leaves for it. No DOM.
//
// S.rma: { p: the posture ('push', 'steady' or 'coast'), sh: { [attempt id]: days its first try has moved, minus is sooner } }
import { FIRSTS } from '../data/history.js';
import { RACE_FIRSTS, FULL_STANDING_AFTER, PUSH_FROM, COAST_FROM, PUSH_RISK, PUSH_HASTE, PULL_PER_MONTH, MAX_SHIFT, COAST_DELAY, POSTURE_WIRES } from '../data/rival-adapt.js';
import { S, log } from '../core/state.js';
import { sovietAdapt } from './moon-race.js';

// From -1 (the crewed-era firsts all went to the United States) to +1 (all Soviet), weaker until enough are decided.
export function sovietStanding() {
  const decided = RACE_FIRSTS.map(id => S.fs[id]).filter(owner => owner == 'us' || owner == 'them');
  const score = decided.reduce((sum, owner) => sum + (owner == 'them' ? 1 : -1), 0);
  return score / Math.max(FULL_STANDING_AFTER, decided.length);
}
export const sovietPosture = (standing = sovietStanding()) => standing < PUSH_FROM ? 'push' : standing > COAST_FROM ? 'coast' : 'steady';
// How hard: 0 to 1 within the posture.
const strength = standing => standing < PUSH_FROM ? Math.min(1, (PUSH_FROM - standing) / (1 + PUSH_FROM)) : standing > COAST_FROM ? Math.min(1, (standing - COAST_FROM) / (1 - COAST_FROM)) : 0;

// THE HOOKS (rules/moon-race.js).
sovietAdapt.chance = (attempt, base) => {
  const standing = sovietStanding();
  return sovietPosture(standing) == 'push' ? base * (1 - PUSH_RISK * strength(standing)) : base;
};
sovietAdapt.delay = (attempt, days) => {
  const standing = sovietStanding(), posture = sovietPosture(standing);
  if (posture == 'push') return days * (1 - PUSH_HASTE * strength(standing));
  if (posture == 'coast') return days * (1 + COAST_DELAY * strength(standing));
  return days;
};

// Each second, with the days that passed, once the Moon race is open: name a change of posture, and move the attempts not yet
// tried. Returns true if the posture changed.
export function rivalAdaptTick(days) {
  if (!S.rm) return false;
  const state = S.rma || (S.rma = { p: 'steady', sh: {} }), standing = sovietStanding(), posture = sovietPosture(standing);
  const step = (posture == 'push' ? -1 : posture == 'coast' ? 1 : 0) * PULL_PER_MONTH * strength(standing) * days / 30;
  if (step) for (const [id, attempt] of Object.entries(S.rm)) {
    if (attempt.st != 'wait' || attempt.n || attempt.day <= S.day) continue;
    const shifted = state.sh[id] || 0, next = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shifted + step));
    attempt.day = Math.max(S.day, attempt.day + next - shifted);
    state.sh[id] = next;
  }
  if (posture == state.p) return false;
  state.p = posture;
  log(POSTURE_WIRES[posture], posture == 'push' ? 'wn' : 'cyan');
  return true;
}
