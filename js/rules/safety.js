// THE SAFETY BAR: once Apollo has chosen its architecture, the engineers estimate the failure chance of each part of every
// crew rocket (the Titan II that flies Gemini, the Saturn I), and you set the bar a crewed launch must clear: a target chance of
// reaching orbit, a limit for each component, and how many ground tests each new revision gets. Design and testing are the staff's:
// they run the tests by themselves, one at a time. Each figure is off from the truth, by less with every test, and a confident,
// careless team reads its figures low: each component shows both, what the tests support and the lead's reading. The launch
// director will not fly a crew on a rocket whose reading breaks the bar; you can order the launch anyway, and that is a habit the
// culture remembers (rules/culture.js). The bar never waives man-rating (rules/mercury.js crewLock). No DOM.
//
// S.p2.sb: { tgt: the target chance of reaching orbit, lim: { [component key]: the failure chance allowed }, n: tests per revision,
//            t: { [design key]: tests run }, z: { [design key]: { [component key]: how far off its estimate is, in spreads } },
//            j: the test running, { k: design key, d: days left } or null, w: { [design key]: 1 } tests waived (rules/requests.js),
//            pri: a rocket whose next test goes to the head of the queue, f: { [design key]: tests the team skipped but signed off } }
// A component key is stage:part (part a COMPONENTS key), as 'sat1_si:eng'; a design key is the rocket and its revisions, as 'saturn1@3.2'.
import { formatMoney } from '../core/util.js';
import { PROGRAMMES } from '../data/programmes.js';
import { COMPONENTS, TARGET_SAFETY, TARGET_RANGE, TARGET_STEP, LIMIT_STEP, LIMIT_RANGE, RISK_SAMPLES, ESTIMATE_SPREAD, OPTIMISM, TESTS_PER_REVISION, TESTS_RANGE, TEST_DAYS, TEST_COST_SHARE, CUT_FROM, CUT_CHANCE, LETTER_CHANCE } from '../data/safety.js';
import { S, log, withProgramme, stateGeneration } from '../core/state.js';
import { blueprintConfig } from './production.js';
import { boosterRun } from './flight.js';
import { hasBoosterStage } from './design.js';
import { stagesOf } from './programs.js';
import { apollo } from './apollo.js';
import { riskAppetite, noteHabit } from './culture.js';
import { pressLeak, pressure } from './pressure.js';
import { testFinished } from './requests.js';

// The figures are read by the Chief Engineer's team (Ellis): its own culture, guided by the organisation's (rules/culture.js).
const READER = 'ellis';

export const safetyBar = () => S.p2 && S.p2.sb || null;
const clamp = (value, [low, high]) => Math.min(high, Math.max(low, value));
const round = (value, step) => Math.round(value / step) * step;

// THE CREW ROCKETS: every ready rocket that flies crews in this era, and what it carries.
export const crewRockets = () => Object.keys(S.progs).filter(kind => S.progs[kind].ready && PROGRAMMES[kind] && (PROGRAMMES[kind].needsGemini || PROGRAMMES[kind].needsApollo));
const crewPayload = kind => PROGRAMMES[kind].needsApollo ? 'Apollo Boilerplate' : 'Gemini Spacecraft';
// The rocket's current design, as its published blueprints would build it.
const design = kind => withProgramme(kind, () => ({ prog: kind, ...blueprintConfig(), label: PROGRAMMES[kind].name }));
export const designKey = (kind, airframe) => `${kind}@${airframe
  ? [airframe.rev || 1, ...stagesOf(kind).map(stage => airframe.stg?.[stage]?.rev || 0)].join('.')
  : [kind, ...stagesOf(kind)].map(each => S.progs[each].bp.rev).join('.')}`;
// Its components, bottom stage first: engines and structure for every stage, and staging for each stage above the first.
export const components = kind => [...stagesOf(kind), kind].flatMap((stage, index) => Object.keys(COMPONENTS).filter(part => part != 'sep' || index > 0).map(part => `${stage}:${part}`));
export const componentName = key => {
  const [stage, part] = key.split(':');
  return `${PROGRAMMES[stage].name} ${COMPONENTS[part].name}`;
};
const partOf = mode => Object.keys(COMPONENTS).find(part => COMPONENTS[part].modes.includes(mode));

// THE TRUE FIGURES: the design flown RISK_SAMPLES times with its real failure model, on dice of its own. { [component key]: chance }
const truthCache = new Map();
let cacheGeneration = -1;
const CACHE_LIMIT = 32;
// Include the flight model inputs that can change without a new blueprint.
const riskInputs = (kind, airframe) => JSON.stringify({
  kind, pk: airframe.pk, fix: airframe.fix, rev: airframe.rev, stg: airframe.stg, vr: airframe.vr, fr: S.fr,
  bundles: [kind, ...stagesOf(kind)].map(stage => withProgramme(stage, () => ({
    T: S.progs[stage].T, traits: (S.progs[stage].traits || []).map(trait => trait.k),
    kn: S.progs[stage].kn, okf: S.progs[stage].okf,
    pk: (stage == kind ? airframe.pk : airframe.stg?.[stage]?.pk || []).map(id => [id, S.pk[id]?.a, S.pk[id]?.c]),
  }))),
});
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = text => [...text].reduce((sum, character) => Math.imul(sum ^ character.charCodeAt(0), 16777619), 2166136261);
export function trueRisks(kind, airframe = design(kind)) {
  if (cacheGeneration != stateGeneration) {
    truthCache.clear();
    cacheGeneration = stateGeneration;
  }
  const key = riskInputs(kind, airframe);
  if (truthCache.has(key)) return truthCache.get(key);
  const counts = Object.fromEntries(components(kind).map(component => [component, 0]));
  const gameDice = Math.random;
  Math.random = seeded(hash(key));
  try {
    const fuel = PROGRAMMES[kind].propellants[0], stage = hasBoosterStage(airframe) ? 1 : 0, payload = crewPayload(kind);
    for (let sample = 0; sample < RISK_SAMPLES; sample++) {
      const run = boosterRun(airframe, fuel, stage, { payload });
      if (!run.failure) continue;
      const component = `${run.flight.failStage || kind}:${partOf(run.failure)}`;
      if (component in counts) counts[component]++;
    }
  } finally {
    Math.random = gameDice;
  }
  const risks = Object.fromEntries(Object.entries(counts).map(([component, count]) => [component, count / RISK_SAMPLES]));
  if (truthCache.size >= CACHE_LIMIT) truthCache.delete(truthCache.keys().next().value);
  truthCache.set(key, risks);
  return risks;
}

// Normal-curve roll, from the game's dice: how far off an estimate starts.
const gaussian = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
// THE ESTIMATES for the current design, kept apart as the GDD keeps evidence and interpretation apart (v7.2 §3):
// evidence: { [component key]: chance } as the tests and simulations support it; figures: the same as the lead reads them, low
// by the risk appetite of the team that reads them. tests: ground tests signed off on this revision. Only the tests really run
// (dataSheets) narrow the estimates.
export function estimates(kind, airframe) {
  const bar = safetyBar(), key = designKey(kind, airframe), truth = trueRisks(kind, airframe);
  const offsets = bar.z[key] = bar.z[key] || Object.fromEntries(components(kind).map(component => [component, gaussian()]));
  const tests = bar.t[key] || 0, spread = ESTIMATE_SPREAD / Math.sqrt(1 + dataSheets(kind, airframe)), reading = 1 - OPTIMISM * riskAppetite(READER);
  const evidence = Object.fromEntries(components(kind).map(component => [component, Math.min(1, truth[component] * Math.exp(offsets[component] * spread))]));
  return { tests, evidence, figures: Object.fromEntries(Object.entries(evidence).map(([component, risk]) => [component, risk * reading])) };
}
// The estimated chance a crewed launch reaches orbit: every component holds.
export const estimatedSafety = figures => Object.values(figures).reduce((chance, risk) => chance * (1 - risk), 1);
export const limitFor = key => safetyBar().lim[key] ?? COMPONENTS[key.split(':')[1]].limit;

// THE BAR. Each setter moves by its step within its range; direction is +1 or -1.
export function moveTarget(direction) {
  const bar = safetyBar();
  if (bar) bar.tgt = round(clamp(bar.tgt + direction * TARGET_STEP, TARGET_RANGE), TARGET_STEP);
}
export function moveLimit(key, direction) {
  const bar = safetyBar();
  if (bar) bar.lim[key] = round(clamp(limitFor(key) + direction * LIMIT_STEP, LIMIT_RANGE), LIMIT_STEP);
}
export function moveTests(direction) {
  const bar = safetyBar();
  if (bar) bar.n = clamp(bar.n + direction, TESTS_RANGE);
}

// THE GATE: why the launch director will not fly a crew on this rocket, or null.
export function barVerdict(kind, airframe) {
  const bar = safetyBar();
  if (!bar || !crewRockets().includes(kind)) return null;
  const { figures } = estimates(kind, airframe);
  const over = Object.entries(figures).find(([key, risk]) => risk > limitFor(key));
  if (over) return `its ${componentName(over[0]).toLowerCase()} read ${percentText(over[1])} against a limit of ${percentText(limitFor(over[0]))}`;
  const safety = estimatedSafety(figures);
  return safety < bar.tgt ? `it reads ${percentText(safety)} to orbit against a target of ${percentText(bar.tgt)}` : null;
}
const percentText = chance => `${(chance * 100).toFixed(1)}%`;
// Ground tests still to run on the rocket's current revision (none once you waive them).
const owed = (bar, key) => !(bar.w || {})[key] && (bar.t[key] || 0) < bar.n;
export const testsPending = kind => !!safetyBar() && owed(safetyBar(), designKey(kind));
export const testsWaived = kind => !!safetyBar() && !!(safetyBar().w || {})[designKey(kind)];
// The data sheets on file for the revision: one for every test really run. A test the team signed off without running leaves
// none, and that gap is the trace a careful reader can find (GDD review fix 4).
export const dataSheets = (kind, airframe) => {
  const bar = safetyBar(), key = designKey(kind, airframe);
  return (bar.t[key] || 0) - ((bar.f || {})[key] || 0);
};
// Your order: run this rocket's next ground test before any other, even past the number the bar asks for.
export function queueTest(kind) {
  const bar = safetyBar();
  if (bar) bar.pri = kind;
}
// Your order: throw out every test signed off on the revision and run them again.
export function retest(kind) {
  const bar = safetyBar(), key = designKey(kind);
  if (!bar || !bar.t[key]) return;
  bar.t[key] = 0;
  if (bar.f) delete bar.f[key];
  if (bar.j && bar.j.k == key) bar.j = null;
  S.p2.lt = (S.p2.lt || []).filter(letter => letter.k != kind);
  log(`[NASA] Every ground test on the ${PROGRAMMES[kind].name}'s revision is thrown out and will be run again.`, 'cyan');
}
// A crewed launch ordered over the bar: logged, and remembered by the culture.
export function launchOverBar(kind, verdict, airframe) {
  const cfg = designKey(kind, airframe);
  S.p2.acc = [...(S.p2.acc || []), { d: Math.round(S.day), cfg, ...(airframe ? { af: airframe.id } : {}), t: `a crewed ${PROGRAMMES[kind].name} (${cfg}) launched although ${verdict}` }];
  log(`[NASA] Crewed launch ordered past the safety bar: the ${PROGRAMMES[kind].name} (${cfg}) flies although ${verdict}.`, 'bad');
  noteHabit('override', 1, `a crewed ${PROGRAMMES[kind].name} launched past the safety bar`);
  pressLeak(`NASA flew a crew on the ${PROGRAMMES[kind].name} past its own safety bar`);
}

export const testCost = kind => Math.round(PROGRAMMES[kind].unitCost * TEST_COST_SHARE);
// Each second, with the days that passed: the bar opens with the architecture, and the staff run the ground tests (each one
// a careful habit, rules/culture.js).
// Returns true if anything changed.
export function safetyTick(days) {
  const state = apollo();
  if (!state || !state.arch) return false;
  if (!S.p2.sb) {
    S.p2.sb = { tgt: TARGET_SAFETY, lim: {}, n: TESTS_PER_REVISION, t: {}, z: {}, j: null };
    log('[NASA] With the way to the Moon chosen, every crewed launch must clear a safety bar. Set it in Mail.', 'hd');
    return true;
  }
  const bar = S.p2.sb;
  if (bar.j) {
    bar.j.d -= days;
    if (bar.j.d > 0) return false;
    bar.t[bar.j.k] = (bar.t[bar.j.k] || 0) + 1;
    const name = PROGRAMMES[bar.j.k.split('@')[0]].name;
    log(`[NASA] Ground test ${bar.t[bar.j.k]} of the ${name} complete: its estimates firm up.`, 'cyan');
    // The number of tests is yours to set, so each one run is a habit of yours.
    noteHabit('test', 1, `a ground test of the ${name}`);
    const key = bar.j.k;
    bar.j = null;
    testFinished(key);
    return true;
  }
  const asked = bar.pri && crewRockets().includes(bar.pri) ? bar.pri : null;
  const kind = asked || crewRockets().find(each => owed(bar, designKey(each)));
  if (!kind || S.b < testCost(kind)) return false;
  bar.pri = null;
  if (Math.random() < cutChance()) return cutCorner(kind);
  S.b -= testCost(kind);
  bar.j = { k: designKey(kind), d: TEST_DAYS };
  log(`[NASA] Ground test of the ${PROGRAMMES[kind].name} begins (${formatMoney(testCost(kind))}, about a month).`, 'cyan');
  return true;
}

// CUTTING A CORNER (GDD review fix 4): a bold team under pressure may sign a test off without running it. It comes from risk
// appetite and the pressure on Apollo, never from grievance. The log reads like any other test, but the revision is one data
// sheet short, and sometimes an engineer writes to you about it.
export const cutChance = () => {
  const appetite = riskAppetite(READER), state = pressure();
  if (appetite <= CUT_FROM || !state) return 0;
  return CUT_CHANCE * (appetite - CUT_FROM) / (1 - CUT_FROM) * Math.max(state.press, state.pub, state.cong) / 100;
};
function cutCorner(kind) {
  const bar = safetyBar(), key = designKey(kind), name = PROGRAMMES[kind].name;
  bar.t[key] = (bar.t[key] || 0) + 1;
  bar.f = { ...bar.f, [key]: ((bar.f || {})[key] || 0) + 1 };
  log(`[NASA] Ground test ${bar.t[key]} of the ${name} complete: its estimates firm up.`, 'cyan');
  if (Math.random() < LETTER_CHANCE) {
    S.p2.lt = [...(S.p2.lt || []), { d: Math.round(S.day), k: kind }].slice(-4);
    log(`[NASA] A letter from an engineer on the ${name}: "Test ${bar.t[key]} was signed off, but I never saw it run." (Mail)`, 'wn');
  }
  testFinished(key);
  return true;
}
