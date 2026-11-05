// Plain-language reports (freeze §10.2): what the project manager writes when work finishes.
// Names things the way the player sees them and cites the readings by job, so Mail can link to Records.
// Built after the work's completion has been applied, so it can say what changed.

import { QUANTITIES, REVISIONS, STAGES, VEHICLES } from '../data/vehicles.js';
import { FACILITY_KINDS } from '../data/facilities.js';
import { memo } from './authority.js';

export const money = n => `$${Math.round(n).toLocaleString('en-US')}`;
export const programmeName = (state, id) => state.programmes[id]?.name ?? id;
export const unitName = (state, id) => { const u = state.facilities.units[id]; return u ? `${FACILITY_KINDS[u.kind].name.toLowerCase()} ${id}` : id; };
const list = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const upper = s => s.replace(/^./, c => c.toUpperCase());

// What the readings of a finished test say, without interpreting beyond them.
const readings = (state, j) => {
  const obs = j.observations.map(id => state.evidence.observations.find(o => o.id === id));
  const measured = obs.filter(o => o.state === 'measured'), lost = obs.filter(o => o.state === 'lost').length, unmeasured = obs.filter(o => o.state === 'unmeasured').length;
  const outside = [...new Set(measured.filter(o => !o.normal).map(o => QUANTITIES[o.quantity].name.toLowerCase()))];
  const counts = [`${measured.length} measured`, lost && `${lost} lost`, unmeasured && `${unmeasured} not instrumented`].filter(Boolean);
  return [
    `${plural(obs.length, 'reading')}: ${list(counts)}.`,
    outside.length ? `Outside normal limits: ${list(outside)}.` : measured.length ? 'Everything we measured was within normal limits.' : 'Nothing was measured, so this says nothing about whether it is normal.',
    j.result === 'informative' ? 'This changed what we know.' : 'This was inconclusive: nothing we know has changed.',
    'The readings are in Records.',
  ].join(' ');
};

const TEXT = {
  'ground-test': (state, j) => {
    const { plan } = j, rev = plan.stages[plan.stage];
    const label = REVISIONS[rev].label === STAGES[plan.stage].name ? '' : ` (${REVISIONS[rev].label})`;
    return `The ${plan.conditions.burn}-burn ground test of the ${STAGES[plan.stage].name}${label} for ${programmeName(state, j.programmeId)} is finished. ${readings(state, j)}`;
  },
  flight: (state, j) => {
    const l = state.launches.find(x => x.jobId === j.id);
    const outcome = { success: 'reached its planned apogee', failure: l.rangeAction ? 'was destroyed by range safety' : 'fell short of its planned apogee',
      indeterminate: 'flew, but we could not measure whether it reached its planned apogee' }[l.outcome];
    return `The ${VEHICLES[l.vehicle].name} flight of ${l.articleId} ${outcome}. ${readings(state, j)}`;
  },
  upgrade: (state, j) => `The upgrade of ${unitName(state, j.payload.unitId)} is finished. It is back in service with capacity ${state.facilities.units[j.payload.unitId].capacity}.`,
  commissioning: (state, j) => `${upper(unitName(state, j.payload.unitId))} is commissioned and can now be reserved.`,
  recycle: (state, j) => `${j.payload.articleId} has been recycled. The recovered material is in the agency stores.`,
  'integration-assessment': (state, j) => `${j.payload.articleId} passed its integration assessment and now belongs to ${programmeName(state, j.payload.programmeId)}. It keeps its own evidence but gains no new qualification.`,
};

export const jobReport = (state, j) => memo(state, { from: 'project-manager', kind: 'report',
  text: TEXT[j.kind]?.(state, j) ?? `${upper(j.kind.replace(/-/g, ' '))} work is finished.`, refs: { job: j.id } });
