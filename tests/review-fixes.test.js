// Fixes from the 11 November 2026 code review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON, LAST_WORD, onPath } from '../js/data/campaign.js';
import { DEFAULT_PROGRAMME } from '../js/truth/round.js';
import { initProgramme } from '../js/world/programme.js';
import * as game from '../js/game.js';
import { consoleStart } from '../js/mercury.js';
import { campaignTo, nextDay, until } from './play.js';

const { checkpoint, newGame, advanceProbe } = game;

test('the season-end page has a last word for the final round of each route', () => {
  for (const path of ['jpl', 'nasa']) {
    const last = SEASON.filter(r => onPath(r, path))
      .sort((a, b) => a.start - b.start)
      .at(-1);
    assert.ok(LAST_WORD[last.id], `${path} ends at ${last.id}`);
  }
});

test('a probe round is recorded on the day it closes, not the day of the handover', () => {
  newGame(14);
  const round = SEASON.find(r => r.id === 'mariner-4');
  newGame(14, { ...checkpoint(), roundId: round.id, day: round.probe.encounter, beat: 'probeEncounter' });
  advanceProbe(true);
  advanceProbe(true);
  assert.equal(game.g.record.rounds.at(-1).day, round.probe.playback);
});

test('a new programme starts from the full build standard', () => {
  const p = initProgramme();
  for (const [k, v] of Object.entries(DEFAULT_PROGRAMME)) assert.equal(p[k], v, k);
  assert.deepEqual([p.flights, p.adopted], [[], []]);
});

test('a Saturn V climb calls its staging', () => {
  campaignTo(21, 'apollo-8', { sims: 0 });
  nextDay();
  consoleStart();
  until(() => game.g.beat !== 'mFlight' || (game.g.console?.t ?? 0) > 140 || game.g.console?.phase !== 'ascent');
  assert.ok(
    game.g.loop.some(l => /Second stage ignition/.test(l.text)),
    game.g.loop.map(l => l.text).join('\n'),
  );
});
