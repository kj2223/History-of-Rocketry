// Drive the façade in tests: issue commands that must succeed. game() is a fresh V2 start on 1 October 1958.
import assert from 'node:assert/strict';
import { VEHICLE_QUANTITIES } from '../js/data/vehicles.js';
import { FLIGHT_CONDITIONS } from '../js/data/engineering.js';
import { newGame, dispatch, advance, project } from '../js/rules/index.js';
import { MECHANISMS } from '../js/data/physical.js';
import { TUNING } from '../js/data/tuning.js';
import { dayOf } from '../js/core/calendar.js';

export const game = (seed = 19451958) => {
  let state = newGame(seed), n = 0;
  const g = {
    get state() { return state; },
    set state(s) { state = s; },
    cmd(type, actor, payload = {}) {
      const r = dispatch(state, { id: `c${++n}`, type, actor, payload });
      if (r.rejection) throw new Error(`${type} by ${actor} rejected: ${r.rejection.reason}`);
      state = r.state;
      return r.result;
    },
    try(type, actor, payload = {}) { return dispatch(state, { id: `c${++n}`, type, actor, payload }); },
    approve(decisionId, choice) { const d = state.decisions.find(x => x.id === decisionId); return g.cmd('decide', 'administrator', { decisionId, choice: choice ?? d.options[0] }); },
    days(k) { state = advance(state, k).state; },
    until(y, m, d) { const target = dayOf(y, m, d); if (target > state.day) g.days(target - state.day); },
    finish(jobId) { while (state.work.find(j => j.id === jobId).status === 'running') g.days(1); },
  };
  return g;
};

// Take a programme that has arrived through the four stages to greenlight.
export const greenlightProgramme = (g, programmeId) => {
  g.cmd('authorise-feasibility', 'administrator', { programmeId });
  g.cmd('complete-case', 'technical-director', { programmeId, summary: 'feasible with existing stands' });
  g.cmd('complete-case', 'financial-officer', { programmeId, summary: 'client contributes vehicles' });
  g.cmd('record-meeting', 'administrator', { programmeId, cost: 300000, contribution: 'vehicles', timeline: '18 months', requirements: 'upper-air instruments' });
  g.approve(g.cmd('submit-dossier', 'administrator', { programmeId }));
  g.approve(g.cmd('request-greenlight', 'administrator', { programmeId }));
};

let r = 0;
// Reserve a unit from today for `days` and return the reservation id.
export const book = (g, unitId, programmeId, days = 10) => {
  const id = `res-${++r}`;
  const out = g.cmd('reserve-facility', 'administrator', { id, unitId, programmeId, from: g.state.day, to: g.state.day + days, purpose: 'test' });
  if (!out.reservation) throw new Error(`reservation escalated: ${out.decision}`);
  return id;
};

let t = 0;
export const groundTest = (g, programmeId, burn, { stages = {}, channels = ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'], stage = 'aerobee-sustainer', actor = 'administrator', unit = 'stand-1' } = {}) => {
  const jobId = `gt-${++t}`;
  g.cmd('schedule-test', actor, { jobId, programmeId, stage, stages, conditions: { burn }, channels, reservation: book(g, unit, programmeId) });
  g.finish(jobId);
  return g.state.work.find(j => j.id === jobId);
};

let f = 0;
export const fly = (g, programmeId, articleId, { cost = 20000, replacementCost = 20000 } = {}) => {
  const id = `launch-${++f}`;
  const pad = book(g, 'pad-1', programmeId, 5), tracking = book(g, 'tracking-1', programmeId, 5);
  const decision = g.cmd('request-launch', 'administrator', { id, articleId, pad, tracking, cost, replacementCost }).decision;
  g.approve(decision);
  g.finish(`flight-${id}`);
  return g.state.launches.find(l => l.id === id);
};

// What no projection may ever contain: hidden physical truth and hidden traits.
const HIDDEN = ['physical', 'trueDefectMechanism', 'latentMechanisms', 'traces', 'traits', 'candour', 'independence', 'skill', 'heatCapacity', 'burnThrough', 'leakPerHour', 'navError', ...Object.keys(MECHANISMS)];
export const assertNoLeak = s => {
  const text = JSON.stringify(project(s));
  for (const word of HIDDEN) assert.equal(text.includes(word), false, `projection leaks "${word}"`);
};

// Greenlight Mercury-Redstone and wait for its first vehicles.
export const mercuryRedstone = (seed = 77) => {
  const g = game(seed);
  g.days(7);
  greenlightProgramme(g, 'mercury-redstone');
  g.days(TUNING.designDays['mercury-redstone']);
  return g;
};


// ---- crew helpers (V2 slice 2) ----
const MR = 'mercury-redstone';

// Readings that make every claim of this configuration measured-normal on enough distinct tests.
export const cleanRecord = (g, vehicle, stages, tests = 3) => {
  const obs = g.state.evidence.observations;
  for (let t = 0; t < tests; t++) for (const quantity of VEHICLE_QUANTITIES[vehicle])
    obs.push({ id: `seed-${obs.length + 1}`, day: g.state.day, workId: `seed-${vehicle}-${t}`, kind: 'flight', vehicle, stages: { ...stages }, conditions: { ...FLIGHT_CONDITIONS }, quantity, state: 'measured', value: quantity.endsWith('.heat-load') ? 90 : 1, normal: true });
};

export const selected = (g, ids) => {
  const d = g.state.decisions.find(x => x.type === 'crew-selection' && x.status === 'open');
  if (ids) g.cmd('select-crew', 'administrator', { group: d.subject, ids });
  else g.approve(d.id);
  return g.state;
};

export const train = (g, vehicle, crew) => { const jobId = `train-${crew.join('-')}-${g.state.day}`; g.cmd('train-crew', 'administrator', { jobId, vehicle, crew }); g.finish(jobId); };

// Mercury-Redstone with a clean record, a readiness decision for crewed use and a trained crew.
export const crewedReady = (crew = ['cand-01'], seed = 77) => {
  const g = mercuryRedstone(seed);
  selected(g, crew);
  train(g, MR, crew);
  cleanRecord(g, MR, g.state.programmes[MR].baseline);
  g.approve(g.cmd('request-crew-readiness', 'technical-director', { programmeId: MR }));
  return g;
};

let n = 0;
export const askLaunch = (g, crew, articleId = `art-${++n}`, { programmeId = MR, recovery } = {}) => {
  g.cmd('build-article', 'production', { id: articleId, programmeId });
  const pad = book(g, 'pad-1', programmeId, 5), tracking = book(g, 'tracking-1', programmeId, 5), id = `L-${articleId}`;
  const r = g.try('request-launch', 'administrator', { id, articleId, pad, tracking, cost: 1, replacementCost: 1, crew, ...(recovery ? { recovery } : {}) });
  if (r.rejection) return { rejection: r.rejection.reason };
  g.state = r.state;
  return { id, decision: r.result.decision };
};

