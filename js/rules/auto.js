// THE LAUNCH DIRECTOR runs the campaign you set (rules/campaign.js): it orders airframes within the budget, picks the
// propellant load, runs the go/no-go poll and flies, until the target is met, the deadline passes or the budget is spent. No DOM.
import { formatMoney } from '../core/util.js';
import { S, log, withProgramme } from '../core/state.js';
import { quoteLaunch, hasBoosterStage } from './design.js';
import { batchCost } from './production.js';
import { orderAirframes } from './factory.js';
import { runPoll, scrub, scrubCost, troubleshoot, PAD_FIX_COST } from './launch-site.js';
import { airborne, beginFlight, previewFlight, step, takeReadings, endFlight } from './flight.js';
import { campaignExpired, endCampaign, directorMargin, slipChance, VETERAN_MARGIN } from './campaign.js';

// The director tries every 15 seconds, and keeps $6,000 in the treasury for you.
const DIRECTOR_CADENCE = 15;
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

// Every 15 seconds while a campaign runs. Returns true if anything happened.
export function autoLaunch() {
  const camp = S.auto.camp;
  if (!S.staff.director || !camp || airborne.flight || --S.auto.cd > 0) return false;
  S.auto.cd = DIRECTOR_CADENCE;
  if (campaignExpired()) return true;
  if (camp.hold) return false;
  return withProgramme(camp.prog, () => directorTurn(camp));
}

function directorTurn(camp) {
  const ready = S.air.filter(candidate => candidate.st == 'r' && candidate.prog == camp.prog).sort((first, second) => second.pk.length - first.pk.length);
  const ordered = orderForCampaign(camp, ready.length), airframe = ready[0];
  if (!airframe) return ordered;
  const plan = planLoad(airframe, camp, camp.go ? VETERAN_MARGIN : directorMargin());
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
  if (Math.random() < slipChance()) {
    const cost = Math.min(S.b, scrubCost());
    S.b -= cost;
    S.day += 2;
    camp.spent += cost;
    log(`[LAUNCH DIRECTOR] Procedural slip in the countdown: the director scrubs and starts over. Turnaround ${formatMoney(cost)}.`, 'wn');
    return true;
  }
  const poll = runPoll(airframe, camp.fuel, plan.stage), before = S.b;
  if (poll.nogo && S.b >= PAD_FIX_COST) troubleshoot(poll);
  if (poll.nogo && S.b >= scrubCost()) scrub(poll);
  camp.spent += before - S.b;
  if (poll.nogo) return true;
  const flight = beginFlight(airframe, camp.fuel, camp.pay, plan.stage, plan.load, { latent: poll.fault, wind: poll.wind });
  if (!flight) return false;
  flight.byDirector = true;
  camp.spent += quote.cost;
  log(`[LAUNCH DIRECTOR] All stations GO. Flying ${airframe.label} at ${Math.round(plan.load * 100)}% propellant for the campaign.`, 'cyan');
  let result;
  do {
    result = step(flight);
    if (result == 'tick') takeReadings(flight, true);
  } while (result == 'tick' || result == 'sep');
  endFlight(flight, result != 'fail', result);
  return true;
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
