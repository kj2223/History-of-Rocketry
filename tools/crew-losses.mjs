// Crews lost per game, by round, for two players: the quiet bot that takes the first answer to every question, and a
// careful one that reads every warning (carefulDecide). Aaron's target (9 and 11 November 2026) is about 1.2 a game.
//   node tools/crew-losses.mjs [games=80] [first seed=300]
// Odd seeds press at the cold Shuttle telecall, even seeds hold, as in tests/sweep.test.js.
import { campaignTo, playMission, carefulDecide } from '../js/dev/bot.js';
import { g } from '../js/game.js';
import '../js/mercury.js';

const games = +(process.argv[2] || 80),
  first = +(process.argv[3] || 300);
for (const [name, decide] of [
  ['first answer', undefined],
  ['careful', carefulDecide],
]) {
  const by = {};
  let total = 0;
  for (let seed = first; seed < first + games; seed++) {
    const opts = { sims: 0, joint: seed % 2 ? 'press' : 'hold', ...(decide && { decide }) };
    campaignTo(seed, 'artemis-4', opts);
    playMission(opts);
    for (const l of g.record.losses || []) {
      total++;
      by[l.round] = (by[l.round] || 0) + 1;
    }
  }
  const rounds = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id} ${Math.round((100 * n) / games)}%`)
    .join(', ');
  console.log(`${name}: ${(total / games).toFixed(2)} crews lost a game over ${games} games. ${rounds}`);
}
