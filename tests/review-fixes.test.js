// Fixes from the 11 November 2026 code review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON, LAST_WORD, onPath } from '../js/data/campaign.js';
import { DEFAULT_PROGRAMME } from '../js/truth/round.js';
import { initProgramme } from '../js/world/programme.js';
import * as game from '../js/game.js';
import { consoleStart, consolePoll, tickConsole } from '../js/mercury.js';
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

test('a Gemini 6A insertion window that closes without a call goes with Goddard', () => {
  for (const seed of [21, 22, 23, 24]) {
    campaignTo(seed, 'gem-6', { sims: 0 });
    nextDay();
    consoleStart();
    // Answer the count's polls GO and fly the climb, up to the insertion call.
    for (let n = 0; n < 40 && game.g.beat === 'mFlight' && game.g.console?.phase !== 'insertion'; n++) {
      const c = game.g.console;
      if (c?.poll || c?.phase === 'poll') consolePoll(true);
      else if (c?.phase === 'ascent') {
        game.g.speed = 4;
        for (let i = 0; i < 4000 && c.phase === 'ascent'; i++) tickConsole(0.05);
      } else if (c && ['pad', 'shutdown'].includes(c.phase)) break;
      else
        until(
          () =>
            game.g.beat !== 'mFlight' ||
            !!game.g.console?.poll ||
            ['poll', 'ascent', 'insertion', 'pad', 'shutdown'].includes(game.g.console?.phase),
        );
    }
    const c = game.g.console;
    if (c?.phase !== 'insertion' || !c.shift) continue;
    const goddardGo = c.goddard.go;
    for (let i = 0; i < 400 && c.phase === 'insertion'; i++) tickConsole(0.5);
    assert.equal(c.calls.insertion.expired, true);
    assert.equal(c.calls.insertion.go, goddardGo);
    assert.match(game.g.notes.at(-1).text, /went with Goddard/);
    return;
  }
  assert.fail('no seed reached a live Gemini 6A insertion');
});
