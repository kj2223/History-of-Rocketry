// NASA-formation conclusion (freeze §8.8, §10.4). A persisted six-section projection; not a score,
// not a new game state. The continuation hook is saved but nothing reads it in v1.

import { CONTENT_VERSION } from '../core/save.js';
import { unresolved } from './programme.js';

export const initContinuation = () => ({ summary: null, hook: null });

export const buildSummary = state => {
  const flown = state.launches.filter(l => l.status === 'flown');
  const open = e => e.status === 'open' || e.status === 'overdue';
  const conditions = state.fiscal.conditions;
  return {
    day: state.day,
    sections: [
      { id: 'technical', title: 'Technical capability demonstrated', items: {
        successfulFlights: flown.filter(l => l.outcome === 'success').length,
        failedFlights: flown.filter(l => l.outcome === 'failure').length,
        indeterminateFlights: flown.filter(l => l.outcome === 'indeterminate').length,
        revisionsAdopted: Object.values(state.hardware.revisions).filter(r => r.adoptedFor.some(p => p !== 'baseline')).map(r => r.id),
        anomaliesExplained: Object.values(state.beliefs.anomalies).filter(a => a.status === 'leading').map(a => a.id),
        anomaliesOpen: Object.values(state.beliefs.anomalies).filter(a => a.status !== 'leading').map(a => a.id),
      } },
      { id: 'institutional', title: 'Institutional capability', items: {
        appointments: state.delegation.appointments.filter(a => a.status === 'active').map(a => ({ role: a.role, person: a.person, programmeId: a.programmeId })),
        delegatedProgrammes: Object.entries(state.delegation.programmes).filter(([, d]) => d.active).map(([id]) => id),
        archiveUnits: Object.values(state.facilities.units).filter(u => u.kind === 'archive').length,
      } },
      { id: 'stewardship', title: 'Stewardship', items: {
        paymentsMade: state.fiscal.ledger.filter(e => e.status === 'paid').length,
        obligationsOutstanding: state.fiscal.ledger.filter(open).reduce((a, e) => a + e.amount, 0),
        overduePayments: state.fiscal.ledger.filter(e => e.status === 'overdue').length,
        closures: Object.values(state.programmes).filter(p => p.closure).map(p => ({ id: p.id, stage: p.stage, unresolved: unresolved(p).length })),
        rangeSafetyActions: flown.filter(l => l.rangeAction).length,
        escalationsRaised: state.decisions.filter(d => !d.vetoable).length,
      } },
      { id: 'political', title: 'Political standing', items: {
        conditionsHonoured: conditions.filter(c => c.honoured).length,
        conditionsMissed: conditions.filter(c => !c.honoured).length,
        currentAward: state.fiscal.award,
      } },
      { id: 'narrative', title: 'Programme narrative', items: Object.values(state.programmes).map(p => ({ id: p.id, name: p.name, stage: p.stage, history: p.history })) },
      // Placeholder until the open-questions content is designed (Aaron, 5 Nov 2026).
      { id: 'open-questions', title: 'Open questions carried forward', items: [], placeholder: true },
    ],
  };
};

export const conclude = state => {
  state.continuation = { summary: buildSummary(state), hook: { from: 'nasa-formation', day: state.day, contentVersion: CONTENT_VERSION, active: false } };
  state.concluded = true;
};
