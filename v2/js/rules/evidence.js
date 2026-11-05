// Available evidence (freeze §4.1–4.3). Turns physical samples into observations through the
// channels a plan actually instruments. Observations are append-only and scoped to
// (configuration, conditions, claim). Draws only from the observation stream.

import { QUANTITIES, REVISIONS, lineage } from '../data/vehicles.js';
import { TUNING } from '../data/tuning.js';
import { draw, normal } from '../core/rng.js';

export const initEvidence = () => ({ observations: [] });

const round = v => Math.round(v * 100) / 100;

// Record one sample from running work. A quantity with no channel is 'unmeasured', a channel that
// dropped out is 'lost'; neither carries a value, and neither means normal.
export const observe = (state, job, sample) => {
  const { plan } = job;
  const obs = {
    id: `obs-${state.evidence.observations.length + 1}`, day: state.day, workId: job.id, kind: plan.kind,
    vehicle: plan.vehicle, stages: { ...plan.stages }, conditions: { ...plan.conditions }, quantity: sample.quantity,
  };
  if (!plan.channels.includes(sample.quantity)) obs.state = 'unmeasured';
  else if (draw(state.rng.observation) < TUNING.lossChance[plan.kind]) obs.state = 'lost';
  else {
    const [low, high] = QUANTITIES[sample.quantity].normal;
    obs.state = 'measured';
    obs.value = round(sample.value * (1 + TUNING.observationNoise * normal(state.rng.observation)));
    obs.normal = obs.value >= low && obs.value <= high;
  }
  state.evidence.observations.push(obs);
  return obs;
};

// Evidence from revision `from` carries to `to` only if `to` is `from` or a descendant whose
// changes since `from` do not affect this quantity. A newer revision's evidence never flows back.
const carries = (from, to, quantity) => {
  const chain = lineage(to), at = chain.indexOf(from);
  return at >= 0 && !chain.slice(0, at).some(r => REVISIONS[r].affects.includes(quantity));
};

export const applies = (obs, vehicle, stages) => obs.vehicle === vehicle
  && Object.entries(stages).every(([stage, rev]) => carries(obs.stages[stage], rev, obs.quantity));

const matches = (have, want) => Object.entries(want).every(([k, v]) => have[k] === v);

export const evidenceFor = (state, { vehicle, stages }, quantity, conditions = {}) =>
  state.evidence.observations.filter(o => o.quantity === quantity && matches(o.conditions, conditions) && applies(o, vehicle, stages));

// The four knowledge states (§4.3), plus 'adverse'. One abnormal measurement makes a claim adverse
// however many normal ones exist (§4.5).
export const claimStatus = (state, config, quantity, conditions = {}) => {
  const found = evidenceFor(state, config, quantity, conditions);
  const measured = found.filter(o => o.state === 'measured');
  const tests = new Set(measured.map(o => o.workId)).size;
  const status = measured.some(o => !o.normal) ? 'adverse'
    : measured.length ? 'measured-normal'
    : found.some(o => o.state === 'lost') ? 'lost'
    : found.length ? 'unmeasured' : 'unknown';
  return { quantity, conditions, status, tests, observations: found.map(o => o.id) };
};
