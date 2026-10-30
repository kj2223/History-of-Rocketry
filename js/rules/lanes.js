// RESEARCH LANES: Alice Chen, the research lead, joins once the Aerobee flies routinely (the point where the launch director
// takes over the launches). Give her a research budget (a spending cap, like Ellis's remit) for one rocket and she runs a lane in
// each of its systems, led by the station engineer who checks that system on the pad:
//   p Propulsion: PROP     s Structures & Tankage: BSTR     i Instrumentation & Telemetry: TLM     a Aerodynamics & Thermal: FIDO
// A lane has its own team, apart from the shared engineering teams, which stay yours for milestones, experiments and anything
// urgent. Each lead takes the routine packages of their area, cheapest first, one at a time, then the experimental ones once the
// routine work is done (an experiment can turn out a dead end; queue one yourself to have it sooner). A hired engineer works at full pace;
// a core-team member covering the console (rules/launch-site.js) at COVER_SKILL; a lane with neither waits for its engineer.
// So the systems advance at different speeds: tanks can land before the engines, and the rocket gets heavier before it gets
// stronger. Finished work goes into the blueprint as any other research does. No DOM.
//
// S.lanes: { prog: the rocket, cap ($), spent ($), jobs: packages started, dry: the package the cap could not cover, or null }
// A lane's job is an ordinary research job (k 'pk') with free: 1 (it takes no shared team) and ln: its area.
import { formatMoney } from '../core/util.js';
import { STATIONS } from '../data/launch-site.js';
import { AREAS, isMilestone } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { CORE_TEAM } from '../data/team.js';
import { S, log, withProgramme } from '../core/state.js';
import { itemsInArea, itemAsSeen, availabilityLock } from './research.js';
import { queuePosition } from './queue.js';
import { coveringMember, COVER_SKILL } from './launch-site.js';
import { directorUnlocked } from './campaign.js';
import { memberJoined } from './team.js';

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

// Who leads a lane now: { name, pace }, or null when its station is empty.
export function laneLead(area) {
  const station = LANES[area];
  if (S.crew[station]) return { name: STATIONS[station].name, pace: 1 };
  const cover = coveringMember(station);
  return cover ? { name: CORE_TEAM[cover].name, pace: COVER_SKILL } : null;
}
export const laneJob = area => S.jobs.find(job => job.ln == area);

// Give Chen a budget for the programme in focus. Returns an error text, or null if it started.
export function startLanes(cap) {
  if (!memberJoined('chen')) return 'Alice Chen has not joined yet.';
  if (S.lanes) return 'Chen already has a research budget.';
  if (!S.progs[S.cur] || !(cap > 0)) return 'Choose a rocket and a budget.';
  S.lanes = { prog: S.cur, cap, spent: 0, jobs: 0, dry: null };
  log(`[R&D] Chen opens research lanes on the ${PROGRAMMES[S.cur].name}, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
export function raiseLanes() {
  if (!S.lanes) return;
  S.lanes.cap += LANE_RAISE;
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
// Why a lane has no package under way, for the Mail card: 'no engineer', the budget or treasury, or nothing proposed yet.
export function laneIdleReason(area) {
  if (!S.lanes || laneJob(area)) return null;
  if (!laneLead(area)) return `no ${STATIONS[LANES[area]].callSign} yet`;
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
      const lead = laneLead(area), item = !laneJob(area) && lead && nextPackage(area);
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
      const time = Math.round(item.time / lead.pace);
      S.b -= item.cost;
      lanes.spent += item.cost;
      lanes.jobs++;
      S.jobs.push({ k: 'pk', id: item.id, prog: S.cur, t: time, tot: time, free: 1, ln: area });
      log(`[R&D] ${lead.name} starts ${item.name} in the ${AREAS[area].toLowerCase()} lane (${formatMoney(item.cost)}).`, 'wn');
      changed = true;
    }
    return changed;
  });
}
