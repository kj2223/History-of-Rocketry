// Crew (V2 freeze §4, §5, §7). Selection from candidates with records, mission-specific training, the
// readiness decision for crewed use, consent to launch and the binding crew abort.
// Crew traits are hidden. A crew member's consent and abort come from their own reading of what they have
// been shown, coloured by their traits, and draw only from the crew stream. Nothing here reads hidden truth.

import { CANDIDATES, SELECTIONS, TRAINING, ESCAPE } from '../data/crew.js';
import { VEHICLES, QUANTITIES } from '../data/vehicles.js';
import { TUNING } from '../data/tuning.js';
import { draw } from '../core/rng.js';
import { Rejection, memo, openDecision, position } from './authority.js';
import { addPerson } from './people.js';
import { readiness } from './belief.js';

export const initCrew = () => ({ readiness: [] });

const people = (state, kind) => Object.values(state.people).filter(p => p.kind === kind);
export const crewMembers = state => people(state, 'crew');
const person = (state, id) => state.people[id] ?? (() => { throw new Rejection(`No person ${id}`); })();
const names = (state, ids) => ids.map(id => state.people[id]?.name ?? id).join(' and ');

// ---- selection (§7) ----

// The board's slate: medically eligible test pilots first, then by flight hours. It reads records only.
export const boardSlate = group => CANDIDATES.filter(x => x.group === group.id && x.medical === 'eligible')
  .sort((a, b) => Number(b.record.testPilot) - Number(a.record.testPilot) || b.record.flightHours - a.record.flightHours)
  .slice(0, group.picks).map(x => x.id);

const describeCandidate = x => `${x.name} (${x.record.service}, ${x.record.flightHours} hours, ${x.record.education}${x.medical !== 'eligible' ? `, medical: ${x.medical}` : ''})`;

// When a selection board sits, it recommends a slate for the administrator's decision.
export const crewDay = state => {
  for (const g of SELECTIONS.filter(x => x.day === state.day)) {
    const slate = boardSlate(g);
    openDecision(state, { type: 'crew-selection', subject: g.id, raisedBy: 'department-head',
      text: `The selection board has interviewed the ${g.for} candidates and recommends ${slate.length}: ${slate.map(id => describeCandidate(CANDIDATES.find(x => x.id === id))).join('; ')}. `
        + `Other applicants: ${CANDIDATES.filter(x => x.group === g.id && !slate.includes(x.id)).map(describeCandidate).join('; ')}. `
        + 'Approve the slate, or choose your own from the records.',
      effect: { kind: 'select-crew', payload: { group: g.id, ids: slate } } });
  }
};

export const selectCrew = (state, { group, ids }) => {
  const g = SELECTIONS.find(x => x.id === group);
  if (!g) throw new Rejection(`No selection ${group}`);
  if (state.day < g.day) throw new Rejection(`The ${g.for} selection board has not sat yet`);
  if (crewMembers(state).some(p => p.group === group)) throw new Rejection(`The ${g.for} group has already been selected`);
  if (!ids.length || ids.length > g.picks) throw new Rejection(`Choose between 1 and ${g.picks} candidates`);
  for (const id of ids) {
    const x = CANDIDATES.find(c => c.id === id && c.group === group);
    if (!x) throw new Rejection(`${id} did not apply to the ${g.for} group`);
    if (x.medical !== 'eligible') throw new Rejection(`${x.name} is not medically eligible (${x.medical})`);
  }
  for (const id of ids) {
    const x = CANDIDATES.find(c => c.id === id);
    const p = addPerson(state, { id, name: x.name, role: 'astronaut', kind: 'crew', traits: x.traits });
    Object.assign(p, { group });
    Object.assign(p.record, { background: structuredClone(x.record) });
    p.record.history.push({ day: state.day, event: `selected for the ${g.for} group` });
  }
  const d = state.decisions.find(x => x.type === 'crew-selection' && x.subject === group && x.status === 'open');
  if (d) Object.assign(d, { status: 'closed', choice: 'reject', decidedBy: 'administrator', decidedDay: state.day, consequence: 'the administrator chose the group from the records' });
  memo(state, { from: 'department-head', text: `${names(state, ids)} join the agency as astronauts. Training for a particular spacecraft starts when a programme needs them.` });
};

// ---- training (§7) ----

const teamOf = ids => [...ids].sort().join('+');
const trainedIn = (p, vehicle, item, team) => p.record.training.some(t => t.vehicle === vehicle && t.item === item && (item !== 'teamwork' || t.with === team));

// Qualified for this vehicle as this crew: every item done, medically eligible and available. Experience on
// another spacecraft does not count.
export const qualified = (state, vehicle, ids) => {
  const t = TRAINING[vehicle];
  if (!t) return [`${VEHICLES[vehicle].name} carries no crew`];
  if (ids.length !== t.crew) return [`${VEHICLES[vehicle].name} needs a crew of ${t.crew}`];
  const out = [];
  for (const id of ids) {
    const p = state.people[id];
    if (!p || p.kind !== 'crew') { out.push(`${id} is not an astronaut`); continue; }
    if (p.record.medical.status !== 'eligible') out.push(`${p.name} is medically ${p.record.medical.status}`);
    if (p.record.availability !== 'available') out.push(`${p.name} is ${p.record.availability}`);
    const missing = t.items.filter(i => !trainedIn(p, vehicle, i, teamOf(ids)));
    if (missing.length) out.push(`${p.name} has not trained in ${missing.join(', ')} for ${VEHICLES[vehicle].name}${missing.includes('teamwork') ? ' with this crew' : ''}`);
  }
  return out;
};

export const trainingDays = vehicle => TRAINING[vehicle].items.length * TUNING.trainingDaysPerItem;

export const checkTraining = (state, { vehicle, crew }) => {
  if (!TRAINING[vehicle]) throw new Rejection(`${VEHICLES[vehicle]?.name ?? vehicle} carries no crew`);
  if (crew.length !== TRAINING[vehicle].crew) throw new Rejection(`${VEHICLES[vehicle].name} trains a crew of ${TRAINING[vehicle].crew}`);
  for (const id of crew) {
    const p = person(state, id);
    if (p.kind !== 'crew') throw new Rejection(`${p.name} is not an astronaut`);
    if (p.record.availability !== 'available') throw new Rejection(`${p.name} is ${p.record.availability}`);
  }
};

export const startTraining = (state, { crew }) => { for (const id of crew) state.people[id].record.availability = 'in training'; };

export const finishTraining = (state, { vehicle, crew }) => {
  for (const id of crew) {
    const p = state.people[id];
    for (const item of TRAINING[vehicle].items) if (!trainedIn(p, vehicle, item, teamOf(crew))) p.record.training.push({ vehicle, item, with: item === 'teamwork' ? teamOf(crew) : null, day: state.day });
    p.record.availability = 'available';
  }
};

// ---- readiness for crewed use (§5) ----

// A readiness decision is for one configuration and crewed use. No flight count or button grants it.
export const configKey = (vehicle, stages) => `${vehicle}:${Object.keys(stages).sort().map(k => stages[k]).join('+')}`;
export const crewReady = (state, vehicle, stages) => state.crew.readiness.find(r => r.key === configKey(vehicle, stages)) ?? null;

export const requestCrewReadiness = (state, { programmeId }) => {
  const p = state.programmes[programmeId];
  if (!p?.vehicle || !VEHICLES[p.vehicle].crewed) throw new Rejection(`${programmeId} has no crewed vehicle`);
  if (crewReady(state, p.vehicle, p.baseline)) throw new Rejection(`${VEHICLES[p.vehicle].name} in this configuration is already ready for crew`);
  const key = configKey(p.vehicle, p.baseline);
  if (state.decisions.some(d => d.type === 'crew-readiness' && d.subject === key && d.status === 'open')) throw new Rejection('That readiness decision is already waiting for you');
  const r = readiness(state, 'crewed-flight', { vehicle: p.vehicle, stages: p.baseline });
  return openDecision(state, { type: 'crew-readiness', subject: key, raisedBy: 'technical-director', vetoable: true,
    text: `Declare ${VEHICLES[p.vehicle].name} in its current configuration ready for crewed flight? This covers this configuration only: a changed stage needs its own decision.`,
    finance: position([]), technical: position(r.blockers, 'the evidence supports crewed use of this configuration'),
    effect: { kind: 'crew-ready', payload: { key, vehicle: p.vehicle, stages: { ...p.baseline } } } }).id;
};

export const declareReady = (state, { key, vehicle, stages }) => {
  state.crew.readiness.push({ key, vehicle, stages, day: state.day });
  memo(state, { from: 'technical-director', text: `${VEHICLES[vehicle].name} in this configuration is ready for crewed flight. A crew still has to train for it and consent to each flight.` });
};

// ---- consent (§4) ----

// What a crew member is shown before a flight: the technical director's readiness check (its blockers and
// known gaps) and the vehicle's recent flights. Their reading is their own: risk tolerance sets how much they will accept, independence
// how far they weigh their own view against the technical director's, and their own flights steady them.
export const reading = (state, p, { tech, vehicle }) => {
  const gaps = tech.blockers.length * TUNING.crewConcern.blockerWeight + tech.gaps.length;
  const recent = state.launches.filter(l => l.vehicle === vehicle && l.status === 'flown').slice(-TUNING.crewRecentFlights);
  const failures = recent.filter(l => l.outcome === 'failure').length;
  const concern = TUNING.crewConcern.gap * gaps + TUNING.crewConcern.failure * failures - TUNING.crewConcern.experience * p.record.flights.length;
  const weighed = concern * (0.5 + p.traits.independence) + TUNING.crewConcern.noise * (draw(state.rng.crew) - 0.5);
  return { gaps, failures, concern: weighed, consent: weighed <= p.traits.risk * TUNING.crewConcern.tolerance };
};

export const consentTier = (state, launch, ids, tech) => {
  const answers = ids.map(id => {
    const p = state.people[id], r = reading(state, p, { tech, vehicle: launch.vehicle });
    const entry = { launchId: launch.id, day: state.day, consent: r.consent,
      evidence: { blockers: [...tech.blockers], gaps: [...tech.gaps], recentFailures: r.failures }, consequence: r.consent ? 'consented' : 'the launch cannot go without consent' };
    p.record.consents.push(entry);
    return { id, name: p.name, consent: r.consent };
  });
  const refused = answers.filter(a => !a.consent);
  return refused.length ? { stance: 'veto', reason: `${refused.map(a => a.name).join(' and ')} will not fly on this evidence` }
    : { stance: 'approve', reason: `${answers.map(a => a.name).join(' and ')} consent${answers.length === 1 ? 's' : ''}` };
};

// ---- the binding crew abort (§4) ----

export const escapeMode = (launch, job) => (job.read <= 1 ? ESCAPE[launch.vehicle].launch : ESCAPE[launch.vehicle].later);

// Whether a crew member calls an abort when they see an abnormal reading in flight. Their own call.
export const abortCall = (state, p, abnormal) =>
  draw(state.rng.crew) < TUNING.abortOnAbnormal * (1 - p.traits.risk) * (0.5 + p.traits.independence) * Math.min(1, abnormal.length);

export const describeAbnormal = obs => obs.map(o => QUANTITIES[o.quantity].name.toLowerCase()).join(', ');
