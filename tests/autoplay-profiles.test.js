// The automated playtest's bots (tools/autoplay/driver.js PROFILES): each one plays the Flight Director's whole game
// to the season's end without getting stuck, and makes the choices it is meant to make.
import test from 'node:test';
import assert from 'node:assert/strict';

// The driver looks at the page only to say where the player is; outside the window every panel is shut.
globalThis.document ??= { getElementById: () => ({ hidden: true }) };
const { PROFILES } = await import('../tools/autoplay/driver.js');
const a = globalThis.__autoplay;

function play(name, seed = 1945) {
  for (const k of Object.keys(a.handsOn)) delete a.handsOn[k];
  a.setProfile(name, seed);
  a.reseed(seed);
  a.startCampaign(null);
  const names = [];
  for (let i = 0; i < 6000; i++) {
    const s = a.step();
    assert.ok(!s.error, `${name} got stuck: ${s.error?.split('\n')[0]}`);
    names.push(s.name);
    if (s.done) break;
  }
  return { names, hands: { ...a.handsOn } };
}

for (const name of Object.keys(PROFILES))
  test(`the ${name} bot plays the whole game to the season's end`, () => {
    const { names } = play(name);
    assert.ok(names.includes('season-end'), `${name} never reached the season's end`);
  });

test('the bots choose differently: holds, reworks, declined offers', () => {
  assert.equal(play('steady').hands.countHolds, undefined, 'the steady bot never holds a count');
  const scrubby = play('scrubby').hands;
  assert.ok(scrubby.countHolds > 0 && scrubby.reworks > 0 && scrubby.boardHolds > 0, JSON.stringify(scrubby));
  assert.ok(play('cautious').hands.offersDeclined > 0, 'the cautious bot turns the offers down');
});

test("the random bot's choices repeat for the same seed", () => {
  const one = play('random', 7),
    two = play('random', 7);
  assert.deepEqual(one.names, two.names);
});

test('an unknown profile is refused', () => {
  assert.throws(() => a.setProfile('reckless'), /no bot profile/);
});
