// The flight control team rotates out over the decades: each desk keeps its seat, and the person in it changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo } from './play.js';
import { g, who } from '../js/game.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js
import { SUCCESSIONS, holderIn } from '../js/data/cast.js';

test('the first holder keeps a seat until the first handover', () => {
  assert.equal(holderIn('hollis', 1975), null);
  assert.equal(holderIn('hollis', 1981).name, 'Ray Castellano');
  assert.equal(holderIn('hollis', 2028).name, 'David Okafor');
});

test('handovers come in order, after Mercury, and every name is used once', () => {
  const names = new Set();
  for (const [id, list] of Object.entries(SUCCESSIONS)) {
    list.forEach((s, i) => {
      assert.ok(s.from >= 1965, `${id} changes hands too early`);
      if (i) assert.ok(s.from > list[i - 1].from, `${id} out of order`);
      assert.ok(!names.has(s.name), `${s.name} twice`);
      names.add(s.name);
    });
  }
});

test('Apollo 11 has the Apollo team, the Shuttle has the next one, and the handover is in the notebook', () => {
  campaignTo(11, 'apollo-11');
  assert.equal(g.people.hollis.name, 'Frank Hollis');
  assert.equal(who('dorsey'), 'Dorsey');
  campaignTo(11, 'sts-1');
  assert.equal(g.people.hollis.name, 'Ray Castellano');
  assert.equal(who('reyes'), 'Ferrell');
  assert.equal(g.people.dorsey.name, 'Carl Dorsey', 'some of the Apollo faces stay for the Shuttle');
  assert.ok(g.notes.some(n => /Frank Hollis has retired\. Ray Castellano takes over/.test(n.text)));
  campaignTo(11, 'artemis-4');
  assert.equal(g.people.hollis.name, 'David Okafor');
  assert.equal(g.people.morgan.he, false);
});
