// Crew losses stay near Aaron's target of about 1.2 a game (9 and 11 November 2026) for a player who reads the board.
// tools/crew-losses.mjs prints the full table; this is a short, fixed-seed guard on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTo, playMission, carefulDecide } from './play.js';
import { g } from '../js/game.js';
import '../js/mercury.js';

test('a careful player loses about one crew a game, never most games out of the Apollo 1 fire', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => 300 + i);
  let lost = 0,
    fires = 0;
  for (const seed of seeds) {
    const opts = { sims: 0, joint: seed % 2 ? 'press' : 'hold', decide: carefulDecide };
    campaignTo(seed, 'artemis-4', opts);
    playMission(opts);
    lost += (g.record.losses || []).length;
    fires += (g.record.losses || []).some(l => l.round === 'apollo-1');
  }
  const perGame = lost / seeds.length;
  assert.ok(perGame >= 0.5 && perGame <= 1.6, `${perGame.toFixed(2)} crews a game`);
  assert.ok(fires <= 6, `the Apollo 1 fire in ${fires} of ${seeds.length} games`);
});
