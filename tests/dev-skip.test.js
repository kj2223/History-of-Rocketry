// The dev menu's jump: the bot plays up to the chosen round on either route, stops on its first morning or launch
// morning, and leaves a game that saves and resumes like any other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skipTo, stagesFor } from '../js/dev/skip.js';
import { g, checkpoint, checkCheckpoint } from '../js/game.js';
import { SEASON } from '../js/data/campaign.js';

const at = () => SEASON[g.roundIndex].id;

test('the menu lists the shared years on both routes, and each route its own rounds after Pioneer 4', () => {
  const nasa = stagesFor('nasa').map(r => r.id),
    jpl = stagesFor('jpl').map(r => r.id);
  assert.equal(nasa[0], 'wac-1');
  assert.equal(nasa.at(-1), 'artemis-4');
  assert.equal(jpl.at(-1), 'perseverance');
  assert.ok(nasa.includes('pioneer-4') && jpl.includes('pioneer-4'));
  assert.ok(!nasa.includes('ranger-7') && !jpl.includes('apollo-11'));
  assert.equal(nasa.length + jpl.length - 18, SEASON.length);
});

for (const [route, id, stop, beat] of [
  ['nasa', 'viking-7', 'morning', 'brief'],
  ['nasa', 'viking-7', 'launch', 'countReady'],
  ['nasa', 'ma-6', 'launch', 'mLaunch'],
  ['nasa', 'apollo-11', 'morning', 'mBrief'],
  ['jpl', 'ranger-7', 'launch', 'countReady'],
  ['jpl', 'voyager', 'morning', 'probeHandover'],
])
  test(`jumps to ${id} on the ${route} route, ${stop}`, () => {
    skipTo(id, { seed: 107, route, stop });
    assert.equal(at(), id);
    assert.ok([beat, 'mScrub'].includes(g.beat), g.beat);
    assert.equal(g.speed, 1);
    assert.equal(g.room, null);
    if (route === 'jpl') assert.notEqual(g.record.path, 'nasa');
    if (SEASON.find(r => r.id === id).path === 'nasa') assert.equal(g.record.path, 'nasa');
    checkCheckpoint(JSON.parse(JSON.stringify(checkpoint())));
  });

test('a round that is not in the game is refused', () => {
  assert.throws(() => skipTo('apollo-20', { seed: 107 }), /no round called apollo-20/);
});
