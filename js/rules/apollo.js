// PROJECT APOLLO, PART ONE: when Mercury closes, its team rolls over to Apollo while Gemini flies, and studies how to reach the Moon.
// You decide whether the Mercury spacecraft lead goes with them (Gemini then hires a new one), commission the study, and choose an
// architecture from its estimates. Gemini's rendezvous, docking and spacewalks firm up the risk estimates of the approaches that need
// a rendezvous, so waiting for them buys certainty at the cost of schedule. No DOM.
//
// S.p2.ap: { d: day Apollo opened, xp: crewed Mercury flights the team brings,
//            lead: the Mercury spacecraft lead who moved over (a LEAD_POSTS.c candidate id), null if none, undefined until you decide,
//            sz: the study size (a STUDY_SIZES key) once commissioned, t: study days left, tot: its length, q: its quality,
//            done: day the study reported, arch: the chosen architecture, ad: day it was chosen,
//            tr: true figures { [architecture]: { cost, years, risk } }, bias: how far off the study starts, the same shape, -1 to 1 }
import { formatMoney } from '../core/util.js';
import { STUDY_SIZES, ROLLOVER_QUALITY, MERCURY_FLIGHT_QUALITY, MERCURY_QUALITY_CAP, QUALITY_CAP, NEW_TEAM_SLOWDOWN, ESTIMATE_WIDTH, GEMINI_EVIDENCE, TRUE_SPREAD, ARCHITECTURES } from '../data/apollo.js';
import { LEAD_POSTS } from '../data/leads.js';
import { S, log, addHistory } from '../core/state.js';
import { hiredLead } from './leads.js';
import { capabilityShown } from './mercury.js';

export const ESTIMATE_KEYS = ['cost', 'years', 'risk'];
export const apollo = () => S.p2 && S.p2.ap || null;
// The lead who moved over from Mercury, as their candidate entry, or null.
export const apolloLead = () => {
  const state = apollo();
  return state && state.lead ? LEAD_POSTS.c.candidates.find(candidate => candidate.id == state.lead) : null;
};

const roll = () => Math.random() * 2 - 1;
// APOLLO OPENS when Mercury is complete (and for saves that finished Mercury before Apollo existed). The true figures are rolled now.
export function openApollo() {
  const tr = {}, bias = {};
  for (const [key, architecture] of Object.entries(ARCHITECTURES)) {
    tr[key] = {};
    bias[key] = {};
    for (const stat of ESTIMATE_KEYS) {
      tr[key][stat] = architecture[stat] * (1 + roll() * TRUE_SPREAD);
      bias[key][stat] = roll();
    }
  }
  const xp = (S.p2.astros || []).reduce((sum, astronaut) => sum + (astronaut.flights || 0), 0);
  S.p2.ap = { d: Math.round(S.day), xp, lead: hiredLead('c') ? undefined : null, tr, bias };
  addHistory('Project Apollo begins');
  log('[NASA] Project Apollo: with Mercury complete, its team moves to the Moon programme while Gemini flies. Their first job is to study how to get there.', 'hd');
}

// Send the Mercury spacecraft lead to Apollo (their Gemini post reopens), or keep them on Gemini.
export function decideRollover(send) {
  const state = apollo(), lead = hiredLead('c');
  if (!state || state.lead !== undefined) return;
  if (send && lead) {
    state.lead = lead.id;
    delete S.leads.c;
    log(`[NASA] ${lead.name} moves to Apollo to lead the study, with the Mercury spacecraft team. Gemini needs a new spacecraft lead.`, 'hd');
  } else {
    state.lead = null;
    if (lead) log(`[NASA] ${lead.name} stays on Gemini. The Mercury engineers go to Apollo without their lead.`, 'wn');
  }
}

// How firm the study's figures are: its size, the lead who moved over, and the Mercury flights the team flew.
export const studyQuality = size => {
  const lead = apolloLead();
  return Math.min(QUALITY_CAP, STUDY_SIZES[size].quality + (lead ? ROLLOVER_QUALITY * lead.pace : 0) + Math.min(MERCURY_QUALITY_CAP, apollo().xp * MERCURY_FLIGHT_QUALITY));
};
export const studyDays = size => {
  const lead = apolloLead();
  return Math.round(STUDY_SIZES[size].days * (lead ? 1 / lead.pace : NEW_TEAM_SLOWDOWN));
};
// Commission the study. Returns an error text, or null.
export function startStudy(size) {
  const state = apollo(), study = STUDY_SIZES[size];
  if (!state || !study) return 'No such study.';
  if (state.lead === undefined) return 'Decide who leads Apollo first.';
  if (state.sz) return 'The study is already commissioned.';
  if (S.b < study.cost) return `Need ${formatMoney(study.cost - S.b)} more.`;
  S.b -= study.cost;
  Object.assign(state, { sz: size, t: studyDays(size), tot: studyDays(size), q: studyQuality(size) });
  log(`[NASA] ${study.name} commissioned (${formatMoney(study.cost)}): about ${Math.round(state.t / 30)} months.`, 'wn');
  return null;
}

// Each second, with the days that passed. Returns true if the study reported.
export function apolloTick(days) {
  const state = apollo();
  if (!state || !state.sz || state.done) return false;
  state.t = Math.max(0, state.t - days);
  if (state.t > 0) return false;
  state.done = Math.round(S.day);
  log('[NASA] The Apollo study reports: three ways to the Moon, costed. The choice is yours (Mail).', 'hd');
  return true;
}

// THE ESTIMATES once the study has reported: for each architecture and figure, { low, mid, high }, centred near the truth by a bias
// that shrinks with the width. Gemini evidence narrows the risk of the approaches that need a rendezvous.
export function estimate(key, stat) {
  const state = apollo();
  if (!state || !state.done) return null;
  let width = ESTIMATE_WIDTH * (1 - state.q);
  if (stat == 'risk' && ARCHITECTURES[key].gemini) for (const [kind, share] of Object.entries(GEMINI_EVIDENCE)) if (capabilityShown(kind)) width *= 1 - share;
  const mid = state.tr[key][stat] * (1 + state.bias[key][stat] * width * .5);
  return { low: mid * (1 - width), mid, high: mid * (1 + width) };
}

// Choose the architecture. Returns an error text, or null.
export function chooseArchitecture(key) {
  const state = apollo(), architecture = ARCHITECTURES[key];
  if (!state || !architecture) return 'No such architecture.';
  if (!state.done) return 'The study has not reported yet.';
  if (state.arch) return 'The architecture is already chosen.';
  Object.assign(state, { arch: key, ad: Math.round(S.day) });
  addHistory(`Apollo architecture: ${architecture.name}`);
  log(`[NASA] Apollo will go to the Moon by ${architecture.name.toLowerCase()}, on the ${architecture.booster}.`, 'hd');
  return null;
}
