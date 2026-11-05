// Fiscal layers (freeze §7). Quarterly capacity limits payments, not commitments; commitments sit in a
// forward ledger with due dates. Finance protects payments due before the next confirmed release.

import { fiscalQuarter, fiscalYearEnd } from '../core/calendar.js';
import { TUNING } from '../data/tuning.js';
import { AWARD_CONDITIONS } from '../data/scenario.js';
import { Rejection, openDecision, memo, position } from './authority.js';
import { receive } from './stock.js';

export const initFiscal = day => {
  const fy = fiscalQuarter(day).fy;
  return { fy, award: TUNING.awards[fy], released: 0, retained: 0, paidFY: 0, cash: 0, multiYearAuthority: false,
    ledger: [], commitments: {}, exposures: [], retentions: [], flagged: [], conditions: [] };
};

// Quarterly capacity carries forward within the year: released so far plus retention, less payments.
export const capacityRemaining = state => { const f = state.fiscal; return f.released + f.retained - f.paidFY; };

// Releases come at quarter starts, so the next confirmed release is the day after this quarter ends.
const protectionEnd = state => fiscalQuarter(state.day).end + 1;

const isOpen = e => e.status === 'open' || e.status === 'overdue';

export const protectedBaseline = state => state.fiscal.ledger.filter(e => isOpen(e) && e.due < protectionEnd(state)).reduce((a, e) => a + e.amount, 0);

export const available = state => capacityRemaining(state) - protectedBaseline(state);

const release = (state, amount, why) => {
  const f = state.fiscal;
  f.released += amount;
  f.cash += amount;
  return { amount, why };
};

const addEntry = (state, entry) => {
  const e = { id: `ledger-${state.fiscal.ledger.length + 1}`, status: 'open', paidDay: null, ...entry };
  state.fiscal.ledger.push(e);
  return e;
};

// Start-of-quarter work: the release and the quarter's operating costs.
export const startQuarter = state => {
  const { end } = fiscalQuarter(state.day);
  release(state, state.fiscal.award / 4, 'quarterly release');
  addEntry(state, { kind: 'operations', dept: 'administration', programmeId: null, commitmentId: null, amount: TUNING.operatingCostPerQuarter, due: end });
};

// Pay what is due, within capacity. A payment that cannot be made is escalated once, never silently skipped.
export const payDue = state => {
  const f = state.fiscal;
  for (const e of f.ledger.filter(x => isOpen(x) && x.due <= state.day).sort((a, b) => a.due - b.due)) {
    if (e.amount <= capacityRemaining(state)) {
      Object.assign(e, { status: 'paid', paidDay: state.day });
      f.paidFY += e.amount;
      f.cash -= e.amount;
      if (e.delivers) receive(state, e.delivers, { programmeId: e.programmeId, commitmentId: e.commitmentId, ledgerId: e.id });
    } else if (e.status === 'open') {
      e.status = 'overdue';
      openDecision(state, { type: 'payment-shortfall', subject: e.id, raisedBy: 'financial-officer',
        text: `A payment of ${e.amount} is due but this quarter's capacity is spent.`, options: ['seek-supplementary', 'defer'], evidence: [e.id], effect: { kind: 'none' } });
    }
  }
};

export const assessCommitment = (state, req) => {
  const f = state.fiscal;
  const total = req.payments.reduce((a, p) => a + p.amount, 0);
  const blockers = total > f.award && !f.multiYearAuthority ? ['exceeds the annual award without multi-year authority'] : [];
  const futureYear = req.payments.some(p => p.due > fiscalYearEnd(f.fy));
  return { total, blockers, futureYear, needsDecision: total >= TUNING.consequentialCommitment || futureYear };
};

// Enter a commitment. Consequential or future-year commitments go to a joint decision first, where finance
// confirms the exposure is presented to the administrator.
export const commit = (state, req, { approved = false } = {}) => {
  const a = assessCommitment(state, req);
  if (a.blockers.length) throw new Rejection(`Finance cannot commit: ${a.blockers.join('; ')}`);
  if (state.fiscal.commitments[req.id]) throw new Rejection(`Commitment ${req.id} already exists`);
  if (a.needsDecision && !approved) {
    const d = openDecision(state, { type: 'funding-commitment', subject: req.id, raisedBy: req.dept, vetoable: true,
      text: `${req.dept} asks to commit ${a.total}${a.futureYear ? ', with payments in a future year' : ''}.`,
      finance: position([], a.futureYear ? 'future-year exposure presented to the administrator' : 'affordable within the award'),
      technical: position([]), effect: { kind: 'commit', payload: req } });
    return { decision: d.id };
  }
  state.fiscal.commitments[req.id] = { id: req.id, dept: req.dept, programmeId: req.programmeId ?? null, total: a.total,
    terms: req.terms ?? { cancellable: true, cancelFee: 0 }, status: 'active', workId: req.workId ?? null,
    entries: req.payments.map(p => addEntry(state, { kind: req.kind ?? 'contract', dept: req.dept, programmeId: req.programmeId ?? null, commitmentId: req.id, amount: p.amount, due: p.due, delivers: p.delivers ?? null }).id) };
  checkTimingConflicts(state);
  return { committed: req.id };
};

// Finance flags any quarter this year where payments due would exceed forecast capacity.
export const checkTimingConflicts = state => {
  const f = state.fiscal;
  const here = fiscalQuarter(state.day);
  let capacity = capacityRemaining(state);
  for (let q = here.q, day = here.start; q <= 4; q++) {
    const quarter = fiscalQuarter(day);
    if (q > here.q) capacity += f.award / 4;
    const due = f.ledger.filter(e => isOpen(e) && e.due <= quarter.end).reduce((a, e) => a + e.amount, 0);
    const key = `${f.fy}-q${q}`;
    if (due > capacity && !f.flagged.includes(key)) {
      f.flagged.push(key);
      openDecision(state, { type: 'timing-conflict', subject: key, raisedBy: 'financial-officer',
        text: `Payments due by the end of Q${q} (${due}) exceed forecast capacity (${capacity}).`,
        evidence: f.ledger.filter(e => isOpen(e) && e.due <= quarter.end && e.commitmentId).map(e => e.id),
        options: ['reschedule', 'seek-supplementary', 'accept-risk'], effect: { kind: 'none' } });
    }
    day = quarter.end + 1;
  }
};

// Cancellation stops avoidable payments under the contract terms; paid amounts are not refunded.
export const cancelCommitment = (state, id) => {
  const c = state.fiscal.commitments[id];
  if (!c || c.status !== 'active') throw new Rejection(`No active commitment ${id}`);
  const entries = c.entries.map(eid => state.fiscal.ledger.find(e => e.id === eid));
  const avoidable = entries.filter(e => isOpen(e) && c.terms.cancellable);
  avoidable.forEach(e => { e.status = 'cancelled'; });
  if (c.terms.cancelFee) c.entries.push(addEntry(state, { kind: 'cancellation-fee', dept: c.dept, programmeId: c.programmeId, commitmentId: id, amount: c.terms.cancelFee, due: state.day }).id);
  c.status = 'cancelled';
  return { stopped: avoidable.length, remaining: entries.filter(isOpen).length, paid: entries.filter(e => e.status === 'paid').reduce((a, e) => a + e.amount, 0) };
};

// Recovery exposure (§7.4): stated and recorded, never charged.
export const assessFlight = (state, { cost, replacementCost }) => {
  const left = available(state) - cost;
  return { affordable: left >= 0, lastAttempt: left < replacementCost,
    text: left < 0 ? 'We cannot afford this launch and keep essential operations running.'
      : left < replacementCost ? 'We can afford this launch while keeping essential operations running, but it may be our last attempt this year. If it fails, another flight would need additional funding.'
      : 'We can afford this launch and a replacement if it fails.' };
};

export const recordExposure = (state, launchId, replacementCost, text) =>
  state.fiscal.exposures.push({ launchId, replacementCost, text, status: 'open', day: state.day });

export const resolveExposure = (state, launchId, outcome) => {
  const x = state.fiscal.exposures.find(e => e.launchId === launchId && e.status === 'open');
  if (x) x.status = outcome === 'failure' ? 'realised' : 'lapsed';
};

export const supplementary = (state, amount, why) => { state.fiscal.award += amount; return release(state, amount, why); };

// Year end (§7.5): obligations and stock carry over untouched; retention is negotiated with a case,
// and an economical year does not reduce the next award.
export const closeYear = state => {
  const f = state.fiscal;
  const newFy = f.fy + 1;
  const unspent = Math.max(0, capacityRemaining(state));
  const continuing = f.ledger.filter(e => isOpen(e) && e.commitmentId && e.due <= fiscalYearEnd(newFy)).reduce((a, e) => a + e.amount, 0);
  const savings = Math.max(0, unspent - continuing);
  const granted = Math.min(unspent, continuing + savings * TUNING.retentionShareOfSavings);
  const caseFor = { fy: f.fy, unspent, savings, continuing, delayed: 0, proposedUse: continuing ? 'meet continuing commitments' : 'general programme reserve', granted };
  f.retentions.push(caseFor);
  f.cash -= unspent - granted;
  const condition = AWARD_CONDITIONS[f.fy];
  if (condition) {
    const flown = state.launches.filter(l => l.outcome === 'success' && fiscalQuarter(l.day).fy === f.fy).length;
    f.conditions.push({ fy: f.fy, text: condition.text, honoured: flown >= condition.successfulFlights });
  }
  memo(state, { from: 'financial-officer', kind: 'report', text: `Fiscal ${f.fy} closed. Unspent ${unspent}; retained ${granted}.`, refs: { fy: f.fy } });
  Object.assign(f, { fy: newFy, award: TUNING.awards[newFy] ?? f.award, released: 0, retained: granted, paidFY: 0, flagged: [] });
};
