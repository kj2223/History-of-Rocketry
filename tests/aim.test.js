// The launch-morning call (Aaron, 22 November 2026): the tower laid against the wind, balloons that are late and
// not exact, holds that eat the range window, and where she comes down across the range.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  countStart,
  countHold,
  countRelay,
  countAnswer,
  countLeakCheck,
  aimed,
  windowLeft,
  tick,
  rideOut,
  RANGE_WINDOW,
} from '../js/game.js';
import {
  crosswindAt,
  balloonAt,
  layFor,
  crossImpact,
  landingOf,
  wreckFound,
  WEATHERCOCK,
  CLEARED_KM,
  OFF_RANGE_KM,
  AIMED,
} from '../js/truth/aim.js';
import { ellisReading, newRound } from '../js/truth/round.js';
import { playRound, until, nextDay } from './play.js';

test('the wind wanders through the day, and a balloon reads it a few km/h out', () => {
  let moved = 0,
    err = 0;
  for (let seed = 1; seed < 300; seed++) {
    moved += Math.abs(crosswindAt(seed, 660) - crosswindAt(seed, 420));
    err += Math.abs(balloonAt(seed, 600) - crosswindAt(seed, 600));
  }
  assert.ok(moved / 299 > 4, `the wind moves over a morning: ${moved / 299}`);
  assert.ok(err / 299 > 1 && err / 299 < 3, `balloon error ${err / 299}`);
});

test('a tower laid by the rule brings her back on the line; unlaid she drifts upwind', () => {
  assert.equal(layFor(10), 4.5);
  assert.ok(Math.abs(crossImpact(40, layFor(10), 10)) < 0.5);
  assert.ok(crossImpact(40, 0, 10) < 0, 'a wind toward the east turns her west');
  assert.ok(Math.abs(crossImpact(40, 0, 20)) > CLEARED_KM);
  assert.equal(landingOf(CLEARED_KM), 'line');
  assert.equal(landingOf(-(CLEARED_KM + 1)), 'wide');
  assert.equal(landingOf(OFF_RANGE_KM + 1), 'off');
  assert.equal(wreckFound(1, 0), true);
  assert.equal(wreckFound(1, OFF_RANGE_KM + 5), false);
  assert.ok(WEATHERCOCK > 0);
});

test('a fresher balloon and a re-lay put more rounds on the line than the dawn lay', () => {
  const on = (layAt, fire) => {
    let n = 0;
    for (let s = 1; s < 1500; s++)
      n += landingOf(crossImpact(40, layFor(balloonAt(s, layAt)), crosswindAt(s, fire))) === 'line';
    return n;
  };
  assert.ok(on(605, 660) > on(420, 660) + 100);
});

const toCount = (seed = 7) => {
  newGame(seed);
  playRound(undefined, undefined, 'countReady');
  countStart();
};

test('a WAC count starts with the tower laid on the dawn balloon and a range window', () => {
  toCount();
  assert.ok(aimed());
  assert.equal(g.count.balloon.at, 'dawn');
  assert.equal(g.count.lay, layFor(g.count.balloon.cross));
  assert.equal(windowLeft(), RANGE_WINDOW);
});

test('the T-9:00 balloon comes in on the net and updates what the count room shows', () => {
  toCount();
  until(() => g.count.poll);
  assert.equal(g.count.balloon.at, 'T-9:00');
  assert.ok(g.loop.some(l => /Balloon at T-9:00/.test(l.text ?? l)));
});

test('a hold runs the range clock; a re-lay recycles the count to T-7:30 with the new lay', () => {
  toCount();
  until(() => g.count.poll);
  countAnswer(false);
  const left = windowLeft();
  for (let i = 0; i < 30 * 20; i++) tick(1 / 30);
  assert.ok(windowLeft() < left, 'holding costs range time');
  countRelay(-3.2);
  until(() => !g.count.checking);
  assert.equal(g.count.lay, -3);
  assert.equal(g.count.clock, 450);
  assert.ok(windowLeft() <= left - 30);
});

test('a pad leak check that runs past the window scrubs the day: the round waits and is late', () => {
  toCount();
  until(() => g.count.poll);
  countAnswer(false);
  countLeakCheck();
  until(() => g.beat === 'scrubbed' || !g.count?.checking);
  // Two hours of pad leak check against a two-hour window, with the recycle still to come.
  assert.equal(g.beat, 'scrubbed');
  assert.equal(g.decided.late, 1);
  assert.ok(g.notes.some(n => /scrubbed/.test(n.text)));
  const day = g.day;
  nextDay();
  until(() => g.beat === 'countReady');
  assert.equal(g.day, day + 1);
  countStart();
  assert.equal(windowLeft(), RANGE_WINDOW, 'a new window for the new day');
});

test('she flies to where the lay and the wind at liftoff put her, and the recovery says so', () => {
  for (let seed = 1; seed < 40; seed++) {
    newGame(seed);
    playRound(undefined, undefined, 'poll');
    while (g.count?.poll) {
      countAnswer(true);
      until(() => g.beat === 'recovery' || g.count?.poll);
    }
    const f = g.round.flight;
    if (f.failure && f.range < 2) continue;
    assert.ok(['line', 'wide', 'off'].includes(f.landing), `seed ${seed}`);
    rideOut();
    until(() => g.room === 'recovery');
    assert.match(g.recovery[0], /range line/);
    return;
  }
  assert.fail('no round flew far enough');
});

test('a wreck nobody found leaves Ellis less sure, and the tracking film helps', () => {
  let found = 0,
    lost = 0,
    filmed = 0;
  for (let seed = 1; seed < 600; seed++) {
    const r = newRound(seed, undefined, 'wac');
    r.flight = { failure: 'weld' };
    found += ellisReading(r) === 'weld';
    const u = newRound(seed, undefined, 'wac');
    u.flight = { failure: 'weld' };
    u.unfound = true;
    lost += ellisReading(u) === 'weld';
    const fm = newRound(seed, undefined, 'wac');
    fm.flight = { failure: 'weld' };
    fm.unfound = fm.filmed = true;
    filmed += ellisReading(fm) === 'weld';
  }
  assert.ok(found > filmed && filmed > lost, `${found} ${filmed} ${lost}`);
});

test('only the rounds flown unguided off a tower are laid: not the guided V-2, Bumper or Viking', () => {
  assert.deepEqual(AIMED, ['wac', 'aerobee']);
});
