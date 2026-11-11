// Stop hook: when game code has changed, run the test suite before Claude may finish, and send it back to work
// while a test fails. A passing run is remembered by a fingerprint of the changed files, so an unchanged tree is
// not tested twice. On the second failing stop in a row it lets Claude stop but warns, so it can never loop.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WATCHED = ['js', 'tests', 'desktop', 'index.html', 'style.css', 'package.json'];

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const stampPath = join(root, '.claude', '.tests-passed');

let status;
try {
  status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...WATCHED], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
} catch {
  process.exit(0); // not a git checkout: nothing to judge
}
if (!status.trim()) process.exit(0);

const hash = createHash('sha1').update(status);
for (const line of status.split('\n')) {
  const file = line
    .slice(3)
    .replace(/^.* -> /, '')
    .replace(/^"|"$/g, '');
  const path = join(root, file);
  if (file && existsSync(path)) {
    try {
      hash.update(file).update(readFileSync(path));
    } catch {}
  }
}
const fingerprint = hash.digest('hex');
if (existsSync(stampPath) && readFileSync(stampPath, 'utf8').trim() === fingerprint) process.exit(0);

const files = readdirSync(join(root, 'tests'))
  .filter(f => f.endsWith('.test.js'))
  .map(f => join('tests', f));
const run = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8', timeout: 200_000 });

if (run.status === 0) {
  writeFileSync(stampPath, fingerprint);
  process.exit(0);
}

const out = `${run.stdout || ''}${run.stderr || ''}`;
const failures = out
  .split('\n')
  .filter(l => /^\s*(not ok|error:|expected:|actual:|location:)/.test(l))
  .slice(0, 60)
  .join('\n');
const summary = out
  .split('\n')
  .filter(l => /^# (pass|fail)/.test(l))
  .join(', ');
const detail = run.error ? `The test run did not finish: ${run.error.message}` : failures || out.slice(-3000);

if (input.stop_hook_active) {
  console.log(
    JSON.stringify({ systemMessage: `Tests are still failing (${summary}). Check before trusting this change.` }),
  );
  process.exit(0);
}
console.log(
  JSON.stringify({
    decision: 'block',
    reason: `Game code changed and npm test fails (${summary}). Fix the cause (never skip or weaken a test), then finish.\n${detail}`,
  }),
);
process.exit(0);
