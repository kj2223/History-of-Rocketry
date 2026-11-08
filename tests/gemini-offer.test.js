// The way back from the uncrewed years (C1): after Ranger 7, Houston offers Gemini to a player who declined the 1959
// offer or was passed over, and taking it jumps the calendar to Gemini 4 on the NASA path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, g, morning, answerFirstOffer } from '../js/game.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js; this test reaches Mercury
import { SEASON } from '../js/data/campaign.js';
import { pendingOffer } from '../js/career/record.js';

const at = id => SEASON.findIndex(r => r.id === id);

// A JPL-path player written up through Ranger 7: stayed junior, never took the NASA offer, stranded at the season end.
function stranded() {
  newGame(11);
  g.record.path = undefined;
  g.record.rounds.push({
    id: 'ranger-7',
    vehicle: 'ranger',
    name: 'Ranger 7',
    day: SEASON[at('ranger-7')].start + 2,
    flight: 'Lost at 40 seconds.',
  });
  g.roundIndex = at('ranger-7');
  g.day = SEASON[at('ranger-7')].start + 3;
  g.vehicle = 'ranger';
}

test('at the end of the uncrewed years, Houston offers Gemini', () => {
  stranded();
  morning('seasonEnd');
  const o = g.record.offers[g.record.offers.length - 1];
  assert.equal(o.seat, 'flight');
  assert.ok(o.made, 'the offer is made however the record stands: it is the branch\u2019s last round');
  assert.equal(o.path, 'nasa');
  assert.ok(o.text.includes('Houston is staffing Gemini'));
  assert.ok(pendingOffer(g.record));
});

test('taking it joins Houston and jumps the calendar to Gemini 4', () => {
  stranded();
  morning('seasonEnd');
  answerFirstOffer(true);
  assert.equal(g.record.seat, 'flight');
  assert.equal(g.record.path, 'nasa');
  assert.equal(SEASON[g.roundIndex].id, 'gem-4');
  assert.ok(g.away, 'the while-you-were-away note covers 1964 to 1965');
  assert.equal(g.away.to, 'Wednesday 2 June 1965'); // Gemini 4's first morning; the launch itself is two days in
});

test('turning it down keeps the uncrewed ending, and the offer is not remade', () => {
  stranded();
  morning('seasonEnd');
  answerFirstOffer(false);
  assert.equal(g.beat, 'seasonEnd');
  assert.notEqual(g.record.path, 'nasa');
  assert.equal(g.record.seat, 'junior');
  const count = g.record.offers.length;
  morning('seasonEnd');
  assert.equal(g.record.offers.length, count);
});

test('a checkpoint stranded before this existed is rescued when it loads', () => {
  stranded();
  morning('seasonEnd');
  const saved = g.saved;
  saved.record.offers = saved.record.offers.filter(o => o.seat !== 'flight'); // a save from before the way back existed
  newGame(saved.seed, saved);
  const o = g.record.offers[g.record.offers.length - 1];
  assert.equal(o.seat, 'flight');
  assert.ok(pendingOffer(g.record));
  answerFirstOffer(true);
  assert.equal(SEASON[g.roundIndex].id, 'gem-4');
});

test('a NASA-path player at the end of Apollo is not offered Gemini again', () => {
  newGame(11);
  g.record.path = 'nasa';
  g.record.seat = 'director';
  g.record.rounds.push({
    id: 'apollo-15',
    vehicle: 'saturn5',
    name: 'Apollo 15',
    day: SEASON[at('apollo-15')].start + 2,
    flight: 'In orbit: perigee about 100 km, apogee about 120 km.',
  });
  g.roundIndex = at('apollo-15');
  g.day = SEASON[at('apollo-15')].start + 3;
  g.vehicle = 'saturn5';
  morning('seasonEnd');
  assert.ok(!g.record.offers.some(o => o.seat === 'flight' && o.day >= SEASON[at('apollo-15')].start));
});
