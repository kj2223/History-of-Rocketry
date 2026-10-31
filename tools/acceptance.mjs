// ACCEPTANCE: the balance bot replays games that once hit a dead end (a stage reached but never finished), and fails if any
// still does. Slower than npm test (about 10 s a game, a minute in all), so it runs on its own. Run: npm run acceptance
// Add a seed here whenever the balance bot finds a new dead end, once it is fixed.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BOT = fileURLToPath(new URL('./balance.mjs', import.meta.url));
const ROUTES = [
  // hands-on seed 5: the Gemini planner never off-loaded an overweight Titan II; seed 2: a Titan II with flaws that had no cure
  { name: 'hands-on', seeds: [2, 5], env: {} },
  // delegation seeds 6 and 14: a Saturn I born with two flaws that had no cure; seed 7: no Gemini flight, reputation drained to 0
  { name: 'delegation', seeds: [6, 7, 14], env: { DELEGATE: '1' } },
];

let failed = 0;
for (const route of ROUTES) {
  console.log(`== ${route.name}: seeds ${route.seeds.join(', ')}`);
  const result = spawnSync(process.execPath, [BOT], { stdio: 'inherit', env: { ...process.env, ...route.env, SEED: route.seeds.join(',') } });
  if (result.status !== 0) failed++;
}
console.log(failed ? `ACCEPTANCE FAILED: ${failed} route(s) stalled.` : 'ACCEPTANCE PASSED.');
process.exitCode = failed ? 1 : 0;
