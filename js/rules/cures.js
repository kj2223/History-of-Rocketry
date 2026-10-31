// FLAW CURES: a flaw that costs performance (data/programmes.js TRAITS with a statPenalty) can always be cured, but not at once.
// Once the team has found the flaw, they must fly the flawed design FLIGHTS_TO_FIND_CURE more times to work out what causes it, as
// real programmes did. Then the cure can be ordered like a fix: it costs money and a team's time, goes into the design, and
// airframes built (or retrofitted) to it lose the penalty (rules/design.js). A flaw with a failure mode is cured by any fix for
// that mode, from failure analysis or from here (its strongest fix); a flaw with none has a cure of its own.
// A lower stage counts its own flights and keeps its own cures (rules/stages.js). No DOM.
//
// Saved: each bundle's nf (every flight it has flown) and, on each found trait, at (nf when the flaw was found).
import { formatMoney } from '../core/util.js';
import { FAILURE_MODES } from '../data/failures.js';
import { PROGRAMMES, traitByKey, FLIGHTS_TO_FIND_CURE } from '../data/programmes.js';
import { S, log, freeTeams, withProgramme } from '../core/state.js';

// The cure for a flaw: { key: where it sits in the fixes (the mode, or the flaw's key), id, name, cost, time }.
export function cureFor(traitKey) {
  const flaw = traitByKey(traitKey);
  if (flaw.mode) {
    const strongest = FAILURE_MODES[flaw.mode].fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier)[0];
    return { key: flaw.mode, id: strongest.id, name: strongest.name, cost: strongest.cost, time: strongest.time };
  }
  return { key: flaw.key, ...flaw.cure };
}
export const cureCost = (kind, traitKey) => Math.round(cureFor(traitKey).cost * PROGRAMMES[kind].costScale);
// Is this flaw cured in the programme's design (or in the fixes given, such as an airframe's)?
export const isCured = (kind, traitKey, fixes = S.progs[kind].fix) => !!fixes[cureFor(traitKey).key];
// Flights still to fly before the cause is known (0 once it is).
export function flightsToCure(kind, trait) {
  const flown = (S.progs[kind].nf || 0) - (trait.at || 0);
  return Math.max(0, FLIGHTS_TO_FIND_CURE - flown);
}
const cureJob = (kind, traitKey) => S.jobs.find(job => job.k == 'cure' && job.prog == kind && job.m == cureFor(traitKey).key);

// Why the cure cannot be ordered now, or null. Flaws that cost no performance are cured through failure analysis.
export function cureLock(kind, traitKey) {
  const bundle = S.progs[kind], trait = bundle && (bundle.traits || []).find(entry => entry.k == traitKey), flaw = traitByKey(traitKey);
  if (!trait || !trait.found) return 'The flaw has not been found yet.';
  if (!flaw.statPenalty) return 'A fix from failure analysis cures it.';
  if (isCured(kind, traitKey)) return 'Cured.';
  if (cureJob(kind, traitKey)) return 'The cure is under way.';
  const left = flightsToCure(kind, trait);
  if (left) return `Fly the ${PROGRAMMES[kind].name} ${left} more time${left > 1 ? 's' : ''} to find the cause.`;
  if (S.b < cureCost(kind, traitKey)) return `Need ${formatMoney(cureCost(kind, traitKey) - S.b)} more.`;
  if (freeTeams() < 1) return 'No engineering team is free.';
  return null;
}
// The cures the team could order now for a programme, money and teams aside: [{ traitKey, name, cost }].
export const curesReady = kind => ((S.progs[kind] || {}).traits || [])
  .filter(trait => { const lock = cureLock(kind, trait.k); return !lock || /^Need|^No engineering/.test(lock); })
  .map(trait => ({ traitKey: trait.k, name: cureFor(trait.k).name, cost: cureCost(kind, trait.k) }));

export function startCure(kind, traitKey) {
  if (cureLock(kind, traitKey)) return;
  const cure = cureFor(traitKey), cost = cureCost(kind, traitKey);
  S.b -= cost;
  S.jobs.push({ k: 'cure', prog: kind, m: cure.key, f: cure.id, t: cure.time, tot: cure.time });
  log(`[DESIGN] ${PROGRAMMES[kind].name}: ${cure.name} begins, to cure the ${traitByKey(traitKey).name.toLowerCase()} (${formatMoney(cost)}).`, 'wn');
}
// The job's end, inside the programme it was started for (rules/jobs.js finishJob).
export function finishCure(job) {
  S.fix[job.m] = job.f;
  const flaw = traitByKey(job.m) || traitByKey((S.progs[job.prog].traits || []).map(trait => trait.k).find(key => traitByKey(key).mode == job.m));
  log(`[DESIGN] ${PROGRAMMES[job.prog].name}: the ${flaw ? flaw.name.toLowerCase() : 'flaw'} is cured in the design. Airframes built from now on fly without it; older ones need a retrofit.`, 'ok');
}

// EVERY FLIGHT of a programme or stage counts towards finding the cause of its known flaws.
export function countFlight(kind) {
  const bundle = S.progs[kind];
  if (!bundle) return;
  bundle.nf = (bundle.nf || 0) + 1;
  for (const trait of bundle.traits || []) {
    if (!trait.found || !traitByKey(trait.k).statPenalty || isCured(kind, trait.k)) continue;
    if ((trait.at || 0) + FLIGHTS_TO_FIND_CURE == bundle.nf)
      log(`[ENGINEERING] ${PROGRAMMES[kind].name}: the team has traced the ${traitByKey(trait.k).name.toLowerCase()} to its cause. ${cureFor(trait.k).name} would cure it (Design Bureau).`, 'hd');
  }
}
// A cured flaw no longer costs performance: its penalty comes off the rolled design (used by rules/design.js baseDesign).
export function withoutCuredFlaws(design, kind, fixes) {
  const bundle = S.progs[kind];
  if (!fixes || !bundle || !bundle.traits) return design;
  const cured = bundle.traits.map(trait => traitByKey(trait.k)).filter(flaw => flaw.statPenalty && fixes[flaw.mode || flaw.key]);
  if (!cured.length) return design;
  const result = { ...design };
  for (const flaw of cured) for (const stat in flaw.statPenalty) result[stat] /= 1 + flaw.statPenalty[stat];
  return result;
}
// All of a rocket's flaws with a cure to order, its lower stages' too: [{ kind, traitKey, name, cost }].
export const rocketCuresReady = (kind, stages) => [kind, ...stages].flatMap(each => withProgramme(each, () => curesReady(each).map(cure => ({ kind: each, ...cure }))));
