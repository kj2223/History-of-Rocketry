// YOUR FIRST BUDGET LINE: the money for the Viking firings you run as test conductor, one line per fiscal year (July to
// June). Visible to you: it is your line. What each choice costs is known in advance; overspending is allowed, but it
// goes on your record, and bosses remember it when the next offer comes round.
import { fiscalQuarter } from '../core/calendar.js';

export const LINE = 30000; // dollars a fiscal year for your Viking firings
export const COSTS = {
  inspect: { you: 0, kowalski: 1500, delgado: 600 }, // crew overtime to inspect in your place
  long: 12000, // a full-duration firing: propellant, a chamber's run time, and the inspection after
  leak: 1000, // a leak check of the whole feed system
  rework: 9000, // the stand's rework: parts and a day of the crew
  slipDay: 6000, // a day of range time lost
};

// What a plan will cost before anything goes wrong.
export const planCost = plan =>
  COSTS.inspect[plan.inspector || 'you'] + (plan.burn === 'long' ? COSTS.long : 0) + (plan.leak ? COSTS.leak : 0);

// The budget for the fiscal year containing `day`, opening a new year's line if the year has turned.
export function lineFor(record, day) {
  const fy = fiscalQuarter(day).fy;
  record.budget = record.budget || {};
  if (!record.budget[fy]) record.budget[fy] = { line: LINE, spent: 0, items: [] };
  return { fy, ...record.budget[fy] };
}
// Spend on this year's line. Returns the year's line after the spend.
export function spend(record, day, amount, what) {
  const { fy } = lineFor(record, day);
  const b = record.budget[fy];
  const wasOver = b.spent > b.line;
  b.spent += amount;
  b.items.push({ what, amount });
  if (!wasOver && b.spent > b.line) record.overspent = (record.overspent || 0) + 1;
  return { fy, ...b };
}
export const dollars = n => `$${Math.round(n).toLocaleString('en-US')}`;
