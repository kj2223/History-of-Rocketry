// Physical reality (freeze §4.1). The only module that reads data/physical.js or state.physical.
// It never reads beliefs, evidence or UI state, and it draws only from the physical stream.

import { BASE, REVISION_EFFECTS, SCATTER, MECHANISMS, LATENT, LATENT_V2 } from '../data/physical.js';
import { VEHICLE_QUANTITIES, lineage } from '../data/vehicles.js';
import { draw, normal } from '../core/rng.js';

export const initPhysical = () => ({ trueDefectMechanism: 'pm-07', latentMechanisms: [...LATENT], traces: {} });

// Mercury and Gemini hardware carries its own mechanisms, whichever way V2 opens.
export const addV2Mechanisms = state => {
  state.physical.latentMechanisms = [...new Set([...(state.physical.latentMechanisms ?? LATENT), ...LATENT_V2])];
};

// A mechanism is present on every article whose stage revision has not removed it; its `effects` show
// only under its `when` conditions, but it can bring down any flight it is present on.
const present = (m, stages) => { const rev = stages[m.stage]; return !!rev && !lineage(rev).some(r => m.absentFrom.includes(r)); };
const showing = (m, conditions) => Object.entries(m.when).every(([k, v]) => conditions[k] === v);

// Generate the true trace of a test and keep it in the physical layer.
// The draw count is fixed (1 + 2 per quantity), never dependent on channels or beliefs.
export const runTest = (state, jobId, { kind, vehicle, stage, stages, conditions }) => {
  const stream = state.rng.physical;
  // shortcut: saves made before latent mechanisms existed get the default set on load.
  const ids = [state.physical.trueDefectMechanism, ...(state.physical.latentMechanisms ?? LATENT)];
  const mechanisms = ids.map(id => MECHANISMS[id]).filter(m => present(m, stages));
  // One roll decides the flight: each active mechanism brings it down with its own chance, independently.
  const roll = draw(stream);
  let survive = 1, culprit = null;
  for (const m of mechanisms) {
    survive *= 1 - (m.flightFailureChance ?? 0);
    if (!culprit && roll < 1 - survive) culprit = m;
  }
  const failed = kind === 'flight' && !!culprit;
  const samples = VEHICLE_QUANTITIES[vehicle].map(quantity => {
    let value = BASE[vehicle][quantity];
    for (const rev of Object.values(stages)) for (const r of lineage(rev)) value += REVISION_EFFECTS[r]?.[quantity] ?? 0;
    for (const m of mechanisms) if (showing(m, conditions)) value += m.effects[quantity] ?? 0;
    if (failed) value += culprit.onFailure?.[quantity] ?? 0;
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
