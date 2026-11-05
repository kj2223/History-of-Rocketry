// Drive the façade in tests: issue commands that must succeed, and step through the Aerobee worked case.
import { newGame, dispatch, advance } from '../js/rules/index.js';
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
export const groundTest = (g, programmeId, burn, { stages = {}, channels = ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'], stage = 'aerobee-sustainer', actor = 'administrator' } = {}) => {
  const jobId = `gt-${++t}`;
  g.cmd('schedule-test', actor, { jobId, programmeId, stage, stages, conditions: { burn }, channels, reservation: book(g, 'stand-1', programmeId) });
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
