// THE GAME CLOCK: the once-per-second tick, the calendar, staff, the starting position and the run-log snapshots. No DOM.
// Each player action logs what happened and returns nothing.
import { formatMoney } from '../core/util.js';
import { AREAS } from '../data/research.js';
import { DAYS_PER_SECOND, DAYS_PER_SECOND_PHASE_TWO } from '../data/history.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, earn } from '../core/state.js';
import { grant, defenseSupplement, payroll, programmeProgress } from './economy.js';
import { budgetTick, payAppropriation } from './budget.js';
import { sovietEventsTick, SPACE_ACT_DAY } from './race.js';
import { roomLevel } from './launch-site.js';
import { constructionTick, upkeep } from './site.js';
import { createProgramme, isMature, ensureStages } from './programs.js';
import { hasFirstMilestone, giveEarmark } from './research.js';
import { startQueuedWork } from './queue.js';
import { makeAirframe } from './production.js';
import { buildTeams, MAX_BUILD_TEAMS, buildTeamCost, factoryTick, autoPublishDue, publishBlueprint } from './factory.js';
import { finishJob } from './jobs.js';
import { ensurePhaseTwo, officeTick } from './astronaut-office.js';
import { trainingTick } from './astronauts.js';
import { directorUnlocked } from './campaign.js';
import { remitTick, remitEarnedTick } from './remit.js';
import { chenJoinTick, lanesTick } from './lanes.js';
import { reedJoinTick, worksTick, reedPublishes } from './factory-lead.js';
import { demandTick } from './orders.js';
import { sharedTick } from './shared-research.js';
import { apolloTick } from './apollo.js';
import { safetyTick } from './safety.js';
import { pressureTick } from './pressure.js';
import { requestsTick } from './requests.js';
import { hearingTick, leadAway } from './hearing.js';

// CALENDAR CATCH-UP: progress maps to the date history reached it (orbit by early 1958, the first American in space in May 1961).
// When you are well ahead of that date the calendar runs faster, easing off as it catches up; behind it, nothing changes.
export const historyTarget = () => {
  const progress = Math.min(1, programmeProgress());
  return S.nasa ? 4590 + progress * (5525 - 4590) : 4400 * progress;
};
// A margin of six months lets a strong programme beat history to its firsts before the calendar leans in.
// With a satellite up and NASA not yet formed, the calendar runs up to ten times faster until the Space Act.
export const catchUp = () => {
  if (!S.nasa && S.fs.f_orbit) {
    const daysToAct = SPACE_ACT_DAY - S.day;
    return daysToAct <= 0 ? 1 : Math.min(10, 1 + daysToAct / 20);
  }
  const gap = historyTarget() - S.day - 180;
  return gap <= 0 ? 1 : Math.min(S.nasa ? 4 : 5, 1 + gap / (S.nasa ? 200 : 220));
};
export const daysPerSecond = () => (S.nasa ? DAYS_PER_SECOND_PHASE_TWO : DAYS_PER_SECOND) * catchUp();

// ONE SECOND OF PLAY, in this order: the calendar, construction, Soviet events, the appropriation and payroll every funding cycle,
// the Astronaut Office, the Apollo study, safety bar and pressure, the factory, engineering jobs, Ellis's remit, Chen's research lanes and the shared lanes, Reed's factory, customer demand for
// standing orders, auto-publishing and programme maturity. Returns true if the page needs redrawing.
export function tickSecond() {
  let changed = false;
  if (S.dev) {
    S.dev.ps++;
    if (S.dev.ps % 30 == 0) snapshot();
  }
  ensureStages();
  const days = daysPerSecond();
  S.day += days;
  if (constructionTick()) changed = true;
  if (sovietEventsTick()) changed = true;
  // A funding cycle is 30 seconds at the normal calendar; catching up with history brings paydays sooner, so a year pays the same.
  S.gt -= catchUp();
  if (S.gt <= 0) {
    S.gt += 30;
    payDay();
    changed = true;
  }
  if (S.nasa) {
    ensurePhaseTwo();
    if (budgetTick(days)) changed = true;
    trainingTick(days);
    if (officeTick(days)) changed = true;
    if (apolloTick(days)) changed = true;
    if (safetyTick(days)) changed = true;
    if (pressureTick(days)) changed = true;
    if (requestsTick(days)) changed = true;
    if (hearingTick()) changed = true;
  }
  if (factoryTick()) changed = true;
  for (const job of S.jobs.slice()) if (--job.t <= 0) {
    S.jobs.splice(S.jobs.indexOf(job), 1);
    finishJob(job);
    changed = true;
  }
  if (startQueuedWork()) changed = true;
  if (remitEarnedTick()) changed = true;
  // A lead preparing for a hearing (rules/hearing.js) leaves their own work until it sits.
  if (!leadAway('ellis') && remitTick()) changed = true;
  if (chenJoinTick()) changed = true;
  if (!leadAway('chen') && lanesTick()) changed = true;
  if (sharedTick()) changed = true;
  if (reedJoinTick()) changed = true;
  if (!leadAway('reed') && worksTick()) changed = true;
  if (!leadAway('ellis') && demandTick()) changed = true;
  if (!reedPublishes() && autoPublishDue()) {
    publishBlueprint(true);
    changed = true;
  }
  if (matureTick()) changed = true;
  return changed;
}
// The appropriation arrives (NASA's from its yearly budget), salaries go out, and the press office rebuilds a little reputation.
function payDay() {
  if (S.fy) log(`[FISCAL] FY${S.fy.yr} appropriation paid: +${formatMoney(payAppropriation())}`, 'ok');
  else {
    const amount = grant();
    S.b += amount;
    const supplement = defenseSupplement();
    log(`[FISCAL] Appropriation deposited: +${formatMoney(amount)}${supplement ? ` (includes a ${formatMoney(supplement)} Defense Department supplement: the Soviets are judged to be ahead)` : ''}`, 'ok');
  }
  const salaries = payroll();
  if (salaries) {
    S.b = Math.max(0, S.b - salaries);
    log(`[PAYROLL] Salaries paid: -${formatMoney(salaries)}`, 'wn');
  }
  const running = upkeep();
  if (running) {
    S.b = Math.max(0, S.b - running);
    log(`[BASE] Site upkeep: -${formatMoney(running)}`, 'wn');
  }
  if (S.staff.pr) S.rep = Math.min(100, S.rep + .5);
}

// A programme that reaches maturity opens the next rung of the ladder, and some bring a contract with them.
const CONTRACT_NEWS = {
  redstone: name => `The Army buys the ${name} as a production missile`,
  viking: () => 'The Navy buys Viking flights for upper-atmosphere research',
};
const OTHER_CONTRACT_NEWS = name => `The Defense Department buys ${name} flights to calibrate its radars and missiles`;
function matureTick() {
  let changed = false;
  for (const kind in S.progs) {
    const bundle = S.progs[kind];
    if (bundle.matured || !isMature(kind)) continue;
    bundle.matured = 1;
    changed = true;
    const programme = PROGRAMMES[kind];
    log(`[PROGRAMME] ${programme.name} is mature: the team understands this rocket well. New programmes can be proposed in the Design Bureau.`, 'hd');
    if (programme.contract) {
      earn(programme.contract);
      log(`[CONTRACT] ${(CONTRACT_NEWS[kind] || OTHER_CONTRACT_NEWS)(programme.name)}. Contract payment +${formatMoney(programme.contract)}.`, 'hd');
    }
  }
  return changed;
}

// STAFF: engineering teams (up to 6), build teams (up to 4) and two specialists. The launch director unlocks with the Aerobee (rules/campaign.js).
export const MAX_ENGINEERING_TEAMS = 6;
export const engineeringTeamCost = () => 12000 + 6000 * (S.teams - 2);
export const SPECIALISTS = {
  pr: { cost: 15000, news: 'Press office established. Failures now cost half the reputation, and reputation slowly recovers.' },
  director: { cost: 25000, news: 'Ruth Ellis appointed launch director. She leaves the PROP console; set a campaign on the Launch tab and she flies it for you.' },
};
// what: 'bteam', 'team', or a specialist's key.
export function hire(what) {
  if (what == 'bteam') {
    if (buildTeams() < MAX_BUILD_TEAMS && S.b >= buildTeamCost()) {
      S.b -= buildTeamCost();
      S.bteams = buildTeams() + 1;
      log(`[PERSONNEL] A new build team joins the factory (${S.bteams} teams): ${S.bteams} items in the queue are now worked at once.`, 'ok');
    }
    return;
  }
  if (what == 'team') {
    if (S.teams < MAX_ENGINEERING_TEAMS && S.b >= engineeringTeamCost()) {
      S.b -= engineeringTeamCost();
      S.teams++;
      log(`[PERSONNEL] A new engineering team joins (${S.teams} teams).`, 'ok');
    }
    return;
  }
  const specialist = SPECIALISTS[what];
  if (what == 'director' && !directorUnlocked()) return;
  if (specialist && !S.staff[what] && S.b >= specialist.cost) {
    S.b -= specialist.cost;
    S.staff[what] = 1;
    log('[PERSONNEL] ' + specialist.news, 'ok');
  }
}

// THE STARTING POSITION, also applied to loaded saves: the WAC Corporal programme, earmarks owed, and one free airframe.
export function ensureStarter() {
  if (!S.cur) {
    createProgramme('wac');
    S.cur = 'wac';
  }
  for (const area in AREAS) if (S.bt[area] && !hasFirstMilestone(area) && !(area in S.ear)) giveEarmark(area);
  if (!S.air.length && !S.prod && !S.aq.length && !S.sg) {
    S.sg = 1;
    S.air.push(makeAirframe({ pk: [], fix: {} }, 3000, 'wac'));
  }
}

// A progression snapshot for the run log every 30 seconds of play (the last 2,000 are kept).
function snapshot() {
  const runLog = S.dev, confirmed = Object.values(S.pk).filter(done => done.c).length;
  runLog.snap.push({
    t: runLog.ps, d: Math.round(S.day), b: Math.round(S.b), g: grant(), rep: Math.round(S.rep), dir: S.dir,
    hi: Math.round(S.hi || 0), hs: Math.round(S.hs || 0), hd: Math.round(S.hd || 0), ok: S.ok, fl: runLog.fl,
    pk: Object.keys(S.pk).length, cf: confirmed, ms: Object.keys(S.pk).filter(id => id.startsWith('ms_')).length, bp: S.bp.rev,
    air: S.air.length, teams: S.teams, crew: Object.values(S.crew).filter(Boolean).length, room: roomLevel(),
    you: +programmeProgress().toFixed(3), sov: +Math.min(1, S.day / S.rv.r_sat).toFixed(3),
  });
  if (runLog.snap.length > 2000) runLog.snap.shift();
}
