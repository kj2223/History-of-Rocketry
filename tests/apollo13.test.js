// Apollo 13 played on its own flight plan: Fra Mauro if the tank holds, the lander as a lifeboat if it does not.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { startFlight, tickFlight, answer, flightOf } from '../js/houston.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';
import { SEASON, BETWEEN } from '../js/data/campaign.js';

// Fly Apollo 13 to entry with the given troubles, answering each question from picks (or its first option).
function fly(flags = {}, picks = {}, seed = 5) {
  newGame(seed);
  g.record.seat = 'flight';
  const c = { kind: 'flight', flightId: 'apollo-13', round: g.round };
  startFlight(c);
  Object.assign(c.round.flightTruth.flags, { tank: false, sps: false, alarm: false, relight: false }, flags);
  const asked = [],
    said = [];
  const speak = (_c, who, text) => said.push(text);
  for (let i = 0; i < 4000 && c.phase === 'mission'; i++) {
    const d = c.flight.decision;
    if (d) {
      asked.push(d.id);
      answer(c, picks[d.id] ?? Object.keys(d.options)[0], speak);
    } else tickFlight(c, 2, speak);
  }
  assert.notEqual(c.phase, 'mission', 'the flight reached entry');
  return { c, asked, said: said.join(' '), state: c.flight.state };
}

test('Apollo 13 has its own flight plan, not the generic Earth orbit', () => {
  const i = SEASON.findIndex(r => r.id === 'apollo-13');
  assert.ok(FLIGHTS['apollo-13']);
  assert.equal(flightOf('apollo-13'), FLIGHTS['apollo-13']);
  assert.equal(SEASON[i].risk.tankRisk, 0.5);
  assert.match(BETWEEN['apollo-13'].join(' '), /boiled it dry/);
  assert.doesNotMatch(BETWEEN['apollo-15'].join(' '), /Apollo 13, in April 1970/);
});

test('with the tank holding, Apollo 13 lands at Fra Mauro and asks nothing of the lifeboat', () => {
  const { asked, said, state } = fly();
  assert.ok(state.landed);
  assert.match(said, /Fra Mauro/);
  assert.ok(!asked.includes('pc2') && !asked.includes('co2'));
  assert.ok(asked.includes('loi'));
});

test('with the tank failing, the lander is the lifeboat: the burn home and the air are the calls', () => {
  const { asked, said, state, c } = fly({ tank: true });
  assert.ok(state.lifeboat && !state.landed);
  assert.deepEqual(
    asked.filter(a => ['tank', 'pc2', 'co2'].includes(a)),
    ['tank', 'pc2', 'co2'],
  );
  assert.ok(!asked.includes('loi'), 'no lunar orbit on the lifeboat');
  assert.match(said, /lasts past entry/);
  assert.doesNotMatch(said, /test firing came up/);
  assert.ok(!state.powerShort && !state.lost);
  assert.equal(c.flight.decisions.find(d => d.id === 'pc2').verdict, 'good');
});

test('no burn after the Moon leaves the lander short of power, and waiting on the air hurts the crew', () => {
  const { state, said, c } = fly({ tank: true }, { pc2: 'none', co2: 'wait' });
  assert.ok(state.powerShort);
  assert.ok(state.hurt >= 0.4);
  assert.match(said, /won't make entry/);
  assert.equal(c.flight.decisions.find(d => d.id === 'pc2').verdict, 'bad');
  assert.equal(DECISIONS.pc2.auto, 'pacific');
});

test("Apollo 13's CO2 and lifeboat-burn calls roll their own draws, shared with no other call", () => {
  const src = readFileSync(new URL('../js/truth/flights.js', import.meta.url), 'utf8');
  const body = name =>
    src.slice(src.indexOf(`\n  ${name}(choice`), src.indexOf('\n  },', src.indexOf(`\n  ${name}(choice`)));
  for (const [call, n] of [
    ['co2', 16],
    ['pc2', 26],
  ]) {
    assert.match(body(call), new RegExp(`d\\[${n}\\]`), `${call} reads d[${n}]`);
    assert.equal(src.match(new RegExp(`\\bd\\[${n}\\]`, 'g')).length, 1, `d[${n}] is ${call}'s alone`);
  }
});
