// THE LAUNCH DIRECTOR flies the fleet unattended from standing orders, running the go/no-go poll and scrubbing on any NO-GO. No DOM.
// Standing orders (S.auto): { on, fuel, pay, st: fly the booster stage, load: share of a full tank, cd: seconds to the next try }.
import { S, log } from '../core/state.js';
import { quoteLaunch, hasBoosterStage } from './design.js';
import { unitCost } from './production.js';
import { runPoll, scrub, scrubCost, troubleshoot, PAD_FIX_COST } from './launch-site.js';
import { airborne, beginFlight, step, takeReadings, endFlight } from './flight.js';
import { PROGRAMMES } from '../data/programmes.js';

// Every 15 seconds: fly the best-equipped ready airframe if that leaves enough for a new airframe plus $6,000.
// The poll runs as for a player; one troubleshooting attempt, then a scrub on any NO-GO. Returns true if anything happened.
export function autoLaunch() {
  const orders = S.auto;
  if (!S.staff.director || !orders.on || airborne.flight || --orders.cd > 0) return false;
  orders.cd = 15;
  const airframe = S.air.filter(candidate => candidate.st == 'r').sort((first, second) => second.pk.length - first.pk.length)[0];
  if (!airframe) return false;
  const propellants = PROGRAMMES[airframe.prog].propellants, propellant = propellants.includes(orders.fuel) ? orders.fuel : propellants[0];
  const stage = orders.st && hasBoosterStage(airframe) ? 1 : 0, quote = quoteLaunch(airframe, propellant, orders.pay, stage, orders.load);
  if (quote.error || S.b - quote.cost < unitCost() + 6000) return false;
  const poll = runPoll(airframe, propellant, stage);
  if (poll.nogo && S.b >= PAD_FIX_COST) troubleshoot(poll);
  if (poll.nogo) {
    if (S.b >= scrubCost()) scrub(poll);
    return true;
  }
  const flight = beginFlight(airframe, propellant, orders.pay, stage, orders.load, { latent: poll.fault, wind: poll.wind });
  if (!flight) return false;
  log('[LAUNCH DIRECTOR] All stations GO. Flying ' + airframe.label + ' under standing orders.', 'cyan');
  let result;
  do {
    result = step(flight);
    if (result == 'tick') takeReadings(flight, true);
  } while (result == 'tick' || result == 'sep');
  endFlight(flight, result != 'fail', result);
  return true;
}
