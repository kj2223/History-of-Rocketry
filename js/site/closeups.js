// CLOSE-UPS AT KEY MOMENTS (next-level visual pass, November 2026). For a few beats of a flight a small pixel-art
// shot cuts in at the top of the screen for about two and a half seconds, the way a film would cut to a close-up:
// - the firing: a hand on the firing switch or button, the lamp beside it coming on as she lights;
// - staging: the event lamps, the STAGE lamp coming on, the mission clock running;
// - contact on the Moon: the blue CONTACT LIGHT on the lander's panel;
// - home safe: a controller's face, grinning, with the room cheering behind.
// The shot is a picture-in-picture, clear of the bottom-right call strip, and never covers the screen for long. It
// fades in and out; the lamps ramp up over a fraction of a second over a small area, so nothing flashes. The dev
// menu's switch (localStorage 'pa-closeups' = 'off') turns them off. Presentation only.
import { paintPortrait } from './portraits.js';
import { roomMood } from '../stage/fx/moods.js';
import { dateOf } from '../core/calendar.js';

export const CLOSEUPS_KEY = 'pa-closeups';
export const SHOT_W = 128,
  SHOT_H = 72,
  HOLD = 2.6;

// What the shots watch for, from the game. Pure, for the tests.
export function snapshot(g) {
  const c = g.console;
  const staging = c?.round?.ascent?.staging || [];
  return {
    flying: g.rocket?.where === 'flying',
    staged: c && c.phase === 'ascent' ? staging.filter(s => c.t >= s.t).length : 0,
    surface: c?.flight?.phase === 'On the surface',
    home: !!c && c.phase === 'done' && roomMood(g, c) === 'cheer',
  };
}

// Which shot a change from one snapshot to the next calls for, or null.
export function cueOf(prev, now) {
  if (!prev) return null;
  if (now.flying && !prev.flying) return 'fire';
  if (now.staged > prev.staged) return 'stage';
  if (now.surface && !prev.surface) return 'contact';
  if (now.home && !prev.home) return 'home';
  return null;
}

const CAPTIONS = { fire: 'Fire', stage: 'Staging', contact: 'Contact light', home: 'Home safe' };

// The era's palette for the panels.
function eraLook(year) {
  if (year < 1958) return { panel: 0x4a4a32, panelHi: 0x5e5c40, plate: 0xc8b47a, metal: 0xb0905a, lamp: 0xff6a3a };
  if (year < 1976) return { panel: 0x4c5458, panelHi: 0x5e686c, plate: 0xd8d0b0, metal: 0x9aa2a6, lamp: 0xff5040 };
  if (year < 1996) return { panel: 0x6a6252, panelHi: 0x7c745f, plate: 0xe0d4b0, metal: 0xb0a890, lamp: 0xffb347 };
  return { panel: 0x2a3038, panelHi: 0x384048, plate: 0x8aa0b8, metal: 0x707a86, lamp: 0x4c9aff };
}

const mixC = (a, b, k) => {
  const ch = (c, s) => (c >> s) & 255;
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * Math.max(0, Math.min(1, k)));
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

// Paints a shot at progress k (0..1 over its hold) through rect(x, y, w, h, colour). Pure apart from rect.
export function paintShot(rect, kind, k, { year = 1965, name = 'Frank Hollis', clock = 0 } = {}) {
  const L = eraLook(year);
  const W = SHOT_W,
    H = SHOT_H;
  // The panel, lit from above.
  rect(0, 0, W, H, L.panel);
  rect(0, 0, W, 2, L.panelHi);
  for (let y = 8; y < H; y += 16) rect(0, y, W, 1, mixC(L.panel, 0, 0.25));
  const lampOn = (at, len = 0.12) => Math.max(0, Math.min(1, (k - at) / len));
  if (kind === 'fire') {
    // The label plate, the guard, the button, and a hand coming down on it; the lamp beside it ramps up as she lights.
    rect(40, 10, 48, 9, L.plate);
    rect(44, 13, 40, 2, mixC(L.plate, 0, 0.5));
    const press = Math.min(1, Math.max(0, (k - 0.15) / 0.25));
    rect(46, 30, 36, 30, mixC(L.panel, 0, 0.35));
    rect(50, 34, 28, 22, 0xa02a20);
    rect(52, 36, 24, 4, 0xc8443a);
    const hy = 2 + press * 26;
    const skin = 0xd8a882,
      skinS = 0xb88a66;
    rect(50, hy - 8, 30, 10, year < 1958 ? 0x6a6040 : 0xe4e2da); // the cuff
    rect(50, hy, 4, 9, skinS); // the thumb
    rect(54, hy, 22, 13, skin); // the back of the hand
    rect(72, hy, 4, 13, skinS);
    for (const fx of [62, 67, 72]) rect(fx, hy + 12, 4, 5, fx === 72 ? skinS : skin); // fingers curled under
    rect(56, hy + 12, 5, 12, skin); // the finger on the button
    rect(60, hy + 12, 1, 12, skinS);
    const on = lampOn(0.45);
    rect(96, 34, 14, 14, mixC(0x301010, L.lamp, on));
    rect(98, 36, 4, 3, mixC(0x301010, 0xffffff, on * 0.6));
  } else if (kind === 'stage') {
    // A row of event lamps; the STAGE lamp comes on; the mission clock's digits run.
    for (let i = 0; i < 6; i++) {
      const on = i === 2 ? lampOn(0.25) : i < 2 ? 1 : 0;
      rect(10 + i * 19, 12, 15, 11, mixC(0x2a2620, i === 2 ? 0xffb347 : 0xe8e2c8, on * (i === 2 ? 1 : 0.7)));
    }
    rect(8, 34, 112, 28, 0x0c0f0c);
    const t = Math.max(0, Math.floor(clock + k * 2.6));
    const digits = `${String(Math.floor(t / 60)).padStart(2, '0')}${String(t % 60).padStart(2, '0')}`;
    digits.split('').forEach((d, i) => seg(rect, 20 + i * 24 + (i > 1 ? 8 : 0), 38, +d, 0xff7a30));
    rect(66, 44, 3, 3, 0xff7a30);
    rect(66, 52, 3, 3, 0xff7a30);
  } else if (kind === 'contact') {
    // The lander's panel and its blue lamp.
    rect(0, 0, W, H, 0x2a2c30);
    for (let i = 0; i < 4; i++) rect(12 + i * 28, 14, 20, 12, 0x1c1e22);
    const on = lampOn(0.2, 0.15);
    rect(36, 34, 56, 30, mixC(0x2a2c30, 0x3a5a88, on * 0.5)); // the lamp's light on the panel round it
    rect(40, 38, 48, 22, mixC(0x101828, 0x5aa0ff, on));
    rect(44, 42, 40, 3, mixC(0x101828, 0xd0e4ff, on));
    rect(44, 52, 40, 3, mixC(0x101828, 0xd0e4ff, on * 0.8));
  } else if (kind === 'home') {
    // A face grinning in close-up, the room behind, and small flags going up.
    rect(0, 0, W, H, 0x1e2a24);
    for (let i = 0; i < 6; i++) rect(4 + i * 22, 44 - (i % 2) * 4, 14, 28, mixC(0x1e2a24, 0x506070, 0.4));
    const s = 3,
      ox = 34,
      oy = 6;
    // The portrait without its backdrop, so the room shows behind the face.
    let bg = null;
    paintPortrait(
      (x, y, c) => {
        if (bg === null) bg = c;
        if (c !== bg) rect(ox + x * s, oy + y * s, s, s, c);
      },
      name,
      year,
    );
    // The grin.
    for (let x = 8; x <= 11; x++) rect(ox + x * s, oy + 12 * s, s, s, 0xf4f0e8);
    rect(ox + 7 * s, oy + 11 * s, s, s, 0x5a3022);
    rect(ox + 12 * s, oy + 11 * s, s, s, 0x5a3022);
    const up = Math.min(1, k * 2);
    for (const fx of [8, 104]) {
      const fy = 40 - up * 24;
      rect(fx + 6, fy, 1, 22, 0x8a7a5a);
      rect(fx + 7, fy, 12, 8, 0xb22234);
      for (let r = 1; r < 4; r++) rect(fx + 7, fy + r * 2, 12, 1, 0xf3efe4);
      rect(fx + 7, fy, 5, 4, 0x3c3b6e);
    }
  }
}

// A seven-segment digit, 12 x 18.
function seg(rect, x, y, d, col) {
  const on = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'][d] || '';
  const S = {
    a: [2, 0, 8, 2],
    b: [10, 2, 2, 6],
    c: [10, 10, 2, 6],
    d: [2, 16, 8, 2],
    e: [0, 10, 2, 6],
    f: [0, 2, 2, 6],
    g: [2, 8, 8, 2],
  };
  for (const [k, [sx, sy, w, h]] of Object.entries(S)) rect(x + sx, y + sy, w, h, on.includes(k) ? col : 0x2a1408);
}

// ---- the overlay ----
let el = null,
  cv = null,
  cap = null,
  prev = null,
  shot = null;

function ensure() {
  if (el || typeof document === 'undefined') return el;
  el = document.createElement('div');
  el.id = 'closeup';
  el.setAttribute('aria-hidden', 'true');
  cv = document.createElement('canvas');
  cv.width = SHOT_W;
  cv.height = SHOT_H;
  cap = document.createElement('div');
  cap.className = 'caption';
  el.append(cv, cap);
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

export const closeupsWanted = () => {
  try {
    return localStorage.getItem(CLOSEUPS_KEY) !== 'off';
  } catch {
    return true;
  }
};

// Off the flight (the title screen, a management game) the shot goes away at once.
export function hideCloseup() {
  shot = null;
  prev = null;
  if (el) el.hidden = true;
}

// Once a frame from the game loop.
export function closeupFrame(g, dt) {
  if (!ensure()) return;
  const now = snapshot(g);
  const cue = cueOf(prev, now);
  prev = now;
  if (cue && closeupsWanted()) {
    const last = g.console?.chatter?.at(-1)?.who;
    shot = { kind: cue, age: 0, name: last || 'Frank Hollis', clock: g.console?.t ?? 0 };
    cap.textContent = CAPTIONS[cue];
  }
  if (!shot) {
    el.hidden = true;
    return;
  }
  shot.age += Math.min(0.1, dt);
  const k = shot.age / HOLD;
  if (k >= 1) {
    shot = null;
    el.hidden = true;
    return;
  }
  el.hidden = false;
  // In over a quarter second and out over a third: opacity only.
  el.style.opacity = String(Math.min(1, shot.age / 0.25, (HOLD - shot.age) / 0.35));
  const ctx = cv.getContext('2d');
  const year = dateOf(g.day ?? 0).year;
  paintShot(
    (x, y, w, h, c) => {
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, w, h);
    },
    shot.kind,
    k,
    { year, name: shot.name, clock: shot.clock },
  );
}
