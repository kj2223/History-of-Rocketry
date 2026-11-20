// The automated playtest's judgement (tools/autoplay/checks.mjs): what it calls a bug, a warning or a note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeLook, judgeWaits, judgeMemory, dedupe, isNoise, issueLink, LIMITS } from '../tools/autoplay/checks.mjs';

const where = { mode: 'flight', round: 'wac-1', beat: 'count' };
const calm = {
  where,
  frames: { count: 60, median: 16, p95: 18, worst: 30 },
  audio: { running: true, rmsDb: -30, quietestDb: -35, loudestDb: -25, peak: 0.3, clipped: 0, jumpDb: 2, alive: 12 },
  image: { mean: 100, spread: 40, oneColour: 0.1 },
  layout: [],
};

test('a calm, drawn, sounding screen has nothing to say', () => {
  assert.deepEqual(judgeLook(calm), []);
});

test('a blank screen, a frozen window, clipping and a pile of sounds are bugs', () => {
  const kinds = l => judgeLook({ ...calm, ...l }).map(f => `${f.kind}:${f.severity}`);
  assert.deepEqual(kinds({ image: { mean: 0, spread: 0, oneColour: 1 } }), ['blank-screen:bug']);
  assert.deepEqual(kinds({ frames: { count: 2 } }), ['frozen:bug']);
  assert.deepEqual(kinds({ audio: { ...calm.audio, clipped: 3, peak: 1 } }), ['clipping:bug']);
  assert.deepEqual(kinds({ audio: { ...calm.audio, alive: LIMITS.pileUp + 1 } }), ['sound-pile-up:bug']);
  assert.deepEqual(kinds({ audio: { tapped: false } }), ['audio-not-running:bug']);
});

test('silence is a warning, except where the scene is meant to be quiet', () => {
  const quiet = { ...calm, audio: { ...calm.audio, rmsDb: -90, loudestDb: -80 } };
  assert.deepEqual(
    judgeLook(quiet).map(f => f.kind),
    ['silent'],
  );
  assert.deepEqual(judgeLook(quiet, { quietScene: true }), []);
});

test('text shortened on purpose is a note; text cut off with no way to read it is a warning', () => {
  const f = judgeLook({
    ...calm,
    layout: [
      { kind: 'text-shortened', el: 'span#objective', text: 'Take part in the count' },
      { kind: 'text-cut-off', el: 'p.x', text: 'Gone' },
    ],
  });
  assert.deepEqual(
    f.map(x => x.severity),
    ['info', 'warn'],
  );
});

test('only waits over the limit are flagged, longest first', () => {
  const { waits, findings } = judgeWaits([
    { name: 'a', wait: 10, where },
    { name: 'b', wait: LIMITS.longWait + 30, where, beats: [{ beat: 'count', seconds: 70 }] },
    { name: 'c', wait: null, where },
  ]);
  assert.deepEqual(
    waits.map(w => w.name),
    ['b', 'a'],
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].text, /longest in count/);
});

test('memory that only grows is flagged; memory that comes back down is not', () => {
  const looks = mb => mb.map(m => ({ memoryMb: m, where }));
  assert.equal(judgeMemory(looks([100, 100, 100, 100, 100, 300, 600, 700, 700, 700, 700, 700, 700, 700])).length, 1);
  assert.equal(judgeMemory(looks([100, 100, 100, 100, 100, 900, 100, 100, 100, 100, 100, 100])).length, 0);
});

test('the same problem seen many times is one line, bugs first', () => {
  const f = (kind, severity, text) => ({ kind, severity, text, where });
  const out = dedupe([
    f('slow-frames', 'warn', 'Slow drawing: 40 ms'),
    f('console-error', 'bug', 'Console error: x'),
    f('slow-frames', 'warn', 'Slow drawing: 52 ms'),
  ]);
  assert.deepEqual(
    out.map(x => [x.kind, x.count]),
    [
      ['console-error', 1],
      ['slow-frames', 2],
    ],
  );
});

test("the engine's own chatter is not a bug, and a bug's issue link goes to the game's repository", () => {
  assert.ok(isNoise('CanvasRenderer: filter "Md" is not supported in Canvas2D and will be skipped.'));
  assert.ok(!isNoise('TypeError: x is undefined'));
  const [p] = dedupe([{ kind: 'stuck', severity: 'bug', text: 'The game got stuck', where }]);
  const url = new URL(issueLink(p, { id: 'r1', build: 'v0.7.0 dev' }));
  assert.equal(url.pathname, '/kj2223/History-of-Rocketry/issues/new');
  assert.match(url.searchParams.get('body'), /wac-1/);
});
