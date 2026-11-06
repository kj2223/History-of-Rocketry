// Missions, mission scope and demonstrated capabilities (V2 freeze §4, §5; GAME-DESIGN §12.1).
// A launch carries a planned mission. In flight, a crew's view on cutting or continuing it is advice:
// Flight Control decides within the options its teams can support, and where there is time and more than
// one supportable option the administrator decides. What a flight demonstrates is recorded with its
// configuration, conditions and unresolved issues, and never certifies other hardware.
// Reads observations only. Crew advice draws from the crew stream.

import { MISSIONS, MISSION_LADDER, OBJECTIVE_READINGS, FUEL_CELL, SCOPE } from '../data/flight.js';
import { VEHICLES, QUANTITIES } from '../data/vehicles.js';
import { TUNING } from '../data/tuning.js';
import { draw } from '../core/rng.js';
import { Rejection, memo, openDecision, position } from './authority.js';
import { dropObjectives } from './physics.js';
import { capabilityRecorded } from './race.js';

export const initCapabilities = () => [];

const OBJECTIVES = Object.keys(OBJECTIVE_READINGS);

// The planned mission, checked against what the vehicle can do. Missing fields take the planners' first mission.
export const planMission = (vehicle, mission = {}) => {
  const m = MISSIONS[vehicle];
  if (!m) return null;
  const plan = { days: mission.days ?? MISSION_LADDER[vehicle][0].days, ...Object.fromEntries(OBJECTIVES.map(o => [o, !!mission[o]])) };
  if (!(plan.days >= 0 && plan.days <= m.maxDays)) throw new Rejection(`${VEHICLES[vehicle].name} can fly ${m.maxDays ? `up to ${m.maxDays} days` : 'no planned duration'}`);
  const asked = OBJECTIVES.filter(o => plan[o]), cannot = asked.filter(o => !m.objectives.includes(o));
  if (cannot.length) throw new Rejection(`${VEHICLES[vehicle].name} cannot attempt ${cannot.join(', ')}`);
  if (plan.docking && !plan.rendezvous) throw new Rejection('Docking needs a rendezvous first');
  return plan;
};

export const describeMission = (vehicle, plan) => {
  if (!plan) return '';
  const asked = OBJECTIVES.filter(o => plan[o]).map(o => (o === 'eva' ? 'a spacewalk' : o));
  const length = MISSIONS[vehicle].maxDays === 0 ? 'a suborbital flight' : plan.days < 1 ? `${Math.round(plan.days * 16)} orbits` : `${plan.days} days`;
  return `${length}${asked.length ? ` with ${asked.join(' and ')}` : ''}`;
};

// ---- mission scope in flight (§4) ----

const crewAdvice = (state, l) => l.crew.map(id => {
  const p = state.people[id];
  // Bolder crew members advise carrying on; the advice is theirs and binds no one.
  const advice = draw(state.rng.crew) < p.traits.risk ? 'continue' : 'cut-short';
  return { id, name: p.name, advice };
});
const adviceText = advice => advice.map(a => `${a.name} advises ${a.advice === 'continue' ? 'continuing' : 'cutting it short'}`).join('; ');

const scopeRecord = (state, l, { reading, options, owner, advice, text }) => {
  const d = openDecision(state, { type: 'mission-scope', subject: l.id, raisedBy: 'flight-control', vetoable: true, evidence: [reading.id], options,
    text, finance: position([], 'no cost either way'), technical: position([], options.length > 1 ? 'either option is supportable' : 'only this option is supportable'),
    effect: { kind: 'cut-short', payload: { launchId: l.id } } });
  d.positions.crew = { stance: 'advice', reason: adviceText(advice) };
  d.owner = owner;
  (l.scope ??= []).push({ decisionId: d.id, day: state.day, reading: reading.id, advice, owner });
  return d;
};

// Called each day of a crewed flight with its new abnormal readings.
export const scopeInFlight = (state, l, j, abnormal, cutShort) => {
  for (const o of abnormal) {
    if (o.quantity === FUEL_CELL.reading && !l.scope?.some(s => s.reading === o.id) && !l.mission.cut) {
      const advice = crewAdvice(state, l);
      if (o.value < SCOPE.onlyCutShort) {
        // Flight Control's teams cannot support continuing on so little power: Flight Control decides alone.
        const d = scopeRecord(state, l, { reading: o, options: ['cut-short'], owner: 'flight-control', advice,
          text: `${VEHICLES[l.vehicle].name} ${l.articleId}'s fuel cells are down to ${Math.round(o.value * 100)}% of rated power. Flight Control is bringing the crew home early.` });
        Object.assign(d, { status: 'closed', choice: 'cut-short', decidedBy: 'flight-control', decidedDay: state.day, consequence: 'Flight Control cut the mission short; the crew\'s advice is on record.' });
        cutShort(state, { launchId: l.id });
      } else {
        scopeRecord(state, l, { reading: o, options: ['cut-short', 'continue'], owner: 'administrator', advice,
          text: `${VEHICLES[l.vehicle].name} ${l.articleId}'s fuel cells are giving ${Math.round(o.value * 100)}% of rated power, below the normal limit. Flight Control can support bringing the crew home early or flying the planned ${l.mission.days} days on reduced power. The choice is yours. Crew advice: ${adviceText(advice)}.` });
      }
    }
    if (o.quantity === OBJECTIVE_READINGS.eva && !l.scope?.some(s => s.reading === o.id)) {
      // No time for a meeting: Flight Control ends the spacewalk, whatever the crew advises.
      const advice = crewAdvice(state, l);
      const d = scopeRecord(state, l, { reading: o, options: ['end-spacewalk'], owner: 'flight-control', advice,
        text: `The spacewalk on ${VEHICLES[l.vehicle].name} ${l.articleId} is running at ${Math.round(o.value * 100)}% of the safe workload. Flight Control has called the spacewalker back in.` });
      Object.assign(d, { status: 'closed', choice: 'end-spacewalk', decidedBy: 'flight-control', decidedDay: state.day, consequence: 'Flight Control ended the spacewalk early; the crew\'s advice is on record.', effect: { kind: 'none' } });
    }
  }
};

// Cutting a mission short drops the objectives not yet reached; the flight still comes home through its entry.
export const cutShort = (state, { launchId }) => {
  const l = state.launches.find(x => x.id === launchId);
  if (!l || l.status !== 'in-flight') return;
  const j = state.work.find(x => x.id === l.jobId);
  j.samples = dropObjectives(state, j.id, j.read);
  j.total = Math.max(j.cursor + 1, Math.ceil(j.samples / TUNING.samplesPerDay));
  l.mission.cut = { day: state.day };
  memo(state, { from: 'flight-control', refs: { launch: l.id }, text: `${VEHICLES[l.vehicle].name} ${l.articleId} is coming home early. The objectives not yet reached will not be attempted.` });
};

// A scope question still open when the flight ends lapses: the flight decided it.
export const closeScope = (state, l) => {
  for (const d of state.decisions.filter(x => x.type === 'mission-scope' && x.subject === l.id && x.status === 'open'))
    Object.assign(d, { status: 'closed', choice: 'lapsed', decidedBy: 'flight-control', decidedDay: state.day, consequence: 'The flight ended before a choice was made.' });
};

// ---- demonstrated capabilities (§5) ----

const add = (state, l, kind, { status = 'demonstrated', conditions = {}, evidence = [], unresolved = [] } = {}) => {
  const c = { id: `cap-${state.capabilities.length + 1}`, kind, status, vehicle: l.vehicle, stages: { ...l.stages },
    conditions: { crew: l.crew.length, ...conditions }, launchId: l.id, day: state.day, evidence, unresolved };
  state.capabilities.push(c);
  if (status === 'demonstrated') capabilityRecorded(state, c);
  return c;
};

// What a flight that came home demonstrated, from its own readings.
export const recordCapabilities = (state, l, obs) => {
  if (l.outcome === 'failure' || l.outcome === 'crew-abort' || !l.entry?.contact) return [];
  const orbital = VEHICLES[l.vehicle].profile === 'orbital', crewed = l.crew.length > 0, out = [];
  if (orbital && l.entry.capsuleRecovered) out.push(add(state, l, 'orbital-recovery'));
  if (crewed && !orbital) out.push(add(state, l, 'suborbital'));
  if (crewed && orbital) {
    out.push(add(state, l, 'orbit'));
    if (l.crew.length > 1) out.push(add(state, l, 'multi-crew'));
    const days = l.mission.cut ? Math.round(l.mission.days * 5) / 10 : l.mission.days;
    out.push(add(state, l, 'duration', { conditions: { days }, unresolved: l.mission.cut ? ['the mission was cut short'] : [] }));
  }
  for (const [objective, quantity] of Object.entries(OBJECTIVE_READINGS)) {
    const o = obs.find(x => x.quantity === quantity);
    if (!l.mission?.[objective] || !o) continue;
    const ok = o.state === 'measured' && o.normal;
    out.push(add(state, l, objective, { status: ok ? 'demonstrated' : 'attempted', evidence: [o.id],
      unresolved: ok ? [] : [o.state === 'measured' ? `${QUANTITIES[quantity].name.toLowerCase()} was outside normal limits` : `the ${QUANTITIES[quantity].name.toLowerCase()} reading was ${o.state}`] }));
  }
  const fuel = obs.find(x => x.quantity === FUEL_CELL.reading);
  const duration = out.find(c => c.kind === 'duration');
  if (duration && fuel && !(fuel.state === 'measured' && fuel.normal)) { duration.unresolved.push('fuel cell output was outside normal limits'); duration.evidence.push(fuel.id); }
  return out;
};

const sameConfig = (c, { vehicle, stages }) => c.vehicle === vehicle && Object.keys(stages).length === Object.keys(c.stages).length && Object.entries(stages).every(([k, v]) => c.stages[k] === v);

// What the records say about a capability for one configuration (for V3 plans to cite): demonstrated on this
// exact configuration, demonstrated only elsewhere (which never certifies this one), or unproven.
export const cite = (state, kind, config) => {
  const all = state.capabilities.filter(c => c.kind === kind && c.status === 'demonstrated');
  const here = all.filter(c => sameConfig(c, config)), elsewhere = all.filter(c => !sameConfig(c, config));
  return { kind, demonstrated: here.map(c => c.id), elsewhere: elsewhere.map(c => c.id),
    status: here.length ? 'demonstrated' : elsewhere.length ? 'demonstrated on another configuration only' : 'unproven' };
};

// The next mission the planners would propose for a vehicle: the first rung of the ladder not yet demonstrated
// on any configuration of it. Planning reads the whole vehicle's record; the record itself stays per configuration.
export const nextMission = (state, vehicle) => {
  const mine = state.capabilities.filter(c => c.vehicle === vehicle && c.status === 'demonstrated');
  const done = m => (m.days === 0 || mine.some(c => c.kind === 'duration' && c.conditions.days >= m.days && !c.unresolved.length))
    && OBJECTIVES.filter(o => m[o]).every(o => mine.some(c => c.kind === o));
  const ladder = MISSION_LADDER[vehicle] ?? [];
  return ladder.find(m => !done(m)) ?? ladder.at(-1) ?? null;
};
