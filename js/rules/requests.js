// LEAD REQUESTS AND SHIELDING THE CREW (Apollo step 5): the pressure on Apollo (rules/pressure.js) reaches the teams. Once it runs
// high, Ellis's team brings you requests: loosen a component's limit, or waive the ground tests still owed on a revision
// (rules/safety.js). You can accept (the pressure eases and the risk goes on the record), refuse with the evidence on file (cheap,
// offered only when the tests support you), refuse with no reason (dearer), or tell them to prove it with a test first (the test
// runs and the request comes back with its result). Costs are small and each says why (GDD review fix 3). You can also take the
// heat off yourself: a press briefing, standing the crews down for a month, or testifying before Congress (rules/hearing.js). No DOM.
//
// S.p2.rq: the open request or null: { k: 'limit' or 'skip', prog, comp: component key (limit), to: the limit asked for (limit),
//          d: day asked, prove: the design key a test is running on before you answer, pv: 1 once that test has come back }
// S.p2.rqd: day the last request was asked.  S.p2.acc: risks you accepted [{ d, t }] (a hearing reads them).
// S.p2.pr.sh: { [shield]: day it can be used again }, vouch: a briefing vouched for flights until this day, sd: crews stood down until.
import { PROGRAMMES } from '../data/programmes.js';
import { PRESSURES, REQUEST_FROM, REQUEST_GAP, REQUEST_CHANCE, ANSWERS, SHIELDS, VOUCH_DAYS, VOUCH_REPUTATION, STAND_DOWN_DAYS } from '../data/pressure.js';
import { LIMIT_RANGE, LIMIT_STEP } from '../data/safety.js';
import { S, log, formatDate } from '../core/state.js';
import { pressure } from './pressure.js';
import { safetyBar, crewRockets, estimates, limitFor, componentName, designKey, testsPending, queueTest } from './safety.js';
import { noteHabit, teamLean } from './culture.js';
import { openHearing, hearingOpen } from './hearing.js';

export function openRequest() {
  const request = S.p2 && S.p2.rq;
  const key = request && (request.cfg || request.prove);
  if (key && key != designKey(request.prog)) {
    S.p2.rq = null;
    if (safetyBar()?.pri == request.prog) safetyBar().pri = null;
    S.p2.rqd = S.day - REQUEST_GAP;
    log(`[NASA] The request for ${key} is superseded by ${designKey(request.prog)}. The team will reassess the new revision; old test results remain with the design tested.`, 'cyan');
    return null;
  }
  return request || null;
}
const strongest = () => Math.max(...Object.keys(PRESSURES).map(key => pressure()[key]));
const shift = change => {
  for (const key of Object.keys(PRESSURES)) pressure()[key] = Math.max(0, Math.min(100, pressure()[key] + (change[key] || 0)));
};
const percent = chance => `${(chance * 100).toFixed(1)}%`;

// What the team would ask for now, or null: the limit of a component whose reading breaks it (raised just past the reading), or
// else waiving the tests still owed on a revision.
function candidateRequest() {
  for (const kind of crewRockets()) {
    const { figures } = estimates(kind);
    const over = Object.entries(figures).find(([key, risk]) => risk > limitFor(key) && risk < LIMIT_RANGE[1]);
    if (over) return { k: 'limit', prog: kind, comp: over[0], to: Math.min(LIMIT_RANGE[1], Math.ceil(over[1] / LIMIT_STEP) * LIMIT_STEP) };
  }
  const kind = crewRockets().find(testsPending);
  return kind ? { k: 'skip', prog: kind } : null;
}
// The request in words.
export function requestText(request) {
  const name = PROGRAMMES[request.prog].name;
  return request.k == 'limit'
    ? `Raise the limit on the ${componentName(request.comp).toLowerCase()} from ${percent(limitFor(request.comp))} to ${percent(request.to)}, so the crews can fly.`
    : `Waive the ground tests still owed on the ${name}'s current revision, so the crews can fly sooner.`;
}
// Can you refuse with the evidence on file? For a limit, when the tests put the component above what they ask for; for waiving
// tests, when the revision has had none yet.
export function reasonOnFile(request) {
  if (request.k == 'limit') return estimates(request.prog).evidence[request.comp] > request.to;
  return estimates(request.prog).tests == 0;
}

// Each second, with the days that passed: the team may ask. Returns true if a request arrived.
export function requestsTick(days) {
  if (!pressure() || !safetyBar() || openRequest() || strongest() < REQUEST_FROM) return false;
  if (S.day - (S.p2.rqd || 0) < REQUEST_GAP) return false;
  const chance = REQUEST_CHANCE * strongest() / 100 * (1 + teamLean('ellis')) * days / 30;
  if (Math.random() >= chance) return false;
  const request = candidateRequest();
  if (!request) return false;
  S.p2.rq = { ...request, cfg: designKey(request.prog), d: Math.round(S.day) };
  S.p2.rqd = Math.round(S.day);
  log(`[NASA] Ellis's team, feeling the pressure, asks: ${requestText(S.p2.rq)} (Mail)`, 'wn');
  return true;
}

// YOUR ANSWER: 'accept', 'reasoned', 'refuse' or 'prove'. Returns an error text, or null.
export function answerRequest(answer) {
  const request = openRequest(), bar = safetyBar();
  if (!request) return 'No request is open.';
  if (answer == 'cancelproof' && request.prove) {
    delete request.prove;
    if (bar.pri == request.prog) bar.pri = null;
    return answerRequest('refuse');
  }
  if (request.prove) return 'The test is still running.';
  if (answer == 'prove') {
    queueTest(request.prog);
    request.prove = request.cfg = designKey(request.prog);
    log(`[NASA] Prove it first: a ground test of the ${PROGRAMMES[request.prog].name} goes to the head of the queue. The request waits for its result.`, 'cyan');
    return null;
  }
  if (answer == 'reasoned' && !reasonOnFile(request)) return 'The tests do not support a refusal on the record.';
  const effect = ANSWERS[answer];
  if (!effect) return 'No such answer.';
  shift(effect);
  if (effect.rep) S.rep = Math.max(0, S.rep - effect.rep);
  if (answer == 'accept') {
    if (request.k == 'limit') bar.lim[request.comp] = request.to;
    else bar.w = { ...bar.w, [designKey(request.prog)]: 1 };
    S.p2.acc = [...(S.p2.acc || []), { d: Math.round(S.day), t: requestText(request) }];
    noteHabit(request.k == 'limit' ? 'override' : 'notest', 1, request.k == 'limit' ? `a limit raised under pressure (${componentName(request.comp)})` : `ground tests waived on the ${PROGRAMMES[request.prog].name}`);
    log('[NASA] Request granted. Congress hears Apollo is moving; the risk is on the record.', 'wn');
  } else log(answer == 'reasoned'
    ? '[NASA] Request refused, with the test results on file. Congress grumbles about caution, but the reasons are there to read.'
    : '[NASA] Request refused, with no reason given. Congress and the press take it badly.', answer == 'reasoned' ? 'cyan' : 'wn');
  S.p2.rq = null;
  return null;
}
// A test you asked for has finished: the request comes back for your answer, with the new figures.
export function testFinished(key) {
  const request = openRequest();
  if (request && request.prove == key) {
    delete request.prove;
    request.pv = 1;
    log(`[NASA] The test you asked for is in. Ellis's request is back for your answer (Mail).`, 'cyan');
  }
}

// SHIELDING. Returns an error text, or null.
export const shieldReady = key => !pressure() ? false : S.day >= ((pressure().sh || {})[key] || 0);
export function shield(key) {
  const state = pressure(), action = SHIELDS[key];
  if (!state || !action) return 'Nothing to shield yet.';
  if (!shieldReady(key)) return `Not again until ${formatDate(state.sh[key])}.`;
  if (key == 'testify' && hearingOpen()) return 'A hearing is already scheduled.';
  shift(action);
  state.sh = { ...state.sh, [key]: Math.round(S.day + action.cooldown) };
  if (key == 'testify') openHearing('apollo');
  else if (key == 'briefing') {
    state.vouch = Math.round(S.day + VOUCH_DAYS);
    log(`[NASA] You brief the press: Apollo is safe and on schedule. The papers calm down, but they will remember it if a crew flight goes wrong before ${formatDate(state.vouch)}.`, 'cyan');
  } else {
    state.sd = Math.round(S.day + STAND_DOWN_DAYS);
    log(`[NASA] The crews stand down until ${formatDate(state.sd)}. The heat comes off a little.`, 'cyan');
  }
  return null;
}
// Crewed launches are stood down: the reason, or null (rules/mercury.js crewLock).
export const standDownLock = () => pressure() && pressure().sd > S.day ? `Crewed flights are stood down until ${formatDate(pressure().sd)} to take the heat off.` : null;
// A crewed flight failed: if you vouched for Apollo at a briefing lately, the press throws it back at you.
export function vouchedFailure() {
  const state = pressure();
  if (!state || !(state.vouch > S.day)) return;
  S.rep = Math.max(0, S.rep - VOUCH_REPUTATION);
  log(`[PRESS] "Safe and on schedule," NASA said. The papers print the briefing beside the failure. Reputation -${VOUCH_REPUTATION}.`, 'bad');
}
