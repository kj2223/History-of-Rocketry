// THE AUTOMATED PLAYTEST'S EARS AND STOPWATCH: put into the game's page before any of its scripts run (an init script
// from tools/autoplay/run.mjs), so the sound graph the game builds is tapped from its first node. Plain script, not a
// module. Records every frame's time and, twenty times a second, the level of what goes to the speakers.
(() => {
  if (globalThis.__autoplayTap) return;
  const frames = { last: 0, gaps: [] };
  const audio = { ctx: null, analyser: null, buf: null, samples: [], alive: 0, started: 0, loops: 0 };
  globalThis.__autoplayTap = { frames, audio };

  const onFrame = now => {
    if (frames.last) frames.gaps.push(now - frames.last);
    if (frames.gaps.length > 20000) frames.gaps.splice(0, 10000);
    frames.last = now;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  // Whatever is wired to the speakers is also wired to an analyser, so the run hears what the player hears.
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = connect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      if (!audio.analyser || audio.ctx !== dest.context) {
        audio.ctx = dest.context;
        audio.analyser = audio.ctx.createAnalyser();
        audio.analyser.fftSize = 2048;
        audio.buf = new Float32Array(audio.analyser.fftSize);
      }
      connect.call(this, audio.analyser);
    }
    return out;
  };
  // Every sound started and ended, so a sound that never stops (or a pile of them) shows.
  for (const Kind of [AudioBufferSourceNode, OscillatorNode]) {
    const start = Kind.prototype.start;
    Kind.prototype.start = function (...args) {
      audio.started++;
      audio.alive++;
      const looped = !!this.loop;
      if (looped) audio.loops++;
      this.addEventListener('ended', () => {
        audio.alive--;
        if (looped) audio.loops--;
      });
      return start.apply(this, args);
    };
  }
  setInterval(() => {
    const a = audio.analyser;
    if (!a) return;
    a.getFloatTimeDomainData(audio.buf);
    let sum = 0,
      peak = 0;
    for (const v of audio.buf) {
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    audio.samples.push({
      rms: Math.sqrt(sum / audio.buf.length),
      peak,
      alive: audio.alive,
      loops: audio.loops,
      state: audio.ctx.state,
    });
    if (audio.samples.length > 4000) audio.samples.splice(0, 2000);
  }, 50);
})();
