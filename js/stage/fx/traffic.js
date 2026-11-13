// THE ROAD AND THE PAD (v0.8, the living site):
//  - traffic on the road out to the range: a car or truck every half-minute or so, in the fleet of the place and the
//    years (army jeeps, deuce-and-a-half trucks and black staff cars at White Sands; the Cape's sedans and pickups,
//    then vans and four-by-fours, white by the 2020s), headlights and tail lamps after dark. The range closes the road
//    for a count, a firing and a flight, so nothing new comes along then;
//  - the umbilicals on the pad: the propellant and power lines from the tower into a fuelled rocket's side, sagging
//    between them, that pull out as she lifts and fall away to swing against the tower until they hang still.
// Steady lights only; nothing blinks.
import { Graphics } from '../../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../../data/white-sands.js';
import { padHeight } from './life.js';
import { tailOf } from './launch.js';

// The fleet, by place and years: [kind, body colour].
const FLEETS = [
  [
    'sands',
    0,
    [
      ['jeep', 0x5b5f3a],
      ['truck', 0x55593a],
      ['sedan', 0x262626],
      ['jeep', 0x63664a],
    ],
  ],
  [
    'cape',
    0,
    [
      ['sedan', 0x7fa7a0],
      ['sedan', 0xc8b98e],
      ['pickup', 0x6d7f5a],
      ['sedan', 0x9b3b32],
      ['truck', 0x4f5a62],
    ],
  ],
  [
    'cape',
    1970,
    [
      ['sedan', 0x8a5a2b],
      ['van', 0xd8d2c0],
      ['pickup', 0x2f5a3a],
      ['sedan', 0x5d6f8a],
    ],
  ],
  [
    'cape',
    1990,
    [
      ['sedan', 0x7a1f2a],
      ['suv', 0x2f4a6a],
      ['van', 0xe6e6e2],
      ['pickup', 0xb8b8b2],
    ],
  ],
  [
    'cape',
    2015,
    [
      ['suv', 0xe8e8e8],
      ['pickup', 0x30343a],
      ['van', 0xf2f2f2],
      ['suv', 0x8a8f96],
    ],
  ],
];
export function fleetFor(site, year) {
  const place = site === 'cape' ? 'cape' : 'sands';
  return FLEETS.filter(([p, y]) => p === place && year >= y).at(-1)[2];
}
// The range has the road closed: a count, a static firing, a flight, or a rocket climbing away.
export const roadClosed = g => !!(g.count || g.flight || g.standFlame > 0 || g.rocket?.where === 'flying');

const SIZE = { jeep: 26, sedan: 36, pickup: 36, suv: 36, van: 38, truck: 48 };
const S = 2.2; // the shapes are drawn in small units, then scaled up to stand beside the people

// One vehicle, side on, its front toward dir, wheels on the road at y.
function vehicle(gr, kind, color, x, y, dir, night, spin) {
  const L = SIZE[kind] * S,
    back = x - (dir * L) / 2,
    at = k => back + dir * L * k; // k: 0 at the back, 1 at the front
  const span = (k0, k1) => [Math.min(at(k0), at(k1)), Math.abs(at(k1) - at(k0))];
  const box = (k0, k1, top, bottom, fill) => {
    const [x0, w] = span(k0, k1);
    gr.rect(x0, y - top * S, w, (top - bottom) * S).fill(fill);
  };
  const glass = { color: 0x9fb6c4, alpha: 0.85 - 0.5 * night };
  if (kind === 'jeep') {
    box(0, 1, 9, 3, color);
    box(0.55, 0.62, 15, 9, 0x3a3c2a); // the windscreen frame
    box(0.0, 0.08, 12, 5, 0x2a2a22); // the spare on the back
  } else if (kind === 'truck') {
    box(0.66, 1, 17, 3, color); // the cab
    box(0.74, 0.92, 15, 10, glass);
    box(0, 0.63, 22, 5, 0x8a8460); // the canvas back (white sands) or the box
    box(0, 0.63, 6, 3, color);
  } else if (kind === 'van') {
    box(0, 1, 17, 3, color);
    box(0.78, 0.96, 15, 9, glass);
    box(0.15, 0.7, 15, 10, glass);
  } else {
    // sedan, suv, pickup: a body, and a cabin on it.
    const tall = kind === 'suv' ? 14 : 13;
    box(0, 1, 8, 3, color);
    if (kind === 'pickup') box(0.45, 0.78, tall, 8, color);
    else box(0.22, kind === 'suv' ? 0.8 : 0.72, tall, 8, color);
    if (kind === 'pickup') box(0.5, 0.74, tall - 1, 9, glass);
    else {
      box(0.27, 0.46, tall - 1, 9, glass);
      box(0.5, kind === 'suv' ? 0.76 : 0.68, tall - 1, 9, glass);
    }
  }
  // Wheels, with a spoke that turns as she rolls.
  for (const k of [0.2, 0.8]) {
    const wx = at(k);
    gr.circle(wx, y - 3 * S, 3.4 * S).fill(0x1c1c1c);
    gr.circle(wx, y - 3 * S, 1.6 * S).fill(0x5a5a5a);
    gr.moveTo(wx, y - 3 * S)
      .lineTo(wx + Math.cos(spin) * 2.4 * S, y - 3 * S + Math.sin(spin) * 2.4 * S)
      .stroke({ width: 1.2, color: 0x2a2a2a });
  }
  // After dark: headlights ahead of her and the tail lamps, steady.
  if (night > 0.2) {
    gr.circle(at(1), y - 6 * S, 1.6 * S).fill({ color: 0xfff1c0, alpha: night });
    gr.poly([at(1), y - 7 * S, at(1) + dir * 90, y - 9 * S, at(1) + dir * 90, y, at(1), y - 5 * S]).fill({
      color: 0xfff1c0,
      alpha: 0.12 * night,
    });
    gr.circle(at(0), y - 6 * S, 1.2 * S).fill({ color: 0xd84030, alpha: night });
  }
}

export function siteTraffic() {
  const road = new Graphics();
  const pad = new Graphics();
  const cars = [];
  let wait = 8 + Math.random() * 15,
    lines = null; // the umbilicals' state once she lifts: when, and their swing

  function update(g, dt, { vw, camX, night, year }) {
    // ---- the road ----
    road.clear();
    if (!g.paused) {
      wait -= dt;
      if (wait <= 0 && !roadClosed(g) && cars.length < 2) {
        const dir = Math.random() < 0.5 ? 1 : -1,
          fleet = fleetFor(g.site, year),
          [kind, color] = fleet[Math.floor(Math.random() * fleet.length)];
        cars.push({
          kind,
          color,
          dir,
          x: dir > 0 ? camX - 120 : camX + vw + 120,
          speed: (kind === 'truck' ? 60 : 80) + Math.random() * 30,
          spin: 0,
        });
        wait = 22 + Math.random() * 40;
      }
      for (const c of cars) {
        c.x += c.dir * c.speed * dt;
        c.spin += (c.speed * dt) / (3.4 * S);
      }
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.dir > 0 ? c.x > camX + vw + 200 : c.x < camX - 200) cars.splice(i, 1);
      else vehicle(road, c.kind, c.color, c.x, GROUND + (c.dir > 0 ? 38 : 35), c.dir, night, c.spin);
    }

    // ---- the umbilicals ----
    pad.clear();
    const h = padHeight(g.vehicle);
    if (!h || g.crewed) {
      lines = null;
      return;
    }
    const t = PLACES.tower,
      rx = t.x + 25,
      half = tailOf(g.vehicle);
    if (g.rocket?.where === 'flying' && !lines) lines = { since: 0 };
    if (g.rocket?.where !== 'flying') lines = null;
    if (g.rocket?.where !== 'tower' && !lines) return;
    if (lines && !g.paused) lines.since += dt;
    for (const [k, sag] of [
      [0.3, 26],
      [0.62, 18],
    ]) {
      const y = GROUND - 8 - h * k,
        lean = 14 * (1 - (h * k) / t.h), // the tower's legs lean in as it rises
        ax = t.x + t.w - lean, // the line's end on the tower's right leg
        mount = y - 6;
      if (!lines) {
        // Plugged in: from the tower out and down in a loop, and back up into her side.
        pad
          .moveTo(ax, mount)
          .bezierCurveTo(ax + sag * 1.6, mount + sag, rx + half + sag, y + sag * 0.6, rx + half, y)
          .stroke({ width: 2, color: 0x2a2a2a });
        pad.rect(rx + half - 1, y - 2, 3, 4).fill(0x6a6a6a);
      } else {
        // Pulled out: the plug end falls and swings back against the tower, the swing dying away.
        const s = lines.since,
          len = sag * 1.8,
          swing = Math.exp(-s * 0.8) * Math.cos(s * 3.2) * 0.9,
          drop = Math.min(1, s * 2.5),
          ang = Math.PI / 2 - (1 - drop) * 1.0 + swing * drop,
          ex = ax + Math.cos(ang) * len,
          ey = mount + Math.sin(ang) * len;
        pad
          .moveTo(ax, mount)
          .quadraticCurveTo(ax + Math.cos(ang) * len * 0.5 + 6, mount + Math.sin(ang) * len * 0.5, ex, ey)
          .stroke({ width: 2, color: 0x2a2a2a });
        pad.rect(ex - 1.5, ey - 1, 3, 4).fill(0x6a6a6a);
      }
    }
  }
  return { road, pad, update };
}
