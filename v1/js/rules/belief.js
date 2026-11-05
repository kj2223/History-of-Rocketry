// Engineering belief (freeze §4.1, §4.4, §4.5). Reads only observations and public content;
// hypotheses use their own vocabulary and never see physical mechanism IDs.

import { ANOMALIES, HYPOTHESES, CANDIDATE_TESTS, FLIGHT_CONDITIONS } from '../data/engineering.js';
import { REVISIONS, STAGES, VEHICLE_QUANTITIES, lineage } from '../data/vehicles.js';
import { TUNING } from '../data/tuning.js';
import { claimStatus } from './evidence.js';

// `assessed` holds abnormal observations whose failure consequences the technical director has reviewed.
export const initBeliefs = () => ({ anomalies: {}, assessed: [] });

const matches = (have, want) => Object.entries(want).every(([k, v]) => have[k] === v);

// What a hypothesis predicts for this reading: true (normal), false (abnormal) or undefined.
const predict = (hyp, quantity, conditions) =>
  HYPOTHESES[hyp].predicts.find(p => p.quantity === quantity && matches(conditions, p.when))?.normal;

const remedied = (rev, hyp) => lineage(rev).some(r => REVISIONS[r].remedies?.includes(hyp));

export const openHypotheses = anomaly => Object.keys(anomaly.hypotheses).filter(h => anomaly.hypotheses[h].status === 'open');

// A plan is informative if two surviving hypotheses predict different readings on one of its channels.
export const discriminates = (anomaly, plan) => plan.channels.some(q =>
  new Set(openHypotheses(anomaly).map(h => predict(h, q, plan.conditions)).filter(p => p !== undefined)).size > 1);

// Fold new observations into anomalies. Returns true if any belief changed.
export const updateBeliefs = (state, observations) => {
  let changed = false;
  for (const obs of observations.filter(o => o.state === 'measured')) {
    for (const [id, def] of Object.entries(ANOMALIES)) {
      if (!state.beliefs.anomalies[id] && obs.quantity === def.trigger && !obs.normal) {
        state.beliefs.anomalies[id] = {
          id, opened: state.day, openedBy: obs.id, evidence: [],
          hypotheses: Object.fromEntries(def.hypotheses.map(h => [h, { status: 'open', ruledOutBy: null }])),
        };
        changed = true;
      }
      const anomaly = state.beliefs.anomalies[id];
      if (!anomaly || !(def.stage in obs.stages) || anomaly.evidence.includes(obs.id)) continue;
      anomaly.evidence.push(obs.id);
      for (const h of openHypotheses(anomaly)) {
        const expected = predict(h, obs.quantity, obs.conditions);
        if (expected !== undefined && expected !== obs.normal && !remedied(obs.stages[def.stage], h)) {
          anomaly.hypotheses[h] = { status: 'ruled-out', ruledOutBy: obs.id };
          changed = true;
        }
      }
    }
  }
  for (const [id, anomaly] of Object.entries(state.beliefs.anomalies)) {
    const open = openHypotheses(anomaly);
    anomaly.status = open.length > 1 ? 'competing' : open.length === 1 ? 'leading' : 'unexplained';
    anomaly.proposedTests = open.length > 1 ? CANDIDATE_TESTS.filter(p => p.stage === ANOMALIES[id].stage && discriminates(anomaly, p)) : [];
  }
  return changed;
};

const claimsFor = (state, config, conditions) => VEHICLE_QUANTITIES[config.vehicle].map(q => claimStatus(state, config, q, conditions));

const openAnomaliesOn = (state, config) => Object.values(state.beliefs.anomalies).filter(a => {
  const rev = config.stages[ANOMALIES[a.id].stage];
  return rev && a.status !== 'unexplained' && !openHypotheses(a).every(h => remedied(rev, h));
});

// Readiness is decision-specific (§4.4). Returns { ready, blockers, gaps }.
export const readiness = (state, decision, config, revId = null) => {
  const claims = claimsFor(state, config, FLIGHT_CONDITIONS);
  const adverse = claims.filter(c => c.status === 'adverse').map(c => `${c.quantity} has an adverse finding`);
  const gaps = claims.filter(c => c.status !== 'measured-normal' && c.status !== 'adverse').map(c => `${c.quantity} is ${c.status}`);
  const anomalies = openAnomaliesOn(state, config);
  switch (decision) {
    case 'investigate': {
      const useful = anomalies.some(a => a.proposedTests.length) || gaps.length > 0;
      return { ready: useful, blockers: useful ? [] : ['no open question a bounded test would reduce'], gaps };
    }
    case 'prototype': {
      const rev = REVISIONS[revId];
      const blockers = !rev ? ['no defined revision'] : !STAGES[rev.stage].developable ? [`${STAGES[rev.stage].name} is not a developable stage`] : [];
      return { ready: !blockers.length, blockers, gaps };
    }
    case 'experimental-flight': {
      const changed = revId ? REVISIONS[revId].affects.filter(q => q.startsWith(`${REVISIONS[revId].stage}.`)) : [];
      const untested = changed.filter(q => claimStatus(state, config, q, FLIGHT_CONDITIONS).status !== 'measured-normal').map(q => `${q} has no ground evidence for flight conditions`);
      // §4.4: an experimental flight needs failure consequences assessed, not eliminated. Routine use still
      // treats every adverse finding as blocking (§4.5).
      const assessed = new Set(state.beliefs.assessed ?? []);
      const unassessed = claims.filter(c => c.status === 'adverse' && c.observations.some(id => {
        const o = state.evidence.observations.find(x => x.id === id);
        return o.state === 'measured' && !o.normal && !assessed.has(id);
      })).map(c => `${c.quantity} has an adverse finding`);
      const risks = claims.filter(c => c.status === 'adverse' && !unassessed.includes(`${c.quantity} has an adverse finding`)).map(c => `${c.quantity} carries an assessed failure risk`);
      const blockers = [...unassessed, ...untested];
      return { ready: !blockers.length, blockers, gaps: [...gaps, ...risks] };
    }
    case 'routine-use': {
      const thin = claims.filter(c => c.status === 'measured-normal' && c.tests < TUNING.routineDistinctTests).map(c => `${c.quantity} has ${c.tests} of ${TUNING.routineDistinctTests} distinct tests`);
      const blockers = [...adverse, ...gaps, ...thin, ...anomalies.map(a => `${ANOMALIES[a.id].name} is unresolved`)];
      return { ready: !blockers.length, blockers, gaps };
    }
    default: throw new Error(`Unknown readiness decision ${decision}`);
  }
};
