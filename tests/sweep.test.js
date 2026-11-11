// A bot plays the whole campaign, 1945 to Artemis IV, on a handful of seeds and both telecall answers: no stall, no
// astronaut on a crew twice, and no one lost flies again. The seeds are fixed, so a failure here always reproduces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission } from './play.js';
import { g, crewOf, lossDays } from '../js/game.js';
import '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';

const SEEDS = [107, 113, 116, 124, 131, 142];

for (const seed of SEEDS) {
  const joint = seed % 2 ? 'press' : 'hold';
  test(`seed ${seed} (${joint} at the telecall) plays 1945 to the season end at Artemis IV`, () => {
    campaignTo(seed, 'artemis-4', { sims: 0, joint });
    playMission({ sims: 0, joint });
    assert.equal(g.beat, 'seasonEnd');
    const lost = lossDays();
    for (let i = 0; i < SEASON.length; i++) {
      const crew = crewOf(i) || [];
      assert.equal(new Set(crew).size, crew.length, `${SEASON[i].id}: ${crew}`);
      // Nobody lost flies a round that starts after the loss.
      for (const who of crew)
        assert.ok(!(lost[who] < SEASON[i].start), `${who} flies ${SEASON[i].id} after being lost`);
    }
    for (const r of g.record.rounds) {
      const m = /The crew, (.*?), were killed/.exec(r.flight || '');
      if (m) {
        const names = m[1].split(/ and |, /);
        assert.equal(new Set(names).size, names.length, `${r.id}: ${m[1]}`);
      }
    }
  });
}
