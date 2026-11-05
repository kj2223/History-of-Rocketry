// Launch and abort authority (freeze §3.3). A launch needs the ground chain's support: the technical
// tier can block, Flight Control can hold or destruct, the executive tier decides scope and money.
// The crew tier is recorded as inactive because no v1 vehicle carries crew.

import { VEHICLES, REVISIONS, TRACKING_CHANNELS } from '../data/vehicles.js';
import { FLIGHT_CONDITIONS } from '../data/engineering.js';
import { Rejection, openDecision, position } from './authority.js';
import { readiness } from './belief.js';
import { article } from './hardware.js';
import { assessFlight, recordExposure, resolveExposure, commit } from './fiscal.js';
import { startJob } from './work.js';
import { money as dollars, programmeName } from './reports.js';

export const initLaunches = () => [];

const trialRevision = (state, a) => Object.values(a.stages).find(r => r !== state.programmes[a.programmeId].baseline[REVISIONS[r].stage]) ?? null;

const heldBy = (state, id, programmeId) => {
  const r = state.facilities.reservations.find(x => x.id === id);
  return r && r.status === 'held' && r.programmeId === programmeId && r.from <= state.day && state.day <= r.to
    && state.facilities.units[r.unitId].status === 'operational' ? r : null;
};

// Ask for launch. Flight Control holds on operational grounds at once; otherwise a vetoable
// decision records each tier's position.
export const requestLaunch = (state, { id, articleId, pad, tracking, cost, replacementCost }) => {
  const a = article(state, articleId);
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
  const money = assessFlight(state, { cost, replacementCost });
  const launch = {
    id, articleId, programmeId: a.programmeId, vehicle: a.vehicle, stages: { ...a.stages }, experimental, cost, replacementCost,
    status: 'awaiting-decision', day: state.day, outcome: null, jobId: null, rangeAction: null,
    tiers: {
      'ground-technical': position(tech.blockers, tech.gaps.length ? `known gaps: ${tech.gaps.join('; ')}` : 'supported'),
      'ground-operational': { stance: 'approve', reason: 'pad and tracking ready' },
      'ground-executive': { stance: money.affordable ? 'approve' : 'veto', reason: money.text },
      flight: VEHICLES[a.vehicle].crewed ? { stance: 'pending', reason: 'crew consent' } : { stance: 'inactive', reason: 'uncrewed vehicle' },
    },
    reservations: [padRes.id, trackRes.id],
  };
  state.launches.push(launch);
  const d = openDecision(state, { type: 'launch', subject: id, raisedBy: 'flight-control', vetoable: true,
    text: `Launch ${VEHICLES[a.vehicle].name} ${articleId}${programmeName(state, a.programmeId) === VEHICLES[a.vehicle].name ? '' : ` for ${programmeName(state, a.programmeId)}`} (${experimental ? 'experimental' : 'routine'} flight, costing ${dollars(cost)}). ${money.text}`,
    finance: launch.tiers['ground-executive'], technical: launch.tiers['ground-technical'], effect: { kind: 'launch', payload: { id } } });
  return { decision: d.id };
};

export const launchRecord = (state, id) => state.launches.find(l => l.id === id);

// Approved: pay for the flight, record the exposure, and fly.
export const executeLaunch = (state, { id }) => {
  const l = launchRecord(state, id);
  commit(state, { id: `launch-cost-${id}`, dept: 'flight-control', programmeId: l.programmeId, payments: [{ amount: l.cost, due: state.day }] }, { approved: true });
  recordExposure(state, id, l.replacementCost, l.tiers['ground-executive'].reason);
  const telemetry = [...new Set(Object.values(l.stages).flatMap(r => REVISIONS[r].telemetry))];
  const j = startJob(state, { id: `flight-${id}`, kind: 'flight', programmeId: l.programmeId, reservations: l.reservations,
    plan: { kind: 'flight', vehicle: l.vehicle, stages: l.stages, conditions: { ...FLIGHT_CONDITIONS }, channels: [...TRACKING_CHANNELS, ...telemetry] } });
  // Flight Control invites the administrator to the blockhouse (freeze §8.3, §10.3). Watching changes nothing.
  Object.assign(l, { status: 'in-flight', jobId: j.id, launchDay: state.day, invitation: 'open' });
  article(state, l.articleId).status = 'flying';
};

export const answerInvitation = (state, { launchId, attend }) => {
  const l = launchRecord(state, launchId);
  if (!l || l.invitation !== 'open') throw new Rejection(`There is no open invitation for ${launchId}`);
  l.invitation = attend ? 'attending' : 'apologies';
};

// The outcome is what tracking and telemetry showed, not hidden truth.
export const completeFlight = (state, j) => {
  const l = state.launches.find(x => x.jobId === j.id);
  const obs = j.observations.map(id => state.evidence.observations.find(o => o.id === id));
  const of = q => obs.find(o => o.quantity === q);
  const dev = of('vehicle.deviation'), apogee = of('vehicle.apogee');
  if (dev.state === 'measured' && !dev.normal) l.rangeAction = 'range-safety destruct';
  l.outcome = l.rangeAction ? 'failure' : apogee.state === 'measured' && apogee.normal ? 'success' : apogee.state === 'measured' ? 'failure' : 'indeterminate';
  l.status = 'flown';
  if (l.invitation === 'open') l.invitation = 'lapsed';
  article(state, l.articleId).status = l.outcome === 'failure' ? 'lost' : 'expended';
  resolveExposure(state, l.id, l.outcome);
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
