// Programme flow (freeze §8.1–8.2, §8.5–8.7): three sources, four proposal stages, a greenlight window,
// change control, stop recommendations and closure with named owners.

import { BASELINE } from '../data/vehicles.js';
import { PROGRAMMES } from '../data/scenario.js';
import { TUNING } from '../data/tuning.js';
import { Rejection, memo, openDecision, position } from './authority.js';

const SOURCES = ['objective', 'initiative', 'external'];
const MATERIAL_CHANGES = ['destination', 'funding-ceiling', 'deadline', 'partner-terms'];
const ROUTINE_CHANGES = ['resequence', 'meeting', 'calendar'];

export const CLOSURE_STEPS = [
  { id: 'stop-decision', owner: 'administrator' },
  { id: 'contract-settlements', owner: 'financial-officer' },
  { id: 'hardware-disposition', owner: 'department-head' },
  { id: 'facility-release', owner: 'technical-director' },
  { id: 'records', owner: 'archivist' },
  { id: 'staff-reassignment', owner: 'department-head' },
  { id: 'closure-report', owner: 'project-manager' },
];

export const programme = (state, id) => state.programmes[id] ?? (() => { throw new Rejection(`No programme ${id}`); })();

const log = (p, day, event) => p.history.push({ day, event });

export const createProgramme = (state, { id, name, vehicle = null, source, client = null, stage = 'feasibility' }) => {
  if (!SOURCES.includes(source)) throw new Rejection(`Unknown programme source ${source}`);
  if (state.programmes[id]) throw new Rejection(`Programme ${id} already exists`);
  const p = { id, name, vehicle, source, client, stage, baseline: vehicle ? { ...BASELINE[vehicle] } : null,
    cases: { engineering: null, funding: null }, meeting: null, window: null, changes: [], closure: null, history: [] };
  log(p, state.day, `proposal from ${source}${client ? ` (${client})` : ''}`);
  state.programmes[id] = p;
  return p;
};

export const initProgrammes = () => ({});

// Proposals arriving on this day.
export const arrivals = state => {
  for (const def of PROGRAMMES.filter(d => d.arrives === state.day && !state.programmes[d.id])) {
    createProgramme(state, def);
    if (def.source === 'external') memo(state, { from: 'administrator-office', text: `${def.client} asks us to consider ${def.name}.`, refs: { programme: def.id } });
  }
};

const need = (p, stage) => { if (p.stage !== stage) throw new Rejection(`${p.id} is at ${p.stage}, not ${stage}`); };

export const authoriseFeasibility = (state, id) => { const p = programme(state, id); need(p, 'feasibility'); p.stage = 'investigation'; log(p, state.day, 'bounded feasibility work authorised'); };

// Stage 2: engineering and funding cases are prepared in parallel.
export const completeCase = (state, id, kind, summary) => {
  const p = programme(state, id); need(p, 'investigation');
  if (!(kind in p.cases)) throw new Rejection(`Unknown case ${kind}`);
  p.cases[kind] = { day: state.day, summary };
};

// Stage 3: informational, no sign-off.
export const recordMeeting = (state, id, { cost, contribution, timeline, requirements }) => {
  const p = programme(state, id); need(p, 'investigation');
  p.meeting = { day: state.day, cost, contribution, timeline, requirements };
};

// Stage 4: the combined dossier goes to a three-way decision on preliminary acceptance.
export const submitDossier = (state, id, { financeBlockers = [], technicalBlockers = [] } = {}) => {
  const p = programme(state, id); need(p, 'investigation');
  if (!p.cases.engineering || !p.cases.funding || !p.meeting) throw new Rejection('The dossier needs both cases and the client meeting');
  p.stage = 'dossier';
  return openDecision(state, { type: 'preliminary-acceptance', subject: id, raisedBy: 'project-manager', vetoable: true,
    text: `${p.name}: we think it is possible; begin the work needed to decide? Engineering: ${p.cases.engineering.summary} Funding: ${p.cases.funding.summary}`, evidence: [],
    finance: position(financeBlockers), technical: position(technicalBlockers), effect: { kind: 'preliminary-accept', payload: { id } } }).id;
};

export const preliminaryAccept = (state, { id }) => {
  const p = programme(state, id);
  p.stage = 'preliminary';
  p.window = { opens: state.day, closes: state.day + TUNING.greenlightWindowDays, extensions: [] };
  log(p, state.day, 'preliminary acceptance');
};

export const extendWindow = (state, id, { question, resources, days }) => {
  const p = programme(state, id); need(p, 'preliminary');
  if (!question || !resources) throw new Rejection('An extension needs a stated question and resources');
  p.window.closes += days;
  p.window.extensions.push({ day: state.day, question, resources, days });
};

export const requestGreenlight = (state, id, { financeBlockers = [], technicalBlockers = [] } = {}) => {
  const p = programme(state, id); need(p, 'preliminary');
  return openDecision(state, { type: 'greenlight', subject: id, raisedBy: 'project-manager', vetoable: true,
    text: `Greenlight ${p.name} as a programme? This is not launch clearance.`,
    finance: position(financeBlockers), technical: position(technicalBlockers), effect: { kind: 'greenlight', payload: { id } } }).id;
};

export const greenlight = (state, { id }) => {
  const p = programme(state, id);
  if (p.stage !== 'preliminary' || state.day > p.window.closes) throw new Rejection(`${id} has no open greenlight window`);
  p.stage = 'greenlit';
  log(p, state.day, 'programme greenlight');
  // A programme with no vehicle yet starts its design work now; the vehicle arrives when that is done.
  const design = PROGRAMMES.find(d => d.id === id)?.design;
  if (!p.vehicle && design) { p.designReady = state.day + TUNING.designDays[design]; log(p, state.day, 'design work begins'); }
};

// Design work finishing: the programme gets its vehicle and baseline, and the teams can build, test and fly it.
export const designsReady = state => {
  for (const p of Object.values(state.programmes).filter(x => !x.vehicle && x.designReady === state.day)) {
    const design = PROGRAMMES.find(d => d.id === p.id).design;
    Object.assign(p, { vehicle: design, baseline: { ...BASELINE[design] } });
    log(p, state.day, 'first vehicles delivered');
    memo(state, { from: 'technical-director', text: `The first ${p.name} vehicles are delivered. Nothing has been fired or flown on this design yet, so we know nothing for certain about it; the team will propose its first stand firing.`, refs: { programme: p.id } });
  }
};

// Windows that pass without greenlight lapse visibly.
export const lapseWindows = state => {
  for (const p of Object.values(state.programmes).filter(x => x.stage === 'preliminary' && state.day > x.window.closes)) {
    p.stage = 'lapsed';
    memo(state, { from: 'project-manager', kind: 'warning', text: `${p.name}'s greenlight window closed without a decision.`, refs: { programme: p.id } });
  }
};

// Change control (§8.5). Routine changes stay with the project manager; material ones go to review.
export const requestChange = (state, id, { kind, detail, external = false, providerAgreed = false }) => {
  const p = programme(state, id);
  if (ROUTINE_CHANGES.includes(kind)) { p.changes.push({ day: state.day, kind, detail, routine: true }); return { applied: true }; }
  if (!MATERIAL_CHANGES.includes(kind)) throw new Rejection(`Unknown change ${kind}`);
  if (external && !providerAgreed) throw new Rejection('This change affects an external commitment and needs the provider\'s agreement', 'provider agreement');
  return { decision: openDecision(state, { type: 'material-change', subject: id, raisedBy: 'project-manager', vetoable: true,
    text: `Material change to ${p.name} (${kind.replace(/-/g, ' ')}): ${detail}`, finance: position([]), technical: position([]),
    effect: { kind: 'apply-change', payload: { id, kind, detail } } }).id };
};

export const applyChange = (state, { id, kind, detail }) => programme(state, id).changes.push({ day: state.day, kind, detail, routine: false });

// Stop recommendations (§8.6) are discussed; the administrator may ask for one more bounded attempt.
export const recommendStop = (state, id, by, reason) => openDecision(state, { type: 'stop', subject: id, raisedBy: by,
  text: `The ${by.replace(/-/g, ' ')} recommends stopping ${programme(state, id).name}: ${reason}`, options: ['stop', 'further-attempt'], effect: { kind: 'stop', payload: { id } } }).id;

// Closure (§8.7). Obligations are gathered from the ledger, stock and facilities so none is forgotten.
export const beginClosure = (state, { id }) => {
  const p = programme(state, id);
  const obligations = [
    ...state.fiscal.ledger.filter(e => e.programmeId === id && (e.status === 'open' || e.status === 'overdue')).map(e => ({ id: e.id, kind: 'payment', amount: e.amount })),
    ...Object.values(state.stock.items).filter(it => it.reserved[id]).map(it => ({ id: it.id, kind: 'stock-reservation', amount: it.reserved[id] })),
    ...state.facilities.reservations.filter(r => r.programmeId === id && r.status === 'held').map(r => ({ id: r.id, kind: 'facility-reservation' })),
  ].map(o => ({ ...o, owner: null, funded: false, status: 'open' }));
  p.stage = 'closing';
  p.closure = { begun: state.day, steps: CLOSURE_STEPS.map(s => ({ ...s, done: s.id === 'stop-decision', output: s.id === 'stop-decision' ? 'proceed' : null })), obligations };
  log(p, state.day, 'stop decision: closure begun');
};

export const completeClosureStep = (state, id, stepId, actor, output) => {
  const p = programme(state, id); need(p, 'closing');
  const step = p.closure.steps.find(s => s.id === stepId);
  if (!step) throw new Rejection(`Unknown closure step ${stepId}`);
  if (actor !== step.owner) throw new Rejection(`${stepId} belongs to ${step.owner}`, step.owner);
  Object.assign(step, { done: true, output });
  return closeIfResolved(state, id);
};

// Give an obligation an owner and funding, or record it as transferred or discharged.
export const resolveObligation = (state, id, obligationId, { owner = null, funded = false, status = 'open' }) => {
  const o = programme(state, id).closure.obligations.find(x => x.id === obligationId);
  if (!o) throw new Rejection(`No obligation ${obligationId}`);
  Object.assign(o, { owner, funded, status });
  return closeIfResolved(state, id);
};

export const unresolved = p => p.closure.obligations.filter(o => !(o.status === 'transferred' || o.status === 'discharged' || (o.owner && o.funded)));

const closeIfResolved = (state, id) => {
  const p = programme(state, id);
  if (p.closure.steps.every(s => s.done) && !unresolved(p).length) { p.stage = 'closed'; log(p, state.day, 'closed'); }
  return p.stage;
};
