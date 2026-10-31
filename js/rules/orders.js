// THE STANDING ORDER: once Ellis is launch director, she can be given a standing order. She keeps flying routine flights for
// outside customers under one spending cap, with no launch scheduling from you (GDD v7.2 §4, §6). The flights follow demand:
// the services and the research panels ask for flights to a profile (an altitude), and Ellis flies each one on the cheapest
// rocket you own that reaches it, which need not be the newest. When no airframe of that rocket is ready she orders one (rather
// than spend a bigger rocket on it), and only that one. The customer reimburses each flight's launch and airframe, and a good
// flight also pays the contract fee. Every flight teaches the team: the rocket's own systems as any flight does, and the newest
// rocket a little as well (flight time on an older rocket still counts, at a reduced rate). Good flights go into one rolling
// Mail report. The order stops and asks you when its cap is spent or when Ellis cannot plan a safe load (a new configuration
// needs no approval: it was cleared with its blueprint); a rocket waits by itself while an incident on it is open, and the order
// while the treasury is short. An airframe you hold for a launch is never hers. The order is started from a rocket's programme
// brief (rules/brief.js) and covers every rocket. Campaigns run alongside: a campaign's flight goes first, and a campaign ending
// does not stop the order. No DOM.
//
// S.orders: { o: the order or null, reqs: open requests, n: the next request id, due: the game day the next request arrives }
//   order:   { prog: the rocket whose brief started it, cap ($), spent ($), n: flights, okn: good flights, paid ($ from customers),
//              hold: why Ellis waits for you or null, pk: { [prog]: the packages of the configuration flying } (a new milestone
//              among an airframe's packages is noted in the log), aside: airframes set aside in a row because no safe load could
//              be planned }
// An airframe Ellis will not fly on routine flights carries aside: the reason; you can still fly it yourself.
//   request: { id, who, pay: the payload flown, km: the altitude asked for, fee ($ on a good flight), by: the game day it lapses,
//              why: why it is waiting }
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { isMilestone } from '../data/research.js';
import { S, log, earn, formatDate, withProgramme } from '../core/state.js';
import { quoteLaunch } from './design.js';
import { batchCost, blueprintConfig } from './production.js';
import { orderAirframes, heldForLaunch } from './factory.js';
import { beginFlight, previewFlight } from './flight.js';
import { learn, teachingValue } from './knowledge.js';
import { directorMargin } from './campaign.js';
import { planLoad, directorPoll, flyToEnd, testFirst } from './auto.js';
import { leansChaotic, acceptRisk } from './culture.js';
import { stagesOf } from './programs.js';

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
// A good flight pays $2,000 plus $50 per km asked for: the margin.
export const contractPay = km => 2000 + 50 * km;
// The customers pay cost-plus: every flight flown for them is reimbursed, the launch and the airframe it used, whether or not it
// delivers, so routine flying breaks even and a good flight's fee is the margin on top.
export const flightReimbursement = (launchCost, airframe) => launchCost + (airframe.cost || 0);
// Flight time on a rocket older than the newest teaches the newest at this share of a flight of its own.
export const OLDER_ROCKET_SHARE = .3;

export const ordersUnlocked = () => !!S.staff.director;
export const standingOrder = () => S.orders.o;

// Give Ellis the standing order, from the brief of a ready rocket. Returns an error text, or null if it started.
export function startOrder(prog, cap) {
  if (!ordersUnlocked()) return 'Appoint Ellis launch director first.';
  if (!S.progs[prog] || !S.progs[prog].ready || !PROGRAMMES[prog]) return 'That rocket is not ready to fly.';
  if (standingOrder()) return 'Ellis already has a standing order.';
  if (!(cap > 0)) return 'Set a spending cap.';
  S.orders.o = { prog, cap, spent: 0, n: 0, okn: 0, paid: 0, hold: null, pk: {}, aside: 0 };
  if (!S.orders.due) S.orders.due = Math.round(S.day + 5);
  log(`[LAUNCH DIRECTOR] Standing order: routine customer flights on the cheapest rocket that reaches each request, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
// double: raise by the cap itself, for the budgets of a big programme.
export function raiseOrder(double = false) {
  const order = standingOrder();
  if (!order) return;
  order.cap += double ? order.cap : ORDER_RAISE;
  if (order.hold && order.hold.startsWith('The cap')) order.hold = null;
  log(`[LAUNCH DIRECTOR] Standing order raised to ${formatMoney(order.cap)}.`, 'cyan');
}
export function endOrder() {
  const order = standingOrder();
  if (!order) return;
  S.orders.o = null;
  S.orders.reqs = [];
  log(`[LAUNCH DIRECTOR] Standing order closed: ${order.n} flight${order.n == 1 ? '' : 's'}, ${order.okn} good, ${formatMoney(order.paid)} from customers, ${formatMoney(order.spent)} of ${formatMoney(order.cap)} spent.`, 'wn');
}
// You answer Ellis's question about a load: the order flies again.
export function resumeOrder() {
  const order = standingOrder();
  if (!order) return;
  order.hold = null;
  order.aside = 0;
}
// Airframes Ellis can take for routine flights: ready, and not set aside (aside: why she would not plan a load on it).
const readyAirframes = prog => S.air.filter(airframe => airframe.st == 'r' && airframe.prog == prog && !airframe.aside && !heldForLaunch(airframe)).sort((first, second) => second.pk.length - first.pk.length);
// The rocket as its published blueprint would build it, to judge whether one is worth ordering.
const paperAirframe = prog => withProgramme(prog, () => ({ prog, ...blueprintConfig(), label: PROGRAMMES[prog].name }));
// Every rocket in production, cheapest airframe first (lower stages fly as part of their rocket).
const rocketsByCost = () => Object.keys(S.progs).filter(kind => S.progs[kind].ready && PROGRAMMES[kind] && !PROGRAMMES[kind].stageOf).sort((first, second) => PROGRAMMES[first].unitCost - PROGRAMMES[second].unitCost);
// An open incident on the rocket or on one of its lower stages (rules/stages.js).
export const openIncident = prog => [prog, ...stagesOf(prog)].some(kind => withProgramme(kind, () => S.inc.some(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag')));

// DEMAND. Returns true if a request arrived or lapsed.
export function demandTick() {
  if (!standingOrder()) return false;
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

// Why the order is not flying now, if it waits by itself (it clears when the cause does), or null.
export function orderWaiting() {
  if (S.b < TREASURY_RESERVE + 5000) return 'the treasury is short';
  return null;
}

// ELLIS'S TURN on the order, when no campaign flight went this turn (rules/auto.js). Returns true if anything happened.
export function ordersTurn(margin = directorMargin()) {
  const order = standingOrder();
  if (!ordersUnlocked() || !order || order.hold || orderWaiting()) return false;
  let changed = false;
  for (const request of S.orders.reqs) {
    const choice = chooseRocket(request, margin);
    request.why = choice.why || '';
    if (choice.ordered) changed = true;
    if (order.hold) return true;
    if (!choice.airframe) continue;
    return flyRequest(request, choice) || changed;
  }
  return changed;
}

// The cheapest rocket whose planned load reaches the profile. Returns { airframe, plan, fuel, pay, prog } to fly now, or
// { why, ordered } when the request waits: for an airframe of that rocket (ordered now if none is on the floor), or because no
// rocket reaches it. A rocket with nothing ready is judged by its blueprint.
function chooseRocket(request, margin) {
  const order = standingOrder(), reasons = [];
  for (const prog of rocketsByCost()) {
    const name = PROGRAMMES[prog].name;
    // THE CULTURE (rules/culture.js): only a team leaning chaotic flies a rocket with an incident open, and logs the risk it accepts.
    if (openIncident(prog) && !leansChaotic('ellis')) {
      reasons.push(`${name}: an incident is still open`);
      continue;
    }
    const ready = readyAirframes(prog)[0], airframe = ready || paperAirframe(prog);
    // A new configuration was cleared when its blueprint was signed into the design: she notes it and flies on.
    if (ready && order.pk[prog] && ready.pk.some(id => isMilestone(id) && !order.pk[prog].includes(id))) log(`[LAUNCH DIRECTOR] The ${name} flies its new configuration on routine flights from now on.`, 'cyan');
    if (ready) order.pk[prog] = [...ready.pk];
    // The full stack where the rocket has a booster stage and it plans safely, else the upper stage alone.
    const fuel = PROGRAMMES[prog].propellants[0];
    const plans = [1, 0].map(st => withProgramme(prog, () => planLoad(airframe, { fuel, pay: request.pay, st }, margin))).filter(plan => !plan.reason);
    if (!plans.length) {
      if (!ready) continue;
      // No safe plan: she sets the airframe aside for you to fly or look at, and carries on with the next. Two in a row means
      // the design itself needs work, and the order waits for you.
      const reason = withProgramme(prog, () => planLoad(ready, { fuel, pay: request.pay, st: 0 }, margin)).reason;
      ready.aside = reason;
      order.aside++;
      log(`[LAUNCH DIRECTOR] ${ready.label} set aside from routine flights: ${reason}. Fly it yourself or look at the design.`, 'wn');
      if (order.aside >= 2) {
        order.hold = `Two airframes in a row could not be planned safely (${reason}). The design needs work before routine flights resume.`;
        log(`[LAUNCH DIRECTOR] ${order.hold}`, 'wn');
        return { why: order.hold };
      }
      continue;
    }
    const reach = plans.map(plan => ({ plan, peak: withProgramme(prog, () => previewFlight(airframe, fuel, request.pay, plan.stage, plan.load).peakAltitude) }));
    const best = reach.find(each => each.peak >= request.km * 1000);
    if (!best) {
      reasons.push(`the ${name} reaches about ${Math.round(Math.max(...reach.map(each => each.peak)) / 1000)} km`);
      continue;
    }
    if (ready) {
      order.aside = 0;
      return { airframe: ready, plan: best.plan, fuel, pay: request.pay, prog };
    }
    // This rocket can do it but has nothing ready: wait for the one on the floor, or order one if the cap and treasury allow.
    if (S.aq.some(item => item.k == 'build' && item.prog == prog)) return { why: `waiting for a ${name} airframe` };
    const cost = withProgramme(prog, () => batchCost(1));
    if (order.spent + cost > order.cap) {
      order.hold = `The cap cannot cover another airframe (${formatMoney(cost)}, a ${name}).`;
      log(`[LAUNCH DIRECTOR] Standing order: ${order.hold} Raise it or close the order.`, 'wn');
      return { why: order.hold, ordered: true };
    }
    if (S.b - cost < TREASURY_RESERVE) {
      reasons.push(`the treasury cannot cover a ${name} airframe`);
      continue;
    }
    withProgramme(prog, () => orderAirframes(1));
    order.spent += cost;
    return { why: `waiting for a ${name} airframe`, ordered: true };
  }
  return { why: reasons.join('; ') || 'no rocket can take it' };
}

function flyRequest(request, { airframe, plan, fuel, pay, prog }) {
  const order = standingOrder();
  return withProgramme(prog, () => {
    const quote = quoteLaunch(airframe, fuel, pay, plan.stage, plan.load);
    if (quote.error) {
      order.hold = quote.error;
      return true;
    }
    if (order.spent + quote.cost > order.cap) {
      order.hold = `The cap cannot cover the next flight (${formatMoney(quote.cost)}).`;
      log(`[LAUNCH DIRECTOR] Standing order: ${order.hold} Raise it or close the order.`, 'wn');
      return true;
    }
    if (S.b - quote.cost < TREASURY_RESERVE) return false;
    // A careful team proves new engine work on the test stand first (rules/auto.js testFirst).
    const test = testFirst(airframe, order.cap - order.spent);
    if (test) {
      order.spent += test.cost;
      return !!test.cost;
    }
    const { poll, cost } = directorPoll(airframe, fuel, plan.stage);
    order.spent += cost;
    if (poll.nogo) return true;
    const flight = beginFlight(airframe, fuel, pay, plan.stage, plan.load, { latent: poll.fault, wind: poll.wind });
    if (!flight) return false;
    flight.byDirector = true;
    order.spent += quote.cost;
    if (openIncident(prog)) acceptRisk('ellis', 'LAUNCH DIRECTOR', `${airframe.label} flies ${request.who}'s request with an incident still open.`);
    const ok = flyToEnd(flight) != 'fail';
    order.n++;
    const costs = flightReimbursement(quote.cost, airframe);
    order.paid += costs;
    earn(costs);
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

export const requestText = request => `${request.who}: ${request.km} km, ${formatMoney(request.fee)}, open until ${formatDate(request.by)}`;
