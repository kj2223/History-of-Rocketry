// The façade (freeze §10.1): the only module the UI imports. Commands in, projections out.
// dispatch and advance never mutate the state they are given.

import { newStreams } from '../core/rng.js';
import { fiscalQuarter } from '../core/calendar.js';
import { exportSave, parseSave, writeSave, readSave, importSave, resetSave } from '../core/save.js';
import { ACTS, ANCHORS } from '../data/scenario.js';
import { TUNING } from '../data/tuning.js';
import { REVISIONS } from '../data/vehicles.js';
import { ROLES, Rejection, initAuthority, decide, memo, openDecision, position } from './authority.js';
import { initPhysical } from './physics.js';
import { initEvidence } from './evidence.js';
import { initBeliefs, readiness } from './belief.js';
import { initHardware, proposeRevision, defineRevision, approveTrial, adopt, buildArticle } from './hardware.js';
import { initProduction, recordFinding, holdBatch, releaseBatch, storeArticle, completeReuse, completeRecycle } from './production.js';
import { initFacilities, reserve, displace, beginUpgrade, finishUpgrade, addUnit, commissioned } from './facilities.js';
import { initFiscal, startQuarter, payDue, closeYear, commit, cancelCommitment, supplementary } from './fiscal.js';
import { initStock, reserveStock, consumeStock } from './stock.js';
import * as programme from './programme.js';
import { initDelegation, appoint, checkDelegation, isDelegated, recordFailure } from './delegation.js';
import { initLaunches, requestLaunch, executeLaunch, completeFlight } from './launch.js';
import { startJob, advanceWork, pauseJob, resumeJob, cancelJob, job } from './work.js';
import { initContinuation, conclude } from './summary.js';
import { project as projectPublic } from './project.js';
import { jobReport } from './reports.js';
import { programmeName } from './reports.js';

export { Rejection };

export const newGame = (seed = 19451958) => {
  const state = {
    day: 0, seed, act: ACTS[0].id, concluded: false, rng: newStreams(seed),
    physical: initPhysical(), evidence: initEvidence(), beliefs: initBeliefs(),
    hardware: initHardware(), production: initProduction(), facilities: initFacilities(),
    fiscal: initFiscal(0), stock: initStock(), programmes: programme.initProgrammes(), delegation: initDelegation(),
    ...initAuthority(), work: [], launches: initLaunches(), commands: [], continuation: initContinuation(),
  };
  startQuarter(state);
  programme.arrivals(state);
  return state;
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
  adopt: (s, { revId, programmeIds }) => adopt(s, revId, programmeIds),
};

const financeOnCost = (s, cost) => (cost > s.fiscal.award && !s.fiscal.multiYearAuthority ? ['cost exceeds the annual award'] : []);

// Each command: who may issue it, whether delegated teams may, and what it does.
const TEAM = ['department-head', 'project-manager'];
const COMMANDS = {
  decide: { roles: ['administrator'], run: (s, { decisionId, choice, consequence }, actor) => {
    const d = decide(s, decisionId, choice, actor, consequence);
    if (d.choice === d.options[0] && d.effect) EFFECTS[d.effect.kind](s, d.effect.payload);
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
    if (!r || r.status !== 'held' || r.programmeId !== programmeId || s.facilities.units[r.unitId].kind !== 'static-stand') throw new Rejection('A ground test needs a held static-stand reservation');
    const config = configOf(s, programmeId, stages);
    for (const rev of Object.values(config.stages)) if (s.hardware.revisions[rev]?.status !== 'defined') throw new Rejection(`${rev} has no defined prototype`);
    return startJob(s, { id: jobId, kind: 'ground-test', programmeId, reservations: [reservation], plan: { kind: 'ground', ...config, stage, conditions, channels } }).id;
  } },
  'request-launch': { roles: ['administrator', 'project-manager'], delegated: ['department-head'], run: (s, l) => requestLaunch(s, l) },
  'pause-work': { roles: ['administrator', 'technical-director'], run: (s, { jobId, preserve }) => pauseJob(s, jobId, { preserve }) },
  'resume-work': { roles: ['administrator', 'technical-director'], run: (s, { jobId }) => {
    const r = resumeJob(s, jobId);
    if (r.preservationCost) commit(s, { id: `preserve-${jobId}-${s.day}`, dept: 'technical', programmeId: job(s, jobId).programmeId, kind: 'preservation', payments: [{ amount: r.preservationCost, due: s.day }] }, { approved: true });
    return r;
  } },
  'begin-upgrade': { roles: ['administrator', 'technical-director'], run: (s, { jobId, unitId, capacityAfter }) => {
    beginUpgrade(s, unitId, capacityAfter);
    return startJob(s, { id: jobId, kind: 'upgrade', days: TUNING.jobDays.upgrade, payload: { unitId } }).id;
  } },
  'add-facility': { roles: ['administrator'], run: (s, { jobId, ...u }) => {
    addUnit(s, u);
    return startJob(s, { id: jobId, kind: 'commissioning', days: TUNING.jobDays.commissioning, payload: { unitId: u.id } }).id;
  } },

  'commit-funds': { roles: ['administrator', 'financial-officer', 'department-head'], run: (s, req) => commit(s, req) },
  'cancel-commitment': { roles: ['administrator', 'financial-officer'], run: (s, { commitmentId }) => {
    const c = s.fiscal.commitments[commitmentId];
    const r = cancelCommitment(s, commitmentId);
    if (c.workId) cancelJob(s, c.workId);
    return r;
  } },
  'reserve-stock': { roles: ['administrator', 'department-head', 'production'], run: (s, r) => reserveStock(s, r) },
  'consume-stock': { roles: ['department-head', 'production'], run: (s, r) => consumeStock(s, r) },
  'report-delegation-failure': { roles: ['technical-director'], run: (s, { programmeId, ...f }) => recordFailure(s, programmeId, f) },
};

export const COMMAND_TYPES = Object.keys(COMMANDS);

const permitted = (s, cmd, spec) => spec.roles.includes(cmd.actor)
  || (spec.delegated?.includes(cmd.actor) && isDelegated(s, cmd.payload?.programmeId ?? s.hardware.articles[cmd.payload?.articleId]?.programmeId));

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
};

const oneDay = s => {
  s.day += 1;
  const q = fiscalQuarter(s.day);
  if (q.start === s.day) { if (q.fy !== s.fiscal.fy) closeYear(s); startQuarter(s); }
  s.act = [...ACTS].reverse().find(a => s.day >= a.from).id;
  programme.arrivals(s);
  programme.lapseWindows(s);
  for (const j of advanceWork(s)) { COMPLETIONS[j.kind](s, j); jobReport(s, j); }
  payDue(s);
  for (const p of Object.values(s.programmes)) if (p.vehicle && p.stage === 'greenlit') checkDelegation(s, p.id);
  for (const a of ANCHORS.filter(x => x.day === s.day)) {
    memo(s, { from: 'administrator-office', text: a.text, refs: { anchor: a.id } });
    if (a.supplementary) supplementary(s, a.supplementary, a.id);
    if (a.id === 'nasa-formation') conclude(s);
  }
};

// Advance whole days. Stops at the campaign conclusion.
export const advance = (state, days = 1) => {
  const s = clone(state);
  const memos = s.memos.length, decisions = s.decisions.length;
  for (let i = 0; i < days && !s.concluded; i++) oneDay(s);
  return { state: s, events: [...s.memos.slice(memos), ...s.decisions.slice(decisions)] };
};

export const project = state => { const { physical, ...rest } = state; return projectPublic(clone(rest)); };

// Shape check on load: every section present with the right type, and running tests have their traces.
export const validateState = s => {
  const need = (ok, what) => { if (!ok) throw new Error(what); };
  need(s && Number.isInteger(s.day) && s.day >= 0, 'day');
  for (const k of ['physical', 'evidence', 'beliefs', 'hardware', 'production', 'facilities', 'fiscal', 'stock', 'programmes', 'delegation', 'continuation']) need(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), k);
  for (const k of ['decisions', 'memos', 'work', 'launches', 'commands']) need(Array.isArray(s[k]), k);
  for (const k of ['physical', 'observation', 'forecast']) need(s.rng?.[k]?.algorithm === 'mulberry32-v1' && Number.isInteger(s.rng[k].state), `rng.${k}`);
  need(Array.isArray(s.evidence.observations), 'evidence.observations');
  for (const j of s.work.filter(x => x.status === 'running' && x.plan)) need(Array.isArray(s.physical.traces[j.id]), `trace for ${j.id}`);
};

export const saveGame = (state, storage) => writeSave(storage, state);
export const loadGame = storage => readSave(storage, validateState);
export const exportGame = state => exportSave(state);
export const importGame = (storage, text) => importSave(storage, text, validateState);
export const resetGame = storage => resetSave(storage);
export const checkSave = text => parseSave(text, validateState);
