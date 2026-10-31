// ENGINEERING JOBS: starting investigations, fixes, design reviews and hangar retrofits, and finishing every kind of job. No DOM.
// Each job takes one engineering team (see freeTeams) and counts down a second at a time in rules/game.js.
// Job kinds: pk research, inv investigation, fix corrective fix, rev design review, gt ground test, retro hangar retrofit, dev programme design.
import { formatMoney } from '../core/util.js';
import { FAILURE_MODES, findFix } from '../data/failures.js';
import { S, log, freeTeams, withProgramme } from '../core/state.js';
import { trackingTiers, airframeLabel } from './design.js';
import { retrofitQuote, rocketFixes } from './production.js';
import { finishResearch, confirmPackage, checkBreakthroughs } from './research.js';
import { learn, knowledgeFraction, systemOf, SYSTEMS, REVIEW_COST, reviewTime, finishReview } from './knowledge.js';
import { finishDesign, revealTraits, stagesOf } from './programs.js';
import { recordReview, recordFix, fixFailedTrial } from './team.js';
import { finishCure } from './cures.js';

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
  S.rq = S.rq.filter(entry => !(entry.k == 'rev' && entry.id == area && entry.prog == S.cur));
  const time = reviewTime(area);
  S.jobs.push({ k: 'rev', a: area, id: area, prog: S.cur, t: time, tot: time });
  log(`[DESIGN REVIEW] ${SYSTEMS[area].name}: a team begins a design review ($3,000).`, 'wn');
}
// RECORDS ANALYSIS of an open incident.
export const startInvestigation = id => runAnalysis(id, 'open', false);
// THE FINDINGS: records analysis ends with the team's lead suspect and how sure it is (st 'found'). The call is yours:
// accept the lead, name another suspect yourself (your gamble), or extend the analysis to rule a suspect out.
export function acceptFinding(id) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (incident && incident.st == 'found') closeFinding(incident, incident.dx, incident.conf);
}
export function nameCause(id, mode) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (incident && incident.st == 'found' && incident.cand.includes(mode)) closeFinding(incident, mode, mode == incident.dx ? incident.conf : 'your call');
}
function closeFinding(incident, mode, confidence) {
  incident.dx = mode;
  incident.conf = confidence;
  incident.st = 'diag';
  fixFailedTrial(mode);
  if (mode == incident.mode) S.known[mode] = 1;
  log(`[INCIDENT #${incident.id}] Closed: ${FAILURE_MODES[mode].name.toLowerCase()} goes in the engineering file.`, 'wn');
}
// The balance bot takes every lead as soon as the analysis ends, in every programme, so its runs match the old automatic verdicts.
export function acceptAllFindings() {
  for (const kind of Object.keys(S.progs)) withProgramme(kind, () => S.inc.filter(incident => incident.st == 'found').forEach(incident => acceptFinding(incident.id)));
}
// Extending costs another analysis and rules out one suspect that is not the true cause, then the team draws a new conclusion.
export const extendInvestigation = id => runAnalysis(id, 'found', true);
// Starts (or extends) the analysis of an incident that is at the given stage, if the money and a free team allow.
function runAnalysis(id, stage, extended) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (incident && incident.st == stage && S.b >= INVESTIGATION_COST && freeTeams() > 0) {
    S.b -= INVESTIGATION_COST;
    incident.st = 'inv';
    S.rq = S.rq.filter(entry => !(entry.k == 'inv' && entry.id == incident.id && entry.prog == S.cur));
    const time = investigationTime(incident);
    S.jobs.push({ k: 'inv', id: incident.id, prog: S.cur, t: time, tot: time, ...(extended ? { x: 1 } : {}) });
    log(`[INCIDENT #${incident.id}] ${extended ? 'The analysis is extended.' : 'Records analysis under way.'}`, 'wn');
  }
}
// A CORRECTIVE FIX for a diagnosed incident.
export function chooseFix(id, fixId) {
  const incident = S.inc.find(candidate => candidate.id == id), fix = incident && findFix(incident.dx, fixId);
  if (fix && incident.st == 'diag' && S.b >= fix.cost && freeTeams() > 0) {
    S.b -= fix.cost;
    incident.st = 'fixing';
    S.rq = S.rq.filter(entry => !(entry.k == 'fix' && entry.id == incident.id && entry.prog == S.cur));
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
  else if (job.k == 'inv') finishInvestigation(job.id, job.x);
  else if (job.k == 'rev') finishReview(job.a);
  else if (job.k == 'fix') finishFix(job);
  else if (job.k == 'gt') {
    confirmPackage(job.id, 'Test-stand');
    checkBreakthroughs();
  } else if (job.k == 'retro') finishRetrofit(job.id);
  else if (job.k == 'cure') finishCure(job);
}

// How much of a failure the records capture, 0 to 0.7: the tracking, the telemetry, and a Telemetry Engineer to read them.
export const recordsQuality = () => {
  const tiers = trackingTiers();
  return Math.min(.7, .1 * (tiers.g + tiers.v) + (S.crew.tlm ? .1 : 0));
};
// THE DIAGNOSIS. The chance of the right answer grows with the candidates ruled out, the tracking and telemetry, the evidence on file
// and what the team knows of the system. A wrong answer names one of the other candidates.
// The answer is the team's lead, waiting for your call (see acceptFinding); p is the chance it is right, which the findings card shows.
// An extended analysis (extended = 1) first rules out one wrong candidate.
function finishInvestigation(id, extended) {
  const incident = S.inc.find(candidate => candidate.id == id);
  if (!incident) return;
  if (extended) {
    const wrong = incident.cand.filter(candidate => candidate != incident.mode);
    if (wrong.length) {
      const ruledOut = wrong[Math.floor(Math.random() * wrong.length)];
      incident.cand = incident.cand.filter(candidate => candidate != ruledOut);
      log(`[INCIDENT #${incident.id}] The extended analysis rules out ${FAILURE_MODES[ruledOut].name.toLowerCase()}.`, 'wn');
    }
  }
  const chance = Math.min(.97, 1 / incident.cand.length + .5 * recordsQuality() + .12 * (incident.ev - 1) + .35 * knowledgeFraction(systemOf(incident.cand[0])));
  const decoys = incident.cand.filter(candidate => candidate != incident.mode);
  const right = Math.random() < chance || !decoys.length;
  incident.dx = right ? incident.mode : decoys[Math.floor(Math.random() * decoys.length)];
  incident.conf = chance < .45 ? 'low' : chance < .75 ? 'moderate' : 'high';
  incident.p = decoys.length ? chance : 1;
  incident.st = 'found';
  recordReview();
  learn(systemOf(incident.mode), right ? 8 : 3);
  revealTraits(S.cur);
  log(`[INCIDENT #${incident.id}] Records analysis done: Ruth Ellis's team suspects ${FAILURE_MODES[incident.dx].name.toLowerCase()} (${incident.conf} confidence). Your call on the R&D desk.`, 'wn');
}
function finishFix(job) {
  S.fix[job.m] = job.f;
  recordFix(job.m);
  learn(systemOf(job.m), 5);
  const incident = S.inc.find(candidate => candidate.id == job.id);
  if (incident && incident.st == 'fixing') incident.st = 'done';
  log(`[DESIGN] ${findFix(job.m, job.f).name} is now part of the design. Older airframes need a retrofit.`, 'ok');
}
function finishRetrofit(id) {
  const airframe = S.air.find(candidate => candidate.id == id);
  if (!airframe) return;
  airframe.pk = Object.keys(S.pk);
  airframe.fix = rocketFixes();
  airframe.stg = Object.fromEntries(stagesOf(S.cur).map(stage => [stage, { pk: Object.keys(S.progs[stage].pk), rev: S.progs[stage].bp.rev }]));
  airframe.st = 'r';
  airframe.label = airframeLabel(airframe.prog, airframe.pk, airframe.id);
  log(`[HANGAR] ${airframe.label} retrofit complete.`, 'ok');
}
