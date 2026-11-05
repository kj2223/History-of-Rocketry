// Projections (freeze §10.1): everything the UI may show, rebuilt from state on each call.
// Receives state with the physical layer already removed, so it cannot leak hidden truth.

import { dateLabel } from '../core/calendar.js';
import { VEHICLE_QUANTITIES, QUANTITIES, REVISIONS, STAGES } from '../data/vehicles.js';
import { HYPOTHESES, ANOMALIES, FLIGHT_CONDITIONS } from '../data/engineering.js';
import { claimStatus } from './evidence.js';
import { capacityRemaining, protectedBaseline, available } from './fiscal.js';
import { conditions, isDelegated } from './delegation.js';
import { unresolved } from './programme.js';

export const project = s => {
  if ('physical' in s) throw new Error('project() must not receive the physical layer');
  const copy = x => JSON.parse(JSON.stringify(x));
  return {
    day: s.day, date: dateLabel(s.day), act: s.act, concluded: s.concluded,
    inbox: [
      ...s.decisions.filter(d => d.status === 'open').map(d => ({ kind: 'decision', id: d.id, day: d.day, from: d.raisedBy, text: d.text, options: d.options, positions: d.positions })),
      ...s.memos.map(m => ({ kind: m.kind, id: m.id, day: m.day, from: m.from, text: m.text })),
    ].sort((a, b) => b.day - a.day),
    programmes: Object.values(s.programmes).map(p => ({
      id: p.id, name: p.name, stage: p.stage, source: p.source, client: p.client, vehicle: p.vehicle, baseline: p.baseline, window: p.window,
      delegated: isDelegated(s, p.id), delegationConditions: p.vehicle ? conditions(s, p.id) : [],
      claims: p.vehicle ? VEHICLE_QUANTITIES[p.vehicle].map(q => ({ ...claimStatus(s, { vehicle: p.vehicle, stages: p.baseline }, q, FLIGHT_CONDITIONS), name: QUANTITIES[q].name })) : [],
      cases: copy(p.cases), meeting: p.meeting && copy(p.meeting), history: copy(p.history),
      closure: p.closure && { steps: p.closure.steps, unresolved: unresolved(p) },
    })),
    anomalies: Object.values(s.beliefs.anomalies).map(a => ({
      id: a.id, name: ANOMALIES[a.id].name, status: a.status, evidence: a.evidence, proposedTests: a.proposedTests,
      hypotheses: Object.entries(a.hypotheses).map(([h, v]) => ({ id: h, name: HYPOTHESES[h].name, ...v })),
    })),
    evidence: copy(s.evidence.observations),
    decisions: copy(s.decisions),
    workload: s.work.map(j => ({ id: j.id, kind: j.kind, programmeId: j.programmeId, status: j.status, cursor: j.cursor, total: j.total, result: j.result, assessment: j.assessment, observations: j.observations.length })),
    calendar: copy(s.facilities.reservations),
    facilities: copy(Object.values(s.facilities.units)),
    fiscal: { fy: s.fiscal.fy, award: s.fiscal.award, cash: s.fiscal.cash, capacityRemaining: capacityRemaining(s), protectedBaseline: protectedBaseline(s), available: available(s),
      ledger: copy(s.fiscal.ledger), exposures: copy(s.fiscal.exposures), retentions: copy(s.fiscal.retentions), conditions: copy(s.fiscal.conditions) },
    stock: copy(Object.values(s.stock.items)),
    revisionCatalogue: Object.entries(REVISIONS).filter(([, r]) => r.parent && STAGES[r.stage].developable).map(([id, r]) => ({ id, label: r.label, stage: r.stage, stageName: STAGES[r.stage].name, affects: r.affects })),
    hardware: copy({ revisions: s.hardware.revisions, articles: s.hardware.articles, batches: s.hardware.batches }),
    launches: copy(s.launches),
    summary: s.continuation.summary && copy(s.continuation.summary),
  };
};
