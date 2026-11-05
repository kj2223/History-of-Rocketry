// Physical reality (freeze §4.1). The only module that reads data/physical.js or state.physical.
// It never reads beliefs, evidence or UI state, and it draws only from the physical stream.

import { BASE, REVISION_EFFECTS, SCATTER, MECHANISMS } from '../data/physical.js';
import { VEHICLE_QUANTITIES, lineage } from '../data/vehicles.js';
import { draw, normal } from '../core/rng.js';

export const initPhysical = () => ({ trueDefectMechanism: 'pm-07', traces: {} });

const active = (m, stages, conditions) => {
  const rev = stages[m.stage];
  return !!rev && !lineage(rev).some(r => m.absentFrom.includes(r))
    && Object.entries(m.when).every(([k, v]) => conditions[k] === v);
};

// Generate the true trace of a test and keep it in the physical layer.
// The draw count depends only on the vehicle (1 + 2 per quantity), never on channels or beliefs.
export const runTest = (state, jobId, { kind, vehicle, stage, stages, conditions }) => {
  const stream = state.rng.physical;
  const mechanisms = [state.physical.trueDefectMechanism].map(id => MECHANISMS[id]).filter(m => active(m, stages, conditions));
  const roll = draw(stream);
  const failed = kind === 'flight' && roll < Math.max(0, ...mechanisms.map(m => m.flightFailureChance ?? 0));
  const samples = VEHICLE_QUANTITIES[vehicle].map(quantity => {
    let value = BASE[vehicle][quantity];
    for (const rev of Object.values(stages)) for (const r of lineage(rev)) value += REVISION_EFFECTS[r]?.[quantity] ?? 0;
    for (const m of mechanisms) value += m.effects[quantity] ?? 0;
    value *= 1 + SCATTER * normal(stream);
    if (failed && quantity === 'vehicle.apogee') value *= 0.3;
    if (failed && quantity === 'vehicle.deviation') value += 40;
    return { quantity, value };
  });
  // A stand firing produces readings only for the stage on the stand.
  state.physical.traces[jobId] = kind === 'ground' ? samples.filter(s => s.quantity.startsWith(`${stage}.`)) : samples;
  return state.physical.traces[jobId].length;
};

export const sampleAt = (state, jobId, index) => ({ ...state.physical.traces[jobId][index] });

export const discardTrace = (state, jobId) => { delete state.physical.traces[jobId]; };
