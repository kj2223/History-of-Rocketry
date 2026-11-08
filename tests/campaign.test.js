// The whole campaign, 1945 to 2030: every round on the NASA path played end to end, ending with the return to the
// Moon at Artemis III. One long run; a stall anywhere fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission } from './play.js';
import { g, crewOf } from '../js/game.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js
import { SEASON, LAST_WORD } from '../js/data/campaign.js';
import { ASTRONAUTS } from '../js/data/crew.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';

const at = id => SEASON.findIndex(r => r.id === id);

test('the campaign plays from the first WAC Corporal to the season end at Artemis III', () => {
  campaignTo(8, 'artemis-3', { sims: 0 });
  playMission({ sims: 0 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'artemis-3');
  assert.equal(g.beat, 'seasonEnd');
  // The last word is the return to the Moon, and the build's end.
  assert.match(LAST_WORD['artemis-3'], /south pole/);
  // No seat above the shift ever came, and the record carries the whole run.
  assert.ok(!g.record.offers.some(o => o.seat === 'director'));
  assert.ok(g.record.rounds.length > 30, `${g.record.rounds.length} rounds on the record`);
  assert.ok(
    g.record.offers.some(o => o.seat === 'flight'),
    'the player held the Flight Director\u2019s seat',
  );
});

test('the Artemis flights: the free returns fly, and the landing follows the nine phases', () => {
  for (const id of ['artemis-1', 'artemis-2', 'artemis-3']) {
    const steps = FLIGHTS[id].steps;
    for (const st of steps) if (st.decide) assert.ok(DECISIONS[st.decide], `${id} ${st.decide}`);
    assert.ok(steps.at(-1).retro, id);
    for (const st of steps)
      if (st.decide && DECISIONS[st.decide].rule != null)
        assert.ok(FLIGHTS[id].rules[DECISIONS[st.decide].rule], `${id} ${st.decide} rule`);
  }
  // The flybys never descend; the landing does.
  assert.ok(!FLIGHTS['artemis-2'].steps.some(s => s.when === 'landed'));
  assert.ok(FLIGHTS['artemis-3'].steps.some(s => s.when === 'landed'));
});

test('a crew lost on the way to 2030 is replaced in every crew that follows', () => {
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
