// Golden traces for Desk mode's model (js/desk/model.js and its data, js/desk/data.js). record(write) writes
//   desk-data.json      the data module (LOG_FIELDS' read functions as what they read off a sample screen),
//   desk-sessions.json  whole counts played by scripted EECOMs (good, silent, bad, slow, late, random, and a view-like
//                       one on fractional ticks), with the model's state after every step,
//   desk-cases.json     direct cases: count, wall, newDesk, readings and the event lights, writeLog, checkDesk,
//                       toggleLoop, act refusals and verdicts part way through.
// The C# replays them in ad-astra's AdAstra.Rules.Tests/DeskGoldenTests.cs. No Math.sin/log here: all exact.
import * as data from '../../js/desk/data.js';
import {
  newDesk,
  checkDesk,
  leaking,
  readings,
  eventLights,
  tickDesk,
  toggleLoop,
  logDue,
  writeLog,
  callOptions,
  act,
  count,
  wall,
  slip,
  verdict,
  deskWhere,
} from '../../js/desk/model.js';

const { TASKS, LOG_FIELDS, LOG_ROWS, LOOPS } = data;
const clone = x => (x === undefined ? null : JSON.parse(JSON.stringify(x)));

// A small seeded generator for the scripted players' choices (the choices are recorded, so the C# never runs it).
const mulberry = seed => () => {
  let t = (seed = (seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- the data module ------------------------------------------------------------------------------------------------
const SAMPLE = { cabin: 15.5, o2q: [99.1, 98.2], h2q: [97.3, 96.4] };
function dataDump() {
  const out = {};
  for (const [k, v] of Object.entries(data))
    out[k] = k === 'LOG_FIELDS' ? v.map(({ read, ...f }) => ({ ...f, read: read(SAMPLE) })) : clone(v);
  return out;
}

// ---- sessions -------------------------------------------------------------------------------------------------------
const probe = d => ({
  readings: readings(d),
  lights: eventLights(d),
  leaking: leaking(d),
  options: callOptions(d),
  logDue: logDue(d),
  wall: wall(d),
  slip: slip(d),
  count: count(d.t),
  where: deskWhere(d),
});

// The state after a step: everything but the log and the teletype, which only grow, so each step carries what they
// gained (the C# checks the totals too).
function snapshot(d, seen) {
  const { log, tty, ...state } = d;
  const out = {
    state: clone(state),
    log: clone(log.slice(seen.log)),
    tty: clone(tty.slice(seen.tty)),
    logLen: log.length,
    ttyLen: tty.length,
    probe: clone(probe(d)),
  };
  seen.log = log.length;
  seen.tty = tty.length;
  return out;
}

const parts = id => id.split(':');
const right = (k, d) =>
  k === 'leak'
    ? leaking(d)
      ? 'hold'
      : 'good'
    : k === 'poll'
      ? leaking(d)
        ? 'nogo'
        : 'go'
      : k === 'o2'
        ? 'probe'
        : k === 'readup'
          ? 'log'
          : 'good';
const wrongOf = (k, d) =>
  k === 'leak'
    ? leaking(d)
      ? 'good'
      : 'hold'
    : k === 'poll'
      ? leaking(d)
        ? 'go'
        : 'nogo'
      : k === 'o2'
        ? 'hold'
        : k === 'internal'
          ? 'low'
          : k === 'readup'
            ? 'log'
            : 'standby';
const copied = d => Object.fromEntries(LOG_FIELDS.map(f => [f.id, String(f.read(readings(d)))]));
const openAsks = d => {
  const asked = {};
  for (const o of callOptions(d).filter(o => o.answer)) {
    const [k, w] = parts(o.id);
    (asked[k] ??= []).push(w);
  }
  return asked;
};

// Each policy looks at the desk after a tick and returns what to do now: { act }, { toggle } or { write }.
const POLICIES = {
  // As tests/desk.test.js plays it: the log copied off the screen, each task in its window, every answer right.
  good(d) {
    const ops = [];
    if (logDue(d) >= 0) ops.push({ write: copied(d) });
    for (const id of Object.keys(TASKS)) if (!d.tasks[id] && d.t >= TASKS[id].from) ops.push({ act: `task:${id}` });
    for (const k of Object.keys(openAsks(d))) ops.push({ act: `${k}:${right(k, d)}` });
    return ops;
  },
  // Says nothing; answers the poll a minute and a half into the hold it causes (or the count would hold for ever).
  silent(d) {
    if (d.hold?.why === 'poll' && d.clock - d.hold.since >= 90 && !d.asks.poll.answer) return [{ act: 'poll:go' }];
    return [];
  },
  // The wrong answer to everything, tasks too early and then late, the log wrong, calls nobody needed.
  bad(d, s) {
    const ops = [];
    if (!s.loops && d.t >= -9000) ((s.loops = 1), ops.push({ toggle: 'ssr' }, { toggle: 'ag' }, { toggle: 'moon' }));
    const due = logDue(d);
    if (due === 0 && d.t >= -7100) ops.push({ write: { ...copied(d), cabin: '0', o2q2: 'off hi' } });
    if (due === 1 && d.t >= -3500) ops.push({ write: { cabin: copied(d).cabin, o2q1: '1,5', o2q2: '', h2q1: 'x' } });
    for (const id of Object.keys(TASKS)) {
      if (!d.tasks[id] && d.t >= TASKS[id].from - 300 && !s[`early${id}`])
        ((s[`early${id}`] = 1), ops.push({ act: `task:${id}` }));
      if (!d.tasks[id] && d.t > TASKS[id].to + 60) ops.push({ act: `task:${id}` });
    }
    if (!s.hold && d.t >= -8000) ((s.hold = 1), ops.push({ act: 'hold' }));
    if (!s.report && d.t >= -7000) ((s.report = 1), ops.push({ act: 'report:o2' }));
    for (const k of Object.keys(openAsks(d)))
      if (!s[`w${k}`]) (s[`w${k}`] = 1), ops.push({ act: `${k}:${wrongOf(k, d)}` });
    return ops;
  },
  // Stands by first, then the right answer after ninety seconds; the log late at T-2:00 and with commas and OFF HI.
  slow(d, s) {
    const ops = [];
    const due = logDue(d);
    if (due === 0 && d.t >= -7200 + 700) ops.push({ write: copied(d) });
    if (due === 1 && d.t >= -3560) {
      const c = copied(d);
      ops.push({
        write: Object.fromEntries(
          Object.entries(c).map(([k, v]) => [k, Number(v) > 102 ? ' OFF HI ' : `  ${v.replace('.', ',')}  `]),
        ),
      });
    }
    if (due === 2) ops.push({ write: { ...copied(d), h2q2: copied(d).h2q2 + 'e0' } });
    for (const id of Object.keys(TASKS)) if (!d.tasks[id] && d.t > TASKS[id].to + 30) ops.push({ act: `task:${id}` });
    if (d.fault === 'leak' && leaking(d) && d.t >= -6000 && !d.hold && !s.held)
      ((s.held = 1), ops.push({ act: 'hold' }));
    if (d.fault === 'o2' && d.t >= -3500 && !d.sys.o2Called && !s.rep) ((s.rep = 1), ops.push({ act: 'report:o2' }));
    for (const [k, ids] of Object.entries(openAsks(d))) {
      const a = d.asks[k];
      if (ids.includes('standby') && !s[`sb${k}`] && d.t - a.opened >= 20)
        ((s[`sb${k}`] = 1), ops.push({ act: `${k}:standby` }));
      else if (d.t - a.opened >= 90 || k === 'poll') ops.push({ act: `${k}:${right(k, d)}` });
    }
    return ops;
  },
  // Answers well, but calls a plain hold (not leak:hold) while the leak question is open and unanswered.
  holdcall(d, s) {
    const ops = [];
    if (logDue(d) >= 0) ops.push({ write: copied(d) });
    for (const id of Object.keys(TASKS)) if (!d.tasks[id] && d.t >= TASKS[id].from) ops.push({ act: `task:${id}` });
    const leak = d.asks.leak;
    if (leak && !leak.result && d.t - leak.opened >= 10 && !s.held) (s.held = 1), ops.push({ act: 'hold' });
    for (const k of Object.keys(openAsks(d))) if (k !== 'leak' || s.held) ops.push({ act: `${k}:${right(k, d)}` });
    return ops;
  },
  // Answers well, but the log sheet goes wrong once (an object typed into a field), then late twice, and one call to
  // Flight that nobody needed.
  sloppy(d, s) {
    const ops = [];
    const due = logDue(d);
    if (due === 0) ops.push({ write: { ...copied(d), cabin: { psia: 15.6 } } });
    if (due === 1 && d.t >= -3600 + 700) ops.push({ write: copied(d) });
    if (due === 2 && d.t >= -1200 + 650) ops.push({ write: copied(d) });
    for (const id of Object.keys(TASKS)) if (!d.tasks[id] && d.t >= TASKS[id].from) ops.push({ act: `task:${id}` });
    if (!s.rep && d.t >= -8000) (s.rep = 1), ops.push({ act: 'report:o2' });
    for (const k of Object.keys(openAsks(d))) ops.push({ act: `${k}:${right(k, d)}` });
    return ops;
  },
  // Lets the leak check go, then asks for a hold late in the count (the access arm has to come back first).
  late(d, s) {
    const ops = [];
    if (d.t >= -2000 && !s.held) ((s.held = 1), ops.push({ act: 'hold' }));
    if (logDue(d) === 2) ops.push({ write: copied(d) });
    for (const [k] of Object.entries(openAsks(d)))
      if (k !== 'leak' && k !== 'ingress') ops.push({ act: `${k}:${right(k, d)}` });
    return ops;
  },
  // Anything at any time.
  random(d, s, rnd) {
    const ops = [];
    if (rnd() < 0.0015) ops.push({ toggle: ['flight', 'ssr', 'launch', 'ag', 'moon'][Math.floor(rnd() * 5)] });
    if (logDue(d) >= 0 && rnd() < 0.01) {
      const pick = () =>
        ['', '15.6', '99.4', '99,1', 'OFF HI', 'hi', '0x63', '.5', '99.', 'abc', '1e2', ' 99.3 '][
          Math.floor(rnd() * 12)
        ];
      ops.push({ write: rnd() < 0.5 ? copied(d) : Object.fromEntries(LOG_FIELDS.map(f => [f.id, pick()])) });
    }
    const opts = callOptions(d);
    if (opts.length && rnd() < (d.hold?.why === 'poll' ? 0.05 : 0.003))
      ops.push({ act: opts[Math.floor(rnd() * opts.length)].id });
    if (rnd() < 0.0005) ops.push({ act: 'nonsense:id' });
    return ops;
  },
};

// Plays one count. dtOf gives each tick's seconds (the view passes a frame's time times the speed).
// resume: save the desk with JSON.stringify and carry on from JSON.parse of it, at the first step boundary in a hold
// ('hold') or past T-1:20 ('half'). The step index and the saved text go in the golden.
function play({ seed, whatIf, policy, dtOf, name, resume }) {
  let d = newDesk(seed, { whatIf });
  let resumed = null;
  const maybeResume = () => {
    if (!resume || resumed || !(resume === 'hold' ? d.hold : d.t >= -4800)) return;
    const save = JSON.stringify(d);
    d = JSON.parse(save);
    resumed = { at: steps.length, save };
  };
  const rnd = mulberry(seed ^ 0x5eed);
  const mem = {};
  const seen = { log: 0, tty: 0 };
  const steps = [];
  const start = snapshot(d, seen);
  let pend = null;
  const flush = () => {
    if (!pend) return;
    steps.push({ op: 'tick', dt: pend.dt, n: pend.n, ...snapshot(d, seen) });
    pend = null;
    maybeResume();
  };
  let guard = 0;
  while (!d.done && guard++ < 60000) {
    const dt = dtOf ? dtOf(d, rnd, guard) : 1;
    if (pend && pend.dt !== dt) flush();
    const held = !!d.hold,
      asks = Object.keys(d.asks).length;
    tickDesk(d, dt);
    pend ??= { dt, n: 0 };
    pend.n++;
    if (d.done || pend.n * dt >= 900 || !!d.hold !== held || Object.keys(d.asks).length !== asks) flush();
    for (const o of POLICIES[policy](d, mem, rnd)) {
      flush();
      maybeResume();
      if (o.act !== undefined) steps.push({ op: 'act', id: o.act, ret: act(d, o.act), ...snapshot(d, seen) });
      else if (o.toggle !== undefined) {
        toggleLoop(d, o.toggle);
        steps.push({ op: 'toggle', loop: o.toggle, ...snapshot(d, seen) });
      } else
        steps.push({
          op: 'write',
          values: o.write,
          ret: clone(writeLog(d, o.write)),
          ...snapshot(d, seen),
        });
      maybeResume();
    }
  }
  flush();
  if (!d.done) throw new Error(`desk session ${name} never lifted off`);
  if (resume && !resumed) throw new Error(`desk session ${name} never saved`);
  return { name, seed, whatIf, start, steps, ...(resumed ? { resumed } : {}) };
}

// The view's frame times at its speeds: a frame of 1/60 s at 10x, a quarter-second at 240x, and so on.
const viewDt = (d, rnd, i) => {
  const frames = [(1 / 60) * 10, 0.25 * 240, 0.1 * 60, (1 / 60) * 240, 0.016 * 1, 0.25 * 10];
  const k = Math.floor(i / 150) % frames.length;
  return d.t > -60 ? 1 / 60 : frames[k];
};

const SESSIONS = [
  { seed: 11, whatIf: false, policy: 'good' },
  { seed: 7, whatIf: 'leak', policy: 'good', resume: 'hold' },
  { seed: 42, whatIf: 'o2', policy: 'good' },
  { seed: 0, whatIf: 'leak', policy: 'silent' },
  { seed: 1, whatIf: false, policy: 'silent' },
  { seed: 0xffffffff, whatIf: 'o2', policy: 'silent' },
  { seed: 123456789, whatIf: 'leak', policy: 'bad' },
  { seed: 0x7fffffff, whatIf: false, policy: 'bad' },
  { seed: 314159, whatIf: 'o2', policy: 'bad' },
  { seed: 5, whatIf: 'leak', policy: 'slow' },
  { seed: 99, whatIf: 'o2', policy: 'slow' },
  { seed: 2024, whatIf: true, policy: 'late' },
  { seed: 77, whatIf: true, policy: 'random' },
  { seed: 3, whatIf: false, policy: 'random' },
  { seed: 8, whatIf: 'leak', policy: 'random' },
  { seed: 13, whatIf: false, policy: 'good', view: true },
  { seed: 21, whatIf: 'leak', policy: 'slow', view: true, resume: 'hold' },
  { seed: 31, whatIf: 'leak', policy: 'holdcall' },
  { seed: 32, whatIf: false, policy: 'holdcall' },
  { seed: 33, whatIf: false, policy: 'sloppy', resume: 'half' },
  { seed: 34, whatIf: 'o2', policy: 'sloppy' },
  { seed: 8, whatIf: 'leak', policy: 'random', resume: 'half' },
];

// ---- direct cases ---------------------------------------------------------------------------------------------------
const SEEDS = [0, 1, 7, 42, 1945, 123456789, 0x7fffffff, 0x80000000, 0xffffffff, 2 ** 40 + 5, -3];
const T_CASES = [
  0, -0, 0.4, 0.5, -0.5, 0.49999999999999994, 1, -1, -9, -9.5, -59.5, -59.4, 59.5, -599.5, -3599.5, 3599.5, -3600,
  -9600, -9599.5, 86399.5, -86400, 360000, 1e7, 123.456,
];
const CLOCKS = [0, 0.0004, 0.0005, 0.9995, 1, 59.999, 1234.5678, 2400, 86400 * 3.3, 14552880.4, 100000.0001];

function cases() {
  const out = {};
  out.count = T_CASES.map(t => ({ t, text: count(t) }));
  out.wall = CLOCKS.map(clock => ({ clock, wall: wall({ clock }) }));
  out.newDesk = [];
  for (const seed of [...SEEDS, 1.5])
    for (const whatIf of [false, true, 'leak', 'o2', 'bogus'])
      out.newDesk.push({ seed, whatIf, desk: clone(newDesk(seed, { whatIf })) });
  // Readings on hand-set desks: every system state, both faults, around the T-1:00 O2 jump.
  out.readings = [];
  const sysSets = [
    {},
    { suit: 'on' },
    { hatch: 'closed', closedAt: -6300 },
    { hatch: 'closed' },
    { hatch: 'closed', closedAt: -6300, fixed: true },
    { hatch: 'closed', closedAt: -6300, suit: 'on', power: 'internal', batTie: true },
    { power: 'internal' },
    { batTie: true },
    { hatch: 'closed', closedAt: null },
  ];
  let k = 0;
  for (const seed of SEEDS)
    for (const fault of [null, 'leak', 'o2'])
      for (const t of [-9600, -6100, -6050.5, -3601, -3600, -240, 0]) {
        const sys = sysSets[k % sysSets.length];
        const clock = CLOCKS[k % CLOCKS.length] + k * 4;
        k++;
        const d = newDesk(seed, { whatIf: fault ?? false });
        Object.assign(d.sys, sys);
        d.t = t;
        d.clock = clock;
        out.readings.push({ desk: clone(d), readings: readings(d), lights: eventLights(d), leaking: leaking(d) });
      }
  // writeLog: a desk run to a time, then a row written (or not).
  out.writeLog = [];
  const entries = [
    null,
    {},
    { cabin: 15.6, o2q1: 99.4, o2q2: 99.1, h2q1: 99.6, h2q2: 99.3 },
    { cabin: ' 15,6 ', o2q1: '+99.4', o2q2: '99.1e0', h2q1: '.996e2', h2q2: '99.' },
    { cabin: 'OFF HI', o2q1: 'hi', o2q2: 'chip', h2q1: '0x63', h2q2: '0B1100011' },
    { cabin: '', o2q1: 'Infinity', o2q2: '1,000', h2q1: '99,6,1', h2q2: ' 99.3﻿' },
    { cabin: '15.6.1', o2q1: '0o143', o2q2: '1e400', h2q1: true, h2q2: [99, 3] },
    { cabin: '-0', o2q1: '99.99', o2q2: '98.5', h2q1: ' ', h2q2: '\u008599.3' },
    { cabin: { psia: 15.6 }, o2q1: { a: 1 }, o2q2: [], h2q1: [[1, 2], null], h2q2: '1e-400' },
    { cabin: '-1e400', o2q1: '1e-400', o2q2: '0e999', h2q1: '99.6e-0', h2q2: '-99.3' },
  ];
  const times = [-7300, -7200, -7000, -6599, -6500, -3600, -2990, -1200, -100];
  for (const seed of [0, 7, 0xffffffff])
    for (const whatIf of [false, 'o2', 'leak'])
      for (const until of times) {
        const d = newDesk(seed, { whatIf });
        tickDesk(d, until - d.t);
        if (d.hold) continue;
        const due = logDue(d);
        const truthful = copied(d);
        for (const values of [...entries, truthful]) {
          const before = d.logbook ? clone(d.logbook) : null;
          const row = clone(writeLog(d, values));
          out.writeLog.push({ seed, whatIf, until, due, values, row, logDue: logDue(d), logbook: clone(d.logbook) });
          if (before) d.logbook = before;
          else delete d.logbook;
        }
      }
  // Written out of order on a loaded desk: the sheet keeps its rows in time order.
  {
    const d = newDesk(4);
    tickDesk(d, -1200 - d.t);
    d.logbook = { 2: { at: -1200, values: {}, wrong: [], result: 'good' } };
    d.t = -3600;
    out.outOfOrder = {
      desk: clone(d),
      values: copied(d),
      row: clone(writeLog(d, copied(d))),
      logbook: clone(d.logbook),
    };
  }
  // checkDesk on good and bad saves.
  const good = newDesk(9);
  const bad = [
    null,
    5,
    'desk',
    [],
    {},
    { ...good, kind: 'flight' },
    { ...good, mission: 'apollo8' },
    { ...good, seed: 1.5 },
    { ...good, seed: '1' },
    { ...good, seed: 4294967295 },
    { ...good, seed: 1e300 },
    { ...good, t: '0' },
    { ...good, clock: null },
    { ...good, up: 'flight' },
    { ...good, up: ['flight', 'moon'] },
    { ...good, up: [1] },
    { ...good, up: [] },
    { ...good, log: {} },
    { ...good, tty: null },
    { ...good, sys: null },
    { ...good, sys: 'x' },
    { ...good, sys: [] },
    good,
  ].map(x => clone(x));
  out.check = bad.map(desk => {
    try {
      checkDesk(desk);
      return { desk, error: null };
    } catch (e) {
      return { desk, error: e.message };
    }
  });
  // toggleLoop: up and down, past MAX_UP, a loop that does not exist, with lights lit.
  {
    const d = newDesk(2);
    tickDesk(d, 1000);
    const seq = ['ssr', 'ag', 'flight', 'flight', 'moon', 'launch', 'ssr', 'ssr', 'ag', 'launch', 'flight'];
    out.toggle = {
      start: clone(d),
      steps: seq.map(loop => (toggleLoop(d, loop), { loop, up: [...d.up], lights: clone(d.lights) })),
    };
  }
  // act: calls that cannot be made now, and anything once the count is flown.
  {
    const d = newDesk(6);
    const tries = [];
    for (const id of ['', 'leak:good', 'task', 'task:moon', 'poll:go', 'hold:', 'report:o2:x', 'ingress:good'])
      tries.push({ t: d.t, id, ret: act(d, id) });
    tickDesk(d, 1000);
    for (const id of ['ingress:good', 'ingress:good', 'task:cryo', 'hold']) tries.push({ t: d.t, id, ret: act(d, id) });
    tickDesk(d, 20000);
    for (const id of ['poll:go', 'hold', 'task:cryo']) tries.push({ t: d.t, id, ret: act(d, id) });
    tickDesk(d, 20000);
    tries.push({ t: d.t, id: 'write', ret: writeLog(d, {}) });
    tries.push({ t: d.t, id: 'hold', ret: act(d, 'hold') });
    out.act = { seed: 6, tries, end: clone(d) };
  }
  // verdict part way through counts, and on states the sessions do not reach.
  out.verdict = [];
  for (const [seed, whatIf] of [
    [12, 'leak'],
    [14, 'o2'],
    [15, false],
  ])
    for (const until of [-9000, -5000, -2000, -235]) {
      const d = newDesk(seed, { whatIf });
      tickDesk(d, until - d.t);
      out.verdict.push({ seed, whatIf, until, verdict: verdict(d) });
    }
  // tickDesk with nothing to do: zero, negative and NaN seconds.
  {
    const d = newDesk(16);
    for (const s of [0, -5, NaN, 0.5, 0.25]) tickDesk(d, s);
    out.noTick = { seconds: [0, -5, null, 0.5, 0.25], desk: clone(d) };
  }
  return out;
}

export function record(write) {
  write('desk-data.json', dataDump());
  write(
    'desk-sessions.json',
    SESSIONS.map(s =>
      play({
        ...s,
        name: `${s.policy}${s.view ? ' (view)' : ''} seed ${s.seed} ${s.whatIf}${s.resume ? ` saved at ${s.resume}` : ''}`,
        dtOf: s.view ? viewDt : null,
      }),
    ),
  );
  write('desk-cases.json', cases());
}
