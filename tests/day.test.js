// Work days, the jump past days that need nobody in your seat, and saving and resuming a morning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { g, newGame, tick, finishInspection, finishBoard, endDay, standStart, standDecide, checkpoint, checkCheckpoint, closeAway, dateText } from '../js/game.js';
import { exportSave, parseSave, writeSave, readSave, clearSave, memoryStorage, KEYS } from '../js/core/save.js';

// Run the site until `done()` is true, at top speed, as the frame loop would.
const until = (done, limit = 20000) => { g.speed = 16; for (let i = 0; i < limit && !done(); i++) tick(0.05); assert.ok(done(), `stuck at beat ${g.beat}`); };
const nextDay = () => { endDay(); until(() => !g.fading); };
const toStaticChoice = rework => {
  finishInspection({}); finishBoard(); nextDay();
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
  standDecide({ rework, leak: false });
};

test('the round starts on Tuesday 9 October 1945 with a checkpoint for that morning', () => {
  newGame(42);
  assert.equal(dateText(), 'Tuesday 9 October 1945');
  const c = checkpoint();
  assert.equal(c.beat, 'brief');
  checkCheckpoint(JSON.parse(JSON.stringify(c)));
});

test('a day with nothing for you is skipped, and told as "while you were away"', () => {
  newGame(42);
  toStaticChoice(true);
  nextDay();
  assert.equal(dateText(), 'Friday 12 October 1945');
  assert.equal(g.room, 'away');
  assert.equal(g.away.from, 'Wednesday 10 October 1945');
  assert.ok(g.away.lines.some(l => l.startsWith('Thursday 11 October 1945: The crew spent the day reworking the igniter')));
  closeAway();
  assert.equal(g.room, null);
  assert.equal(g.beat, 'rollout');
});

test('without a slip the next morning follows directly, with no card unless the crew worked overnight', () => {
  newGame(42);
  toStaticChoice(false);
  nextDay();
  assert.equal(dateText(), 'Thursday 11 October 1945');
  assert.ok(!g.away || g.away.lines.every(l => l.startsWith('Overnight')));
});

test('a saved morning resumes as the same round on the same day, and the hidden truth carries over', () => {
  newGame(7);
  finishInspection({ fins: true }); finishBoard(); nextDay();
  const storage = memoryStorage();
  writeSave(storage, checkpoint());
  const before = { faults: { ...g.round.faults }, notes: g.notes.length, day: g.day, rng: structuredClone(g.round.rng) };
  const saved = readSave(storage, checkCheckpoint);
  newGame(saved.seed, saved);
  assert.equal(g.day, before.day);
  assert.equal(g.beat, 'staticPrep');
  assert.deepEqual(g.round.faults, before.faults);
  assert.deepEqual(g.round.rng, before.rng);
  assert.equal(g.notes.length, before.notes);
  assert.deepEqual(g.flagged, { fins: true });
});

test('a bad or foreign save is refused and never resumed', () => {
  newGame(3);
  const good = exportSave(checkpoint());
  assert.throws(() => parseSave('{nope', checkCheckpoint), /not a readable save/);
  assert.throws(() => parseSave(JSON.stringify({ format: 'per-aspera-v1', contentVersion: 4 }), checkCheckpoint), /not a Per Aspera save/);
  const bad = JSON.parse(good); bad.checkpoint.beat = 'flight';
  assert.throws(() => parseSave(JSON.stringify(bad), checkCheckpoint), /damaged/);
  const storage = memoryStorage();
  storage.setItem(KEYS.current, JSON.stringify(bad));
  assert.equal(readSave(storage, checkCheckpoint), null);
  storage.setItem(KEYS.lastGood, good);
  assert.equal(readSave(storage, checkCheckpoint).beat, 'brief');
  clearSave(storage);
  assert.equal(readSave(storage, checkCheckpoint), null);
});

// What the player sees never reads the hidden truth: the site drawing and the rooms import nothing from js/truth,
// and the only parts of the round they read are the drawing office's estimate and the player's own propellant choice.
test('the site and the rooms only see what the player could see', () => {
  for (const dir of ['site', 'scenes']) for (const f of readdirSync(new URL(`../js/${dir}/`, import.meta.url))) {
    const src = readFileSync(new URL(`../js/${dir}/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from '\.\.\/truth\//, `${dir}/${f} imports the hidden truth`);
    for (const m of src.matchAll(/(?<![/\w-])round\.(\w+)/g)) assert.ok(['estimate', 'propellantLoad'].includes(m[1]), `${dir}/${f} reads round.${m[1]}`);
  }
});
