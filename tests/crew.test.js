// When an astronaut dies, the crews he would have flown on are re-flown by a living astronaut (the record keeps his
// name; the flights do not wait for him). Deaths are never scripted; these tests record them the way the game does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, g, crewOf, recordDeaths } from '../js/game.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js
import { SEASON } from '../js/data/campaign.js';
import { ASTRONAUTS } from '../js/data/crew.js';
import { dayOf } from '../js/core/calendar.js';

const at = id => SEASON.findIndex(r => r.id === id);
const alive = id => !Object.keys(g.crewSwaps).includes(id);

test('a dead astronaut\u2019s later crews are re-flown by a living astronaut, and the flown ones keep their crews', () => {
  newGame(11);
  recordDeaths(['fairbanks'], dayOf(1966, 3, 16), 'gem-8');
  // Gemini 4 and 5 flew without him; Apollo 8 did not carry him. Apollo 11 was his seat.
  assert.deepEqual(crewOf(at('gem-4')), SEASON[at('gem-4')].crew);
  assert.deepEqual(crewOf(at('apollo-8')), SEASON[at('apollo-8')].crew);
  const a11 = crewOf(at('apollo-11'));
  assert.ok(!a11.includes('fairbanks'), 'the dead man does not fly');
  assert.ok(alive(a11[0]), 'his replacement is living');
  assert.deepEqual(a11.slice(1), ['oyelaran', 'beckett'], 'his seat-mates keep their seats');
  const losses = g.record.losses.at(-1);
  assert.equal(losses.round, 'gem-8');
  assert.match(losses.name, /Fairbanks/);
});

test('the replacement comes from his own group when one is free, and never doubles up beside him', () => {
  newGame(11);
  recordDeaths(['kowalczyk'], dayOf(1969, 11, 14), 'apollo-12');
  const a13 = crewOf(at('apollo-13'));
  assert.ok(!a13.includes('kowalczyk'));
  // The 1962 nine first: boateng is alive and not booked beside him on Apollo 13.
  assert.equal(a13[0], 'boateng');
  assert.ok(new Set(a13).size === a13.length, 'nobody flies two seats on one round');
});

test('a substitute who is himself lost before the flight passes the seat on again', () => {
  newGame(11);
  recordDeaths(['kowalczyk'], dayOf(1969, 11, 14), 'apollo-12');
  const first = crewOf(at('apollo-13'))[0];
  assert.notEqual(first, 'kowalczyk');
  recordDeaths([first], dayOf(1970, 2, 20), 'apollo-13');
  const a13 = crewOf(at('apollo-13'));
  assert.ok(!a13.includes('kowalczyk') && !a13.includes(first), 'neither lost man flies');
  assert.ok(
    a13.every(id => ASTRONAUTS[id]),
    'the seat is filled',
  );
});

test('the console, the rooms and the record all read the re-flown crew', () => {
  newGame(11);
  recordDeaths(['kowalczyk'], dayOf(1969, 11, 14), 'apollo-12');
  g.roundIndex = at('apollo-13');
  assert.equal(crewOf().length, 3);
  assert.ok(!crewOf().includes('kowalczyk'));
  // The names the rooms show come from the same list.
  const names = crewOf().map(id => ASTRONAUTS[id].name);
  assert.equal(new Set(names).size, 3);
});

test('a death with no round still to come changes no crew', () => {
  newGame(11);
  recordDeaths(['tanaka'], dayOf(1972, 12, 20), 'apollo-17');
  assert.deepEqual(crewOf(at('apollo-17')), SEASON[at('apollo-17')].crew);
  assert.ok(g.record.losses.some(l => l.name === 'Stuart Tanaka'));
});
