// Production (freeze §5.4–5.5). Findings feed engineering; batch holds within remit send an early memo;
// a recurring defect beyond remit returns as a decision. Storage, reuse and recycling are real work.

import { TUNING } from '../data/tuning.js';
import { Rejection, memo, openDecision } from './authority.js';
import { article } from './hardware.js';
import { receive } from './stock.js';

export const initProduction = () => ({ findings: [], escalated: [] });

const SOURCES = ['manufacture', 'inspection', 'acceptance', 'test', 'operation'];

export const recordFinding = (state, { source, articleId, hypothesis = null, note }) => {
  if (!SOURCES.includes(source)) throw new Rejection(`Unknown finding source ${source}`);
  const a = article(state, articleId);
  const f = { id: `finding-${state.production.findings.length + 1}`, day: state.day, source, articleId, batchId: a.batchId, hypothesis, note };
  state.production.findings.push(f);
  memo(state, { from: 'production', text: `Finding on ${articleId}: ${note}`, refs: { finding: f.id } });
  const key = `${a.batchId}:${hypothesis}`;
  const repeats = state.production.findings.filter(x => x.batchId === a.batchId && x.hypothesis === hypothesis);
  if (hypothesis && repeats.length >= TUNING.recurringFindingThreshold && !state.production.escalated.includes(key)) {
    state.production.escalated.push(key);
    openDecision(state, { type: 'recurring-defect', subject: a.batchId, raisedBy: 'production',
      text: `The same defect has been found ${repeats.length} times in ${a.batchId}. This exceeds production's remit.`,
      evidence: repeats.map(x => x.id), options: ['corrective-revision', 'hold-and-inspect', 'accept-with-limits'], effect: { kind: 'none' } });
  }
  return f;
};

export const holdBatch = (state, batchId, reason) => {
  const b = state.hardware.batches[batchId];
  if (!b) throw new Rejection(`No batch ${batchId}`);
  b.held = true;
  memo(state, { from: 'production', text: `Holding ${batchId} within remit: ${reason}`, refs: { batch: batchId } });
};

export const releaseBatch = (state, batchId) => { state.hardware.batches[batchId].held = false; };

export const storeArticle = (state, articleId) => {
  const a = article(state, articleId);
  if (a.status !== 'built') throw new Rejection(`${articleId} is ${a.status}`);
  a.status = 'stored';
};

// Completion of reuse work: the article moves programme. It keeps its revisions (and the evidence that
// applies to them) but gains no qualification for a different stack.
export const completeReuse = (state, { articleId, programmeId }) => {
  const a = article(state, articleId);
  if (state.programmes[programmeId].vehicle !== a.vehicle) throw new Rejection(`${articleId} does not fit ${programmeId}`);
  Object.assign(a, { programmeId, status: 'built', reusedFrom: a.programmeId });
};

// Completion of recycling work: recovers usable material by its own yield, not the original cost.
export const completeRecycle = (state, { articleId }) => {
  const a = article(state, articleId);
  a.status = 'recycled';
  receive(state, { material: `recovered ${a.vehicle} components`, qty: TUNING.recycleYield, compatible: [a.vehicle] }, { recycledFrom: articleId });
};
