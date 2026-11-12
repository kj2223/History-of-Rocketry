import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// The desktop app's Content-Security-Policy has no 'unsafe-eval', so PixiJS needs its no-eval add-on, loaded before the
// scene layer starts (Aaron, 12 Nov: the new rooms never showed in the app, only the old drawing).
test('the scene layer loads the PixiJS no-eval add-on, and the app still forbids eval', () => {
  const csp = readFileSync(new URL('../desktop/main.js', import.meta.url), 'utf8');
  assert.ok(!/unsafe-eval/.test(csp), 'the app must not allow eval');
  const stage = readFileSync(new URL('../js/stage/index.js', import.meta.url), 'utf8');
  assert.match(stage, /pixi-unsafe-eval\.min\.js/);
  assert.match(stage, /await allowNoEval\(\)/);
  assert.ok(existsSync(new URL('../js/vendor/pixi-unsafe-eval.min.js', import.meta.url)));
});
