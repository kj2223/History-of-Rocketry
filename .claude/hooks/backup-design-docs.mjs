// PreToolUse hook: before Claude edits a design document, copy it into document-backups/auto/ once per session
// (the project rule is to back up a doc before rewriting it). Covers the local-only docs under plans/ and the root
// AGENTS.md, CLAUDE.md and COMPREHENSIVE-PLAN.md. Copies of AGENTS.md and CLAUDE.md get a .bak suffix, because Claude
// Code would otherwise load a copy named CLAUDE.md as live instructions. It never blocks the edit.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const target = input.tool_input?.file_path;
  if (target) {
    const abs = isAbsolute(target) ? target : join(input.cwd || root, target);
    const rel = relative(root, abs).split(sep).join('/');
    const isDoc =
      (/^plans\/.+\.md$/i.test(rel) && !rel.startsWith('plans/source/')) ||
      /^(AGENTS|CLAUDE|COMPREHENSIVE-PLAN)\.md$/i.test(rel);
    if (isDoc && existsSync(abs)) {
      const day = new Date().toISOString().slice(0, 10);
      const session = String(input.session_id || 'session').slice(0, 8);
      const parts = rel.split('/');
      const last = parts.length - 1;
      if (/^(AGENTS|CLAUDE)\.md$/i.test(parts[last])) parts[last] += '.bak';
      const copy = join(root, 'document-backups', 'auto', `${day}-${session}`, ...parts);
      if (!existsSync(copy)) {
        mkdirSync(dirname(copy), { recursive: true });
        copyFileSync(abs, copy);
      }
    }
  }
} catch {}
process.exit(0);
