// MANAGEMENT MODE: painting the Cape in isometric pixel art, 1958 look. The ground and buildings are painted once into
// a still picture; rockets on their pads go on a second picture repainted when the day changes.
import { isoPainter, TW, TH, shade, bayer } from './iso.js';
import { SIZE, coast, PREFABS } from './base.js';

// 1958–75 is Kodachrome at the Cape (DESIGN.md §1): warm sand, olive scrub, a deep blue Atlantic.
const C = {
  sand: 0xd3bf8f,
  sandDark: 0xbca775,
  scrub: 0x7d8549,
  scrubDark: 0x5f6a36,
  beach: 0xe9dcb3,
  surf: 0xf4f1e6,
  sea: 0x2c6f93,
  seaDeep: 0x1f5577,
  road: 0x6d6a63,
  roadEdge: 0x8b877c,
  concrete: 0xb9b6ad,
  concreteDark: 0x9a978e,
  tower: 0xb6402e,
  steel: 0x8e959c,
  hangar: 0xc8cbc9,
  roof: 0x9fa6a8,
  blockhouse: 0xa7a395,
  berm: 0xc2ad7b,
  office: 0xe2d8c1,
  control: 0xcfc9b8,
  window: 0x2f3b45,
  rocket: 0xf1efe8,
  band: 0x2b2b2b,
};
// The Banana River behind the Cape to the west, and ragged water at the map's north and south ends, so the land never
// ends in a straight edge.
const river = ty => 2 + Math.round(1.5 * Math.sin(ty / 5 + 1) + 1.2 * Math.sin(ty / 2.3));
const wet = (tx, ty) =>
  tx < river(ty) ||
  ty < 1 + Math.round(1.5 + 1.5 * Math.sin(tx / 3.1)) ||
  ty > SIZE - 3 + Math.round(Math.sin(tx / 2.7) * 1.5);

export const ART = { w: SIZE * TW + 32, h: SIZE * TH + 80, ox: (SIZE * TW) / 2 + 16, oy: 60 };

const noise = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function ground(P, roads) {
  const road = new Set();
  for (const [tx, ty, n, dir] of roads)
    for (let i = 0; i < n; i++) road.add(dir === 'x' ? `${tx + i},${ty}` : `${tx},${ty + i}`);
  for (let ty = 0; ty < SIZE; ty++)
    for (let tx = 0; tx < SIZE; tx++) {
      const edge = coast(ty);
      if (tx <= edge + 1 && wet(tx, ty)) {
        const shore = !wet(tx + 1, ty) || !wet(tx, ty + 1) || !wet(tx - 1, ty) || !wet(tx, ty - 1);
        // Shallows along the shore; open water beyond is the same deep blue as the sea past the map's edge.
        P.flat(tx, ty, 1, 1, shore ? 0x3b7790 : C.seaDeep, 0, (x, y) =>
          shore && bayer(x, y) < 0.1 && noise(x >> 2, y) > 0.6 ? 0x5d97a0 : null,
        );
      } else if (tx > edge + 1) {
        const deep = tx > edge + 5;
        P.flat(tx, ty, 1, 1, deep ? C.seaDeep : C.sea, 0, (x, y) =>
          !deep && bayer(x, y) < 0.12 && noise(x >> 2, y) > 0.6 ? shade(C.sea, 1.25) : null,
        );
      } else if (tx === edge + 1) P.flat(tx, ty, 1, 1, C.surf, 0, (x, y) => (noise(x, y) > 0.55 ? C.sea : null));
      else if (tx >= edge - 1) P.flat(tx, ty, 1, 1, C.beach);
      else if (road.has(`${tx},${ty}`))
        P.flat(tx, ty, 1, 1, C.road, 0, (x, y) => (noise(x, y) > 0.93 ? C.roadEdge : null));
      else
        P.flat(tx, ty, 1, 1, C.sand, 0, (x, y) => {
          const n = noise(x >> 1, y >> 1),
            m = noise((x >> 3) + 5, y >> 2);
          if (m > 0.68 && n > 0.3) return n > 0.8 ? C.scrubDark : C.scrub;
          return n > 0.92 ? C.sandDark : null;
        });
    }
}

// Windows along a box's two faces, as dark pixels.
function windows(P, b, w, d, z, every = 3) {
  for (let i = 1; i < w * 2; i += every) {
    const p = P.at(b.tx + i / 2, b.ty + d, z);
    P.rect(p.x, p.y, 2, 1, C.window);
  }
  for (let j = 1; j < d * 2; j += every) {
    const p = P.at(b.tx + w, b.ty + j / 2, z);
    P.rect(p.x, p.y, 2, 1, C.window);
  }
}

// An open steel service tower: four legs, a deck every few pixels and cross bracing, so the sand shows through.
function tower(P, tx, ty, w, d, h) {
  const legs = [P.at(tx, ty), P.at(tx + w, ty), P.at(tx + w, ty + d), P.at(tx, ty + d)],
    dark = shade(C.tower, 0.65);
  for (const [i, l] of legs.entries()) P.rect(l.x, l.y - h, 1, h, i === 1 ? dark : C.tower);
  for (let z = 3; z <= h; z += 4) {
    const up = legs.map(l => ({ x: l.x, y: l.y - z }));
    P.line(up[3], up[2], C.tower);
    P.line(up[2], up[1], dark);
    if (z + 4 <= h) {
      P.line(up[3], { x: up[2].x, y: up[2].y - 4 }, dark);
      P.line(up[2], { x: up[1].x, y: up[1].y - 4 }, dark);
    }
  }
  const top = legs.map(l => ({ x: l.x, y: l.y - h }));
  P.poly(top, shade(C.tower, 1.1));
}

const PAINT = {
  pad(P, b) {
    P.flat(b.tx, b.ty, 5, 5, C.concrete, 0, (x, y) => (noise(x, y) > 0.9 ? C.concreteDark : null));
    // Flame trench and deflector under the stand, then the umbilical mast; the service tower stands back on its rail.
    P.box(b.tx + 2, b.ty + 2, 1, 1, 2, C.concreteDark);
    const tall = { atlas: 34, vanguard: 26, thor: 24, redstone: 22 }[b.padKind] ?? 22;
    tower(P, b.tx + 0.6, b.ty + 1.9, 0.8, 1.2, tall);
    P.box(b.tx + 3.4, b.ty + 2.2, 0.3, 0.3, 10, C.steel);
  },
  blockhouse(P, b) {
    P.flat(b.tx - 0.4, b.ty - 0.4, 2.8, 2.8, C.berm);
    P.box(b.tx, b.ty, 2, 2, 6, C.blockhouse, { top: shade(C.blockhouse, 1.08) });
    const p = P.at(b.tx + 1, b.ty + 1, 8);
    P.rect(p.x, p.y - 2, 1, 3, C.steel); // periscope
  },
  hangar(P, b) {
    P.box(b.tx, b.ty, 4, 3, 13, C.hangar, {
      top: C.roof,
      pattern: (x, y) => (x % 2 === 0 ? shade(C.hangar, 0.82) : null),
    });
    const d = P.at(b.tx + 4, b.ty + 0.6, 1);
    P.poly(
      [d, P.at(b.tx + 4, b.ty + 2.4, 1), P.at(b.tx + 4, b.ty + 2.4, 10), P.at(b.tx + 4, b.ty + 0.6, 10)],
      0x59605f,
    );
  },
  control(P, b) {
    P.box(b.tx, b.ty, 3, 3, 10, C.control);
    windows(P, b, 3, 3, 6, 2);
    const t = P.at(b.tx + 1.5, b.ty + 1.5, 10);
    P.rect(t.x, t.y - 6, 1, 6, C.steel);
    P.rect(t.x - 2, t.y - 6, 5, 1, C.steel);
  },
  office(P, b) {
    P.box(b.tx, b.ty, 3, 2, 8, C.office);
    windows(P, b, 3, 2, 5, 2);
  },
  tracking(P, b) {
    P.box(b.tx, b.ty, 2, 2, 5, C.office);
    const t = P.at(b.tx + 1, b.ty + 1, 5);
    P.rect(t.x, t.y - 5, 1, 5, C.steel);
    P.rect(t.x - 3, t.y - 8, 7, 3, C.surf);
    P.rect(t.x - 2, t.y - 9, 5, 1, C.surf);
  },
};

// The still picture: ground, roads, buildings back to front.
export function paintBase(ctx, base, roads) {
  const P = isoPainter(ctx, ART.ox, ART.oy);
  ctx.clearRect(0, 0, ART.w, ART.h);
  ground(P, roads);
  const order = [...base].sort((a, b) => {
    const pa = PREFABS[a.kind],
      pb = PREFABS[b.kind];
    return a.tx + pa.w + a.ty + pa.d - (b.tx + pb.w + b.ty + pb.d);
  });
  for (const b of order) PAINT[b.kind]?.(P, b);
}

// Rockets standing on their pads today. stands: [{ pad building, vehicle }].
// Art pixels tall, a little over true scale beside the towers so a rocket on its pad reads at a glance.
const HEIGHT = { 'thor-able': 28, juno: 24, vanguard: 26, atlas: 34, 'atlas-able': 37, redstone: 22 };
export function paintRockets(ctx, stands) {
  const P = isoPainter(ctx, ART.ox, ART.oy);
  ctx.clearRect(0, 0, ART.w, ART.h);
  for (const { pad, vehicle, rise = 0 } of stands) {
    const p = P.at(pad.tx + 2.5, pad.ty + 2.5, 2 + Math.round(rise)),
      h = HEIGHT[vehicle] ?? 16,
      w = vehicle.startsWith('atlas') ? 4 : 3;
    P.rect(p.x - 1, p.y - h, w, h, C.rocket);
    P.rect(p.x - 1 + w - 1, p.y - h, 1, h, shade(C.rocket, 0.8)); // shaded side
    P.rect(p.x - 1, p.y - Math.round(h * 0.55), w, 1, C.band);
    P.px(p.x - 1 + (w >> 1), p.y - h - 1, C.rocket); // nose
    if (rise > 0) {
      // The flame, and the cloud spreading over the pad.
      for (let k = 0; k < 6; k++) P.rect(p.x - 1 + (k % 2), p.y + k, w - (k % 2), 1, k < 2 ? 0xfff2b0 : 0xf2a33a);
      const base = P.at(pad.tx + 2.5, pad.ty + 2.5, 0),
        r = Math.min(10, 3 + rise / 6);
      for (let j = -2; j <= 1; j++)
        P.rect(base.x - r + Math.abs(j), base.y + j - 1, 2 * (r - Math.abs(j)), 1, 0xe9e4d8);
    }
  }
}

// Which tile is under an art pixel (for clicks).
export function tileAt(x, y) {
  const u = (x - ART.ox) / (TW / 2),
    v = (y - ART.oy) / (TH / 2);
  return { tx: Math.floor((u + v) / 2), ty: Math.floor((v - u) / 2) };
}
