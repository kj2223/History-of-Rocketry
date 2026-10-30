// ELLIS'S ENGINEERING REMIT: the first delegated job (middle-path stage 2, after the Python build's funded remits). You give
// Ruth Ellis a spending cap for one rocket; inside it she does that rocket's routine engineering herself, each second:
//   1. findings: she signs off a records analysis whose confidence is inside her authority, and refers the rest to you (Mail)
//   2. fixes: for a diagnosed failure, the strongest cure that fits what is left of the cap
//   3. records analyses of the rocket's open incidents
//   4. test-stand runs for propulsion packages built into the rocket but not yet confirmed
// The money stays in the treasury until she spends it (a cap, like a launch campaign's budget), and she waits when the
// treasury cannot cover the next job. When the cap cannot cover it, she stops and asks you to raise it or close the remit.
// She leaves the PROP console while she holds a remit (rules/launch-site.js coveredStations). No DOM.
//
// S.remit: { prog: the rocket, cap ($), spent ($), jobs: jobs she has started, dry: the job the cap could not cover, or null }
import { formatMoney } from '../core/util.js';
import { BY_ID } from '../data/research.js';
import { FAILURE_MODES } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log, freeTeams, withProgramme } from '../core/state.js';
import { stagesOf, rocketOf } from './programs.js';
import { INVESTIGATION_COST, startInvestigation, acceptFinding, chooseFix } from './jobs.js';
import { groundTest, TEST_STAND } from './launch-site.js';
import { fixesHeld } from './team.js';

// EARNED, NOT DATED: Ellis can take a remit once she has led this many records analyses and signed this many fixes.
export const REMIT_REVIEWS_TO_UNLOCK = 3;
export const REMIT_FIXES_TO_UNLOCK = 2;
export const remitUnlocked = () => S.team.rev >= REMIT_REVIEWS_TO_UNLOCK && S.team.fix >= REMIT_FIXES_TO_UNLOCK;
// The caps you can set, and how much a raise adds.
export const REMIT_CAPS = [10000, 20000, 40000];
export const REMIT_RAISE = 10000;

// HER AUTHORITY grows with her record: at first she signs off only high-confidence findings; once this many of her fixes have
// held (rules/team.js), moderate ones too. Low-confidence findings always come to you.
export const FIXES_HELD_FOR_MODERATE = 2;
export const signsOff = confidence => confidence == 'high' || (confidence == 'moderate' && fixesHeld() >= FIXES_HELD_FOR_MODERATE);
export const authorityText = () => fixesHeld() >= FIXES_HELD_FOR_MODERATE ? 'Signs off high- and moderate-confidence findings herself.'
  : `Signs off high-confidence findings herself; moderate ones too once ${FIXES_HELD_FOR_MODERATE} of her fixes have held (${fixesHeld()} so far).`;

// Give Ellis a remit for the programme in focus. Returns an error text, or null if it started.
export function startRemit(cap) {
  if (!remitUnlocked()) return `Ellis needs ${REMIT_REVIEWS_TO_UNLOCK} records analyses led and ${REMIT_FIXES_TO_UNLOCK} fixes signed first.`;
  if (S.remit) return 'Ellis already holds a remit.';
  if (!S.progs[S.cur] || !(cap > 0)) return 'Choose a rocket and a cap.';
  S.remit = { prog: S.cur, cap, spent: 0, jobs: 0, dry: null };
  log(`[CHIEF] Ellis takes the routine engineering of the ${PROGRAMMES[S.cur].name}, up to ${formatMoney(cap)}. She leaves the PROP console.`, 'cyan');
  return null;
}
// double: raise by the cap itself, for the budgets of a big programme.
export function raiseRemit(double = false) {
  if (!S.remit) return;
  S.remit.cap += double ? S.remit.cap : REMIT_RAISE;
  S.remit.dry = null;
  log(`[CHIEF] Ellis's remit raised to ${formatMoney(S.remit.cap)}.`, 'ok');
}
export function endRemit() {
  const remit = S.remit;
  if (!remit) return;
  S.remit = null;
  log(`[CHIEF] Ellis's remit closed: ${remit.jobs} job${remit.jobs == 1 ? '' : 's'}, ${formatMoney(remit.spent)} of ${formatMoney(remit.cap)} spent. Anything still referred to you stays on your desk.`, 'wn');
}

// The findings she has referred to you, in her remit's programme.
export const referredFindings = () => S.remit && S.progs[S.remit.prog] ? [S.remit.prog, ...stagesOf(S.remit.prog)].flatMap(kind => withProgramme(kind, () => S.inc.filter(incident => incident.st == 'found' && incident.ref))) : [];
// Whether the incidents of the programme in focus go through Ellis: she works them, and the findings she refers to you come in
// her remit's message, not the general incidents one. Once you make the call on a referred finding, she builds the fix.
export const incidentsWithEllis = () => !!S.remit && S.remit.prog == rocketOf(S.cur);

// A one-time note when Ellis has earned a remit. Returns true if it was made.
export function remitEarnedTick() {
  if (S.team.ru || !remitUnlocked()) return false;
  S.team.ru = 1;
  log('[CHIEF] Ruth Ellis has led enough reviews and signed enough fixes to run a rocket\'s routine engineering herself. Her offer is in Mail.', 'hd');
  return true;
}

// The work that needs a team and money, in her order. Each: { name, cost, start }.
function routineWork() {
  const work = [];
  for (const incident of S.inc.filter(candidate => candidate.st == 'diag')) {
    const fixes = FAILURE_MODES[incident.dx].fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier || first.cost - second.cost);
    const left = S.remit.cap - S.remit.spent, cheapest = fixes.reduce((best, candidate) => candidate.cost < best.cost ? candidate : best);
    const fix = fixes.find(candidate => candidate.cost <= left) || cheapest;
    work.push({ name: fix.name, cost: fix.cost, start: () => chooseFix(incident.id, fix.id) });
  }
  for (const incident of S.inc.filter(candidate => candidate.st == 'open')) {
    work.push({ name: `a records analysis of incident #${incident.id}`, cost: INVESTIGATION_COST, start: () => startInvestigation(incident.id) });
  }
  const untested = S.fac.stand ? Object.keys(S.pk).filter(id => BY_ID[id] && BY_ID[id].area == 'p' && !S.pk[id].c && !S.jobs.some(job => job.k == 'gt' && job.id == id)) : [];
  for (const id of untested) {
    work.push({ name: `a test-stand run of ${BY_ID[id].name}`, cost: TEST_STAND.cost, start: () => groundTest(id) });
  }
  return work;
}

// Each second. Returns true if anything happened.
export function remitTick() {
  const remit = S.remit;
  if (!remit) return false;
  if (!S.progs[remit.prog]) {
    endRemit();
    return true;
  }
  // She works the rocket's lower stages too (rules/stages.js).
  return [remit.prog, ...stagesOf(remit.prog)].map(kind => withProgramme(kind, () => ellisTurn(remit))).some(Boolean);
}
function ellisTurn(remit) {
  let changed = false;
  for (const incident of S.inc.filter(candidate => candidate.st == 'found' && !candidate.ref)) {
    changed = true;
    if (signsOff(incident.conf)) {
      log(`[CHIEF] Ellis signs off incident #${incident.id}: ${FAILURE_MODES[incident.dx].name.toLowerCase()} (${incident.conf} confidence).`, 'ok');
      acceptFinding(incident.id);
    } else {
      incident.ref = 1;
      log(`[CHIEF] Ellis refers incident #${incident.id} to you: ${incident.conf} confidence is outside her authority.`, 'wn');
    }
  }
  for (const work of routineWork()) {
    if (freeTeams() < 1) break;
    if (remit.spent + work.cost > remit.cap) {
      if (remit.dry != work.name) {
        remit.dry = work.name;
        log(`[CHIEF] Ellis's remit cannot cover ${work.name} (${formatMoney(work.cost)}). Raise it or close it.`, 'wn');
        changed = true;
      }
      break;
    }
    if (S.b < work.cost) break;
    const before = S.b;
    work.start();
    if (S.b < before) {
      remit.spent += before - S.b;
      remit.jobs++;
      changed = true;
    }
  }
  return changed;
}
