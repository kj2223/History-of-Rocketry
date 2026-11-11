// THE PLAYTEST LOG: a bounded diary of a play session, kept beside the save so a bug can be found without describing it.
// It records what the player did and saw (beats, scenes, clicks, decisions, fixes adopted, round outcomes, the faults each
// round rolled, the calls on the loop), both clocks at each turn, every caught error, and the build it ran on. Nothing
// leaves the machine. Knows nothing about the rules: observe() reads the game state it is handed and never changes it.
//
// Shape (version 1), one JSON object:
//   format, version   'ad-astra-playtest-log', 1
//   sessions          one per launch: n, at (ISO time), build {version, commit, packaged, electron, os}, screen, ua
//   events            the timeline, oldest first, at most MAX_EVENTS. Each: t (ms since 1970), s (session n),
//                     d (campaign day), c (minute of the day), r (round id), b (beat), k (kind), then the kind's fields.
//   calls             the radio-loop lines, at most MAX_CALLS, same t/s/d/c/r/b plus who, text
//   errors            caught errors grouped by message and first stack line: count, first and last context, stack
//   marks             the player's F8 "something is wrong here" marks: the context, the clocks, the screenshot's file
// Kinds: start, load, save-rejected, save-failed, newgame, round, beat, scene, speed, checkpoint, click, key, decide,
//   flag, look, fix, outcome, offer, note, resize, slow, mark, toggle.
// Read it back with tools/playtest-report.mjs.
import { SEASON } from '../data/campaign.js';

const roundOf = g => SEASON[g.roundIndex]?.id ?? null;

export const LOG_FORMAT = 'ad-astra-playtest-log';
export const LOG_VERSION = 1;
export const LOG_KEY = 'pa-playtest-log';
export const LIMITS = { events: 2500, calls: 400, errors: 100, marks: 40, sessions: 30, text: 240, data: 1500 };

export const createLog = () => ({
  format: LOG_FORMAT,
  version: LOG_VERSION,
  sessions: [],
  events: [],
  calls: [],
  errors: [],
  marks: [],
});

// A log read back from text. Anything unreadable, or from another version, starts a fresh one: the log is a convenience
// and must never stop the game.
export function parseLog(text) {
  try {
    const log = JSON.parse(text);
    if (log?.format !== LOG_FORMAT || log.version !== LOG_VERSION) return createLog();
    for (const k of ['sessions', 'events', 'calls', 'errors', 'marks']) if (!Array.isArray(log[k])) log[k] = [];
    return log;
  } catch {
    return createLog();
  }
}
export const serializeLog = log => JSON.stringify(log);

const cut = (s, n = LIMITS.text) => {
  s = String(s ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
// Keeps one event's fields small: long strings are cut and anything too big to keep is replaced by its start.
export function clamp(value, room = LIMITS.data) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return cut(value);
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    return '[unreadable]';
  }
  if (text === undefined) return null;
  if (text.length <= room) return JSON.parse(text, (_, v) => (typeof v === 'string' ? cut(v) : v));
  return { cut: true, start: text.slice(0, room) };
}
const push = (list, item, max) => {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
};

// Where the game is, stamped on every entry. g may be missing (before a game starts).
export function where(g) {
  if (!g) return { t: Date.now() };
  return {
    t: Date.now(),
    d: g.day,
    c: Number.isFinite(g.clock) ? Math.round(g.clock * 10) / 10 : g.clock,
    r: roundOf(g),
    b: g.beat,
  };
}

export function startSession(log, info = {}) {
  const n = (log.sessions.at(-1)?.n ?? 0) + 1;
  push(log.sessions, { n, at: new Date().toISOString(), ...clamp(info, 4000) }, LIMITS.sessions);
  log.session = n;
  return n;
}

export function record(log, g, kind, data = {}) {
  const entry = { ...where(g), s: log.session ?? 0, k: kind };
  for (const [key, value] of Object.entries(data)) entry[key] = clamp(value);
  push(log.events, entry, LIMITS.events);
  return entry;
}

// One group per distinct error: the same error each frame is one entry with a count, not thousands.
export function recordError(log, g, kind, message, stack = '') {
  const frame =
    String(stack || '')
      .split('\n')
      .find(l => /at |@/.test(l)) ?? '';
  const key = `${kind}|${cut(message, 160)}|${frame.trim()}`;
  const here = { ...where(g), s: log.session ?? 0 };
  const found = log.errors.find(e => e.key === key);
  if (found) {
    found.count++;
    found.last = here;
    return found;
  }
  const entry = { key, kind, message: cut(message, 600), stack: cut(stack, 1500), count: 1, first: here, last: here };
  push(log.errors, entry, LIMITS.errors);
  return entry;
}

export function recordCall(log, g, line) {
  push(log.calls, { ...where(g), s: log.session ?? 0, who: cut(line.who, 60), text: cut(line.text) }, LIMITS.calls);
}

export function recordMark(log, g, extra = {}) {
  const entry = { ...where(g), s: log.session ?? 0, n: (log.marks.at(-1)?.n ?? 0) + 1, ...clamp(extra, 4000) };
  push(log.marks, entry, LIMITS.marks);
  return entry;
}

// Both clocks at once, so a mismatch between the game's clock and a mission's shows in the log: the campaign day and
// minute, launch control's count or mission clock, and a probe's cruise hours against the minutes since injection.
export function clocks(g) {
  if (!g) return null;
  const out = { day: g.day, clock: Math.round(g.clock * 10) / 10, speed: g.paused ? 0 : g.speed };
  const c = g.console;
  if (c)
    out.console = {
      phase: c.phase ?? null,
      t: Number.isFinite(c.t) ? Math.round(c.t) : null,
      orbitT: Number.isFinite(c.orbitT) ? Math.round(c.orbitT) : null,
      get: Number.isFinite(c.flight?.at) ? Math.round(c.flight.at * 100) / 100 : null,
    };
  const L = g.lunar;
  if (L)
    out.lunar = {
      phase: L.phase,
      h: Number.isFinite(L.h) ? Math.round(L.h * 100) / 100 : null,
      sinceInjectionH: Number.isFinite(L.start) ? Math.round(((g.clock - L.start) / 60) * 100) / 100 : null,
    };
  return out;
}

// What the watcher compares from one look to the next. scene is the caller's description of what is on screen.
function look(g, scene) {
  return {
    round: roundOf(g),
    beat: g.beat,
    scene,
    speed: g.paused ? 0 : g.speed,
    saved: g.savedVersion,
    decided: { ...(g.decided ?? {}) },
    flagged: { ...(g.flagged ?? {}) },
    looked: { ...(g.looked ?? {}) },
    adopted: g.programme?.adopted?.length ?? 0,
    rounds: g.record?.rounds?.length ?? 0,
    offers: g.record?.offers?.length ?? 0,
    notes: g.notes?.at(-1) ?? null,
    noteCount: g.notes?.length ?? 0,
    loop: g.loop?.at(-1) ?? null,
    game: g,
  };
}
const changedKeys = (before, after) =>
  Object.keys(after).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

// Compares the game with the last look and records what changed. Returns the new look, to pass in next time.
// Call it a few times a second; it costs a handful of comparisons.
export function observe(log, g, before, scene = '') {
  if (!g) return before;
  const now = look(g, scene);
  if (!before || before.game !== g) {
    record(log, g, 'newgame', { seed: g.seed, round: now.round, beat: g.beat });
    roundStarted(log, g);
    return now;
  }
  if (now.round !== before.round) roundStarted(log, g);
  if (now.beat !== before.beat) record(log, g, 'beat', { from: before.beat, objective: g.objective });
  if (now.scene !== before.scene) record(log, g, 'scene', { from: before.scene, to: now.scene, clocks: clocks(g) });
  if (now.speed !== before.speed) record(log, g, 'speed', { from: before.speed, to: now.speed });
  if (now.saved !== before.saved) record(log, g, 'checkpoint', { beat: g.saved?.beat, clocks: clocks(g) });
  for (const [kind, field] of [
    ['decide', 'decided'],
    ['flag', 'flagged'],
    ['look', 'looked'],
  ])
    for (const key of changedKeys(before[field], now[field])) record(log, g, kind, { key, value: now[field][key] });
  if (now.adopted > before.adopted)
    for (const cause of g.programme.adopted.slice(before.adopted)) record(log, g, 'fix', { cause });
  if (now.rounds > before.rounds)
    for (const entry of g.record.rounds.slice(before.rounds)) record(log, g, 'outcome', { entry });
  if (now.offers > before.offers)
    for (const offer of g.record.offers.slice(before.offers)) record(log, g, 'offer', { offer });
  if (now.notes && now.notes !== before.notes) {
    const from = g.notes.indexOf(before.notes);
    for (const n of g.notes.slice(from + 1)) record(log, g, 'note', { text: n.text });
  }
  if (now.loop && now.loop !== before.loop) {
    const from = g.loop.indexOf(before.loop);
    for (const line of g.loop.slice(from + 1)) recordCall(log, g, line);
  }
  return now;
}

// A new round: its seed and the hidden faults it rolled, so a strange outcome can be traced to its cause.
function roundStarted(log, g) {
  record(log, g, 'round', {
    id: roundOf(g),
    index: g.roundIndex,
    vehicle: g.vehicle,
    seed: g.seed,
    faults: g.round?.faults ?? null,
    crewed: !!g.crewed,
    clocks: clocks(g),
  });
}
