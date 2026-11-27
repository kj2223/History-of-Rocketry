// Golden traces for Management mode's model (js/manage: everything but the drawing). record(write) writes
// manage-direct.json (each function on its own, case by case) and manage-play.json (whole Management years played by
// scripted choices, the full game after every step). The C# replays them in ad-astra's
// AdAstra.Rules.Tests/ManageDirectGoldenTests.cs and ManagePlayGoldenTests.cs.
//
// The base view (js/manage/view.js) holds the day's loop inside startBaseView, behind the DOM. The session below is a
// line-for-line copy of that loop (newDay, runEmergency, jump, the click and slider handlers); every play is also run
// through the real startBaseView on a stub DOM, and the recorder stops if the two games ever differ, so the copy is
// checked against the view and the C# is checked against the copy.
import { dayOf, dateLabel } from '../../js/core/calendar.js';
import {
  START_DAY,
  SECONDS_PER_DAY,
  SPEEDS,
  newManagement,
  checkManagement,
  managementWhere,
} from '../../js/manage/state.js';
import { SIZE, coast, PREFABS, CAPE_1958_BASE, CAPE_1958_ROADS, buildingAt } from '../../js/manage/base.js';
import {
  fiscalYear,
  recordFactor,
  appropriation,
  lines,
  resplit,
  money,
  DEFAULT_SPLIT,
} from '../../js/manage/budget.js';
import {
  PLOTS,
  BUILDS,
  UPGRADES,
  baseOf,
  padsOf,
  openPlots,
  buildNeed,
  buildCover,
  startBuilding,
  startFitting,
  advanceBuilding,
  checkBuilding,
} from '../../js/manage/build.js';
import { stageOf, wallsAt, HEIGHT, STAGES } from '../../js/manage/construction.js';
import {
  emergencyToday,
  startEmergency,
  orderCrew,
  onPad,
  tickEmergency,
  emergencyCost,
  endEmergency,
  ORDER,
} from '../../js/manage/emergency.js';
import { CAPE_1958, PAD_KINDS } from '../../js/manage/manifest.js';
import { flightOutcome, report } from '../../js/manage/outcome.js';
import { POSTS, postOpen, candidate, staffing } from '../../js/manage/people.js';
import {
  SOVIET_FIRSTS,
  initPressure,
  watched,
  announce,
  settle,
  news,
  standingFactor,
  combined,
  standingText,
  checkPressure,
} from '../../js/manage/pressure.js';
import {
  PROGRAMMES,
  programmesOf,
  allFlights,
  planFor,
  programmeSchedule,
  commitOpen,
  needed,
  funding,
  advanceProgrammes,
  canStop,
  setProgramme,
  checkProgrammes,
} from '../../js/manage/programmes.js';
import {
  padFits,
  turnaround,
  inWindow,
  schedule,
  opening,
  nextFlight,
  gameSchedule,
} from '../../js/manage/schedule.js';
import {
  nightOf,
  hourOf,
  easeNight,
  movers,
  windowPixels,
  rolloutRoute,
  alongRoute,
  rolloutsOn,
} from '../../js/manage/life.js';
import { tileAt, ART } from '../../js/manage/paint.js';
import { standsOn, flyDue, recordLine, startBaseView } from '../../js/manage/view.js';

const clone = x => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
const SEEDS = [0, 1, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
// The error a call throws, or null; and its value.
const tryIt = f => {
  try {
    return { out: clone(f()), error: null };
  } catch (e) {
    return { out: null, error: e.message };
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// THE SESSION: view.js startBaseView's model, without the drawing. Mirrors it line for line.
const FY = fy => (fy === 'TQ' ? 'the transition quarter, 1976' : `fiscal ${fy}`);

class Session {
  constructor(game) {
    this.game = game;
    this.base = baseOf(game);
    this.sched = programmeSchedule(game, START_DAY);
    this.log = [];
    this.speed = 1;
    this.paused = false;
    this.pick = null;
    this.saves = 0;
    this.ensureBudget();
    const caught = flyDue(game, this.sched, game.day);
    if (caught.length) {
      this.log.push(...caught);
      this.sched = programmeSchedule(game, START_DAY);
      this.save();
    }
    commitOpen(game, this.sched);
  }
  save() {
    this.saves++;
  }
  ensureBudget() {
    const game = this.game;
    game.split ??= { ...DEFAULT_SPLIT };
    game.heads ??= {};
    if (!game.budget || game.day > game.budget.end) {
      game.budget = appropriation(game.day, START_DAY, game.flown, game.pressure?.standing);
      return true;
    }
    return false;
  }
  newDay() {
    const game = this.game,
      log = this.log;
    game.day += 1;
    log.push(...news(game));
    log.push(...flyDue(game, this.sched, game.day));
    const year = this.ensureBudget();
    log.push(...advanceProgrammes(game, game.budget, START_DAY));
    const finished = advanceBuilding(game, game.budget, START_DAY);
    if (finished.length) {
      log.push(...finished);
      this.base = baseOf(game);
    }
    this.sched = programmeSchedule(game, START_DAY);
    commitOpen(game, this.sched);
    const incident = emergencyToday(game, standsOn(this.sched, this.base, game.day));
    if (incident) {
      log.push(startEmergency(game, this.base, incident));
      this.speed = 1;
      this.pick = null;
    }
    const launch = this.sched.flights.find(f => f.launch === game.day);
    if (launch && this.speed > 1) {
      this.speed = 1;
      log.push(`Slowed to 1× for ${launch.name}’s launch today.`);
    }
    if (year)
      log.push(
        `${FY(game.budget.fy)[0].toUpperCase()}${FY(game.budget.fy).slice(1)} begins: Congress gives the centre ${money(game.budget.total)}.`,
      );
    this.save();
  }
  runEmergency(minutes) {
    const game = this.game;
    if (!game.emergency) return;
    const before = game.emergency.t;
    this.log.push(...tickEmergency(game, this.base, minutes));
    if (game.emergency.done) {
      this.log.push(...endEmergency(game, this.base, this.sched.flights));
      this.sched = programmeSchedule(game, START_DAY);
      this.pick = null;
      this.save();
    } else if (Math.floor(game.emergency.t / 5) > Math.floor(before / 5)) this.save();
  }
  jump(n) {
    for (let i = 0; i < n; i++) {
      let guard = 0;
      while (this.game.emergency && guard++ < 600) this.runEmergency(1);
      this.newDay();
    }
  }
  emergency(kind = 'leak') {
    const s = standsOn(this.sched, this.base, this.game.day).find(x => x.flight.launch !== this.game.day);
    if (!s || this.game.emergency) return false;
    this.log.push(startEmergency(this.game, this.base, { kind, pad: s.pad.id, flight: s.flight.id }));
    this.speed = 1;
    return true;
  }
  order(crew, to = 'pad') {
    return orderCrew(this.game, this.base, crew, to);
  }
  // el.onclick, for the buttons that change the game (and the speed buttons).
  click(d) {
    const game = this.game;
    if (d.act === 'crew') {
      orderCrew(game, this.base, d.crew, d.to);
      this.pick = null;
    }
    if (d.act === 'build-on' || d.act === 'fit') {
      const line = d.act === 'fit' ? startFitting(game, d.pad, d.slot) : startBuilding(game, d.plot, d.what);
      if (line) {
        this.log.push(line);
        this.save();
      }
    }
    if (d.act === 'programme') {
      const line = setProgramme(game, d.id, d.to);
      if (line) {
        this.log.push(line);
        this.sched = programmeSchedule(game, START_DAY);
        this.save();
      }
    }
    if (d.act === 'appoint') {
      game.heads = { ...game.heads, [d.post]: d.who };
      this.log.push(`${candidate(d.post, d.who).name} takes up the post.`);
      this.save();
    }
    if (d.act === 'announce') {
      const f = this.sched.flights.find(x => x.id === d.id),
        line = f && announce(game, f);
      if (line) {
        this.log.push(line);
        this.save();
      }
    }
    if (d.act === 'vacate') {
      const { [d.post]: gone, ...rest } = game.heads;
      game.heads = rest;
      this.save();
    }
    if (d.speed) {
      this.speed = Number(d.speed);
      this.paused = false;
    }
  }
  // The budget sliders.
  slide(line, value) {
    this.game.split = resplit(this.game.split, line, Number(value));
    this.save();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// THE REAL VIEW on a stub DOM: anything it asks the page for is a do-nothing stand-in; the root element keeps the click
// and input handlers so the plays can press the same buttons.
function stubDom() {
  const S = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : S),
    set: () => true,
    apply: () => S,
    construct: () => S,
  });
  const g = globalThis;
  for (const k of ['document', 'localStorage', 'matchMedia', 'window', 'innerWidth', 'innerHeight', 'devicePixelRatio'])
    Object.defineProperty(g, k, { value: S, configurable: true, writable: true });
  g.requestAnimationFrame = () => 0;
  const handlers = {};
  const el = new Proxy(
    {},
    {
      get: (t, k) =>
        k === 'onclick'
          ? t.onclick
          : k === 'addEventListener'
            ? (type, h) => (handlers[type] = h)
            : k === Symbol.toPrimitive
              ? () => 0
              : S,
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    },
  );
  return { el, handlers, target: o => o };
}

class RealView {
  constructor(game) {
    this.game = game;
    this.dom = stubDom();
    this.saves = 0;
    this.v = startBaseView(this.dom.el, game, { save: () => this.saves++, back: () => {} });
  }
  jump(n) {
    this.v.jump(n);
  }
  runEmergency(m) {
    this.v.runEmergency(m);
  }
  emergency(kind) {
    return this.v.emergency(kind);
  }
  order(crew, to) {
    return this.v.order(crew, to);
  }
  click(d) {
    this.dom.el.onclick({ target: { closest: () => ({ dataset: d }) } });
  }
  slide(line, value) {
    this.dom.handlers.input({ target: { dataset: { line }, value: String(value) } });
  }
  get speed() {
    return this.v.state.speed;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PLAYS. A play is a seed and a script; the script decides each step from the session, as a player would.
const CREWS_OF = { steady: ORDER, fire: ['fire'], book: ['safety', 'pad'], none: [] };

// As tools/autoplay/run.mjs playManagement: a week a day at a time, any pad emergency met with the bot's crews and run
// for 120 minutes; each quarter the panels, appointing the first candidate for the first open post and (after the
// first week) building the first thing on the first open plot.
function* driverScript(s, { years, crews }) {
  const weeks = Math.round(years * 52);
  for (let w = 1; w <= weeks; w++) {
    for (let d = 0; d < 7; d++) {
      yield ['jump', 1];
      if (s.game.emergency) {
        for (const c of crews) yield ['order', c, 'pad'];
        yield ['runEmergency', 120];
      }
    }
    if (w % 13 === 1) {
      const open = staffing(s.game.heads, s.game.day, [...s.sched.flown, ...s.sched.flights]).find(
        p => p.open && !p.head,
      );
      if (open) yield ['click', { act: 'appoint', post: open.id, who: open.candidates[0].id }];
      const plot = openPlots(s.game)[0];
      if (w > 1 && plot) yield ['click', { act: 'build-on', plot: plot.id, what: plot.kinds[0] }];
    }
  }
}

// A player who makes other choices: moves money, starts and stops programmes, announces dates, builds and fits, swaps
// heads, plays the speed buttons, and meets emergencies by hand (crews one at a time, one called back).
function* chooserScript(s, { days }) {
  const g = () => s.game;
  yield ['click', { speed: '16' }];
  yield ['click', { act: 'appoint', post: 'launch', who: 'marsh' }];
  yield ['click', { act: 'appoint', post: 'deputy', who: 'reyes' }];
  yield ['click', { act: 'appoint', post: 'safety', who: 'kerrigan' }];
  yield ['click', { act: 'appoint', post: 'flight', who: 'carver' }]; // not open yet: the view lets it through
  yield ['click', { act: 'vacate', post: 'flight' }];
  yield ['click', { act: 'vacate', post: 'nobody' }];
  yield ['slide', 'building', 35];
  yield ['click', { act: 'programme', id: 'tiros', to: 'running' }];
  yield ['click', { act: 'programme', id: 'tiros', to: 'slowed' }];
  yield ['click', { act: 'programme', id: 'mercury-redstone', to: 'slowed' }]; // cannot start slowed
  yield ['click', { act: 'programme', id: 'explorer', to: 'stopped' }]; // not before Explorer 6
  yield ['click', { act: 'programme', id: 'vanguard', to: 'slowed' }];
  yield ['click', { act: 'programme', id: 'nothing', to: 'running' }];
  yield ['click', { act: 'build-on', plot: 'lc-34', what: 'redstone' }];
  yield ['click', { act: 'build-on', plot: 'lc-34', what: 'thor' }]; // taken now
  yield ['click', { act: 'build-on', plot: 'hangar-ae', what: 'atlas' }]; // not allowed there
  yield ['click', { act: 'build-on', plot: 'hangar-ae', what: 'hangar' }];
  yield ['click', { act: 'fit', pad: 'lc-5', slot: 'tower' }];
  yield ['click', { act: 'fit', pad: 'lc-5', slot: 'tower' }]; // already being fitted
  yield ['click', { act: 'fit', pad: 'lc-17a', slot: 'deflector' }];
  yield ['click', { act: 'fit', pad: 'hangar-s', slot: 'tower' }]; // not a pad
  yield ['click', { act: 'fit', pad: 'lc-14', slot: 'nothing' }];
  for (const f of s.sched.flights.slice(0, 4)) yield ['click', { act: 'announce', id: f.id }];
  yield ['click', { act: 'announce', id: 'pioneer-1' }]; // twice
  yield ['click', { act: 'announce', id: 'no-such-flight' }];
  let forced = 0;
  for (let d = 1; d <= days; d++) {
    yield ['jump', 1];
    if (d % 3 === 0 && s.speed === 1) yield ['click', { speed: d % 2 ? '4' : '16' }];
    // Now and then force an emergency, as the view's test hook does, and handle it by hand.
    if (!g().emergency && d % 97 === 40 && forced < 4) {
      yield ['emergency', forced % 2 ? 'fire' : 'leak'];
      forced++;
    }
    if (g().emergency) {
      const e = g().emergency;
      if (forced % 2) {
        yield ['click', { act: 'crew', crew: 'safety', to: 'pad' }];
        yield ['runEmergency', 1.5];
        yield ['order', 'fire', 'pad'];
        yield ['runEmergency', 2.25];
        yield ['order', 'safety', 'home'];
        yield ['runEmergency', 3];
        yield ['order', 'pad', 'pad'];
        yield ['order', 'nobody', 'pad'];
      } else if (e.kind === 'fire') {
        yield ['order', 'fire', 'pad'];
        yield ['order', 'pad', 'pad'];
      }
      yield ['runEmergency', 7.3];
      yield ['runEmergency', 200];
    }
    if (d === 20) yield ['slide', 'programmes', 25]; // the Programmes line short: dates slip
    if (d === 75) yield ['slide', 'programmes', 70];
    if (d === 60) yield ['click', { act: 'programme', id: 'vanguard', to: 'running' }];
    if (d === 90) yield ['click', { act: 'programme', id: 'pioneer', to: 'stopped' }];
    if (d === 130) yield ['click', { act: 'programme', id: 'pioneer', to: 'running' }];
    if (d === 150) yield ['click', { act: 'programme', id: 'mercury-redstone', to: 'running' }];
    if (d === 200) yield ['slide', 'staff', 0];
    if (d === 210) yield ['slide', 'building', 3];
    if (d === 240) yield ['click', { act: 'fit', pad: 'lc-5', slot: 'umbilical' }];
    if (d === 250) yield ['click', { act: 'build-on', plot: 'lc-12', what: 'atlas' }];
    if (d === 270) yield ['click', { act: 'programme', id: 'tiros', to: 'stopped' }];
    if (d === 300) yield ['click', { act: 'programme', id: 'explorer', to: 'stopped' }];
    if (d % 45 === 10) {
      const f = s.sched.flights.find(x => x.launch > g().day + 3 && !g().pressure?.announced?.[x.id]);
      if (f) yield ['click', { act: 'announce', id: f.id }];
    }
    if (d % 60 === 30) {
      const open = staffing(g().heads, g().day, [...s.sched.flown, ...s.sched.flights]).find(p => p.open && !p.head);
      if (open) yield ['click', { act: 'appoint', post: open.id, who: open.candidates[2].id }];
    }
    if (d === 320) yield ['click', { act: 'vacate', post: 'launch' }];
  }
}

// Money starved: no Programmes line and no Building line, with works and fittings under way, past a fiscal year's end.
function* starvedScript(s, { days }) {
  yield ['click', { act: 'build-on', plot: 'lc-19', what: 'atlas' }];
  yield ['click', { act: 'fit', pad: 'lc-14', slot: 'tower' }];
  yield ['slide', 'programmes', 0];
  yield ['slide', 'building', 0];
  yield ['click', { act: 'programme', id: 'tiros', to: 'running' }];
  for (let d = 1; d <= days; d++) {
    yield ['jump', 1];
    if (s.game.emergency) yield ['runEmergency', 120];
    if (d === 200) yield ['slide', 'building', 100];
    if (d === 260) yield ['slide', 'programmes', 50];
  }
}

const PLAYS = [
  { name: 'driver-steady', seed: 0, script: s => driverScript(s, { years: 1, crews: CREWS_OF.steady }) },
  { name: 'driver-fire', seed: 42, script: s => driverScript(s, { years: 1, crews: CREWS_OF.fire }) },
  { name: 'driver-book', seed: 0xffffffff, script: s => driverScript(s, { years: 1, crews: CREWS_OF.book }) },
  { name: 'driver-none', seed: 1945, script: s => driverScript(s, { years: 1, crews: CREWS_OF.none }) },
  {
    name: 'driver-long',
    seed: 123456789,
    every: 7,
    script: s => driverScript(s, { years: 3, crews: CREWS_OF.steady }),
  },
  { name: 'chooser', seed: 1, script: s => chooserScript(s, { days: 400 }) },
  { name: 'chooser-b', seed: 7, script: s => chooserScript(s, { days: 400 }) },
  { name: 'starved', seed: 314159, every: 3, script: s => starvedScript(s, { days: 420 }) },
];

const apply = (target, step) => {
  const [what, ...args] = step;
  return target[what](...args);
};

function play({ name, seed, script, every = 1 }) {
  const game = newManagement(seed),
    twin = newManagement(seed);
  const s = new Session(game),
    v = new RealView(twin);
  const same = where => {
    const a = JSON.stringify(game),
      b = JSON.stringify(twin);
    if (a !== b) throw new Error(`manage.mjs: the session copy and view.js differ in ${name} at ${where}\n${a}\n${b}`);
    if (s.saves !== v.saves) throw new Error(`manage.mjs: saves differ in ${name} at ${where}: ${s.saves} ${v.saves}`);
    if (s.speed !== v.speed) throw new Error(`manage.mjs: speed differs in ${name} at ${where}`);
  };
  same('start');
  const steps = [];
  let logAt = 0,
    jumps = 0;
  const snap = (step, ret) => {
    const lines = s.log.slice(logAt);
    logAt = s.log.length;
    if (step[0] === 'jump') jumps++;
    // Every day's full state for a play recorded in full; for the long ones, every `every`th day and any step that
    // was not a plain day (the state is always kept when it holds an emergency).
    const full = every === 1 || step[0] !== 'jump' || jumps % every === 0 || !!game.emergency || lines.length > 0;
    steps.push({
      step,
      ret: ret === undefined ? null : ret,
      log: lines,
      speed: s.speed,
      saves: s.saves,
      day: game.day,
      ...(full ? { game: clone(game) } : {}),
    });
  };
  steps.push({
    step: ['start'],
    ret: null,
    log: s.log.slice(),
    speed: s.speed,
    saves: s.saves,
    day: game.day,
    game: clone(game),
  });
  logAt = s.log.length;
  for (const step of script(s)) {
    const ret = apply(s, step);
    apply(v, step);
    same(JSON.stringify(step));
    snap(step, ret);
  }
  return { name, seed, start: newManagement(seed), steps };
}

// ---------------------------------------------------------------------------------------------------------------------
// DIRECT CASES, one list per function.
function direct() {
  const out = {};
  const days = [
    START_DAY,
    dayOf(1958, 6, 30),
    dayOf(1958, 7, 1),
    dayOf(1959, 6, 30),
    dayOf(1959, 7, 1),
    dayOf(1960, 12, 31),
    dayOf(1966, 2, 28),
    dayOf(1971, 3, 3),
    dayOf(1976, 6, 30),
    dayOf(1976, 7, 1),
    dayOf(1976, 8, 15),
    dayOf(1976, 9, 30),
    dayOf(1976, 10, 1),
    dayOf(1977, 9, 30),
    dayOf(1980, 10, 1),
    dayOf(1945, 1, 1),
  ];
  out.fiscalYear = days.map(day => ({ day, out: fiscalYear(day) }));
  const flownSets = [
    [],
    [{ result: 'good' }],
    [{ result: 'lost' }, { result: 'short' }],
    [{ result: 'good' }, { result: 'good' }, { result: 'lost' }],
    [{ result: 'lost' }, { result: 'lost' }],
  ];
  out.recordFactor = flownSets.map(flown => ({ flown, out: recordFactor(flown) }));
  out.appropriation = [];
  for (const day of days)
    for (const [i, flown] of flownSets.entries())
      for (const standing of [undefined, 0, 2.5, -5, 9])
        if ((i + days.indexOf(day)) % 2 === 0 || standing === undefined)
          out.appropriation.push({
            day,
            startDay: START_DAY,
            flown,
            standing: standing ?? null,
            out: appropriation(day, START_DAY, flown, standing),
          });
  out.appropriation.push({
    day: dayOf(1962, 3, 1),
    startDay: dayOf(1961, 1, 1),
    flown: [],
    standing: 1,
    out: appropriation(dayOf(1962, 3, 1), dayOf(1961, 1, 1), [], 1),
  });
  out.appropriation.push({
    day: START_DAY,
    startDay: START_DAY,
    flown: null,
    standing: null,
    out: appropriation(START_DAY, START_DAY),
  });
  const splits = [
    DEFAULT_SPLIT,
    { programmes: 0, building: 100, staff: 0 },
    { programmes: 33, building: 33, staff: 34 },
  ];
  out.lines = [];
  for (const b of out.appropriation.filter((_, i) => i % 7 === 0).map(c => c.out))
    for (const split of splits)
      for (const day of [b.start - 3, b.start, b.start + 45, b.end, b.end + 10, START_DAY])
        out.lines.push({ budget: b, split, day, startDay: START_DAY, out: lines(b, split, day, START_DAY) });
  out.resplit = [];
  for (const split of [
    ...splits,
    { programmes: 0, building: 0, staff: 100 },
    { building: 50, staff: 50 },
    { programmes: 100, building: 0, staff: 0 },
  ])
    for (const id of ['programmes', 'building', 'staff', 'other'])
      for (const share of [0, 5, 37.5, 50, 62.5, 100, 140, -10, 12.5])
        out.resplit.push({ split, id, share, out: resplit(split, id, share) });
  out.money = [0, 0.04, 0.05, 0.25, 0.35, 1.45, 9.95, 39.72, 99.94, 99.96, 100, 100.5, 101.5, 2450.49, -3.25].map(
    m => ({ m, out: money(m) }),
  );

  // base.js
  out.coast = Array.from({ length: SIZE + 4 }, (_, i) => i - 2).map(ty => ({ ty, out: coast(ty) }));
  out.buildingAt = [];
  for (let tx = 0; tx < SIZE; tx += 1)
    for (let ty = 0; ty < SIZE; ty += 3)
      out.buildingAt.push({ tx, ty, out: buildingAt(CAPE_1958_BASE, tx, ty)?.id ?? null });

  // construction.js
  const ps = [-0.5, 0, 0.05, 0.11999, 0.12, 0.2, 0.25, 0.3, 0.5, 0.84, 0.85, 0.9, 0.99, 1, 1.2, NaN];
  out.stageOf = ps.map(p => ({ p: Number.isNaN(p) ? 'NaN' : p, out: stageOf(p) }));
  out.wallsAt = [];
  for (const kind of [...Object.keys(HEIGHT), 'other'])
    for (const p of ps.filter(x => !Number.isNaN(x))) out.wallsAt.push({ kind, p, out: wallsAt(kind, p) });

  // life.js (presentation, but the view and the sound read it)
  out.nightOf = [-30, -1, 0, 4.9, 5, 5.5, 6, 7, 12, 19, 19.5, 20, 21, 23.9, 24, 30, 49].map(h => ({
    h,
    out: nightOf(h),
  }));
  out.hourOf = [0, 0.25, 0.5, 0.999].map(p => ({ p, out: hourOf(p) }));
  out.easeNight = [];
  for (const current of [0, 0.4, 1])
    for (const part of [0, 0.2, 0.5, 0.85])
      for (const speed of [1, 4])
        for (const still of [false, true])
          for (const dt of [1 / 60, 0.25, 1])
            out.easeNight.push({
              current,
              part,
              speed,
              still,
              dt,
              out: easeNight(current, { part, speed, dt, still }),
            });
  out.movers = [];
  for (const t of [0, 3.3, 47, 600.25])
    for (const night of [0, 0.5, 1]) out.movers.push({ t, night, out: movers(CAPE_1958_ROADS, t, night) });
  out.movers.push({ t: 5, night: 0, roads: [], out: movers([], 5, 0) });
  out.windowPixels = windowPixels(CAPE_1958_BASE);
  out.rolloutRoute = [];
  for (const pad of CAPE_1958_BASE.filter(b => b.kind === 'pad')) {
    const route = rolloutRoute(CAPE_1958_BASE, CAPE_1958_ROADS, pad);
    out.rolloutRoute.push({
      pad: pad.id,
      out: route,
      along: [-0.2, 0, 0.1, 0.33, 0.5, 0.77, 1, 1.5].map(k => ({ k, out: alongRoute(route, k) })),
    });
  }
  const odd = { id: 'odd', kind: 'pad', padKind: 'atlas', tx: 2, ty: 40, name: 'Odd' };
  out.rolloutRoute.push({
    pad: 'odd',
    base: 'cape+odd',
    out: rolloutRoute([...CAPE_1958_BASE, odd], CAPE_1958_ROADS, odd),
    along: [],
  });
  out.rolloutRoute.push({
    pad: 'lc-5',
    base: 'no-hangar',
    out: rolloutRoute(
      CAPE_1958_BASE.filter(b => b.kind !== 'hangar'),
      CAPE_1958_ROADS,
      CAPE_1958_BASE[6],
    ),
    along: [],
  });
  out.alongRoute = [
    { route: [], k: 0.5, out: alongRoute([], 0.5) },
    { route: [{ tx: 1, ty: 1 }], k: 0.5, out: alongRoute([{ tx: 1, ty: 1 }], 0.5) },
    {
      route: [
        { tx: 1, ty: 1 },
        { tx: 1, ty: 1 },
        { tx: 4, ty: 5 },
      ],
      k: 0,
      out: alongRoute(
        [
          { tx: 1, ty: 1 },
          { tx: 1, ty: 1 },
          { tx: 4, ty: 5 },
        ],
        0,
      ),
    },
    {
      route: [
        { tx: 1, ty: 1 },
        { tx: 1, ty: 1 },
      ],
      k: 0.7,
      out: alongRoute(
        [
          { tx: 1, ty: 1 },
          { tx: 1, ty: 1 },
        ],
        0.7,
      ),
    },
  ];
  const sched0 = schedule(CAPE_1958, { from: START_DAY });
  out.rolloutsOn = [];
  for (let day = START_DAY; day < START_DAY + 120; day += 1) {
    const r = rolloutsOn(sched0.flights, CAPE_1958_BASE, day);
    if (r.length || day % 10 === 0) out.rolloutsOn.push({ day, out: r.map(x => ({ f: x.f.id, pad: x.pad.id })) });
  }
  const noOnPad = sched0.flights.slice(0, 3).map(({ onPad, ...f }) => f);
  out.rolloutsOnNoOnPad = [];
  for (let day = START_DAY; day < START_DAY + 70; day++) {
    const r = rolloutsOn([...noOnPad, { id: 'x', pad: 'nowhere', launch: START_DAY + 30 }], CAPE_1958_BASE, day);
    if (r.length) out.rolloutsOnNoOnPad.push({ day, out: r.map(x => ({ f: x.f.id, pad: x.pad.id })) });
  }
  out.rolloutsOnNoOnPadFlights = noOnPad;
  out.tileAt = [];
  for (let x = 0; x < ART.w; x += 37) for (let y = 0; y < ART.h; y += 23) out.tileAt.push({ x, y, out: tileAt(x, y) });

  // manifest + schedule
  out.padFits = [];
  for (const kind of [...Object.keys(PAD_KINDS), 'none'])
    for (const v of ['juno', 'redstone', 'thor-able', 'vanguard', 'atlas', 'atlas-able', 'saturn'])
      out.padFits.push({ kind, vehicle: v, out: padFits({ kind }, v) });
  out.turnaround = [
    { pad: { kind: 'thor' } },
    { pad: { kind: 'atlas', before: 20 } },
    { pad: { kind: 'redstone', after: 3 } },
    { pad: { kind: 'vanguard', before: 0, after: 0 } },
  ].map(c => ({ ...c, out: turnaround(c.pad) }));
  out.inWindow = [];
  for (const w of [
    { epoch: 5000, period: 29.53, days: 3 },
    { epoch: 5010, period: 10, days: 1 },
    { epoch: 5000.5, period: 7.25, days: 2 },
  ])
    for (const day of [4900, 4999, 5000, 5001, 5002, 5003, 5029, 5030, 5031, 5032, 5033, 5059, 5089.6, 5200, 6001])
      out.inWindow.push({ day, window: w, out: inWindow(day, w) });
  const plans = {
    cape: CAPE_1958,
    tight: {
      pads: [
        { id: 'a', kind: 'redstone' },
        { id: 'b', kind: 'redstone', before: 5, after: 2 },
        { id: 'c', kind: 'atlas', name: 'Pad C' },
      ],
      flights: [
        { id: 'r1', name: 'R1', vehicle: 'redstone', planned: 5000 },
        { id: 'r2', name: 'R2', vehicle: 'juno', planned: 5000 },
        { id: 'r3', name: 'R3', vehicle: 'redstone', planned: 5001, ready: 5030 },
        { id: 'r4', name: 'R4', vehicle: 'redstone', planned: 5002, pad: 'a' },
        { id: 'r0', name: 'R0', vehicle: 'redstone', planned: 5000 },
        { id: 'w1', name: 'W1', vehicle: 'atlas', planned: 5003, window: { epoch: 4990, period: 29.53, days: 3 } },
        { id: 'w2', name: 'W2', vehicle: 'atlas-able', planned: 5004, window: { epoch: 4990, period: 29.53, days: 3 } },
        { id: 'x1', name: 'X1', vehicle: 'saturn', planned: 5005 },
        { id: 'x2', name: 'X2', vehicle: 'thor-able', planned: 5006, pad: 'c' },
        { id: 'x3', name: 'X3', vehicle: 'redstone', planned: 5007, pad: 'lc-99' },
        { id: 'x4', name: 'X4', vehicle: 'thor-able', planned: 5007 },
      ],
    },
  };
  out.schedule = [];
  for (const [name, plan] of Object.entries(plans))
    for (const opts of [{}, { from: 5010 }, { from: START_DAY, site: 'cape' }, { from: 6000, site: 'wallops' }])
      out.schedule.push({ plan: name, opts, out: schedule(plan, opts) });
  out.plans = plans;
  out.opening = [];
  out.nextFlight = [];
  for (let day = START_DAY - 3; day < START_DAY + 400; day += 3) {
    out.opening.push({ day, out: opening(sched0, day).map(f => f.id) });
    out.nextFlight.push({ day, out: nextFlight(sched0, day)?.id ?? null });
  }

  // people.js
  const flightsAll = schedule(CAPE_1958, { from: START_DAY }).flights;
  out.postOpen = [];
  for (const post of POSTS)
    for (const day of [START_DAY, dayOf(1959, 9, 8), dayOf(1959, 9, 9), dayOf(1960, 1, 1)])
      for (const set of ['all', 'none'])
        out.postOpen.push({
          post: post.id,
          day,
          flights: set,
          out: postOpen(post, day, set === 'all' ? flightsAll : []),
        });
  out.candidate = [
    ['launch', 'marsh'],
    ['launch', 'pell'],
    ['nope', 'x'],
    ['astronauts', 'mercer'],
  ].map(([p, id]) => ({ post: p, id, out: candidate(p, id) }));
  out.staffing = [
    { heads: null, day: START_DAY },
    { heads: { launch: 'keane', flight: 'tanaka', safety: 'nobody' }, day: dayOf(1959, 9, 10) },
  ].map(c => ({ ...c, out: staffing(c.heads, c.day, flightsAll) }));

  // pressure.js
  out.watched = [];
  for (const s of SOVIET_FIRSTS)
    for (const k of [-1, 0, 179, 180]) out.watched.push({ day: s.day + k, out: watched(s.day + k) });
  out.pressure = [];
  const f = (id, launch) => ({ id, name: id.toUpperCase(), launch });
  const p0 = SOVIET_FIRSTS[0].day;
  for (const promised of [null, 'same', 'early', 3, 7, 8, 30, 100])
    for (const result of ['good', 'short', 'lost'])
      for (const launch of [p0 - 10, p0 + 5])
        for (const standing of [0, 4.5, -4.75]) {
          const game = { day: launch - 50, pressure: { ...initPressure(), standing } };
          const fl = f('fl', launch);
          if (promised === 'same') game.pressure.announced.fl = launch;
          else if (promised === 'early') game.pressure.announced.fl = launch + 4;
          else if (promised != null) game.pressure.announced.fl = launch - promised;
          const line = settle(game, fl, result);
          out.pressure.push({ promised, result, launch, standing, out: { line, pressure: clone(game.pressure) } });
        }
  out.settleFresh = (() => {
    const game = { day: 5000 };
    return { line: settle(game, f('a', 5100), 'good'), game: clone(game) };
  })();
  out.announce = [];
  for (const [day, launch, before] of [
    [5000, 5001, null],
    [5000, 5000, null],
    [5000, 4990, null],
    [5000, 5100, 5050],
    [5000, 5100, null],
  ]) {
    const game = { day, ...(before != null ? { pressure: { standing: 0, announced: { fl: before }, news: 0 } } : {}) };
    out.announce.push({ day, launch, before, out: announce(game, f('fl', launch)), game: clone(game) });
  }
  out.news = [];
  for (const [day, heard] of [
    [START_DAY, 0],
    [SOVIET_FIRSTS[0].day, 0],
    [SOVIET_FIRSTS[2].day + 1, 1],
    [dayOf(1962, 1, 1), 0],
    [dayOf(1962, 1, 1), 6],
  ]) {
    const game = { day, pressure: { standing: 1, announced: {}, news: heard } };
    out.news.push({ day, heard, out: news(game), game: clone(game) });
  }
  out.standingFactor = [undefined, null, 0, 1, -2.5, 5, 7, -9].map(s => ({
    standing: s ?? null,
    absent: s === undefined,
    out: standingFactor(s),
  }));
  out.combined = [];
  for (const r of [0.9, 1, 1.05, 1.1])
    for (const s of [-5, -1, 0, 2, 5, 8]) out.combined.push({ record: r, standing: s, out: combined(r, s) });
  out.standingText = [undefined, -4, -3, -2.9, -1, -0.99, 0, 0.99, 1, 2.99, 3, 5].map(s => ({
    standing: s ?? null,
    out: standingText(s),
  }));
  out.checkPressure = [
    undefined,
    null,
    5,
    { standing: 0, announced: {} },
    { standing: '1', announced: {} },
    { standing: 0 },
    { standing: 0, announced: null },
    { standing: 0, announced: [] },
  ].map(p => ({
    p: p === undefined ? '$undefined' : p,
    ...tryIt(() => checkPressure(p)),
  }));

  // programmes + build: games set up by hand
  out.programmeCalls = programmeCalls();
  out.buildCalls = buildCalls();

  // emergency.js
  out.emergencyToday = emergencyTodayCases();
  out.emergencies = emergencyRuns();
  out.emergencyCost = [
    { peak: 0, lost: false, hurt: 0 },
    { peak: 0.99, lost: false, hurt: 0 },
    { peak: 1, lost: false, hurt: 0 },
    { peak: 1.0167, lost: false, hurt: 3 },
    { peak: 1.5, lost: false, hurt: 0 },
    { peak: 2, lost: true, hurt: 8 },
  ].map(e => ({ e, out: emergencyCost(e) }));

  // outcome.js
  out.flightOutcome = [];
  const vehicleFlights = [
    ...CAPE_1958.flights,
    { id: 'tiros-1', name: 'TIROS 1', vehicle: 'thor-able' },
    { id: 'mercury-redstone-2', name: 'Mercury-Redstone 2', vehicle: 'redstone' },
    { id: 'odd', name: 'Odd', vehicle: 'saturn' },
  ];
  for (const seed of [...SEEDS, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12])
    for (const fl of vehicleFlights) {
      const o = flightOutcome(seed, fl);
      out.flightOutcome.push({ seed, flight: fl.id, vehicle: fl.vehicle, mods: null, out: o, report: report(fl, o) });
    }
  for (const seed of [0, 42])
    for (const mods of [
      { 'thor-able:thor': 0 },
      { 'atlas:booster': 3, 'atlas-able:shroud': 2 },
      { 'thor-able:kick': 5 },
    ])
      for (const fl of CAPE_1958.flights.filter(x => x.vehicle !== 'juno' && x.vehicle !== 'vanguard'))
        out.flightOutcome.push({ seed, flight: fl.id, vehicle: fl.vehicle, mods, out: flightOutcome(seed, fl, mods) });
  out.flights = vehicleFlights;

  // state.js
  out.managementWhere = [START_DAY, START_DAY + 400].map(day => ({ day, out: managementWhere({ site: 'cape', day }) }));
  out.newManagement = [0, 5, 0xffffffff].map(seed => ({ seed, out: newManagement(seed) }));
  out.checkManagement = checkCases().map(c => ({
    c: c === undefined ? '$undefined' : c,
    ...tryIt(() => checkManagement(c)),
  }));
  out.consts = { START_DAY, SECONDS_PER_DAY, SPEEDS };

  // view.js reads
  const g = newManagement(3);
  const sch = programmeSchedule(g, START_DAY);
  const base = baseOf(g);
  out.standsOn = [];
  for (let day = START_DAY; day < START_DAY + 200; day += 2)
    for (const part of day % 10 === 0 ? [0, 0.5, 0.6, 0.9, 1] : [0]) {
      const r = standsOn(sch, base, day, part);
      if (r.length || day % 20 === 0)
        out.standsOn.push({
          day,
          part,
          out: r.map(x => ({ pad: x.pad.id, vehicle: x.vehicle, rise: x.rise, flight: x.flight.id })),
        });
    }
  out.recordLine = [
    [],
    [{ result: 'good' }],
    [{ result: 'short' }],
    [{ result: 'lost' }, { result: 'good' }],
    [{ result: 'good' }, { result: 'short' }, { result: 'lost' }, { result: 'lost' }],
  ].map(flown => ({ flown, out: recordLine(flown) }));
  out.flyDue = [];
  for (const seed of [0, 1, 2]) {
    const game = newManagement(seed);
    const sc = programmeSchedule(game, START_DAY);
    game.pressure = { standing: 0, announced: { 'pioneer-2': sc.flights[1].launch - 2 }, news: 0 };
    const lines = flyDue(game, sc, dayOf(1959, 3, 10));
    out.flyDue.push({
      seed,
      day: dayOf(1959, 3, 10),
      announced: { 'pioneer-2': sc.flights[1].launch - 2 },
      out: lines,
      game: clone(game),
    });
  }
  return out;
}

function checkCases() {
  const ok = newManagement(4);
  const w = extra => ({ ...ok, ...extra });
  return [
    undefined,
    null,
    'management',
    { ...ok, kind: 'flight' },
    ok,
    w({ seed: 1.5 }),
    w({ seed: '4' }),
    w({ day: START_DAY - 1 }),
    w({ day: START_DAY + 0.5 }),
    w({ site: 'wallops' }),
    w({ site: 'toString' }),
    w({ split: { a: 50, b: 30, c: 20 } }),
    w({ split: { a: 50, b: 30 } }),
    w({ split: { a: 50, b: 30, c: 21 } }),
    w({ split: { a: 50.5, b: 29.5, c: 20 } }),
    w({ split: { a: 120, b: -20, c: 0 } }),
    w({ split: null }),
    w({ heads: {} }),
    w({ heads: null }),
    w({ heads: 'x' }),
    w({ flown: [] }),
    w({ flown: [{ id: 'a' }, { id: 'b', day: 3 }] }),
    w({ flown: [{ id: 3 }] }),
    w({ flown: [null] }),
    w({ flown: {} }),
    w({ pressure: { standing: 0, announced: {} } }),
    w({ pressure: { standing: 'x', announced: {} } }),
    w({ programmes: { pioneer: { status: 'running', lag: 0 } } }),
    w({ programmes: { pioneer: { status: 'paused', lag: 0 } } }),
    w({ programmes: { apollo: { status: 'running', lag: 0 } } }),
    w({ programmes: { pioneer: { status: 'running', lag: -1 } } }),
    w({ programmes: { pioneer: { status: 'running' } } }),
    w({ programmes: { pioneer: null } }),
    w({ programmes: null }),
    w({ works: [{ id: 'lc-34', progress: 0.5, cost: 2, days: 100 }] }),
    w({ works: [{ id: 'lc-99', progress: 0.5, cost: 2, days: 100 }] }),
    w({ works: [{ id: 'lc-34', progress: 1, cost: 2, days: 100 }] }),
    w({ works: [{ id: 'lc-34', progress: 0.2, cost: 0, days: 100 }] }),
    w({ works: [{ id: 'lc-34', progress: '0.2', cost: 1, days: 100 }] }),
    w({ works: {} }),
    w({ built: [{ id: 'lc-12' }] }),
    w({ built: [{ id: 'lc-5' }] }),
    w({ fitting: [{ pad: 'lc-5', slot: 'tower', progress: 0, cost: 1, days: 90 }] }),
    w({ fitting: [{ pad: 'lc-34', slot: 'deflector', progress: 0.1, cost: 1, days: 90 }] }),
    w({ fitting: [{ pad: 'hangar-s', slot: 'tower', progress: 0, cost: 1, days: 90 }] }),
    w({ fitting: [{ pad: 'lc-5', slot: 'bay', progress: 0, cost: 1, days: 90 }] }),
    w({ fitted: { 'lc-5': ['tower'], 'lc-12': [] } }),
    w({ fitted: { 'lc-5': 'tower' } }),
    w({ fitted: { 'lc-5': ['crane'] } }),
    w({ fitted: null }),
    w({ committed: { 'pioneer-1': 5000 } }),
    w({ committed: { 'pioneer-1': 5000.5 } }),
    w({ committed: null }),
    w({ committed: 4 }),
  ];
}

function programmeCalls() {
  const out = [];
  const run = (label, game, calls) => {
    const steps = calls.map(([fn, ...args]) => {
      let ret;
      if (fn === 'set') ret = setProgramme(game, ...args);
      else if (fn === 'canStop') ret = canStop(game, ...args);
      else if (fn === 'advance') ret = advanceProgrammes(game, game.budget, START_DAY);
      else if (fn === 'day') ret = game.day += args[0];
      else if (fn === 'flown')
        ret = (game.flown = [
          ...(game.flown ?? []),
          { id: args[0], day: game.day, pad: 'lc-17a', result: 'good', cause: null },
        ]).length;
      else if (fn === 'announce') ret = (game.pressure ??= initPressure()).announced[args[0]] = args[1];
      else if (fn === 'commit') ret = (game.committed ??= {})[args[0]] = args[1];
      else if (fn === 'budget')
        ret = game.budget = appropriation(game.day, START_DAY, game.flown, game.pressure?.standing);
      else if (fn === 'split') ret = game.split = args[0];
      else if (fn === 'commitOpen') ret = commitOpen(game, programmeSchedule(game, START_DAY));
      return {
        call: [fn, ...args],
        ret: ret === undefined ? null : clone(ret),
        game: clone(game),
        plan: planFor(clone(game)),
        sched: programmeSchedule(clone(game), START_DAY),
        all: allFlights(clone(game)).map(x => x.id),
        needed: game.budget ? needed(clone(game), game.budget, START_DAY) : null,
        funding: game.budget && game.split ? funding(clone(game), game.budget, START_DAY) : null,
      };
    });
    out.push({ label, start: calls.length ? null : null, steps });
  };
  run('statuses', newManagement(11), [
    ['canStop', 'explorer'],
    ['canStop', 'pioneer'],
    ['canStop', 'tiros'],
    ['set', 'explorer', 'stopped'],
    ['set', 'pioneer', 'running'],
    ['set', 'pioneer', 'paused'],
    ['set', 'apollo', 'running'],
    ['set', 'tiros', 'stopped'],
    ['set', 'tiros', 'running'],
    ['set', 'tiros', 'running'],
    ['set', 'mercury', 'slowed'],
    ['day', 30],
    ['advance'],
    ['set', 'mercury', 'running'],
    ['announce', 'vanguard-2', 5200],
    ['announce', 'vanguard-slv5', 5300],
    ['announce', 'big-joe', 5400],
    ['commit', 'vanguard-2', 5201],
    ['set', 'vanguard', 'stopped'],
    ['set', 'vanguard', 'running'],
    ['set', 'mercury', 'stopped'],
    ['flown', 'explorer-6'],
    ['canStop', 'explorer'],
    ['set', 'explorer', 'stopped'],
    ['set', 'explorer', 'slowed'],
    ['commitOpen'],
  ]);
  const g2 = newManagement(12);
  run('squeeze', g2, [
    ['split', { programmes: 10, building: 45, staff: 45 }],
    ['budget'],
    ['set', 'mercury-redstone', 'running'],
    ...Array.from({ length: 40 }, () => ['advance']),
    ['set', 'pioneer', 'slowed'],
    ...Array.from({ length: 3 }, () => ['advance']),
    ['day', 300],
    ['budget'],
    ['advance'],
    ['split', { programmes: 0, building: 50, staff: 50 }],
    ['advance'],
    ['split', { programmes: 100, building: 0, staff: 0 }],
    ['advance'],
  ]);
  const g3 = newManagement(13);
  g3.pressure = { standing: -4.5, announced: {}, news: 0 };
  run('stop-announced', g3, [
    ['announce', 'pioneer-1', 5040],
    ['announce', 'pioneer-2', 5070],
    ['announce', 'pioneer-3', 5100],
    ['flown', 'pioneer-1'],
    ['commit', 'pioneer-2', 5070],
    ['set', 'pioneer', 'stopped'],
    ['day', 500],
    ['set', 'pioneer', 'running'],
    ['commitOpen'],
  ]);
  // A programmes record that is missing one inherited programme, and one with no flights left.
  const g4 = newManagement(14);
  g4.programmes = { vanguard: { status: 'slowed', lag: 3.5 } };
  run('partial', g4, [['canStop', 'vanguard'], ['set', 'vanguard', 'running'], ['commitOpen']]);
  out.push({
    label: 'checkProgrammes',
    checks: [
      undefined,
      null,
      {},
      { pioneer: { status: 'slowed', lag: 0.5 } },
      { pioneer: { status: 'slowed', lag: NaN } },
      { tiros: { status: 'running', lag: 0, started: 5000 } },
      { pioneer: { status: 'x', lag: 0 } },
    ].map(ps => ({
      ps: ps === undefined ? '$undefined' : clone(ps),
      nan: ps?.pioneer?.lag !== ps?.pioneer?.lag,
      ...tryIt(() => checkProgrammes(ps)),
    })),
  });
  return out;
}

function buildCalls() {
  const out = [];
  const run = (label, game, calls) => {
    const steps = calls.map(([fn, ...args]) => {
      let ret;
      if (fn === 'build') ret = startBuilding(game, ...args);
      else if (fn === 'fit') ret = startFitting(game, ...args);
      else if (fn === 'advance') ret = advanceBuilding(game, args[0] ? game.budget : null, START_DAY);
      else if (fn === 'budget') ret = game.budget = appropriation(game.day, START_DAY, [], 0);
      else if (fn === 'split') ret = game.split = args[0];
      else if (fn === 'day') ret = game.day += args[0];
      return {
        call: [fn, ...args],
        ret: ret === undefined ? null : clone(ret),
        game: clone(game),
        base: baseOf(game),
        pads: padsOf(game),
        open: openPlots(game).map(p => p.id),
        need: game.budget ? buildNeed(game, game.budget, START_DAY) : null,
        cover: game.budget && game.split ? buildCover(game, game.budget, START_DAY) : null,
        check: tryIt(() => checkBuilding(game)).error,
      };
    });
    out.push({ label, steps });
  };
  const g = newManagement(21);
  run('fast', g, [
    ['build', 'lc-34', 'redstone'],
    ['build', 'lc-34', 'thor'],
    ['build', 'lc-12', 'hangar'],
    ['build', 'lc-12', 'castle'],
    ['build', 'nowhere', 'thor'],
    ['build', 'hangar-ae', 'hangar'],
    ['fit', 'lc-5', 'tower'],
    ['fit', 'lc-5', 'tower'],
    ['fit', 'lc-5', 'umbilical'],
    ['fit', 'lc-6', 'deflector'],
    ['fit', 'bh-14', 'tower'],
    ['fit', 'lc-34', 'tower'],
    ['fit', 'lc-14', 'bay'],
    ...Array.from({ length: 220 }, (_, i) => (i % 17 === 0 ? ['advance', false] : ['advance', false])),
    ['fit', 'lc-34', 'deflector'],
    ['fit', 'lc-5', 'tower'],
    ...Array.from({ length: 70 }, () => ['advance', false]),
  ]);
  const g2 = newManagement(22);
  g2.split = { programmes: 80, building: 4, staff: 16 };
  run('short', g2, [
    ['budget'],
    ['advance', true],
    ['build', 'lc-19', 'atlas'],
    ['build', 'lc-12', 'thor'],
    ['fit', 'lc-17a', 'deflector'],
    ['advance', true],
    ['split', { programmes: 80, building: 0, staff: 20 }],
    ['advance', true],
    ['split', { programmes: 0, building: 100, staff: 0 }],
    ['advance', true],
    ['day', 200],
    ['advance', true],
  ]);
  out.push({
    label: 'checkBuilding',
    checks: [{ works: [{ id: 'lc-34', progress: NaN, cost: 1, days: 2 }] }].map(c => ({
      nan: true,
      ...tryIt(() => checkBuilding(c)),
    })),
  });
  return out;
}

function emergencyTodayCases() {
  const out = [];
  for (const seed of SEEDS) {
    const game = newManagement(seed);
    const sched = programmeSchedule(game, START_DAY),
      base = baseOf(game);
    game.flown = [{ id: 'x', day: START_DAY, pad: 'lc-5', result: 'good', cause: null }];
    const hits = [];
    for (let day = START_DAY; day < START_DAY + 500; day++) {
      game.day = day;
      const stands = standsOn(sched, base, day);
      const r = emergencyToday(game, stands);
      if (r) hits.push({ day, out: r });
    }
    out.push({ seed, hits });
  }
  // The gates: an emergency live, nothing flown, a quiet spell after the last.
  const game = newManagement(0);
  const sched = programmeSchedule(game, START_DAY),
    base = baseOf(game);
  const day = out[0].hits[0]?.day ?? START_DAY + 10;
  const variants = [
    ['live', { emergency: { kind: 'leak' }, flown: [{ id: 'x' }] }],
    ['no-flown', {}],
    ['empty-flown', { flown: [] }],
    ['quiet', { flown: [{ id: 'x' }], emergencies: [{ day: day - 50 }] }],
    ['quiet-over', { flown: [{ id: 'x' }], emergencies: [{ day: day - 120 }] }],
    ['null-emergency', { flown: [{ id: 'x' }], emergency: null }],
  ];
  out.push({
    seed: 0,
    gates: variants.map(([name, extra]) => {
      const g = { ...game, day, ...extra };
      return { name, day, extra, out: emergencyToday(g, standsOn(sched, base, day)) };
    }),
  });
  return out;
}

// Emergencies started by hand and played with different orders, the full emergency after every step.
function emergencyRuns() {
  const out = [];
  const scripts = {
    nothing: [['tick', 30]],
    all: [
      ['order', 'safety', 'pad'],
      ['order', 'pad', 'pad'],
      ['order', 'fire', 'pad'],
      ['tick', 0.35],
      ['tick', 1],
      ['tick', 5],
      ['tick', 30],
    ],
    fireOnly: [
      ['order', 'fire', 'pad'],
      ['tick', 2],
      ['tick', 10],
      ['tick', 40],
    ],
    late: [
      ['tick', 3.95],
      ['order', 'pad', 'pad'],
      ['tick', 6],
      ['order', 'pad', 'home'],
      ['tick', 8],
      ['order', 'pad', 'pad'],
      ['tick', 30],
    ],
    callBack: [
      ['order', 'safety', 'pad'],
      ['tick', 1],
      ['order', 'safety', 'home'],
      ['tick', 2],
      ['order', 'safety', 'elsewhere'],
      ['order', 'ghost', 'pad'],
      ['tick', 0.05],
      ['tick', 20],
    ],
    long: [
      ['tick', 0.07],
      ['tick', 0.07],
      ['tick', 100],
    ],
  };
  const g0 = newManagement(5);
  const sched = programmeSchedule(g0, START_DAY),
    base = baseOf(g0);
  const pads = ['lc-17a', 'lc-5', 'lc-18a', 'lc-14'];
  for (const kind of ['leak', 'fire'])
    for (const [name, steps] of Object.entries(scripts))
      for (const pad of pads.slice(0, name === 'all' || name === 'nothing' ? 4 : 2)) {
        const flight = sched.flights.find(f => f.pad === pad);
        const game = { ...newManagement(5), flown: [] };
        const start = startEmergency(game, base, { kind, pad, flight: flight.id });
        const trace = [{ step: ['start', kind, pad, flight.id], ret: start, e: clone(game.emergency) }];
        for (const [what, ...args] of steps) {
          let ret;
          if (what === 'order') ret = orderCrew(game, base, args[0], args[1]);
          else ret = tickEmergency(game, base, args[0]);
          trace.push({
            step: [what, ...args],
            ret,
            e: clone(game.emergency),
            onPad: ORDER.map(id => onPad(game.emergency, base, id)),
          });
        }
        const cost = game.emergency.done ? emergencyCost(game.emergency) : null;
        const lines = endEmergency(game, base, sched.flights);
        out.push({ kind, script: name, pad, trace, cost, end: lines, game: clone(game) });
      }
  // Ending on a flight no longer in the list, and orders or ticks with nothing live.
  const game = { ...newManagement(6), flown: [] };
  startEmergency(game, base, { kind: 'fire', pad: 'lc-5', flight: 'gone' });
  tickEmergency(game, base, 100);
  out.push({
    kind: 'fire',
    script: 'gone',
    pad: 'lc-5',
    trace: [],
    cost: emergencyCost(game.emergency),
    end: endEmergency(game, base, sched.flights),
    game: clone(game),
    after: {
      order: orderCrew(game, base, 'fire', 'pad'),
      tick: tickEmergency(game, base, 5),
      end: endEmergency(game, base, sched.flights),
    },
  });
  // A base with no blockhouse near and no hangar-s/offices: crews start from the first building that is not a pad.
  const bare = base.filter(b => b.kind === 'pad' || b.id === 'tracking');
  const g7 = { ...newManagement(7), flown: [] };
  startEmergency(g7, bare, { kind: 'leak', pad: 'lc-14', flight: 'pioneer-p3' });
  const bareEnd = tickEmergency(g7, bare, 60);
  const onlyPads = base.filter(b => b.kind === 'pad');
  const g8 = { ...newManagement(8), flown: [] };
  startEmergency(g8, onlyPads, { kind: 'leak', pad: 'lc-14', flight: 'pioneer-p3' });
  const onlyEnd = tickEmergency(g8, onlyPads, 60);
  out.push({ kind: 'leak', script: 'bare', pad: 'lc-14', base: 'bare', trace: [], ticked: bareEnd, game: clone(g7) });
  out.push({
    kind: 'leak',
    script: 'only-pads',
    pad: 'lc-14',
    base: 'only-pads',
    trace: [],
    ticked: onlyEnd,
    game: clone(g8),
  });
  return out;
}

export function record(write) {
  write('manage-direct.json', direct());
  write('manage-play.json', PLAYS.map(play));
}
