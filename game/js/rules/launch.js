// Launch and abort authority (freeze §3.3). A launch needs the ground chain's support: the technical
// tier can block, Flight Control can hold or destruct, the executive tier decides scope and money.
// The crew tier is recorded as inactive because no v1 vehicle carries crew.

import { VEHICLES, REVISIONS, TRACKING_CHANNELS } from '../data/vehicles.js';
import { FLIGHT_CONDITIONS } from '../data/engineering.js';
import { Rejection, openDecision, position, memo } from './authority.js';
import { readiness } from './belief.js';
import { article } from './hardware.js';
import { assessFlight, recordExposure, resolveExposure, commit } from './fiscal.js';
import { startJob } from './work.js';
import { money as dollars, programmeName } from './reports.js';
import { qualified, crewReady, consentTier } from './crew.js';
import { flies, operationsCost, checkRecovery, retrofireData, entryRecord, describeEntry } from './operations.js';
import { flyAndLand, entryEvents } from './physics.js';
import { observe } from './evidence.js';
import { updateBeliefs } from './belief.js';
import { ENTRY_CLAIMS, ENTRY_DESIGN, ENTRY_RECORDS, RECOVERY_FORCES } from '../data/flight.js';
import { planMission, describeMission, recordCapabilities, closeScope } from './mission.js';

export const initLaunches = () => [];

const trialRevision = (state, a) => Object.values(a.stages).find(r => r !== state.programmes[a.programmeId].baseline[REVISIONS[r].stage]) ?? null;

const heldBy = (state, id, programmeId) => {
  const r = state.facilities.reservations.find(x => x.id === id);
  return r && r.status === 'held' && r.programmeId === programmeId && r.from <= state.day && state.day <= r.to
    && state.facilities.units[r.unitId].status === 'operational' ? r : null;
};

// Ask for launch. Flight Control holds on operational grounds at once; otherwise a vetoable
// decision records each tier's position.
// `crew` names the people aboard (V2 freeze §4): none for an uncrewed flight.
// `recovery` names the recovery force for a vehicle that comes home (V2 freeze §6.4); its cost is part of the launch.
// `mission` is the planned mission (V2 freeze §5): its duration and objectives.
export const requestLaunch = (state, { id, articleId, pad, tracking, cost, replacementCost, crew = [], recovery = 'primary', mission = {} }) => {
  const a = article(state, articleId);
  if (flies(a.vehicle)) checkRecovery(recovery);
  const plan = planMission(a.vehicle, mission);
  if (crew.length) {
    if (!VEHICLES[a.vehicle].crewed) throw new Rejection(`${VEHICLES[a.vehicle].name} carries no crew`);
    // V2-04: no crewed launch without a readiness decision for this configuration and crewed use.
    if (!crewReady(state, a.vehicle, a.stages)) throw new Rejection(`There is no readiness decision for crewed use of ${VEHICLES[a.vehicle].name} in this configuration`);
    const unqualified = qualified(state, a.vehicle, crew);
    if (unqualified.length) throw new Rejection(`The crew is not qualified: ${unqualified.join('; ')}`);
  }
  if (a.status !== 'built') throw new Rejection(`${articleId} is ${a.status}`);
  if (state.hardware.batches[a.batchId].held) throw new Rejection(`${a.batchId} is on hold`);
  const holds = [];
  const padRes = heldBy(state, pad, a.programmeId), trackRes = heldBy(state, tracking, a.programmeId);
  if (!padRes || state.facilities.units[padRes.unitId].kind !== 'range') holds.push('no pad reserved for today');
  if (!trackRes || state.facilities.units[trackRes.unitId].kind !== 'tracking') holds.push('no tracking reserved for today');
  if (holds.length) throw new Rejection(`Flight Control holds: ${holds.join('; ')}`, 'operational');

  const config = { vehicle: a.vehicle, stages: a.stages };
  const trial = trialRevision(state, a);
  const routine = readiness(state, 'routine-use', config);
  const experimental = !routine.ready;
  const tech = experimental ? readiness(state, 'experimental-flight', config, trial) : routine;
  const ops = operationsCost(state, a.vehicle, recovery);
  const money = assessFlight(state, { cost: cost + ops, replacementCost });
  const launch = {
    id, articleId, programmeId: a.programmeId, vehicle: a.vehicle, stages: { ...a.stages }, experimental, cost, replacementCost,
    status: 'awaiting-decision', day: state.day, outcome: null, jobId: null, rangeAction: null,
    tiers: {
      'ground-technical': position(tech.blockers, tech.gaps.length ? `known gaps: ${tech.gaps.join('; ')}` : 'supported'),
      'ground-operational': { stance: 'approve', reason: 'pad and tracking ready' },
      'ground-executive': { stance: money.affordable ? 'approve' : 'veto', reason: money.text },
      flight: crew.length ? consentTier(state, { id, vehicle: a.vehicle }, crew, tech)
        : { stance: 'inactive', reason: VEHICLES[a.vehicle].crewed ? 'no crew aboard' : 'uncrewed vehicle' },
    },
    crew: [...crew], abort: null,
    ...(flies(a.vehicle) ? { recovery, operationsCost: ops, retrofire: null, entry: null } : {}),
    ...(plan ? { mission: plan } : {}),
    reservations: [padRes.id, trackRes.id],
  };
  state.launches.push(launch);
  const d = openDecision(state, { type: 'launch', subject: id, raisedBy: 'flight-control', vetoable: true,
    text: `Launch ${VEHICLES[a.vehicle].name} ${articleId}${programmeName(state, a.programmeId) === VEHICLES[a.vehicle].name ? '' : ` for ${programmeName(state, a.programmeId)}`} (${experimental ? 'experimental' : 'routine'} flight${plan ? `, ${describeMission(a.vehicle, plan)}` : ''}, costing ${dollars(cost)}${ops ? `, and ${dollars(ops)} for recovery by ${RECOVERY_FORCES[recovery].name}` : ''}). ${money.text}`,
    finance: launch.tiers['ground-executive'], technical: launch.tiers['ground-technical'], effect: { kind: 'launch', payload: { id } } });
  // Launch needs both chains (V2 freeze §4): the crew's position sits beside the ground's, and a refusal is a veto.
  if (crew.length) d.positions.crew = launch.tiers.flight;
  // A vetoed launch can never be approved, so Flight Control scrubs it now rather than holding the pad.
  const vetoes = Object.entries(d.positions).filter(([, p]) => p?.stance === 'veto');
  if (vetoes.length) {
    Object.assign(d, { status: 'closed', choice: 'reject', decidedBy: 'flight-control', decidedDay: state.day,
      consequence: `Scrubbed: vetoed by ${vetoes.map(([who, p]) => `${who} (${p.reason})`).join(', ')}` });
    scrub(state, launch, d.consequence);
  }
  return { decision: d.id };
};

// Stand a launch down: the article stays built and the pad and tracking bookings are released.
export const scrub = (state, l, reason) => {
  Object.assign(l, { status: 'scrubbed', scrubbed: { day: state.day, reason } });
  for (const id of l.reservations) { const r = state.facilities.reservations.find(x => x.id === id); if (r?.status === 'held') r.status = 'released'; }
  memo(state, { from: 'flight-control', text: `Launch of ${VEHICLES[l.vehicle].name} ${l.articleId} scrubbed. ${reason}. The pad is free.`, refs: { launch: l.id } });
};

// A launch still waiting whose decision was refused, or whose pad was given to another programme, is
// scrubbed so it does not sit on the pad.
// shortcut: a booking that merely runs out keeps the launch waiting; approving it late does not re-check the pad.
export const standDown = state => {
  for (const l of state.launches.filter(x => x.status === 'awaiting-decision')) {
    const d = state.decisions.find(x => x.type === 'launch' && x.subject === l.id);
    if (d && d.status !== 'open') { scrub(state, l, `Not approved (${d.choice})`); continue; }
    if (state.facilities.reservations.find(r => r.id === l.reservations[0])?.status !== 'displaced') continue;
    if (d) Object.assign(d, { status: 'closed', choice: 'reject', decidedBy: 'flight-control', decidedDay: state.day, consequence: 'Scrubbed: the pad was given to another programme' });
    scrub(state, l, 'The pad was given to another programme');
  }
};

export const launchRecord = (state, id) => state.launches.find(l => l.id === id);

// Approved: pay for the flight, record the exposure, and fly.
export const executeLaunch = (state, { id }) => {
  const l = launchRecord(state, id);
  commit(state, { id: `launch-cost-${id}`, dept: 'flight-control', programmeId: l.programmeId, payments: [{ amount: l.cost + (l.operationsCost ?? 0), due: state.day }] }, { approved: true });
  recordExposure(state, id, l.replacementCost, l.tiers['ground-executive'].reason);
  const telemetry = [...new Set(Object.values(l.stages).flatMap(r => REVISIONS[r].telemetry))];
  // A vehicle that comes home is instrumented for its entry, and recovery reports the rest.
  const entry = flies(l.vehicle) ? [...ENTRY_CLAIMS(ENTRY_DESIGN[l.vehicle].spacecraft), ...ENTRY_RECORDS] : [];
  const data = flies(l.vehicle) ? retrofireData(state, l) : null;
  if (data) l.retrofire = data.sent;
  const plan = { kind: 'flight', vehicle: l.vehicle, stages: l.stages, conditions: { ...FLIGHT_CONDITIONS }, channels: [...TRACKING_CHANNELS, ...telemetry, ...entry],
    ...(data ? { entry: { recovery: l.recovery, ground: data.ground } } : {}), ...(l.mission ? { mission: { ...l.mission } } : {}) };
  const j = startJob(state, { id: `flight-${id}`, kind: 'flight', programmeId: l.programmeId, reservations: l.reservations, plan });
  // Whatever was wrong in the data sent is now in the flight itself; nobody knows it until the post-flight review.
  if (data) delete j.plan.entry.ground;
  // Flight Control invites the administrator to the blockhouse (freeze §8.3, §10.3). Watching changes nothing.
  Object.assign(l, { status: 'in-flight', jobId: j.id, launchDay: state.day, invitation: 'open' });
  article(state, l.articleId).status = 'flying';
  for (const pid of l.crew ?? []) state.people[pid].record.availability = 'flying';
};

// The crew's flight record, whatever happened.
const logCrew = (state, l) => {
  for (const pid of l.crew ?? []) {
    const rec = state.people[pid].record;
    rec.flights.push({ launchId: l.id, vehicle: l.vehicle, day: l.launchDay, outcome: l.outcome, abort: l.abort?.mode ?? null });
    rec.availability = l.entry && !l.entry.contact ? 'killed' : 'available';
    if (rec.availability === 'killed') rec.history.push({ day: state.day, event: `killed when ${VEHICLES[l.vehicle].name} ${l.articleId} was lost on entry` });
  }
};

// A binding crew abort (V2 freeze §4): the flight ends now, by the means this phase allows, and no ground
// authority can undo it. Readings taken so far stay in the record.
export const abortFlight = (state, l, j, { by, mode, evidence, early = false }) => {
  Object.assign(l, { status: 'flown', outcome: 'crew-abort', abort: { by, mode, day: state.day, evidence } });
  // After the launch phase the spacecraft still has to come home: an early retrofire, wherever it is (V2 freeze §4).
  if (l.mission) closeScope(state, l);
  if (early && flies(l.vehicle)) {
    const obs = flyAndLand(state, j.id, { vehicle: l.vehicle, recovery: l.recovery, early: ENTRY_DESIGN[l.vehicle].retro }).map(s => observe(state, j, s));
    j.observations.push(...obs.map(o => o.id));
    updateBeliefs(state, obs);
    land(state, l, obs, j.id);
  }
  if (l.invitation === 'open') l.invitation = 'lapsed';
  article(state, l.articleId).status = 'expended';
  resolveExposure(state, l.id, 'failure');
  logCrew(state, l);
  memo(state, { from: 'flight-control', kind: 'warning', refs: { launch: l.id },
    text: `${state.people[by]?.name ?? by} called an abort on ${VEHICLES[l.vehicle].name} ${l.articleId} (${mode}). The call is the crew's and it stands. ${evidence.length} abnormal reading${evidence.length === 1 ? '' : 's'} prompted it; everything recorded up to the abort is in Records.${describeEntry(state, l)}` });
};

export const answerInvitation = (state, { launchId, attend }) => {
  const l = launchRecord(state, launchId);
  if (!l || l.invitation !== 'open') throw new Rejection(`There is no open invitation for ${launchId}`);
  l.invitation = attend ? 'attending' : 'apologies';
};

// Splashdown, or the loss of the spacecraft: the record of what instruments, tracking and recovery showed.
const land = (state, l, obs, key) => {
  const events = entryEvents(state, key);
  if (!events) return;
  l.entry = entryRecord(state, l, obs, events);
  if (!l.entry.contact && !l.abort) l.outcome = 'failure';
  // Post-flight review: Flight Control compares the data it sent with the reconstructed trajectory.
  if (l.retrofire && !l.retrofire.caught) l.retrofire.review = Math.abs(l.entry.sighting ?? 0) > 3 * ENTRY_DESIGN[l.vehicle].footprint
    ? 'the landing was well outside the predicted footprint; the review is checking the retrofire data and the attitude records'
    : 'the landing was within the predicted footprint';
};

// The outcome is what tracking and telemetry showed, not hidden truth.
export const completeFlight = (state, j) => {
  const l = state.launches.find(x => x.jobId === j.id);
  const obs = j.observations.map(id => state.evidence.observations.find(o => o.id === id));
  const of = q => obs.find(o => o.quantity === q);
  const dev = of('vehicle.deviation'), apogee = of('vehicle.apogee');
  if (dev.state === 'measured' && !dev.normal) l.rangeAction = 'range-safety destruct';
  // On a crewed vehicle range safety fires the escape system first (V2 freeze §4).
  if (l.rangeAction && l.crew?.length) l.abort = { by: 'escape-system', mode: 'escape fired before range safety', day: state.day, evidence: [dev.id] };
  l.outcome = l.rangeAction ? 'failure' : apogee.state === 'measured' && apogee.normal ? 'success' : apogee.state === 'measured' ? 'failure' : 'indeterminate';
  l.status = 'flown';
  if (l.outcome !== 'failure' && flies(l.vehicle)) land(state, l, obs, j.id);
  if (l.mission) { closeScope(state, l); recordCapabilities(state, l, obs); }
  if (l.invitation === 'open') l.invitation = 'lapsed';
  article(state, l.articleId).status = l.outcome === 'failure' ? 'lost' : 'expended';
  resolveExposure(state, l.id, l.outcome);
  logCrew(state, l);
  if (l.outcome === 'failure') {
    // Separate the useful evidence, the actual loss and the unaffordable replacement; charge nothing.
    const money = assessFlight(state, { cost: l.replacementCost, replacementCost: 0 });
    openDecision(state, { type: 'replacement', subject: l.id, raisedBy: 'financial-officer', evidence: j.observations,
      text: `${VEHICLES[l.vehicle].name} ${l.articleId} was lost. ${obs.filter(o => o.state === 'measured').length} readings were recovered and are in Records. A replacement would cost ${dollars(l.replacementCost)}; ${money.affordable ? 'that is affordable' : 'that is not affordable this year'}.`,
      options: ['defer', 'fund-replacement', 'seek-supplementary'], effect: { kind: 'none' } });
    // The abnormal readings block further experimental flights until the technical director reviews them.
    const abnormal = obs.filter(o => o.state === 'measured' && !o.normal);
    if (abnormal.length) openDecision(state, { type: 'failure-review', subject: l.id, raisedBy: 'technical-director', evidence: abnormal.map(o => o.id),
      text: `${VEHICLES[l.vehicle].name} ${l.articleId} failed with ${abnormal.length} abnormal reading${abnormal.length > 1 ? 's' : ''}. The cause is not known. Fly this configuration again knowing the risk, or ground it until engineering finds the cause?`,
      options: ['accept-known-risk', 'ground'], effect: { kind: 'accept-risk', payload: { observations: abnormal.map(o => o.id) } } });
  }
  return l;
};
