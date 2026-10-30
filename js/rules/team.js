// THE CORE TEAM'S RECORD: Ruth Ellis, Daniel Vega and Samuel Morgan (data/team.js) work every flight together, and each keeps
// the part of the record that belongs to their speciality. What they say after a failure and in a records analysis comes from
// here too: they speak from what the records show, never from the hidden cause. No DOM.
//
// S.team: { n: flights worked, ok: successful flights, rev: records analyses Ellis has led, fix: fixes signed into a design,
//           dir: flights Ellis has run as launch director, rec: records Morgan has measured, top: highest peak measured (m),
//           joined: { member: 1 } for the leads who joined later, held: fixes that held, ru: 1 once Ellis has earned a remit (rules/remit.js), watch: fixes still on trial [{ p: programme, m: failure mode, ok: good flights since }] }
import { CORE_TEAM } from '../data/team.js';
import { FAILURE_MODES } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log } from '../core/state.js';

const plural = (count, word, many = word + 's') => `${count} ${count == 1 ? word : many}`;
const failures = () => S.team.n - S.team.ok;

export const memberName = id => CORE_TEAM[id].name;
// Whether a member is with the programme yet (S.team.joined: { member: 1 } for the leads who join later, rules/lanes.js, rules/factory-lead.js).
export const memberJoined = id => !CORE_TEAM[id].joins || !!(S.team.joined && S.team.joined[id]);
export const joinedMembers = () => Object.keys(CORE_TEAM).filter(memberJoined);
export const memberRole = id => CORE_TEAM[id].roles ? CORE_TEAM[id].roles[S.staff.director ? 'after' : 'before'] : CORE_TEAM[id].role;

// After every flight and every Mercury boost. peak: as the range measured it (none for a boost); records: new records measured.
export function recordTeamFlight(ok, peak = 0, records = 0, byDirector = false) {
  const team = S.team;
  team.n++;
  if (ok) team.ok++;
  if (byDirector) team.dir++;
  team.rec += records;
  team.top = Math.max(team.top, peak);
}
export const recordReview = () => { S.team.rev++; };

// A FIX THAT HELD is Ellis's track record (rules/remit.js): a fix is on trial until its rocket flies FLIGHTS_FOR_A_FIX_TO_HOLD
// good flights, and fails the trial if a later records analysis of that rocket is closed on the same failure mode.
// Both are things the records show, never the hidden cause. Saves from before this have no held or watch.
export const FLIGHTS_FOR_A_FIX_TO_HOLD = 3;
export const fixesHeld = () => S.team.held || 0;
const fixesOnTrial = () => S.team.watch || (S.team.watch = []);
// A fix signed into the design of the programme in focus.
export function recordFix(mode) {
  S.team.fix++;
  fixesOnTrial().push({ p: S.cur, m: mode, ok: 0 });
}
// After every flight of a programme.
export function recordFixTrials(programme, ok) {
  if (!ok) return;
  for (const trial of fixesOnTrial().filter(candidate => candidate.p == programme)) {
    if (++trial.ok < FLIGHTS_FOR_A_FIX_TO_HOLD) continue;
    S.team.held = fixesHeld() + 1;
    log(`[CHIEF] Ellis: the ${FAILURE_MODES[trial.m].name.toLowerCase()} fix on the ${PROGRAMMES[programme].name} has held for ${FLIGHTS_FOR_A_FIX_TO_HOLD} good flights.`, 'ok');
  }
  S.team.watch = fixesOnTrial().filter(trial => trial.ok < FLIGHTS_FOR_A_FIX_TO_HOLD);
}
// A records analysis of the programme in focus is closed on this failure mode: a fix on trial for it did not hold.
export function fixFailedTrial(mode) {
  if (!fixesOnTrial().some(trial => trial.p == S.cur && trial.m == mode)) return;
  S.team.watch = fixesOnTrial().filter(trial => !(trial.p == S.cur && trial.m == mode));
  log(`[CHIEF] Ellis: the ${FAILURE_MODES[mode].name.toLowerCase()} came back. That fix did not hold.`, 'wn');
}

// Each member's record, for the roster.
export function memberRecord(id) {
  const team = S.team;
  if (id == 'ellis') return `${plural(team.n, 'flight')}, ${plural(failures(), 'failure')}, ${plural(team.rev, 'review')} led, ${plural(team.fix, 'fix', 'fixes')} signed into the designs, ${fixesHeld()} held${S.staff.director ? `, ${team.dir} run as launch director` : ''}`;
  if (id == 'reed') return S.works ? `${plural(S.works.built, 'airframe')} ordered, ${plural(S.works.retro, 'upgrade')} on her budget` : 'no factory budget yet';
  if (id == 'chen') return S.lanes ? `${plural(S.lanes.jobs, 'package')} started by her lanes` : 'no research budget yet';
  if (id == 'vega') return `${plural(team.n, 'countdown')} run, ${team.ok} good`;
  return `${plural(team.n, 'flight')} tracked, ${plural(team.rec, 'record')} measured${team.top ? `, best peak ${(team.top / 1000).toFixed(1)} km` : ''}`;
}

// ELLIS AFTER A FAILURE, on the pad's failure report. report: flight.report (rules/flight.js openIncident).
export function chiefOnFailure(report) {
  const count = failures();
  const opening = count == 1 ? 'Our first failure.' : `Failure ${count} in ${S.team.n} flights.`;
  if (!report.id) return `${opening} Nothing new for the engineering file in this one.`;
  if (report.cand.length > 1) return `${opening} The records cannot tell the suspects apart yet. I want an analysis before we fly this design again.`;
  return `${opening} Only one thing looks like this on the records. An analysis should confirm it.`;
}

// A RECORDS ANALYSIS'S FINDINGS: Ellis signs them with a word on how far to trust them, and Morgan says how good the records were.
// quality: the share of the evidence the tracking and telemetry captured (rules/jobs.js recordsQuality).
const CHIEF_ON_CONFIDENCE = {
  high: 'The records are clear. I would sign this.',
  moderate: 'It fits the records, but so do the others.',
  low: 'A guess with numbers on it. I would not bet the next airframe on it.',
};
export const chiefOnFindings = incident => CHIEF_ON_CONFIDENCE[incident.conf];
export const rangeOnRecords = quality => quality < .2 ? 'Radar plots and not much else. Thin records to work from.'
  : quality < .4 ? 'Usable records, with gaps where we were not looking.' : 'Good records. We saw most of what happened.';
