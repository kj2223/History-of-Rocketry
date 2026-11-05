// Hardware lifecycle (freeze §5.1–5.3). Stages carry their own revisions; a configuration is the set of
// stage revisions an article is built to. Approving a trial is not adoption, and adoption never
// updates articles already built.

import { REVISIONS, STAGES } from '../data/vehicles.js';
import { Rejection, memo } from './authority.js';

export const initHardware = () => ({
  revisions: Object.fromEntries(Object.keys(REVISIONS).filter(r => !REVISIONS[r].parent).map(r => [r, { id: r, status: 'defined', trial: false, adoptedFor: ['baseline'] }])),
  articles: {},
  batches: {},
});

const revision = (state, id) => state.hardware.revisions[id] ?? (() => { throw new Rejection(`Revision ${id} has not been proposed`); })();

// A team identifies an improvement within its remit.
export const proposeRevision = (state, revId, by, reason) => {
  const content = REVISIONS[revId];
  if (!content) throw new Rejection(`No such revision ${revId}`);
  if (!STAGES[content.stage].developable) throw new Rejection(`${STAGES[content.stage].name} is not developed by the agency`);
  if (state.hardware.revisions[revId]) throw new Rejection(`${revId} is already ${state.hardware.revisions[revId].status}`);
  state.hardware.revisions[revId] = { id: revId, status: 'proposed', trial: false, adoptedFor: [], proposedBy: by, reason };
  memo(state, { from: by, text: `Proposed ${content.label}: ${reason}`, refs: { revision: revId } });
};

export const defineRevision = (state, revId) => { revision(state, revId).status = 'defined'; };

export const approveTrial = (state, revId) => {
  const r = revision(state, revId);
  if (r.status !== 'defined') throw new Rejection(`${revId} is not defined yet`);
  r.trial = true;
};

// Deployment: future articles for the named programmes use the revision. Nothing already built changes.
export const adopt = (state, revId, programmeIds) => {
  const r = revision(state, revId);
  if (!r.trial) throw new Rejection(`${revId} has not been through an authorised trial`);
  for (const pid of programmeIds) {
    state.programmes[pid].baseline[REVISIONS[revId].stage] = revId;
    if (!r.adoptedFor.includes(pid)) r.adoptedFor.push(pid);
  }
};

// Build an article. Non-baseline revisions are allowed only once a trial is authorised.
export const buildArticle = (state, { id, programmeId, stages = null, batchId = 'batch-1' }) => {
  const p = state.programmes[programmeId];
  if (!p?.vehicle) throw new Rejection(`${programmeId} has no vehicle to build`);
  const config = { ...p.baseline, ...(stages ?? {}) };
  for (const rev of Object.values(config)) {
    const r = revision(state, rev);
    if (rev !== p.baseline[REVISIONS[rev].stage] && !r.trial) throw new Rejection(`${rev} is not authorised for trial articles`);
  }
  const batch = state.hardware.batches[batchId] ??= { id: batchId, vehicle: p.vehicle, held: false, articles: [] };
  if (batch.held) throw new Rejection(`${batchId} is on hold`);
  if (state.hardware.articles[id]) throw new Rejection(`Article ${id} already exists`);
  state.hardware.articles[id] = { id, programmeId, vehicle: p.vehicle, stages: config, batchId, status: 'built', built: state.day };
  batch.articles.push(id);
  return state.hardware.articles[id];
};

export const article = (state, id) => state.hardware.articles[id] ?? (() => { throw new Rejection(`No article ${id}`); })();
