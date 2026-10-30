// THE WORK QUEUE: research, records analyses, corrective fixes and design reviews lined up for the next free engineering team, so teams do not sit idle while
// you are busy launching. No DOM.
// One queue for all teams. Whenever a team is free, the first entry starts and is paid for then (earmarks apply then too).
// Records analyses of unexplained failures (and extended analyses) go ahead of all other queued work, in the order they were queued.
// If the treasury cannot cover the first entry, the queue waits for the money rather than skipping ahead.
// An entry that can no longer be started (another approach was chosen, the failure was already analysed) is dropped with a log line.
// Rocket work and incidents belong to the programme in focus when they are queued.
// Queued research cannot be crashed until it is running.
// Entries (S.rq): research { id: package or milestone, prog }, records analysis { k: 'inv', id: incident number, prog, x: 1 if extended },
// corrective fix { k: 'fix', id: incident number, f: fix id, prog }, design review { k: 'rev', id: system area, prog }.
import { formatMoney } from '../core/util.js';
import { BY_ID, isMilestone } from '../data/research.js';
import { findFix } from '../data/failures.js';
import { S, log, freeTeams, withProgramme, findJob } from '../core/state.js';
import { isVehicleArea, itemAsSeen, availabilityLock, costAfterEarmark, commission } from './research.js';
import { INVESTIGATION_COST, startInvestigation, extendInvestigation, chooseFix, startReview } from './jobs.js';
import { SYSTEMS, REVIEW_COST } from './knowledge.js';

export const RESEARCH_QUEUE_LENGTH = 6; // queued research, fixes and reviews at most; records analyses do not count toward it
const isAnalysis = entry => entry.k == 'inv';
const researchEntries = () => S.rq.filter(entry => !isAnalysis(entry));
const isQueueEntryFor = (entry, item) => !entry.k && entry.id == item.id && entry.prog == (isVehicleArea(item.area) ? S.cur : null);
const incidentOf = entry => S.inc.find(candidate => candidate.id == entry.id);
const ENTRY_NAMES = {
  inv: entry => `${entry.x ? 'Extended analysis' : 'Records analysis'} of incident #${entry.id}`,
  fix: entry => `${withProgramme(entry.prog, () => findFix(incidentOf(entry).dx, entry.f).name)} (incident #${entry.id})`,
  rev: entry => `Design review: ${SYSTEMS[entry.id].name}`,
};
const entryName = entry => entry.k ? ENTRY_NAMES[entry.k](entry) : BY_ID[entry.id].name;

// RESEARCH IN THE QUEUE
// The queue position of a package or milestone (0 = next), or -1 if it is not queued.
export const queuePosition = id => S.rq.findIndex(entry => isQueueEntryFor(entry, itemAsSeen(id)));
// Why a package or milestone cannot be queued, or null if it can. Unlike commissioning, it needs neither the money nor a free team yet.
export function queueLock(id) {
  const item = itemAsSeen(id), lock = availabilityLock(id);
  if (lock) return lock;
  if (queuePosition(id) >= 0) return 'Already queued.';
  if (researchEntries().length >= RESEARCH_QUEUE_LENGTH) return `The queue is full (${RESEARCH_QUEUE_LENGTH}).`;
  if (isMilestone(id) && item.tier == 1 && researchEntries().some(entry => entry.id != id && BY_ID[entry.id].area == item.area && BY_ID[entry.id].tier == 1 && entry.prog == (isVehicleArea(item.area) ? S.cur : null))) return 'Another approach is queued.';
  return null;
}
export function queueResearch(id) {
  const lock = queueLock(id);
  if (lock) return log(lock, 'bad');
  const item = itemAsSeen(id);
  S.rq.push({ id, prog: isVehicleArea(item.area) ? S.cur : null });
  log(`[DESIGN] Queued: ${item.name} (${S.rq.length} in the queue).`, 'wn');
  startQueuedWork();
}

// RECORDS ANALYSES IN THE QUEUE (unexplained failures of the programme in focus)
export const analysisPosition = incidentId => S.rq.findIndex(entry => isAnalysis(entry) && entry.id == incidentId && entry.prog == S.cur);
export function queueAnalysisLock(incidentId) {
  const incident = S.inc.find(candidate => candidate.id == incidentId);
  if (!incident || (incident.st != 'open' && incident.st != 'found')) return 'Not awaiting analysis.';
  if (analysisPosition(incidentId) >= 0) return 'Already queued.';
  return null;
}
export function queueAnalysis(incidentId) {
  const lock = queueAnalysisLock(incidentId);
  if (lock) return log(lock, 'bad');
  const ahead = S.rq.filter(isAnalysis).length, extended = S.inc.find(candidate => candidate.id == incidentId).st == 'found';
  S.rq.splice(ahead, 0, { k: 'inv', id: incidentId, prog: S.cur, ...(extended ? { x: 1 } : {}) });
  log(`[INCIDENT #${incidentId}] ${extended ? 'Extended analysis' : 'Records analysis'} queued (${ahead + 1} in line).`, 'wn');
  startQueuedWork();
}

// CORRECTIVE FIXES AND DESIGN REVIEWS IN THE QUEUE (the programme in focus). One fix per incident, one review per system.
export const fixPosition = incidentId => S.rq.findIndex(entry => entry.k == 'fix' && entry.id == incidentId && entry.prog == S.cur);
export function queueFixLock(incidentId) {
  const incident = S.inc.find(candidate => candidate.id == incidentId);
  if (!incident || incident.st != 'diag') return 'Not awaiting a fix.';
  if (fixPosition(incidentId) >= 0) return 'A fix is already queued.';
  if (researchEntries().length >= RESEARCH_QUEUE_LENGTH) return `The queue is full (${RESEARCH_QUEUE_LENGTH}).`;
  return null;
}
export function queueFix(incidentId, fixId) {
  const lock = queueFixLock(incidentId), incident = S.inc.find(candidate => candidate.id == incidentId), fix = incident && findFix(incident.dx, fixId);
  if (lock || !fix) return log(lock || 'No such fix.', 'bad');
  S.rq.push({ k: 'fix', id: incidentId, f: fixId, prog: S.cur });
  log(`[DESIGN] Queued: ${fix.name} (${S.rq.length} in the queue).`, 'wn');
  startQueuedWork();
}
export const reviewPosition = area => S.rq.findIndex(entry => entry.k == 'rev' && entry.id == area && entry.prog == S.cur);
export function queueReviewLock(area) {
  if (!SYSTEMS[area] || !SYSTEMS[area].modes) return 'Nothing to review.';
  if (findJob(job => job.k == 'rev' && job.a == area)) return 'A review is under way.';
  if (reviewPosition(area) >= 0) return 'Already queued.';
  if (researchEntries().length >= RESEARCH_QUEUE_LENGTH) return `The queue is full (${RESEARCH_QUEUE_LENGTH}).`;
  return null;
}
export function queueReview(area) {
  const lock = queueReviewLock(area);
  if (lock) return log(lock, 'bad');
  S.rq.push({ k: 'rev', id: area, prog: S.cur });
  log(`[DESIGN] Queued: design review of ${SYSTEMS[area].name} (${S.rq.length} in the queue).`, 'wn');
  startQueuedWork();
}

export const unqueue = index => { S.rq.splice(index, 1); };
// Move an entry one place up the queue (the player's order wins over analyses going first).
export function moveUpQueue(index) {
  if (index < 1 || index >= S.rq.length) return;
  [S.rq[index - 1], S.rq[index]] = [S.rq[index], S.rq[index - 1]];
  startQueuedWork();
}
// Why an entry cannot start at all (it is dropped), or null.
const entryLock = entry => {
  if (entry.prog && !S.progs[entry.prog]) return 'The programme is closed.';
  if (isAnalysis(entry)) return withProgramme(entry.prog, () => (incidentOf(entry) || {}).st == (entry.x ? 'found' : 'open') ? null : 'Already analysed.');
  if (entry.k == 'fix') return withProgramme(entry.prog, () => (incidentOf(entry) || {}).st == 'diag' ? null : 'Already fixed.');
  if (entry.k == 'rev') return S.jobs.some(job => job.k == 'rev' && job.a == entry.id) ? 'A review is already under way.' : null;
  return withProgramme(entry.prog, () => availabilityLock(entry.id));
};
const ENTRY_COSTS = {
  inv: () => INVESTIGATION_COST,
  fix: entry => withProgramme(entry.prog, () => findFix(incidentOf(entry).dx, entry.f).cost),
  rev: () => REVIEW_COST,
};
const entryCost = entry => entry.k ? ENTRY_COSTS[entry.k](entry) : withProgramme(entry.prog, () => costAfterEarmark(itemAsSeen(entry.id)));
const ENTRY_STARTS = {
  inv: entry => entry.x ? extendInvestigation(entry.id) : startInvestigation(entry.id),
  fix: entry => chooseFix(entry.id, entry.f),
  rev: entry => startReview(entry.id),
};
// Why the first entry in the queue is waiting, or null if it can start.
export function queueWait() {
  const entry = S.rq[0];
  if (!entry) return null;
  if (freeTeams() < 1) return 'Waiting for a free team.';
  return S.b < entryCost(entry) ? `Waiting for funds (${formatMoney(entryCost(entry) - S.b)} more).` : null;
}
// Start queued work while teams are free and the money is there (each second, and whenever something is queued).
// Returns true if the queue changed.
export function startQueuedWork() {
  let changed = false;
  while (S.rq.length && freeTeams() > 0) {
    const entry = S.rq[0], lock = entryLock(entry);
    if (lock) {
      S.rq.shift();
      log(`[DESIGN] ${entryName(entry)} dropped from the queue: ${lock}`, 'bad');
      changed = true;
      continue;
    }
    if (queueWait()) break;
    withProgramme(entry.prog, () => entry.k ? ENTRY_STARTS[entry.k](entry) : commission(entry.id));
    changed = true;
  }
  return changed;
}
// The queue as the UI lists it: each entry's name and the programme it belongs to.
export const queueEntries = () => S.rq.map(entry => ({ name: entryName(entry), prog: entry.prog, analysis: isAnalysis(entry) }));
