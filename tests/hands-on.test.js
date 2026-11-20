// The hands-on ideas (plans-review/HANDS-ON-GAMEPLAY.md, Aaron 20 November 2026): reading the needles yourself, the
// red-line card and the grease pencil on the dugout's recorder.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  tick,
  standStart,
  standMark,
  standWipe,
  standMarked,
  standDecide,
  countAnswer,
  POLL_WINDOW,
  trackStick,
  trackShare,
  TRACK,
} from '../js/game.js';
import { estimate } from '../js/world/programme.js';
import { tickConsole, INSERT_WINDOW } from '../js/mercury.js';
import { redlineRows } from '../js/scenes/redlines.js';
import { playRound, until } from './play.js';

const toRead = () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
};

test('the red-line card lists every banded channel, and the count room only the pressurisation and firing ones', () => {
  toRead();
  const all = redlineRows('static').map(r => r[0]),
    count = redlineRows('count').map(r => r[0]);
  assert.ok(all.includes('Chamber pressure') && all.includes('Thrust'), all.join(', '));
  assert.ok(count.includes('Firing bus') && !count.includes('Chamber pressure'), count.join(', '));
  assert.ok(count.includes('Igniter continuity'));
  for (const [, lim] of redlineRows('static')) assert.match(lim, /\d+(\.\d)? to \d+|lit before firing/);
});

test('the grease pencil ticks the boxes for what it rings, and wipes off', () => {
  toRead();
  assert.deepEqual(standMarked(), { rework: false, leak: false });
  standMark({ t0: 0, t1: 1, lo: 10, hi: 20, tank: false, chamber: false });
  assert.equal(g.stand.marks?.length ?? 0, 0, 'a ring round nothing is not kept');
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: false, chamber: true });
  assert.deepEqual(standMarked(), { rework: true, leak: false });
  standMark({ t0: 5, t1: 7, lo: 20, hi: 25, tank: true, chamber: false });
  assert.deepEqual(standMarked(), { rework: true, leak: true });
  standWipe();
  assert.deepEqual(standMarked(), { rework: false, leak: false });
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: false, chamber: true });
  standDecide({ rework: true, leak: false });
  assert.ok(
    g.notes.some(n => /ringed the chamber trace in grease pencil/.test(n.text)),
    'the ring goes in the notebook',
  );
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: true, chamber: false });
  assert.equal(g.stand.marks.length, 1, 'no ringing once the call is made');
});

// ---- Idea 2: the clock keeps running ----
const toPoll = () => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  assert.ok(g.count?.poll, 'at the first poll');
};
const wait = seconds => {
  for (let t = 0; t < seconds; t += 0.05) tick(0.05);
};

test('a poll waits on your call only for its window, then the lead reads your gauge and calls it', () => {
  toPoll();
  assert.equal(g.count.pollLeft, POLL_WINDOW);
  wait(POLL_WINDOW - 1);
  assert.ok(g.count.poll, 'still waiting just inside the window');
  wait(1.5);
  assert.equal(g.count.poll, null, 'the window closed');
  assert.ok(g.count.readings.at(-1).missed);
  assert.ok(g.notes.some(n => /you missed the poll/.test(n.text)));
  assert.ok(
    g.record.memory.some(m => /read your gauge for you/.test(m.text)),
    'the lead remembers',
  );
});

test('as test conductor, a missed poll holds the count', () => {
  toPoll();
  g.record.seat = 'test-conductor';
  g.vehicle = 'aerobee';
  wait(POLL_WINDOW + 0.5);
  assert.equal(g.count.held, true);
  assert.ok(g.notes.some(n => /Delgado called the hold/.test(n.text)));
});

test('answering in time clears the window', () => {
  toPoll();
  wait(3);
  countAnswer(true);
  assert.equal(g.count.pollLeft, null);
  assert.ok(!g.count.readings.at(-1).missed);
});

test('the go / no-go for orbit has a window too: when it closes the team goes with Goddard', () => {
  newGame(11);
  g.record.seat = 'flight';
  g.round.end = { outcome: 'orbit', margin: 0.02, v: 7.8, gammaOff: 0, capsule: 'safe' };
  const c = (g.console = {
    phase: 'insertion',
    live: true,
    kind: 'flight',
    flightId: 'gem-6',
    round: g.round,
    goddard: { go: true },
    calls: {},
    log: [],
  });
  for (let i = 0; i < (INSERT_WINDOW - 1) * 2; i++) tickConsole(0.5);
  assert.equal(c.phase, 'insertion', 'still open inside the window');
  for (let i = 0; i < 4 && c.phase === 'insertion'; i++) tickConsole(0.5);
  assert.equal(c.calls.insertion.expired, true);
  assert.equal(c.calls.insertion.go, true);
  assert.ok(g.notes.some(n => /window closed without a call from (Flight|Retro)/.test(n.text)));
});

// ---- Idea 3: the tracking camera on your hands ----
const flyTracking = steer => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  while (g.count && g.count.poll) {
    countAnswer(true);
    until(() => !g.count || g.count.poll || g.flight);
  }
  g.speed = 1;
  for (let n = 0; n < 6000 && g.flight.view !== 'done'; n++) {
    const tr = g.flight.track;
    if (tr && steer) trackStick(Math.max(-1, Math.min(1, tr.x * 3)), Math.max(-1, Math.min(1, tr.y * 3)));
    tick(1 / 30);
  }
  return trackShare(g.flight);
};

test('left alone, the tracking camera loses her; kept on her, the film counts double for the drawing office', () => {
  assert.ok(flyTracking(false) < 0.1, 'an untouched mount loses her');
  const share = flyTracking(true);
  assert.ok(share >= TRACK.good, `a careful tracker keeps her ${share}`);
  assert.equal(g.decided.trackShare, share);
  const before = estimate(g.programme, 'wac').flights;
  playRound();
  const flown = g.programme.flights.at(-1);
  if (flown.apogee != null) {
    assert.equal(flown.tracked, true);
    assert.equal(estimate(g.programme, 'wac').flights, before + 2, 'a tracked flight counts twice');
  }
  assert.ok(g.notes.some(n => /Your tracking film/.test(n.text)));
});
