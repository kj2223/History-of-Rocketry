// The later flights each have a call of their own (11 November 2026): Demo-2's twenty-metre hold, STS-26's hot cabin at
// the relay-satellite deploy, Skylab 3's second leaking quad, STS-61's array that will not roll, and the Artemis III
// lander's certificate. Each trouble is the hidden layer's, read off draws no other call on that flight uses, and the
// board shows the cue before the question.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission } from './play.js';
import { g } from '../js/game.js';
import '../js/mercury.js';
import { newRound } from '../js/truth/round.js';
import { flightTruth, resolve } from '../js/truth/flights.js';
import { initProgramme } from '../js/world/programme.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';

const CALLS = {
  'demo-2': 'waypoint',
  'sts-26': 'tdrs',
  'skylab-3': 'quad2',
  'sts-61': 'array',
  'artemis-3': 'certify',
};
const TROUBLE = {
  'sts-31': 'arrayBind',
  'demo-2': 'ranging',
  'sts-26': 'hotCabin',
  'sts-61': 'arrayJams',
  'artemis-3': 'landerLeak',
};

test('each new call is written out, with a rule on its flight and an answer for every option', () => {
  for (const [flight, id] of Object.entries(CALLS)) {
    const D = DECISIONS[id];
    assert.ok(D && D.options[D.auto], id);
    assert.ok(FLIGHTS[flight].rules[D.rule], `${id}: rule ${D.rule}`);
    assert.ok(
      FLIGHTS[flight].steps.some(s => s.decide === id),
      `${flight} asks ${id}`,
    );
    const r = newRound(3, initProgramme(), 'shuttle');
    flightTruth(r, flight);
    for (const k of Object.keys(D.options)) {
      const out = resolve(r, id, k, {});
      assert.ok(['good', 'fair', 'bad'].includes(out.verdict) && out.judge, `${id}/${k}`);
    }
  }
});

test('the troubles are hidden draws: some flights have them, some do not, and only their own flight', () => {
  for (const [flight, f] of Object.entries(TROUBLE)) {
    const seen = new Set();
    for (let s = 1; s <= 60; s++) {
      const r = newRound(s, initProgramme(), 'shuttle');
      seen.add(flightTruth(r, flight).flags[f]);
      assert.equal(flightTruth(r, 'sts-1').flags[f], false, `${f} on STS-1`);
    }
    assert.deepEqual([...seen].sort(), [false, true], f);
  }
});

test('reading the cue pays: with the trouble, the cautious answer is the good one; without it, pressing on is', () => {
  const cases = [
    ['demo-2', 'waypoint', 'ranging', 'back', 'go'],
    ['sts-31', 'hubbledeploy', 'arrayBind', 'eva', 'override'],
    ['sts-26', 'tdrs', 'hotCabin', 'cool', 'deploy'],
    ['sts-61', 'array', 'arrayJams', 'jettison', 'roll'],
    ['artemis-3', 'certify', 'landerLeak', 'retest', 'certify'],
  ];
  for (const [flight, id, flag, careful, press] of cases) {
    const r = newRound(4, initProgramme(), 'shuttle');
    const t = flightTruth(r, flight);
    t.flags[flag] = true;
    assert.equal(resolve(r, id, careful, {}).verdict, 'good', `${id} ${careful} with ${flag}`);
    assert.equal(resolve(r, id, press, {}).verdict, 'bad', `${id} ${press} with ${flag}`);
    t.flags[flag] = false;
    assert.equal(resolve(r, id, press, {}).verdict, 'good', `${id} ${press} without ${flag}`);
  }
});

for (const flight of Object.keys(CALLS))
  test(`${flight} asks its call in a played flight`, () => {
    const asked = [];
    // Backing off to reset the lander's sensors always docks, so the certificate is always asked.
    const opts = {
      sims: 0,
      decide: d => (asked.push(d.id), d.id === 'landerdock' ? 'reset' : Object.keys(d.options)[0]),
    };
    campaignTo(11, flight, { sims: 0 });
    playMission(opts);
    assert.equal(g.record.rounds.at(-1).id, flight);
    // Skylab 3 asks about the second quad only if the crew stayed after the first.
    assert.ok(asked.includes(CALLS[flight]), `${flight}: ${asked}`);
  });
