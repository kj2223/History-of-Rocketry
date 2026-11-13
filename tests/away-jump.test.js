// Aaron's playtest, 13 November: Viking 5, a full-duration firing, then the turbine casing welded and the steam feed
// reworked. Closing the dugout on Monday morning and waking on Wednesday read like a clock that had run for 30-odd hours.
// The jump is right (the rework and the chamber check share one slipped day), and the away card now says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  standStart,
  standDecide,
  closeAway,
  finishPlan,
  finishInspection,
  finishBoard,
  endDay,
  awaySpan,
} from '../js/game.js';
import { campaignTo, until, nextDay } from './play.js';

test('a full-duration firing and a rework slip one day, and the away card names the day it jumps', () => {
  campaignTo(11, 'viking-5');
  closeAway();
  finishPlan({ inspector: 'you', burn: 'long', leak: false });
  if (g.plan.inspector !== 'you') until(() => g.beat === 'board');
  if (g.beat === 'brief') finishInspection({});
  finishBoard();
  nextDay();
  until(() => g.beat === 'static');
  const fired = g.day,
    slipped = g.slipDays;
  standStart();
  until(() => g.stand.phase === 'read');
  standDecide({ rework: true, leak: false });
  assert.equal(g.slipDays - slipped, 1, 'the firing and the rework share one day');
  assert.ok(g.dayDone);
  endDay();
  until(() => !g.fading);
  assert.equal(g.beat, 'rollout');
  assert.equal(g.day - fired, 2, 'fired Monday, rework Tuesday, rollout Wednesday');
  assert.equal(g.room, 'away');
  assert.equal(g.away.skipped, 1);
  assert.match(g.away.lines.join(' '), /one day, not two/);
  assert.match(awaySpan(g.away.skipped), /A whole day passed/);
});

test('the away line counts the days it jumps over', () => {
  assert.match(awaySpan(1), /^A whole day passed .* over it /);
  assert.match(awaySpan(3), /^3 whole days passed .* over them /);
});
