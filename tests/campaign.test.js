// The whole campaign, 1945 to 2028: every round on the NASA path played end to end, ending with the return to the
// Moon at Artemis IV. One long run; a stall anywhere fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission } from './play.js';
import { checkpoint, checkCheckpoint, g, newGame, crewOf } from '../js/game.js';
import { render } from '../js/scenes/rooms.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js
import { SEASON, lastWord } from '../js/data/campaign.js';
import { ASTRONAUTS } from '../js/data/crew.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';

const at = id => SEASON.findIndex(r => r.id === id);

function epilogue() {
  const room = { dataset: {}, classList: { toggle() {} } };
  const original = globalThis.document;
  const previousRoom = g.room;
  globalThis.document = { getElementById: () => room };
  try {
    g.room = null;
    render();
    g.room = 'seasonEnd';
    render();
    return room.innerHTML.match(/<p class="muted">([^<]*)<\/p>/)?.[1];
  } finally {
    g.room = previousRoom;
    if (original) globalThis.document = original;
    else delete globalThis.document;
  }
}

test('the campaign plays from the first WAC Corporal to the season end at Artemis IV', () => {
  campaignTo(8, 'artemis-4', { sims: 0 });
  const launch = structuredClone(checkpoint());
  playMission({ sims: 0 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'artemis-4');
  assert.equal(g.beat, 'seasonEnd');
  assert.match(epilogue(), /walked.*south pole.*came home safely/);
  // No seat above the shift ever came, and the record carries the whole run.
  assert.ok(!g.record.offers.some(o => o.seat === 'director'));
  assert.ok(g.record.rounds.length > 30, `${g.record.rounds.length} rounds on the record`);
  assert.ok(
    g.record.offers.some(o => o.seat === 'flight'),
    'the player held the Flight Director\u2019s seat',
  );

  newGame(launch.seed, launch);
  playMission({ sims: 0, decide: d => (d.id === 'tlio' ? 'nogo' : Object.keys(d.options)[0]) });
  assert.match(epilogue(), /came home safely without landing on the Moon/);
});

test('the Artemis IV epilogue remembers the moonwalk and reports the crew lost on entry after reload', () => {
  campaignTo(10, 'artemis-4', { sims: 0 });
  playMission({ sims: 0 });
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  checkCheckpoint(saved);
  newGame(saved.seed, saved);
  const ending = epilogue();
  assert.match(ending, /walked.*south pole.*crew was lost/);
  assert.doesNotMatch(ending, /came home/);
});

test('the Artemis flights: the free returns fly, the lander is tried in Earth orbit, and the landing follows the nine phases', () => {
  for (const id of ['artemis-1', 'artemis-2', 'artemis-3', 'artemis-4']) {
    const steps = FLIGHTS[id].steps;
    for (const st of steps) if (st.decide) assert.ok(DECISIONS[st.decide], `${id} ${st.decide}`);
    assert.ok(steps.at(-1).retro, id);
    for (const st of steps)
      if (st.decide && DECISIONS[st.decide].rule != null)
        assert.ok(FLIGHTS[id].rules[DECISIONS[st.decide].rule], `${id} ${st.decide} rule`);
  }
  // The flybys never descend; the landing does.
  assert.ok(!FLIGHTS['artemis-2'].steps.some(s => s.when === 'landed'));
  assert.ok(!FLIGHTS['artemis-3'].steps.some(s => s.moon || s.lunar));
  assert.ok(FLIGHTS['artemis-4'].steps.some(s => s.when === 'landed'));
  // Orion, not the upper stage, makes the injection on the crewed flights.
  for (const id of ['artemis-2', 'artemis-4'])
    assert.ok(
      FLIGHTS[id].steps.some(s => s.decide === 'tlio'),
      id,
    );
});

test('a crew lost on the way to 2028 is replaced in every crew that follows', () => {
  campaignTo(8, 'artemis-2', { sims: 0, joint: 'press' });
  const gone = new Set(Object.keys(g.crewSwaps || {}));
  // Whatever the swaps, no lost astronaut is named on a round that has yet to fly.
  const day = g.day;
  for (let i = 0; i < SEASON.length; i++) {
    if (SEASON[i].start <= day) continue;
    for (const who of crewOf(i) || []) {
      assert.ok(!gone.has(who), `${ASTRONAUTS[who].name} flies ${SEASON[i].id} after being lost`);
    }
  }
});

test('the Artemis IV ending says what became of the crew, and whether they walked', () => {
  const round = SEASON.find(r => r.id === 'artemis-4');
  const walked = [{ id: 'traverse' }];
  const end = 'This is where the build ends.';
  assert.equal(
    lastWord(round, { fate: 'safe', decisions: walked }),
    `Artemis IV’s crew walked near the south pole of the Moon. The crew came home safely. ${end}`,
  );
  assert.equal(
    lastWord(round, { fate: 'safe', decisions: [] }),
    `The crew came home safely without landing on the Moon. ${end}`,
  );
  assert.equal(
    lastWord(round, { fate: 'hurt' }),
    `The crew returned with injuries without landing on the Moon. ${end}`,
  );
  assert.equal(lastWord(round, { fate: 'killed', decisions: walked }).includes('The crew was lost.'), true);
  assert.equal(
    lastWord(round, { fate: 'safe' }, [{ round: 'artemis-4', ids: ['x'] }]),
    `Members of the crew were lost. ${end}`,
  );
  assert.equal(lastWord(round, null), end);
});

test('the Artemis IV traverse is a real decision id', () => {
  assert.ok(DECISIONS.traverse); // lastWord looks for this id in the mission's decisions
});
