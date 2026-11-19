// DEPTH IN THE ROOMS (next-level visual pass, November 2026). A control room seen from a seat at the back:
// - out-of-focus shapes close to the camera along the bottom edge (the back of a chair, the head and shoulders of
//   someone sitting in front of you, a desk's edge), soft and dark, with a thin rim of the screens' light on top;
//   they slide a little against the room as the pointer moves, so the room reads as deep;
// - haze hanging in the air and catching the big screens' light: tobacco smoke in the 1958–75 rooms, when every
//   console had an ashtray, and a lighter haze of dust in the later ones.
// Drawn at full resolution over the pixels (marked crisp, as the 2D-HD light is) and kept clear of the readings:
// the shapes stay in the bottom margin under the front row's labels. Nothing flashes: the haze only drifts, and its
// brightness never changes. Calm effects (fx/calm.js) holds the parallax still.
import { BlurFilter, Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { puffTexture } from '../kit.js';
import { calm } from './calm.js';

// How smoky a year's room is (0..1): heavy through the Apollo years, gone by the Shuttle's, a little dust after.
export function smokeOf(year) {
  if (year < 1958) return 0.5;
  if (year <= 1975) return 1;
  if (year <= 1985) return 0.4;
  return 0.15;
}

// Where the pointer is, -1..1 across the window, shared by every room.
const pointer = { x: 0, y: 0 };
if (typeof window !== 'undefined')
  window.addEventListener('pointermove', e => {
    pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointer.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  });

// The layer for a room. glowAt(): the big screen as [x, y, w, h] in screen pixels (for the haze to catch), or null.
export function roomDepth() {
  const root = new Container();
  root.crisp = true;
  const haze = new Container();
  const near = new Container();
  const shapes = new Graphics();
  near.addChild(shapes);
  const blur = new BlurFilter({ strength: 4, quality: 3 });
  near.filters = [blur];
  root.addChild(haze, near);
  const tex = puffTexture();
  let wisps = [],
    builtFor = '',
    px = 0,
    py = 0;

  // The near shapes, for a screen w x h. era: the interface era (field, steel, amber, desktop, glass).
  function build(w, h, era, smoke) {
    shapes.clear();
    const k = h / 1080,
      dark = 0x06080b,
      rim = era === 'amber' ? 0x7a5a30 : era === 'glass' ? 0x2a4a70 : 0x3a5048;
    // A desk's edge across the bottom, just in frame.
    shapes.rect(-40, h - 14 * k, w + 80, 40 * k).fill({ color: dark, alpha: 0.9 });
    // Left: the head and shoulders of someone sitting in front of you, and their chair's back beside them.
    const sx = w * 0.2,
      top = h - 80 * k;
    shapes.roundRect(sx - 150 * k, top + 34 * k, 300 * k, 140 * k, 50 * k).fill({ color: dark, alpha: 0.95 });
    shapes.circle(sx, top + 4 * k, 40 * k).fill({ color: dark, alpha: 0.95 });
    shapes.roundRect(sx + 180 * k, top + 20 * k, 140 * k, 160 * k, 26 * k).fill({ color: 0x0a0d11, alpha: 0.92 });
    // Their rim of screen light along the top of the head and shoulders.
    shapes.arc(sx, top + 4 * k, 40 * k, Math.PI * 1.1, Math.PI * 1.9).stroke({ width: 4 * k, color: rim, alpha: 0.9 });
    shapes
      .moveTo(sx - 140 * k, top + 44 * k)
      .quadraticCurveTo(sx - 70 * k, top + 34 * k, sx - 36 * k, top + 34 * k)
      .moveTo(sx + 36 * k, top + 34 * k)
      .quadraticCurveTo(sx + 70 * k, top + 34 * k, sx + 140 * k, top + 44 * k)
      .stroke({ width: 4 * k, color: rim, alpha: 0.7 });
    // Right: the edge of a standing figure at the frame's edge, a clipboard or a coffee cup in hand by era.
    const rx = w * 0.84;
    shapes.roundRect(rx, h - 95 * k, 170 * k, 180 * k, 36 * k).fill({ color: dark, alpha: 0.94 });
    shapes.roundRect(rx - 34 * k, h - 64 * k, 54 * k, 16 * k, 4 * k).fill({ color: 0x14171c, alpha: 0.95 });
    shapes
      .moveTo(rx + 8 * k, h - 80 * k)
      .quadraticCurveTo(rx + 20 * k, h - 95 * k, rx + 150 * k, h - 95 * k)
      .stroke({ width: 4 * k, color: rim, alpha: 0.7 });
    blur.strength = 5 * k;
    // The haze: more wisps in a smoky year.
    for (const s of wisps) s.sp.destroy();
    wisps = [];
    const n = Math.round(4 + 14 * smoke);
    for (let i = 0; i < n; i++) wisps.push(newWisp(w, h, true));
  }

  function newWisp(w, h, anywhere) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.blendMode = 'add';
    const k = h / 1080;
    sp.position.set(Math.random() * w, anywhere ? h * (0.5 + Math.random() * 0.4) : h * (0.8 + Math.random() * 0.15));
    sp.scale.set((2.5 + Math.random() * 3) * k, (1.2 + Math.random() * 1.2) * k);
    sp.rotation = (Math.random() - 0.5) * 0.6;
    haze.addChild(sp);
    return {
      sp,
      vx: (Math.random() - 0.5) * 6 * k,
      vy: -(3 + Math.random() * 5) * k,
      age: anywhere ? Math.random() * 30 : 0,
      life: 30 + Math.random() * 30,
      peak: 0.07 + Math.random() * 0.06,
    };
  }

  // year: the room's year; glow: the big screen's colour (the haze takes it on).
  function update(dt, screen, { era, year, glow = 0xb8c8d0 }) {
    const w = screen.width,
      h = screen.height,
      smoke = smokeOf(year);
    const key = `${w}x${h}|${era}|${smoke}`;
    if (key !== builtFor) {
      builtFor = key;
      build(w, h, era, smoke);
    }
    // The near shapes slide against the room with the pointer: a little, slowly, and not at all when calm.
    const still = calm();
    const want = still ? 0 : -pointer.x * 10 * (h / 1080),
      wantY = still ? 0 : -pointer.y * 4 * (h / 1080);
    px += (want - px) * Math.min(1, dt * 3);
    py += (wantY - py) * Math.min(1, dt * 3);
    near.position.set(px, py);
    haze.position.set(px * 0.3, py * 0.3);
    // The haze drifts up and fades in and out over its life; the colour stays put.
    for (let i = 0; i < wisps.length; i++) {
      const s = wisps[i];
      s.age += dt;
      s.sp.x += s.vx * dt;
      s.sp.y += s.vy * dt;
      s.sp.tint = glow;
      const f = s.age / s.life;
      s.sp.alpha = s.peak * Math.sin(Math.PI * Math.min(1, Math.max(0, f)));
      if (f >= 1) {
        s.sp.destroy();
        wisps[i] = newWisp(w, h, false);
      }
    }
  }

  return { root, update };
}
