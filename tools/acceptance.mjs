// ACCEPTANCE: the balance bot replays games that once hit a dead end (a stage reached but never finished), and fails if any
// still does. Slower than npm test (about 10 s a game), so it runs on its own. Run: npm run acceptance
// Add a seed here whenever the balance bot finds a new dead end, once it is fixed.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BOT = fileURLToPath(new URL('./balance.mjs', import.meta.url));
const ROUTES = [
  { name: 'hands-on', seeds: [5], env: {} },             // seed 5: the Gemini planner never off-loaded an overweight Titan II
  { name: 'delegation', seeds: [7], env: { DELEGATE: '1' } }, // seed 7: the same Gemini stall, before the single standing order (PR #66)
];

let failed = 0;
for (const route of ROUTES) {
  console.log(`== ${route.name}: seeds ${route.seeds.join(', ')}`);
  const result = spawnSync(process.execPath, [BOT], { stdio: 'inherit', env: { ...process.env, ...route.env, SEED: route.seeds.join(',') } });
  if (result.status !== 0) failed++;
}
console.log(failed ? `ACCEPTANCE FAILED: ${failed} route(s) stalled.` : 'ACCEPTANCE PASSED.');
process.exitCode = failed ? 1 : 0;
