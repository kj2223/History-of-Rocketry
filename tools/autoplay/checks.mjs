// THE AUTOMATED PLAYTEST'S JUDGEMENT: what counts as a problem in what the runner saw and heard. Plain functions, so the
// tests can check them (tests/autoplay-checks.test.js) and the thresholds live in one place.

export const LIMITS = {
  // Waiting: real seconds a player sits through at the fastest speed with nothing to decide.
  longWait: 45,
  // Frames: a frame slower than this is a visible stutter; a run of them is a slow scene.
  p95FrameMs: 34,
  hitchMs: 250,
  // A screen this much one colour, or this flat, is blank.
  blankOneColour: 0.97,
  blankSpread: 3,
  // Sound: quieter than this for a whole look is silence; a peak this high is clipping; this many live sounds is a pile-up.
  silentDb: -60,
  clipPeak: 0.99,
  jumpDb: 24,
  pileUp: 400,
  carriedOverDb: 12,
  // A liftoff quieter than this, at its loudest, has lost its engine.
  quietLiftoffDb: -40,
  // A screenshot this much changed from the approved one is worth a look.
  changed: 0.08,
  // Memory: growth over the run past this is a leak worth chasing.
  memoryGrowthMb: 400,
};

// One finding: kind (a short slug), severity (bug, warn, info), where it happened, and a line saying what.
export const finding = (kind, severity, where, text, extra = {}) => ({ kind, severity, where, text, ...extra });

// Where in words: "Flight Director, apollo-11, beat mFlight, console-poll".
export function placeText(where = {}, step = '') {
  const parts = [];
  if (where.mode === 'flight') parts.push('Flight Director', where.round, where.beat && `beat ${where.beat}`);
  else if (where.mode === 'management') parts.push('Management', where.where ?? `day ${where.day}`);
  else if (where.mode === 'desk') parts.push('Desk', `T${where.t}`);
  else if (where.mode) parts.push(where.mode);
  if (step) parts.push(step);
  return parts.filter(Boolean).join(', ');
}

// What a look (a window of watching, a screenshot and a layout scan) shows.
export function judgeLook(look, { soundOn = true, quietScene = false, liftoff = false } = {}) {
  const out = [];
  const at = look.where;
  const { frames, audio, image, layout } = look;
  if (image && (image.oneColour >= LIMITS.blankOneColour || image.spread <= LIMITS.blankSpread))
    out.push(
      finding(
        'blank-screen',
        'bug',
        at,
        `The screen is blank or one colour (${Math.round(image.oneColour * 100)}% one colour, spread ${image.spread}).`,
      ),
    );
  const LAYOUT = {
    'broken-image': ['bug', 'A picture did not load'],
    'text-cut-off': ['warn', 'Text is cut off'],
    'text-off-screen': ['warn', 'Text runs off the window'],
    'text-shortened': ['info', 'Text is shortened (the whole of it shows on hover)'],
  };
  for (const p of layout ?? []) {
    const [severity, what] = LAYOUT[p.kind] ?? ['warn', p.kind];
    out.push(finding(p.kind, severity, at, `${what}: ${p.el} "${p.text}"`, { same: `${p.kind}|${p.el}` }));
  }
  if (frames?.count > 5) {
    if (frames.p95 > LIMITS.p95FrameMs)
      out.push(
        finding(
          'slow-frames',
          'warn',
          at,
          `Slow drawing: 95% of frames within ${Math.round(frames.p95)} ms (${Math.round(1000 / frames.p95)} fps).`,
          { value: frames.p95 },
        ),
      );
    if (frames.worst > LIMITS.hitchMs)
      out.push(finding('hitch', 'warn', at, `A ${Math.round(frames.worst)} ms freeze.`, { value: frames.worst }));
  } else if (frames && frames.count <= 5)
    out.push(finding('frozen', 'bug', at, `The window drew only ${frames.count} frames while it was watched.`));
  if (audio && soundOn) {
    if (audio.tapped === false || audio.running === false)
      out.push(finding('audio-not-running', 'bug', at, 'The sound never started (the audio context is not running).'));
    else if (audio.rmsDb != null) {
      if (!quietScene && audio.loudestDb < LIMITS.silentDb)
        out.push(
          finding('silent', 'warn', at, `Silence: the loudest moment was ${audio.loudestDb.toFixed(0)} dB.`, {
            value: audio.loudestDb,
          }),
        );
      if (liftoff && audio.loudestDb < LIMITS.quietLiftoffDb)
        out.push(
          finding(
            'quiet-liftoff',
            'warn',
            at,
            `A liftoff with almost no engine: its loudest moment was ${audio.loudestDb.toFixed(0)} dB.`,
            { value: audio.loudestDb },
          ),
        );
      if (audio.clipped > 0)
        out.push(
          finding('clipping', 'bug', at, `The sound clipped ${audio.clipped} times (peak ${audio.peak.toFixed(3)}).`),
        );
      if (audio.jumpDb > LIMITS.jumpDb)
        out.push(
          finding(
            'sudden-loud',
            'info',
            at,
            `The level jumped ${audio.jumpDb.toFixed(0)} dB in a twentieth of a second.`,
          ),
        );
      if (audio.alive > LIMITS.pileUp)
        out.push(
          finding(
            'sound-pile-up',
            'bug',
            at,
            `${audio.alive} sounds playing at once: something starts sounds and never stops them.`,
          ),
        );
    }
  }
  return out;
}

// The longest waits, worst first, and a finding for each over the limit.
export function judgeWaits(steps) {
  // Watching a liftoff and the climb (with the abort call live) is not waiting: the player is watching or deciding.
  const waits = steps
    .filter(s => s.wait != null && !['console-ascent', 'liftoff'].includes(s.after))
    .map(s => ({ ...s, wait: Math.round(s.wait * 10) / 10 }))
    .sort((a, b) => b.wait - a.wait);
  const findings = waits
    .filter(s => s.wait > LIMITS.longWait)
    .map(s =>
      finding(
        'long-wait',
        'warn',
        s.where,
        `${Math.round(s.wait)} s with nothing to do at the fastest speed${s.beats?.length ? ` (longest in ${[...s.beats].sort((a, b) => b.seconds - a.seconds)[0].beat})` : ''}, before ${s.name}.`,
        { value: s.wait, step: s.name },
      ),
    );
  return { waits, findings };
}

// Memory over the run: the heap at each look, and a finding if it only ever grows.
export function judgeMemory(looks) {
  const mb = looks.map(l => l.memoryMb).filter(x => x != null);
  if (mb.length < 10) return [];
  const early = Math.min(...mb.slice(0, 5)),
    late = Math.min(...mb.slice(-5));
  return late - early > LIMITS.memoryGrowthMb
    ? [
        finding(
          'memory-growth',
          'warn',
          looks.at(-1).where,
          `Memory grew from about ${early} MB to ${late} MB over the run and did not come back down.`,
        ),
      ]
    : [];
}

// Console lines that are the engine talking, not the game going wrong.
const NOISE = [/CanvasRenderer: filter/, /No available adapters/, /Electron Security Warning/, /DevTools/];
export const isNoise = text => NOISE.some(r => r.test(text));

// The same problem seen again and again is one finding, with a count and the first place it was seen.
export function dedupe(findings) {
  const by = new Map();
  for (const f of findings) {
    const key = f.same ?? `${f.kind}|${f.text.replace(/\d+(\.\d+)?/g, '#')}`;
    const had = by.get(key);
    if (had) {
      had.count++;
      if (had.places.length < 5) had.places.push(placeText(f.where, f.step));
    } else by.set(key, { ...f, count: 1, places: [placeText(f.where, f.step)] });
  }
  const rank = { bug: 0, warn: 1, info: 2 };
  return [...by.values()].sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);
}

// A GitHub new-issue link filled in with the finding, for the report's "File it" buttons.
export function issueLink(f, run) {
  const title = `Autoplay: ${f.text.slice(0, 90)}`;
  const body = [
    `Found by the automated playtest (tools/autoplay), run ${run.id} on ${run.build}.`,
    '',
    `**What:** ${f.text}`,
    `**Where:** ${f.places.join('; ')}`,
    `**Seen:** ${f.count} time${f.count === 1 ? '' : 's'}`,
    f.shot ? `**Screenshot:** ${f.shot} in the run folder` : '',
    f.stack ? `\n\`\`\`\n${f.stack.slice(0, 1500)}\n\`\`\`` : '',
  ]
    .filter(x => x !== '')
    .join('\n');
  return `https://github.com/kj2223/History-of-Rocketry/issues/new?${new URLSearchParams({ title, body, labels: 'autoplay' })}`;
}
