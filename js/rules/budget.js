// THE NASA BUDGET: from NASA's founding Congress sets a yearly appropriation in place of the Phase One grant. No DOM.
// The fiscal year runs July to June. The appropriation is paid out as the days pass. At the year's end Congress sets the next
// one from your request, reputation and the race; using all of this year's money earns more next year, leaving it unspent earns
// less, and cash above the carry-over limit goes back to the Treasury. A programme that goes quiet loses reputation.
//
// The budget (saved in S.fy):
//   yr    the year the fiscal year ends in (FY1960 runs July 1959 to June 1960)
//   bud   this year's appropriation, $ a year       st    day the year (or NASA's first, part year) began
//   b0    cash at the start of the year             paid  appropriation paid this year      inc   other income this year
//   pd    day the appropriation was last paid       rq    the request, as a share of the automatic one (REQUEST_RANGE)
//   lm    day of the last Mercury flight (or NASA's founding)    q    1 while the programme is in a quiet spell
//   last  last year's result for the budget card: { yr, bud, spent, share, lapsed }
import { S, log, formatDate } from '../core/state.js';
import { formatMoney } from '../core/util.js';
import { DAYS_PER_SECOND_PHASE_TWO } from '../data/history.js';
import { payroll, phaseOneGrant, sovietGap } from './economy.js';
import { upkeep } from './site.js';

// Tune here.
export const REQUEST_RANGE = [1, 1.5];         // how far the player may scale the automatic request up
const BASE_SHARE = .55, REPUTATION_SHARE = .35;  // Congress grants a share of the request: a base, plus up to .35 at full reputation,
const RACE_SHARE = .3, OVERSPENT_SHARE = .1;     // plus up to .3 while the Soviets are judged ahead, plus .1 after a year that overspent
const SHARE_RANGE = [.5, 1.1];                 // Congress trims a padded request: the share falls with the square root of the padding
const BUDGET_STEP = [.75, 1.35];               // next year's budget stays within this range of this year's
const UNDERSPENT = .85;                        // below this share of the budget used, the request starts from what was spent
const OVERSPENT_REQUEST = 1.1;                 // after overspending, the automatic request asks for this much more than was spent
export const CARRY_OVER = .2;                  // cash kept into the new year, as a share of the year's budget
export const QUIET_DAYS = 240;                 // days without a Mercury flight before reputation slips
const QUIET_LOSS_PER_MONTH = 1;

// Fiscal years: July 1 of each 360-day year (days count from 1 Jan 1946).
const fiscalYearOf = day => 1946 + Math.floor(day / 360) + (day % 360 >= 180 ? 1 : 0);
const fiscalYearEnd = year => (year - 1946) * 360 + 180;
// 30-second funding cycles in a game year at the Phase Two calendar.
export const CYCLES_PER_YEAR = 360 / (30 * DAYS_PER_SECOND_PHASE_TWO);

// NASA's first budget carries on the Phase One grant rate for the rest of the fiscal year. Also starts the budget on older saves.
export function openBudget() {
  const budget = thousands(phaseOneGrant() * CYCLES_PER_YEAR);
  S.fy = { yr: fiscalYearOf(S.day), bud: budget, st: S.day, b0: S.b, paid: 0, inc: 0, pd: S.day, rq: 1, lm: S.day, q: 0, last: null };
  log(`[CONGRESS] NASA's first appropriation: ${formatMoney(budget)} a year, paid as the year goes. FY${S.fy.yr} ends ${formatDate(fiscalYearEnd(S.fy.yr))}.`, 'hd');
}

// One 30-second funding cycle's instalment at the current rate (shown in the header).
export const instalment = () => Math.round(S.fy.bud / CYCLES_PER_YEAR);
// Pay the appropriation for the days since the last payment. Returns the amount.
export function payAppropriation() {
  const amount = Math.round(S.fy.bud * Math.max(0, S.day - S.fy.pd) / 360);
  S.fy.pd = S.day;
  S.fy.paid += amount;
  S.b += amount;
  return amount;
}

// So far this year: what was spent, and the share of the budget (for the days gone) that it used.
export const spentThisYear = () => Math.max(0, S.fy.b0 + S.fy.paid + S.fy.inc - S.b);
export const budgetUsed = () => spentThisYear() / Math.max(1, S.fy.bud * Math.max(1, S.day - S.fy.st) / 360);
// Payroll and site upkeep for a year at today's staffing and buildings.
export const operationsPerYear = () => Math.round((payroll() + upkeep()) * CYCLES_PER_YEAR);
// The automatic request: today's budget, or what was spent (yearly rate) after a year that left money unused, or more after one
// that ran over; never less than payroll and upkeep. Too early in the year to tell, it is today's budget.
export const EARLY_DAYS = 60;
export function automaticRequest() {
  if (S.day - S.fy.st < EARLY_DAYS) return S.fy.bud;
  const used = budgetUsed(), spentPerYear = used * S.fy.bud;
  const request = used < UNDERSPENT ? spentPerYear : used > 1 ? spentPerYear * OVERSPENT_REQUEST : S.fy.bud;
  return Math.round(Math.max(operationsPerYear(), request));
}
export const request = () => Math.round(automaticRequest() * S.fy.rq);
export function setRequest(scale) {
  S.fy.rq = Math.max(REQUEST_RANGE[0], Math.min(REQUEST_RANGE[1], scale));
}
// The share of the request Congress grants.
const racePressure = () => Math.min(RACE_SHARE, Math.max(0, sovietGap() - .05));
export const congressShare = () => Math.max(SHARE_RANGE[0], Math.min(SHARE_RANGE[1],
  BASE_SHARE + REPUTATION_SHARE * S.rep / 100 + racePressure() + (budgetUsed() > 1 ? OVERSPENT_SHARE : 0) + ((S.p2 && S.p2.gmul) || 1) - 1)) / Math.sqrt(S.fy.rq);
// Next year's budget if the year ended today.
const thousands = (dollars, round = Math.round) => round(dollars / 1000) * 1000;
export const nextBudget = () => Math.max(thousands(BUDGET_STEP[0] * S.fy.bud, Math.ceil), Math.min(thousands(BUDGET_STEP[1] * S.fy.bud, Math.floor), thousands(request() * congressShare())));

// Every second after NASA: open the budget, close the year when it ends, and let reputation slip in a quiet spell.
// Returns true if the page needs redrawing.
export function budgetTick(days) {
  if (!S.fy) {
    openBudget();
    return true;
  }
  let changed = false;
  if (S.day >= fiscalYearEnd(S.fy.yr)) {
    closeYear();
    changed = true;
  }
  const quiet = S.day - S.fy.lm > QUIET_DAYS;
  if (quiet) S.rep = Math.max(0, S.rep - QUIET_LOSS_PER_MONTH * days / 30);
  if (quiet && !S.fy.q) log(`[CONGRESS] No Mercury flight since ${formatDate(S.fy.lm)}. Congress asks what NASA is doing with the money; reputation will slip until the next flight.`, 'wn');
  if (quiet != !!S.fy.q) changed = true;
  S.fy.q = quiet ? 1 : 0;
  return changed;
}
// A Mercury flight, whatever its outcome, ends a quiet spell.
export function recordMercuryFlight() {
  if (S.fy) S.fy.lm = S.day;
}

function closeYear() {
  payAppropriation();
  const year = S.fy.yr, budget = S.fy.bud, spent = spentThisYear(), share = congressShare(), next = nextBudget(), used = budgetUsed();
  log(`[CONGRESS] FY${year} closes: ${formatMoney(spent)} spent of a ${formatMoney(Math.round(budget * (S.day - S.fy.st) / 360))} budget (${Math.round(used * 100)}%). Congress grants ${Math.round(share * 100)}% of the ${formatMoney(request())} requested: FY${year + 1} budget ${formatMoney(next)}.`, next >= budget ? 'ok' : 'wn');
  const keep = Math.round(CARRY_OVER * budget), lapsed = Math.max(0, Math.round(S.b - keep));
  if (lapsed) {
    S.b = keep;
    log(`[TREASURY] ${formatMoney(lapsed)} unspent at the year's end goes back to the Treasury. ${formatMoney(keep)} carries over.`, 'wn');
  }
  S.fy = { ...S.fy, yr: year + 1, bud: next, st: S.day, b0: S.b, paid: 0, inc: 0, pd: S.day, last: { yr: year, bud: budget, spent, share, lapsed } };
}
