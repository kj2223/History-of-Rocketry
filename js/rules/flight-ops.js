// FLIGHT OPERATIONS: Ellis runs the Mercury tests (Aaron's playtest, 31 Oct 2026; middle-path plan, "NASA runs on your culture").
// Once NASA is formed and she is launch director, you can hand her the Mercury directives under a spending cap. For the directive
// in hand she orders the capsule and the booster, flies the booster's man-rating flights, assigns a pilot if none is assigned,
// and brings each launch to the pad. Then it waits for you in Mail: GREENLIGHT and Flight Control flies it, ATTEND and it is set up
// in Watch for you to count down, or NOT YET. An unanswered launch never flies by itself. Once you have greenlit a kind of
// uncrewed flight (a man-rating flight, a Little Joe) STANDING_AFTER times, repeats of it fly on that standing approval; a new kind
// of flight and every crewed flight always need your go-ahead.
//
// She works in the house style (rules/culture.js): in flight Flight Control pushes on for the directive or comes home early
// according to her team's risk appetite; a careful team waits for an open incident on the booster to be fixed first.
// Gemini is not hers yet: its directives come back to you. The safety bar (rules/safety.js) still holds: a crew she cannot fly
// past it waits for you. No DOM.
//
// S.ops: { cap ($), spent ($), n: launches flown, okn: good ones, gl: { kind: greenlights you gave }, ready: the launch waiting for
//          you or null, hold: why she stopped and needs you (the cap) or null, wait: why she is idle (shown in Mail), short: { prog:
//          blueprint revision } boosters known to fall short of the directive's mission, snooze: game day NOT YET lasts until,
//          pre: { kind: flights you approved in advance }, series: a crewed series you authorised { mt, n: flights left } or null }
//   ready: { kind, what, crewed: 1 if a person flies, rating: 1 for a man-rating flight, af: booster id, fuel, vid: capsule id,
//            crew, orbits, mt: mission type }
import { formatMoney } from '../core/util.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES } from '../data/mercury.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, withProgramme } from '../core/state.js';
import { quoteLaunch } from './design.js';
import { batchCost } from './production.js';
import { orderAirframes, heldForLaunch } from './factory.js';
import { beginFlight } from './flight.js';
import { openDirectives, requirementText, boosterPlan, crewLock, orderCapsule, capsuleSystems, directiveDone } from './mercury.js';
import { beginMission, stepMission, endMission, decisionOptions, decisionOdds, chooseOption, missionStepSeconds } from './mission.js';
import { isManRated, manRatingResearchDone } from './manrate.js';
import { assignPilot, assignBackup, assignedPilot, backupPilot, isQualified } from './astronauts.js';
import { planLoad, directorPoll, flyToEnd } from './auto.js';
import { openIncident } from './orders.js';
import { riskAppetite, leansSafe, ellisMargin, recordConfidence } from './culture.js';

export const OPS_CAPS = [100000, 250000, 500000];
export const OPS_RAISE = 100000;
// Greenlights of one kind of uncrewed flight after which its repeats fly on standing approval.
export const STANDING_AFTER = 3;
// NOT YET holds a launch this many game days before she asks again.
export const SNOOZE_DAYS = 30;
const TREASURY_RESERVE = 6000;
const BALLAST = 'Inert Ballast';

export const opsUnlocked = () => !!S.nasa && !!S.p2 && !!S.staff.director;
const ops = () => S.ops;

export function startOps(cap) {
  if (!opsUnlocked()) return 'Ellis takes the Mercury tests once NASA is formed and she is launch director.';
  if (ops()) return 'Ellis already runs the Mercury tests.';
  S.ops = { cap, spent: 0, n: 0, okn: 0, gl: {}, ready: null, hold: null, wait: null, short: {}, snooze: 0, gemini: 0 };
  log(`[FLIGHT OPS] Ellis takes the Mercury tests, up to ${formatMoney(cap)}. Each launch comes to you for a greenlight.`, 'cyan');
  return null;
}
export function delegateGemini() {
  if (!opsUnlocked()) return 'Ellis takes Gemini only after NASA is formed and she is launch director.';
  if (!S.ops) return 'Give Ellis the Mercury tests first.';
  if (!S.p2 || !S.p2.fl || !S.p2.fl.gem) return 'Gemini is not open yet.';
  S.ops.gemini = 1;
  S.ops.wait = null;
  log('[FLIGHT OPS] Ellis takes the Gemini preparation work. Every Gemini launch still waits for your greenlight.', 'cyan');
  return null;
}
export function raiseOps(double = false) {
  if (!ops()) return;
  ops().cap += double ? ops().cap : OPS_RAISE;
  ops().hold = null;
  log(`[FLIGHT OPS] Mercury tests raised to ${formatMoney(ops().cap)}.`, 'cyan');
}
export function endOps() {
  if (!ops()) return;
  log(`[FLIGHT OPS] Ellis hands the Mercury tests back: ${ops().n} launches, ${formatMoney(ops().spent)} spent.`, 'cyan');
  S.ops = null;
}

// THE DIRECTIVE IN HAND: the first open Mercury directive (Gemini's come back to you).
const directiveInHand = () => openDirectives().find(directive => directive.project != 'gemini' || ops()?.gemini) || null;
const isCrewedKey = directive => ['crew', 'ocrew', 'oday'].includes(directive.key) || !!directive.crew;
const ratedTypeFor = directive => directive.section == 2 || MISSION_TYPES[directive.missionType || 'mr'].orbital ? 'mo' : 'mr';

// The cheapest ready booster that delivers the mission type: { airframe, fuel } or null. Boosters that fall short are noted
// against their blueprint revision, so she orders a bigger rocket instead.
function boosterFor(missionType, crewed) {
  const record = ops(), ready = S.air.filter(airframe => airframe.st == 'r' && PROGRAMMES[airframe.prog] && !PROGRAMMES[airframe.prog].needsGemini && !heldForLaunch(airframe) && !airframe.aside)
    .sort((first, second) => PROGRAMMES[first.prog].unitCost - PROGRAMMES[second.prog].unitCost);
  for (const airframe of ready) {
    if (crewed && !isManRated(airframe)) continue;
    const fuel = PROGRAMMES[airframe.prog].propellants.find(propellant => boosterPlan(airframe, propellant, missionType).ok);
    if (fuel) return { airframe, fuel };
    record.short[airframe.prog + ':' + missionType] = airframe.rev;
  }
  return null;
}
// Order one airframe of the cheapest rocket not known to fall short. Returns why she waits.
function orderBooster(missionType) {
  const record = ops();
  if (S.aq.some(item => item.k == 'build')) return 'a booster is on the factory floor';
  const kinds = Object.keys(S.progs).filter(kind => S.progs[kind].ready && PROGRAMMES[kind] && !PROGRAMMES[kind].needsGemini && !PROGRAMMES[kind].needsApollo)
    .filter(kind => record.short[kind + ':' + missionType] != S.progs[kind].bp.rev).sort((first, second) => PROGRAMMES[first].unitCost - PROGRAMMES[second].unitCost);
  if (!kinds.length) return `no rocket you have can fly the ${MISSION_TYPES[missionType].name}: research or a new rocket is needed`;
  const cost = withProgramme(kinds[0], () => batchCost(1));
  if (!spend(cost)) return record.hold ? record.hold : 'the treasury is short';
  withProgramme(kinds[0], () => orderAirframes(1));
  record.spent += cost;
  return `a ${PROGRAMMES[kinds[0]].name} is ordered`;
}
// Can she spend this much? Sets the cap hold if the cap cannot cover it.
function spend(cost) {
  const record = ops();
  if (record.spent + cost > record.cap) {
    record.hold = `The cap cannot cover the next step (${formatMoney(cost)}).`;
    log(`[FLIGHT OPS] ${record.hold} Raise it or take the tests back.`, 'wn');
    return false;
  }
  return S.b - cost >= TREASURY_RESERVE;
}

// Every launch-director turn (rules/auto.js): the next step for the directive in hand, and, while that waits on something, the
// next flight of a crewed series you authorised. Returns true if anything happened.
export function opsTurn() {
  const record = ops();
  if (!record || record.hold || !S.p2) return false;
  if (record.ready) return record.ready.standing && !record.ready.gemini ? greenlight(false, true) : false;
  if (record.snooze > S.day) return idle('you said not yet');
  const acted = directiveTurn();
  if (record.ready || record.hold || !record.series || !record.wait) return acted;
  const directiveWait = record.wait, flew = seriesTurn();
  if (!record.ready && !flew) record.wait = directiveWait;
  return acted || flew;
}
function directiveTurn() {
  const record = ops(), directive = directiveInHand();
  if (!directive) return idle(openDirectives().length ? 'the Gemini directives are yours for now' : 'every directive is met');
  const crewed = isCrewedKey(directive);
  // MAN-RATING: a booster family needs its clean flights before a crew rides it.
  const ratedType = ratedTypeFor(directive);
  const needsRating = directive.key == 'rate' || directive.key == 'orate' || (crewed && !boosterFor(ratedType, true));
  if (needsRating) {
    const booster = boosterFor(ratedType, false);
    if (!booster) return idle(orderBooster(ratedType));
    if (!manRatingResearchDone(booster.airframe.prog)) return idle(`the ${PROGRAMMES[booster.airframe.prog].name} needs its man-rating research first`);
    if (leansSafe('ellis') && openIncident(booster.airframe.prog)) return idle(`an incident on the ${PROGRAMMES[booster.airframe.prog].name} is still open`);
    return offer({ kind: `rate:${booster.airframe.prog}`, what: `a man-rating flight of ${booster.airframe.label}`, rating: 1, af: booster.airframe.id, fuel: booster.fuel });
  }
  // THE MISSION: a capsule that lasts the orbits, a booster that delivers it, and who rides.
  const missionType = directive.missionType, orbits = directive.orbits || (MISSION_TYPES[missionType].orbital ? 1 : 0);
  const needs = requirementText(missionType);
  if (needs) return idle(needs.replace(/\.$/, ''));
  const lasts = capsule => !orbits || capsuleSystems(capsule.cfg, missionType).endurance >= orbits;
  const capsule = S.p2.veh.find(each => each.mt == missionType && lasts(each));
  if (!capsule) {
    if (S.aq.some(item => item.k == 'msn' && item.mt == missionType)) return idle(`the ${MISSION_TYPES[missionType].capsuleName} is being built`);
    if (!lasts({ cfg: { pk: Object.keys(S.g.pk), rev: S.g.bp.rev } })) return idle(`the spacecraft cannot yet last ${orbits} orbits: it needs research`);
    if (!spend(MISSION_TYPES[missionType].cost)) return idle(record.hold || 'the treasury is short');
    const before = S.b;
    orderCapsule(missionType);
    record.spent += before - S.b;
    return true;
  }
  const crew = directive.key == 'lj' ? (!S.p2.lj.mk && !crewLock('monkey') ? 'monkey' : 'none')
    : directive.key == 'animal' || directive.key == 'oanimal' ? 'chimp'
    : crewed ? pilotFor(missionType) : 'none';
  const booster = boosterFor(missionType, crewed);
  if (!booster) return idle(orderBooster(missionType));
  if (leansSafe('ellis') && openIncident(booster.airframe.prog)) return idle(`an incident on the ${PROGRAMMES[booster.airframe.prog].name} is still open`);
  if (!crew) return idle('no qualified astronaut is free to fly it');
  const lock = crewLock(crew, booster.airframe, missionType);
  if (lock) return idle(lock.replace(/\.$/, ''));
  const who = crew == 'none' ? 'no one aboard' : crew == 'monkey' ? 'a rhesus monkey aboard' : crew == 'chimp' ? 'a chimpanzee aboard' : `${S.p2.astros.find(each => each.id == crew).name} aboard`;
  return offer({ kind: directive.key, what: `${MISSION_TYPES[missionType].fullName}, ${who}, on ${booster.airframe.label}`, crewed: crewed ? 1 : 0, gemini: directive.project == 'gemini' ? 1 : 0, af: booster.airframe.id, fuel: booster.fuel, vid: capsule.id, crew, orbits, mt: missionType });
}
// The assigned pilot for the mission type, or the best qualified astronaut she assigns. null if no one can.
function pilotFor(missionType) {
  const assigned = assignedPilot(missionType);
  if (assigned) return assigned.id;
  const best = S.p2.astros.filter(astronaut => isQualified(astronaut) && !astronaut.asg).sort((first, second) => second.t.pil + second.t.sys - first.t.pil - first.t.sys)[0];
  if (!best) return null;
  assignPilot(best.id, missionType);
  log(`[FLIGHT OPS] Ellis assigns ${best.name} to the ${MISSION_TYPES[missionType].fullName}.`, 'cyan');
  return best.id;
}
function idle(why) {
  const record = ops(), changed = record.wait != why;
  record.wait = why;
  return changed;
}
// A launch is ready. It flies if you approved it already (a series you authorised, or GREENLIGHT THE NEXT n of its kind), or on
// standing approval for an uncrewed kind you have greenlit STANDING_AFTER times; otherwise it waits for your greenlight.
function offer(launch) {
  const record = ops(), pre = record.pre || (record.pre = {});
  record.wait = null;
  if (launch.gemini) {
    launch.standing = 0;
  } else if (!launch.series && pre[launch.kind] > 0) {
    pre[launch.kind]--;
    launch.standing = 1;
  } else launch.standing = launch.series || (!launch.crewed && (record.gl[launch.kind] || 0) >= STANDING_AFTER) ? 1 : 0;
  record.ready = launch;
  if (launch.standing) return greenlight(false, true);
  log(`[FLIGHT OPS] ${launch.what[0].toUpperCase() + launch.what.slice(1)} is ready. It waits for your greenlight in Mail.`, 'hd');
  return true;
}

// YOUR ANSWER. attend: set the launch up in Watch for you to count down. standing: she flies it on an approval you already gave.
// next: GREENLIGHT THE NEXT n: this one and the next n - 1 of its kind are approved.
export function greenlight(attend = false, standing = false, next = 1) {
  const record = ops(), launch = record && record.ready;
  if (!launch) return false;
  if (!standing) record.gl[launch.kind] = (record.gl[launch.kind] || 0) + 1;
  if (next > 1) (record.pre || (record.pre = {}))[launch.kind] = ((record.pre || {})[launch.kind] || 0) + next - 1;
  record.ready = null;
  const airframe = S.air.find(each => each.id == launch.af && each.st == 'r');
  const capsule = launch.vid && S.p2.veh.find(each => each.id == launch.vid);
  if (!airframe || (launch.vid && !capsule)) return true;
  if (attend && !launch.rating) {
    Object.assign(S.p2, { lv: launch.vid, lb: launch.af, lf: launch.fuel, lc: launch.crew, lo: launch.orbits || S.p2.lo });
    log(`[FLIGHT OPS] ${launch.what[0].toUpperCase() + launch.what.slice(1)} is on the pad. Start the count in Watch.`, 'cyan');
    return true;
  }
  if (standing) log(`[FLIGHT OPS] ${launch.series ? 'Your crewed series' : 'On your approval'}: ${launch.what}.`, 'cyan');
  return launch.rating ? flyRating(airframe, launch.fuel) : flyMission(launch, airframe);
}
export function notYet() {
  const record = ops();
  if (!record || !record.ready) return;
  record.ready = null;
  record.snooze = Math.round(S.day + SNOOZE_DAYS);
  log(`[FLIGHT OPS] Holding the launch. Ellis will ask again in about a month.`, 'cyan');
}

// A MAN-RATING FLIGHT: the booster flies with ballast, inside her team's margin.
function flyRating(airframe, fuel) {
  const record = ops();
  return withProgramme(airframe.prog, () => {
    const plan = [1, 0].map(st => planLoad(airframe, { fuel, pay: BALLAST, st }, ellisMargin())).find(each => !each.reason);
    if (!plan) {
      airframe.aside = 'no safe ballast flight could be planned';
      return idle(`${airframe.label} cannot be planned safely inside her margin`);
    }
    const quote = quoteLaunch(airframe, fuel, BALLAST, plan.stage, plan.load);
    if (quote.error) return idle(quote.error.replace(/\.$/, ''));
    if (!spend(quote.cost)) return idle(record.hold || 'the treasury is short');
    const { poll, cost } = directorPoll(airframe, fuel, plan.stage);
    record.spent += cost;
    if (poll.nogo) return true;
    const flight = beginFlight(airframe, fuel, BALLAST, plan.stage, plan.load, { latent: poll.fault, wind: poll.wind });
    if (!flight) return false;
    flight.byDirector = true;
    record.spent += quote.cost;
    record.n++;
    if (flyToEnd(flight) != 'fail') record.okn++;
    return true;
  });
}

// A MERCURY MISSION flown by Flight Control: the poll, the flight, and the decisions in flight taken in the house style.
function flyMission(launch, airframe) {
  const record = ops(), plan = boosterPlan(airframe, launch.fuel, launch.mt);
  const quote = quoteLaunch(airframe, launch.fuel, MISSION_TYPES[launch.mt].payload || 'Mercury Capsule', plan.staged, plan.load);
  if (quote.error) return idle(quote.error.replace(/\.$/, ''));
  if (!spend(quote.cost)) return idle(record.hold || 'the treasury is short');
  const { poll, cost } = directorPoll(airframe, launch.fuel, plan.staged);
  record.spent += cost;
  if (poll.nogo) return true;
  const before = S.b;
  const mission = beginMission(launch.vid, launch.crew, { af: airframe.id, fuel: launch.fuel, latent: poll.fault, wind: poll.wind, orbits: launch.orbits });
  if (!mission) {
    record.hold = `Flight Control could not launch ${launch.what}: past the safety bar, or no longer ready. Fly it yourself from Watch.`;
    log(`[FLIGHT OPS] ${record.hold}`, 'wn');
    return true;
  }
  record.spent += before - S.b;
  let result;
  do {
    result = stepMission(mission, missionStepSeconds(mission));
    if (result == 'decide') decide(mission);
  } while (result != 'end');
  const outcome = endMission(mission);
  record.n++;
  if (outcome.ok) record.okn++;
  if (launch.series && record.series) {
    record.series.n--;
    if (outcome.lost) log('[FLIGHT OPS] The crew is lost. Ellis stops the crewed series: any more flights are yours to authorise.', 'bad');
    else if (record.series.n > 0) log(`[FLIGHT OPS] ${record.series.n} flight${record.series.n == 1 ? '' : 's'} left in the crewed series.`, 'cyan');
    else log('[FLIGHT OPS] The crewed series is complete.', 'ok');
    if (outcome.lost || record.series.n <= 0) record.series = null;
  }
  // The crews' confidence: a lost crew or spacecraft knocks it back twice as hard as a failed flight.
  recordConfidence(outcome.ok, outcome.lost ? 'fail' : outcome.ok ? 'ok' : 'abort', true);
  if (outcome.lost) recordConfidence(false, 'fail', true);
  return true;
}
// A DECISION IN FLIGHT, in the house style: a team with the appetite pushes on for what the directive still needs; otherwise
// Flight Control takes the option most likely to bring the spacecraft home.
export function decide(mission) {
  const key = mission.pending.key, directive = MERCURY_DIRECTIVES[S.p2.dir];
  let options = decisionOptions(mission, key).filter(option => option.available);
  const stillNeeded = directive && ((key == 'fuel' || key == 'cells') && mission.orbitsFlown < (directive.orbits || 0) || key == 'eva' && directive.eva || key == 'rdv' && (directive.rendezvous || directive.dock));
  if (stillNeeded && riskAppetite('ellis') >= .4 && options.some(option => !option.soft)) options = options.filter(option => !option.soft);
  const best = options.sort((first, second) => decisionOdds(mission, key, second) - decisionOdds(mission, key, first))[0];
  chooseOption(mission, best.index);
}
export const opsDirectiveName = () => {
  const directive = directiveInHand();
  return directive ? directive.name : null;
};

// A CREWED SERIES: you authorise n crewed flights of a capsule type (suborbital 'mr', or orbital 'mo' for SERIES_ORBITS orbits) to
// give the corps flight time, for example while an upgraded capsule is in development. Authorising it is the greenlight for every
// flight in it. Ellis flies them while the directive in hand waits on something, each pilot followed by the backup she keeps
// assigned, so the experience spreads. A lost crew ends the series.
export const SERIES_SIZES = [1, 3, 5];
export const SERIES_ORBITS = 3;
// A series flies only kinds of crewed flight that have flown before: the suborbital once an American has flown in space, the
// orbital once one has orbited.
export const seriesLock = missionType => !ops() ? 'Give Ellis the Mercury tests first.'
  : !directiveDone(missionType == 'mo' ? 'ocrew' : 'crew') ? `A crewed series follows the first crewed ${missionType == 'mo' ? 'orbital' : 'suborbital'} flight.`
  : requirementText(missionType);
export function startSeries(missionType, n) {
  const lock = seriesLock(missionType);
  if (lock || !(n > 0)) return lock || 'Choose how many flights.';
  ops().series = { mt: missionType, n };
  log(`[FLIGHT OPS] You authorise ${n} crewed ${MISSION_TYPES[missionType].fullName} flight${n == 1 ? '' : 's'}. Ellis flies them between directive steps.`, 'cyan');
  return null;
}
export function endSeries() {
  if (ops() && ops().series) ops().series = null;
}
function seriesTurn() {
  const record = ops(), series = record.series, missionType = series.mt, orbits = MISSION_TYPES[missionType].orbital ? SERIES_ORBITS : 0;
  const lasts = capsule => !orbits || capsuleSystems(capsule.cfg, missionType).endurance >= orbits;
  const capsule = S.p2.veh.find(each => each.mt == missionType && lasts(each));
  if (!capsule) {
    if (S.aq.some(item => item.k == 'msn' && item.mt == missionType) || !lasts({ cfg: { pk: Object.keys(S.g.pk), rev: S.g.bp.rev } }) || requirementText(missionType)) return false;
    if (!spend(MISSION_TYPES[missionType].cost)) return false;
    const before = S.b;
    orderCapsule(missionType);
    record.spent += before - S.b;
    return true;
  }
  const booster = boosterFor(missionType, true);
  if (!booster) return false;
  const crew = pilotFor(missionType);
  keepBackup(missionType);
  if (!crew || crewLock(crew, booster.airframe, missionType)) return false;
  const name = S.p2.astros.find(each => each.id == crew).name;
  return offer({ kind: 'series:' + missionType, series: 1, what: `${MISSION_TYPES[missionType].fullName}, ${name} aboard, on ${booster.airframe.label}`, crewed: 1, af: booster.airframe.id, fuel: booster.fuel, vid: capsule.id, crew, orbits, mt: missionType });
}
// The series rotates pilots: she keeps a backup assigned, who moves up after each flight (rules/astronauts.js promoteBackup).
function keepBackup(missionType) {
  if (backupPilot(missionType)) return;
  const next = S.p2.astros.filter(astronaut => isQualified(astronaut) && !astronaut.asg && !astronaut.bk && !astronaut.nx).sort((first, second) => (first.flights || 0) - (second.flights || 0))[0];
  if (next) assignBackup(next.id, missionType);
}
