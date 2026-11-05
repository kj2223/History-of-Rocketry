// Test helpers: a bare evidence state and a way to run a whole test in one call.
import { newStreams } from '../js/core/rng.js';
import { initPhysical, runTest, sampleAt, discardTrace } from '../js/rules/physics.js';
import { initEvidence, observe } from '../js/rules/evidence.js';
import { initBeliefs, updateBeliefs } from '../js/rules/belief.js';
import { BASELINE } from '../js/data/vehicles.js';

export const bareState = (seed = 1945) => ({ day: 0, rng: newStreams(seed), physical: initPhysical(), evidence: initEvidence(), beliefs: initBeliefs() });

let n = 0;
export const fire = (state, plan) => {
  const job = { id: `t${++n}`, plan };
  const count = runTest(state, job.id, plan);
  const obs = [];
  for (let i = 0; i < count; i++) obs.push(observe(state, job, sampleAt(state, job.id, i)));
  discardTrace(state, job.id);
  const changed = updateBeliefs(state, obs);
  return { obs, changed };
};

export const aerobee = (sustainer = 'aerobee-sustainer/r1') => ({ vehicle: 'aerobee', stages: { ...BASELINE.aerobee, 'aerobee-sustainer': sustainer } });
export const bumper = (upper = 'wac-upper/r1') => ({ vehicle: 'bumper', stages: { ...BASELINE.bumper, 'wac-upper': upper } });

export const ground = (config, burn, channels = ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'], stage = 'aerobee-sustainer') =>
  ({ kind: 'ground', ...config, stage, conditions: { burn }, channels });

export const flight = (config, channels) => ({ kind: 'flight', ...config, conditions: { burn: 'long' }, channels });
