// Golden traces for Mission Control's console panel: see console-panel-play.mjs, which does the recording. That module
// has to wrap game.js's tick() before game.js is loaded, and record.mjs has loaded it long before this part, so the
// recording runs in a fresh Node process (run-one.mjs console-panel-play) and its files are written through here.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function record(write) {
  const dir = mkdtempSync(join(tmpdir(), 'console-panel-'));
  try {
    execFileSync(process.execPath, [join(here, 'run-one.mjs'), 'console-panel-play', dir], { stdio: ['ignore', 'ignore', 'inherit'] });
    for (const f of readdirSync(dir).sort()) write(f, JSON.parse(readFileSync(join(dir, f), 'utf8')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
