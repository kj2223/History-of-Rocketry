// The two game modes keep separate saves: a Flight Director save is written exactly as before, a management save goes
// in its own slot, and neither loads as the other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, checkpoint, checkCheckpoint } from '../js/game.js';
import {
  exportSave,
  writeSave,
  readSave,
  parseSave,
  startOver,
  readBackup,
  memoryStorage,
  KEYS,
  MANAGEMENT,
  FORMAT,
  CONTENT_VERSION,
  SaveError,
} from '../js/core/save.js';
import { newManagement, checkManagement, managementWhere, START_DAY } from '../js/manage/state.js';
import { dayOf } from '../js/core/calendar.js';

test('a Flight Director save is written as it always was, with no mode field', () => {
  newGame(11);
  const env = JSON.parse(exportSave(checkpoint()));
  assert.deepEqual(Object.keys(env), ['format', 'contentVersion', 'checkpoint']);
  assert.equal(env.format, FORMAT);
  assert.equal(env.contentVersion, CONTENT_VERSION);
});

test('a management game starts on NASA’s first day at the Cape', () => {
  const m = newManagement(3);
  assert.equal(m.day, dayOf(1958, 10, 1));
  assert.equal(START_DAY, m.day);
  assert.equal(managementWhere(m), 'Cape Canaveral, 1 October 1958');
  checkManagement(m);
});

test('the two modes save in separate slots and neither loads as the other', () => {
  const storage = memoryStorage();
  newGame(11);
  writeSave(storage, checkpoint());
  const m = newManagement(3);
  writeSave(storage, m, MANAGEMENT);
  assert.deepEqual(readSave(storage, checkManagement, MANAGEMENT), m);
  assert.equal(readSave(storage, checkCheckpoint).seed, 11);
  // A management save put where the Flight Director's should be is refused, and the other way round.
  assert.throws(() => parseSave(exportSave(m, MANAGEMENT), checkCheckpoint), SaveError);
  assert.throws(() => parseSave(exportSave(checkpoint()), checkManagement, MANAGEMENT), SaveError);
  assert.ok(Object.values(MANAGEMENT.keys).every(k => !Object.values(KEYS).includes(k)));
});

test('starting a new management game keeps the old one as its backup and leaves Flight Director alone', () => {
  const storage = memoryStorage();
  newGame(11);
  writeSave(storage, checkpoint());
  const first = { ...newManagement(3), day: START_DAY + 40 };
  writeSave(storage, first, MANAGEMENT);
  startOver(storage, checkManagement, MANAGEMENT);
  assert.equal(readSave(storage, checkManagement, MANAGEMENT), null);
  assert.deepEqual(readBackup(storage, checkManagement, MANAGEMENT), first);
  assert.equal(readSave(storage, checkCheckpoint).seed, 11);
  assert.equal(readBackup(storage, checkCheckpoint), null);
});

test('a damaged management save is refused', () => {
  for (const bad of [null, { kind: 'flight' }, { ...newManagement(1), day: 10 }, { ...newManagement(1), site: 'moon' }])
    assert.throws(() => checkManagement(bad));
});
