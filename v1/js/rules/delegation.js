// Delegation, appointments and handover (freeze §8.3–8.4, §7.6 archive). Delegation opens when all
// three conditions hold and reverses only on repeated failures beyond remit, never on one.

import { TUNING } from '../data/tuning.js';
import { Rejection, memo } from './authority.js';
import { applies } from './evidence.js';

export const initDelegation = () => ({ programmes: {}, appointments: [] });

const active = (state, role, programmeId) => state.delegation.appointments.find(a => a.status === 'active' && a.role === role && a.programmeId === programmeId);

// Appoint someone. A new project manager inherits the predecessor's records, commitments and concerns.
export const appoint = (state, { id, role, person, programmeId = null, remit = {} }) => {
  const previous = active(state, role, programmeId);
  const a = { id, role, person, programmeId, remit, status: 'active', day: state.day, handover: null };
  if (previous && role === 'project-manager') {
    previous.status = 'succeeded';
    const records = state.work.filter(j => j.programmeId === programmeId).reduce((n, j) => n + j.observations.length + 1, 0);
    a.handover = {
      from: previous.id, records, retrievalQuality: retrievalQuality(state, records),
      commitments: Object.values(state.fiscal.commitments).filter(c => c.programmeId === programmeId && c.status === 'active').map(c => c.id),
      concerns: state.decisions.filter(d => d.status === 'open' && d.subject === programmeId).map(d => d.id),
    };
  }
  state.delegation.appointments.push(a);
  return a;
};

// Archive capacity affects how well records can be retrieved at handover. It never creates knowledge.
export const retrievalQuality = (state, records) => {
  const capacity = Object.values(state.facilities.units).filter(u => u.kind === 'archive' && u.status === 'operational').reduce((n, u) => n + u.capacity, 0);
  return records ? Math.min(1, (capacity * TUNING.recordsPerArchiveUnit) / records) : 1;
};

// A flight counts if it succeeded and its evidence still applies to the programme's current baseline.
const intactFlights = (state, pid) => {
  const p = state.programmes[pid];
  return state.launches.filter(l => l.programmeId === pid && l.experimental && l.outcome === 'success').filter(l => {
    const job = state.work.find(j => j.id === l.jobId);
    return job.observations.some(id => {
      const o = state.evidence.observations.find(x => x.id === id);
      return o.state === 'measured' && applies(o, p.vehicle, p.baseline);
    });
  });
};

export const conditions = (state, pid) => {
  const flights = intactFlights(state, pid).length;
  const lead = state.delegation.appointments.find(a => a.status === 'active' && a.role === 'department-head' && a.remit.programmes?.includes(pid) && a.remit.scheduling);
  const pm = active(state, 'project-manager', pid);
  return [
    { id: 'flights', met: flights >= TUNING.delegationSuccessfulFlights, detail: `${flights} of ${TUNING.delegationSuccessfulFlights} successful experimental flights with intact evidence` },
    { id: 'leadership', met: !!lead, detail: lead ? `${lead.person} holds scheduling remit` : 'no leadership appointment covers routine scheduling' },
    { id: 'project-manager', met: !!pm, detail: pm ? `${pm.person} manages the programme` : 'no project manager appointed' },
  ];
};

export const isDelegated = (state, pid) => !!state.delegation.programmes[pid]?.active;

export const checkDelegation = (state, pid) => {
  const d = state.delegation.programmes[pid] ??= { active: false, since: null, failures: [], reversed: [] };
  if (!d.active && conditions(state, pid).every(c => c.met)) {
    Object.assign(d, { active: true, since: state.day, failures: [] });
    memo(state, { from: 'technical-director', text: `${pid} now schedules its own routine work. You will see exceptions and invitations.`, refs: { programme: pid } });
  }
  return d.active;
};

// Only failures beyond remit tolerance count, and one is an anecdote, not a pattern.
export const recordFailure = (state, pid, { beyondRemit, text }) => {
  const d = state.delegation.programmes[pid];
  if (!d?.active) throw new Rejection(`${pid} is not delegated`);
  if (!beyondRemit) return false;
  d.failures.push({ day: state.day, text });
  const recent = d.failures.filter(f => state.day - f.day <= TUNING.reversalWindowDays);
  if (recent.length < TUNING.reversalFailures) return false;
  Object.assign(d, { active: false, since: null });
  d.reversed.push({ day: state.day, failures: recent });
  memo(state, { from: 'technical-director', kind: 'warning', text: `Delegation of ${pid} withdrawn after ${recent.length} failures beyond remit.`, refs: { programme: pid } });
  return true;
};
