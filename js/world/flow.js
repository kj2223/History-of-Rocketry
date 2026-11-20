// THE LAUNCH FLOW'S RULES (the tests themselves are in data/flow.js). Pure: reads and changes only what it is given.
//
// A flow is plain JSON, kept on the game and saved in the checkpoint:
//   { vehicle, tests: [{ id, day, status, found }], slip }
// status: 'due' (still to come), 'team' (the team ran it), 'you' (you sat in), 'cut' (cut to win back time),
// 'early' (run before you arrived, by the team). day: the test's day before any slip; slip: repair days lost so far,
// which push every test still to come and the launch.
//
// Each test has its own random stream, seeded from the round and the test, so whether it catches a fault does not
// depend on what else was played, and sitting in always catches at least what the team alone would have.

import { newStreams, draw } from '../core/rng.js';
import { flowFor, REHEARSALS, MOMENTS } from '../data/flow.js';
import { KITS } from '../data/kits.js';

// How much more you catch by sitting in: this share of what the team alone would miss.
export const YOU_EXTRA = 0.5;
// The most a round's flow can slip: past this, the crews work nights and weekends to hold the date.
export const MAX_SLIP = 4;

// The flow for a round starting on `start` (its first morning), when the calendar stands at `today`. A test whose day has
// already passed was run before you got there (status 'early').
export function newFlow(vehicle, start, today, probe = false, season = null) {
  const defs = flowFor(vehicle, probe, season);
  if (!defs) return null;
  const tests = defs
    .map(t => ({ id: t.id, day: start - t.lead, status: 'due', found: [] }))
    .sort((a, b) => a.day - b.day);
  // One test a day: two on the same day are spread back to the days before.
  for (let i = tests.length - 2; i >= 0; i--) tests[i].day = Math.min(tests[i].day, tests[i + 1].day - 1);
  for (const t of tests) if (t.day <= today) t.status = 'early';
  return { vehicle, season, tests, slip: 0 };
}

export const defOf = (flow, test) => flowFor(flow.vehicle, false, flow.season).find(d => d.id === test.id);
// The history's moment in this flow, if this test is where it happens.
const momentAt = (flow, test) => (MOMENTS[flow.season]?.test === test.id ? MOMENTS[flow.season] : null);
// The next test still to come, or null.
export const dueTest = flow => flow?.tests.find(t => t.status === 'due') || null;
// The day a test falls on, after the slips.
export const dayOf = (flow, test) => test.day + flow.slip;

// The risk the flow can catch, added back on to the round's thresholds, so a round whose flow the team runs flies about
// as often as the real ones did. Only thresholds move, never the draws (truth/round.js).
export function flowRisk(risks, vehicle, probe = false, season = null) {
  const defs = flowFor(vehicle, probe, season);
  const seen = MOMENTS[season]?.seen;
  if (!defs) return risks;
  const out = { ...risks };
  const miss = {};
  for (const d of defs) for (const [kind, q] of Object.entries(d.finds)) miss[kind] = (miss[kind] ?? 1) * (1 - q);
  for (const [kind, m] of Object.entries(miss)) {
    const k = `${kind}Risk`;
    if (kind === seen) continue; // seen but never fixed by the test: nothing to price in
    if (out[k] != null) out[k] = Math.min(0.9, out[k] / m);
  }
  return out;
}

// What the test catches when it is run now: the faults of the kinds it looks for, by who runs it ('team' or 'you').
// Found faults are taken off the round and told in the round's events; returns { found: [{ kind, spot }], days }.
export function runTest(flow, round, test, by = 'team') {
  const def = defOf(flow, test);
  const rng = newStreams((round.seed + 7907 * (flow.tests.indexOf(test) + 1)) >>> 0).observation;
  const spots = KITS[round.vehicle].spots;
  const found = [];
  const moment = momentAt(flow, test);
  for (const id of Object.keys(spots).sort()) {
    const kind = round.faults[id];
    const u = draw(rng); // one draw per spot whatever is there, so the stream never shifts
    if (kind && kind === moment?.seen) {
      // Seen, and noted; the test cannot fix it. The review decides.
      flow.moment = 'seen';
      continue;
    }
    const q = kind ? def.finds[kind] : null;
    if (!q) continue;
    const chance = by === 'you' ? q + (1 - q) * YOU_EXTRA : q;
    if (u < chance) {
      found.push({ kind, spot: spots[id].name });
      delete round.faults[id];
      round.events.push(
        `The ${def.name.toLowerCase()} found a fault at the ${spots[id].name.toLowerCase()}, and it was fixed.`,
      );
    }
  }
  let days = found.length ? Math.max(0, Math.min(def.fix ?? 1, MAX_SLIP - flow.slip)) : 0;
  days += moment?.days || 0;
  flow.slip += days;
  test.status = by;
  test.found = found.map(f => f.spot);
  const history = moment && (moment.days || flow.moment === 'seen') ? moment.text : null;
  return { found, days, history };
}

// Cut a test still to come to win back a slipped day. Only while the flow is behind.
export const canCut = flow => flow.slip > 0;
export function cutTest(flow, test) {
  if (!canCut(flow) || test.status !== 'due') return 0;
  flow.slip -= 1;
  test.status = 'cut';
  return 1;
}

// A rehearsal you sit through (data/flow.js REHEARSALS), or null if the test has none. Plain JSON on the game:
// { id, at, glitchAt, glitch, calls } where calls[i] is true for a HOLD at mark i. Its own seeded stream.
export function newRehearsal(flow, round, test) {
  const r = REHEARSALS[test.id];
  if (!r) return null;
  const rng = newStreams((round.seed + 104729 * (flow.tests.indexOf(test) + 1)) >>> 0).forecast;
  return {
    id: test.id,
    at: 0,
    glitchAt: Math.floor(draw(rng) * r.steps.length),
    glitch: momentAt(flow, test)?.glitch ?? Math.floor(draw(rng) * r.glitches.length),
    calls: [],
  };
}
export const rehearsalSteps = reh => REHEARSALS[reh.id].steps;
// What the mark in front of you shows: the step, and the glitch if this is the mark it comes at.
export const rehearsalMark = reh => ({
  step: REHEARSALS[reh.id].steps[reh.at],
  glitch: reh.at === reh.glitchAt ? REHEARSALS[reh.id].glitches[reh.glitch] : null,
});
// Your call at the mark in front of you: hold or carry on. Returns true when the rehearsal is over.
export function rehearsalCall(reh, hold) {
  if (reh.at >= REHEARSALS[reh.id].steps.length) return true;
  reh.calls.push(!!hold);
  reh.at++;
  return reh.at >= REHEARSALS[reh.id].steps.length;
}
// How the rehearsal went: 'clean' if you held on the glitch and nowhere else. missed: you let the glitch go by;
// needless: holds on clean marks.
export function rehearsalGrade(reh) {
  const missed = !reh.calls[reh.glitchAt];
  const needless = reh.calls.filter((h, i) => h && i !== reh.glitchAt).length;
  return { grade: !missed && !needless ? 'clean' : 'rough', missed, needless };
}

// What sitting in rehearsed, for the launch day: how many tests of each kind you attended. A test with a rehearsal
// counts only if you ran it clean.
export function practiced(flow) {
  const out = {};
  for (const t of flow?.tests || []) {
    if (t.status !== 'you' || (REHEARSALS[t.id] && t.grade !== 'clean')) continue;
    const p = defOf(flow, t).practice;
    if (p) out[p] = (out[p] || 0) + 1;
  }
  return out;
}
