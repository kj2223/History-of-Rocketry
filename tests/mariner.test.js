import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON } from '../js/data/campaign.js';
import * as game from '../js/game.js';
const { checkCheckpoint, checkpoint, newGame, nextIndex, roomFor, advanceProbe } = game;

const at = id => SEASON.findIndex(round => round.id === id);

test('the Mariner missions bracket Ranger 7 on the JPL route', () => {
  newGame(14);
  for (const [from, to] of [
    ['pioneer-4', 'mariner-2'],
    ['mariner-2', 'ranger-7'],
    ['ranger-7', 'mariner-4'],
  ]) {
    assert.equal(SEASON[nextIndex(at(from))].id, to);
  }
  game.g.record.path = 'nasa';
  assert.equal(SEASON[nextIndex(at('pioneer-4'))].id, 'mr-1');
});

test('each Mariner encounter resumes at the office and records its own science', () => {
  for (const id of ['mariner-2', 'mariner-4']) {
    newGame(14);
    const round = SEASON[at(id)];
    newGame(14, { ...checkpoint(), roundId: id, day: round.start, beat: 'probeHandover' });
    assert.equal(roomFor('office'), 'probeHandover');
    advanceProbe();
    const encounter = checkpoint();
    checkCheckpoint(encounter);
    newGame(14, encounter);
    assert.equal(roomFor('office'), 'probeEncounter');
    assert.equal(game.g.day, round.probe.encounter);
    advanceProbe(true);
    if (id === 'mariner-4') {
      assert.equal(roomFor('office'), 'probePlayback');
      assert.equal(game.g.record.rounds.length, 0);
      advanceProbe(true);
    }
    assert.equal(game.g.record.rounds.at(-1).id, id);
    assert.match(game.g.record.rounds.at(-1).flight, id === 'mariner-2' ? /radiometer/i : /images/i);
  }
});

test('a Mariner 4 flyby left in cruise mode records tracking without images', () => {
  newGame(14);
  const round = SEASON[at('mariner-4')];
  newGame(14, { ...checkpoint(), roundId: round.id, day: round.probe.encounter, beat: 'probeEncounter' });
  advanceProbe(false);
  assert.equal(game.g.beat, 'roundEnd');
  assert.match(game.g.record.rounds.at(-1).flight, /tracking but no images/);
});
