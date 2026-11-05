// NASA-formation conclusion (freeze §8.8, §10.4). A persisted six-section projection; not a score,
// not a new game state. The continuation hook is saved but nothing reads it in v1.

import { CONTENT_VERSION } from '../core/save.js';
import { unresolved } from './programme.js';
import { readiness } from './belief.js';
import { claimStatus } from './evidence.js';
import { VEHICLE_QUANTITIES } from '../data/vehicles.js';
import { FLIGHT_CONDITIONS } from '../data/engineering.js';

// What NASA inherits (§8.8, 6th section), read from existing records only: no new state, no hidden truth.
export const openQuestions = state => {
  const live = Object.values(state.programmes).filter(p => p.vehicle && p.stage !== 'closed');
  const config = p => ({ vehicle: p.vehicle, stages: p.baseline });
  const UNTESTED = ['unknown', 'unmeasured', 'lost'];
  return {
    readinessRestrictions: live.map(p => ({ programmeId: p.id,
      restrictions: readiness(state, 'routine-use', config(p)).blockers.filter(b => /adverse|unresolved/.test(b)) })).filter(r => r.restrictions.length),
    unsettledObligations: [
      ...state.fiscal.ledger.filter(e => e.status === 'open' || e.status === 'overdue')
        .map(e => ({ id: e.id, kind: e.kind, amount: e.amount, due: e.due, owner: e.dept, programmeId: e.programmeId, status: e.status })),
      ...Object.values(state.programmes).filter(p => p.closure).flatMap(p => unresolved(p)
        .filter(o => o.kind !== 'payment')
        .map(o => ({ id: o.id, kind: o.kind, amount: o.amount ?? null, due: null, owner: o.owner, programmeId: p.id, status: o.status }))),
    ],
    disagreements: state.decisions.filter(d => d.status === 'open' && d.vetoable && Object.values(d.positions).some(x => x?.stance === 'veto'))
      .map(d => ({ decisionId: d.id, type: d.type, subject: d.subject, text: d.text,
        vetoes: Object.entries(d.positions).filter(([, x]) => x?.stance === 'veto').map(([who, x]) => ({ who, reason: x.reason })) })),
    untestedClaims: live.flatMap(p => VEHICLE_QUANTITIES[p.vehicle].map(q => claimStatus(state, config(p), q, FLIGHT_CONDITIONS))
      .filter(c => UNTESTED.includes(c.status)).map(c => ({ programmeId: p.id, quantity: c.quantity, status: c.status }))),
  };
};

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
      { id: 'open-questions', title: 'Open questions carried forward', items: openQuestions(state) },
    ],
  };
};

export const conclude = state => {
  state.continuation = { summary: buildSummary(state), hook: { from: 'nasa-formation', day: state.day, contentVersion: CONTENT_VERSION, active: false } };
  state.concluded = true;
};
