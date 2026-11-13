// THE SOUND (v0.8). The game had none. Everything here is made on the spot with Web Audio (no recordings, no voices):
//  - the engine: a deep roar while a round burns, close on the site, through concrete in the dugout, a distant rumble
//    from the range plot, and a faint one through the TV speaker in Mission Control during a crewed ascent;
//  - a low thump as she lights, and a long dull boom when one comes apart or blows up on the pad;
//  - the count: a soft tick for each of the last ten seconds;
//  - the loop: a short burst of radio hiss as each line comes in, in the rooms where people talk over the net;
//  - the room itself: the hum and fans of the control rooms, the blockhouse and JPL, the wind out on the site and at sea.
// Nothing is sharp or loud: no high tones, every sound eases in and out, and the master level is modest. The Sound
// button (or M) goes full, low, off; the choice is kept.
//
// soundPlan(g, where) says what should be heard now, from the game alone (tests/flight-views.test.js checks it);
// soundFrame(g, where) makes it so, ramping each layer towards its level.
import { flightTrouble } from '../../game.js';
import { yearOf } from '../../site/draw.js';
import { breakupAge } from '../../site/tv-shots.js';
import { might } from './launch.js';

export const SOUND_KEY = 'pa-sound';
export const LEVELS = { full: 0.55, low: 0.22, off: 0 };
const NEXT = { full: 'low', low: 'off', off: 'full' };

// How much of each room you hear: the hum and fans of rooms full of equipment, the wind outdoors.
const ROOM = {
  'control-room': { hum: 0.5 },
  tracking: { hum: 0.35 },
  'flight:deep': { hum: 0.4 },
  'flight:recovery': { wind: 0.6 },
  'interior:blockhouse': { hum: 0.3 },
  'interior:dugout': { hum: 0.12, wind: 0.15 },
  'interior:hangar': { hum: 0.15 },
  'interior:sim': { hum: 0.35 },
};
// Rooms where the lines come over a net or an intercom, so each one opens with a burst of hiss.
const NETTED = /^(control-room|tracking|flight:deep|interior:(blockhouse|sim))/;

export function soundPlan(g, where = 'site') {
  const room = ROOM[where] || (where.startsWith('site') ? { wind: 0.4 } : {});
  const plan = { engine: 0, muffle: 0, hum: room.hum || 0, wind: room.wind || 0, booms: [], tick: null };
  if (!g) return plan;
  const v = g.vehicle,
    big = might(v);
  // The static firing: heard through the dugout's concrete, or across the site.
  if (g.standFlame > 0) {
    plan.engine = big * g.standFlame * (where === 'interior:dugout' ? 0.6 : 0.8);
    plan.muffle = where === 'interior:dugout' ? 0.55 : 0.25;
  }
  const f = g.flight;
  if (f?.result?.path) {
    const trouble = flightTrouble(g),
      burn = f.result.burn ?? 60,
      cut = trouble && trouble.kind !== 'tumble' ? trouble.at : Infinity,
      lit = f.t < Math.min(burn, cut) && !f.blast;
    const h = f.result.path[Math.min(f.result.path.length - 1, Math.max(0, Math.floor(f.t)))]?.h ?? 0;
    if (lit && f.view === 'site') {
      // Right there: loudest off the pad, easing as she climbs away.
      plan.engine = Math.max(plan.engine, (0.55 + 0.45 * big) / (1 + (g.rocket?.rise || 0) / 1800));
      plan.muffle = 0;
    } else if (lit && where === 'tracking') {
      // The range plot's loudspeaker: a far rumble, fading with height.
      plan.engine = Math.max(plan.engine, (0.25 + 0.2 * big) / (1 + h / 25));
      plan.muffle = 0.75;
    }
    if (f.blast) plan.booms.push({ key: f.blast, far: false, size: 1 });
    if (trouble?.kind === 'break' && f.t >= trouble.at && !f.blast)
      plan.booms.push({ key: f, far: f.view !== 'site', size: 0.4 + 0.6 * big });
  }
  // A crewed ascent, on the TV in Mission Control.
  const c = g.console;
  if (where === 'control-room' && c?.flight && c.phase === 'ascent') {
    plan.engine = Math.max(plan.engine, 0.16);
    plan.muffle = 0.9;
  }
  if (where === 'control-room' && c && breakupAge(g, c) != null) plan.booms.push({ key: c, far: true, size: 0.8 });
  // The last ten seconds of a count.
  const k = g.count;
  if (k && !k.held && k.clock > 0 && k.clock <= 10) plan.tick = Math.ceil(k.clock);
  plan.netted = NETTED.test(where);
  plan.year = g.day == null ? 1945 : yearOf(g);
  return plan;
}

// ---- The audio graph, built on first use ----
let ac = null,
  out = null,
  layers = null,
  noise = null,
  lastLine, // undefined until the first frame, so the lines already on the loop make no sound
  lastTick = null,
  lastHiss = 0,
  wasLit = false;
const boomed = new WeakSet();

export function soundSetting() {
  try {
    const s = localStorage.getItem(SOUND_KEY);
    return s in LEVELS ? s : 'full';
  } catch {
    return 'full';
  }
}
export function cycleSound() {
  const s = NEXT[soundSetting()];
  try {
    localStorage.setItem(SOUND_KEY, s);
  } catch {
    /* no storage: this session only */
  }
  if (out) out.gain.setTargetAtTime(LEVELS[s], ac.currentTime, 0.1);
  return s;
}

function start() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  ac = new AC();
  out = ac.createGain();
  out.gain.value = LEVELS[soundSetting()];
  // A gentle limiter so a boom over the engine never clips.
  const limit = ac.createDynamicsCompressor();
  limit.threshold.value = -10;
  limit.ratio.value = 8;
  out.connect(limit).connect(ac.destination);
  // Two seconds of brown noise: the roar, the wind, the fans and the hiss are all filtered from it.
  const n = ac.sampleRate * 2;
  noise = ac.createBuffer(1, n, ac.sampleRate);
  const d = noise.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = b * 3.5;
  }
  const loop = () => {
    const s = ac.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 2);
    return s;
  };
  const filter = (type, freq, q = 0.7) => {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v = 0) => {
    const x = ac.createGain();
    x.gain.value = v;
    return x;
  };
  // The engine: low roar, with a body band that the muffling takes away first.
  const engine = gain(),
    roar = filter('lowpass', 400),
    body = filter('bandpass', 260, 0.6),
    bodyGain = gain(0.6);
  loop().connect(roar).connect(engine);
  loop().connect(body).connect(bodyGain).connect(engine);
  engine.connect(out);
  // The wind: a broad band that breathes slowly.
  const wind = gain(),
    windBand = filter('bandpass', 450, 0.4),
    gust = ac.createOscillator(),
    gustDepth = gain(0.35),
    windLevel = gain(0.6);
  gust.frequency.value = 0.11;
  gust.connect(gustDepth).connect(windLevel.gain);
  gust.start();
  loop().connect(windBand).connect(windLevel).connect(wind).connect(out);
  // The room: mains hum low down, fans as a soft band above it.
  const hum = gain(),
    mains = ac.createOscillator(),
    mainsGain = gain(0.05),
    fans = filter('bandpass', 700, 0.5),
    fansGain = gain(0.35);
  mains.frequency.value = 60;
  mains.connect(mainsGain).connect(hum);
  mains.start();
  loop().connect(fans).connect(fansGain).connect(hum);
  hum.connect(out);
  layers = { engine, roar, bodyGain, wind, hum };
  // If it was still held back, the next click or key lets it go.
  const wake = () => ac.state === 'suspended' && ac.resume();
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);
  return true;
}

// A one-off sound from the noise: filtered, eased in, dying away.
function burst({ type, freq, q = 0.7, peak, attack, decay, sweep }) {
  const t = ac.currentTime,
    s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    e = ac.createGain();
  s.buffer = noise;
  s.start(t, Math.random() * 1.5, attack + decay + 0.1);
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + attack + decay);
  f.Q.value = q;
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(peak, t + attack);
  e.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  s.connect(f).connect(e).connect(out);
}
// A soft wooden tick: a low triangle, very short.
function tick() {
  const t = ac.currentTime,
    o = ac.createOscillator(),
    e = ac.createGain();
  o.type = 'triangle';
  o.frequency.value = 520;
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.12, t + 0.006);
  e.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(e).connect(out);
  o.start(t);
  o.stop(t + 0.12);
}

export function soundFrame(g, where) {
  // Browsers let sound start only after the first click or key, so the graph waits for one.
  if (!ac && (globalThis.navigator?.userActivation?.hasBeenActive === false || !start())) return;
  if (ac.state === 'suspended' || soundSetting() === 'off') {
    lastLine = g?.loop?.at(-1) ?? null;
    return;
  }
  const p = soundPlan(g, where),
    t = ac.currentTime;
  const L = layers;
  L.engine.gain.setTargetAtTime(p.engine * 0.9, t, p.engine > L.engine.gain.value ? 0.12 : 0.5);
  L.roar.frequency.setTargetAtTime(90 + 520 * (1 - p.muffle), t, 0.3);
  L.bodyGain.gain.setTargetAtTime(0.6 * (1 - p.muffle), t, 0.3);
  L.wind.gain.setTargetAtTime(p.wind * 0.35, t, 0.8);
  L.hum.gain.setTargetAtTime(p.hum * 0.18, t, 0.8);
  // She lights: one low thump as the roar comes up.
  const lit = p.engine > 0.2 && p.muffle < 0.5;
  if (lit && !wasLit) burst({ type: 'lowpass', freq: 160, sweep: 60, peak: 0.5, attack: 0.03, decay: 1.2 });
  wasLit = lit;
  for (const b of p.booms) {
    if (boomed.has(b.key)) continue;
    boomed.add(b.key);
    burst({
      type: 'lowpass',
      freq: b.far ? 140 : 260,
      sweep: 50,
      peak: (b.far ? 0.45 : 0.85) * b.size,
      attack: b.far ? 0.12 : 0.04,
      decay: 3.2,
    });
  }
  if (p.tick != null && p.tick !== lastTick) tick();
  lastTick = p.tick;
  // A line on the loop: a short hiss as the net opens, at most a few a second.
  const line = g?.loop?.at(-1) ?? null;
  if (line && lastLine !== undefined && line !== lastLine && p.netted && t - lastHiss > 0.35) {
    lastHiss = t;
    burst({ type: 'bandpass', freq: p.year < 1958 ? 1100 : 1700, q: 1.1, peak: 0.07, attack: 0.015, decay: 0.16 });
  }
  lastLine = line;
}
