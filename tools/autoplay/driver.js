// THE AUTOMATED PLAYTEST, the half that runs inside the game's window. tools/autoplay/run.mjs loads it into the real
// Electron app (from the working folder, never the shipped build) and calls it step by step. It does three things:
//  - plays: the Flight Director's game from 1945 to the end with the tests' bot (js/dev/bot.js), one player action per
//    step, so the runner can look and listen between actions; Desk mode's count, answering as a good EECOM would;
//  - watches: every frame's time, the sound going out (level, peaks, how many sounds are alive), and how long the player
//    sat with nothing to do;
//  - looks: blank screens, text cut off or off the screen, broken pictures, and screenshots compared with approved ones.
// It never changes the game's rules; it only calls what a player's clicks and the bot already call.

import * as game from '../../js/game.js';
import {
  passFlow,
  nextDay,
  until,
  followProbe,
  carefulDecide,
  MERCURY_DEFAULTS,
  waiting,
  work,
} from '../../js/dev/bot.js';
import { pendingOffer } from '../../js/career/record.js';
import {
  routeArgue,
  routeDone,
  apollo8Decide,
  apollo8Done,
  workshopDecide,
  workshopDone,
  consoleStart,
  missionPresent,
  toReview,
} from '../../js/mercury.js';
import { SEASON } from '../../js/data/campaign.js';
import { callOptions, logDue, readings } from '../../js/desk/model.js';
import { TASKS, LOG_FIELDS } from '../../js/desk/data.js';

const g = () => game.g;

// ---------------------------------------------------------------------------------------------------------------------
// WATCHING: frames and sound, from tools/autoplay/tap.js, which the runner puts in the page before the game's own
// scripts so the sound graph is tapped as it is built.

const tap = globalThis.__autoplayTap ?? { frames: { gaps: [] }, audio: { samples: [] } };
const { frames, audio } = tap;

// A window of watching: everything seen and heard since the last one.
export function beginWindow() {
  frames.gaps = [];
  audio.samples = [];
}
export function endWindow() {
  const gaps = frames.gaps.slice().sort((a, b) => a - b);
  const q = p => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] : null);
  const s = audio.samples;
  const db = x => (x > 0 ? 20 * Math.log10(x) : -120);
  return {
    frames: {
      count: gaps.length,
      median: q(0.5),
      p95: q(0.95),
      worst: gaps.at(-1) ?? null,
      long: gaps.filter(x => x > 100).length,
    },
    audio: s.length
      ? {
          running: s.some(x => x.state === 'running'),
          rmsDb: db(Math.sqrt(s.reduce((n, x) => n + x.rms * x.rms, 0) / s.length)),
          quietestDb: db(Math.min(...s.map(x => x.rms))),
          loudestDb: db(Math.max(...s.map(x => x.rms))),
          peak: Math.max(...s.map(x => x.peak)),
          clipped: s.filter(x => x.peak >= 0.99).length,
          jumpDb: Math.max(0, ...s.slice(1).map((x, i) => db(x.rms) - db(s[i].rms))),
          alive: s.at(-1).alive,
          loops: s.at(-1).loops,
          started: audio.started,
        }
      : { tapped: !!audio.analyser },
    memoryMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    where: whereNow(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// LOOKING: what is on the screen, from the page's side.

const visible = el => {
  if (!el || el.hidden) return false;
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const label = el =>
  `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
const ownText = el =>
  [...el.childNodes]
    .filter(n => n.nodeType === 3)
    .map(n => n.textContent)
    .join('')
    .trim();

// Text the player cannot read: cut off by its box, running off the window, or a picture that did not load.
export function layoutProblems() {
  const out = [];
  const W = innerWidth,
    H = innerHeight;
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'CANVAS', 'svg'].includes(el.tagName) || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    const text = ownText(el);
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0)
      out.push({ kind: 'broken-image', el: label(el), text: el.getAttribute('src') ?? '' });
    if (!text) continue;
    const s = getComputedStyle(el);
    const clips = /hidden|clip/.test(s.overflowX + s.overflowY) || s.textOverflow === 'ellipsis';
    if (clips && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2))
      // Shortened on purpose, with the whole text on hover, is a note; cut off with no way to read it is a problem.
      out.push({
        kind:
          s.textOverflow === 'ellipsis' && el.title?.includes(text.slice(0, 40)) ? 'text-shortened' : 'text-cut-off',
        el: label(el),
        text: text.slice(0, 80),
      });
    // Off the window, unless something it sits in scrolls (then the player can reach it).
    if (r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2) {
      let p = el.parentElement,
        scrolls = false;
      for (; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/auto|scroll/.test(ps.overflowX + ps.overflowY)) scrolls = true;
      }
      if (!scrolls) out.push({ kind: 'text-off-screen', el: label(el), text: text.slice(0, 80) });
    }
  }
  // One line per element and kind.
  const seen = new Set();
  return out.filter(p => {
    const k = `${p.kind}|${p.el}|${p.text}`;
    return !seen.has(k) && seen.add(k);
  });
}

const loadImage = src =>
  new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error('could not read the screenshot'));
    i.src = src;
  });
const pixels = (img, w = 320, h = 180) => {
  const c = new OffscreenCanvas(w, h),
    x = c.getContext('2d');
  x.drawImage(img, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
};

// A screenshot's look: how much of it is one colour, and how much it varies. A blank or frozen-black frame shows here.
export async function imageStats(dataUrl) {
  const d = pixels(await loadImage(dataUrl));
  const buckets = new Map();
  let sum = 0,
    sum2 = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    sum += l;
    sum2 += l * l;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const mean = sum / n;
  return {
    mean: Math.round(mean),
    spread: Math.round(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
    oneColour: Math.max(...buckets.values()) / n,
  };
}

// Two screenshots compared at a small size (so a flicker of grain or a walking figure is not a change): the share of the
// picture that differs, and a picture of where, in red.
export async function compareImages(aUrl, bUrl) {
  const W = 480,
    H = 270;
  const [a, b] = await Promise.all([aUrl, bUrl].map(loadImage));
  const pa = pixels(a, W, H),
    pb = pixels(b, W, H);
  const c = new OffscreenCanvas(W, H),
    x = c.getContext('2d'),
    out = x.createImageData(W, H);
  let changed = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
    const grey = (pb[i] + pb[i + 1] + pb[i + 2]) / 9;
    if (d > 60) {
      changed++;
      out.data.set([255, 40, 40, 255], i);
    } else out.data.set([grey, grey, grey, 255], i);
  }
  x.putImageData(out, 0, 0);
  const blob = await c.convertToBlob({ type: 'image/png' });
  const diff = await new Promise(ok => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.readAsDataURL(blob);
  });
  return { changed: changed / (W * H), diff, sizeChanged: a.width !== b.width || a.height !== b.height };
}

// ---------------------------------------------------------------------------------------------------------------------
// WHERE THE PLAYER IS, for every note the runner makes.

export function whereNow() {
  const x = g();
  const m = !document.getElementById('manage').hidden && globalThis.__manage?.state;
  const d = !document.getElementById('desk').hidden && globalThis.__desk?.desk;
  const title = !document.getElementById('title').hidden;
  if (title) return { mode: 'title' };
  if (m) return { mode: 'management', day: m.day, where: m.where };
  if (d) return { mode: 'desk', t: Math.round(d.t), done: !!d.done };
  if (!x) return { mode: 'none' };
  return {
    mode: 'flight',
    round: SEASON[x.roundIndex]?.id,
    beat: x.beat,
    room: x.room ?? null,
    day: x.day,
    crewed: !!x.crewed,
    paused: !!x.paused,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// PLAYING THE FLIGHT DIRECTOR'S GAME, one player action per step.
// Each step returns its name and how long, in real seconds, a player would have sat waiting through it at the fastest
// speed the game allows (the bot always runs at 16x; counts and firings run in real time whatever the speed).

let steps = null,
  watched = null,
  beats = [];
// Every beat the game passes through, with the real seconds spent in it. g is replaced by each new game or load, so
// the watch is put back on whenever it changes.
function watchBeats() {
  const x = g();
  if (!x || watched === x) return;
  watched = x;
  let beat = x.beat;
  Object.defineProperty(x, 'beat', {
    configurable: true,
    enumerable: true,
    get: () => beat,
    set: v => {
      if (v !== beat) beats.push({ beat: v, at: x.time });
      beat = v;
    },
  });
}

const BOT_PLAN = { inspector: 'you', burn: 'short', leak: false };
// What the run has done with the hands-on controls (HANDS-ON-GAMEPLAY.md), for the report.
export const handsOn = {};
// The rounds that are scenes, not flights, decided the way the room really decided them.
function* scene() {
  const x = g();
  if (x.beat === 'sRoute') {
    routeArgue('lor');
    routeDone();
  } else if (x.beat === 'sWorkshop') {
    workshopDecide('attitude', 'pitch');
    workshopDecide('crew', 'wait');
    workshopDone();
  } else if (x.beat === 'sApollo8') {
    apollo8Decide('moon');
    apollo8Done();
  }
  yield 'scene-decided';
  game.nextRound();
  g().room = null;
}

// An uncrewed round from the Cape or White Sands, as js/dev/bot.js playRound plays it, with a look after each action.
function* round() {
  if (g().beat.startsWith('probe')) {
    while (g().beat.startsWith('probe')) {
      game.advanceProbe(true);
      game.closeAway();
      yield 'probe-office';
    }
    return;
  }
  if (game.conducting()) {
    game.finishPlan(BOT_PLAN);
    yield 'test-plan';
    if (g().plan.inspector !== 'you') until(() => g().beat === 'board');
  }
  if (g().beat === 'brief') {
    // Hands-on idea 5, once a run: put the first part on its test kit and read the meter.
    if (!handsOn.meter) {
      const first = Object.keys(game.kit().spots ?? {})[0];
      if (first) game.meterSpot(first);
      handsOn.meter = !!g().decided?.meter;
    }
    game.finishInspection({});
    yield 'inspection';
  }
  game.finishBoard();
  yield 'board';
  nextDay();
  until(() => g().beat === 'static');
  yield 'static-morning';
  // Hands-on idea 4: sit down at the firing panel and throw its switches in order before the key (a tape round has none).
  game.standPanelOpen();
  if (g().stand.switches) {
    for (const [id] of game.STAND_SWITCHES) game.standSwitch(id);
    handsOn.switches = (handsOn.switches ?? 0) + 1;
  }
  game.standStart();
  until(() => g().stand.phase === 'read');
  yield 'static-fire';
  // Hands-on idea 1: a grease-pencil ring on the trace (the last second, both pens), wiped again: the call stays ours.
  const trace = g().stand.trace ?? [];
  if (trace.length) {
    const end = trace.at(-1).t ?? trace.length;
    game.standMark({ t0: end - 1, t1: end, lo: 0, hi: 1, tank: true, chamber: true });
    handsOn.marks = (handsOn.marks ?? 0) + (g().stand.marks?.length ? 1 : 0);
    game.standWipe();
  }
  game.standDecide({ rework: false, leak: false });
  nextDay();
  until(() => g().beat === 'countReady');
  yield 'launch-morning';
  game.countStart();
  const flown = () => g().beat === 'recovery' || g().beat === 'lCruise' || (g().count && g().count.poll);
  // The count runs to the next poll or the end of the flight, stopping once at the moment she lifts off, so the runner
  // can watch and listen to the liftoff as it happens.
  let lifted = false;
  function* toNext() {
    if (!lifted) {
      until(() => flown() || !!g().flight);
      if (g().flight && !flown()) {
        lifted = true;
        yield 'liftoff';
      }
    }
    until(flown);
  }
  yield* toNext();
  yield 'count';
  while (g().count && g().count.poll) {
    game.countAnswer(true);
    yield* toNext();
    yield 'count-poll';
  }
  if (g().beat === 'lCruise') {
    followProbe({ midcourse: 'wait', lead: 20 });
    yield 'lunar-encounter';
  }
  game.rideOut();
  yield 'flight';
  until(() => g().room === 'recovery');
  yield 'recovery';
  game.returnFromRecovery();
  yield 'review';
  if (game.conducting()) game.chair('nominal');
  else game.present('nominal');
}

// A crewed round, worked from the console: the launch day's count, each call the flight asks for, recovery, the review.
function* mission() {
  const o = { ...MERCURY_DEFAULTS, decide: carefulDecide };
  let climbed = false;
  nextDay();
  yield 'launch-day';
  for (let tries = 0; tries < 12 && ['mLaunch', 'mScrub'].includes(g().beat); tries++) {
    if (g().beat === 'mScrub') {
      nextDay();
      yield 'scrub';
      continue;
    }
    consoleStart();
    yield 'console';
    for (let n = 0; n < 60 && g().beat === 'mFlight'; n++) {
      // Stop at the start of the climb too, even on a console with no call to make on the way up.
      until(() => waiting() || (!climbed && g().console?.phase === 'ascent'));
      if (g().console && g().beat === 'mFlight') {
        const phase = g().console.flight?.decision?.mine ? 'decision' : (g().console.poll ?? g().console.phase);
        // The first moment of the climb is the liftoff, watched live by the runner.
        if (phase === 'ascent' && !climbed) {
          climbed = true;
          yield 'liftoff';
          if (!waiting()) continue; // nothing for the player to call on the climb: on up to the next call
        } else yield `console-${phase}`;
        work(g().console, o);
      }
    }
    if (g().beat === 'mPadNight') nextDay();
  }
  if (g().beat === 'mRecovery') {
    toReview();
    yield 'recovery';
  }
  if (g().beat !== 'mReview') throw new Error(`stuck at beat ${g().beat}`);
  missionPresent('unknown');
}

// The whole campaign from wherever the game stands (a new game, or a save just loaded) to the season's end.
function* campaign(lastRound) {
  for (let guard = 160; guard; guard--) {
    const x = g();
    const r = SEASON[x.roundIndex];
    if (x.beat === 'seasonEnd') return yield 'season-end';
    if (['sRoute', 'sWorkshop', 'sApollo8'].includes(x.beat)) {
      yield* scene();
      continue;
    }
    yield 'round-start';
    passFlow();
    game.closeAway();
    if (x.crewed) yield* mission();
    else yield* round();
    const o = g().record.offers.at(-1);
    if (o && !o.made && o.day >= g().record.rounds.at(-1).day) {
      o.made = true;
      o.answer = null;
    }
    if (pendingOffer(g().record)) game.answerFirstOffer(true);
    if (r.id === lastRound) return yield 'last-round-done';
    game.nextRound();
    g().room = null;
  }
}

// The runner calls this until it says done. A step that throws is a stuck game: the error and where it stood go back.
export function startCampaign(lastRound = null) {
  steps = campaign(lastRound);
  watched = null;
}
export function step() {
  const x = g();
  watchBeats();
  x.paused = false; // the runner pauses the game while it looks; the bot needs the clock
  const t0 = x.time;
  beats = [];
  const before = whereNow();
  let r;
  try {
    r = steps.next();
  } catch (e) {
    return { error: String(e?.stack ?? e), before, where: whereNow() };
  } finally {
    watchBeats();
  }
  const y = g();
  // Real seconds of beats in this step, so a long wait can be put down to the beat it was in.
  const inBeats = beats.map((b, i) => ({ beat: b.beat, seconds: (beats[i + 1]?.at ?? y.time) - b.at }));
  return {
    done: !!r.done,
    name: r.value ?? 'end',
    wait: y === x ? y.time - t0 : null,
    beats: inBeats.filter(b => b.seconds > 0.5),
    where: whereNow(),
  };
}
// While the runner looks, the game stands still at the moment the player would decide.
export function hold() {
  if (g()) g().paused = true;
}
export function release() {
  if (g()) g().paused = false;
}
// A liftoff is watched as a player sees it: running, at normal speed.
export function live() {
  if (!g()) return;
  g().paused = false;
  g().speed = 1;
}

// The save the game holds for the Flight Director, as the runner checks it survives a restart.
export function savedFlight() {
  try {
    const c = JSON.parse(localStorage.getItem('pa-game'))?.checkpoint;
    return c ? { round: c.roundId ?? SEASON[c.roundIndex]?.id ?? null, day: c.day, beat: c.beat } : null;
  } catch {
    return null;
  }
}
export const reseed = seed => {
  game.newGame(seed);
  watched = null;
};

// ---------------------------------------------------------------------------------------------------------------------
// DESK MODE: answer as a good EECOM would (as tests/desk.test.js plays it), a stretch of the count at a time.

export function deskStep(seconds) {
  const v = globalThis.__desk,
    d = v?.desk;
  if (!d) return { error: 'no desk on the screen' };
  const t0 = d.t;
  const said = [];
  let firstAsk = null;
  for (let s = 0; s < seconds && !d.done; s++) {
    v.run(1);
    if (logDue(d) >= 0) {
      // copy the screen onto the log sheet, as a careful EECOM would
      v.write(Object.fromEntries(LOG_FIELDS.map(f => [f.id, String(f.read(readings(d)))])));
      said.push('log');
    }
    for (const o of callOptions(d)) {
      const [k, w] = o.id.split(':');
      if (k === 'task' && d.t >= TASKS[w].from) said.push(o.id) && v.say(o.id);
    }
    for (const o of callOptions(d).filter(o => o.answer)) {
      firstAsk ??= d.t;
      const [k, w] = o.id.split(':');
      const want =
        k === 'leak'
          ? d.fault === 'leak'
            ? 'hold'
            : 'good'
          : k === 'poll'
            ? 'go'
            : k === 'o2'
              ? 'probe'
              : k === 'readup'
                ? 'log'
                : 'good';
      if (w === want) said.push(o.id) && v.say(o.id);
    }
  }
  return {
    t: d.t,
    ran: d.t - t0,
    said,
    firstAsk,
    done: !!d.done,
    verdict: d.done ? (d.verdict?.lines ?? []).slice(0, 6) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------

globalThis.__autoplay = {
  handsOn,
  beginWindow,
  endWindow,
  layoutProblems,
  imageStats,
  compareImages,
  whereNow,
  startCampaign,
  step,
  hold,
  release,
  live,
  savedFlight,
  reseed,
  deskStep,
};
