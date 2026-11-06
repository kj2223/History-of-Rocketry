// Staff at work from 1 January 1945 (freeze §2.2, §3.2, §5.1, §8.2–8.4). Each day the heads and teams
// look at their own programmes and do what their remit covers: they propose the next piece of work,
// file their feasibility cases, take client meetings, raise dossiers and greenlight requests, and report.
// Before delegation opens (the WAC act is "direct") a team proposes and waits for the administrator's
// go-ahead; once a programme is delegated (§8.3) the team schedules its routine work itself and reports.
// Teams reason only from claims and beliefs, never from hidden truth, and draw no random numbers.
// Staff act through the same commands as the player: the façade passes `run(state, type, actor, payload)`.

import { dateLabel, dateOf, fiscalQuarter } from '../core/calendar.js';
import { FLIGHT_CONDITIONS, ANOMALIES, HYPOTHESES } from '../data/engineering.js';
import { PROGRAMMES } from '../data/scenario.js';
import { TUNING } from '../data/tuning.js';
import { QUANTITIES, REVISIONS, STAGES, VEHICLES, VEHICLE_QUANTITIES, lineage, testFacility } from '../data/vehicles.js';
import { QUANTITIES, REVISIONS, STAGES, VEHICLES, VEHICLE_QUANTITIES, testFacility, lineage } from '../data/vehicles.js';
import { MISSIONS, MISSION_LADDER } from '../data/flight.js';
import { nextMission } from './mission.js';
import { FACILITY_KINDS } from '../data/facilities.js';
import { Rejection, memo } from './authority.js';
import { claimStatus } from './evidence.js';
import { openHypotheses, readiness } from './belief.js';
import { holders } from './facilities.js';
import { available, capacityRemaining, protectedBaseline } from './fiscal.js';
import { isDelegated } from './delegation.js';
import { money, programmeName } from './reports.js';
import { crewMembers, crewReady, qualified } from './crew.js';
import { TRAINING } from '../data/crew.js';

export const initStaff = () => ({ proposals: [], next: 1, snooze: {}, noted: {}, raised: {} });
// Saves made before staff existed load without this section; the staff start work on the next day.
const staffOf = state => (state.staff ??= initStaff());

const list = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const qname = q => QUANTITIES[q].name.toLowerCase();
const team = p => `The ${p.name} team`;

// ---- what a team would do next on a greenlit programme ----

const stageQuantities = (p, stage) => VEHICLE_QUANTITIES[p.vehicle].filter(q => q.startsWith(`${stage}.`) && !QUANTITIES[q].flightOnly);
const anomalyOn = (state, p, stage) => Object.values(state.beliefs.anomalies).find(a => ANOMALIES[a.id].stage === stage && (!ANOMALIES[a.id].vehicles || ANOMALIES[a.id].vehicles.includes(p.vehicle)));
// The corrective revision for the leading explanation, if the team has one it can develop (§5.1).
const remedyFor = (stage, hypothesis) => Object.keys(REVISIONS).find(r => REVISIONS[r].stage === stage && REVISIONS[r].remedies?.includes(hypothesis) && STAGES[stage].developable);
const revsOf = step => step?.revs ?? (step?.rev ? { [step.stage]: step.rev } : {});

// Fixes the agency knows for this vehicle's stages (§5.1): the corrective revision for each stage's leading
// explanation, wherever it was found. A fix proven on one programme is carried to another that uses the stage.
export const knownFixes = (state, p) => VEHICLES[p.vehicle].stages.flatMap(stage => {
  const anomaly = anomalyOn(state, p, stage);
  const hypothesis = anomaly?.status === 'leading' ? openHypotheses(anomaly)[0] : null, rev = hypothesis && remedyFor(stage, hypothesis);
  return rev && !lineage(p.baseline[stage]).includes(rev) ? [{ stage, rev, hypothesis }] : [];
});

// Developing fixes (§5.1–5.2): define each, ground-test each short and long, ask for each trial, then fly them
// together, so a trial is not lost to a fault the agency already knows how to cure, then ask to adopt each.
const fixPlan = (state, p, fixes) => {
  for (const { stage, rev, hypothesis } of fixes) {
    const r = state.hardware.revisions[rev];
    if (!r || r.status === 'proposed') return { kind: 'develop', stage, rev, hypothesis };
    const config = { vehicle: p.vehicle, stages: { ...p.baseline, [stage]: rev } }, qs = stageQuantities(p, stage);
    const bad = qs.filter(q => claimStatus(state, config, q).status === 'adverse');
    if (bad.length) return { kind: 'adverse', stage, quantities: bad, failedFix: rev };
    for (const burn of ['short', 'long']) if (qs.some(q => claimStatus(state, config, q, { burn }).status !== 'measured-normal')) return { kind: 'ground-test', stage, rev, burn, channels: qs, why: 'fix' };
  }
  const revs = Object.fromEntries(fixes.map(f => [f.stage, f.rev])), config = { vehicle: p.vehicle, stages: { ...p.baseline, ...revs } };
  const others = f => Object.fromEntries(fixes.filter(x => x !== f).map(x => [x.stage, x.rev]));
  const untried = fixes.find(f => !state.hardware.revisions[f.rev].trial);
  if (untried) return { kind: 'trial', stage: untried.stage, rev: untried.rev, with: others(untried) };
  const flown = state.launches.some(l => l.programmeId === p.id && l.status === 'flown' && l.outcome === 'success' && Object.entries(revs).every(([st, r]) => l.stages[st] === r));
  if (!flown) {
    const r = readiness(state, 'experimental-flight', config);
    return r.ready ? { kind: 'fly', revs } : { kind: 'adverse', stage: null, quantities: blockedQuantities(r), flight: true };
  }
  // Adopt each in turn, judged with the other fixes that flew with it.
  const [f] = fixes, r = readiness(state, 'experimental-flight', config, f.rev);
  return r.ready ? { kind: 'adopt', stage: f.stage, rev: f.rev, with: others(f) } : { kind: 'adverse', stage: null, quantities: blockedQuantities(r), flight: true };
};

// The next step, from what the team knows: ground-test each stage under flight conditions, then fly.
// A finding outside normal limits sends the team after its cause: a discriminating test while explanations
// compete, then the corrective revision for the leading one. Without a fix the work stops for direction.
export const nextStep = (state, p) => {
  const config = { vehicle: p.vehicle, stages: p.baseline }, fixes = knownFixes(state, p);
  for (const stage of VEHICLES[p.vehicle].stages) {
    const qs = stageQuantities(p, stage);
    if (!qs.length || fixes.some(f => f.stage === stage)) continue;
    const adverse = qs.filter(q => claimStatus(state, config, q).status === 'adverse');
    if (adverse.length) {
      const anomaly = anomalyOn(state, p, stage);
      if (anomaly?.proposedTests?.length) { const t = anomaly.proposedTests[0]; return { kind: 'ground-test', stage, burn: t.conditions.burn, channels: t.channels, why: 'anomaly', anomaly: anomaly.id }; }
      // You accepted the known risk after a failure review: the team may fly this configuration again.
      const assessed = new Set(state.beliefs.assessed ?? []);
      const unassessed = adverse.filter(q => claimStatus(state, config, q).observations.some(id => { const o = state.evidence.observations.find(x => x.id === id); return o.state === 'measured' && !o.normal && !assessed.has(id); }));
      if (!unassessed.length) continue;
      return { kind: 'adverse', stage, quantities: adverse };
    }
    if (qs.every(q => claimStatus(state, config, q, FLIGHT_CONDITIONS).status === 'measured-normal')) continue;
    const started = qs.some(q => claimStatus(state, config, q).status === 'measured-normal');
    return { kind: 'ground-test', stage, burn: started ? 'long' : 'short', channels: qs, why: started ? 'flight-conditions' : 'first' };
  }
  if (fixes.length) return fixPlan(state, p, fixes);
  // A capability finding (a reading only flights take, such as a spacewalk's workload) sends the team after
  // its fix too, but does not stop the flights that build the rest of the record.
  for (const stage of VEHICLES[p.vehicle].stages) {
    for (const a of Object.values(state.beliefs.anomalies).filter(x => ANOMALIES[x.id].stage === stage && QUANTITIES[[ANOMALIES[x.id].trigger].flat()[0]].flightOnly
      && (!ANOMALIES[x.id].vehicles || ANOMALIES[x.id].vehicles.includes(p.vehicle)) && x.status === 'leading')) {
      const leading = openHypotheses(a)[0], rev = remedyFor(stage, leading);
      if (rev && !lineage(p.baseline[stage]).includes(rev)) {
        const step = fixStep(state, p, stage, rev, leading);
        if (step.kind !== 'adverse' && !(step.kind === 'adopt' && blockedElsewhere(state, p, stage, rev))) return step;
      }
    }
  }
  return flyIfReady(state, p, config);
};

// Before asking to fly, the team checks what the technical director will check (§4.4): an open finding the
// administrator has not accepted as a known risk sends it after the cause instead of to the pad.
const VEHICLE_QUANTITIES_ALL = [...new Set(Object.values(VEHICLE_QUANTITIES).flat())];
const blockedQuantities = r => VEHICLE_QUANTITIES_ALL.filter(q => r.blockers.some(b => b.startsWith(`${q} `)));
// Crew for the next crewed flight (V2 freeze §7): qualified and available, least flown first.
const crewFor = (state, vehicle) => {
  const n = TRAINING[vehicle].crew, free = crewMembers(state).filter(c => c.record.availability === 'available' && c.record.medical.status === 'eligible')
    .sort((a, b) => a.record.flights.length - b.record.flights.length || a.id.localeCompare(b.id));
  const crews = n === 1 ? free.map(c => [c.id]) : free.flatMap((c, i) => free.slice(i + 1).map(d => [c.id, d.id]));
  const ready = crews.filter(ids => !qualified(state, vehicle, ids).length);
  const training = state.work.some(j => j.kind === 'crew-training' && j.status === 'running' && j.payload.vehicle === vehicle);
  // Keep a backup crew in training: with fewer than TUNING.crewsPerVehicle qualified crews, train the next.
  const flown = new Set(ready.flat()), untrained = free.filter(c => !flown.has(c.id)).slice(0, n).map(c => c.id);
  if (ready.length < TUNING.crewsPerVehicle && untrained.length === n && !training) return { train: untrained };
  return ready.length ? { fly: ready[0] } : {};
};

// What a team flies next on a crewed vehicle (V2 freeze §5): uncrewed until a readiness decision covers the
// configuration and a crew has trained for it; it asks for that decision once the evidence supports it.
const crewStep = (state, p, config) => {
  if (!VEHICLES[p.vehicle].crewed || VEHICLES[p.vehicle].military) return { kind: 'fly' };
  if (!crewReady(state, p.vehicle, config.stages)) {
    const waiting = state.decisions.some(d => d.type === 'crew-readiness' && d.status === 'open');
    if (readiness(state, 'crewed-flight', config).ready) return waiting ? { kind: 'fly' } : { kind: 'crew-readiness' };
    // A known risk is enough to keep flying uncrewed, never to carry a crew: a fix the team can develop comes first.
    return chaseCause(state, p, null) ?? { kind: 'fly' };
  }
  const c = crewFor(state, p.vehicle);
  return c.fly ? { kind: 'fly', crew: c.fly } : c.train ? { kind: 'train', vehicle: p.vehicle, crew: c.train } : { kind: 'fly' };
};

// Chase the cause of a blocking finding: a discriminating test while explanations compete, else the fix
// for the leading one. Null when there is nothing the team can do itself.
const chaseCause = (state, p, rev) => {
  for (const st of VEHICLES[p.vehicle].stages) {
    const anomaly = anomalyOn(state, p, st);
    if (anomaly?.proposedTests?.length) { const t = anomaly.proposedTests[0]; return { kind: 'ground-test', stage: st, burn: t.conditions.burn, channels: t.channels, why: 'anomaly', anomaly: anomaly.id }; }
    const leading = anomaly?.status === 'leading' ? openHypotheses(anomaly)[0] : null, fix = leading && remedyFor(st, leading);
    if (!rev && fix && !lineage(p.baseline[st]).includes(fix)) return fixPlan(state, p, knownFixes(state, p));
  }
  return null;
};

const flyIfReady = (state, p, config, rev = null, stage = null) => {
  const r = readiness(state, 'experimental-flight', config, rev);
  if (r.ready) return rev ? { kind: 'fly', stage, rev } : crewStep(state, p, config);
  return chaseCause(state, p, rev) ?? { kind: 'adverse', stage: null, quantities: blockedQuantities(r), flight: true };
};
const keyOf = s => [s.kind, s.stage, s.rev, s.revs && Object.values(s.revs).join('+'), s.burn, s.channels?.join('+'), s.crew?.join('+')].filter(Boolean).join(':');

const openLaunchDecision = (state, pid) => state.launches.some(l => l.programmeId === pid && l.status === 'awaiting-decision'
  && state.decisions.some(d => d.type === 'launch' && d.subject === l.id && d.status === 'open'));
const lastFlight = (state, pid) => Math.max(-Infinity, ...state.launches.filter(l => l.programmeId === pid && l.status === 'flown').map(l => l.day));

// Why the team is waiting rather than proposing, or null when it is free to act.
const busy = (state, p) => {
  const running = state.work.find(j => j.programmeId === p.id && (j.status === 'running' || j.status === 'paused'));
  if (running) return running.status === 'paused' ? `${running.kind.replace(/-/g, ' ')} is paused` : `${running.kind.replace(/-/g, ' ')} under way`;
  if (openLaunchDecision(state, p.id)) return 'a launch is waiting for your decision';
  const launches = new Set(state.launches.filter(l => l.programmeId === p.id).map(l => l.id));
  const review = state.decisions.find(d => d.status === 'open' && launches.has(d.subject) && d.type !== 'launch');
  if (review) return `the ${review.type.replace(/-/g, ' ')} of ${review.subject} is waiting for your decision`;
  const rev = state.decisions.find(d => d.status === 'open' && ['trial', 'deployment'].includes(d.type) && REVISIONS[d.subject]?.stage && VEHICLES[p.vehicle].stages.includes(REVISIONS[d.subject].stage));
  if (rev) return `the ${rev.type === 'trial' ? 'trial' : 'adoption'} of the ${REVISIONS[rev.subject].label} is waiting for your decision`;
  if (state.decisions.some(d => d.status === 'open' && d.type === 'stop' && d.subject === p.id)) return 'our recommendation to close the programme is waiting for your decision';
  if (state.decisions.some(d => d.status === 'open' && d.type === 'displacement' && d.text.startsWith(p.name))) return 'a facility clash is waiting for your decision';
  return null;
};

const eligible = p => p.vehicle && p.stage === 'greenlit';

const operational = (state, kind) => Object.values(state.facilities.units).filter(u => u.kind === kind && u.status === 'operational');
// A free unit of this kind for the period, else the first one (reserving it will raise the clash for decision).
const pickUnit = (state, kind, from, to) => {
  const units = operational(state, kind);
  return (units.find(u => holders(state, u.id, from, to).length < (FACILITY_KINDS[kind].exclusive ? 1 : u.capacity)) ?? units[0])?.id ?? null;
};

const configOf = (p, step) => ({ ...p.baseline, ...revsOf(step) });
const readyArticle = (state, p, step) => Object.values(state.hardware.articles).find(a => a.programmeId === p.id && a.status === 'built'
  && !state.hardware.batches[a.batchId].held && Object.entries(configOf(p, step)).every(([s, r]) => a.stages[s] === r));

const describe = (state, p, step) => {
  if (step.kind === 'feasibility') return `Shall we look into ${p.name}${p.client ? ` for ${p.client}` : ''}? `
    + `If you authorise bounded feasibility work, the technical director and the financial officer will report on whether it is possible and what it would cost (about ${Math.ceil(TUNING.staffCaseDays / 7)} weeks)`
    + `${PROGRAMMES.find(d => d.id === p.id)?.terms ? ` and we will meet ${p.client} to hear their terms` : ''}. The dossier then comes back to you.`;
  if (step.kind === 'develop') return `${team(p)} has narrowed the cause to ${HYPOTHESES[step.hypothesis].name.toLowerCase()}. `
    + `The department head proposes the ${REVISIONS[step.rev].label} as the fix: we would define a prototype and then fire it on the stand before asking you for a trial flight.`;
  if (step.kind === 'ground-test') {
    const kind = testFacility(step.stage), where = FACILITY_KINDS[kind].name.toLowerCase();
    const stand = pickUnit(state, kind, state.day, state.day + TUNING.staffTestBookingDays);
    const what = `a ${step.burn}-${kind === 'static-stand' ? 'burn' : 'run'} ground test of the ${step.rev ? `${REVISIONS[step.rev].label} on the ` : ''}${STAGES[step.stage].name} in ${stand ? `${where} ${stand}` : `a ${where}`}, reading ${list(step.channels.map(qname))}`;
    const why = { first: 'We have no readings on it yet, so this is where we start.',
      'flight-conditions': 'The short-burn readings are in. Flights run the full burn, so we need readings at full duration before we fly.',
      anomaly: `${ANOMALIES[step.anomaly]?.name ?? 'The anomaly'} has more than one explanation, and this test should tell them apart.`,
      fix: step.burn === 'short' ? 'The fault showed at start-up, so we fire the fix short first to see whether it is gone.' : 'The fix behaves at start-up. Flights run the full burn, so we fire it at full duration before asking for a trial flight.' }[step.why];
    return `${team(p)} would like to run ${what}. ${why}`;
  }
  if (step.kind === 'train') return `${team(p)} would like to train ${list(step.crew.map(c => state.people[c].name))} for ${VEHICLES[step.vehicle].name}: `
    + `${list(TRAINING[step.vehicle].items)}, about ${Math.round(TRAINING[step.vehicle].items.length * TUNING.trainingDaysPerItem / 30)} months. Flights go on uncrewed meanwhile.`;
  const article = readyArticle(state, p, step);
  if (step.crew) return `${VEHICLES[p.vehicle].name} is ready for crewed flight and ${list(step.crew.map(c => state.people[c].name))} ${step.crew.length > 1 ? 'have' : 'has'} trained for it. `
    + `${article ? `Article ${article.id} is ready` : 'Production would build the next article'}, and we would book pad and tracking and ask for a crewed launch. `
    + 'The crew will give or withhold their own consent, and the launch itself still comes to you for decision.';
  const trial = Object.values(revsOf(step));
  if (trial.length) return `The ${list(trial.map(r => REVISIONS[r].label))} ${trial.length > 1 ? 'are' : 'is'} authorised for trial and will fly together. ${article ? `Article ${article.id} is ready` : 'Production would build a trial article'}, `
    + 'and we would book pad and tracking and ask for the launch. The launch itself still comes to you for decision.';
  return `Ground readings for every stage of ${VEHICLES[p.vehicle].name} are within normal limits under flight conditions. `
    + `${article ? `Article ${article.id} is ready` : 'Production would build the next article'}, and we would book pad and tracking and ask for a launch. `
    + 'The launch itself still comes to you for decision.';
};

const trialStages = step => (Object.keys(revsOf(step)).length ? revsOf(step) : null);

// Carry out a step through ordinary commands. Returns { decision } if a booking clash was raised instead.
const execute = (state, run, p, step, actor) => {
  const s = staffOf(state), id = () => `staff-${s.next++}`;
  const as = role => (actor === 'administrator' ? 'administrator' : role);
  const book = (kind, days, purpose) => {
    const unitId = pickUnit(state, kind, state.day, state.day + days);
    if (!unitId) throw new Rejection(`We have no ${FACILITY_KINDS[kind].name.toLowerCase()} in service`);
    const rid = id(), r = run(state, 'reserve-facility', as('department-head'), { id: rid, unitId, programmeId: p.id, from: state.day, to: state.day + days, purpose });
    return r.decision ? { decision: r.decision } : { reservation: rid };
  };
  if (step.kind === 'feasibility') { run(state, 'authorise-feasibility', 'administrator', { programmeId: p.id }); return {}; }
  if (step.kind === 'develop') {
    if (!state.hardware.revisions[step.rev]) run(state, 'propose-revision', 'department-head', { revId: step.rev, reason: `the leading explanation for the fault is ${HYPOTHESES[step.hypothesis].name.toLowerCase()}` });
    run(state, 'approve-prototype', 'technical-director', { programmeId: p.id, revId: step.rev });
    return {};
  }
  if (step.kind === 'trial') return { decision: run(state, 'request-trial', 'department-head', { programmeId: p.id, revId: step.rev, with: step.with ?? {} }) };
  if (step.kind === 'crew-readiness') return { decision: run(state, 'request-crew-readiness', 'technical-director', { programmeId: p.id }) };
  if (step.kind === 'train') { run(state, 'train-crew', as('department-head'), { jobId: id(), vehicle: step.vehicle, crew: step.crew }); return {}; }
  if (step.kind === 'adopt') return { decision: run(state, 'adopt-revision', 'administrator', { revId: step.rev, programmeIds: [p.id], with: step.with ?? {} }) };
  if (step.kind === 'ground-test') {
    const stand = book(testFacility(step.stage), TUNING.staffTestBookingDays, `${step.burn}-burn ground test`);
    if (stand.decision) return stand;
    run(state, 'schedule-test', as('department-head'), { jobId: id(), programmeId: p.id, stage: step.stage, stages: step.rev ? { [step.stage]: step.rev } : {}, conditions: { burn: step.burn }, channels: step.channels, reservation: stand.reservation });
    return {};
  }
  let n = Object.values(state.hardware.articles).filter(a => a.programmeId === p.id).length + 1;
  while (state.hardware.articles[`${p.id}-${n}`]) n++;
  const articleId = readyArticle(state, p, step)?.id ?? run(state, 'build-article', as('department-head'), { id: `${p.id}-${n}`, programmeId: p.id, stages: trialStages(step) });
  const pad = book('range', TUNING.staffLaunchBookingDays, 'launch');
  if (pad.decision) return pad;
  const tracking = book('tracking', TUNING.staffLaunchBookingDays, 'tracking');
  if (tracking.decision) return tracking;
  return run(state, 'request-launch', as('department-head'), { id: id(), articleId, pad: pad.reservation, tracking: tracking.reservation, cost: TUNING.staffFlightCost, replacementCost: TUNING.staffFlightCost, crew: step.crew ?? [],
    // Crewed flights work up the planners' ladder of missions; an uncrewed one flies the first rung.
    ...(MISSIONS[p.vehicle] ? { mission: step.crew?.length ? nextMission(state, p.vehicle) : MISSION_LADDER[p.vehicle][0] } : {}) });
};

// ---- proposals the administrator answers ----

export const proposal = (state, id) => staffOf(state).proposals.find(x => x.id === id) ?? (() => { throw new Rejection(`No proposal ${id}`); })();

export const approveProposal = (state, run, id) => {
  const pr = proposal(state, id);
  if (pr.status !== 'open') throw new Rejection(`That proposal is ${pr.status}`);
  const p = state.programmes[pr.programmeId];
  pr.status = 'approved';
  pr.decidedDay = state.day;
  return execute(state, run, p, pr.step, 'administrator');
};

export const declineProposal = (state, id) => {
  const pr = proposal(state, id);
  if (pr.status !== 'open') throw new Rejection(`That proposal is ${pr.status}`);
  Object.assign(pr, { status: 'declined', decidedDay: state.day });
  staffOf(state).snooze[pr.programmeId] = state.day + TUNING.proposalSnoozeDays;
};

// ---- the daily round ----

const noteOnce = (state, key, m) => { const s = staffOf(state); if (s.noted[key]) return; s.noted[key] = state.day; memo(state, m); };

// The technical director's judgement: is it possible with what we have, what it would take, what worries us.
const engineeringCase = (state, p) => {
  if (!p.vehicle) return `Not yet possible as asked: there is no ${p.name} design, so there is nothing we could fire or fly. `
    + 'Preliminary acceptance would mean design work first; we would come back with a vehicle before asking for any test time.';
  const v = VEHICLES[p.vehicle], config = { vehicle: p.vehicle, stages: p.baseline };
  const ours = v.stages.filter(st => STAGES[st].developable).map(st => STAGES[st].name), supplied = v.stages.filter(st => !STAGES[st].developable).map(st => STAGES[st].name);
  const testable = v.stages.filter(st => VEHICLE_QUANTITIES[p.vehicle].some(q => q.startsWith(`${st}.`)));
  const known = VEHICLE_QUANTITIES[p.vehicle].filter(q => claimStatus(state, config, q, FLIGHT_CONDITIONS).status === 'measured-normal').length;
  const sharing = Object.values(state.programmes).filter(x => x.id !== p.id && eligible(x)).map(x => x.name);
  const stands = operational(state, 'static-stand').length;
  return [
    `We think ${v.name} is possible with the facilities we have.`,
    ours.length ? `We would develop the ${list(ours)} ourselves${supplied.length ? `; the ${list(supplied)} would come as supplied` : ''}.` : `Every stage would come as supplied (${list(supplied)}).`,
    known ? `${known} of its ${VEHICLE_QUANTITIES[p.vehicle].length} measured quantities already have applicable readings.` : 'We have no readings that apply to it yet, so everything about it is unknown.',
    `Before a first flight we would want a short- and a long-burn firing of the ${list(testable.map(st => STAGES[st].name))}, about ${testable.length * 2} ground tests, then at least ${TUNING.delegationSuccessfulFlights} experimental flights.`,
    stands === 1 && sharing.length ? `Concern: our only static test stand is shared with ${list(sharing)}, so its tests would queue behind theirs.` : 'No concern about facilities at present.',
  ].join(' ');
};

// The financial officer's judgement against what this year can actually carry.
const fundingCase = (state, p) => {
  const avail = available(state), award = state.fiscal.award, m = p.meeting;
  if (!m) return `This year's award is ${money(award)}, of which ${money(avail)} is not yet spoken for. Without the client's figures I cannot say more than that.`;
  const fits = m.cost <= avail ? `We could carry that from what is not yet spoken for this year (${money(avail)}).`
    : m.cost <= award ? `That is more than we have free this year (${money(avail)}), so it would need phasing into next year's award.`
    : `That is more than this year's whole award of ${money(award)}. I would not support it without multi-year authority or a larger share from the client.`;
  return `${p.client ?? 'The sponsor'} put the cost at ${money(m.cost)} over ${m.timeline}. ${fits} Each flight would add about ${money(TUNING.staffFlightCost)}.`;
};

const investigationRound = (state, run, p) => {
  const s = staffOf(state);
  const since = [...p.history].reverse().find(e => e.event === 'bounded feasibility work authorised')?.day ?? state.day;
  const elapsed = state.day - since;
  const terms = PROGRAMMES.find(d => d.id === p.id)?.terms;
  if (!s.raised[`started:${p.id}:${since}`]) {
    s.raised[`started:${p.id}:${since}`] = state.day;
    memo(state, { from: 'project-manager', refs: { programme: p.id },
      text: `Feasibility work on ${p.name} has started. ${terms && !p.meeting ? `We meet ${p.client} around ${dateLabel(since + TUNING.staffMeetingDays)} to hear their terms. ` : ''}`
        + `The technical director and the financial officer will report by about ${dateLabel(since + TUNING.staffCaseDays)}, and the dossier comes to you after that.` });
  }
  if (elapsed >= TUNING.staffMeetingDays && !p.meeting && terms) {
    run(state, 'record-meeting', 'project-manager', { programmeId: p.id, ...terms });
    memo(state, { from: 'project-manager', kind: 'report', text: `We met ${p.client} about ${p.name}. They put the cost at ${money(terms.cost)} over ${terms.timeline}; they would contribute ${terms.contribution}; they need ${terms.requirements}.`, refs: { programme: p.id } });
  }
  if (elapsed >= TUNING.staffCaseDays && !p.cases.engineering) {
    run(state, 'complete-case', 'technical-director', { programmeId: p.id, summary: engineeringCase(state, p) });
    memo(state, { from: 'technical-director', kind: 'report', text: `Engineering case for ${p.name}: ${p.cases.engineering.summary}`, refs: { programme: p.id } });
  }
  if (elapsed >= TUNING.staffCaseDays && !p.cases.funding) {
    run(state, 'complete-case', 'financial-officer', { programmeId: p.id, summary: fundingCase(state, p) });
    memo(state, { from: 'financial-officer', kind: 'report', text: `Funding case for ${p.name}: ${p.cases.funding.summary}`, refs: { programme: p.id } });
  }
  if (p.cases.engineering && p.cases.funding && p.meeting) run(state, 'submit-dossier', 'project-manager', { programmeId: p.id });
};

const preliminaryRound = (state, run, p) => {
  const s = staffOf(state), key = `greenlight:${p.id}:${p.window.opens}`;
  if (s.raised[key] || state.day - p.window.opens < TUNING.staffGreenlightPrepDays) return;
  if (state.decisions.some(d => d.type === 'greenlight' && d.subject === p.id && d.status === 'open')) return;
  s.raised[key] = state.day;
  run(state, 'request-greenlight', 'project-manager', { programmeId: p.id });
};

// ---- recommending closure (§8.6) and working through it (§8.7) ----

const successes = (state, pid) => state.launches.filter(l => l.programmeId === pid && l.status === 'flown' && l.outcome === 'success').length;

// Why a programme has run its course, or null: it met its goal, or a newer programme now does its work.
export const runItsCourse = (state, p) => {
  const def = PROGRAMMES.find(d => d.id === p.id), own = successes(state, p.id);
  const after = def?.supersededAfterFlights ?? TUNING.supersededAfterFlights;
  const by = (def?.supersededBy ?? []).map(id => state.programmes[id]).find(x => x && x.stage === 'greenlit' && successes(state, x.id) >= after);
  if (by) return `${by.name} now does the same work and has ${successes(state, by.id)} successful flights. ${p.name} has flown ${own} times successfully; `
    + `its pad, stand and flight slots would serve ${by.name} better.`;
  if (def?.goalFlights && own >= def.goalFlights) return `it has done what it was set up to do: ${own} successful flights against the ${def.goalFlights} it was planned for.`;
  return null;
};

const closureRound = (state, run, p) => {
  const s = staffOf(state), k = `stop:${p.id}`;
  if (state.decisions.some(d => d.type === 'stop' && d.subject === p.id && d.status === 'open')) return false;
  if ((s.raised[k] ?? -Infinity) + TUNING.stopReviewDays > state.day) return false;
  const reason = runItsCourse(state, p);
  if (!reason) return false;
  s.raised[k] = state.day;
  run(state, 'recommend-stop', 'technical-director', { programmeId: p.id,
    reason: `${reason} Closing it settles its contracts, hands back its facilities and archives its records. If you would rather keep it, we will ask again in a year.` });
  for (const pr of s.proposals.filter(x => x.status === 'open' && x.programmeId === p.id)) pr.status = 'superseded';
  return true;
};

// Each owner does their closure step in turn (§8.7). Obligations are listed, never cancelled: they stay for you to settle.
const CLOSURE_OUTPUT = {
  'contract-settlements': (state, p) => { const open = p.closure.obligations.filter(o => o.kind === 'payment' && o.status === 'open');
    return open.length ? `${open.length} payment${open.length > 1 ? 's' : ''} still owed (${money(open.reduce((a, o) => a + o.amount, 0))}); listed for settlement` : 'no payments outstanding'; },
  'hardware-disposition': (state, p) => { const n = Object.values(state.hardware.articles).filter(a => a.programmeId === p.id && a.status === 'built').length;
    return n ? `${n} unflown article${n > 1 ? 's' : ''} kept for storage, reuse or recycling` : 'no unflown hardware'; },
  'facility-release': (state, p) => { const n = state.facilities.reservations.filter(r => r.programmeId === p.id && r.status === 'held').length;
    return n ? `${n} facility booking${n > 1 ? 's' : ''} still held; listed for release` : 'no facilities held'; },
  records: (state, p) => `${state.work.filter(j => j.programmeId === p.id && j.status === 'done').length} test and flight records archived`,
  'staff-reassignment': (state, p) => { const to = Object.values(state.programmes).filter(x => x.id !== p.id && x.stage === 'greenlit').map(x => x.name);
    return to.length ? `team reassigned to ${list(to)}` : 'team released'; },
  'closure-report': (state, p) => `${successes(state, p.id)} successful flights; ${p.closure.obligations.filter(o => o.status === 'open' && !(o.owner && o.funded)).length} obligations left for you to settle`,
};

const windDown = (state, run, p) => {
  const s = staffOf(state), k = `closing:${p.id}`;
  if (!s.raised[k]) {
    s.raised[k] = state.day;
    memo(state, { from: 'project-manager', refs: { programme: p.id },
      text: `${p.name} is closing. Each owner will do their part over the coming weeks: finance lists what is still owed, the department head disposes of hardware, the technical director releases facilities, records are archived and the team is reassigned. I will send the closure report at the end.` });
  }
  const next = p.closure.steps.find(x => !x.done);
  const last = Math.max(s.raised[k], ...p.closure.steps.filter(x => x.done && x.day != null).map(x => x.day));
  if (!next || state.day - last < TUNING.staffClosureStepDays) return;
  run(state, 'complete-closure-step', next.owner, { programmeId: p.id, step: next.id, output: (CLOSURE_OUTPUT[next.id] ?? (() => 'done'))(state, p) });
  next.day = state.day;
  if (next.id === 'closure-report') memo(state, { from: 'project-manager', kind: 'report', refs: { programme: p.id },
    text: `Closure report for ${p.name}: ${p.closure.steps.filter(x => x.output && x.id !== 'stop-decision').map(x => `${x.id.replace(/-/g, ' ')}: ${x.output}`).join('; ')}.`
      + (p.stage === 'closed' ? ' The programme is closed.' : ' It stays open on the books until those obligations are settled (Programmes).') });
};

const workRound = (state, run, p) => {
  const s = staffOf(state);
  const step = nextStep(state, p), key = keyOf(step);
  const open = s.proposals.find(x => x.status === 'open' && x.programmeId === p.id);
  const waiting = busy(state, p);
  if (open && (waiting || open.key !== key)) open.status = 'superseded';
  if (waiting || (open && open.status === 'open')) return;
  if (step.kind === 'adverse') {
    const anomaly = anomalyOn(state, p, step.stage);
    const leading = anomaly?.status === 'leading' ? HYPOTHESES[openHypotheses(anomaly)[0]].name.toLowerCase() : null;
    noteOnce(state, `adverse:${p.id}:${step.stage}:${step.failedFix ?? ''}:${step.quantities.join('+')}`, { from: 'technical-director', kind: 'warning', refs: { programme: p.id },
      text: step.failedFix
        ? `${team(p)} has stopped work on the ${REVISIONS[step.failedFix].label}: ${list(step.quantities.map(qname))} is still outside normal limits with the fix fitted, so it is not the cure. We need your direction before we spend more on it.`
        : step.flight ? `${team(p)} is not asking to fly again: ${list(step.quantities.map(qname))} has a finding outside normal limits that you have not accepted as a known risk, and we have no test or fix that would clear it. We need your direction before we ask for the pad.`
        : `${team(p)} has stopped new work on the ${STAGES[step.stage].name}: ${list(step.quantities.map(qname))} came back outside normal limits. ${leading ? `Our leading explanation is ${leading}, but we have no fix for it we can develop.` : 'No test we can run would explain it.'} We need your direction before we spend more on it.` });
    return;
  }
  // Trials and adoption are decisions in their own right (§5.1): the team raises them, and raises them again only after a while.
  if (step.kind === 'crew-readiness') {
    const k = `crew-readiness:${p.id}:${Object.values(p.baseline).join('+')}`;
    if ((s.raised[k] ?? -Infinity) + TUNING.proposalSnoozeDays * 3 > state.day) return;
    s.raised[k] = state.day;
    execute(state, run, p, step, 'team');
    memo(state, { from: 'technical-director', kind: 'report', refs: { programme: p.id },
      text: `Every claim we hold on ${VEHICLES[p.vehicle].name} in its current configuration is measured and normal on enough flights, its abort sensing included. I have asked you to declare it ready for crewed flight; that is in your Mail.` });
    return;
  }
  if (step.kind === 'trial' || step.kind === 'adopt') {
    const k = `${step.kind}:${p.id}:${step.rev}`;
    if ((s.raised[k] ?? -Infinity) + TUNING.proposalSnoozeDays * 3 > state.day) return;
    s.raised[k] = state.day;
    execute(state, run, p, step, 'team');
    memo(state, { from: 'department-head', kind: 'report', refs: { programme: p.id },
      text: step.kind === 'trial'
        ? `The ${REVISIONS[step.rev].label} fired normally on the stand, short and long. We have asked you to authorise a trial flight; that is in your Mail.`
        : `The trial flight of the ${REVISIONS[step.rev].label} reached its planned apogee. We have asked you to adopt it for future ${p.name} articles; that is in your Mail.` });
    return;
  }
  if ((s.snooze[p.id] ?? -Infinity) > state.day) return;
  if (step.kind === 'fly' && !trialStages(step) && state.day - lastFlight(state, p.id) < TUNING.staffFlightSpacingDays) return;
  if (isDelegated(state, p.id)) {
    const text = describe(state, p, step);
    try {
      const shadow = structuredClone(state);
      const out = execute(shadow, run, shadow.programmes[p.id], step, 'team');
      Object.assign(state, shadow);
      memo(state, { from: step.kind === 'fly' ? 'department-head' : 'technical-director', kind: 'report', refs: { programme: p.id },
        text: `${text.replace(' would like to run ', ' has scheduled ').replace('Production would build', 'Production is building')}${out.decision ? ' A booking clash needs your decision first.' : ''}` });
    } catch (e) {
      if (!(e instanceof Rejection)) throw e;
      noteOnce(state, `blocked:${p.id}:${key}:${e.message}`, { from: 'technical-director', kind: 'warning', refs: { programme: p.id }, text: `${team(p)} could not schedule its next step: ${e.message}.` });
    }
    return;
  }
  propose(state, p, step, key, ['fly', 'develop'].includes(step.kind) ? 'department-head' : 'technical-director');
};

const propose = (state, p, step, key, from) => {
  const s = staffOf(state);
  s.proposals.push({ id: `proposal-${s.proposals.length + 1}`, day: state.day, programmeId: p.id, stage: p.stage, key, step, from, text: describe(state, p, step), status: 'open', decidedDay: null });
};

// A new proposal waits at stage 1 until the administrator authorises bounded work (§8.2).
const feasibilityRound = (state, p) => {
  const s = staffOf(state);
  if (s.proposals.some(x => x.status === 'open' && x.programmeId === p.id) || (s.snooze[p.id] ?? -Infinity) > state.day) return;
  propose(state, p, { kind: 'feasibility' }, 'feasibility', 'project-manager');
};

export const quarterReport = state => {
  const q = fiscalQuarter(state.day);
  memo(state, { from: 'financial-officer', kind: 'report',
    text: `Quarter report for ${dateLabel(q.start)} to ${dateLabel(q.end)}. This year's award is ${money(state.fiscal.award)}. `
      + `We can still spend ${money(capacityRemaining(state))} of what has been released; ${money(protectedBaseline(state))} of that is already owed in bills due before the next release, `
      + `which leaves ${money(available(state))} for new work.` });
};

// The first morning: who is here, what they are working on, and what they want from you.
export const openingBriefing = state => {
  const wac = state.programmes.wac;
  const units = Object.values(state.facilities.units).map(u => `${FACILITY_KINDS[u.kind].name.toLowerCase()} ${u.id}`);
  memo(state, { from: 'technical-director', refs: { programme: 'wac' },
    text: `Welcome to White Sands. ${wac.name} is our programme, and it is already approved. We have ${list(units)}. `
      + 'Nothing has flown yet and we have no readings, so we know nothing for certain about the vehicle. '
      + 'The team has put its first proposal in your Mail. Until we have a track record, the teams propose and you give the go-ahead.' });
};

// The monthly update each greenlit team sends (§3.2, §8.4 consolidated reporting): what finished, what we know, what is next.
const monthlyUpdate = (state, p) => {
  const since = state.day - 31, done = state.work.filter(j => j.programmeId === p.id && j.status === 'done' && j.started >= since);
  const tests = done.filter(j => j.kind === 'ground-test').length, flights = state.launches.filter(l => l.programmeId === p.id && l.status === 'flown' && l.day >= since);
  const config = { vehicle: p.vehicle, stages: p.baseline };
  const claims = VEHICLE_QUANTITIES[p.vehicle].map(q => claimStatus(state, config, q, FLIGHT_CONDITIONS));
  const normal = claims.filter(c => c.status === 'measured-normal').length, adverse = claims.filter(c => c.status === 'adverse').map(c => qname(c.quantity));
  const last = [tests && `${tests} ground test${tests > 1 ? 's' : ''}`, flights.length && `${flights.length} flight${flights.length > 1 ? 's' : ''} (${flights.filter(l => l.outcome === 'success').length} reached apogee)`].filter(Boolean);
  const pm = state.delegation.appointments.find(a => a.status === 'active' && a.role === 'project-manager' && a.programmeId === p.id);
  memo(state, { from: pm ? 'project-manager' : 'technical-director', kind: 'report', refs: { programme: p.id },
    text: `${p.name}, monthly update. Last month: ${last.length ? list(last) : 'no tests or flights finished'}. `
      + `What we know: ${normal} of ${claims.length} measured quantities are within normal limits under flight conditions${adverse.length ? `; outside limits: ${list(adverse)}` : ''}. `
      + `Next: ${teamStatus(state, p) ?? 'nothing planned'}` });
};

export const staffDay = (state, run) => {
  staffOf(state);
  if (state.day > 0 && dateOf(state.day).date === 1) for (const p of Object.values(state.programmes).filter(eligible)) monthlyUpdate(state, p);
  for (const p of Object.values(state.programmes)) {
    try {
      if (p.stage === 'feasibility') feasibilityRound(state, p);
      else if (p.stage === 'investigation') investigationRound(state, run, p);
      else if (p.stage === 'preliminary') preliminaryRound(state, run, p);
      if (p.stage === 'closing') windDown(state, run, p);
      if (eligible(p) && !closureRound(state, run, p)) workRound(state, run, p);
    } catch (e) {
      if (!(e instanceof Rejection)) throw e;
      noteOnce(state, `stuck:${p.id}:${p.stage}:${e.message}`, { from: 'project-manager', kind: 'warning', refs: { programme: p.id }, text: `${team(p)} is held up: ${e.message}.` });
    }
  }
  for (const pr of state.staff.proposals.filter(x => x.status === 'open' && state.programmes[x.programmeId]?.stage !== x.stage)) pr.status = 'superseded';
};

// What each team is doing, for the Programmes screen.
export const teamStatus = (state, p) => {
  if (p.stage === 'feasibility') return 'Waiting for you to authorise bounded feasibility work (see Mail).';
  if (p.stage === 'investigation') {
    const missing = [!p.cases.engineering && 'the engineering case', !p.cases.funding && 'the funding case', !p.meeting && 'the client meeting'].filter(Boolean);
    return missing.length ? `Working on ${list(missing)}.` : 'Dossier ready.';
  }
  if (p.stage === 'preliminary') return `Preparing the greenlight request; the window closes ${dateLabel(p.window.closes)}.`;
  if (p.stage === 'greenlit' && !p.vehicle && p.designReady != null) return `Design and contractor work under way; the first vehicles are due ${dateLabel(p.designReady)}.`;
  if (p.stage === 'closing') { const next = p.closure.steps.find(x => !x.done); return next ? `Closing: ${next.id.replace(/-/g, ' ')} next (${next.owner.replace(/-/g, ' ')}).` : 'Closing: waiting for the remaining obligations to be settled.'; }
  if (!eligible(p)) return null;
  const waiting = busy(state, p);
  if (waiting) return `${waiting[0].toUpperCase()}${waiting.slice(1)}.`;
  const open = staffOf(state).proposals.find(x => x.status === 'open' && x.programmeId === p.id);
  if (open) return 'Waiting for your go-ahead on a proposal in Mail.';
  const step = nextStep(state, p);
  if (step.kind === 'adverse') return 'Stopped: a finding is outside normal limits and needs your direction.';
  if ((staffOf(state).snooze[p.id] ?? -Infinity) > state.day) return `You asked us to wait; we will propose again on ${dateLabel(staffOf(state).snooze[p.id])}.`;
  if (step.kind === 'fly') return `Ready for the next flight; spacing flights until ${dateLabel(lastFlight(state, p.id) + TUNING.staffFlightSpacingDays)}.`;
  return 'Planning the next test.';
};
