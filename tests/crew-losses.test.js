// The crew-death rules across every era, and older saves carried into the Flight Director's 1945–2030 game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, crewOf, recordDeaths, lostIds, apolloFireLines, checkpoint, morning, nextIndex } from '../js/game.js';
import { toReview } from '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';
import { GROUPS } from '../js/data/crew.js';
import { apolloFire } from '../js/world/race.js';

const at = id => SEASON.findIndex(r => r.id === id);
const yearOfGroup = id => GROUPS.find(gr => gr.ids.includes(id)).year;

test('crew replacements survive reload, including older checkpoints that omitted the swaps', () => {
  newGame(1);
  const day = SEASON[at('demo-2')].start;
  recordDeaths(['sharma', 'larsen'], day, 'demo-2');
  const expected = crewOf(at('artemis-2'));
  morning('brief');
  const saved = structuredClone(checkpoint());
  assert.deepEqual(saved.crewSwaps, g.crewSwaps);
  newGame(1, saved);
  assert.deepEqual(crewOf(at('artemis-2')), expected);
  delete saved.crewSwaps;
  delete saved.record.losses[0].ids;
  newGame(1, saved);
  assert.deepEqual(crewOf(at('artemis-2')), expected);
  assert.equal(g.record.losses.length, 1);
});

test('a failed lunar rescue records both lander occupants and leaves the orbiter pilot alive', () => {
  newGame(1);
  g.roundIndex = at('apollo-11');
  const [commander, orbiterPilot, landerPilot] = crewOf();
  g.beat = 'mRecovery';
  g.mission = {};
  g.console = { round: { end: { lmLost: true } }, fate: 'safe' };
  toReview();
  assert.deepEqual(lostIds(), new Set([commander, landerPilot]));
  assert.ok(!lostIds().has(orbiterPilot));
});
// No one the game has lost is named on a round still to fly.
const noGhosts = after => {
  const gone = lostIds();
  for (let i = 0; i < SEASON.length; i++)
    if (SEASON[i].start > after)
      for (const who of crewOf(i) || []) assert.ok(!gone.has(who), `${who} flies ${SEASON[i].id} after being lost`);
};

test('a whole crew lost: nobody who died beside them takes their later seats', () => {
  newGame(1);
  const day = SEASON[at('sts-88')].start;
  recordDeaths(['okeke', 'farrow', 'delacroix'], day, 'sts-88');
  for (const who of ['okeke', 'farrow', 'delacroix']) assert.ok(!crewOf(at('sts-97')).includes(who));
  noGhosts(day);
});

test('someone lost on their last flight is never picked as a stand-in later', () => {
  newGame(1);
  recordDeaths(['carter', 'ellison'], SEASON[at('sts-1')].start, 'sts-1');
  const day = SEASON[at('sts-26')].start;
  recordDeaths(['donovan', 'vasquez', 'brennan'], day, 'sts-26');
  for (const who of ['carter', 'ellison']) assert.ok(!crewOf(at('sts-61')).includes(who));
  noGhosts(day);
});

test('stand-ins come from the most recent group selected before the flight, never from Mercury for Artemis', () => {
  newGame(1);
  const day = SEASON[at('demo-2')].start;
  recordDeaths(['sharma', 'larsen'], day, 'demo-2');
  for (const who of crewOf(at('artemis-2'))) assert.ok(yearOfGroup(who) >= 1996, `${who} flies Artemis II`);
  noGhosts(day);
});

test('the Apollo 1 fire takes the living crew, never a man already lost', () => {
  let seed = 1;
  while (!apolloFire(seed, { cabinRisk: 0.15 })) seed++;
  newGame(seed);
  recordDeaths(['whitcomb', 'castellano'], SEASON[at('gem-5')].start, 'gem-5');
  apolloFireLines();
  const fire = g.record.losses.at(-1);
  assert.equal(fire.round, 'apollo-1');
  assert.equal(fire.ids.length, 3);
  assert.ok(!fire.ids.includes('whitcomb') && !fire.ids.includes('castellano'), fire.name);
  noGhosts(fire.day);
});

// A v0.5.2 save: Apollo 15 was the last round, and the Center director's offer came with it.
const oldSeasonEnd = (offer, seat) => {
  newGame(3);
  const s = structuredClone(checkpoint());
  const i = at('apollo-15');
  Object.assign(s, { roundIndex: i, roundId: 'apollo-15', beat: 'seasonEnd', day: SEASON[i].start + 20 });
  s.clock = s.day * 1440;
  s.record.rounds.push({ id: 'apollo-15', name: 'Apollo 15', day: s.day, flight: 'Good' });
  s.record.offers.push({
    seat: 'director',
    title: 'Director, Manned Spacecraft Center',
    day: s.day,
    made: true,
    answer: offer,
  });
  s.record.path = 'nasa';
  if (seat) s.record.seat = seat;
  return s;
};

test('a season that ended at Apollo 15 in an older build carries on to Apollo 16', () => {
  newGame(3, oldSeasonEnd('declined', 'flight'));
  assert.equal(g.beat, 'roundEnd');
  assert.equal(SEASON[nextIndex()].id, 'apollo-16');
});

test('the Center director seat and its open offer are retired: the player is back on the flight director shift', () => {
  newGame(3, oldSeasonEnd('taken', 'director'));
  assert.equal(g.record.seat, 'flight');
  newGame(3, oldSeasonEnd(null, 'flight'));
  assert.equal(g.record.offers.at(-1).answer, 'withdrawn');
  assert.equal(g.beat, 'roundEnd');
  const s = oldSeasonEnd('declined', 'programme');
  newGame(3, s);
  assert.equal(g.record.seat, 'flight');
});

// Seed 116 once read "The crew, Edward Nakamura and Edward Nakamura, were killed": a stand-in was written back into
// crews that had already flown, beside the man he was standing in for.
test('a stand-in never reaches a crew that flew before the loss, and no crew names anyone twice', () => {
  for (const [i, r] of SEASON.entries()) {
    for (const lost of r.crew || []) {
      newGame(1);
      const day = SEASON[i].start + 1;
      recordDeaths([lost], day, r.id);
      for (let k = 0; k < SEASON.length; k++) {
        const crew = crewOf(k) || [];
        assert.equal(new Set(crew).size, crew.length, `${SEASON[k].id} after losing ${lost} on ${r.id}: ${crew}`);
        if (SEASON[k].start <= day) assert.deepEqual(crew, SEASON[k].crew || [], `${SEASON[k].id} rewritten`);
      }
    }
  }
});
