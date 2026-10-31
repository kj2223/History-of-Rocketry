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
//   rq      work queue: research { id, prog } and records analyses { k: 'inv', id, prog }, started as teams free up (rules/queue.js)
//   air     airframes in the hangar: { id, prog, pk, fix, rev, cost, st: r ready | queued | retro, built, label, hold: 1 if held for your launch }
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
//   auto    the launch director (rules/campaign.js): { xp: flights run, camp: the running campaign, cd: seconds to the next try, last: the last report,
//           inv: an invitation to a first (rules/invitations.js) }
//   dev     the run log: { v, ps: play seconds, fl: flights, ev: events, snap: snapshots }
//   nasa    day NASA was established (0 = not yet) cv      save version
//   recn    payloads recovered (the search teams' experience, rules/recovery.js)
//   p2      Phase Two (Mercury) state (see rules/mercury.js)
//   fy      NASA's yearly budget (see rules/budget.js)
//   cq      construction orders waiting for a crew    mb   mothballed buildings    pt   pads being readied (see rules/site.js)
//   hq      launch-crew hires and releases waiting for the launch under way to end (see rules/launch-site.js)
//   team    the core team's record: Ellis, Vega and Morgan (see rules/team.js)
//   remit   Ellis's engineering remit, or null (see rules/remit.js)
//   lanes   Chen's research lanes, or null (see rules/lanes.js)
//   works   Reed's factory budget, or null (see rules/factory-lead.js)
//   orders  Ellis's standing order and the customers' requests (see rules/orders.js)
//   leads   the research leads you have hired (see rules/leads.js)
//   shared  the shared research line (see rules/shared-research.js)
//   cult    the programme's culture and the team's confidence (see rules/culture.js)
//   ops     Ellis running the Mercury tests, or null (see rules/flight-ops.js)
import { RIVAL, V2_PROGRAMME } from '../data/history.js';
import { BY_ID } from '../data/research.js';

// Soviet dates vary run to run: about 5% early or late in the period, but no more than six weeks either way once the race is close (after day 4590).
export const jitterSovietDate = day => Math.round(day + (Math.random() * 2 - 1) * Math.min(day * .05, day > 4590 ? 45 : 1e9));
// The Soviet dates of a new game. An event that follows another (follows: its id) keeps its historical gap from it rather than
// drawing its own jitter, so adding such events leaves every other roll of the game unchanged.
const sovietDates = () => {
  const dates = {};
  for (const event of RIVAL) if (!event.follows) dates[event.id] = jitterSovietDate(event.day);
  for (const event of RIVAL) if (event.follows) dates[event.id] = dates[event.follows] + event.day - RIVAL.find(other => other.id == event.follows).day;
  return dates;
};

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
  rv: sovietDates(),
  fsd: {}, hist: [], speed: 1, ap: { on: 0, n: 3 }, dev: { v: 1, ps: 0, fl: 0, ev: [], snap: [] }, nasa: 0, cv: 3, pt: {},
  staff: { pr: 0, director: 0, ta: 0 },
  auto: { xp: 0, camp: null, cd: 15, last: null, inv: null },
  team: { n: 0, ok: 0, rev: 0, fix: 0, dir: 0, rec: 0, top: 0, held: 0, watch: [] },
  remit: null,
  lanes: null,
  works: null,
  orders: { o: null, reqs: [], n: 1, due: 0 },
  leads: {},
  shared: { cap: 0, spent: 0, jobs: 0, dry: null, skip: [] },
  cult: { lean: 0, conf: 0, n: 0, tests: 0, ev: [] },
  ops: null,
  v2: { n: 0, ok: 0, hi: 0, next: V2_PROGRAMME.start, ride: null, bump: null },
  corp: null,
  rm: null,
  rmi: null,
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
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    const saved = JSON.parse(raw || 'null');
    if (saved && saved.cv >= 3) {
      Object.assign(S, saved);
      if (!saved.dev) S.dev = { v: 1, ps: 0, fl: 0, ev: [], snap: [] };
      // Saves from before the culture: the crews' confidence starts from the flights the launch director has already run.
      if (!saved.cult) S.cult.conf = Math.min(.6, (S.auto.xp || 0) * .06);
      // Saves from before launch campaigns hold the director's old standing orders: replace them with an empty campaign record.
      if ('on' in S.auto) S.auto = newGameState().auto;
      // Soviet events added since: their dates are set, and those already past by the save's date count as done without a word.
      for (const event of RIVAL) if (!(event.id in S.rv)) {
        S.rv[event.id] = event.follows && S.rv[event.follows] ? S.rv[event.follows] + event.day - RIVAL.find(other => other.id == event.follows).day : jitterSovietDate(event.day);
        if (S.day > S.rv[event.id]) S.rvd[event.id] = 1;
      }
      // Saves from when each rocket had its own standing order: one order now covers every rocket, under their caps combined.
      if (S.orders.by) {
        const old = Object.entries(S.orders.by);
        S.orders.o = old.length ? old.reduce((order, [prog, each]) => ({ ...order, prog: order.prog || prog, cap: order.cap + each.cap, spent: order.spent + each.spent, n: order.n + each.n, okn: order.okn + each.okn, paid: order.paid + each.paid, hold: order.hold || each.hold }), { prog: null, cap: 0, spent: 0, n: 0, okn: 0, paid: 0, hold: null, pk: {}, aside: 0 }) : null;
        delete S.orders.by;
      }
      // Saves from before launch pads that already have an Atlas get its pad, so their next launch is not held up.
      if (!saved.pt && saved.progs && saved.progs.atlas) S.fac.lc14 = 1;
      // Fields added since inside the nested records (S.team, S.orders, S.shared and so on) get their starting values.
      const fresh = newGameState();
      for (const key in fresh) if (isRecord(fresh[key]) && isRecord(S[key])) {
        for (const field in fresh[key]) if (!(field in S[key])) S[key][field] = fresh[key][field];
      }
    }
  } catch (e) {
    // A save that cannot be read is copied aside before the autosave can write over it.
    try { if (raw) localStorage.setItem(SAVE_KEY + '-unreadable', raw); } catch (copyFailed) {}
    log('[SAVE] Your saved game could not be read. A copy is kept under ' + SAVE_KEY + '-unreadable.', 'bad');
  }
};
const isRecord = value => !!value && typeof value == 'object' && !Array.isArray(value);
// A save that fails (storage full, say) is reported once, so play does not go on unsaved without a word.
let saveFailed = false;
export const save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    saveFailed = false;
  } catch (e) {
    if (!saveFailed) log('[SAVE] The game could not be saved. Progress since the last save will be lost if you close it.', 'bad');
    saveFailed = true;
  }
};

// THE LOG. Every line goes to the page (through logSink) and, unless it is routine, to the run log.
// The second argument is a style class: ok, wn (warning), bad, hd (headline), nar (narrative), cyan.
export const logSink = { fn: null };
// Whether a count or a flight is under way, as the launch screen knows it (ui/launch-view.js sets busy). The launch crew and the
// consoles change only between launches.
export const launchInProgress = { busy: () => false };
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
// Money coming in other than the appropriation: rewards, contracts, refunds. NASA's budget counts it (rules/budget.js).
export const earn = amount => {
  S.b += amount;
  if (S.fy) S.fy.inc += amount;
};

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
