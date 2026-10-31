// THE CORPORAL CONTRACT: the Army's guided missile, developed alongside your sounding rockets by the same engineers, as JPL did
// with the WAC Corporal and the Corporal. Offered once you can hand routine flying to a launch director. It pays well, but each
// milestone takes one of your engineering teams until it is done, and the Army has dates. You can decline it. No DOM.
//
// S.corp: null until offered; then { st: 'offer'|'on'|'no'|'done', d: the day you accepted, m: milestones finished, paid ($), late: milestones late }
// The milestone in work is a job { k: 'corp', m: its index, free: 0 } in S.jobs, so it holds a team like any other job.
import { CORPORAL_MILESTONES, CORPORAL_LATE_SHARE, CORPORAL_REDSTONE_PAYMENT } from '../data/history.js';
import { S, log, earn, freeTeams, addHistory, formatDate } from '../core/state.js';
import { formatMoney } from '../core/util.js';
import { learn } from './knowledge.js';
import { directorUnlocked } from './campaign.js';

export const corporalJob = () => S.jobs.find(job => job.k == 'corp');
export const nextMilestone = () => S.corp && S.corp.st == 'on' ? CORPORAL_MILESTONES[S.corp.m] || null : null;
export const milestoneDue = index => S.corp.d + CORPORAL_MILESTONES[index].due;

// Each second: offer the contract once its time comes (before NASA), and start the next milestone when a team is free.
// Returns true if anything changed.
export function corporalTick() {
  if (!S.corp) {
    if (S.nasa || !directorUnlocked()) return false;
    S.corp = { st: 'offer', d: 0, m: 0, paid: 0, late: 0 };
    log('[ARMY ORDNANCE] The Army asks you to develop the Corporal guided missile alongside your sounding rockets (Mail).', 'hd');
    return true;
  }
  const milestone = nextMilestone();
  if (!milestone || corporalJob() || freeTeams() < 1) return false;
  S.jobs.push({ k: 'corp', m: S.corp.m, t: milestone.seconds, tot: milestone.seconds, free: 0 });
  log(`[CORPORAL] A team starts on the Army's next milestone: ${milestone.name.toLowerCase()} (due ${formatDate(milestoneDue(S.corp.m))}).`, 'cyan');
  return true;
}

// Answer the Army's offer.
export function answerCorporal(accept) {
  if (!S.corp || S.corp.st != 'offer') return;
  S.corp.st = accept ? 'on' : 'no';
  if (accept) {
    S.corp.d = Math.round(S.day);
    log(`[ARMY ORDNANCE] The Corporal contract is signed: ${CORPORAL_MILESTONES.length} milestones, ${formatMoney(CORPORAL_MILESTONES.reduce((sum, each) => sum + each.pay, 0))} if all are on time. Each takes one of your teams while it runs.`, 'ok');
  } else log('[ARMY ORDNANCE] The Army takes the Corporal to another laboratory.', 'wn');
}

// A milestone is done (rules/jobs.js finishJob): pay it, teach the rockets, and move on.
export function finishCorporalMilestone(job) {
  const milestone = CORPORAL_MILESTONES[job.m], late = S.day > milestoneDue(job.m), pay = Math.round(milestone.pay * (late ? CORPORAL_LATE_SHARE : 1));
  earn(pay);
  S.corp.paid += pay;
  S.corp.m = job.m + 1;
  if (late) S.corp.late++;
  for (const [area, points] of Object.entries(milestone.learn)) learn(area, points);
  log(`[CORPORAL] ${milestone.name}: done${late ? ', late' : ''}. The Army pays ${formatMoney(pay)}${late ? ` (half, for missing ${formatDate(milestoneDue(job.m))})` : ''}.`, late ? 'wn' : 'ok');
  if (S.corp.m >= CORPORAL_MILESTONES.length) {
    S.corp.st = 'done';
    addHistory('The Corporal missile delivered to the Army');
    log('[ARMY ORDNANCE] The Corporal goes to the Army. When it wants its next missile, it will come to you first.', 'hd');
  }
}

// The Army's payment when the Redstone programme starts, if you delivered the Corporal (rules/programs.js).
export function redstonePayment() {
  if (!S.corp || S.corp.st != 'done' || S.corp.rs) return;
  S.corp.rs = 1;
  earn(CORPORAL_REDSTONE_PAYMENT);
  log(`[ARMY ORDNANCE] You delivered the Corporal, so the Army backs the Redstone with a development payment of ${formatMoney(CORPORAL_REDSTONE_PAYMENT)}.`, 'ok');
}
