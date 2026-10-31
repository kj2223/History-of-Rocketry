// THE NEIGHBOURS ON THE RANGE: programmes that fly beside yours but are not yours. For now, the Army's captured V-2s at White
// Sands (data/history.js, V2_PROGRAMME). They fly on the Army's schedule, fail about a third of the time, and make the news when one
// climbs higher than any before it. They never claim your firsts. No DOM.
//
// S.v2: { n: flights flown, ok: good flights, hi: the highest peak (km), next: the game day of the next launch }
import { V2_PROGRAMME, V2_FAILURES } from '../data/history.js';
import { S, log } from '../core/state.js';

// A launch further back than this is skipped without a word (a save from before the V-2s, opened years in).
const STALE_DAYS = 60;
const nextGap = () => Math.round(V2_PROGRAMME.every * (1 + (Math.random() * 2 - 1) / 3));

// Each second: fly the next V-2 once its day comes (one a second at most). Returns true if one flew.
export function neighboursTick() {
  const v2 = S.v2;
  if (v2.next > V2_PROGRAMME.end || S.day < v2.next) return false;
  if (S.day - v2.next > STALE_DAYS) {
    while (v2.next <= V2_PROGRAMME.end && S.day - v2.next > STALE_DAYS) v2.next += V2_PROGRAMME.every;
    return false;
  }
  v2.n++;
  v2.next += nextGap();
  if (Math.random() >= V2_PROGRAMME.ok) {
    log(`[WHITE SANDS] Army V-2 No. ${v2.n} ${V2_FAILURES[Math.floor(Math.random() * V2_FAILURES.length)]}.`, 'd');
  } else {
    v2.ok++;
    const [low, high] = V2_PROGRAMME.peak, record = v2.hi > 0 && Math.random() < .1;
    const peak = Math.round(record ? Math.min(V2_PROGRAMME.record, Math.max(v2.hi, high) + 5 + Math.random() * 15) : low + Math.random() * (high - low));
    if (peak > v2.hi) {
      log(`[WHITE SANDS] Army V-2 No. ${v2.n} climbs to ${peak} km${v2.hi ? `, higher than any rocket before it` : ''}. The scientists' instruments ride in its nose.`, 'nar');
      v2.hi = peak;
    } else log(`[WHITE SANDS] Army V-2 No. ${v2.n} reaches ${peak} km.`, 'd');
  }
  if (v2.next > V2_PROGRAMME.end) log(`[WHITE SANDS] The last captured V-2 has flown: ${v2.n} launches, ${v2.ok} good. From now on the range belongs to American-built rockets.`, 'nar');
  return true;
}
