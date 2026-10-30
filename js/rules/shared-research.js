// SHARED RESEARCH: the research areas every rocket shares (Payloads & Recovery, and from NASA the Mercury Spacecraft and Escape &
// Man-Rating) get lanes like a rocket's systems (rules/lanes.js), each run by the lead you hire for it (rules/leads.js), on a
// shared line of Chen's budget. A lead takes the routine packages of their area, cheapest first, one at a time, inside the cap.
// Milestones are not routine: when one opens in a lead's area, the lead stops and proposes it in Mail, and when the area's first
// milestones are a choice (one closes the others) the proposal says so. You approve one, and it starts on the lead's lane, paid
// from the treasury and counted against the line; or you say not now, and the lead carries on with routine work until the next
// milestone opens. No DOM.
//
// S.shared: { cap ($, 0 while the line is closed), spent ($), jobs: packages started, dry: what the cap could not cover or null,
//             skip: milestone ids you said not now to }
import { formatMoney } from '../core/util.js';
import { AREAS, MILESTONES, BY_ID } from '../data/research.js';
import { S, log } from '../core/state.js';
import { availabilityLock } from './research.js';
import { laneJob, nextPackage } from './lanes.js';
import { hiredLead } from './leads.js';
import { memberJoined } from './team.js';

export const SHARED_AREAS = ['r', 'c', 'e'];
// The caps you can set, and how much a raise adds.
export const SHARED_CAPS = [20000, 40000, 80000];
export const SHARED_RAISE = 20000;

export function startShared(cap) {
  if (!memberJoined('chen')) return 'Alice Chen has not joined yet.';
  if (S.shared.cap) return 'The shared line is already open.';
  if (!(cap > 0)) return 'Set a budget.';
  Object.assign(S.shared, { cap, spent: 0, jobs: 0, dry: null });
  log(`[R&D] Chen opens the shared research line, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
export function raiseShared() {
  if (!S.shared.cap) return;
  S.shared.cap += SHARED_RAISE;
  S.shared.dry = null;
  log(`[R&D] Shared research line raised to ${formatMoney(S.shared.cap)}.`, 'ok');
}
export function endShared() {
  if (!S.shared.cap) return;
  log(`[R&D] Shared research line closed: ${S.shared.jobs} package${S.shared.jobs == 1 ? '' : 's'}, ${formatMoney(S.shared.spent)} of ${formatMoney(S.shared.cap)} spent.`, 'wn');
  S.shared.cap = 0;
}

// The milestones a lead proposes in their area: open to start, and not put off.
export const proposals = area => hiredLead(area) ? MILESTONES.filter(milestone => milestone.area == area && !availabilityLock(milestone.id) && !S.shared.skip.includes(milestone.id)) : [];
// Whether a proposal is a choice: two or more first milestones, and starting one closes the others.
export const isChoice = area => proposals(area).filter(milestone => milestone.tier == 1).length > 1;

// You approve a proposal: it starts on the lead's lane. Returns an error text, or null.
export function approveProposal(id) {
  const milestone = BY_ID[id], area = milestone && milestone.area, lead = area && hiredLead(area);
  if (!lead || !proposals(area).includes(milestone)) return 'Nothing to approve.';
  if (laneJob(area)) return `${lead.name} is finishing a package. Approve it once that is done.`;
  if (S.b < milestone.cost) return `Need ${formatMoney(milestone.cost - S.b)} more.`;
  startOnLane(area, lead, milestone);
  return null;
}
export function notNow(area) {
  S.shared.skip.push(...proposals(area).map(milestone => milestone.id));
}

function startOnLane(area, lead, item) {
  const time = Math.round(item.time / lead.pace);
  S.b -= item.cost;
  S.shared.spent += item.cost;
  S.shared.jobs++;
  S.jobs.push({ k: 'pk', id: item.id, prog: null, t: time, tot: time, free: 1, ln: area });
  log(`[R&D] ${lead.name} starts ${item.name} (${formatMoney(item.cost)}).`, 'wn');
}

// Why a shared lane has nothing under way, for Mail, or null while it works.
export function sharedIdleReason(area) {
  if (laneJob(area)) return null;
  if (!hiredLead(area)) return 'no lead yet';
  if (proposals(area).length) return 'a milestone proposal is waiting for you';
  if (!S.shared.cap) return 'the shared line is closed';
  const item = nextPackage(area);
  if (!item) return 'nothing proposed yet';
  if (S.shared.spent + item.cost > S.shared.cap) return 'budget spent';
  return S.b < item.cost ? 'waiting for funds' : 'starting';
}

// Each second. Returns true if anything happened.
export function sharedTick() {
  if (!S.shared.cap) return false;
  let changed = false;
  for (const area of SHARED_AREAS) {
    const lead = hiredLead(area);
    if (!lead || laneJob(area) || proposals(area).length) continue;
    const item = nextPackage(area);
    if (!item) continue;
    if (S.shared.spent + item.cost > S.shared.cap) {
      if (S.shared.dry != item.name) {
        S.shared.dry = item.name;
        log(`[R&D] The shared line cannot cover ${item.name} (${formatMoney(item.cost)}) in ${AREAS[area]}. Raise it or close it.`, 'wn');
        changed = true;
      }
      continue;
    }
    if (S.b < item.cost) continue;
    startOnLane(area, lead, item);
    changed = true;
  }
  return changed;
}
