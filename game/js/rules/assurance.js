// Independent assurance (freeze §3.2, §3.3). Assurance places readiness restrictions where a serious adverse
// finding stands on a configuration in use, and has a protected challenge route: when the administrator accepts
// a known failure risk, assurance's challenge must be answered on the record. It reads claims only.

import { VEHICLE_QUANTITIES, QUANTITIES } from '../data/vehicles.js';
import { claimStatus } from './evidence.js';
import { memo, openDecision } from './authority.js';
import { programmeName } from './reports.js';

const office = state => (state.assurance ??= { restrictions: [], challenges: [] });
export const initAssurance = () => ({ restrictions: [], challenges: [] });

export const openRestrictions = state => office(state).restrictions.filter(r => r.status === 'open');

// Daily: restrict a programme's configuration in use while one of its claims is adverse; lift when it is not.
export const assuranceDay = state => {
  const a = office(state);
  for (const p of Object.values(state.programmes).filter(x => x.vehicle && x.stage === 'greenlit')) {
    const config = { vehicle: p.vehicle, stages: p.baseline }, key = JSON.stringify(p.baseline);
    for (const q of VEHICLE_QUANTITIES[p.vehicle]) {
      const adverse = claimStatus(state, config, q).status === 'adverse';
      const r = a.restrictions.find(x => x.status === 'open' && x.programmeId === p.id && x.quantity === q);
      if (adverse && !r) {
        a.restrictions.push({ id: `restriction-${a.restrictions.length + 1}`, programmeId: p.id, quantity: q, config: key, status: 'open', placed: state.day, lifted: null });
        memo(state, { from: 'assurance', kind: 'warning', refs: { programme: p.id },
          text: `Assurance restricts ${programmeName(state, p.id)}: ${QUANTITIES[q].name.toLowerCase()} has an adverse finding on the configuration in use. No routine flights until the finding is resolved; experimental flights still need the failure risk reviewed.` });
      } else if (!adverse && r && (r.config !== key || claimStatus(state, config, q).status !== 'adverse')) {
        Object.assign(r, { status: 'lifted', lifted: state.day });
        memo(state, { from: 'assurance', refs: { programme: p.id },
          text: `Assurance lifts its restriction on ${programmeName(state, p.id)}: ${QUANTITIES[q].name.toLowerCase()} no longer carries an adverse finding on the configuration in use.` });
      }
    }
  }
};

// The protected challenge: accepting a known failure risk is challenged, and the challenge stays on record.
export const challengeRiskAcceptance = (state, review, observations) => {
  const a = office(state);
  const d = openDecision(state, { type: 'assurance-challenge', subject: review.subject, raisedBy: 'assurance', evidence: observations,
    text: `Assurance challenges the decision to fly again after ${review.subject} without knowing the cause. The abnormal readings are unexplained, and a further loss is likely. Stand by your decision on the record, or ground the configuration until engineering finds the cause.`,
    options: ['stand-by-decision', 'ground-configuration'], effect: null });
  a.challenges.push({ id: `challenge-${a.challenges.length + 1}`, decisionId: d.id, subject: review.subject, observations, raised: state.day, status: 'open', answer: null });
  return d;
};

export const answerChallenge = (state, d) => {
  const c = office(state).challenges.find(x => x.decisionId === d.id);
  if (!c) return;
  Object.assign(c, { status: d.choice === 'stand-by-decision' ? 'overruled' : 'upheld', answer: d.choice, answered: state.day });
  if (d.choice === 'ground-configuration') state.beliefs.assessed = (state.beliefs.assessed ?? []).filter(id => !c.observations.includes(id));
};
