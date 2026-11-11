// The Artemis flights as NASA flies them since 2026: Orion's own engine makes the injection on the crewed flights,
// Artemis III meets the commercial lander in Earth orbit, and Artemis IV lands at the south pole and ends the season.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame } from '../js/game.js';
import { startFlight, tickFlight, answer } from '../js/houston.js';
import { resolve } from '../js/truth/flights.js';
import { SEASON, LAST_WORD } from '../js/data/campaign.js';

function fly(id, picks = {}, setup = () => {}) {
  newGame(5);
  g.record.seat = 'flight';
  const c = { kind: 'flight', flightId: id, round: g.round };
  startFlight(c);
  setup(c.round.flightTruth);
  const asked = [],
    said = [];
  const speak = (_c, who, text) => said.push(`${who}: ${text}`);
  for (let i = 0; i < 4000 && c.phase === 'mission'; i++) {
    const d = c.flight.decision;
    if (d) {
      asked.push(d.id);
      answer(c, picks[d.id] ?? Object.keys(d.options)[0], speak);
    } else tickFlight(c, 2, speak);
  }
  assert.notEqual(c.phase, 'mission', `${id} reached entry`);
  return { c, asked, said: said.join('\n') };
}

test('the season runs Artemis III in 2027 and ends with Artemis IV in 2028', () => {
  const ids = SEASON.filter(r => r.path === 'nasa').map(r => r.id);
  assert.deepEqual(ids.slice(-2), ['artemis-3', 'artemis-4']);
  const a3 = SEASON.find(r => r.id === 'artemis-3'),
    a4 = SEASON.find(r => r.id === 'artemis-4');
  assert.ok(a3.start < a4.start);
  assert.match(LAST_WORD['artemis-4'], /Artemis IV came home/);
  assert.equal(LAST_WORD['artemis-3'], undefined);
});

test('Artemis III docks with the lander in Earth orbit and never leaves it', () => {
  const { asked, said, c } = fly('artemis-3', { landerdock: 'reset' });
  assert.ok(asked.includes('landerdock'));
  assert.ok(!asked.includes('tli') && !asked.includes('tlio') && !asked.includes('loi'));
  assert.match(said, /in the lander/);
  assert.ok(c.flight.capabilities.includes('landerdock'));
});

test('a real sensor fault and the automatics: no docking, and no checkout', () => {
  const real = t => (t.d[4] = 0.1);
  const { said, c } = fly('artemis-3', { landerdock: 'auto' }, real);
  assert.match(said, /No capture/);
  assert.doesNotMatch(said, /in the lander/);
  assert.ok(!c.flight.capabilities.includes('landerdock'));
});

test("Orion's engine, not the upper stage, sends Artemis II and IV to the Moon", () => {
  for (const id of ['artemis-2', 'artemis-4']) {
    const { asked, said } = fly(id);
    assert.ok(asked.includes('tlio') && !asked.includes('tli'), id);
    assert.match(said, /Orion's engine, good burn/);
    assert.doesNotMatch(said, /S-IVB|third stage/);
  }
  const r = { flightTruth: { flags: { relight: true }, d: Array(16).fill(0.1) } };
  const out = resolve(r, 'tlio', 'go', {});
  assert.match(out.lines[0][1], /orbit raise came up too short/);
  assert.match(out.judge, /Orion couldn't make up/);
});
