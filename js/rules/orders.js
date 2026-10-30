// STANDING FLIGHT ORDERS: once Ellis is launch director, a rocket can be given a standing order. It keeps flying routine flights
// for outside customers under a spending cap, with no launch scheduling from you (GDD v7.2 §4, §6). The flights follow demand:
// the services and the research panels ask for flights to a profile (an altitude), and Ellis flies each one on the cheapest
// rocket under order that reaches it, which need not be the newest. A good flight pays the customer's contract. Every flight
// teaches the team: the rocket's own systems as any flight does, and the newest rocket a little as well (flight time on an older
// rocket still counts, at a reduced rate). Good flights go into one rolling Mail report. An order stops and asks you when its
// cap is spent, when Ellis cannot plan a safe load, or when a milestone has changed the rocket's configuration; it waits by
// itself while the treasury is short, while an incident on the rocket is open, or while no airframe is ready.
// Campaigns run alongside: a campaign's flight goes first, and a campaign ending does not stop the orders. No DOM.
//
// S.orders: { by: { [prog]: order }, reqs: open requests, n: the next request id, due: the game day the next request arrives }
//   order:   { cap ($), spent ($), n: flights, okn: good flights, paid ($ from customers), hold: why Ellis waits for you or null,
//              pk: the packages of the configuration you approved (a new milestone among an airframe's packages holds the order),
//              aside: airframes set aside in a row because no safe load could be planned }
// An airframe Ellis will not fly on routine flights carries aside: the reason; you can still fly it yourself.
//   request: { id, who, pay: the payload flown, km: the altitude asked for, fee ($ on a good flight), by: the game day it lapses,
//              why: why it is waiting }
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { isMilestone } from '../data/research.js';
import { S, log, earn, formatDate, withProgramme } from '../core/state.js';
import { quoteLaunch } from './design.js';
import { batchCost } from './production.js';
import { orderAirframes, heldForLaunch } from './factory.js';
import { runPoll, scrub, scrubCost, troubleshoot, PAD_FIX_COST } from './launch-site.js';
import { beginFlight, previewFlight, step, takeReadings, endFlight } from './flight.js';
import { learn, teachingValue } from './knowledge.js';
import { directorMargin } from './campaign.js';
import { planLoad } from './auto.js';

// The caps you can set, and how much a raise adds.
export const ORDER_CAPS = [25000, 50000, 100000];
export const ORDER_RAISE = 25000;
// Ellis keeps this much in the treasury for you, as on a campaign.
const TREASURY_RESERVE = 6000;
// DEMAND: a request every this many game days while any order stands, no more than this many open at once, each open this long.
export const REQUEST_DAYS = 40;
export const OPEN_REQUESTS = 3;
export const REQUEST_LIFE = 150;
// The profiles customers ask for (km). They ask for what your rockets have shown they can reach, now and then a little more.
const PROFILES = [20, 40, 80, 120, 160, 250, 400];
const CUSTOMERS = ['Army Ordnance', 'Naval Research Laboratory', 'Air Force Cambridge Research Center', 'Upper Atmosphere Rocket Research Panel'];
// Every customer wants data back, so routine flights carry the instrument package (its weight also keeps the burnout load down).
export const ROUTINE_PAYLOAD = 'Sensor Suite';
// A good flight pays $2,000 plus $50 per km asked for.
export const contractPay = km => 2000 + 50 * km;
// Flight time on a rocket older than the newest teaches the newest at this share of a flight of its own.
export const OLDER_ROCKET_SHARE = .3;

export const ordersUnlocked = () => !!S.staff.director;
export const orderFor = prog => S.orders.by[prog] || null;
export const standingOrders = () => Object.keys(S.orders.by);

// Give a rocket a standing order. Returns an error text, or null if it started.
export function startOrder(prog, cap) {
  if (!ordersUnlocked()) return 'Appoint Ellis launch director first.';
  if (!S.progs[prog] || !S.progs[prog].ready || !PROGRAMMES[prog]) return 'That rocket is not ready to fly.';
  if (orderFor(prog)) return 'That rocket already has a standing order.';
  if (!(cap > 0)) return 'Set a spending cap.';
  S.orders.by[prog] = { cap, spent: 0, n: 0, okn: 0, paid: 0, hold: null, pk: approvedPackages(prog) };
  if (!S.orders.due) S.orders.due = Math.round(S.day + 5);
  log(`[LAUNCH DIRECTOR] Standing order: the ${PROGRAMMES[prog].name} flies routine customer flights, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
// double: raise by the cap itself, for the budgets of a big programme.
export function raiseOrder(prog, double = false) {
  const order = orderFor(prog);
  if (!order) return;
  order.cap += double ? order.cap : ORDER_RAISE;
  if (order.hold && order.hold.startsWith('The cap')) order.hold = null;
  log(`[LAUNCH DIRECTOR] ${PROGRAMMES[prog].name} order raised to ${formatMoney(order.cap)}.`, 'cyan');
}
export function endOrder(prog) {
  const order = orderFor(prog);
  if (!order) return;
  delete S.orders.by[prog];
  log(`[LAUNCH DIRECTOR] ${PROGRAMMES[prog].name} order closed: ${order.n} flight${order.n == 1 ? '' : 's'}, ${order.okn} good, ${formatMoney(order.paid)} from customers, ${formatMoney(order.spent)} of ${formatMoney(order.cap)} spent.`, 'wn');
  if (!standingOrders().length) S.orders.reqs = [];
}
// You approve the rocket's new configuration (or answer Ellis's question about a load): the order flies again.
export function resumeOrder(prog) {
  const order = orderFor(prog);
  if (!order) return;
  order.hold = null;
  order.aside = 0;
  order.pk = approvedPackages(prog);
}
// The packages of the newest ready airframe, or else the published blueprint.
function approvedPackages(prog) {
  const airframe = readyAirframes(prog)[0];
  return airframe ? [...airframe.pk] : withProgramme(prog, () => [...S.bp.pk]);
}
// Airframes Ellis can take for routine flights: ready, and not set aside (aside: why she would not plan a load on it).
const readyAirframes = prog => S.air.filter(airframe => airframe.st == 'r' && airframe.prog == prog && !airframe.aside && !heldForLaunch(airframe)).sort((first, second) => second.pk.length - first.pk.length);
const openIncident = prog => withProgramme(prog, () => S.inc.some(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag'));

// DEMAND. Returns true if a request arrived or lapsed.
export function demandTick() {
  if (!standingOrders().length) return false;
  let changed = false;
  const before = S.orders.reqs.length;
  S.orders.reqs = S.orders.reqs.filter(request => request.by > S.day);
  if (S.orders.reqs.length < before) changed = true;
  if (S.day >= S.orders.due) {
    S.orders.due = Math.round(S.day + REQUEST_DAYS);
    if (S.orders.reqs.length < OPEN_REQUESTS) {
      const reach = Math.max(20, (S.hi || 0) / 1000 * 1.1), profiles = PROFILES.filter(km => km <= reach);
      const km = profiles[Math.floor(Math.random() * profiles.length)], customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
      S.orders.reqs.push({ id: S.orders.n++, who: customer, pay: ROUTINE_PAYLOAD, km, fee: contractPay(km), by: Math.round(S.day + REQUEST_LIFE), why: '' });
      changed = true;
    }
  }
  return changed;
}

// Why an order is not flying now, if it waits by itself (it clears when the cause does), or null.
export function orderWaiting(prog) {
  if (openIncident(prog)) return 'an incident on the rocket is still open';
  if (!readyAirframes(prog).length) return 'no airframe ready';
  if (S.b < TREASURY_RESERVE + 5000) return 'the treasury is short';
  return null;
}

// ELLIS'S TURN on the orders, when no campaign flight went this turn (rules/auto.js). Returns true if anything happened.
export function ordersTurn(margin = directorMargin()) {
  if (!ordersUnlocked() || !standingOrders().length) return false;
  let changed = supplyOrders();
  for (const request of S.orders.reqs) {
    const choice = chooseRocket(request, margin);
    request.why = choice.why || '';
    if (!choice.airframe) continue;
    return flyRequest(request, choice) || changed;
  }
  return changed;
}

// Each ordered rocket with nothing ready or on the floor gets one airframe ordered, inside its cap (Reed does this for hers).
function supplyOrders() {
  let changed = false;
  for (const prog of standingOrders()) {
    const order = orderFor(prog);
    if (order.hold || (S.works && S.works.prog == prog)) continue;
    const onHand = readyAirframes(prog).length + S.aq.filter(item => item.k == 'build' && item.prog == prog).length;
    if (onHand) continue;
    const cost = withProgramme(prog, () => batchCost(1));
    if (order.spent + cost > order.cap) {
      order.hold = `The cap cannot cover another airframe (${formatMoney(cost)}).`;
      log(`[LAUNCH DIRECTOR] ${PROGRAMMES[prog].name} order: ${order.hold} Raise it or close the order.`, 'wn');
      changed = true;
      continue;
    }
    if (S.b - cost < TREASURY_RESERVE) continue;
    withProgramme(prog, () => orderAirframes(1));
    order.spent += cost;
    changed = true;
  }
  return changed;
}

// The cheapest rocket under order whose planned load reaches the profile: { airframe, plan, fuel, pay } or { why }.
function chooseRocket(request, margin) {
  const reasons = [];
  const candidates = standingOrders().sort((first, second) => PROGRAMMES[first].unitCost - PROGRAMMES[second].unitCost);
  for (const prog of candidates) {
    const order = orderFor(prog), airframe = readyAirframes(prog)[0];
    if (order.hold) continue;
    const waiting = orderWaiting(prog);
    if (waiting) {
      reasons.push(`${PROGRAMMES[prog].name}: ${waiting}`);
      continue;
    }
    const newMilestone = airframe.pk.find(id => isMilestone(id) && !order.pk.includes(id));
    if (newMilestone) {
      order.hold = `The ${PROGRAMMES[prog].name} now flies a new configuration. Approve it before routine flights resume.`;
      log(`[LAUNCH DIRECTOR] ${order.hold}`, 'wn');
      continue;
    }
    // The full stack where the rocket has a booster stage and it plans safely, else the upper stage alone.
    const fuel = PROGRAMMES[prog].propellants[0];
    const plans = [1, 0].map(st => withProgramme(prog, () => planLoad(airframe, { fuel, pay: request.pay, st }, margin))).filter(plan => !plan.reason);
    // No safe plan: she sets the airframe aside for you to fly or look at, and carries on with the next. Two in a row means the
    // design itself needs work, and the order waits for you.
    if (!plans.length) {
      const reason = withProgramme(prog, () => planLoad(airframe, { fuel, pay: request.pay, st: 0 }, margin)).reason;
      airframe.aside = reason;
      order.aside = (order.aside || 0) + 1;
      log(`[LAUNCH DIRECTOR] ${airframe.label} set aside from routine flights: ${reason}. Fly it yourself or look at the design.`, 'wn');
      if (order.aside >= 2) {
        order.hold = `Two ${PROGRAMMES[prog].name} airframes in a row could not be planned safely (${reason}). The design needs work before routine flights resume.`;
        log(`[LAUNCH DIRECTOR] ${order.hold}`, 'wn');
      }
      continue;
    }
    order.aside = 0;
    const reach = plans.map(plan => ({ plan, peak: withProgramme(prog, () => previewFlight(airframe, fuel, request.pay, plan.stage, plan.load).peakAltitude) }));
    const best = reach.find(each => each.peak >= request.km * 1000);
    if (!best) {
      reasons.push(`the ${PROGRAMMES[prog].name} reaches about ${Math.round(Math.max(...reach.map(each => each.peak)) / 1000)} km`);
      continue;
    }
    return { airframe, plan: best.plan, fuel, pay: request.pay, prog };
  }
  return { why: reasons.join('; ') || 'no rocket under order can take it' };
}

function flyRequest(request, { airframe, plan, fuel, pay, prog }) {
  const order = orderFor(prog);
  return withProgramme(prog, () => {
    const quote = quoteLaunch(airframe, fuel, pay, plan.stage, plan.load);
    if (quote.error) {
      order.hold = quote.error;
      return true;
    }
    if (order.spent + quote.cost > order.cap) {
      order.hold = `The cap cannot cover the next flight (${formatMoney(quote.cost)}).`;
      log(`[LAUNCH DIRECTOR] ${PROGRAMMES[prog].name} order: ${order.hold} Raise it or close the order.`, 'wn');
      return true;
    }
    if (S.b - quote.cost < TREASURY_RESERVE) return false;
    const poll = runPoll(airframe, fuel, plan.stage), before = S.b;
    if (poll.nogo && S.b >= PAD_FIX_COST) troubleshoot(poll);
    if (poll.nogo && S.b >= scrubCost()) scrub(poll);
    order.spent += before - S.b;
    if (poll.nogo) return true;
    const flight = beginFlight(airframe, fuel, pay, plan.stage, plan.load, { latent: poll.fault, wind: poll.wind });
    if (!flight) return false;
    flight.byDirector = true;
    order.spent += quote.cost;
    let result;
    do {
      result = step(flight);
      if (result == 'tick') takeReadings(flight, true);
    } while (result == 'tick' || result == 'sep');
    const ok = result != 'fail';
    endFlight(flight, ok, result);
    order.n++;
    const reached = ok && flight.peakAltitude >= request.km * 1000 * .95;
    if (reached) {
      order.okn++;
      order.paid += request.fee;
      earn(request.fee);
      S.orders.reqs.splice(S.orders.reqs.indexOf(request), 1);
    } else log(`[LAUNCH DIRECTOR] The ${airframe.label} did not deliver ${request.who}'s ${request.km} km. The request stays open.`, 'wn');
    teachNewest(prog, flight);
    return true;
  });
}

// Flight time on an older rocket still teaches the newest one, at a reduced rate.
function teachNewest(prog, flight) {
  const newest = Object.keys(S.progs).filter(kind => S.progs[kind].ready && PROGRAMMES[kind]).sort((first, second) => PROGRAMMES[second].generation - PROGRAMMES[first].generation)[0];
  if (!newest || newest == prog) return;
  const value = teachingValue(flight.tracking);
  withProgramme(newest, () => {
    for (const area of ['p', 's', 'a']) learn(area, .8 * value * OLDER_ROCKET_SHARE);
  });
}

// The rolling report's numbers across all orders.
export const ordersTotals = () => standingOrders().reduce((sum, prog) => {
  const order = orderFor(prog);
  return { n: sum.n + order.n, okn: sum.okn + order.okn, paid: sum.paid + order.paid };
}, { n: 0, okn: 0, paid: 0 });
export const requestText = request => `${request.who}: ${request.km} km, ${formatMoney(request.fee)}, open until ${formatDate(request.by)}`;
