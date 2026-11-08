// Saves from earlier builds carry on, and a room opens on its own when its work is ready and you are already there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, g, roundIndexOf, place } from '../js/game.js';
import { SEASON } from '../js/data/campaign.js';
import { PLACES } from '../js/data/white-sands.js';
import { openWhenReady } from '../js/scenes/rooms.js';
import { playRound, advance, until, nextDay } from './play.js';
import { finishInspection, finishBoard, standStart, standDecide } from '../js/game.js';

const at = id => SEASON.findIndex(r => r.id === id);

test('a checkpoint saved before the crewed rounds went in finds its round by vehicle and date', () => {
  newGame(5);
  while (SEASON[g.roundIndex].id !== 'pioneer-4') {
    playRound();
    advance(false);
  }
  playRound();
  advance(false);
  assert.equal(SEASON[g.roundIndex].id, 'ranger-7');
  const old = structuredClone(g.saved);
  delete old.roundId;
  old.roundIndex = 18; // where Ranger 7 sat before Mercury, Gemini and Apollo
  assert.equal(roundIndexOf(old), at('ranger-7'));
  newGame(old.seed, old);
  assert.equal(SEASON[g.roundIndex].id, 'ranger-7');
  assert.equal(g.vehicle, 'ranger');
  playRound();
  assert.equal(g.beat, 'seasonEnd');
});

test('an old round-end after Pioneer 4 is given the NASA offer it never had', () => {
  newGame(9);
  while (SEASON[g.roundIndex].id !== 'pioneer-4') {
    playRound();
    advance(true);
  }
  playRound();
  const old = structuredClone(g.saved);
  old.record.offers = old.record.offers.filter(o => o.seat !== 'retro');
  delete old.roundId;
  newGame(old.seed, old);
  assert.ok(g.record.offers.some(o => o.seat === 'retro'));
});

test('standing at the dugout when the stage reaches the stand opens the static fire', () => {
  newGame(3);
  finishInspection({});
  finishBoard();
  nextDay();
  assert.equal(g.beat, 'staticPrep');
  openWhenReady(false);
  place('you', PLACES.dugout.door);
  g.room = null;
  until(() => g.beat === 'static');
  openWhenReady(false);
  assert.equal(g.room, 'static');
  // Closed, it stays closed.
  g.room = null;
  openWhenReady(false);
  assert.equal(g.room, null);
});

test('a watch panel open on the blockhouse switches to the count when the round is in the tower', () => {
  newGame(3);
  finishInspection({});
  finishBoard();
  nextDay();
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
  standDecide({ rework: false, leak: false });
  nextDay();
  assert.equal(g.beat, 'rollout');
  g.room = 'watch:blockhouse';
  until(() => g.beat === 'countReady');
  openWhenReady(false);
  assert.equal(g.room, 'count');
  assert.ok(g.count);
});

test('starting a new game keeps the old one as the backup, and going back swaps them', async () => {
  const { writeSave, readSave, startOver, readBackup, swapBackup, memoryStorage } = await import('../js/core/save.js');
  const { checkCheckpoint } = await import('../js/game.js');
  const storage = memoryStorage();
  newGame(5);
  playRound();
  advance(false);
  const later = structuredClone(g.saved);
  writeSave(storage, later);
  startOver(storage);
  assert.equal(readSave(storage, checkCheckpoint), null);
  assert.equal(readBackup(storage, checkCheckpoint).roundIndex, later.roundIndex);
  newGame(6);
  writeSave(storage, g.saved);
  assert.ok(swapBackup(storage));
  assert.equal(readSave(storage, checkCheckpoint).seed, 5);
  assert.equal(readBackup(storage, checkCheckpoint).seed, 6);
});
