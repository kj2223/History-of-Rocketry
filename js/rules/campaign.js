// LAUNCH CAMPAIGNS: you set one rocket a target, a deadline and a budget; the launch director orders airframes and flies
// until the target is met, the deadline passes or the budget is spent (rules/auto.js flies them). Flights you fly yourself
// with the same rocket count towards the target too. No DOM.
//
// S.auto: { xp: flights the director has run, camp: the running campaign or null, cd: seconds to the director's next try,
//           last: the report of the last campaign }
// A campaign: { prog, fuel, pay, st: fly the booster stage, kind: 'alt' | 'ok', goal: km or successful flights,
//               end: deadline (game day), budget, spent, n: flights flown, okn: successful flights, best: highest measured peak (m),
//               hold: why the director is waiting for you, go: 1 once you tell the director to go ahead }
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, formatDate } from '../core/state.js';

// The targets you can set: reach an altitude (km, as measured), or prove the rocket with a number of successful flights.
export const CAMPAIGN_TARGETS = {
  alt: { name: 'Reach an altitude', goals: [25, 50, 100, 150, 200, 300], unit: 'km' },
  ok: { name: 'Prove the rocket', goals: [2, 3, 5, 8], unit: 'successful flights' },
};
export const targetText = (kind, goal) => kind == 'alt' ? `Reach ${goal} km` : `${goal} successful flights`;

// UNLOCK: the launch director can be hired once the Aerobee has flown successfully three times, the point where the
// sounding rockets become routine and your attention moves to developing the next rocket.
export const AEROBEE_FLIGHTS_TO_UNLOCK = 3;
export const directorUnlocked = () => !!S.staff.director || (S.progs.aerobee && S.progs.aerobee.okf || 0) >= AEROBEE_FLIGHTS_TO_UNLOCK;

// THE DIRECTOR'S EXPERIENCE grows with every flight it runs, reaching full skill after 10.
// A rookie keeps well inside the rocket's limits (60% of the aero load, heating and structural limits), asks you for
// guidance when it cannot, and slips on procedure in one countdown in five (a scrub). A veteran flies to 85% of the limits,
// the launch form's red line, and does not slip.
export const DIRECTOR_FULL_SKILL = 10;
export const directorExperience = () => (S.auto && S.auto.xp) || 0;
export const directorSkill = () => Math.min(1, directorExperience() / DIRECTOR_FULL_SKILL);
export const directorRank = () => directorExperience() < 3 ? 'Rookie' : directorExperience() < DIRECTOR_FULL_SKILL ? 'Seasoned' : 'Veteran';
export const VETERAN_MARGIN = .85;
export const directorMargin = () => .6 + (VETERAN_MARGIN - .6) * directorSkill();
export const slipChance = () => .2 * (1 - directorSkill());

// Start a campaign. form: { prog, fuel, pay, st, kind, goal, months, budget }. Returns an error text, or null if it started.
export function startCampaign(form) {
  if (!S.staff.director) return 'Hire a launch director first.';
  if (S.auto.camp) return 'A campaign is already running.';
  if (!S.progs[form.prog] || !S.progs[form.prog].ready) return 'That rocket is not ready to fly.';
  if (!CAMPAIGN_TARGETS[form.kind] || !(form.goal > 0) || !(form.budget > 0) || !(form.months > 0)) return 'Set a target, a deadline and a budget.';
  S.auto.camp = {
    prog: form.prog, fuel: form.fuel, pay: form.pay, st: form.st ? 1 : 0, kind: form.kind, goal: form.goal,
    end: Math.round(S.day + form.months * 30), budget: form.budget, spent: 0, n: 0, okn: 0, best: 0, hold: null, go: 0,
  };
  S.auto.cd = 1;
  log(`[LAUNCH DIRECTOR] Campaign opened: ${PROGRAMMES[form.prog].name}, ${targetText(form.kind, form.goal)} by ${formatDate(S.auto.camp.end)}, budget ${formatMoney(form.budget)}.`, 'cyan');
  return null;
}

export const campaignMet = camp => camp.kind == 'alt' ? camp.best >= camp.goal * 1000 : camp.okn >= camp.goal;

// End the running campaign and keep its report. outcome: 'met', 'deadline', 'budget' or 'ended' (you called it off).
const OUTCOME_TEXT = { met: 'Target met', deadline: 'Deadline passed', budget: 'Budget spent', ended: 'Called off' };
export function endCampaign(outcome) {
  const camp = S.auto.camp;
  if (!camp) return;
  S.auto.camp = null;
  S.auto.last = { ...camp, outcome, d: Math.round(S.day) };
  log(`[LAUNCH DIRECTOR] Campaign closed (${OUTCOME_TEXT[outcome]}): ${PROGRAMMES[camp.prog].name}, ${targetText(camp.kind, camp.goal)}. ${camp.n} flight${camp.n == 1 ? '' : 's'}, ${camp.okn} successful, best ${(camp.best / 1000).toFixed(1)} km, ${formatMoney(camp.spent)} of ${formatMoney(camp.budget)} spent.`, outcome == 'met' ? 'hd' : 'wn');
}
export const outcomeText = outcome => OUTCOME_TEXT[outcome];

// The deadline: checked by the director every turn, so a campaign on hold still closes on time. Returns true if it closed.
export function campaignExpired() {
  const camp = S.auto.camp;
  if (!camp || S.day <= camp.end) return false;
  endCampaign(campaignMet(camp) ? 'met' : 'deadline');
  return true;
}

// You answer the director's request for guidance: it flies the next one to the veteran's margin.
export function goAhead() {
  const camp = S.auto.camp;
  if (!camp || !camp.hold) return;
  camp.hold = null;
  camp.go = 1;
  S.auto.cd = 1;
}

// After every flight (rules/flight.js endFlight). peak: the peak as the range measured it. byDirector: the director flew it.
// The director gains experience from its own flights; any flight of the campaign's rocket counts towards the target,
// and a flight you fly yourself answers a request for guidance.
export function recordCampaignFlight(flight, ok, peak, byDirector) {
  if (flight.programme == 'aerobee' && ok && !S.staff.director && S.progs.aerobee.okf == AEROBEE_FLIGHTS_TO_UNLOCK)
    log('[PERSONNEL] The Aerobee is flying routinely. A launch director could now run its launches as campaigns while you develop the next rocket. Hire one in Personnel.', 'hd');
  if (byDirector) {
    const rank = directorRank();
    S.auto.xp = directorExperience() + 1;
    if (directorRank() != rank) log(`[LAUNCH DIRECTOR] ${directorExperience()} flights run. The director is now ${directorRank() == 'Veteran' ? 'a veteran: it flies close to the limits and no longer slips on procedure' : 'seasoned: steadier countdowns, and it flies closer to the limits'}.`, 'ok');
  }
  const camp = S.auto && S.auto.camp;
  if (!camp || flight.programme != camp.prog) return;
  camp.n++;
  camp.go = 0;
  camp.hold = null;
  if (ok) {
    camp.okn++;
    camp.best = Math.max(camp.best, peak);
  }
  if (campaignMet(camp)) endCampaign('met');
}
