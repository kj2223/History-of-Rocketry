// The workshop years: the seeded shield loss that is never a script, the parasol and the jammed wing, the leaking
// thruster quad, the crew that pushed back, and the docking with the other side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound } from '../js/truth/round.js';
import { flightTruth, resolve } from '../js/truth/flights.js';
import { initProgramme } from '../js/world/programme.js';
import { skylabShield } from '../js/world/race.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';
import { g, newGame } from '../js/game.js';
import { startFlight } from '../js/houston.js';
import '../js/mercury.js';

const round = (id, s) => {
  const r = newRound(s, initProgramme(), 'saturnib');
  flightTruth(r, id);
  return r;
};

test('the workshop\u2019s shield loss is the hidden layer\u2019s, seeded from the game: some games have it, some do not', () => {
  const seen = new Set();
  for (let s = 1; s <= 60; s++) seen.add(skylabShield(s));
  assert.ok(seen.has(true) && seen.has(false), [...seen].join());
  // The same station meets every crew: the flag rides with the seed, not the round.
  newGame(3);
  for (const [id, seed] of [['skylab-2', 7], ['skylab-3', 8], ['skylab-4', 9]]) {
    const round = newRound(seed, g.programme, 'saturnib');
    startFlight({ kind: 'flight', flightId: id, round, a: {} });
    assert.equal(round.flightTruth.flags.shield, skylabShield(g.seed), id);
  }
  // And it is not an Apollo flag.
  const ap = round('apollo-16', 8);
  assert.ok(!ap.flightTruth.flags.shield);
});

test('the parasol is the rule, and waiting for a cooler week is not', () => {
  const r = round('skylab-2', 8);
  r.flightTruth.flags.shield = true;
  const now = resolve(r, 'parasol', 'parasol', {});
  assert.equal(now.set.shaded, true);
  assert.equal(now.verdict, 'good');
  const late = resolve(r, 'parasol', 'standby', {});
  assert.equal(late.verdict, 'bad');
  assert.equal(late.set.shaded, true);
});

test('cutting the jammed wing free gives the workshop her power; leaving her folded is fair and costs a wing', () => {
  const r = round('skylab-2', 8);
  const free = resolve(r, 'panel', 'free', {});
  assert.equal(free.set.panelFree, true);
  const leave = resolve(r, 'panel', 'leave', {});
  assert.ok(!leave.set.panelFree);
  assert.match(leave.judge, /half power/);
});

test('the leaking quad: holding the plan is the call that usually holds, and coming home shortens the science', () => {
  const r = round('skylab-3', 8);
  const stay = resolve(r, 'quad', 'stay', {});
  assert.ok(['good', 'bad'].includes(stay.verdict));
  const home = resolve(r, 'quad', 'home', {});
  assert.equal(home.verdict, 'fair');
});

test('the crew that pushed back: one quiet day rebuilds the timeline; holding it can cost the crew', () => {
  const r = round('skylab-4', 8);
  const quiet = resolve(r, 'pace', 'quiet', {});
  assert.equal(quiet.verdict, 'good');
  const hold = resolve(r, 'pace', 'hold', {});
  assert.ok(['fair', 'bad'].includes(hold.verdict));
});

test('the Soyuz docking: stopping to realign is what the rule is for', () => {
  const r = round('astp', 8);
  const stop = resolve(r, 'align', 'stop', {});
  assert.equal(stop.verdict, 'good');
  const press = resolve(r, 'align', 'press', {});
  assert.ok(['bad', 'fair'].includes(press.verdict));
});

test('every workshop decision has its rule, and every flight ends on retrofire', () => {
  for (const id of ['skylab-2', 'skylab-3', 'skylab-4', 'astp']) {
    const steps = FLIGHTS[id].steps;
    for (const st of steps) if (st.decide) assert.ok(DECISIONS[st.decide], `${id} ${st.decide}`);
    assert.ok(steps.at(-1).retro, id);
    for (const st of steps)
      if (st.decide && DECISIONS[st.decide].rule != null)
        assert.ok(FLIGHTS[id].rules[DECISIONS[st.decide].rule], `${id} ${st.decide} rule`);
  }
});
