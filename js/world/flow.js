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
import { FLOWS, flowFor } from '../data/flow.js';
import { KITS } from '../data/kits.js';

// How much more you catch by sitting in: this share of what the team alone would miss.
export const YOU_EXTRA = 0.5;
// The most a round's flow can slip: past this, the crews work nights and weekends to hold the date.
export const MAX_SLIP = 4;

// The flow for a round starting on `start` (its first morning), when the calendar stands at `today`. A test whose day has
// already passed was run before you got there (status 'early').
export function newFlow(vehicle, start, today, probe = false) {
  const defs = flowFor(vehicle, probe);
  if (!defs) return null;
  const tests = defs
    .map(t => ({ id: t.id, day: start - t.lead, status: 'due', found: [] }))
    .sort((a, b) => a.day - b.day);
  // One test a day: two on the same day are spread back to the days before.
  for (let i = tests.length - 2; i >= 0; i--) tests[i].day = Math.min(tests[i].day, tests[i + 1].day - 1);
  for (const t of tests) if (t.day <= today) t.status = 'early';
  return { vehicle, tests, slip: 0 };
}

export const defOf = (flow, test) => FLOWS[flow.vehicle].find(d => d.id === test.id);
// The next test still to come, or null.
export const dueTest = flow => flow?.tests.find(t => t.status === 'due') || null;
// The day a test falls on, after the slips.
export const dayOf = (flow, test) => test.day + flow.slip;

// The risk the flow can catch, added back on to the round's thresholds, so a round whose flow the team runs flies about
// as often as the real ones did. Only thresholds move, never the draws (truth/round.js).
export function flowRisk(risks, vehicle, probe = false) {
  const defs = flowFor(vehicle, probe);
  if (!defs) return risks;
  const out = { ...risks };
  const miss = {};
  for (const d of defs) for (const [kind, q] of Object.entries(d.finds)) miss[kind] = (miss[kind] ?? 1) * (1 - q);
  for (const [kind, m] of Object.entries(miss)) {
    const k = `${kind}Risk`;
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
  for (const id of Object.keys(spots).sort()) {
    const kind = round.faults[id];
    const u = draw(rng); // one draw per spot whatever is there, so the stream never shifts
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
  const days = found.length ? Math.min(def.fix ?? 1, MAX_SLIP - flow.slip) : 0;
  flow.slip += days;
  test.status = by;
  test.found = found.map(f => f.spot);
  return { found, days };
}

// Cut a test still to come to win back a slipped day. Only while the flow is behind.
export const canCut = flow => flow.slip > 0;
export function cutTest(flow, test) {
  if (!canCut(flow) || test.status !== 'due') return 0;
  flow.slip -= 1;
  test.status = 'cut';
  return 1;
}

// What sitting in rehearsed, for the launch day: how many tests of each kind you attended.
export function practiced(flow) {
  const out = {};
  for (const t of flow?.tests || []) {
    if (t.status !== 'you') continue;
    const p = defOf(flow, t).practice;
    if (p) out[p] = (out[p] || 0) + 1;
  }
  return out;
}
