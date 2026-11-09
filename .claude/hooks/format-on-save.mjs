// PostToolUse hook: after Claude edits a file, format it with the project's Prettier settings (.prettierrc), the
// same way an editor's format-on-save would. Skips anything .prettierignore lists or Prettier does not know, and
// never blocks: if Prettier is missing (no `npm install` yet) it does nothing.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const target = input.tool_input?.file_path;
  const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (target && /\.(m?js|cjs|json|css|html)$/i.test(target) && existsSync(prettier)) {
    const abs = isAbsolute(target) ? target : join(input.cwd || root, target);
    if (existsSync(abs))
      spawnSync(process.execPath, [prettier, '--write', '--ignore-unknown', '--log-level', 'silent', abs], {
        cwd: root,
        timeout: 30_000,
      });
  }
} catch {}
process.exit(0);
