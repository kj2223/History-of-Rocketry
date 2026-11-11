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

test("Artemis I flies the distant orbit on its service engine, and her heat shield's char decides Artemis II's entry", () => {
  const truth = (id, seed) => {
    const r = newRound(seed, initProgramme(), 'sls');
    flightTruth(r, id, seed);
    return r;
  };
  // A sound engine: into the distant orbit and out. A failed check: skipping it is the good call.
  const r = truth('artemis-1', 5);
  r.flightTruth.flags.sps = false;
  assert.equal(resolve(r, 'dro', 'go', {}).set.inDro, true);
  assert.equal(resolve(r, 'dro', 'go', {}).verdict, 'good');
  r.flightTruth.flags.sps = true;
  assert.equal(resolve(r, 'dro', 'skip', {}).verdict, 'good');
  assert.equal(resolve(r, 'dro', 'skip', {}).endAt, 240);
  // The char is one draw per game: Artemis I and II share it, and most games have it.
  let chars = 0;
  for (let s = 1; s <= 80; s++) {
    const a = truth('artemis-1', s).flightTruth.flags.char;
    assert.equal(truth('artemis-2', s).flightTruth.flags.char, a, `seed ${s}`);
    assert.equal(truth('artemis-3', s).flightTruth.flags.char, false);
    chars += a;
  }
  assert.ok(chars > 40 && chars < 75, `${chars} of 80`);
  // With the char, the shorter entry is the good call and the long skip can hurt; without it, the skip is.
  const two = truth('artemis-2', 5);
  two.flightTruth.flags.char = true;
  assert.equal(resolve(two, 'entryplan', 'loft', {}).verdict, 'good');
  assert.notEqual(resolve(two, 'entryplan', 'skip', {}).verdict, 'good');
  two.flightTruth.flags.char = false;
  assert.equal(resolve(two, 'entryplan', 'skip', {}).verdict, 'good');
  for (const id of ['dro', 'entryplan']) assert.ok(DECISIONS[id].options[DECISIONS[id].auto]);
  assert.ok(FLIGHTS['artemis-1'].rules[DECISIONS.dro.rule] && FLIGHTS['artemis-2'].rules[DECISIONS.entryplan.rule]);
});

for (const [flight, id] of [
  ['artemis-1', 'dro'],
  ['artemis-2', 'entryplan'],
])
  test(`${flight} asks ${id} in a played flight`, () => {
    const asked = [];
    campaignTo(13, flight, { sims: 0 });
    playMission({
      sims: 0,
      decide: d => (asked.push(d.id), ['tli', 'tlii', 'tlio'].includes(d.id) ? 'go' : Object.keys(d.options)[0]),
    });
    assert.ok(asked.includes(id), `${flight}: ${asked}`);
  });
