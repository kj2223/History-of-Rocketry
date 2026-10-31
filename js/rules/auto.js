// THE LAUNCH DIRECTOR runs the campaign you set (rules/campaign.js) and the standing orders (rules/orders.js). For a campaign
// it orders airframes within the budget, picks the propellant load, runs the go/no-go poll and flies, until the target is met,
// the deadline passes or the budget is spent. A first invites you to attend before she flies it (rules/invitations.js): attended,
// she leaves the count to Watch (ui/launch-view.js startDirectorCount). No DOM.
import { formatMoney } from '../core/util.js';
import { S, log, withProgramme, isConfirmed } from '../core/state.js';
import { BY_ID } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { quoteLaunch, hasBoosterStage } from './design.js';
import { batchCost } from './production.js';
import { orderAirframes, heldForLaunch } from './factory.js';
import { runPoll, scrub, scrubCost, troubleshoot, PAD_FIX_COST, groundTest, groundTestLock, TEST_STAND } from './launch-site.js';
import { airborne, beginFlight, previewFlight, step, takeReadings, endFlight } from './flight.js';
import { campaignExpired, endCampaign, directorMargin, slipChance, VETERAN_MARGIN } from './campaign.js';
import { standingOrder, ordersTurn, openIncident } from './orders.js';
import { leansSafe, acceptRisk } from './culture.js';
import { waitForInvitation } from './invitations.js';

// The director tries every 15 seconds, and keeps $6,000 in the treasury for you.
export const DIRECTOR_CADENCE = 15;
const TREASURY_RESERVE = 6000;
// Lowest liftoff thrust-to-weight the director accepts.
const MIN_THRUST_TO_WEIGHT = 1.15;

// The highest propellant load (100% down to 30%, in steps of 10%) whose pre-flight estimate keeps the aero load and skin heating
// inside margin of their limits, and the burnout load inside the veteran's margin (it hardly changes with the load: it is the
// design's). Returns { load, stage }, or { reason, stage } naming the limit the full load breaks.
export function planLoad(airframe, camp, margin) {
  const stage = camp.st && hasBoosterStage(airframe) ? 1 : 0;
  let full;
  for (let tenths = 10; tenths >= 3; tenths--) {
    const load = tenths / 10, preview = previewFlight(airframe, camp.fuel, camp.pay, stage, load);
    full = full || preview;
    if (preview.thrustToWeight >= MIN_THRUST_TO_WEIGHT && preview.burnoutG <= preview.gLimit * VETERAN_MARGIN && preview.maxQ <= margin && preview.maxHeat <= margin) return { load, stage };
  }
  const limit = Math.round(margin * 100) + '%';
  const reason = full.maxHeat > margin ? `skin heating runs past ${limit} of its limit`
    : full.maxQ > margin ? `the aero load runs past ${limit} of its limit`
    : full.burnoutG > full.gLimit * VETERAN_MARGIN ? `the burnout load runs past ${Math.round(VETERAN_MARGIN * 100)}% of the structure's limit`
    : 'liftoff thrust is too low at every load';
  return { reason, stage };
}

// Every 15 seconds while a campaign or a standing order runs: the campaign's flight first, then the orders (rules/orders.js).
// Returns true if anything happened.
export function autoLaunch() {
  const camp = S.auto.camp;
  if (!S.staff.director || (!camp && !standingOrder()) || airborne.flight || --S.auto.cd > 0) return false;
  S.auto.cd = DIRECTOR_CADENCE;
  if (camp && campaignExpired()) return true;
  if (camp && !camp.hold && withProgramme(camp.prog, () => directorTurn(camp))) return true;
  return ordersTurn();
}

function directorTurn(camp) {
  const ready = S.air.filter(candidate => candidate.st == 'r' && candidate.prog == camp.prog && !heldForLaunch(candidate)).sort((first, second) => second.pk.length - first.pk.length);
  const ordered = orderForCampaign(camp, ready.length), airframe = ready[0];
  if (!airframe) return ordered;
  // A first waits for your answer to her invitation (rules/invitations.js); attended, it goes to the pad for Watch.
  const invitation = waitForInvitation(airframe);
  if (invitation === true || S.auto.pad) return true;
  // THE CULTURE (rules/culture.js): a careful team waits for an open incident to be fixed and proves new engine work on the test
  // stand first; any other team flies, and an open incident is a risk accepted.
  const incident = openIncident(camp.prog), test = !incident && testFirst(airframe, camp.budget - camp.spent);
  if (incident && leansSafe('ellis') || test) {
    if (test && test.cost) camp.spent += test.cost;
    const why = test ? test.why : `an incident on the ${PROGRAMMES[camp.prog].name} is still open`;
    if (camp.wait != why) log(`[LAUNCH DIRECTOR] Waiting: ${why}.`, 'cyan');
    camp.wait = why;
    return !!(test && test.cost);
  }
  camp.wait = null;
  const plan = planLoad(airframe, camp, camp.go ? Math.max(VETERAN_MARGIN, directorMargin()) : directorMargin());
  if (plan.reason) {
    camp.hold = camp.go ? `${airframe.label}: even at ${Math.round(VETERAN_MARGIN * 100)}% of the limits, ${plan.reason}. The design needs work, or fly it yourself.` : `${airframe.label}: ${plan.reason}. The director is not sure enough to fly it.`;
    log(`[LAUNCH DIRECTOR] Requesting guidance. ${camp.hold}`, 'wn');
    return true;
  }
  const quote = quoteLaunch(airframe, camp.fuel, camp.pay, plan.stage, plan.load);
  if (quote.error) {
    camp.hold = quote.error;
    log(`[LAUNCH DIRECTOR] Requesting guidance. ${quote.error}`, 'wn');
    return true;
  }
  if (camp.spent + quote.cost > camp.budget) {
    endCampaign('budget');
    return true;
  }
  if (S.b - quote.cost < TREASURY_RESERVE) return false;
  if (invitation == 'attend') {
    S.auto.pad = { af: airframe.id, fuel: camp.fuel, pay: camp.pay, st: plan.stage, load: plan.load };
    camp.spent += quote.cost;
    log(`[LAUNCH DIRECTOR] ${airframe.label} is on the pad at ${Math.round(plan.load * 100)}% propellant. The count is running in Watch.`, 'cyan');
    return true;
  }
  if (Math.random() < slipChance()) {
    const cost = Math.min(S.b, scrubCost());
    S.b -= cost;
    S.day += 2;
    camp.spent += cost;
    log(`[LAUNCH DIRECTOR] Procedural slip in the countdown: the director scrubs and starts over. Turnaround ${formatMoney(cost)}.`, 'wn');
    return true;
  }
  const { poll, cost } = directorPoll(airframe, camp.fuel, plan.stage);
  camp.spent += cost;
  if (poll.nogo) return true;
  const flight = beginFlight(airframe, camp.fuel, camp.pay, plan.stage, plan.load, { latent: poll.fault, wind: poll.wind });
  if (!flight) return false;
  flight.byDirector = true;
  camp.spent += quote.cost;
  if (incident) acceptRisk('ellis', 'LAUNCH DIRECTOR', `${airframe.label} flies for the campaign with an incident still open.`);
  log(`[LAUNCH DIRECTOR] All stations GO. Flying ${airframe.label} at ${Math.round(plan.load * 100)}% propellant for the campaign.`, 'cyan');
  flyToEnd(flight);
  return true;
}

// The director's go/no-go poll, for campaigns and standing orders: a NO-GO is troubleshot, then scrubbed, if the treasury allows.
// Returns { poll, cost: what the pad work cost }.
export function directorPoll(airframe, fuel, stage) {
  const poll = runPoll(airframe, fuel, stage), before = S.b;
  if (poll.nogo && S.b >= PAD_FIX_COST) troubleshoot(poll);
  if (poll.nogo && S.b >= scrubCost()) scrub(poll);
  return { poll, cost: before - S.b };
}
// Flies a director's flight to its end, recording telemetry, and closes it out. Returns how it ended ('fail' if it was lost).
export function flyToEnd(flight) {
  let result;
  do {
    result = step(flight);
    if (result == 'tick') takeReadings(flight, true);
  } while (result == 'tick' || result == 'sep');
  endFlight(flight, result != 'fail', result);
  return result;
}

// The director keeps one airframe in the factory queue behind the one on the pad, so the campaign does not wait on the factory.
// When the budget cannot cover another airframe and none is left to fly, the campaign closes. Returns true if anything happened.
const AIRFRAMES_ON_HAND = 2;
function orderForCampaign(camp, readyCount) {
  const queued = S.aq.filter(item => item.k == 'build' && item.prog == camp.prog).length;
  if (readyCount + queued >= AIRFRAMES_ON_HAND) return false;
  const cost = batchCost(1);
  if (camp.spent + cost > camp.budget) {
    if (readyCount + queued) return false;
    endCampaign('budget');
    return true;
  }
  if (S.b - cost < TREASURY_RESERVE) return false;
  orderAirframes(1);
  camp.spent += cost;
  return true;
}

// A CAREFUL TEAM PROVES NEW ENGINE WORK FIRST: for a propulsion package aboard that is not yet confirmed and can go on the test
// stand, she books the test from the money she has left (room) and waits for it. A package she cannot test (no stand, no free
// team, no money) does not hold her up. Returns { why, cost } while she waits, or null.
export function testFirst(airframe, room) {
  if (!leansSafe('ellis')) return null;
  return withProgramme(airframe.prog, () => {
    for (const id of airframe.pk) {
      if (!BY_ID[id] || isConfirmed(id)) continue;
      if (S.jobs.some(job => job.k == 'gt' && job.id == id && job.prog == S.cur)) return { why: `${BY_ID[id].name} is on the test stand`, cost: 0 };
      if (groundTestLock(id)) continue;
      const before = S.b;
      if (before - TREASURY_RESERVE < TEST_STAND.cost || room < TEST_STAND.cost) continue;
      groundTest(id);
      return { why: `${BY_ID[id].name} goes on the test stand before it flies`, cost: before - S.b };
    }
    return null;
  });
}
