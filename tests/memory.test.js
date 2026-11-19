// What people remember: said once at a later mission, gone when the person leaves the desk, and a boss's memory can
// move their trust in your judgement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { remember, recall, memoriesOf } from '../js/world/memory.js';

test('a memory is said once, by the person who holds it', () => {
  const record = {},
    people = { hollis: { name: 'A' }, kessler: { name: 'B' } };
  remember(record, people, 'hollis', 'one', { trust: 1 });
  remember(record, people, 'kessler', 'two');
  const m = recall(record, people);
  assert.equal(m.text, 'one');
  assert.equal(m.trust, 1);
  assert.equal(recall(record, people).text, 'two');
  assert.equal(recall(record, people), null);
  assert.equal(memoriesOf(record, people, 'hollis').length, 1);
});

test('a memory leaves with the person', () => {
  const record = {},
    people = { hollis: { name: 'A' } };
  remember(record, people, 'hollis', 'one');
  people.hollis = { name: 'C' };
  assert.equal(recall(record, people), null);
  assert.equal(memoriesOf(record, people, 'hollis').length, 0);
});

// In the game: a lost crew is remembered at the start of the next mission.
import { g, newGame } from '../js/game.js';
import { startMission } from '../js/mercury.js';

test('the next mission opens with a memory, and its trust is applied', () => {
  newGame(4);
  g.record.trust = 0;
  remember(g.record, g.people, 'hollis', 'I was wrong on that one.', { trust: 1 });
  startMission();
  assert.equal(g.record.trust, 1);
  assert.ok(g.notes.some(n => /I was wrong on that one/.test(n.text)));
});
