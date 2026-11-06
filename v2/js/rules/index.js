// The façade (freeze §10.1): the only module the UI imports. Commands in, projections out.
// dispatch and advance never mutate the state they are given.

import { newStreams } from '../core/rng.js';
import { fiscalQuarter } from '../core/calendar.js';
import { exportSave, parseSave, parseV1Save, writeSave, readSave, importSave, resetSave, SaveError } from '../core/save.js';
import { ACTS, ANCHORS, CLOSING_ANCHOR } from '../data/scenario.js';
import { TUNING } from '../data/tuning.js';
import { REVISIONS, testFacility } from '../data/vehicles.js';
import { ROLES, Rejection, initAuthority, decide, memo, openDecision, position } from './authority.js';
import { initPhysical } from './physics.js';
import { initEvidence } from './evidence.js';
import { initBeliefs, readiness } from './belief.js';
import { initHardware, proposeRevision, defineRevision, approveTrial, adopt, buildArticle } from './hardware.js';
import { initProduction, recordFinding, holdBatch, releaseBatch, storeArticle, completeReuse, completeRecycle } from './production.js';
import { initFacilities, reserve, displace, beginUpgrade, finishUpgrade, addUnit, commissioned, checkUpgrade, checkUnit, buildCost, upgradeCost, abandonFacilityWork } from './facilities.js';
import { initFiscal, startQuarter, payDue, closeYear, commit, cancelCommitment, supplementary, assessCommitment } from './fiscal.js';
import { initStock, reserveStock, consumeStock } from './stock.js';
import * as programme from './programme.js';
import { initDelegation, appoint, checkDelegation, isDelegated, recordFailure } from './delegation.js';
import { initLaunches, requestLaunch, executeLaunch, completeFlight, standDown, answerInvitation, abortFlight, launchRecord } from './launch.js';
import { crewDay, selectCrew, checkTraining, startTraining, finishTraining, trainingDays, requestCrewReadiness, declareReady, escapeMode, abortCall } from './crew.js';
import { startJob, advanceWork, pauseJob, resumeJob, cancelJob, job } from './work.js';
import { initContinuation, conclude } from './summary.js';
import { project as projectPublic } from './project.js';
import { jobReport } from './reports.js';
import { programmeName, money, unitName } from './reports.js';
import { initAssurance, assuranceDay, challengeRiskAcceptance, answerChallenge } from './assurance.js';
import { initStaff, staffDay, approveProposal, declineProposal, quarterReport } from './staff.js';
import { openFresh, openFromV1, inheritedStatus } from './opening.js';
import { militaryDay } from './military.js';
import { setChecking, positionRecovery } from './operations.js';
import { scopeInFlight, cutShort } from './mission.js';
import { raceDay, projectRace } from './race.js';
import { STREAMS } from '../core/rng.js';
import { RECOVERY_FORCES, ENTRY_DESIGN, RETROFIRE, MISSIONS } from '../data/flight.js';
import { publicPerson } from './people.js';
import { dateLabel } from '../core/calendar.js';
import { VEHICLES } from '../data/vehicles.js';
import { CANDIDATES, SELECTIONS } from '../data/crew.js';

export { Rejection };

const v1Shape = seed => ({
  day: 0, seed, act: ACTS[0].id, concluded: false, rng: newStreams(seed),
  physical: initPhysical(), evidence: initEvidence(), beliefs: initBeliefs(),
  hardware: initHardware(), production: initProduction(), facilities: initFacilities(),
  fiscal: initFiscal(0), stock: initStock(), programmes: programme.initProgrammes(), delegation: initDelegation(),
  ...initAuthority(), work: [], launches: initLaunches(), commands: [], continuation: initContinuation(), staff: initStaff(), assurance: initAssurance(),
});

// What the administrator hears on the first day, whichever way V2 opens.
const briefing = state => {
  const items = inheritedStatus(state).filter(i => i.status === 'open');
  const heads = Object.values(state.people).filter(p => p.kind === 'head').map(p => p.name);
  memo(state, { from: 'technical-director', refs: { opening: state.opening.kind },
    text: `${dateLabel(state.day)}. The National Aeronautics and Space Administration begins operations, and you are its administrator. `
      + `${state.opening.kind === 'v1-import' ? 'We carry forward everything the agency built, flew and owes since 1945.' : 'We take over the people, sites and obligations of the agencies NASA absorbs.'} `
      + `Your heads are ${heads.join(', ')}. NACA's laboratories come to us today. `
      + `${items.length ? `We inherit ${items.length} open question${items.length > 1 ? 's' : ''}: unsettled obligations, disagreements and claims nobody has tested. They are in Records, and they stay open until someone settles them.` : 'We inherit no open questions.'} `
      + 'A crewed spaceflight programme is coming to you for decision within the week.' });
};

const begin = state => {
  programme.arrivals(state);
  briefing(state);
  // A V1 save has already had today's quarter report; a fresh start has not.
  if (state.opening.kind === 'fresh') quarterReport(state);
  staffDay(state, staffCommand);
  return state;
};

// A fresh start (V2 freeze §3): the standard, authored 1958 agency.
export const newGame = (seed = 19581966) => {
  const state = openFresh(v1Shape(seed), seed);
  state.act = ACTS[0].id;
  startQuarter(state);
  return begin(state);
};

// Continue from a V1 save that reached NASA formation. Reads the text; never writes V1 storage.
export const continueFromV1 = (v1Text, seed = 19581966) => {
  const state = openFromV1(parseV1Save(v1Text), seed);
  state.act = ACTS[0].id;
  const opened = begin(state);
  try { validateState(opened); } catch (e) { throw new SaveError(`The V1 save is damaged: ${e.message}`); }
  return opened;
};

const clone = s => structuredClone(s);
const configOf = (state, programmeId, stages = {}) => {
  const p = programme.programme(state, programmeId);
  return { vehicle: p.vehicle, stages: { ...p.baseline, ...stages } };
};

// What an approved decision does. Effects run only after authority.decide has accepted the choice.
const EFFECTS = {
  none: () => {},
  commit: (s, req) => commit(s, req, { approved: true }),
  displace,
  launch: executeLaunch,
  'preliminary-accept': programme.preliminaryAccept,
  greenlight: programme.greenlight,
  'apply-change': programme.applyChange,
  stop: programme.beginClosure,
  'approve-trial': (s, { revId }) => approveTrial(s, revId),
  'accept-risk': (s, { observations }) => { (s.beliefs.assessed ??= []).push(...observations); },
  adopt: (s, { revId, programmeIds }) => adopt(s, revId, programmeIds),
  'facility-work': startFacilityWork,
  'select-crew': selectCrew,
  'crew-ready': declareReady,
  'cut-short': cutShort,
};

// Facility work is paid for (freeze §6.4, §7.2): a deposit when it starts and the balance due at completion.
// A consequential or future-year commitment goes to a joint decision first, and the work starts only on approval.
const FACILITY_START = {
  upgrade: (s, { unitId, capacityAfter }) => beginUpgrade(s, unitId, capacityAfter),
  commissioning: (s, unit) => addUnit(s, unit),
};
function startFacilityWork(s, { jobId, kind, unit, req }) {
  FACILITY_START[kind](s, unit);
  commit(s, req, { approved: true });
  return startJob(s, { id: jobId, kind, days: TUNING.jobDays[kind], payload: { unitId: unit.unitId ?? unit.id } }).id;
}
const facilityWork = (s, { jobId, kind, unit, cost, what }) => {
  const deposit = Math.round(cost * TUNING.facilityDepositShare);
  const req = { id: `facility-${jobId}`, dept: 'technical', kind: 'facility', workId: jobId,
    payments: [{ amount: deposit, due: s.day }, { amount: cost - deposit, due: s.day + TUNING.jobDays[kind] }] };
  const a = assessCommitment(s, req);
  if (a.blockers.length) throw new Rejection(`Finance cannot commit: ${a.blockers.join('; ')}`);
  const work = { jobId, kind, unit, req };
  if (!a.needsDecision) return startFacilityWork(s, work);
  const d = openDecision(s, { type: 'funding-commitment', subject: req.id, raisedBy: 'technical-director', vetoable: true,
    text: `The technical director asks to commit ${money(cost)} to ${what}${a.futureYear ? ', with the balance due in a future year' : ''}.`,
    finance: position([], a.futureYear ? 'future-year exposure presented to the administrator' : 'affordable within the award'),
    technical: position([]), effect: { kind: 'facility-work', payload: work } });
  return { decision: d.id };
};

const financeOnCost = (s, cost) => (cost > s.fiscal.award && !s.fiscal.multiYearAuthority ? ['cost exceeds the annual award'] : []);

// Each command: who may issue it, whether delegated teams may, and what it does.
const TEAM = ['department-head', 'project-manager'];
const COMMANDS = {
  decide: { roles: ['administrator'], run: (s, { decisionId, choice, consequence }, actor) => {
    const d = decide(s, decisionId, choice, actor, consequence);
    if (d.choice === d.options[0] && d.effect) EFFECTS[d.effect.kind](s, d.effect.payload);
    if (d.type === 'failure-review' && d.choice === 'accept-known-risk') challengeRiskAcceptance(s, d, d.effect.payload.observations);
    if (d.type === 'assurance-challenge') answerChallenge(s, d);
    if (d.type === 'launch') standDown(s);
    return d.id;
  } },
  'create-programme': { roles: ['administrator', 'department-head'], run: (s, p, actor) =>
    programme.createProgramme(s, { ...p, source: actor === 'administrator' ? 'objective' : 'initiative' }).id },
  'authorise-feasibility': { roles: ['administrator'], run: (s, { programmeId }) => programme.authoriseFeasibility(s, programmeId) },
  'complete-case': { roles: ['technical-director', 'financial-officer'], run: (s, { programmeId, summary }, actor) =>
    programme.completeCase(s, programmeId, actor === 'technical-director' ? 'engineering' : 'funding', summary) },
  'record-meeting': { roles: ['administrator', 'project-manager'], run: (s, { programmeId, ...m }) => programme.recordMeeting(s, programmeId, m) },
  'submit-dossier': { roles: ['administrator', 'project-manager'], run: (s, { programmeId }) =>
    programme.submitDossier(s, programmeId, { financeBlockers: financeOnCost(s, programme.programme(s, programmeId).meeting?.cost ?? 0) }) },
  'extend-window': { roles: ['administrator'], run: (s, { programmeId, ...x }) => programme.extendWindow(s, programmeId, x) },
  'request-greenlight': { roles: ['administrator', 'project-manager'], run: (s, { programmeId }) =>
    programme.requestGreenlight(s, programmeId, { financeBlockers: financeOnCost(s, programme.programme(s, programmeId).meeting?.cost ?? 0) }) },
  'request-change': { roles: ['administrator', 'project-manager'], run: (s, { programmeId, ...c }) => programme.requestChange(s, programmeId, c) },
  'recommend-stop': { roles: ['project-manager', 'technical-director', 'financial-officer'], run: (s, { programmeId, reason }, actor) => programme.recommendStop(s, programmeId, actor, reason) },
  'complete-closure-step': { roles: ROLES, run: (s, { programmeId, step, output }, actor) => programme.completeClosureStep(s, programmeId, step, actor, output) },
  'resolve-obligation': { roles: ['administrator', 'financial-officer'], run: (s, { programmeId, obligationId, ...r }) => programme.resolveObligation(s, programmeId, obligationId, r) },
  appoint: { roles: ['administrator'], run: (s, a) => { const r = appoint(s, a); return r.id; } },

  'propose-revision': { roles: ['department-head'], run: (s, { revId, reason }, actor) => proposeRevision(s, revId, actor, reason) },
  'approve-prototype': { roles: ['technical-director'], run: (s, { programmeId, revId }) => {
    const r = readiness(s, 'prototype', configOf(s, programmeId, { [REVISIONS[revId].stage]: revId }), revId);
    if (!r.ready) throw new Rejection(`Not ready to prototype: ${r.blockers.join('; ')}`);
    defineRevision(s, revId);
  } },
  'request-trial': { roles: ['department-head'], run: (s, { programmeId, revId }) => {
    const r = readiness(s, 'experimental-flight', configOf(s, programmeId, { [REVISIONS[revId].stage]: revId }), revId);
    return openDecision(s, { type: 'trial', subject: revId, raisedBy: 'department-head', vetoable: true,
      text: `Authorise an experimental flight of ${REVISIONS[revId].label}? Approving a trial does not adopt the revision.`,
      finance: position([]), technical: position(r.blockers, r.gaps.length ? `known gaps: ${r.gaps.join('; ')}` : 'supported'),
      effect: { kind: 'approve-trial', payload: { revId } } }).id;
  } },
  'adopt-revision': { roles: ['administrator'], run: (s, { revId, programmeIds }) => {
    const flown = s.launches.some(l => l.outcome === 'success' && Object.values(l.stages).includes(revId));
    const config = configOf(s, programmeIds[0], { [REVISIONS[revId].stage]: revId });
    const blockers = [...readiness(s, 'experimental-flight', config, revId).blockers, ...(flown ? [] : ['no authorised flight has demonstrated it'])];
    return openDecision(s, { type: 'deployment', subject: revId, raisedBy: 'administrator', vetoable: true,
      text: `Adopt ${REVISIONS[revId].label} for ${programmeIds.map(id => programmeName(s, id)).join(', ')}? Articles already built keep their revisions.`,
      finance: position([]), technical: position(blockers), effect: { kind: 'adopt', payload: { revId, programmeIds } } }).id;
  } },
  'build-article': { roles: ['administrator', 'production'], delegated: TEAM, run: (s, a) => buildArticle(s, a).id },
  'record-finding': { roles: ['production', 'department-head'], run: (s, f) => recordFinding(s, f).id },
  'hold-batch': { roles: ['production'], run: (s, { batchId, reason }) => holdBatch(s, batchId, reason) },
  'release-batch': { roles: ['production', 'administrator'], run: (s, { batchId }) => releaseBatch(s, batchId) },
  'store-article': { roles: ['production'], run: (s, { articleId }) => storeArticle(s, articleId) },
  'reuse-article': { roles: ['production', 'department-head'], run: (s, { jobId, articleId, programmeId, reservation }) =>
    startJob(s, { id: jobId, kind: 'integration-assessment', programmeId, days: TUNING.jobDays['integration-assessment'], reservations: [reservation], payload: { articleId, programmeId } }).id },
  'recycle-article': { roles: ['production'], run: (s, { jobId, articleId }) =>
    startJob(s, { id: jobId, kind: 'recycle', days: TUNING.jobDays.recycle, payload: { articleId } }).id },

  'reserve-facility': { roles: ['administrator', 'technical-director'], delegated: TEAM, run: (s, r) => reserve(s, r) },
  'schedule-test': { roles: ['administrator', 'technical-director'], delegated: TEAM, run: (s, { jobId, programmeId, stage, stages, conditions, channels, reservation }) => {
    const r = s.facilities.reservations.find(x => x.id === reservation);
    const kind = testFacility(stage);
    if (!r || r.status !== 'held' || r.programmeId !== programmeId || s.facilities.units[r.unitId].kind !== kind) throw new Rejection(`A ground test of this stage needs a held ${kind} reservation`);
    const config = configOf(s, programmeId, stages);
    for (const rev of Object.values(config.stages)) if (s.hardware.revisions[rev]?.status !== 'defined') throw new Rejection(`${rev} has no defined prototype`);
    return startJob(s, { id: jobId, kind: 'ground-test', programmeId, reservations: [reservation], plan: { kind: 'ground', ...config, stage, conditions, channels } }).id;
  } },
  'request-launch': { roles: ['administrator', 'project-manager'], delegated: ['department-head'], run: (s, l) => requestLaunch(s, l) },
  'answer-invitation': { roles: ['administrator'], run: (s, a) => answerInvitation(s, a) },
  'pause-work': { roles: ['administrator', 'technical-director'], run: (s, { jobId, preserve }) => pauseJob(s, jobId, { preserve }) },
  'resume-work': { roles: ['administrator', 'technical-director'], run: (s, { jobId }) => {
    const r = resumeJob(s, jobId);
    if (r.preservationCost) commit(s, { id: `preserve-${jobId}-${s.day}`, dept: 'technical', programmeId: job(s, jobId).programmeId, kind: 'preservation', payments: [{ amount: r.preservationCost, due: s.day }] }, { approved: true });
    return r;
  } },
  'begin-upgrade': { roles: ['administrator', 'technical-director'], run: (s, { jobId, unitId, capacityAfter }) => {
    checkUpgrade(s, unitId);
    return facilityWork(s, { jobId, kind: 'upgrade', unit: { unitId, capacityAfter }, cost: upgradeCost(s, unitId, capacityAfter), what: `upgrading ${unitName(s, unitId)}` });
  } },
  'add-facility': { roles: ['administrator'], run: (s, { jobId, ...u }) => {
    checkUnit(s, u);
    return facilityWork(s, { jobId, kind: 'commissioning', unit: u, cost: buildCost(u.kind, u.capacity), what: `building ${u.id}` });
  } },

  'commit-funds': { roles: ['administrator', 'financial-officer', 'department-head'], run: (s, req) => commit(s, req) },
  'cancel-commitment': { roles: ['administrator', 'financial-officer'], run: (s, { commitmentId }) => {
    const c = s.fiscal.commitments[commitmentId];
    const r = cancelCommitment(s, commitmentId);
    if (c.workId) {
      const j = s.work.find(x => x.id === c.workId);
      if (j && FACILITY_START[j.kind] && j.status !== 'done') abandonFacilityWork(s, j.kind, j.payload.unitId);
      cancelJob(s, c.workId);
    }
    return r;
  } },
  'reserve-stock': { roles: ['administrator', 'department-head', 'production'], run: (s, r) => reserveStock(s, r) },
  'consume-stock': { roles: ['department-head', 'production'], run: (s, r) => consumeStock(s, r) },
  // ---- V2 crew (V2 freeze §4, §5, §7) ----
  'select-crew': { roles: ['administrator'], run: (s, sel) => selectCrew(s, sel) },
  'train-crew': { roles: ['administrator', 'department-head'], run: (s, { jobId, vehicle, crew }) => {
    checkTraining(s, { vehicle, crew });
    startTraining(s, { crew });
    return startJob(s, { id: jobId, kind: 'crew-training', days: trainingDays(vehicle), payload: { vehicle, crew: [...crew] } }).id;
  } },
  'request-crew-readiness': { roles: ['administrator', 'technical-director', 'department-head'], run: (s, { programmeId }) => requestCrewReadiness(s, { programmeId }) },
  // Only the crew can call it, and nothing undoes it.
  'crew-abort': { roles: ['crew'], run: (s, { launchId, by }) => {
    const l = launchRecord(s, launchId);
    if (!l || l.status !== 'in-flight') throw new Rejection(`${launchId} is not in flight`);
    if (!l.crew?.includes(by)) throw new Rejection(`${by} is not aboard ${launchId}`);
    const j = job(s, l.jobId);
    const evidence = j.observations.filter(id => { const o = s.evidence.observations.find(x => x.id === id); return o.state === 'measured' && !o.normal; });
    const mode = escapeMode(l, j);
    cancelJob(s, j.id);
    abortFlight(s, l, j, { by, mode, evidence, early: j.read > 1 });
    return mode;
  } },
  // Entry and recovery (V2 freeze §6.3, §6.4): the administrator sets the checking habit and where recovery waits.
  'set-retrofire-checking': { roles: ['administrator'], run: (s, p) => setChecking(s, p) },
  'position-recovery': { roles: ['administrator', 'flight-control'], run: (s, p) => positionRecovery(s, p) },
  'report-delegation-failure': { roles: ['technical-director'], run: (s, { programmeId, ...f }) => recordFailure(s, programmeId, f) },

  // A team's proposed next step (freeze §2.2, §5.1): the go-ahead carries it out through the commands above.
  'approve-proposal': { roles: ['administrator'], run: (s, { proposalId }) => approveProposal(s, staffCommand, proposalId) },
  'decline-proposal': { roles: ['administrator'], run: (s, { proposalId }) => declineProposal(s, proposalId) },
};

export const COMMAND_TYPES = Object.keys(COMMANDS);

const permitted = (s, cmd, spec) => spec.roles.includes(cmd.actor)
  || (spec.delegated?.includes(cmd.actor) && isDelegated(s, cmd.payload?.programmeId ?? s.hardware.articles[cmd.payload?.articleId]?.programmeId));

// Staff act through the same command table, inside their own authority, on the state they are given.
function staffCommand(s, type, actor, payload) {
  const spec = COMMANDS[type], cmd = { type, actor, payload };
  if (!permitted(s, cmd, spec)) throw new Rejection(`${actor} may not ${type}`, 'authority');
  const result = spec.run(s, payload, actor);
  s.commands.push({ id: `staff-${s.commands.length + 1}`, type, actor, day: s.day, by: 'staff' });
  return result;
}

// Apply an authorised command. A rejection returns the original state untouched.
export const dispatch = (state, cmd) => {
  const spec = COMMANDS[cmd?.type];
  const reject = (reason, needed = null) => ({ state, rejection: { reason, needed } });
  if (!spec) return reject(`Unknown command ${cmd?.type}`);
  if (typeof cmd.id !== 'string' || !cmd.id) return reject('A command needs a stable id');
  if (state.commands.some(c => c.id === cmd.id)) return reject(`Command ${cmd.id} was already applied`);
  if (state.concluded) return reject('The campaign has concluded');
  if (!permitted(state, cmd, spec)) return reject(`${cmd.actor} may not ${cmd.type}`, 'authority');
  const next = clone(state);
  const memos = next.memos.length, decisions = next.decisions.length;
  try {
    const result = spec.run(next, cmd.payload ?? {}, cmd.actor);
    next.commands.push({ id: cmd.id, type: cmd.type, actor: cmd.actor, day: next.day });
    return { state: next, result, events: [...next.memos.slice(memos), ...next.decisions.slice(decisions)] };
  } catch (e) {
    if (e instanceof Rejection) return reject(e.message, e.needed);
    throw e;
  }
};

const COMPLETIONS = {
  flight: (s, j) => {
    const l = completeFlight(s, j);
    if (l.outcome === 'failure' && isDelegated(s, l.programmeId)) recordFailure(s, l.programmeId, { beyondRemit: true, text: `${l.id} failed` });
  },
  'integration-assessment': (s, j) => completeReuse(s, j.payload),
  recycle: (s, j) => completeRecycle(s, j.payload),
  upgrade: (s, j) => finishUpgrade(s, j.payload.unitId),
  commissioning: (s, j) => commissioned(s, j.payload.unitId),
  'ground-test': () => {},
  'crew-training': (s, j) => finishTraining(s, j.payload),
};

// In a crewed flight, each crew member reads the instruments for themselves: an abnormal reading may bring
// their own abort call, which goes through the crew's command and binds (V2 freeze §4).
const crewInFlight = (s, before) => {
  for (const l of s.launches.filter(x => x.status === 'in-flight' && x.crew?.length)) {
    const j = s.work.find(x => x.id === l.jobId);
    if (!j || j.status !== 'running') continue;
    const fresh = j.observations.slice(before[j.id] ?? 0).map(id => s.evidence.observations.find(o => o.id === id)).filter(o => o.state === 'measured' && !o.normal);
    if (!fresh.length) continue;
    const by = l.crew.find(pid => abortCall(s, s.people[pid], fresh));
    if (by) staffCommand(s, 'crew-abort', 'crew', { launchId: l.id, by });
    // Otherwise the crew's view on the mission's scope is advice (V2 freeze §4).
    else if (l.mission) scopeInFlight(s, l, j, fresh, cutShort);
  }
};

const oneDay = s => {
  s.day += 1;
  const q = fiscalQuarter(s.day);
  if (q.start === s.day) { if (q.fy !== s.fiscal.fy) closeYear(s); startQuarter(s); quarterReport(s); }
  s.act = [...ACTS].reverse().find(a => s.day >= a.from).id;
  programme.arrivals(s);
  programme.designsReady(s);
  programme.lapseWindows(s);
  const before = Object.fromEntries(s.work.filter(j => j.status === 'running').map(j => [j.id, j.observations.length]));
  for (const j of advanceWork(s)) { COMPLETIONS[j.kind](s, j); jobReport(s, j); }
  crewInFlight(s, before);
  payDue(s);
  standDown(s);
  militaryDay(s);
  crewDay(s);
  raceDay(s);
  for (const p of Object.values(s.programmes)) if (p.vehicle && p.stage === 'greenlit') checkDelegation(s, p.id);
  assuranceDay(s);
  if (!s.concluded) staffDay(s, staffCommand);
  for (const a of ANCHORS.filter(x => x.day === s.day)) {
    memo(s, { from: 'administrator-office', text: a.text, refs: { anchor: a.id } });
    if (a.supplementary) supplementary(s, a.supplementary, a.id);
    if (a.id === CLOSING_ANCHOR) conclude(s);
  }
};

// Advance whole days. Stops at the campaign conclusion.
export const advance = (state, days = 1) => {
  const s = clone(state);
  const memos = s.memos.length, decisions = s.decisions.length;
  for (let i = 0; i < days && !s.concluded; i++) oneDay(s);
  return { state: s, events: [...s.memos.slice(memos), ...s.decisions.slice(decisions)] };
};

// V2 additions to the projection: people without their traits, the opening, inherited items and military records.
export const project = state => {
  const { physical, people = {}, ...rest } = state;
  // Teams' status reads the astronaut office to say what they would do next; the projection itself never copies people.
  return { ...projectPublic(clone({ ...rest, people })),
    people: Object.values(people).map(publicPerson),
    opening: state.opening ? { kind: state.opening.kind, day: state.opening.day, v1Summary: state.opening.v1Summary ?? null } : null,
    inherited: inheritedStatus(state),
    operations: state.operations ? { retrofireChecking: state.operations.retrofireChecking,
      recoveryForces: Object.entries(RECOVERY_FORCES).map(([id, f]) => ({ id, name: f.name, cost: f.cost })), comesHome: Object.keys(ENTRY_DESIGN),
      checkCost: RETROFIRE.independentCheckCost, missions: structuredClone(MISSIONS) } : null,
    // Demonstrated capabilities with their scope (V2 freeze §5), and what the agency knows of the race (§8).
    capabilities: structuredClone(state.capabilities ?? []),
    race: state.race ? projectRace(state.race) : null,
    military: (state.military?.flights ?? []).map(f => ({ ...f, name: VEHICLES[f.vehicle].name, date: dateLabel(f.day) })),
    // An open selection shows every applicant's record, never their traits.
    selection: state.decisions.filter(d => d.type === 'crew-selection' && d.status === 'open').map(d => ({ decisionId: d.id, group: d.subject,
      picks: SELECTIONS.find(g => g.id === d.subject).picks, recommended: d.effect.payload.ids,
      candidates: CANDIDATES.filter(c => c.group === d.subject).map(c => ({ id: c.id, name: c.name, record: structuredClone(c.record), medical: c.medical })) })),
    crewReadiness: (state.crew?.readiness ?? []).map(r => ({ vehicle: VEHICLES[r.vehicle].name, stages: { ...r.stages }, day: r.day })) };
};

// Shape check on load: every section present with the right type, and running tests have their traces.
export const validateState = s => {
  const need = (ok, what) => { if (!ok) throw new Error(what); };
  need(s && Number.isInteger(s.day) && s.day >= 0, 'day');
  for (const k of ['physical', 'evidence', 'beliefs', 'hardware', 'production', 'facilities', 'fiscal', 'stock', 'programmes', 'delegation', 'continuation']) need(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), k);
  for (const k of ['decisions', 'memos', 'work', 'launches', 'commands']) need(Array.isArray(s[k]), k);
  for (const k of ['people', 'military', 'opening', 'crew', 'operations', 'race']) need(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), k);
  need(Array.isArray(s.inherited), 'inherited');
  need(Array.isArray(s.capabilities), 'capabilities');
  for (const k of STREAMS) need(s.rng?.[k]?.algorithm === 'mulberry32-v1' && Number.isInteger(s.rng[k].state), `rng.${k}`);
  need(Array.isArray(s.evidence.observations), 'evidence.observations');
  for (const j of s.work.filter(x => x.status === 'running' && x.plan)) need(Array.isArray(s.physical.traces[j.id]), `trace for ${j.id}`);
  // The shape check cannot see every record, so make sure the save can actually be shown before it is accepted.
  try { project(s); } catch { throw new Error('its records cannot be shown'); }
};

export const saveGame = (state, storage) => writeSave(storage, state);
export const loadGame = storage => readSave(storage, validateState);
export const exportGame = state => exportSave(state);
export const importGame = (storage, text) => importSave(storage, text, validateState);
export const resetGame = storage => resetSave(storage);
export const checkSave = text => parseSave(text, validateState);
