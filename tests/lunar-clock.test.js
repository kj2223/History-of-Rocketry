// A lunar shot's cruise and encounter run on the calendar hour for hour: the game's clock at closest approach or impact is
// injection plus the cruise the tracking shows, and the clock never runs backwards across the night.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g } from '../js/game.js';
import { campaignTo, playRound } from './play.js';
import { CRUISE_HOURS } from '../js/truth/lunar.js';

test('Pioneer 4: forty hours of cruise are forty hours of the calendar', () => {
  campaignTo(7, 'pioneer-4');
  let injected = null,
    arrived = null,
    last = -Infinity,
    backwards = false;
  const watch = () => {
    if (g.clock < last - 1e-6) backwards = true;
    last = g.clock;
    const d = g.round.flight?.deep;
    if (d?.injectedAt != null && injected == null) injected = d.injectedAt;
    if (g.lunar?.phase === 'encounter' && g.lunar.minutes === 0 && arrived == null) arrived = g.clock;
  };
  let sp = 1;
  Object.defineProperty(g, 'speed', {
    get: () => sp,
    set: v => {
      sp = v;
      watch();
    },
    configurable: true,
  });
  try {
    playRound(() => 'nominal');
  } finally {
    delete g.speed;
    g.speed = sp;
  }
  assert.ok(injected != null, 'she was injected');
  assert.ok(!g.round.flight.deep.fallsBack, 'this seed reaches the Moon');
  assert.ok(arrived != null, 'she reached the Moon');
  const hours = (arrived - injected) / 60;
  assert.ok(
    Math.abs(hours - CRUISE_HOURS.juno) < 0.5,
    `the calendar moved ${hours.toFixed(1)} h, not ${CRUISE_HOURS.juno}`,
  );
  assert.equal(g.day, Math.floor(g.clock / 1440));
  assert.equal(backwards, false, 'the clock ran backwards');
});
