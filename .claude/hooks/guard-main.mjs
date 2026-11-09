// PreToolUse guard: nothing reaches `main` without Aaron's OK for that release, because every push to main
// publishes a Windows release (.github/workflows/windows-build.yml). Blocks `git push` to main from the shell and
// GitHub file writes on main. The /release skill, which only Aaron can start, writes .claude/release-ok; that token
// lets exactly one push to main through within two hours and is then deleted.
import { execSync } from 'node:child_process';
import { readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const tokenPath = join(root, '.claude', 'release-ok');

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: input.cwd || root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// True when one `git push` command could update main.
export function pushTouchesMain(segment, branch) {
  const args = segment.replace(/^.*?\bgit\b(?:\s+-C\s+\S+)?\s+push\b/, '').trim();
  if (/(^|\s)--(all|mirror)\b/.test(args)) return true;
  const words = args.split(/\s+/).filter(w => w && !w.startsWith('-'));
  const refspecs = words.slice(1); // words[0] is the remote
  if (refspecs.some(r => /(^|[:+])(refs\/heads\/)?main$/.test(r.replace(/^['"]|['"]$/g, '')))) return true;
  return refspecs.length === 0 && branch === 'main';
}

function blocksMain() {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  if (tool === 'Bash') {
    const segments = String(ti.command || '').split(/&&|\|\||;|\n|\|/);
    const branch = currentBranch();
    return segments.some(s => /\bgit\b(?:\s+-C\s+\S+)?\s+push\b/.test(s) && pushTouchesMain(s.trim(), branch));
  }
  if (/^mcp__github__(push_files|create_or_update_file|delete_file)$/.test(tool))
    return String(ti.branch || '').replace(/^refs\/heads\//, '') === 'main';
  return false;
}

if (blocksMain()) {
  let age = Infinity;
  try {
    age = Date.now() - statSync(tokenPath).mtimeMs;
  } catch {}
  if (age < TOKEN_MAX_AGE_MS) {
    try {
      unlinkSync(tokenPath);
    } catch {}
    process.exit(0);
  }
  process.stderr.write(
    'Blocked: this would update main, and every push to main publishes a release. ' +
      "Only push to main with Aaron's OK for that release: ask him to run /release. Work on dev or a branch instead.\n",
  );
  process.exit(2);
}
process.exit(0);
