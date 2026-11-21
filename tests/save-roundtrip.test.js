// Saves round-trip at every kind of morning the game keeps: a WAC round, a Gemini launch morning, an Apollo landing's
// launch morning, the workshop meeting, a JPL probe's decision day and the Artemis IV finale. Each checkpoint goes
// through JSON as it does on disk, is checked, reloaded, and the reloaded game plays the round out exactly as the one
// that never stopped. A checkpoint from a build before this one's new rounds (an index that has since moved) still
// finds its round by its id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission, playRound, advance, carefulDecide } from './play.js';
import {
  g,
  newGame,
  nextRound,
  checkpoint,
  checkCheckpoint,
  roundIndexOf,
  advanceProbe,
  probeStep,
} from '../js/game.js';
import { exportSave, KEYS, memoryStorage, readSave, swapBackup, writeSave } from '../js/core/save.js';
import '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';

const at = id => SEASON.findIndex(r => r.id === id);
const disk = () => JSON.parse(JSON.stringify(checkpoint()));
// Reload a checkpoint as the game does at start-up.
const reload = saved => {
  checkCheckpoint(saved);
  newGame(saved.seed, saved);
};

test('a damaged launch checkpoint falls back to last-good and cannot replace it as a backup', () => {
  campaignTo(21, 'gem-6', { sims: 0 });
  const good = disk();
  const bad = exportSave({ ...good, beat: 'mLaunch', mission: null });
  const storage = memoryStorage();
  writeSave(storage, good);
  storage.setItem(KEYS.current, bad);

  const saved = readSave(storage, checkCheckpoint);
  assert.deepEqual(saved, good);
  reload(saved);
  assert.equal(g.beat, good.beat);

  storage.setItem(KEYS.backup, bad);
  assert.equal(swapBackup(storage, checkCheckpoint), false);
  assert.equal(storage.getItem(KEYS.lastGood), exportSave(good));
});

test('a bad checkpoint the game writes itself falls back to the morning before it', () => {
  newGame(31);
  const good = disk();
  const storage = memoryStorage();
  writeSave(storage, good);
  writeSave(storage, { ...good, beat: 'flight' });
  assert.deepEqual(readSave(storage, checkCheckpoint), good);
});

test('a damaged legacy crew-loss history falls back to last-good', () => {
  newGame(31);
  const good = disk();
  const bad = disk();
  delete bad.crewSwaps;
  bad.record.losses = {};
  const storage = memoryStorage();
  writeSave(storage, good);
  storage.setItem(KEYS.current, exportSave(bad));

  const saved = readSave(storage, checkCheckpoint);
  assert.deepEqual(saved, good);
  reload(saved);
});

test('the next round forecast survives a checkpoint reload', () => {
  newGame(4);
  playRound();
  nextRound();
  const lines = [...g.away.lines];
  assert.ok(lines.some(line => line.includes('forecast for the count')));
  reload(disk());
  assert.deepEqual(g.away.lines, lines);
});

const CREWED = [
  ['gem-6', 21],
  ['apollo-11', 22],
  ['sts-31', 23],
  ['artemis-4', 24],
];
for (const [id, seed] of CREWED)
  test(`a checkpoint on ${id}'s first morning reloads and flies the same flight`, () => {
    const opts = { sims: 0, decide: carefulDecide };
    campaignTo(seed, id, opts);
    const saved = disk();
    playMission(opts);
    const straight = g.record.rounds.at(-1);
    reload(saved);
    assert.equal(SEASON[g.roundIndex].id, id);
    assert.equal(g.day, saved.day);
    playMission(opts);
    const again = g.record.rounds.at(-1);
    assert.equal(again.id, id);
    assert.equal(again.flight, straight.flight);
  });

test('a WAC round saved on its first morning reloads and ends the same way', () => {
  newGame(31);
  const saved = disk();
  playRound();
  const straight = g.record.rounds.at(-1).flight;
  reload(saved);
  assert.equal(g.beat, saved.beat);
  playRound();
  assert.equal(g.record.rounds.at(-1).flight, straight);
});

test('the workshop meeting and a probe decision day are mornings that reload where they were', () => {
  campaignTo(3, 'apollo-17', { sims: 0 });
  playMission({ sims: 0 });
  advance(true);
  assert.equal(g.beat, 'sWorkshop');
  reload(disk());
  assert.equal(g.beat, 'sWorkshop');

  newGame(14);
  newGame(14, { ...checkpoint(), roundId: 'galileo', day: SEASON[at('galileo')].start, beat: 'probeHandover' });
  advanceProbe(true);
  const step = probeStep();
  assert.ok(step);
  reload(disk());
  assert.equal(probeStep(), step);
});

test('a checkpoint written before STS-31 and the JPL rounds went in finds its round by id, whatever its old index', () => {
  campaignTo(25, 'sts-61', { sims: 0 });
  const saved = disk();
  // In the build before, STS-61 sat one place earlier (no STS-31) and three places earlier on the JPL list.
  for (const shift of [1, 3]) {
    const old = { ...saved, roundIndex: saved.roundIndex - shift };
    assert.equal(roundIndexOf(old), at('sts-61'));
    reload(old);
    assert.equal(SEASON[g.roundIndex].id, 'sts-61');
  }
});
