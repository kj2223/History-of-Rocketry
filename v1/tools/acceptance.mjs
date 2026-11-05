// ACCEPTANCE: plays whole V1 campaigns with the seeded bot and checks what the unit tests cannot reach in a reasonable time.
//   1. Dead ends: the bot plays each seed from 1945 to NASA formation; any stuck decision, stuck proposal, exception, or a campaign
//      that does not conclude fails the run.
//   2. Round trip (FRZ-02 / AC07): one seed is saved and reloaded on 1 Jan 1950 (ROUNDTRIP=1 in tools/balance.mjs, through the real
//      export and parse). The report must equal the report from the same seed played straight through, or the save loses something.
//   3. Determinism: the same seed played twice gives the same report.
// Add a seed to DEAD_END_SEEDS whenever the bot finds a new dead end, once it is fixed. Run: node tools/acceptance.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BOT = fileURLToPath(new URL('./balance.mjs', import.meta.url));
const DEAD_END_SEEDS = [1, 2, 3, 4, 5, 6];
const ROUNDTRIP_SEEDS = [3, 7];

const run = (seeds, env = {}) => spawnSync(process.execPath, [BOT], { encoding: 'utf8', env: { ...process.env, ...env, SEED: seeds.join(',') } });
let failed = 0;

console.log(`== dead ends: seeds ${DEAD_END_SEEDS.join(', ')}`);
const sweep = run(DEAD_END_SEEDS);
process.stdout.write(sweep.stdout);
if (sweep.status !== 0) { failed++; process.stderr.write(sweep.stderr); }

for (const seed of ROUNDTRIP_SEEDS) {
  console.log(`== save and reload on 1 Jan 1950: seed ${seed}`);
  const straight = run([seed]), reloaded = run([seed], { ROUNDTRIP: '1' }), again = run([seed]);
  if (straight.status !== 0 || reloaded.status !== 0) { failed++; console.log('A comparison run failed.\n' + (straight.stderr || straight.stdout) + '\n' + (reloaded.stderr || reloaded.stdout)); continue; }
  if (straight.stdout !== reloaded.stdout) { failed++; console.log('The campaign played differently after a save and reload. Straight through:\n' + straight.stdout + '\nWith the reload:\n' + reloaded.stdout); }
  else console.log('Same report with and without the reload.');
  if (straight.stdout !== again.stdout) { failed++; console.log('The same seed gave two different reports (not deterministic).'); }
  else console.log('Same report on a second run.');
}

console.log(failed ? `ACCEPTANCE FAILED: ${failed} check(s).` : 'ACCEPTANCE PASSED.');
process.exitCode = failed ? 1 : 0;
