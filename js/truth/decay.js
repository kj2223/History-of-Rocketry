// THE DECAY TEST (Aaron, 22 November 2026: "make the player do the procedure"). Instead of a button that sends the crew
// to find a leak, you isolate the pressurised tank, close the valve, and watch the needle. A leak bleeds it down; but the
// air warms through the morning and cools through the afternoon, and gas in a closed tank follows it, so a sound tank
// drifts too and a slow leak on a warming day can sit almost still. The longer you watch, the surer you are, and the
// watch costs time. The hidden part: how fast this round's tank really loses pressure, and what the needle shows.
// No DOM, no drawing, no draws from the round's streams (hashes of the seed only).
import { hasLeak } from './round.js';

// Game minutes the test runs for each real second at 1x.
export const DECAY_MINUTES_PER_SECOND = 1;
// The pressure the tank is locked up at (bar).
export const DECAY_START = 23;

function hash01(seed, salt) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt + 29, 0x9e3779b1), 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// bar per minute: the leak (0 for a tight tank), and the drift with the air: warming before about 14:00, cooling after.
export function decayRates(round, minuteOfDay) {
  const seed = round.seed ?? 1;
  const leak = hasLeak(round) ? 0.02 + 0.05 * hash01(seed, 1) : 0;
  const warming = minuteOfDay < 14 * 60;
  const drift = (warming ? 1 : -1) * (0.005 + 0.025 * hash01(seed, 2 + Math.floor(minuteOfDay / 240)));
  return { leak, drift };
}
// The needle after `minutes` locked up: the start, the leak and the drift, and a little flutter.
export function decayReading(round, rates, minutes) {
  const flutter = (hash01(round.seed ?? 1, 100 + Math.floor(minutes * 2)) - 0.5) * 0.08;
  return DECAY_START + (rates.drift - rates.leak) * minutes + flutter;
}
// The air temperature the thermometer by the panel shows (°C), for the morning's or afternoon's trend.
export const airTemp = (seed, minuteOfDay) =>
  Math.round(
    4 + 14 * Math.sin(Math.max(0, Math.min(1, (minuteOfDay - 360) / 600)) * Math.PI * 0.9) + hash01(seed, 7) * 4,
  );
