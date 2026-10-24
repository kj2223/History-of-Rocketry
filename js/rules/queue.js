// THE WORK QUEUE: research and records analyses lined up for the next free engineering team, so teams do not sit idle while
// you are busy launching. No DOM.
// One queue for all teams. Whenever a team is free, the first entry starts and is paid for then (earmarks apply then too).
// Records analyses of unexplained failures go ahead of all queued research, in the order they were queued.
// If the treasury cannot cover the first entry, the queue waits for the money rather than skipping ahead.
// An entry that can no longer be started (another approach was chosen, the failure was already analysed) is dropped with a log line.
// Rocket work and incidents belong to the programme in focus when they are queued.
// Queued research cannot be crashed until it is running.
// Entries (S.rq): research { id: package or milestone, prog }, records analysis { k: 'inv', id: incident number, prog }.
import { formatMoney } from '../core/util.js';
import { BY_ID, isMilestone } from '../data/research.js';
import { S, log, freeTeams, withProgramme } from '../core/state.js';
import { isVehicleArea, itemAsSeen, availabilityLock, costAfterEarmark, commission } from './research.js';
import { INVESTIGATION_COST, startInvestigation } from './jobs.js';

export const RESEARCH_QUEUE_LENGTH = 6; // queued research at most; records analyses do not count toward it
const isAnalysis = entry => entry.k == 'inv';
const researchEntries = () => S.rq.filter(entry => !isAnalysis(entry));
const isQueueEntryFor = (entry, item) => !isAnalysis(entry) && entry.id == item.id && entry.prog == (isVehicleArea(item.area) ? S.cur : null);
const entryName = entry => isAnalysis(entry) ? `Records analysis of incident #${entry.id}` : BY_ID[entry.id].name;

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
  if (!incident || incident.st != 'open') return 'Not awaiting analysis.';
  if (analysisPosition(incidentId) >= 0) return 'Already queued.';
  return null;
}
export function queueAnalysis(incidentId) {
  const lock = queueAnalysisLock(incidentId);
  if (lock) return log(lock, 'bad');
  const ahead = S.rq.filter(isAnalysis).length;
  S.rq.splice(ahead, 0, { k: 'inv', id: incidentId, prog: S.cur });
  log(`[INCIDENT #${incidentId}] Records analysis queued (${ahead + 1} in line).`, 'wn');
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
  if (isAnalysis(entry)) return withProgramme(entry.prog, () => (S.inc.find(candidate => candidate.id == entry.id) || {}).st == 'open' ? null : 'Already analysed.');
  return withProgramme(entry.prog, () => availabilityLock(entry.id));
};
const entryCost = entry => isAnalysis(entry) ? INVESTIGATION_COST : withProgramme(entry.prog, () => costAfterEarmark(itemAsSeen(entry.id)));
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
    withProgramme(entry.prog, () => isAnalysis(entry) ? startInvestigation(entry.id) : commission(entry.id));
    changed = true;
  }
  return changed;
}
// The queue as the UI lists it: each entry's name and the programme it belongs to.
export const queueEntries = () => S.rq.map(entry => ({ name: entryName(entry), prog: entry.prog, analysis: isAnalysis(entry) }));
