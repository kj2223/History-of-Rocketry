// The painters are patched by hand, and a duplicated function declaration is legal JavaScript whose second copy
// silently shadows the first: the launch-control room ran on a stale copy of its painter for two builds. This fails
// the suite if any file ever declares the same top-level function or class twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const namesIn = src => [...src.matchAll(/^(?:export )?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

test('no file declares the same top-level function or class twice', () => {
  for (const dir of ['js', 'desktop']) {
    for (const f of readdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true })) {
      if (!f.endsWith('.js')) continue;
      const names = namesIn(readFileSync(new URL(`../${dir}/${f}`, import.meta.url), 'utf8'));
      const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
      assert.deepEqual(
        dupes,
        [],
        `${dir}/${f} declares ${dupes.join(', ')} more than once; the last copy silently shadows the working one`,
      );
    }
  }
});
