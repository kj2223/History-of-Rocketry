// ENGINEERING JOBS: starting investigations, fixes, design reviews and hangar retrofits, and finishing every kind of job. No DOM.
// Each job takes one engineering team (see freeTeams) and counts down a second at a time in rules/game.js.
// Job kinds: pk research, inv investigation, fix corrective fix, rev design review, gt ground test, retro hangar retrofit, dev programme design.
import { formatMoney } from '../core/util.js';
import { FAILURE_MODES, findFix } from '../data/failures.js';
import { S, log, freeTeams, withProgramme } from '../core/state.js';
import { trackingTiers, airframeLabel } from './design.js';
import { retrofitQuote } from './production.js';
import { finishResearch, confirmPackage, checkBreakthroughs } from './research.js';
import { learn, knowledgeFraction, systemOf, SYSTEMS, REVIEW_COST, reviewTime, finishReview } from './knowledge.js';
import { finishDesign, revealTraits } from './programs.js';

export const INVESTIGATION_COST = 1500;
// Investigations go faster when the team knows the system involved: 25 seconds, up to 40% less.
export const investigationTime = incident => Math.round(25 * (1 - .4 * knowledgeFraction(systemOf(incident.cand[0]))));

// A HANGAR RETROFIT brings a ready airframe up to the published blueprint using an engineering team instead of the factory.
export function startRetrofit(id) {
  const airframe = S.air.find(candidate => candidate.id == id), quote = airframe && retrofitQuote(airframe);
  if (quote && S.b >= quote.cost && freeTeams() > 0) {
    S.b -= quote.cost;
    airframe.st = 'retro';
    S.jobs.push({ k: 'retro', id: airframe.id, prog: airframe.prog, t: quote.time, tot: quote.time });
    log(`[HANGAR] Retrofitting ${airframe.label} (${formatMoney(quote.cost)}).`, 'wn');
  }
}
// A DESIGN REVIEW: a team studies one system for failure modes that have not happened yet.
export function startReview(area) {
  if (!SYSTEMS[area] || !SYSTEMS[area].modes || S.b < REVIEW_COST || freeTeams() < 1 || S.jobs.some(job => job.k == 'rev' && job.a == area)) return;
  S.b -= REVIEW_COST;
  const time = reviewTime(area);
  S.jobs.push({ k: 'rev', a: area, id: area, prog: S.cur, t: time, tot: time });
  log(`[DESIGN REVIEW] ${SYSTEMS[area].name}: a team begins a design review ($3,000).`, 'wn');
}
// RECORDS ANALYSIS of an open incident.
export function startInvestigation(id) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (incident && incident.st == 'open' && S.b >= INVESTIGATION_COST && freeTeams() > 0) {
    S.b -= INVESTIGATION_COST;
    incident.st = 'inv';
    const time = investigationTime(incident);
    S.jobs.push({ k: 'inv', id: incident.id, prog: S.cur, t: time, tot: time });
    log(`[INCIDENT #${incident.id}] Records analysis under way.`, 'wn');
  }
}
// A CORRECTIVE FIX for a diagnosed incident.
export function chooseFix(id, fixId) {
  const incident = S.inc.find(candidate => candidate.id == id), fix = incident && findFix(incident.dx, fixId);
  if (fix && incident.st == 'diag' && S.b >= fix.cost && freeTeams() > 0) {
    S.b -= fix.cost;
    incident.st = 'fixing';
    S.jobs.push({ k: 'fix', id: incident.id, prog: S.cur, m: incident.dx, f: fix.id, t: fix.time, tot: fix.time });
    log(`[DESIGN] Implementing ${fix.name}.`, 'wn');
  }
}

// A finished job takes effect inside the programme it was started for.
export function finishJob(job) {
  if (job.k == 'dev') return finishDesign(job.prog);
  return withProgramme(job.prog, () => finishJobForProgramme(job));
}
function finishJobForProgramme(job) {
  if (job.k == 'pk') finishResearch(job.id);
  else if (job.k == 'inv') finishInvestigation(job.id);
  else if (job.k == 'rev') finishReview(job.a);
  else if (job.k == 'fix') finishFix(job);
  else if (job.k == 'gt') {
    confirmPackage(job.id, 'Test-stand');
    checkBreakthroughs();
  } else if (job.k == 'retro') finishRetrofit(job.id);
}

// THE DIAGNOSIS. The chance of the right answer grows with the candidates ruled out, the tracking and telemetry, the evidence on file
// and what the team knows of the system. A wrong answer names one of the other candidates.
function finishInvestigation(id) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (!incident) return;
  const tiers = trackingTiers(), dataQuality = Math.min(.7, .1 * (tiers.g + tiers.v) + (S.crew.tlm ? .1 : 0));
  const chance = Math.min(.97, 1 / incident.cand.length + .5 * dataQuality + .12 * (incident.ev - 1) + .35 * knowledgeFraction(systemOf(incident.cand[0])));
  const decoys = incident.cand.filter(candidate => candidate != incident.mode);
  const right = Math.random() < chance || !decoys.length;
  incident.dx = right ? incident.mode : decoys[Math.floor(Math.random() * decoys.length)];
  incident.conf = chance < .45 ? 'low' : chance < .75 ? 'moderate' : 'high';
  incident.st = 'diag';
  if (right) S.known[incident.mode] = 1;
  learn(systemOf(incident.mode), right ? 8 : 3);
  revealTraits(S.cur);
  log(`[INCIDENT #${incident.id}] Engineers conclude ${FAILURE_MODES[incident.dx].name.toLowerCase()} (${incident.conf} confidence).`, 'wn');
}
function finishFix(job) {
  S.fix[job.m] = job.f;
  learn(systemOf(job.m), 5);
  const incident = S.inc.find(candidate => candidate.id == job.id);
  if (incident && incident.st == 'fixing') incident.st = 'done';
  log(`[DESIGN] ${findFix(job.m, job.f).name} is now part of the design. Older airframes need a retrofit.`, 'ok');
}
function finishRetrofit(id) {
  const airframe = S.air.find(candidate => candidate.id == id);
  if (!airframe) return;
  airframe.pk = Object.keys(S.pk);
  airframe.fix = { ...S.fix };
  airframe.st = 'r';
  airframe.label = airframeLabel(airframe.prog, airframe.pk, airframe.id);
  log(`[HANGAR] ${airframe.label} retrofit complete.`, 'ok');
}
