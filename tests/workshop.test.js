// May 1973: the workshop goes up empty on the last Saturn V, and Mission Control meets before the first crew flies.
// Whether her shield tore away is the hidden layer's seeded draw; once she is in orbit the telemetry shows it to the room.
// How she flies empty, and whether the crew waits for the water tank, carry into Skylab 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission, advance } from './play.js';
import { g, newGame, nextRound } from '../js/game.js';
import {
  workshopDecide,
  workshopDone,
  workshopOpen,
  WORKSHOP_DAY,
  WORKSHOP_CALLS,
  missionRoomFor,
} from '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';
import { skylabShield } from '../js/world/race.js';
import { newRound } from '../js/truth/round.js';
import { flightTruth, resolve } from '../js/truth/flights.js';
import { initProgramme } from '../js/world/programme.js';

const LOST = 3,
  WHOLE = 7;
const toMeeting = seed => {
  campaignTo(seed, 'apollo-17', { sims: 0 });
  playMission({ sims: 0 });
  advance(true);
};

test('after Apollo 17 the calendar goes to the workshop meeting, 14 May 1973, in Mission Control', () => {
  assert.ok(skylabShield(LOST) && !skylabShield(WHOLE));
  toMeeting(LOST);
  assert.equal(g.beat, 'sWorkshop');
  assert.equal(g.day, WORKSHOP_DAY);
  assert.equal(missionRoomFor('office'), 'workshop');
  // A morning checkpoint: quitting here resumes in the meeting.
  newGame(g.saved.seed, structuredClone(g.saved));
  assert.equal(g.beat, 'sWorkshop');
});

test('a torn shield puts two calls to the room, in order; a whole workshop puts none', () => {
  toMeeting(LOST);
  assert.deepEqual(workshopOpen(), ['attitude', 'crew']);
  workshopDone(); // not yet: the calls are open
  assert.equal(g.beat, 'sWorkshop');
  workshopDecide('crew', 'wait'); // out of order: ignored
  assert.deepEqual(workshopOpen(), ['attitude', 'crew']);
  workshopDecide('attitude', 'sun');
  workshopDecide('crew', 'rush');
  assert.deepEqual(workshopOpen(), []);
  assert.deepEqual(
    { attitude: g.record.scenes.workshop.attitude, crew: g.record.scenes.workshop.crew },
    { attitude: 'sun', crew: 'rush' },
  );
  workshopDone();
  nextRound();
  assert.equal(SEASON[g.roundIndex].id, 'skylab-2');

  toMeeting(WHOLE);
  assert.deepEqual(workshopOpen(), []);
  workshopDone();
  nextRound();
  assert.equal(SEASON[g.roundIndex].id, 'skylab-2');
});

test("the meeting's calls change Skylab 2: a baked workshop and an untried parasol cost the crew", () => {
  const truth = workshop => {
    const r = newRound(9, initProgramme(), 'saturnib');
    r.workshop = workshop;
    flightTruth(r, 'skylab-2', LOST);
    return r;
  };
  const careful = truth({ attitude: 'pitch', crew: 'wait' });
  assert.equal(resolve(careful, 'parasol', 'parasol', {}).verdict, 'good');
  const cooked = truth({ attitude: 'sun', crew: 'wait' });
  assert.equal(cooked.flightTruth.flags.cooked, true);
  assert.equal(resolve(cooked, 'parasol', 'parasol', {}).verdict, 'fair');
  // Untried in the tank, the parasol jams some of the time and the cutters tear suits more often.
  let jams = 0,
    tears = 0;
  for (let s = 1; s <= 80; s++) {
    const r = newRound(s, initProgramme(), 'saturnib');
    r.workshop = { attitude: 'pitch', crew: 'rush' };
    flightTruth(r, 'skylab-2', LOST);
    if (resolve(r, 'parasol', 'parasol', {}).verdict === 'fair') jams++;
    if (resolve(r, 'panel', 'free', {}).set.hurt) tears++;
  }
  assert.ok(jams > 15 && jams < 50, `${jams} of 80`);
  assert.ok(tears > 15, `${tears} of 80`);
  // A whole workshop: the meeting changes nothing.
  const r = newRound(9, initProgramme(), 'saturnib');
  r.workshop = { attitude: 'sun', crew: 'rush' };
  flightTruth(r, 'skylab-2', WHOLE);
  assert.equal(r.flightTruth.flags.cooked, false);
  assert.equal(r.flightTruth.flags.untried, false);
  assert.ok(Object.values(WORKSHOP_CALLS).every(c => Object.keys(c.options).length === 2));
});

test('the meeting reaches Skylab 2 through the real flight', () => {
  toMeeting(LOST);
  workshopDecide('attitude', 'sun');
  workshopDecide('crew', 'wait');
  workshopDone();
  nextRound();
  playMission({ sims: 0 });
  const rec = g.record.rounds.at(-1);
  assert.equal(rec.id, 'skylab-2');
  assert.equal(g.round.workshop.attitude, 'sun');
  assert.equal(g.round.flightTruth.flags.cooked, true);
});
