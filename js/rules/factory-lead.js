// THE FACTORY LEAD: Margaret Reed joins once you appoint Ellis launch director, so the factory has its own lead once the launches
// run themselves. Give her a factory budget (a spending cap, like Ellis's remit and Chen's lanes) for one rocket and she runs its
// production:
//   - keeps AIRFRAMES_ON_HAND airframes of it ready or in the queue,
//     ordering one at a time;
//   - publishes the blueprint as finished research and fixes come in, unless the change is unbalanced (below);
//   - upgrades ready airframes that are behind the published blueprint, one at a time.
// UNBALANCED: research lanes (rules/lanes.js) do not move together, and tank work can land before engine work. A draft that would
// cut the rocket's liftoff thrust-to-weight by more than BALANCE_TOLERANCE is held, and comes to you in Mail: publish it now, or
// let Reed hold it until the engine work catches up (she publishes as soon as the cut is back within the tolerance). A draft that
// carries a fix for a failure is never held: the fix goes out with it. While her budget runs, she does the publishing
// for that rocket and the Hangar's auto-publish leaves it alone. No DOM.
//
// S.works: { prog: the rocket, cap ($), spent ($), built: airframes ordered, retro: upgrades queued, dry: what the cap could not
//            cover, or null, hold: the held draft's change in thrust-to-weight (a fraction, e.g. -.06), or null }
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, withProgramme } from '../core/state.js';
import { baseDesign, fixModifiers } from './design.js';
import { itemAsSeen } from './research.js';
import { batchCost, draftChanges, draftSize, retrofitQuote } from './production.js';
import { orderAirframes, publishBlueprint, queueRetrofit, heldForLaunch } from './factory.js';
import { memberJoined } from './team.js';
import { cultureLean, acceptRisk, LEAN_TO_ACT } from './culture.js';

// How many airframes of her rocket Reed keeps ready or in the queue.
export const AIRFRAMES_ON_HAND = 2;
// How many she keeps of a rocket (Ellis orders her own for routine flights).
export const airframesWanted = () => AIRFRAMES_ON_HAND;
export const airframesOnHand = prog => S.air.filter(airframe => airframe.prog == prog && (airframe.st == 'r' || airframe.st == 'queued')).length
  + S.aq.filter(item => item.k == 'build' && item.prog == prog).length;
// The budgets you can set, and how much a raise adds.
export const WORKS_CAPS = [20000, 40000, 80000];
export const WORKS_RAISE = 20000;
// The largest cut in liftoff thrust-to-weight Reed publishes without asking you.
export const BALANCE_TOLERANCE = .03;
// She leaves this much in the treasury for you.
const TREASURY_RESERVE = 6000;

// Reed joins when you appoint the launch director. Returns true if she joined now.
export function reedJoinTick() {
  if (memberJoined('reed') || !S.staff.director) return false;
  S.team.joined = { ...S.team.joined, reed: 1 };
  log('[FACTORY] Margaret Reed joins as factory lead. Give her a factory budget in Mail and she keeps a rocket built, upgraded and its blueprint published.', 'hd');
  return true;
}

// Give Reed a budget for the programme in focus. Returns an error text, or null if it started.
export function startWorks(cap) {
  if (!memberJoined('reed')) return 'Margaret Reed has not joined yet.';
  if (S.works) return 'Reed already has a factory budget.';
  if (!S.progs[S.cur] || !S.progs[S.cur].ready || !(cap > 0)) return 'Choose a rocket in production and a budget.';
  S.works = { prog: S.cur, cap, spent: 0, built: 0, retro: 0, dry: null, hold: null };
  log(`[FACTORY] Reed takes over production of the ${PROGRAMMES[S.cur].name}, up to ${formatMoney(cap)}.`, 'cyan');
  return null;
}
// double: raise by the cap itself, for the budgets of a big programme.
export function raiseWorks(double = false) {
  if (!S.works) return;
  S.works.cap += double ? S.works.cap : WORKS_RAISE;
  S.works.dry = null;
  log(`[FACTORY] Reed's factory budget raised to ${formatMoney(S.works.cap)}.`, 'ok');
}
// Closing stops new orders and upgrades; work already in the queue finishes. The blueprint goes back to you.
export function endWorks() {
  const works = S.works;
  if (!works) return;
  S.works = null;
  log(`[FACTORY] Reed hands production back: ${works.built} airframe${works.built == 1 ? '' : 's'} ordered, ${works.retro} upgraded, ${formatMoney(works.spent)} of ${formatMoney(works.cap)} spent.`, 'wn');
}
// You tell Reed to publish the held draft anyway.
export function publishHeld() {
  if (!S.works || !S.works.hold) return;
  S.works.hold = null;
  withProgramme(S.works.prog, () => publishBlueprint());
}
// Why Reed's line is quiet, for the brief: holding a draft, the cap, the treasury, or a full stock. null while she has work.
export function worksIdleReason() {
  const works = S.works;
  if (!works || S.aq.some(item => item.prog == works.prog)) return null;
  if (works.hold) return 'holding an unbalanced blueprint for you';
  if (works.dry) return `budget cannot cover ${works.dry}`;
  if (airframesOnHand(works.prog) < airframesWanted()) return 'waiting for funds';
  return `${airframesOnHand(works.prog)} of ${airframesWanted()} on hand, nothing to upgrade`;
}
// Whether Reed does the publishing for the programme in focus (the Hangar's auto-publish then leaves it alone).
export const reedPublishes = () => !!S.works && S.works.prog == S.cur;

// LIFTOFF THRUST against the liftoff mass of a configuration of the programme in focus, as the engineers believe it, with full
// tanks of alcohol and no payload: the measured effect of each confirmed package, the research estimate of the rest (Reed
// never sees the true effects). Only used to compare two configurations of the same rocket.
const believedEffects = id => S.pk[id].c && S.pk[id].m ? S.pk[id].m : itemAsSeen(id).effects;
function liftoffThrustToWeight(packages, fixes) {
  const base = baseDesign(true, fixes), modifiers = fixModifiers(fixes);
  let thrust = 1, dryMass = base.dry + modifiers.d, propellant = base.f;
  for (const id of packages) {
    const effects = believedEffects(id);
    thrust += effects.t || 0;
    dryMass += effects.d || 0;
    propellant += effects.f || 0;
  }
  return base.thr * thrust * modifiers.t / (dryMass + propellant);
}
// How the draft would change liftoff thrust-to-weight against the published blueprint: a fraction, negative if it lowers it.
export function draftThrustToWeightChange() {
  const published = liftoffThrustToWeight(S.bp.pk, S.bp.fix);
  return liftoffThrustToWeight(Object.keys(S.pk), S.fix) / published - 1;
}

// Each second. Returns true if anything happened.
export function worksTick() {
  const works = S.works;
  if (!works) return false;
  if (!S.progs[works.prog]) {
    endWorks();
    return true;
  }
  return withProgramme(works.prog, () => {
    const published = publishTurn(works), ordered = orderTurn(works), upgraded = retrofitTurn(works);
    return published || ordered || upgraded;
  });
}

function publishTurn(works) {
  const draft = draftChanges();
  if (!draftSize(draft)) {
    works.hold = null;
    return false;
  }
  const change = draftThrustToWeightChange();
  // In a chaotic culture (rules/culture.js) Reed publishes an unbalanced draft rather than hold it: a risk accepted. Money pressure
  // alone does not make her do it: a heavier blueprint is hard to undo, and with no money for the engine work that would cure it
  // the rocket could be stuck short of performance for good (a dead end, not a risk).
  const rushed = change < -BALANCE_TOLERANCE && !draft.fixes.length && cultureLean() >= LEAN_TO_ACT;
  if (rushed) acceptRisk('reed', 'FACTORY', `Reed publishes the ${PROGRAMMES[works.prog].name} blueprint although it cuts liftoff thrust-to-weight by ${Math.round(-change * 100)}%.`);
  if (change >= -BALANCE_TOLERANCE || draft.fixes.length || rushed) {
    if (change < -BALANCE_TOLERANCE && !rushed) log(`[FACTORY] Reed publishes the ${PROGRAMMES[works.prog].name} blueprint although it cuts liftoff thrust-to-weight by ${Math.round(-change * 100)}%: it carries a fix, and a fix does not wait.`, 'wn');
    works.hold = null;
    publishBlueprint(true);
    return true;
  }
  if (works.hold != null && Math.abs(works.hold - change) < .005) return false;
  works.hold = change;
  log(`[FACTORY] Reed is holding the ${PROGRAMMES[works.prog].name} draft: it would cut liftoff thrust-to-weight by ${Math.round(-change * 100)}%. She will publish once the engine work catches up, or now if you say so.`, 'wn');
  return true;
}

// Whether the cap can cover a cost; if not, say so once. Returns true if it can.
function withinCap(works, what, cost) {
  if (works.spent + cost <= works.cap) return true;
  if (works.dry != what) {
    works.dry = what;
    log(`[FACTORY] Reed's budget cannot cover ${what} (${formatMoney(cost)}). Raise it or hand production back.`, 'wn');
  }
  return false;
}

function orderTurn(works) {
  // An airframe away for an upgrade still counts: it comes back.
  if (airframesOnHand(works.prog) >= airframesWanted()) return false;
  const cost = batchCost(1);
  if (!withinCap(works, 'another airframe', cost) || S.b - cost < TREASURY_RESERVE) return false;
  orderAirframes(1);
  works.spent += cost;
  works.built++;
  return true;
}

function retrofitTurn(works) {
  if (S.aq.some(item => item.k == 'retro' && item.prog == works.prog)) return false;
  const airframe = S.air.find(candidate => candidate.prog == works.prog && candidate.st == 'r' && !heldForLaunch(candidate) && retrofitQuote(candidate));
  if (!airframe) return false;
  const cost = retrofitQuote(airframe).cost;
  if (!withinCap(works, `the upgrade of ${airframe.label}`, cost) || S.b - cost < TREASURY_RESERVE) return false;
  queueRetrofit(airframe.id);
  works.spent += cost;
  works.retro++;
  return true;
}
