// GAME STATE
// The one game-state object S, saving and loading, and the log. No DOM: the UI sets logSink.fn to show log lines.
//
// The field names below are the save format, so they stay short: renaming one would break existing saves.
// What each field holds:
//
//   b       budget in dollars                     day     game day, counted from 1 Jan 1946 (360-day years)
//   rep     reputation, 0 to 100                  dir     Phase One directives met (index of the current one)
//   hi      altitude record (m)                   hs      speed record (m/s)
//   hd      downrange record (m)                  pb      science bonus added to every grant
//   progs   rocket programmes, by kind: each is a bundle (see newBundle)
//   cur     the programme in focus (a key of progs)
//   g       the global bundle: research that belongs to no rocket (recovery, Mercury spacecraft, escape & man-rating)
//   jobs    engineering-team jobs: { k: kind, id, prog, t: seconds left, tot: seconds in all, free: needs no team }
//           kinds: pk research package, inv investigation, fix corrective fix, rev design review,
//                  gt ground test, retro hangar retrofit, dev programme design
//   teams   engineering teams                      bteams  factory build teams (missing means 1)
//   rq      research queue: [{ id, prog }], started in order as teams free up (rules/research.js)
//   air     airframes in the hangar: { id, prog, pk, fix, rev, cost, st: r ready | queued | retro, built, label }
//   aq      factory queue: { k: build | retro | msn, prog, cfg, cost, t: work left, tot: work in all, ... }
//   fac     facilities in service, { id: 1 }       fb      facilities under construction, { id: day in service }
//   crew    launch-crew stations staffed, { id: 1 } staff   { pr, director, ta }: specialists hired
//                                                  (ta: trajectory analysts, a count; rules/trajectory.js)
//   nid     next airframe id                       prod    airframes produced
//   ok      successful flights                     fr      successful flights per propellant
//   gt      seconds until the next appropriation   sg      1 once the starter airframe has been given
//   fs      historical firsts, { id: 'us' | 'them' | 'second' }   fsd   day each first was claimed
//   rv      day each Soviet event happens (jittered per game)    rvd   Soviet events that have happened
//   hist    programme history for the summaries: [{ d: day, t: text }]
//   speed   time speed (0 paused, 1, 2, 4)          ap      auto-publish: { on, n: changes that trigger it }
//   auto    the launch director: { xp: flights run, camp: the running campaign, cd: seconds to the next try, last: the last report }
//           (rules/campaign.js)
//   dev     the run log: { v, ps: play seconds, fl: flights, ev: events, snap: snapshots }
//   nasa    day NASA was established (0 = not yet) cv      save version
//   recn    payloads recovered (the search teams' experience, rules/recovery.js)
//   p2      Phase Two (Mercury) state (see rules/mercury.js)
import { RIVAL } from '../data/history.js';
import { BY_ID } from '../data/research.js';

// Soviet dates vary run to run: about 5% early or late in the period, but no more than six weeks either way once the race is close (after day 4590).
export const jitterSovietDate = day => Math.round(day + (Math.random() * 2 - 1) * Math.min(day * .05, day > 4590 ? 45 : 1e9));

// ROCKET PROGRAMMES: each rocket keeps its own research, blueprint, fixes, incidents, knowledge, production line and man-rating.
// Payload & recovery work and the Mercury spacecraft are not part of any rocket: they live in the global bundle S.g.
export const GLOBAL_AREAS = ['r', 'c', 'e'];

// A bundle: everything one programme (or the global bundle) knows and owns.
//   pk     research packages done, { id: { a: true effect, c: 1 once confirmed, m: measured effect, dud } }
//   bt     breakthroughs reached, { area: 1, area + '2': 1 for the second milestone }
//   fix    corrective fixes in the design, { failure mode: fix id }
//   inc    incidents (failures and design-review findings)
//   known  failure modes the team has diagnosed, { mode: 1 }
//   kn     team knowledge per area, 0 to 100
//   ear    Congress's earmarked money per area
//   bp     the published blueprint: { rev, pk: package ids, fix }
//   line   the production line: { xp: units built to the current blueprint }
//   mrate  man-rating record (rules/manrate.js)
// A rocket programme's bundle also has kind, start, T (true design), bias, traits, ready, matured and okf (successful flights) (rules/programs.js).
export const newBundle = () => ({ pk: {}, bt: {}, fix: {}, inc: [], known: {}, kn: {}, ear: {}, bp: { rev: 1, pk: [], fix: {} }, line: { xp: 0 }, mrate: null });

export const newGameState = () => ({
  b: 60000, day: 0, rep: 100, dir: 0, hi: 0, pb: 0, progs: {}, cur: null, g: newBundle(), jobs: [], rq: [], teams: 2, air: [], aq: [], fac: {},
  nid: 1, prod: 0, ok: 0, fr: {}, gt: 30, sg: 0, hs: 0, hd: 0, crew: {}, fs: {}, rvd: {},
  rv: Object.fromEntries(RIVAL.map(event => [event.id, jitterSovietDate(event.day)])),
  fsd: {}, hist: [], speed: 1, ap: { on: 0, n: 3 }, dev: { v: 1, ps: 0, fl: 0, ev: [], snap: [] }, nasa: 0, cv: 3,
  staff: { pr: 0, director: 0, ta: 0 },
  auto: { xp: 0, camp: null, cd: 15, last: null },
});

export const S = newGameState();

// The bundle of the programme in focus (or the global bundle when there is none).
// Everything that reads S.pk, S.bp, S.fix and so on sees this bundle.
export const focusedBundle = () => S.progs[S.cur] || S.g;

// Run fn with another programme in focus (a flight of an older rocket, a job started under another programme).
export function withProgramme(id, fn) {
  if (!id || id == S.cur || !S.progs[id]) return fn();
  const previous = S.cur;
  S.cur = id;
  try {
    return fn();
  } finally {
    S.cur = previous;
  }
}

// SPLIT FIELDS: S.pk, S.bt, S.kn and S.ear mix two bundles. Keys for research areas r, c and e (and their tier-2 flags)
// go to the global bundle; everything else goes to the programme in focus.
const isGlobalAreaKey = key => typeof key == 'string' && GLOBAL_AREAS.includes(key[0]) && (key.length == 1 || key[1] == '2');
const isGlobalPackage = key => typeof key == 'string' && BY_ID[key] && GLOBAL_AREAS.includes(BY_ID[key].area);

// A view of one field that sends each key to the right bundle.
function splitField(name, isGlobal) {
  const side = key => isGlobal(key) ? S.g[name] : focusedBundle()[name];
  return new Proxy({}, {
    get: (target, key) => typeof key == 'symbol' ? undefined : side(key)[key],
    set: (target, key, value) => { side(key)[key] = value; return true; },
    has: (target, key) => key in side(key),
    deleteProperty: (target, key) => { delete side(key)[key]; return true; },
    ownKeys: () => [...new Set([...Object.keys(focusedBundle()[name]), ...(focusedBundle() == S.g ? [] : Object.keys(S.g[name]))])],
    getOwnPropertyDescriptor: (target, key) => {
      const bundle = side(key);
      return key in bundle ? { value: bundle[key], enumerable: true, configurable: true, writable: true } : undefined;
    },
  });
}
const SPLIT_FIELDS = { pk: splitField('pk', isGlobalPackage), bt: splitField('bt', isGlobalAreaKey), kn: splitField('kn', isGlobalAreaKey), ear: splitField('ear', isGlobalAreaKey) };
for (const name in SPLIT_FIELDS) Object.defineProperty(S, name, { get: () => SPLIT_FIELDS[name], set: () => {}, enumerable: false, configurable: true });
// These fields belong wholly to the programme in focus.
for (const name of ['bp', 'fix', 'inc', 'known', 'line', 'mrate']) {
  Object.defineProperty(S, name, { get: () => focusedBundle()[name], set: value => { focusedBundle()[name] = value; }, enumerable: false, configurable: true });
}

// SAVING. The save lives in the browser's localStorage under one key.
function replaceState(next) {
  for (const key of Object.keys(S)) delete S[key];
  Object.assign(S, next);
}
const SAVE_KEY = 'vg3';
export const resetState = () => {
  replaceState(newGameState());
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
};
// Saves from before version 3 are ignored (a fresh game starts). Older version-3 saves get any fields added since.
export const load = () => {
  replaceState(newGameState());
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && saved.cv >= 3) {
      Object.assign(S, saved);
      if (!saved.dev) S.dev = { v: 1, ps: 0, fl: 0, ev: [], snap: [] };
      // Saves from before launch campaigns hold the director's old standing orders: replace them with an empty campaign record.
      if ('on' in S.auto) S.auto = newGameState().auto;
      for (const event of RIVAL) if (!(event.id in S.rv)) S.rv[event.id] = jitterSovietDate(event.day);
    }
  } catch (e) {}
};
export const save = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
};

// THE LOG. Every line goes to the page (through logSink) and, unless it is routine, to the run log.
// The second argument is a style class: ok, wn (warning), bad, hd (headline), nar (narrative), cyan.
export const logSink = { fn: null };
const RUN_LOG_LIMIT = 5000;
// Routine lines the run log skips: flight readouts, money, dispatches, analysis and banners.
const ROUTINE_LINE = /^(T\+|\[FISCAL\]|\[PAYROLL\]|\[DISPATCH\]|\[ANALYSIS\]|=== |--- )/;
// RUN LOG (development): every notable log line and flight, stamped with play time (ps, seconds of game clock) and game day.
export const recordRunEvent = details => {
  const runLog = S.dev;
  if (!runLog) return;
  runLog.ev.push({ t: runLog.ps, d: Math.round(S.day), ...details });
  if (runLog.ev.length > RUN_LOG_LIMIT) runLog.ev.splice(0, runLog.ev.length - RUN_LOG_LIMIT);
};
// Headlines and Soviet news drop the time speed back to 1x so the player sees them.
export const log = (text, style = '') => {
  if (logSink.fn) logSink.fn(text, style);
  if (S.speed > 1 && (style == 'hd' || /^\[WIRE\]/.test(text))) S.speed = 1;
  if (!ROUTINE_LINE.test(text)) recordRunEvent({ m: text });
};

// DATES: 30-day months, 360-day years from January 1946.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatDate = day => `${MONTHS[Math.floor(day % 360 / 30) % 12]} ${1946 + Math.floor(day / 360)}`;
export const today = () => formatDate(S.day);

// Programme history for the end-of-phase summaries. Keeps the latest 80 entries.
export const addHistory = text => {
  S.hist.push({ d: S.day, t: text });
  if (S.hist.length > 80) S.hist.shift();
};

// Common questions about the state.
export const isResearched = id => !!S.pk[id];
export const isConfirmed = id => !!(S.pk[id] && S.pk[id].c);
export const freeTeams = () => S.teams - S.jobs.filter(job => !job.free).length;
export const findJob = test => S.jobs.find(test);
