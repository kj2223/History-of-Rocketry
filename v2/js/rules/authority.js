// Authority model (freeze §3). Who may issue which command, the three-way executive veto,
// decision records and memos. Has no dependencies on other rules: callers supply officer positions.

export const ROLES = ['administrator', 'financial-officer', 'technical-director', 'department-head', 'project-manager', 'production', 'archivist', 'assurance', 'flight-control', 'crew'];

export class Rejection extends Error {
  constructor(reason, needed = null) { super(reason); this.needed = needed; }
}

export const initAuthority = () => ({ decisions: [], memos: [] });

// Memos are information only: routine reports, early warnings, notices.
export const memo = (state, { from, kind = 'info', text, refs = {} }) => {
  const m = { id: `memo-${state.memos.length + 1}`, day: state.day, from, kind, text, refs };
  state.memos.push(m);
  return m;
};

// A decision records who decides, on what evidence, with what options and consequence.
// `vetoable` decisions (§3.1) carry finance and technical positions; either veto blocks approval.
// `effect` names what happens on approval; the façade applies it, so state stays plain data.
export const openDecision = (state, { type, subject, raisedBy, text, evidence = [], options = ['approve', 'reject'], vetoable = false, finance = null, technical = null, effect = null }) => {
  const d = {
    id: `decision-${state.decisions.length + 1}`, type, subject, raisedBy, text, evidence, options, vetoable,
    positions: vetoable ? { finance, technical } : null,
    effect, status: 'open', day: state.day, choice: null, decidedBy: null, decidedDay: null, consequence: null,
  };
  state.decisions.push(d);
  return d;
};

export const findDecision = (state, id) => {
  const d = state.decisions.find(x => x.id === id);
  if (!d) throw new Rejection(`No decision ${id}`);
  return d;
};

// Two approvals cannot override the third: an administrator approval over a veto is refused.
export const decide = (state, id, choice, actor, consequence = null) => {
  const d = findDecision(state, id);
  if (d.status !== 'open') throw new Rejection(`${id} is already ${d.status}`);
  if (actor !== 'administrator') throw new Rejection('Only the administrator closes decisions', 'administrator');
  if (!d.options.includes(choice)) throw new Rejection(`${choice} is not an option for ${id}`);
  if (choice === d.options[0] && d.vetoable) {
    const vetoes = Object.entries(d.positions).filter(([, p]) => p?.stance === 'veto');
    if (vetoes.length) throw new Rejection(`Vetoed by ${vetoes.map(([who, p]) => `${who} (${p.reason})`).join(', ')}`, 'withdrawn veto');
  }
  Object.assign(d, { status: 'closed', choice, decidedBy: actor, decidedDay: state.day, consequence });
  return d;
};

// An officer's position on a vetoable decision, from the blockers their own check found.
export const position = (blockers, note = 'no objection') => blockers.length ? { stance: 'veto', reason: blockers.join('; ') } : { stance: 'approve', reason: note };

// Launch tiers (§3.3). The crew tier is a durable rule; no v1 vehicle carries crew, so it is inactive.
export const LAUNCH_TIERS = [
  { tier: 'ground-technical', who: ['technical-director', 'assurance'], can: 'block for technical reasons', cannot: 'override crew' },
  { tier: 'ground-operational', who: ['flight-control'], can: 'hold, scrub, range-safety destruct', cannot: 'compel a crew to continue' },
  { tier: 'ground-executive', who: ['administrator', 'financial-officer'], can: 'decide mission scope and resources', cannot: 'override a safety decision' },
  { tier: 'flight', who: ['crew'], can: 'abort unilaterally where supported', cannot: 'be overridden by ground authority' },
];
