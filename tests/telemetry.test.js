// The playtest log: it follows a round without changing it, stays bounded however long the play, groups repeated
// errors, and never stops the game over a bad log.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, finishInspection, finishBoard, checkpoint } from '../js/game.js';
import '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';
import { exportSave } from '../js/core/save.js';
import {
  LIMITS,
  createLog,
  parseLog,
  serializeLog,
  startSession,
  record,
  recordError,
  recordMark,
  observe,
  clocks,
  clamp,
} from '../js/core/telemetry.js';
import { campaignTo, nextDay, until, playRound, advance } from './play.js';

const kinds = log => log.events.map(e => e.k);

test('the log follows a round: its faults, beats, decisions, checkpoints and outcome', () => {
  newGame(11);
  const log = createLog();
  startSession(log, { build: { version: 'test' } });
  const saveBefore = exportSave(checkpoint());
  let seen = observe(log, g, null, 'site');
  assert.deepEqual(kinds(log), ['newgame', 'round']);
  assert.equal(log.events[1].id, SEASON[0].id);
  assert.ok('faults' in log.events[1]);
  assert.equal(exportSave(checkpoint()), saveBefore, 'observing never changes the game');

  finishInspection({});
  seen = observe(log, g, seen, 'site');
  finishBoard();
  seen = observe(log, g, seen, 'site, panel board');
  nextDay();
  seen = observe(log, g, seen, 'site');
  assert.ok(kinds(log).includes('beat'));
  assert.ok(kinds(log).includes('scene'));
  assert.ok(kinds(log).includes('checkpoint'));

  playRound();
  seen = observe(log, g, seen, 'site');
  assert.equal(kinds(log).filter(k => k === 'outcome').length, g.record.rounds.length);
  advance();
  observe(log, g, seen, 'site');
  assert.equal(log.events.filter(e => e.k === 'round').length, 2);
  for (const e of log.events) {
    assert.equal(e.s, 1);
    assert.ok(Number.isFinite(e.t));
  }
  assert.ok(log.calls.length > 0, 'the loop lines are kept');
});

test('a whole campaign stays well under a megabyte of log', () => {
  const log = createLog();
  startSession(log, {});
  campaignTo(124, 'artemis-4', { sims: 0 });
  observe(log, g, null, 'site');
  for (let i = 0; i < 5000; i++) record(log, g, 'click', { on: 'button#endday', text: 'End the day'.repeat(3) });
  assert.equal(log.events.length, LIMITS.events);
  const size = serializeLog(log).length;
  assert.ok(size < 1_000_000, `log is ${size} characters`);
});

test('the same error each frame is one entry with a count', () => {
  newGame(3);
  const log = createLog();
  for (let i = 0; i < 500; i++)
    recordError(log, g, 'console.error', 'Frame skipped: x is undefined', 'Error\n    at draw (draw.js:10:5)');
  recordError(log, g, 'error', 'something else', '');
  assert.equal(log.errors.length, 2);
  assert.equal(log.errors[0].count, 500);
  for (let i = 0; i < 300; i++) recordError(log, g, 'error', `distinct ${i}`, '');
  assert.equal(log.errors.length, LIMITS.errors);
});

test('a bad or foreign log starts afresh instead of failing', () => {
  for (const text of ['', 'not json', '{"format":"other"}', '{"format":"ad-astra-playtest-log","version":99}'])
    assert.deepEqual(parseLog(text), createLog());
  const log = createLog();
  startSession(log, {});
  record(log, null, 'start');
  const back = parseLog(serializeLog(log));
  assert.equal(back.events.length, 1);
  assert.equal(back.sessions[0].n, 1);
});

test('big or odd fields are cut down, and marks carry both clocks', () => {
  assert.equal(clamp('x'.repeat(1000)).length, LIMITS.text);
  assert.equal(clamp({ a: 'y'.repeat(1000) }).a.length, LIMITS.text);
  const big = clamp(Array.from({ length: 1000 }, (_, i) => ({ i })));
  assert.equal(big.cut, true);
  const loop = {};
  loop.self = loop;
  assert.equal(clamp(loop), '[unreadable]');
  newGame(7);
  const log = createLog();
  const m = recordMark(log, g, { clocks: clocks(g) });
  assert.equal(m.n, 1);
  assert.equal(m.clocks.day, g.day);
});

test('lunar cruise clocks are recorded side by side', () => {
  const fake = { day: 1, clock: 600, speed: 1, lunar: { phase: 'cruise', h: 2, start: 300 } };
  assert.deepEqual(clocks(fake).lunar, { phase: 'cruise', h: 2, sinceInjectionH: 5 });
});
