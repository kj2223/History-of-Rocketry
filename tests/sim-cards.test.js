// Sims that pay off: ask the sim supervisor for a trouble, get every call right, and its card goes on your console for
// the real flights, shown only at the call it belongs to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIM_CARDS, cardsFor, earnCard } from '../js/data/sim-cards.js';
import { SIMS, ORBIT_SIMS } from '../js/data/mercury.js';
import { GEMINI_SIMS } from '../js/data/gemini.js';
import { APOLLO_SIMS } from '../js/data/apollo.js';

test('every sim trouble but a clean flight teaches a card', () => {
  for (const list of [SIMS, ORBIT_SIMS, GEMINI_SIMS, APOLLO_SIMS])
    for (const k of Object.keys(list)) {
      if (k === 'nominal') assert.equal(SIM_CARDS[k], undefined);
      else assert.ok(SIM_CARDS[k], `a card for ${k}`);
    }
});

test('a card is earned once and shows only at its own call on a real flight', () => {
  const record = {};
  assert.ok(earnCard(record, 'radar', 3));
  assert.equal(earnCard(record, 'radar', 4), null, 'the second clean sim adds nothing');
  assert.equal(earnCard(record, 'nominal', 4), null);
  assert.deepEqual(cardsFor(record, { kind: 'flight', phase: 'ip' }), [SIM_CARDS.radar.text]);
  assert.deepEqual(cardsFor(record, { kind: 'flight', phase: 'ascent' }), []);
  assert.deepEqual(cardsFor(record, { kind: 'sim', phase: 'ip' }), [], 'no cards in the simulator itself');
  earnCard(record, 'seastate', 5);
  assert.deepEqual(cardsFor(record, { kind: 'flight', phase: 'count', poll: 'recovery' }), [SIM_CARDS.seastate.text]);
});

test('shared cards appear once', () => {
  const record = {};
  earnCard(record, 'control', 1);
  earnCard(record, 'guidance', 2);
  assert.equal(cardsFor(record, { kind: 'flight', phase: 'ascent' }).length, 1);
});

// In the game: ask the sim supervisor for a radar dropout before MR-1, fly it cleanly and carry the card.
import { g, newGame } from '../js/game.js';
import { toRoundId, runSim } from './play.js';

test('asking for a trouble gets that trouble, and a clean one puts its card on your console', () => {
  newGame(8);
  toRoundId('mr-1');
  const d = runSim({ pick: 'radar' });
  assert.equal(d.scenario, SIMS.radar);
  if (d.right === d.of) {
    assert.ok(g.record.cards.radar, 'the card is held');
    assert.equal(d.card, SIM_CARDS.radar.text);
  } else assert.equal(d.card, null);
  const other = runSim({ pick: 'seastate' });
  assert.equal(other.scenario, SIMS.seastate);
});

test('the simulator room offers each trouble, and marks the cards you hold', async () => {
  const { CONTROL_ROOMS } = await import('../js/scenes/control.js');
  newGame(8);
  toRoundId('mr-1');
  g.record.cards = { radar: { day: 1 } };
  const html = CONTROL_ROOMS.sim();
  for (const k of Object.keys(SIMS)) assert.ok(html.includes(`data-id="${k}"`), k);
  assert.match(html, /card on your console/);
});
