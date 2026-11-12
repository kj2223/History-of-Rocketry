// The flight director's console panel draws at every call it carries, from either seat (issue: the recovery poll
// never showed because the panel threw "g is not defined" every frame, so the count stood still with no buttons).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpoint, g, newGame } from '../js/game.js';
import '../js/mercury.js';
import { drawControlRoom } from '../js/site/draw.js';

const ctx = new Proxy(
  {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: s => ({ width: String(s).length * 7 }),
  },
  { get: (target, key) => target[key] ?? (() => {}) },
);

function seated(seat, roundId) {
  newGame(6);
  const save = checkpoint();
  save.record.seat = seat;
  newGame(6, { ...save, roundId, beat: 'mBrief' });
  g.room = 'console';
}

const consoleAt = extra => ({
  kind: 'flight',
  phase: 'count',
  poll: null,
  clock: 600,
  orbital: true,
  flightId: g.round.id,
  cond: { seaState: 2 },
  calls: { poll: [] },
  trace: [{ t: 120, gamma: 20, off: 0.4, v: 3, acc: 2, stage: 1 }],
  lines: [],
  chatter: [],
  lamps: {},
  live: true,
  ...extra,
});

const cases = [
  { poll: 'recovery' },
  { poll: 'final', clock: 60 },
  { phase: 'insertion' },
  { phase: 'ip', ip: { retro: 14, radar: 3, telemetry: 5, planned: 0 } },
  { phase: 'orbit' },
  { phase: 'retro' },
];

for (const seat of ['flight', 'retro'])
  for (const roundId of ['gem-6', 'gem-12'])
    test(`the console panel draws at every call: ${seat} seat, ${roundId}`, () => {
      seated(seat, roundId);
      for (const extra of cases) {
        g.console = consoleAt(extra);
        assert.doesNotThrow(() => drawControlRoom(ctx, g, { w: 1600, h: 900 }), JSON.stringify(extra));
      }
    });
