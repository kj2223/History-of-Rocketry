// THE PROGRAMME'S CULTURE AND THE TEAM'S CONFIDENCE (GDD v3.3 §39-41, Aaron's direction of 31 Oct 2026).
//
// CULTURE is the style your team picks up from how you run things yourself. It sits on one line from a SAFETY culture (tests
// between flights, upgrades proven on the ground before they fly, scrubs on a no-go, the lowest-risk fix) to a CHAOTIC one
// (rockets fly as soon as an upgrade lands, with incidents still open, over a NO-GO, on the cheapest fix). It is never shown as a
// number: the team describes it in Mail. It moves slowly, so one rushed launch does not change who you are, but a year of them does.
//
// CONFIDENCE is the team's own: it grows with every good flight they fly under their own power (campaigns, standing orders) and
// is knocked back by a failure. A new team is cautious; a confident one takes more risks. Confidence can run ahead of how
// reliable the rockets really are, because good flights make the team bolder whether or not the hardware has improved.
//
// RISK APPETITE combines the two: the culture sets where the team starts and how far confidence can take it. A safety culture
// at full confidence is about as bold as a new chaotic team; a confident chaotic team pushes rockets to the limit.
//
// Only what you do yourself shapes the culture (the UI calls noteHabit and noteLaunch). The leads read it: Ellis flies to a margin
// set by her team's risk appetite and, by her team's lean, tests upgrades first or flies past open incidents; Reed holds or
// publishes unbalanced drafts (rules/auto.js, rules/orders.js, rules/factory-lead.js). A risk a lead takes that the culture
// allows but you would want to know about is logged as ACCEPTED (acceptRisk). Crewed flights never are. No randomness, no DOM.
//
// S.cult: { lean: -1 (safety) to +1 (chaotic), conf: 0 to 1, n: habits noted, tests: tests since your last launch,
//           ev: the latest habits [{ d: game day, k: kind, t: what happened }],
//           risk: the latest risks a lead accepted [{ d: game day, w: lead, t: what }] }
import { PROGRAMMES } from '../data/programmes.js';
import { BY_ID } from '../data/research.js';
import { S, log, isConfirmed, withProgramme } from '../core/state.js';

// THE HABITS and which way each pulls: negative towards safety, positive towards chaos.
export const HABITS = {
  test: { pull: -1, name: 'a ground test or design review' },          // a test-stand, qualification run or design review
  scrub: { pull: -1, name: 'a scrub or a stand-down' },               // standing down rather than flying
  wait: { pull: -1, name: 'an upgrade proven before it flew' },        // a launch whose new work was all confirmed first
  safefix: { pull: -1, name: 'the lowest-risk fix' },
  override: { pull: 1, name: 'a launch over a NO-GO or past a limit' },
  rush: { pull: 1, name: 'an upgrade flown untested' },                // a launch carrying work nobody had confirmed
  openfly: { pull: 1, name: 'a launch with an incident still open' },
  notest: { pull: 1, name: 'a launch with no test since the last one' },
  quickfix: { pull: 1, name: 'the cheapest fix' },
};
// How far each habit moves the culture: the lean follows a rolling average of about the last 1 / CULTURE_RATE habits.
export const CULTURE_RATE = .06;
// How many habits the team needs to see before they say anything about the culture.
export const HABITS_TO_SPEAK = 6;
const RECENT_HABITS = 12;
// CONFIDENCE: a good flight closes this share of the gap to full confidence; a failure takes this much off.
export const CONFIDENCE_GAIN = .08;
export const CONFIDENCE_LOSS = .25;
export const CONFIDENCE_ABORT_LOSS = .1;

const culture = () => S.cult || (S.cult = { lean: 0, conf: 0, n: 0, tests: 0, ev: [] });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const cultureLean = () => culture().lean;
export const teamConfidence = () => culture().conf;
// From 0 (as careful as a team gets) to 1 (pushing every rocket to the limit).
// lead: read that team's own lean (teamLean below) instead of the organisation's.
export function riskAppetite(lead = null) {
  const lean = lead ? teamLean(lead) : cultureLean(), start = .3 + .2 * lean, ceiling = .75 + .25 * lean;
  return start + (ceiling - start) * teamConfidence();
}

// One habit of yours. what: a short note of the occasion, for the team's letter.
export function noteHabit(kind, weight = 1, what = '') {
  const habit = HABITS[kind], record = culture();
  if (!habit) return;
  record.lean = clamp(record.lean + (habit.pull * weight - record.lean) * CULTURE_RATE * weight, -1, 1);
  record.n++;
  if (kind == 'test') record.tests++;
  record.ev.push({ d: Math.round(S.day), k: kind, t: what });
  if (record.ev.length > RECENT_HABITS) record.ev.shift();
}

// A launch you fly yourself, before it lifts off: what it shows about how you fly. override: over a NO-GO or past a limit.
export function noteLaunch(airframe, override = false) {
  const record = culture(), name = airframe.label || PROGRAMMES[airframe.prog].name;
  withProgramme(airframe.prog, () => {
    const untested = airframe.pk.filter(id => BY_ID[id] && !isConfirmed(id));
    if (untested.length) noteHabit('rush', 1, `${name} flew ${BY_ID[untested[0]].name} untested`);
    else if (airframe.pk.length) noteHabit('wait', .5, `${name} flew only proven work`);
    if (S.inc.some(incident => incident.st != 'done')) noteHabit('openfly', 1, `${name} flew with an incident open`);
  });
  if (override) noteHabit('override', 1, `${name} flew over a NO-GO`);
  if (!record.tests) noteHabit('notest', .5, `${name} flew with no test since the last launch`);
  record.tests = 0;
}

// A fix you chose: the lowest-risk one, the cheapest one, or neither (a middle choice says nothing).
export function noteFix(fixes, chosen) {
  const safest = fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier)[0];
  const cheapest = fixes.slice().sort((first, second) => first.cost - second.cost)[0];
  if (safest == cheapest) return;
  if (chosen == safest) noteHabit('safefix', 1, chosen.name);
  else if (chosen == cheapest) noteHabit('quickfix', 1, chosen.name);
}

// After every flight (rules/flight.js endFlight): a flight the team flew under its own power moves its confidence.
export function recordConfidence(ok, why, byDirector) {
  if (!byDirector) return;
  const record = culture();
  if (ok && why != 'abort') record.conf = clamp(record.conf + (1 - record.conf) * CONFIDENCE_GAIN, 0, 1);
  else record.conf = clamp(record.conf - (why == 'abort' ? CONFIDENCE_ABORT_LOSS : CONFIDENCE_LOSS), 0, 1);
}

// HOW THE TEAM DESCRIBES IT: words, never numbers.
export function cultureWords() {
  const lean = cultureLean();
  if (culture().n < HABITS_TO_SPEAK) return null;
  if (lean <= -.5) return { name: 'a safety culture', line: 'Nothing flies until it has been proven on the ground, and a NO-GO means we stand down. The team has learned that from you.' };
  if (lean <= -.15) return { name: 'a careful programme', line: 'We usually test before we fly and we rarely push past a NO-GO, though not every time.' };
  if (lean < .15) return { name: 'no settled habits yet', line: 'Sometimes we test everything first, sometimes we fly the day an upgrade lands. The team is not sure which you want.' };
  if (lean < .5) return { name: 'a quick programme', line: 'We fly upgrades soon after they land and test when there is time. It is fast, and it finds faults the hard way.' };
  return { name: 'a chaotic culture', line: 'Upgrades fly the day they land, open incidents do not stop a launch, and a NO-GO is something to argue with. The team has learned that from you.' };
}
export function confidenceWords() {
  const confidence = teamConfidence();
  return confidence < .2 ? 'The crews are still finding their feet: they keep well inside the limits.'
    : confidence < .5 ? 'The crews are growing confident with every good flight.'
    : confidence < .8 ? 'The crews are confident and starting to push the rockets harder.'
    : 'The crews are sure of themselves now. They will push a rocket to its limits.';
}
export const recentHabits = () => culture().ev.slice().reverse();

// EACH TEAM'S OWN CULTURE (Aaron, 31 Oct 2026): every lead's team is guided by the organisation's culture but leans its own way.
// A team short of money takes more risks and plays faults down, even inside a safety culture. Read from the budget each lead runs:
// once a line has spent most of its cap (or is held because it cannot pay for the next job), the team leans towards chaos.
export const TEAM_LINES = {
  ellis: () => [S.orders && S.orders.o, S.remit, S.auto && S.auto.camp && { cap: S.auto.camp.budget, spent: S.auto.camp.spent }],
  reed: () => [S.works],
  chen: () => [S.lanes],
};
// Spending past this share of a cap starts the pressure; a team with nothing left leans this far further towards chaos.
export const PRESSURE_FROM = .7;
export const UNDERFUNDED_LEAN = .4;
const moneyHeld = line => !!line.dry || typeof line.hold == 'string' && /cap|cannot cover/i.test(line.hold);
export function budgetPressure(lead) {
  const lines = (TEAM_LINES[lead] ? TEAM_LINES[lead]() : []).filter(line => line && line.cap > 0);
  return lines.reduce((most, line) => Math.max(most, moneyHeld(line) ? 1 : clamp((line.spent / line.cap - PRESSURE_FROM) / (1 - PRESSURE_FROM), 0, 1)), 0);
}
export const teamLean = lead => clamp(cultureLean() + UNDERFUNDED_LEAN * budgetPressure(lead), -1, 1);

// HOW A TEAM'S LEAN SHOWS: a team leaning past this either way acts on it.
export const LEAN_TO_ACT = .15;
export const leansSafe = lead => teamLean(lead) <= -LEAN_TO_ACT;
export const leansChaotic = lead => teamLean(lead) >= LEAN_TO_ACT;
// ELLIS'S MARGIN: how close to the rocket's limits (aero load, skin heating) her team will plan a flight. A careful new team keeps
// near 60%; a confident chaotic one flies to 95%, past the launch form's red line.
export const ellisMargin = () => .55 + .4 * riskAppetite('ellis');

// A risk a lead accepted under the culture: logged, and kept for Ellis's letter.
const RECENT_RISKS = 8;
export function acceptRisk(lead, tag, what) {
  const record = culture();
  record.risk = record.risk || [];
  record.risk.push({ d: Math.round(S.day), w: lead, t: what });
  if (record.risk.length > RECENT_RISKS) record.risk.shift();
  log(`[${tag}] Risk accepted: ${what}`, 'wn');
}
export const acceptedRisks = () => (culture().risk || []).slice().reverse();
