// NASA formation, reached either way (GAME-DESIGN §3.2, §8.9). Both end in the same shape: the 1945–1958
// sections, NASA's transferred laboratories, the heads as people and the inherited open questions as live items.
//   fresh:     a campaign opened at NASA formation with the standard, authored 1958 agency (data/opening.js).
//   continued: a campaign played from 1945 passes NASA formation and carries everything forward in place.

import { START_DAY } from '../core/calendar.js';
import { newStreams } from '../core/rng.js';
import { HEADS_1958, OBLIGATIONS_1958, DISAGREEMENTS_1958 } from '../data/opening.js';
import { NACA_TRANSFER, STARTING_UNITS_1958 } from '../data/facilities.js';
import { BASELINE } from '../data/vehicles.js';
import { TUNING } from '../data/tuning.js';
import { openDecision } from './authority.js';
import { initFiscal } from './fiscal.js';
import { initPeople, addPerson, transmit } from './people.js';
import { openQuestions } from './summary.js';
import { addV2Mechanisms } from './physics.js';
import { initCrew } from './crew.js';
import { initOperations } from './operations.js';
import { initCapabilities } from './mission.js';
import { initRace } from './race.js';

// ---- inherited open questions as live items ----

// One item per entry of the summary's sixth section. `key` names the live record, so the item's status can
// be read from the records at any time: it is open while the same entry still appears in openQuestions().
export const questionItems = q => [
  ...q.readinessRestrictions.flatMap(r => [
    ...r.restrictions.map(text => ({ key: `restriction:${r.programmeId}:${text}`, kind: 'restriction', owner: 'technical-director', refs: { programme: r.programmeId }, text })),
    ...r.assurance.map(a => ({ key: `assurance:${a.id}`, kind: 'restriction', owner: 'assurance', refs: { programme: r.programmeId }, text: `assurance restriction on ${a.quantity}` })),
  ]),
  ...q.unsettledObligations.map(o => ({ key: `obligation:${o.id}`, kind: 'obligation', owner: o.owner, refs: { programme: o.programmeId, ledger: o.id }, text: `${o.text ?? o.kind.replace(/-/g, ' ')} (${o.status})`, amount: o.amount, due: o.due })),
  ...q.disagreements.map(d => ({ key: `disagreement:${d.decisionId}`, kind: 'disagreement', owner: 'administrator', refs: { decision: d.decisionId }, text: d.text })),
  ...q.untestedClaims.map(c => ({ key: `claim:${c.programmeId}:${c.quantity}`, kind: 'untested-claim', owner: 'technical-director', refs: { programme: c.programmeId }, text: `${c.quantity} is ${c.status}` })),
];

const inherit = (state, questions, from) => {
  state.inherited = questionItems(questions).map((item, i) => ({ id: `inherited-${i + 1}`, from, day: state.day, ...item }));
};

// Whether each inherited item is still open, read from the records now.
export const inheritedStatus = state => {
  const live = new Set(questionItems(openQuestions(state)).map(i => i.key));
  return (state.inherited ?? []).map(i => ({ ...i, status: live.has(i.key) ? 'open' : 'closed' }));
};

// ---- what arrives with NASA ----

// The empty shapes a campaign carries from 1945, so every system can run before NASA exists.
export const initNasaShapes = state => {
  state.people = initPeople();
  state.military = { flights: [] };
  state.crew = initCrew();
  state.operations = { retrofireChecking: 'single' };
  state.capabilities = initCapabilities();
  state.race = initRace();
  state.inherited = [];
  state.opening = { kind: '1945', day: state.day };
};

const nasaSections = state => {
  for (const u of NACA_TRANSFER) state.facilities.units[u.id] ??= { ...u, status: 'operational' };
  addV2Mechanisms(state);
  // Revisions that are a V2 vehicle's baseline exist from the start, even where they descend from a military one.
  for (const rev of Object.values(BASELINE).flatMap(b => Object.values(b))) state.hardware.revisions[rev] ??= { id: rev, status: 'defined', trial: false, adoptedFor: ['baseline'] };
  state.military = { flights: [] };
  state.crew = initCrew();
  initOperations(state);
  state.capabilities = initCapabilities();
  state.race = initRace();
  state.concluded = false;
};

// ---- fresh start ----

export const openFresh = (state, seed) => {
  state.day = START_DAY;
  state.rng = newStreams(seed);
  state.fiscal = initFiscal(START_DAY);
  state.facilities.units = Object.fromEntries(STARTING_UNITS_1958.map(u => [u.id, { ...u, status: 'operational' }]));
  state.people = initPeople();
  for (const h of HEADS_1958) addPerson(state, { ...h, kind: 'head' });
  for (const o of OBLIGATIONS_1958) state.fiscal.ledger.push({ id: `ledger-${state.fiscal.ledger.length + 1}`, status: 'open', paidDay: null, commitmentId: null, ...o });
  for (const d of DISAGREEMENTS_1958) openDecision(state, { ...d, vetoable: true, effect: { kind: 'none' } });
  nasaSections(state);
  state.opening = { kind: 'fresh', day: state.day, summary: null };
  inherit(state, openQuestions(state), 'standard-1958');
  return state;
};

// ---- a campaign played from 1945 reaches NASA formation ----

// Hidden traits for the heads, inferred from what the administrator rewarded since 1945 (Provisional mechanics),
// using the culture-transmission rule from a neutral start. Each kind of act counts at most
// TUNING.importSignalCap times.
const v1Signals = v1 => {
  const capped = (n, sign) => Math.min(n, TUNING.importSignalCap) * sign;
  const closed = type => v1.decisions.filter(d => d.type === type && d.status === 'closed');
  const accepted = closed('failure-review').filter(d => d.choice === 'accept-known-risk').length;
  const grounded = closed('failure-review').filter(d => d.choice === 'ground').length;
  const experimental = v1.launches.filter(l => l.experimental && l.status === 'flown').length;
  const challenges = v1.assurance?.challenges ?? [];
  const heard = challenges.filter(c => c.status === 'upheld').length, unheard = challenges.filter(c => c.status !== 'upheld').length;
  // A veto that stood: the decision closed on another option while that officer's veto was on it.
  const stood = who => v1.decisions.filter(d => d.status === 'closed' && d.vetoable && d.positions?.[who]?.stance === 'veto' && d.choice !== d.options[0]).length;
  const proposals = v1.staff?.proposals ?? [];
  const approved = proposals.filter(p => p.status === 'approved').length, declined = proposals.filter(p => p.status === 'declined').length;
  const delegated = Object.values(v1.delegation?.programmes ?? {}).filter(d => d.active).length;
  const shared = { risk: capped(accepted, 1) + capped(grounded, -1), candour: capped(heard, 1) + capped(unheard, -1) };
  return {
    'technical-director': { risk: shared.risk + capped(experimental, 0.5), candour: shared.candour + capped(stood('technical'), 1), independence: 0 },
    'financial-officer': { risk: shared.risk, candour: shared.candour + capped(stood('finance'), 1), independence: 0 },
    'department-head': { risk: shared.risk, candour: shared.candour, independence: capped(approved, 0.5) + capped(declined, -0.5) + capped(delegated, 1) },
  };
};

export const inferTraits = v1 => {
  const out = {};
  for (const [role, signals] of Object.entries(v1Signals(v1))) {
    const p = { traits: { risk: 0.5, candour: 0.5, independence: 0.5 } };
    for (const [trait, signal] of Object.entries(signals)) transmit(p, trait, signal);
    out[role] = p.traits;
  }
  return out;
};

// In place, on the day of NASA formation: the heads get their traits, NASA's laboratories and people arrive,
// and the milestone summary's open questions become live items. Nothing already recorded changes.
export const passNasaFormation = (state, summary) => {
  const traits = inferTraits(state);
  const named = role => state.delegation.appointments.find(a => a.status === 'active' && a.role === role)?.person;
  for (const h of HEADS_1958) addPerson(state, { ...h, name: named(h.role) ?? h.name, kind: 'head', traits: traits[h.role] });
  nasaSections(state);
  state.opening = { kind: 'continued', day: state.day, summary };
  inherit(state, summary.sections.find(s => s.id === 'open-questions').items, 'nasa-formation');
  return state;
};
