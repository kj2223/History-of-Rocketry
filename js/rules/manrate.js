// MAN-RATING: before a crew rides one of your boosters, the design needs a clean flight record and the man-rating research. No DOM.
// Each rocket programme keeps its own record. A booster family is every blueprint revision since the programme's last booster
// milestone (a major redesign). Three successful flights in a row by the family, with the research done, certify it.
// In Section 2 an orbital-class booster needs two, as Atlas had before Glenn flew (MA-4 and MA-5).
//
// The record (saved in each programme's bundle as mrate):
//   base    the first blueprint revision of the current family
//   streak  clean flights in a row by the family
//   cert    certified revision ranges: [first, last], last null while the family is still current
//   n       family flights counted
import { S, log, addHistory, isResearched, recordRunEvent } from '../core/state.js';
import { BY_ID, isMilestone } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';

export const CLEAN_FLIGHTS_NEEDED = 3, ORBITAL_CLEAN_FLIGHTS_NEEDED = 2;
export const cleanFlightsNeeded = (kind = S.cur) => S.p2 && S.p2.secDone && PROGRAMMES[kind] && PROGRAMMES[kind].canOrbit ? ORBITAL_CLEAN_FLIGHTS_NEEDED : CLEAN_FLIGHTS_NEEDED;
export const MAN_RATING_RESEARCH = ['mr_mods', 'esc_asis', 'ms_mrman'];

export function manRatingRecord(kind = S.cur) {
  const bundle = S.progs[kind];
  if (!bundle) return { base: 1, streak: 0, cert: [], n: 0 };
  if (!bundle.mrate) bundle.mrate = { base: bundle.bp.rev, streak: 0, cert: [], n: 0 };
  return bundle.mrate;
}
const kindOf = airframe => airframe && airframe.prog || S.cur;
export const isInFamily = airframe => airframe.rev >= manRatingRecord(kindOf(airframe)).base;
// Is the programme's current family certified?
export const isFamilyCertified = (kind = S.cur) => {
  const record = manRatingRecord(kind), latest = record.cert[record.cert.length - 1];
  return !!latest && latest[1] == null && latest[0] == record.base;
};
export const anyCertified = () => Object.keys(S.progs).some(kind => manRatingRecord(kind).cert.length > 0);
// May this airframe carry a crew? Its revision must fall inside a certified range.
export const isManRated = airframe => manRatingRecord(kindOf(airframe)).cert.some(([first, last]) => airframe.rev >= first && airframe.rev <= (last == null ? 1e9 : last));
// The man-rating research a programme needs: the usual packages, and its own (Titan II's pogo cure).
export const manRatingResearchFor = (kind = S.cur) => [...MAN_RATING_RESEARCH, ...(PROGRAMMES[kind] && PROGRAMMES[kind].manRatingResearch || [])];
export const manRatingResearchDone = kind => manRatingResearchFor(kind).every(isResearched);
// "Redstone Rev 3+, ..." for every programme with a certification.
export const certifiedNames = () => Object.keys(S.progs).filter(kind => manRatingRecord(kind).cert.length)
  .map(kind => `${PROGRAMMES[kind].name} ${manRatingRecord(kind).cert.map(([first, last]) => last == null ? `Rev ${first}+` : `Rev ${first}–${last}`).join(', ')}`);

// Every booster flight reports here, after NASA exists: ordinary launches and Mercury boosts alike.
export function recordBoosterFlight(airframe, ok) {
  if (!S.nasa) return;
  const kind = kindOf(airframe), record = manRatingRecord(kind);
  if (!isInFamily(airframe) || isFamilyCertified(kind)) return;
  record.n++;
  const name = PROGRAMMES[kind] ? PROGRAMMES[kind].name : 'Booster';
  if (ok) {
    record.streak++;
    log(`[MAN-RATING] Clean flight for the ${name} Rev ${record.base}+ family: ${Math.min(record.streak, cleanFlightsNeeded(kind))} of ${cleanFlightsNeeded(kind)} in a row.`, 'ok');
  } else if (record.streak) {
    record.streak = 0;
    log(`[MAN-RATING] The ${name} failed. Its clean-flight count starts again.`, 'bad');
  }
  checkCertification(kind);
}
// Certify the family if its record and the research are complete. With no kind, check every programme (returns true if any was certified).
export function checkCertification(kind) {
  if (!kind) {
    let any = false;
    for (const each in S.progs) if (checkCertification(each)) any = true;
    return any;
  }
  const record = manRatingRecord(kind);
  if (isFamilyCertified(kind)) return false;
  if (record.streak < cleanFlightsNeeded(kind) || !manRatingResearchDone(kind)) return false;
  record.cert.push([record.base, null]);
  const name = PROGRAMMES[kind].name;
  addHistory(`${name} man-rated (Rev ${record.base} onward)`);
  log(`[MAN-RATING] Certified: ${name} boosters built to Rev ${record.base} or later may carry a crew.`, 'hd');
  recordRunEvent({ k: 'manrate', prog: kind, rev: record.base });
  return true;
}
// Publishing a blueprint that adds a booster milestone starts a new family. Certified airframes already built stay certified.
export function startNewFamilyIfRedesigned(added, revision) {
  const record = manRatingRecord();
  if (!added.some(id => isMilestone(id) && BY_ID[id] && BY_ID[id].phase != 2)) return;
  if (isFamilyCertified()) {
    const latest = record.cert[record.cert.length - 1];
    latest[1] = revision - 1;
    log(`[MAN-RATING] Rev ${revision} is a major booster redesign and needs its own flight record. Airframes built to Rev ${latest[0]}–${revision - 1} keep their certification.`, 'wn');
  } else if (record.streak) log(`[MAN-RATING] Rev ${revision} is a major booster redesign. The clean-flight count starts again.`, 'wn');
  record.base = revision;
  record.streak = 0;
}
