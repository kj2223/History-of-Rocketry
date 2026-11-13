// How the control room carries itself (js/stage/fx/moods.js): tense for the climb, the descent and entry; on its feet
// when a crew is home or down on the Moon; heads down when a crew is lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { roomMood } from '../js/stage/fx/moods.js';

test('at work, the room is calm; through the climb, the descent and entry it is tense', () => {
  assert.equal(roomMood({}, null), 'calm');
  assert.equal(roomMood({}, { phase: 'count' }), 'calm');
  assert.equal(roomMood({}, { phase: 'ascent' }), 'tense');
  assert.equal(roomMood({}, { phase: 'entry' }), 'tense');
  assert.equal(
    roomMood({}, { phase: 'mission', flight: { id: 'apollo-11', phase: 'Powered descent', at: 102.6 } }),
    'tense',
  );
});

test('down on the Moon, the room cheers for the first hour, then goes back to work', () => {
  assert.equal(
    roomMood({}, { phase: 'mission', flight: { id: 'apollo-11', phase: 'On the surface', at: 103.2 } }),
    'cheer',
  );
  assert.equal(
    roomMood({}, { phase: 'mission', flight: { id: 'apollo-11', phase: 'On the surface', at: 110 } }),
    'calm',
  );
});

test('a crew home safe brings the room to its feet; a lost crew, a lost capsule or a lost lander bows it', () => {
  assert.equal(roomMood({}, { phase: 'done', kind: 'flight', round: { end: { outcome: 'entry' } } }), 'cheer');
  assert.equal(roomMood({}, { phase: 'done', kind: 'flight', fate: 'killed', round: { end: {} } }), 'grief');
  assert.equal(roomMood({}, { phase: 'done', kind: 'flight', round: { end: { capsule: 'lost' } } }), 'grief');
  assert.equal(roomMood({}, { phase: 'done', kind: 'flight', round: { end: { lmLost: true } } }), 'grief');
  assert.equal(roomMood({}, { phase: 'done', kind: 'flight', fate: 'hurt', round: { end: {} } }), 'calm');
  assert.equal(roomMood({}, { phase: 'done', kind: 'sim', round: { end: {} } }), 'calm');
});
