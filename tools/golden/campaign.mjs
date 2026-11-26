// Golden traces for the whole game: the tests' bot (js/dev/bot.js) plays a campaign from 1945 to its end, and every
// morning checkpoint the game takes (game.js morning(): g.saved, the plain JSON a save holds) is written down in order.
// The C# game, driven by the C# port of the same bot, must take the same checkpoints, byte for byte. record(write)
// writes campaign-<seed>.json: { seed, rounds, end, checkpoints: [{ i, roundId, beat, day, length, sha256 }] }. A whole
// campaign is about 30 MB of checkpoints, so only their SHA-256 is kept; CAMPAIGN_FULL=1 adds each one's text, to see
// where a mismatch starts.
import { createHash } from 'node:crypto';
import * as bot from '../../js/dev/bot.js';
import * as game from '../../js/game.js';
import { SEASON } from '../../js/data/campaign.js';

export const CAMPAIGN_SEEDS = [1945, 7, 314159];

function playCampaign(seed) {
  const taken = [];
  const clone = globalThis.structuredClone;
  // morning() saves the checkpoint with structuredClone; catch each one as it is taken.
  globalThis.structuredClone = v => {
    const out = clone(v);
    if (v && typeof v === 'object' && 'roundId' in v && 'beat' in v && 'programme' in v)
    {
      const text = JSON.stringify(out);
      taken.push({
        i: taken.length,
        roundId: v.roundId,
        beat: v.beat,
        day: v.day,
        length: text.length,
        sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
        ...(process.env.CAMPAIGN_FULL === '1' ? { text } : {}),
      });
    }
    return out;
  };
  let end;
  try {
    bot.campaignTo(seed, SEASON[SEASON.length - 1].id);
    end = 'last round';
  } catch (e) {
    end = String(e.message).slice(0, 300);
  } finally {
    globalThis.structuredClone = clone;
  }
  const g = game.g;
  return { seed, rounds: g.roundIndex + 1, end, finalBeat: g.beat, seat: g.record.seat, path: g.record.path, checkpoints: taken };
}

export function record(write) {
  for (const seed of CAMPAIGN_SEEDS) write(`campaign-${seed}.json`, playCampaign(seed));
}
