// RESEARCH LANES: Alice Chen, the research lead, joins once the Aerobee flies routinely (the point where the launch director
// takes over the launches). Give her a research budget (a spending cap, like Ellis's remit) for one rocket and she runs a lane in
// each of its systems, led by the station engineer who checks that system on the pad:
//   p Propulsion: PROP     s Structures & Tankage: BSTR     i Instrumentation & Telemetry: TLM     a Aerodynamics & Thermal: FIDO
// A lane has its own team, apart from the shared engineering teams, which stay yours for milestones, experiments and anything
// urgent. Each lead takes the routine packages of their area, cheapest first, one at a time, then the experimental ones once the
// routine work is done (an experiment can turn out a dead end; queue one yourself to have it sooner). A development lead you have hired
// for the area (rules/leads.js) takes the lane over at their own pace; until then a hired station engineer leads it at full pace,
// a core-team member covering the console (rules/launch-site.js) at COVER_SKILL, and a lane with none of them waits.
// So the systems advance at different speeds: tanks can land before the engines, and the rocket gets heavier before it gets
// stronger. On a rocket with stage designs the lead puts each propulsion and structures package on the stage furthest behind
// (rules/programs.js researchTarget). Finished work goes into the blueprint as any other research does.
// Milestones are not routine: when one opens in a system, its lead proposes it in Mail and the lane waits for your answer, as the
// shared lanes do (rules/shared-research.js). Approved, it starts on the lane, paid from the treasury and counted against the
// budget; queued, your own teams take it; not now, and the lane carries on with routine work. No DOM.
//
// S.lanes: { prog: the rocket, cap ($), spent ($), jobs: packages started, dry: the package the cap could not cover, or null,
//            skip: milestone ids you said not now to (missing on older saves) }
// A lane's job is an ordinary research job (k 'pk') with free: 1 (it takes no shared team) and ln: its area.
import { formatMoney } from '../core/util.js';
import { STATIONS } from '../data/launch-site.js';
import { AREAS, MILESTONES, BY_ID, isMilestone } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { CORE_TEAM } from '../data/team.js';
import { S, log, withProgramme } from '../core/state.js';
import { itemsInArea, itemAsSeen, availabilityLock } from './research.js';
import { queuePosition } from './queue.js';
import { coveringMember, COVER_SKILL } from './launch-site.js';
import { directorUnlocked } from './campaign.js';
import { memberJoined } from './team.js';
import { hiredLead } from './leads.js';
import { researchTarget } from './programs.js';

// The station whose engineer leads each lane.
export const LANES = { p: 'prop', s: 'bstr', i: 'tlm', a: 'fido' };
// The budgets you can set, and how much a raise adds.
export const LANE_CAPS = [15000, 30000, 60000];
export const LANE_RAISE = 15000;

// Chen joins with the launch director's unlock (three successful Aerobee flights). Returns true if she joined now.
export function chenJoinTick() {
  if (memberJoined('chen') || !directorUnlocked()) return false;
  S.team.joined = { ...S.team.joined, chen: 1 };
  log('[R&D] Alice Chen joins as research lead. Give her a research budget in Mail and each station engineer runs research in their own system.', 'hd');
  return true;
}

// Who leads a lane now: { name, pace, cover: a core-team member covering the console }, or null when no one can.
export function laneLead(area) {
  const station = LANES[area], lead = hiredLead(area);
  if (lead) return { name: lead.name, pace: lead.pace };
  if (S.crew[station]) return { name: STATIONS[station].name, pace: 1 };
  const cover = coveringMember(station);
  return cover ? { name: CORE_TEAM[cover].name, pace: COVER_SKILL, cover: 1 } : null;
}
export const laneJob = area => S.jobs.find(job => job.ln == area);

// Give Chen a budget for the programme in focus. Returns an error text, or null if it started.
export function startLanes(cap) {
  if (!memberJoined('chen')) return 'Alice Chen has not joined yet.';
  if (S.lanes) return 'Chen already has a research budget.';
  if (!S.progs[S.cur] || !(cap > 0)) return 'Choose a rocket and a budget.';
  S.lanes = { prog: S.cur, cap, spent: 0, jobs: 0, dry: null, skip: [] };
  log(`[R&D] Chen opens research lanes on the ${PROGRAMMES[S.cur].name}, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
// double: raise by the cap itself, for the budgets of a big programme.
export function raiseLanes(double = false) {
  if (!S.lanes) return;
  S.lanes.cap += double ? S.lanes.cap : LANE_RAISE;
  S.lanes.dry = null;
  log(`[R&D] Chen's research budget raised to ${formatMoney(S.lanes.cap)}.`, 'ok');
}
// Closing stops new lane work; packages already under way finish.
export function endLanes() {
  const lanes = S.lanes;
  if (!lanes) return;
  S.lanes = null;
  log(`[R&D] Chen's research lanes closed: ${lanes.jobs} package${lanes.jobs == 1 ? '' : 's'}, ${formatMoney(lanes.spent)} of ${formatMoney(lanes.cap)} spent.`, 'wn');
}

// The lead's next package in an area: no milestones and nothing you have queued; routine work before experiments, cheapest first.
export function nextPackage(area) {
  return itemsInArea(area).map(item => itemAsSeen(item.id))
    .filter(item => !isMilestone(item.id) && !availabilityLock(item.id) && queuePosition(item.id) < 0)
    .sort((first, second) => !!first.dud - !!second.dud || first.cost - second.cost)[0] || null;
}
// The milestones a lane's lead proposes in its system (as the rocket sees them): open to start, not queued, and not put off.
export const laneProposals = area => S.lanes && laneLead(area) ? withProgramme(S.lanes.prog, () => MILESTONES
  .filter(milestone => milestone.area == area && !availabilityLock(milestone.id) && queuePosition(milestone.id) < 0 && !(S.lanes.skip || []).includes(milestone.id))
  .map(milestone => itemAsSeen(milestone.id))) : [];
// You approve a proposal: it starts on the lane. Returns an error text, or null.
export function approveLaneMilestone(id) {
  const area = BY_ID[id] && BY_ID[id].area, lead = area && laneLead(area), milestone = lead && laneProposals(area).find(item => item.id == id);
  if (!milestone) return 'Nothing to approve.';
  if (laneJob(area)) return `${lead.name} is finishing a package. Approve it once that is done.`;
  if (S.b < milestone.cost) return `Need ${formatMoney(milestone.cost - S.b)} more.`;
  withProgramme(S.lanes.prog, () => startOnLane(area, lead, milestone));
  return null;
}
export function laneNotNow(area) {
  S.lanes.skip = [...(S.lanes.skip || []), ...laneProposals(area).map(milestone => milestone.id)];
}

// Why a lane has no package under way, for the Mail card: 'no engineer', a proposal, the budget or treasury, or nothing proposed yet.
export function laneIdleReason(area) {
  if (!S.lanes || laneJob(area)) return null;
  if (!laneLead(area)) return `no ${STATIONS[LANES[area]].callSign} or lead yet`;
  if (laneProposals(area).length) return 'a milestone proposal is waiting for you';
  const item = withProgramme(S.lanes.prog, () => nextPackage(area));
  if (!item) return 'nothing proposed yet';
  if (S.lanes.spent + item.cost > S.lanes.cap) return 'budget spent';
  return S.b < item.cost ? 'waiting for funds' : 'starting';
}

// Each second. Returns true if anything happened.
export function lanesTick() {
  const lanes = S.lanes;
  if (!lanes) return false;
  if (!S.progs[lanes.prog]) {
    endLanes();
    return true;
  }
  return withProgramme(lanes.prog, () => {
    let changed = false;
    for (const area in LANES) {
      const lead = laneLead(area), item = !laneJob(area) && lead && !laneProposals(area).length && nextPackage(area);
      if (!item) continue;
      if (lanes.spent + item.cost > lanes.cap) {
        if (lanes.dry != item.name) {
          lanes.dry = item.name;
          log(`[R&D] Chen's budget cannot cover ${item.name} (${formatMoney(item.cost)}). Raise it or close the lanes.`, 'wn');
          changed = true;
        }
        continue;
      }
      if (S.b < item.cost) continue;
      startOnLane(area, lead, item);
      changed = true;
    }
    return changed;
  });
}
// Starts a package or milestone on a lane, for the rocket in focus (or the stage of it furthest behind).
function startOnLane(area, lead, item) {
  const time = Math.round(item.time / lead.pace);
  S.b -= item.cost;
  S.lanes.spent += item.cost;
  S.lanes.jobs++;
  const prog = researchTarget(item.id);
  S.jobs.push({ k: 'pk', id: item.id, prog, t: time, tot: time, free: 1, ln: area });
  log(`[R&D] ${lead.name} starts ${item.name} in the ${AREAS[area].toLowerCase()} lane${prog != S.cur ? `, on the ${PROGRAMMES[prog].name}` : ''} (${formatMoney(item.cost)}).`, 'wn');
}
