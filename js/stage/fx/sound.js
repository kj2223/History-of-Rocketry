// THE SOUND (v0.8). The game had none. Everything here is made on the spot with Web Audio (no recordings, no voices):
//  - the engine: a deep roar while a round burns, close on the site, through concrete in the dugout, a distant rumble
//    from the range plot, and a faint one through the TV speaker in Mission Control during a crewed ascent;
//  - a low thump as she lights, and a long dull boom when one comes apart or blows up on the pad;
//  - the count: a soft tick for each of the last ten seconds;
//  - the loop: a short burst of radio hiss as each line comes in, in the rooms where people talk over the net;
//  - the room itself: the hum and fans of the control rooms, the blockhouse and JPL, the wind out on the site and at sea.
// Each vehicle has its own voice, from what really burned in it (VOICES below): the WAC's thin acid hiss, the V-2's rough
// alcohol roar, the Atlas's broad kerosene roar thinning when the boosters drop, the Titan II's clean storable burn, the
// Saturn V's deep crackle, the Shuttle's solids. Before she lights, the cryogenic ones vent liquid oxygen on the pad, and
// the Juno's upper-stage tub spins up with a low whirr in the last minute.
// Nothing is sharp or loud: no high tones, every sound eases in and out, and the master level is modest. The Sound
// button (or M) goes full, low, off; the choice is kept.
//
// soundPlan(g, where) says what should be heard now, from the game alone (tests/flight-views.test.js checks it);
// soundFrame(g, where) makes it so, ramping each layer towards its level.
import { flightTrouble } from '../../game.js';
import { yearOf } from '../../site/draw.js';
import { breakupAge } from '../../site/tv-shots.js';
import { might } from './launch.js';
import { ORBITAL_STACKS, SOUNDING_STACKS } from '../../data/stacks.js';

export const SOUND_KEY = 'pa-sound';
export const LEVELS = { full: 0.55, low: 0.22, off: 0 };
const NEXT = { full: 'low', low: 'off', off: 'full' };

// How much of each room you hear: the hum and fans of rooms full of equipment, the wind outdoors.
const ROOM = {
  'control-room': { hum: 0.5 },
  tracking: { hum: 0.35 },
  'flight:deep': { hum: 0.4 },
  'flight:recovery': { wind: 0.6, surf: 0.5 },
  'interior:blockhouse': { hum: 0.3 },
  'interior:dugout': { hum: 0.12, wind: 0.15 },
  'interior:hangar': { hum: 0.15 },
  'interior:sim': { hum: 0.35 },
  // The "While you were away" card over the site: the site's wind, softer, while the weeks pass (it was silent).
  away: { wind: 0.25 },
  // Desk mode: the Houston MOCR in July 1969, a full room.
  desk: { hum: 0.45 },
  // The management map: the Cape, on the sea, with the wind off it.
  manage: { wind: 0.3, surf: 0.4 },
};
// THE VOICES. What an engine sounds like comes from what it burns and how hard:
//   roar   where the low roar is cut off (Hz): lower is deeper
//   body   the band that gives it its colour (Hz), and how narrow (q)
//   crackle  the popping of shock waves in the plume (0..1): the big kerosene engines and the solids crackle
//   sub    the deep shake under it all (0..1), by size
//   hiss   the clean high rush of a pressure-fed or hydrogen engine (0..1), and where it sits (hissAt, Hz)
//   rough  a flutter in the burn (0..1): the V-2's alcohol engine ran rough
export const VOICES = {
  // Tiny Tim, the Aerobee's booster: a short hard crack off the tower.
  kick: { roar: 900, body: 520, q: 0.8, crackle: 0.8, sub: 0.1, hiss: 0.35, hissAt: 1300, rough: 0 },
  // Aniline and red fuming nitric acid, pressure-fed and small (the WAC Corporal, the Aerobee): thin, hissing, little body.
  acid: { roar: 720, body: 440, q: 1, crackle: 0.05, sub: 0, hiss: 0.6, hissAt: 1500, rough: 0.05 },
  // Alcohol and liquid oxygen, steam-driven pumps (the V-2): a rough, ragged roar.
  'alcohol-rough': { roar: 460, body: 250, q: 0.6, crackle: 0.4, sub: 0.3, hiss: 0.15, hissAt: 1200, rough: 0.6 },
  // The same, smoother and steadier (Viking, Redstone).
  alcohol: { roar: 480, body: 280, q: 0.7, crackle: 0.25, sub: 0.3, hiss: 0.15, hissAt: 1200, rough: 0.15 },
  // Kerosene and liquid oxygen (Vanguard, Jupiter, Atlas's boosters, the Merlins): a broad crackling roar.
  kerosene: { roar: 380, body: 210, q: 0.6, crackle: 0.55, sub: 0.55, hiss: 0.1, hissAt: 1100, rough: 0.1 },
  // The Atlas's sustainer alone, after the boosters drop: thinner, higher.
  sustainer: { roar: 540, body: 320, q: 0.8, crackle: 0.2, sub: 0.15, hiss: 0.3, hissAt: 1300, rough: 0.05 },
  // Storable hypergolics, big (Titan II): a clean, smooth, almost quiet burn with little crackle.
  storable: { roar: 430, body: 300, q: 0.5, crackle: 0.08, sub: 0.45, hiss: 0.45, hissAt: 1250, rough: 0 },
  // Eight H-1s (Saturn IB): deep and heavy.
  h1: { roar: 320, body: 180, q: 0.6, crackle: 0.65, sub: 0.8, hiss: 0.05, hissAt: 1100, rough: 0.1 },
  // Five F-1s (Saturn V): the deepest of all, a long tearing crackle you feel more than hear.
  f1: { roar: 250, body: 130, q: 0.5, crackle: 0.95, sub: 1, hiss: 0.05, hissAt: 1000, rough: 0.12 },
  // Hydrogen and oxygen alone (J-2s, the Shuttle's and SLS's main engines after the solids): a clean high rush.
  hydrogen: { roar: 620, body: 360, q: 0.7, crackle: 0.03, sub: 0.1, hiss: 0.65, hissAt: 1150, rough: 0 },
  // Big solids with hydrogen engines under them (Shuttle, SLS): harsh, broad, crackling hard.
  solids: { roar: 300, body: 170, q: 0.45, crackle: 1, sub: 0.9, hiss: 0.35, hissAt: 1200, rough: 0.15 },
};
// Each vehicle's voice, stage by stage (the stages of data/stacks.js; a vehicle not there flies its first voice throughout).
const VEHICLE_VOICES = {
  wac: ['kick', 'acid'],
  v2: ['alcohol-rough'],
  bumper: ['alcohol-rough', 'acid'],
  aerobee: ['kick', 'acid'],
  viking: ['alcohol'],
  redstone: ['alcohol'],
  vanguard: ['kerosene', 'acid'],
  juno: ['kerosene', 'kick'],
  atlas: ['kerosene', 'sustainer'],
  ranger: ['kerosene', 'sustainer', 'acid'],
  titan: ['storable', 'storable'],
  saturnib: ['h1', 'hydrogen'],
  saturn5: ['f1', 'hydrogen', 'hydrogen'],
  shuttle: ['solids', 'hydrogen'],
  sls: ['solids', 'hydrogen'],
  dragon: ['kerosene', 'kerosene'],
  // The management game's 1958 Cape: Thor and Atlas with the Able upper stage.
  thor: ['kerosene'],
  'thor-able': ['kerosene', 'acid'],
  'atlas-able': ['kerosene', 'sustainer', 'acid'],
};
// Vehicles that fuel with liquid oxygen on the pad, so they vent it as a white hiss through the count.
const CRYOGENIC = new Set([
  'v2',
  'bumper',
  'viking',
  'redstone',
  'vanguard',
  'juno',
  'atlas',
  'ranger',
  'saturnib',
  'saturn5',
  'shuttle',
  'sls',
  'dragon',
  'thor',
  'thor-able',
  'atlas-able',
]);
// Which stage is burning t seconds after liftoff.
function stageAt(vehicle, t) {
  const stages = (ORBITAL_STACKS[vehicle] || SOUNDING_STACKS[vehicle])?.stages;
  if (!stages) return 0;
  let end = 0;
  for (let i = 0; i < stages.length; i++) {
    end += stages[i].burn + (stages[i].coast || 0);
    if (t < end) return i;
  }
  return stages.length - 1;
}
// The voice of a vehicle t seconds after liftoff (t = 0 for a static firing or on the pad).
export function voiceOf(vehicle, t = 0) {
  const names = VEHICLE_VOICES[vehicle] || ['alcohol'];
  const name = names[Math.min(names.length - 1, stageAt(vehicle, t))];
  return { name, ...VOICES[name] };
}

// Rooms where the lines come over a net or an intercom, so each one opens with a burst of hiss.
const NETTED = /^(control-room|tracking|flight:deep|interior:(blockhouse|sim))/;

export function soundPlan(g, where = 'site') {
  const room = ROOM[where] || (where.startsWith('site') ? { wind: 0.4 } : {});
  const plan = {
    engine: 0,
    muffle: 0,
    hum: room.hum || 0,
    wind: room.wind || 0,
    booms: [],
    tick: null,
    voice: voiceOf(null),
    vent: 0,
    spin: 0,
    surf: room.surf || 0,
    thuds: 0,
    clatter: null,
    rumble: null,
    year: 1958,
  };
  if (!g) return plan;
  const v = g.vehicle,
    big = might(v);
  plan.voice = voiceOf(v, g.flight?.result?.path ? g.flight.t || 0 : 0);
  // The static firing: heard through the dugout's concrete, or across the site.
  // The dugout sits a stone's throw from the stand, so even a small round is loud there: nearly as loud as a launch,
  // a little dulled by the concrete, with the thump as she lights (Aaron, 13 Nov: it was too faint to hear at all).
  if (g.standFlame > 0) {
    const dug = where === 'interior:dugout';
    plan.engine = (dug ? 0.45 + 0.35 * big : 0.5 + 0.4 * big) * g.standFlame;
    plan.muffle = dug ? 0.4 : 0.15;
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
  // On the pad through the count: liquid oxygen boiling off through the vents, heard from out on the site (faintly in
  // the blockhouse), and the Juno's upper-stage tub spinning up in the last minute.
  if (k && k.clock > 0 && !g.flight) {
    const out = where.startsWith('site') ? 1 : where === 'interior:blockhouse' ? 0.25 : 0;
    if (CRYOGENIC.has(v)) plan.vent = 0.5 * out;
    if (v === 'juno' && k.clock <= 60) plan.spin = 0.6 * out;
  }
  plan.netted = NETTED.test(where);
  plan.year = g.day == null ? 1945 : yearOf(g);
  return plan;
}

// ---- The audio graph, built on first use ----
let ac = null,
  out = null,
  layers = null,
  noise = null,
  white = null,
  lastLine, // undefined until the first frame, so the lines already on the loop make no sound
  lastTick = null,
  lastHiss = 0,
  lastThud = 0,
  lastRattle = 0,
  lastClatter, // undefined until the first frame, so the page already printed makes no sound
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
  // And a soft ceiling after it, so the crackle's sharpest pops round off instead of clipping.
  const soft = ac.createWaveShaper(),
    curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i++) curve[i] = 0.9 * Math.tanh((i / 512 - 1) / 0.9);
  soft.curve = curve;
  out.connect(limit).connect(soft).connect(ac.destination);
  // Two seconds of brown noise: the roar, the wind, the fans and the hiss are all filtered from it.
  const n = ac.sampleRate * 2;
  noise = ac.createBuffer(1, n, ac.sampleRate);
  const d = noise.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = b * 3.5;
  }
  // And two of white noise, for the high rushes and hisses the brown noise is too dark to give.
  white = ac.createBuffer(1, n, ac.sampleRate);
  const w = white.getChannelData(0);
  for (let i = 0; i < n; i++) w[i] = (Math.random() * 2 - 1) * 0.5;
  const loop = (buf = noise) => {
    const s = ac.createBufferSource();
    s.buffer = buf;
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
  // The voice's layers all feed `shape`, whose level the roughness flutters, and then the engine's level.
  const shape = gain(1),
    flutter = ac.createOscillator(),
    flutterDepth = gain(0);
  flutter.frequency.value = 7.3;
  flutter.connect(flutterDepth).connect(shape.gain);
  flutter.start();
  loop().connect(roar).connect(shape);
  loop().connect(body).connect(bodyGain).connect(shape);
  // The crackle: a loop of sparse pops, banded so it tears rather than clicks.
  const pops = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate),
    pd = pops.getChannelData(0);
  for (let i = 0; i < pd.length; i++)
    if (Math.random() < 0.003) {
      const a = (Math.random() < 0.15 ? 1 : 0.35) * (Math.random() < 0.5 ? -1 : 1),
        len = 80 + Math.floor(Math.random() * 220);
      for (let j = 0; j < len && i + j < pd.length; j++) pd[i + j] += a * Math.exp(-j / (len / 4));
    }
  const crackleSrc = ac.createBufferSource();
  crackleSrc.buffer = pops;
  crackleSrc.loop = true;
  crackleSrc.start(0, Math.random() * 2);
  const crackleBand = filter('bandpass', 900, 0.5),
    crackleTop = filter('lowpass', 2400),
    crackleGain = gain(0);
  crackleSrc.connect(crackleBand).connect(crackleTop).connect(crackleGain).connect(shape);
  // The deep shake under it, and the clean high rush.
  const subBand = filter('lowpass', 70),
    subGain = gain(0),
    hissBand = filter('bandpass', 1200, 0.8),
    hissGain = gain(0);
  loop().connect(subBand).connect(subGain).connect(shape);
  loop(white).connect(hissBand).connect(hissGain).connect(shape);
  shape.connect(engine).connect(out);
  // On the pad: liquid oxygen venting (a soft white hiss that puffs), and the Juno's tub spinning (a low whirr).
  const vent = gain(),
    ventBand = filter('bandpass', 1900, 0.6),
    ventTop = filter('lowpass', 3200),
    puff = ac.createOscillator(),
    puffDepth = gain(0.3),
    ventLevel = gain(0.7);
  puff.frequency.value = 0.07;
  puff.connect(puffDepth).connect(ventLevel.gain);
  puff.start();
  loop(white).connect(ventBand).connect(ventTop).connect(ventLevel).connect(vent).connect(out);
  const spin = gain(),
    whirr = ac.createOscillator(),
    whirrTop = filter('lowpass', 420);
  whirr.type = 'sawtooth';
  whirr.frequency.value = 92;
  whirr.connect(whirrTop).connect(spin).connect(out);
  whirr.start();
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
  // Valve equipment buzzes at twice the mains; it fades from the rooms as transistors and then computers take over.
  const buzz = ac.createOscillator(),
    buzzGain = gain(0);
  buzz.frequency.value = 120;
  buzz.connect(buzzGain).connect(hum);
  buzz.start();
  loop().connect(fans).connect(fansGain).connect(hum);
  hum.connect(out);
  // The sea: a low wash that swells and draws back, slower than the wind.
  const surf = gain(),
    surfBand = filter('lowpass', 520),
    swell = ac.createOscillator(),
    swellDepth = gain(0.45),
    surfLevel = gain(0.55);
  swell.frequency.value = 0.085;
  swell.connect(swellDepth).connect(surfLevel.gain);
  swell.start();
  loop().connect(surfBand).connect(surfLevel).connect(surf).connect(out);
  layers = {
    engine,
    roar,
    body,
    bodyGain,
    crackleGain,
    subGain,
    hissBand,
    hissGain,
    flutterDepth,
    wind,
    hum,
    buzzGain,
    fans,
    surf,
    vent,
    spin,
    whirr,
  };
  // If it was still held back, the next click or key lets it go.
  const wake = () => ac.state === 'suspended' && ac.resume();
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);
  return true;
}

// A one-off sound from the noise: filtered, eased in, dying away.
function burst({ type, freq, q = 0.7, peak, attack, decay, sweep, after = 0, buf = noise }) {
  const t = ac.currentTime + after,
    s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    e = ac.createGain();
  s.buffer = buf;
  // Looped, so a long one (a boom, the liftoff rumble) is not cut off at the end of the two-second buffer.
  s.loop = true;
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
// The teletype printing a page: a quick run of soft, dull clacks, a line at a time.
function rattle() {
  for (let i = 0, at = 0; i < 18; i++) {
    at += 0.06 + Math.random() * 0.04 + (i % 6 === 5 ? 0.22 : 0);
    burst({
      type: 'bandpass',
      freq: 900 + Math.random() * 300,
      q: 1.6,
      peak: 1,
      attack: 0.004,
      decay: 0.05,
      after: at,
      buf: white,
    });
  }
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

// Can sound play now? Browsers let it start only after the first click or key, so the graph waits for one.
function ready() {
  if (!ac && (globalThis.navigator?.userActivation?.hasBeenActive === false || !start())) return false;
  return ac.state !== 'suspended' && soundSetting() !== 'off';
}

// The Flight Director's game: what the scene on screen should sound like.
export function soundFrame(g, where) {
  const line = g?.loop?.at(-1) ?? null;
  if (!ready()) {
    lastLine = line;
    return;
  }
  play(soundPlan(g, where), line);
}

// Make a plan heard. line: the latest line on the loop (a new one, in a netted room, opens with a hiss).
function play(p, line) {
  const t = ac.currentTime;
  const L = layers;
  L.engine.gain.setTargetAtTime(p.engine * 0.55, t, p.engine > L.engine.gain.value ? 0.12 : 0.5);
  // The voice, muffled by distance or concrete: the muffle takes the top off first, then the colour, then the crackle.
  const v = p.voice,
    open = 1 - p.muffle;
  L.roar.frequency.setTargetAtTime(90 + (v.roar - 90) * (0.2 + 0.8 * open), t, 0.3);
  L.body.frequency.setTargetAtTime(v.body, t, 0.3);
  L.body.Q.setTargetAtTime(v.q, t, 0.3);
  L.bodyGain.gain.setTargetAtTime(0.6 * open, t, 0.3);
  L.crackleGain.gain.setTargetAtTime(3.5 * v.crackle * open * open, t, 0.3);
  L.subGain.gain.setTargetAtTime(1.6 * v.sub, t, 0.3);
  L.hissBand.frequency.setTargetAtTime(v.hissAt, t, 0.3);
  L.hissGain.gain.setTargetAtTime(2.5 * v.hiss * open * open, t, 0.3);
  L.flutterDepth.gain.setTargetAtTime(0.35 * v.rough * open, t, 0.3);
  L.vent.gain.setTargetAtTime(p.vent * 0.6, t, 1.2);
  L.spin.gain.setTargetAtTime(p.spin * 0.05, t, 1.5);
  L.whirr.frequency.setTargetAtTime(p.spin ? 120 : 70, t, 8);
  L.wind.gain.setTargetAtTime(p.wind * 0.35, t, 0.8);
  L.hum.gain.setTargetAtTime(p.hum * 0.45, t, 0.8);
  const valves = p.year < 1962 ? 1 : p.year < 1980 ? 0.4 : 0;
  L.buzzGain.gain.setTargetAtTime(0.03 * valves, t, 2);
  L.fans.frequency.setTargetAtTime(p.year < 1980 ? 700 : 950, t, 2);
  L.surf.gain.setTargetAtTime(p.surf * 0.4, t, 1.2);
  // A pile driver on the works, every second and a half or so: a low dull thud.
  if (p.thuds > 0 && t - lastThud > 1.5 + Math.random() * 0.3) {
    lastThud = t;
    burst({ type: 'lowpass', freq: 140, sweep: 60, peak: 0.4 * p.thuds, attack: 0.01, decay: 0.45 });
  }
  // The teletype prints a page.
  if (p.clatter != null && p.clatter !== lastClatter && lastClatter !== undefined && t - lastRattle > 1.5) {
    lastRattle = t;
    rattle();
  }
  lastClatter = p.clatter;
  // Liftoff, heard far off or through the room's TV: a long low rumble swelling and dying away.
  if (p.rumble && !boomed.has(p.rumble)) {
    boomed.add(p.rumble);
    burst({ type: 'lowpass', freq: 220, sweep: 70, peak: 0.3, attack: 1.8, decay: 9 });
  }
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
  if (line && lastLine !== undefined && line !== lastLine && p.netted && t - lastHiss > 0.35) {
    lastHiss = t;
    burst({
      type: 'bandpass',
      freq: p.year < 1958 ? 1100 : 1700,
      q: 1.1,
      peak: 1,
      attack: 0.015,
      decay: 0.16,
      buf: white,
    });
  }
  lastLine = line;
}

// DESK MODE (js/desk): the MOCR's hum, a hiss as each line you are listening to comes in, the teletype printing its
// pages, the last ten seconds ticking, and the liftoff as a long rumble through the room's TV.
export function deskPlan(d) {
  const plan = soundPlan(null, 'desk');
  plan.year = 1969;
  plan.netted = true;
  if (!d) return plan;
  plan.clatter = d.tty?.length ?? 0;
  if (!d.done && d.t < 0 && d.t >= -10) plan.tick = Math.ceil(-d.t);
  if (d.done || d.t >= 0) plan.rumble = d;
  return plan;
}
const seenDesks = new WeakSet();
export function deskSound(d) {
  // A desk opened already flown keeps its liftoff to itself.
  if (d && !seenDesks.has(d)) {
    seenDesks.add(d);
    if (d.done) boomed.add(d);
  }
  const heard = d?.log?.filter(l => l.heard).at(-1) ?? null;
  if (!ready()) {
    lastLine = heard;
    lastClatter = d?.tty?.length ?? 0;
    return;
  }
  play(deskPlan(d), heard);
}

// THE MANAGEMENT MAP (js/manage): the Cape's sea and wind, quieter at night; a pile driver while works go up by day;
// and a launch from one of the pads, heard across the Cape in the vehicle's own voice.
// at: { part (of the day), speed, night (0..1), works (how many buildings going up), stands (view.js standsOn) }
export function managePlan({ part = 0.5, speed = 1, night = 0, works = 0, stands = [], year = 1958 } = {}) {
  const plan = soundPlan(null, 'manage');
  plan.year = year;
  plan.wind *= 1 - 0.4 * night;
  plan.thuds =
    works > 0 && night < 0.3 && speed > 0 && speed <= 4 && part > 0.3 && part < 0.72
      ? Math.min(1, 0.6 + 0.2 * works)
      : 0;
  const up = stands.find(s => s.rise > 0 && s.rise < 260);
  if (up) {
    plan.voice = voiceOf(up.vehicle, 0);
    plan.engine = (0.35 + 0.25 * might(up.vehicle)) / (1 + up.rise / 120);
    plan.muffle = 0.55;
  }
  return plan;
}
export function manageSound(at) {
  if (ready()) play(managePlan(at), null);
}

// The title screen: only the wind over the site behind it.
export function titleSound() {
  if (ready()) play(soundPlan(null, 'site'), null);
}
