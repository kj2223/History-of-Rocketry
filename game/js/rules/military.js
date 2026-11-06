// Military flight records (V2 freeze §5). Atlas and Titan II arrive with the Air Force's test flights.
// Each listed flight flies through the same physics and evidence as our own, on the military configuration,
// so its records are scoped to that configuration: they carry to the crewed boosters only for claims the
// crewed changes leave unaffected (V1 freeze §4.2). We read their telemetry; we did not fly them.

import { MILITARY_FLIGHTS } from '../data/scenario.js';
import { BASELINE, VEHICLES, REVISIONS, TRACKING_CHANNELS } from '../data/vehicles.js';
import { FLIGHT_CONDITIONS } from '../data/engineering.js';
import { runTest, sampleAt, discardTrace } from './physics.js';
import { observe } from './evidence.js';
import { updateBeliefs } from './belief.js';
import { memo } from './authority.js';

export const militaryDay = state => {
  for (const f of MILITARY_FLIGHTS.filter(x => x.day === state.day)) {
    const stages = { ...BASELINE[f.vehicle] };
    const plan = { kind: 'flight', vehicle: f.vehicle, stages, conditions: { ...FLIGHT_CONDITIONS },
      channels: [...TRACKING_CHANNELS, ...new Set(Object.values(stages).flatMap(r => REVISIONS[r].telemetry))] };
    const job = { id: `military-${f.id}`, plan };
    const count = runTest(state, job.id, plan);
    const obs = [];
    for (let i = 0; i < count; i++) obs.push(observe(state, job, sampleAt(state, job.id, i)));
    discardTrace(state, job.id);
    updateBeliefs(state, obs);
    const bad = obs.some(o => o.state === 'measured' && !o.normal);
    state.military.flights.push({ id: f.id, vehicle: f.vehicle, day: state.day, observations: obs.map(o => o.id), outcome: bad ? 'abnormal' : 'nominal' });
    memo(state, { from: 'technical-director', refs: { military: f.id },
      text: `The Air Force flew a ${VEHICLES[f.vehicle].name} today and sent us its records. ${bad ? 'Some readings were outside normal limits.' : 'The readings were within normal limits.'} `
        + 'They count only for the parts our crewed version leaves unchanged.' });
  }
};
