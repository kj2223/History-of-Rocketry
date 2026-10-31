// THE PROGRAMME BRIEF: one approval per rocket for the three leads who run it day to day (GDD v7.2 §6, middle-path stage 3).
// A brief has three lines, each a spending cap held by its lead:
//   flights:    Ellis's standing order (rules/orders.js), which covers every rocket once one brief starts it
//   production: Reed's factory budget (rules/factory-lead.js), sized to the order's cadence
//   research:   Chen's research lanes (rules/lanes.js)
// You approve the brief at one of BRIEF_SIZES and each lead who is free starts their line on the rocket in focus. A lead who has
// not joined yet, or already runs another rocket, is left out and says so; approve again later to add them. Each line keeps its
// own raise and close, and says why its lead is idle. No DOM.
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log } from '../core/state.js';
import { memberJoined } from './team.js';
import { ORDER_CAPS, ordersUnlocked, standingOrder, startOrder } from './orders.js';
import { WORKS_CAPS, startWorks } from './factory-lead.js';
import { LANE_CAPS, startLanes } from './lanes.js';

// The sizes you can approve: each line's cap at that size.
export const BRIEF_SIZES = [
  { name: 'Lean', flights: ORDER_CAPS[0], production: WORKS_CAPS[0], research: LANE_CAPS[0] },
  { name: 'Steady', flights: ORDER_CAPS[1], production: WORKS_CAPS[1], research: LANE_CAPS[1] },
  { name: 'Full', flights: ORDER_CAPS[2], production: WORKS_CAPS[2], research: LANE_CAPS[2] },
];

// Each line of a rocket's brief: { line, lead, state } where state is
//   'running' (its lead runs this rocket), 'free' (approving starts it), or the reason it is left out.
export function briefLines(prog) {
  const ready = S.progs[prog] && S.progs[prog].ready;
  const order = standingOrder();
  const flights = order ? (order.prog == prog ? 'running' : `Ellis's order (in the ${PROGRAMMES[order.prog].name} brief) covers every rocket`) : !ordersUnlocked() ? 'no launch director yet' : !ready ? 'not in production yet' : 'free';
  const production = S.works && S.works.prog == prog ? 'running' : !memberJoined('reed') ? 'Reed has not joined yet'
    : S.works ? `Reed runs the ${PROGRAMMES[S.works.prog].name}` : !ready ? 'not in production yet' : 'free';
  const research = S.lanes && S.lanes.prog == prog ? 'running' : !memberJoined('chen') ? 'Chen has not joined yet'
    : S.lanes ? `Chen runs the ${PROGRAMMES[S.lanes.prog].name}` : 'free';
  return [
    { line: 'flights', lead: 'ellis', state: flights },
    { line: 'production', lead: 'reed', state: production },
    { line: 'research', lead: 'chen', state: research },
  ];
}
export const briefRunning = prog => briefLines(prog).some(line => line.state == 'running');
export const briefFree = prog => briefLines(prog).filter(line => line.state == 'free');
// What approving at a size would commit, across the free lines.
export const briefTotal = (prog, size) => briefFree(prog).reduce((sum, line) => sum + BRIEF_SIZES[size][line.line], 0);

// Approve the brief for the rocket in focus at a size: every free line starts. Returns an error text, or null.
export function approveBrief(size) {
  const prog = S.cur, caps = BRIEF_SIZES[size], free = briefFree(prog), total = caps ? briefTotal(prog, size) : 0;
  if (!caps || !PROGRAMMES[prog]) return 'Choose a rocket and a size.';
  if (!free.length) return 'No lead is free to take this rocket.';
  const start = { flights: cap => startOrder(prog, cap), production: cap => startWorks(cap), research: cap => startLanes(cap) };
  for (const line of free) {
    const error = start[line.line](caps[line.line]);
    if (error) return error;
  }
  log(`[PROGRAMME] ${caps.name} brief for the ${PROGRAMMES[prog].name} approved: ${free.map(line => line.line).join(', ')}, ${formatMoney(total)} in caps.`, 'hd');
  return null;
}
