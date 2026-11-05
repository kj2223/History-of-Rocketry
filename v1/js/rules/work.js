// Active work (freeze §6.3, §9.4). Every running job keeps its cursor and sample position in state,
// so reload continues the same work rather than rerolling it. Tests read their physical trace one
// sample at a time; other jobs simply count down days.

import { TUNING } from '../data/tuning.js';
import { VEHICLE_QUANTITIES } from '../data/vehicles.js';
import { Rejection, memo } from './authority.js';
import { runTest, sampleAt, discardTrace } from './physics.js';
import { observe, claimStatus } from './evidence.js';
import { updateBeliefs } from './belief.js';
import { setReservation } from './facilities.js';

const snapshot = (state, plan) => VEHICLE_QUANTITIES[plan.vehicle].map(q => claimStatus(state, plan, q, plan.conditions).status);

export const job = (state, id) => state.work.find(j => j.id === id) ?? (() => { throw new Rejection(`No job ${id}`); })();

// plan: a test plan (kind 'ground' | 'flight'); otherwise `days` for counted work.
export const startJob = (state, { id, kind, programmeId = null, plan = null, days = 0, reservations = [], payload = null }) => {
  if (state.work.some(j => j.id === id)) throw new Rejection(`Job ${id} already exists`);
  const j = { id, kind, programmeId, plan, payload, reservations, status: 'running', started: state.day, cursor: 0,
    total: days, samples: 0, read: 0, observations: [], changedBelief: false, before: null, result: null, assessment: null };
  if (plan) {
    j.before = snapshot(state, plan);
    j.samples = runTest(state, id, plan);
    j.total = Math.ceil(j.samples / TUNING.samplesPerDay);
  }
  reservations.forEach(r => setReservation(state, r, 'consumed'));
  state.work.push(j);
  const running = state.work.filter(x => x.status === 'running' && x.programmeId && x.programmeId === programmeId).length;
  if (programmeId && running > TUNING.workloadWarningJobs) {
    memo(state, { from: 'project-manager', kind: 'warning', text: `${programmeId} has ${running} jobs running; escalating workload to the technical director.`, refs: { programme: programmeId } });
  }
  return j;
};

// Advance every running job one day. Returns the jobs that finished today.
export const advanceWork = state => {
  const finished = [];
  for (const j of state.work.filter(x => x.status === 'running')) {
    if (j.plan) {
      const batch = [];
      for (let k = 0; k < TUNING.samplesPerDay && j.read < j.samples; k++, j.read++) batch.push(observe(state, j, sampleAt(state, j.id, j.read)));
      j.observations.push(...batch.map(o => o.id));
      j.changedBelief = updateBeliefs(state, batch) || j.changedBelief;
    }
    if (++j.cursor < j.total) continue;
    j.status = 'done';
    if (j.plan) {
      discardTrace(state, j.id);
      // Inconclusive work is reported as such (AC04): nothing in belief or claim status moved.
      j.result = j.changedBelief || snapshot(state, j.plan).some((s, i) => s !== j.before[i]) ? 'informative' : 'inconclusive';
    }
    j.reservations.forEach(r => setReservation(state, r, 'released'));
    memo(state, { from: 'project-manager', kind: 'report', text: `${j.kind} ${j.id} finished${j.result ? ` (${j.result})` : ''}.`, refs: { job: j.id } });
    finished.push(j);
  }
  return finished;
};

// Interrupted work (§6.3): neither free to resume nor a write-off. Tests cannot pause mid-firing.
export const pauseJob = (state, id, { preserve }) => {
  const j = job(state, id);
  if (j.plan) throw new Rejection('A test in progress cannot be paused; it runs to completion');
  if (j.status !== 'running') throw new Rejection(`${id} is ${j.status}`);
  const rework = preserve ? 0 : Math.ceil(j.cursor * 0.25);
  j.status = 'paused';
  j.assessment = {
    paused: state.day, preserve, completedPreserved: j.cursor,
    materials: preserve ? 'protected' : 'exposed to deterioration', records: 'complete',
    reworkDays: rework, preservationCostPerDay: preserve ? TUNING.preservationCostPerDay : 0,
  };
  return j.assessment;
};

// Resuming adds any rework and returns the preservation bill for the fiscal ledger.
export const resumeJob = (state, id) => {
  const j = job(state, id);
  if (j.status !== 'paused') throw new Rejection(`${id} is not paused`);
  const a = j.assessment;
  j.total += a.reworkDays;
  j.status = 'running';
  return { reworkDays: a.reworkDays, preservationCost: (state.day - a.paused) * a.preservationCostPerDay };
};

export const cancelJob = (state, id) => {
  const j = job(state, id);
  if (j.status === 'done') return;
  if (j.plan) discardTrace(state, id);
  j.status = 'cancelled';
  j.reservations.forEach(r => setReservation(state, r, 'released'));
};
