// A LIVING CAPE (next-level visual pass, November 2026). The management map is no longer a still picture:
// - the day turns: dawn, a working day, dusk and night, the map going blue and dark at night with the windows lit,
//   the pads under floodlights and the trucks' headlights on the roads;
// - people walk the roads between the buildings and trucks, pickups and the crew bus drive the range road, fewer of
//   them at night;
// - a launch leaves its exhaust trail standing over the pad, spreading and drifting out to sea on the wind.
// The day only turns at normal speed: at 4x and 16x a day would pass in a second or less, so the map holds daylight
// (and fades into it) rather than flicker between day and night. Every change of light is a slow ramp over a second or
// more, over the whole map, so nothing flashes. Calm effects (pa-calm) holds the light at day and the smoke still.
// Presentation only: nothing here changes the game.
import { PREFABS } from './base.js';
import { TW, TH, bayer } from './iso.js';
import { ART } from './paint.js';

// How dark the night is at an hour of the day (0..1). Full night from 9 pm to 5 am, with dusk and dawn over 2 hours.
export function nightOf(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h <= 19) return 0;
  if (h > 19 && h < 21) return (h - 19) / 2;
  if (h > 5 && h < 7) return (7 - h) / 2;
  return 1;
}
// The hour on the map, from how far through the day it is (a launch at noon is part 0.5).
export const hourOf = part => part * 24;
// How dark the map is drawn at full night: the type and the panel stay readable, the map stays legible.
export const NIGHT_DEPTH = 0.62;
// How fast the drawn light follows the clock (per second). A whole-map change takes about a second.
export const LIGHT_RATE = 1.6;

// The light drawn for a frame, eased towards what the clock asks for. At any speed but 1x, daylight.
export function easeNight(current, { part, speed, dt, still = false }) {
  const want = still || speed !== 1 ? 0 : nightOf(hourOf(part));
  return current + (want - current) * Math.min(1, dt * LIGHT_RATE);
}

const at = (tx, ty, z = 0) => ({ x: ART.ox + (tx - ty) * (TW / 2), y: ART.oy + (tx + ty) * (TH / 2) - z });
const hashOf = (i, n) => {
  const s = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Where each person and vehicle is at time t, along the roads (runs of tiles: [tx, ty, length, 'x' | 'y']).
// Pure, for the tests. Returns [{ x, y, dir, kind, colour, i }] in art pixels, at ground level.
export const WALKERS = 16,
  VEHICLES = 4;
const SHIRTS = [0xf1efe8, 0xd8c9a0, 0x9fb4c8, 0xf1efe8, 0x6d7a5a, 0xe8e2d0];
const CARS = [
  { kind: 'pickup', colour: 0xf1efe8 },
  { kind: 'truck', colour: 0x6b6f4a },
  { kind: 'bus', colour: 0x3e5f8a },
  { kind: 'pickup', colour: 0xb6402e },
];
export function movers(roads, t, night = 0) {
  const out = [];
  if (!roads.length) return out;
  const along = (run, u, side) => {
    const [tx, ty, n, axis] = run,
      k = Math.max(0, Math.min(n - 0.01, u));
    return axis === 'x' ? at(tx + k, ty + 0.5 + side) : at(tx + 0.5 + side, ty + k);
  };
  // Walking pace about half a tile a second; each keeps to a stretch of road, there and back.
  const awake = Math.round(WALKERS * (1 - 0.7 * night));
  for (let i = 0; i < awake; i++) {
    const run = roads[(i * 5 + 1) % roads.length],
      n = run[2],
      span = Math.min(n, 3 + hashOf(i, 1) * 6),
      start = hashOf(i, 2) * (n - span),
      pace = 0.35 + hashOf(i, 3) * 0.3,
      u = (t * pace + hashOf(i, 4) * 2 * span) % (2 * span),
      back = u > span;
    const p = along(run, start + (back ? 2 * span - u : u), hashOf(i, 5) < 0.5 ? -0.3 : 0.3);
    out.push({ ...p, dir: back ? -1 : 1, axis: run[3], kind: 'person', colour: SHIRTS[i % SHIRTS.length], i });
  }
  // Vehicles: about two tiles a second, the length of their road and back. The first two keep to the range road.
  for (let i = 0; i < VEHICLES; i++) {
    const run = i < 2 ? roads[0] : roads[(i * 3) % roads.length],
      n = run[2],
      u = (t * (1.6 + hashOf(i, 7)) + hashOf(i, 8) * 2 * n) % (2 * n),
      back = u > n;
    const p = along(run, back ? 2 * n - u : u, back ? -0.22 : 0.22);
    out.push({ ...p, dir: back ? -1 : 1, axis: run[3], kind: CARS[i].kind, colour: CARS[i].colour, i });
  }
  return out;
}

// The windows that light at night, as art pixels [x, y, w, h]: the same rows paint.js draws dark by day.
export function windowPixels(base) {
  const px = [];
  const rows = (b, w, d, z, every) => {
    for (let i = 1; i < w * 2; i += every) {
      const p = at(b.tx + i / 2, b.ty + d, z);
      px.push([p.x, p.y, 2, 1]);
    }
    for (let j = 1; j < d * 2; j += every) {
      const p = at(b.tx + w, b.ty + j / 2, z);
      px.push([p.x, p.y, 2, 1]);
    }
  };
  for (const b of base) {
    if (b.kind === 'office') rows(b, 3, 2, 5, 2);
    else if (b.kind === 'control') rows(b, 3, 3, 6, 2);
    else if (b.kind === 'tracking') rows(b, 2, 2, 3, 3);
    else if (b.kind === 'hangar') {
      // The light from the open bay door.
      for (let z = 2; z < 9; z += 2) {
        const p = at(b.tx + 4, b.ty + 1, z);
        px.push([p.x, p.y, 1, 1]);
        const q = at(b.tx + 4, b.ty + 2, z);
        px.push([q.x, q.y, 1, 1]);
      }
    } else if (b.kind === 'blockhouse') {
      const p = at(b.tx + 2, b.ty + 1, 4);
      px.push([p.x, p.y, 2, 1]);
    }
  }
  return px;
}

const hex = c => `#${c.toString(16).padStart(6, '0')}`;

export function baseLife(base, roads) {
  let t = 0,
    night = null,
    puffs = [],
    emit = 0;
  const lit = windowPixels(base);
  const pads = base.filter(b => b.kind === 'pad');

  // Once a frame. stands: what is on the pads (view.js standsOn), with rise > 0 for a rocket in flight.
  function update(dt, { part, speed, paused, stands = [], still = false }) {
    if (!paused) t += dt;
    // The first frame starts at the clock's own light; after that it eases.
    night =
      night === null
        ? easeNight(0, { part, speed, dt: 1 / LIGHT_RATE, still })
        : easeNight(night, { part, speed, dt, still });
    // Exhaust: puffs laid along her climb, which then stand, spread and drift out to sea, thinning as they go.
    if (!still && !paused)
      for (const s of stands)
        if (s.rise > 0 && s.rise < 240) {
          emit += dt;
          while (emit > 0.04) {
            emit -= 0.04;
            const p = at(s.pad.tx + 2.5, s.pad.ty + 2.5, 2 + s.rise);
            puffs.push({
              x: p.x + (Math.random() - 0.5) * 2,
              y: p.y + 4,
              r: 1.5,
              age: 0,
              life: 14 + Math.random() * 8,
            });
          }
        }
    for (const p of puffs) {
      p.age += paused ? 0 : dt;
      p.r = 1.5 + Math.min(11, p.age * 1.1);
      p.x += (paused ? 0 : dt) * 1.2; // the wind off the land, out to sea
      p.y -= (paused ? 0 : dt) * 0.15;
    }
    puffs = puffs.filter(p => p.age < p.life).slice(-420);
  }

  // Drawn in art pixels, between the base and the light (ctx carries the art transform).
  function art(ctx) {
    // The smoke, dithered so it stays pixel art: thinner as it ages.
    ctx.fillStyle = '#ece6d8';
    for (const p of puffs) {
      const keep = 0.6 * (1 - p.age / p.life) ** 1.5,
        r = Math.round(p.r),
        cx = Math.round(p.x),
        cy = Math.round(p.y);
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y * 1.6 <= r * r && bayer(cx + x, cy + y) < keep) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
    // People and vehicles.
    for (const m of movers(roads, t, night)) {
      const x = Math.round(m.x),
        y = Math.round(m.y);
      if (m.kind === 'person') {
        const step = Math.floor(t * 4 + m.i) % 2;
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(x - step, y - 1, 1, 1);
        ctx.fillRect(x + 1 - step, y - 1, 1, 1);
        ctx.fillStyle = hex(m.colour);
        ctx.fillRect(x, y - 3, 1, 2);
        ctx.fillStyle = m.i % 3 ? '#d8a882' : '#8a5a3a';
        ctx.fillRect(x, y - 4, 1, 1);
      } else {
        // An isometric little box: long along its road.
        const len = m.kind === 'bus' ? 6 : m.kind === 'truck' ? 5 : 4,
          along = m.axis === 'x' ? 1 : -1;
        ctx.fillStyle = '#1e1e1c';
        for (let k = 0; k < len; k++)
          ctx.fillRect(x + k * along - (len >> 1) * along, y - 1 + (k >> 1) - (len >> 2), 1, 1);
        ctx.fillStyle = hex(m.colour);
        for (let k = 0; k < len; k++)
          ctx.fillRect(
            x + k * along - (len >> 1) * along,
            y - 3 + (k >> 1) - (len >> 2),
            1,
            m.kind === 'pickup' && k < 2 ? 1 : 2,
          );
      }
    }
  }

  // Drawn in screen pixels after the base. artT(): the art transform for ctx.setTransform.
  function light(ctx, w, h, artT) {
    const n = (night ?? 0) * NIGHT_DEPTH;
    if (n < 0.005) return;
    // The night itself: a deep blue multiplied over the map.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    const k = c => Math.round(255 + (c - 255) * n);
    ctx.fillStyle = `rgb(${k(40)},${k(56)},${k(96)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    // The windows, at full art pixels, lit warm.
    ctx.setTransform(...artT());
    ctx.globalAlpha = Math.min(1, night * 1.2);
    ctx.fillStyle = '#ffd27a';
    for (const [x, y, ww, hh] of lit) ctx.fillRect(x, y, ww, hh);
    ctx.globalAlpha = 1;
    // Soft light: floodlights on the pads, the windows' glow, headlights. Screen-blended and faint.
    const [s, , , , ox, oy] = artT(),
      toS = p => ({ x: p.x * s + ox, y: p.y * s + oy });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    const glow = (p, r, rgb, a) => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
    };
    for (const pad of pads) glow(toS(at(pad.tx + 2.5, pad.ty + 2.5, 14)), s * 30, '200,220,255', 0.32 * night);
    for (const b of base)
      if (b.kind === 'office' || b.kind === 'control' || b.kind === 'hangar')
        glow(toS(at(b.tx + PREFABS[b.kind].w, b.ty + PREFABS[b.kind].d / 2, 4)), s * 16, '255,200,120', 0.18 * night);
    for (const m of movers(roads, t, night))
      if (m.kind !== 'person') {
        const ahead =
          m.axis === 'x' ? { x: m.x + 6 * m.dir, y: m.y + 3 * m.dir } : { x: m.x - 6 * m.dir, y: m.y + 3 * m.dir };
        glow(toS({ x: (m.x + ahead.x) / 2, y: (m.y + ahead.y) / 2 - 2 }), s * 6, '255,236,180', 0.5 * night);
      }
    ctx.globalCompositeOperation = 'source-over';
  }

  return { update, art, light, night: () => night ?? 0, smoke: () => puffs.length };
}
