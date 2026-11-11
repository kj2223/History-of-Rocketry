// Run before each Windows build (npm run dist): notes the commit being built, so a playtest log can say which build it
// came from. desktop/build-info.json is generated and not tracked.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const git = args => {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const info = {
  commit: git('rev-parse --short HEAD'),
  branch: git('rev-parse --abbrev-ref HEAD'),
  dirty: git('status --porcelain')?.length > 0,
  builtAt: new Date().toISOString(),
};
fs.writeFileSync(new URL('./build-info.json', import.meta.url), `${JSON.stringify(info, null, 2)}\n`);
console.log('build-info', info);
