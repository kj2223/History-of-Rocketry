// CONSTRUCTION YOU CAN WATCH (next-level visual pass, November 2026). A building going up on the management map is
// drawn in the stages a real one goes through, so you can see the money at work:
// - the site cleared: the scrub scraped off, stakes at the corners, a bulldozer working back and forth;
// - the slab: the foundation poured, the reinforcing bars standing out of it;
// - the frame: the walls rising floor by floor inside scaffolding, a tower crane beside it slowly swinging its jib;
// - the cladding: the building in its own colours, the scaffolding coming down;
// and then nothing: the finished building is the base's own painting (paint.js).
// A pad goes up the same way: the slab, then its service tower climbing beside the crane.
// Pure apart from the painter it is given; nothing here holds state or changes the game. Motion is slow (a jib swings
// once in about 20 seconds, a dozer crosses the site in about 6) and nothing flashes.
import { isoPainter, shade, bayer } from './iso.js';
import { PREFABS } from './base.js';
import { ART } from './paint.js';

// How tall each kind stands when it is finished, in art pixels (as paint.js draws it).
export const HEIGHT = { pad: 22, blockhouse: 6, hangar: 13, control: 10, office: 8, tracking: 5 };
const FINAL = {
  pad: 0xb6402e,
  blockhouse: 0xa7a395,
  hangar: 0xc8cbc9,
  control: 0xcfc9b8,
  office: 0xe2d8c1,
  tracking: 0xe2d8c1,
};
const DIRT = 0xa58a5c,
  DIRT_DARK = 0x8a7148,
  SLAB = 0xb9b6ad,
  RAW = 0x9c9a92, // raw concrete and block before the cladding
  STEEL = 0x8e959c,
  SCAFFOLD = 0x7a6a50,
  CRANE = 0xe0b030,
  DOZER = 0xe0a020;

// Which stage a building is at, from its progress (0..1).
export const STAGES = [
  { name: 'site', to: 0.12 },
  { name: 'slab', to: 0.25 },
  { name: 'frame', to: 0.85 },
  { name: 'cladding', to: 1 },
];
export function stageOf(progress) {
  if (!(progress < 1)) return { name: 'done', k: 1 };
  const p = Math.max(0, progress);
  let from = 0;
  for (const s of STAGES) {
    if (p < s.to) return { name: s.name, k: (p - from) / (s.to - from) };
    from = s.to;
  }
  return { name: 'done', k: 1 };
}

// How high the walls (or the pad's tower) stand at a progress, in art pixels: nothing until the frame, then rising
// floor by floor (in steps of 3 pixels, never smoothly), the full height once the cladding starts.
export function wallsAt(kind, progress) {
  const H = HEIGHT[kind] ?? 8,
    s = stageOf(progress);
  if (s.name === 'site' || s.name === 'slab') return 0;
  if (s.name === 'frame') return Math.min(H, Math.max(2, Math.ceil((s.k * H) / 3) * 3));
  return H;
}

// Paints one building's works through an iso painter P. b: { kind, tx, ty }; t: seconds, for the dozer and the jib.
export function paintWorks(P, b, progress, t = 0) {
  const s = stageOf(progress);
  if (s.name === 'done') return;
  const { w, d } = PREFABS[b.kind] ?? { w: 2, d: 2 },
    H = HEIGHT[b.kind] ?? 8,
    pad = b.kind === 'pad';
  // The ground scraped bare, a margin round the footprint.
  P.flat(b.tx - 0.3, b.ty - 0.3, w + 0.6, d + 0.6, DIRT, 0, (x, y) => (bayer(x, y) < 0.18 ? DIRT_DARK : null));
  // Stakes at the corners, until the slab covers them.
  if (s.name === 'site')
    for (const [cx, cy] of [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ]) {
      const q = P.at(b.tx + cx, b.ty + cy);
      P.rect(q.x, q.y - 3, 1, 3, 0xe8e2d0);
      P.px(q.x, q.y - 3, 0xd04030);
    }
  // The slab, poured across the footprint as it goes, with its bars standing out until the walls take them.
  if (s.name !== 'site') {
    const poured = s.name === 'slab' ? Math.max(0.15, s.k) : 1;
    P.flat(b.tx, b.ty, w * poured, d, SLAB, 1);
    if (s.name === 'slab' || (s.name === 'frame' && s.k < 0.2))
      for (let i = 0.5; i < w * poured; i += 0.5)
        for (let j = 0.5; j < d; j += 1) {
          const q = P.at(b.tx + i, b.ty + j, 1);
          P.px(q.x, q.y - 1, STEEL);
        }
  }
  // The walls (or the pad's tower) rising, raw, then clad in their own colour.
  const up = wallsAt(b.kind, progress);
  if (up > 0) {
    if (pad) {
      // The service tower's steel climbing in its deck heights; red once it is painted.
      const col = s.name === 'cladding' ? FINAL.pad : STEEL,
        legs = [P.at(b.tx + 0.6, b.ty + 1.9), P.at(b.tx + 1.4, b.ty + 1.9), P.at(b.tx + 1.4, b.ty + 3.1)];
      for (const l of legs) P.rect(l.x, l.y - up, 1, up, col);
      for (let z = 3; z <= up; z += 4)
        P.line({ x: legs[0].x, y: legs[0].y - z }, { x: legs[2].x, y: legs[2].y - z }, col);
    } else P.box(b.tx, b.ty, w, d, up, s.name === 'cladding' ? FINAL[b.kind] : RAW, { z: 1 });
  }
  // Scaffolding round the two faces you can see, a little above the walls; it comes down as the cladding goes on.
  const scaffoldTo = s.name === 'frame' ? up + 3 : s.name === 'cladding' ? Math.round((1 - s.k) * (H + 3)) : 0;
  if (!pad && scaffoldTo > 1) {
    const front = [
      P.at(b.tx - 0.25, b.ty + d + 0.25),
      P.at(b.tx + w + 0.25, b.ty + d + 0.25),
      P.at(b.tx + w + 0.25, b.ty - 0.25),
    ];
    for (let i = 0; i < 2; i++) {
      const a = front[i],
        c = front[i + 1],
        n = Math.max(2, Math.round(Math.hypot(c.x - a.x, c.y - a.y) / 6));
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((c.x - a.x) * k) / n,
          y = a.y + ((c.y - a.y) * k) / n;
        P.rect(x, y - scaffoldTo, 1, scaffoldTo, SCAFFOLD);
      }
      for (let z = 3; z <= scaffoldTo; z += 3) P.line({ x: a.x, y: a.y - z }, { x: c.x, y: c.y - z }, SCAFFOLD);
    }
  }
  // The tower crane through the frame (and a pad's whole build), its jib swinging slowly over the works.
  if (s.name === 'frame' || (pad && s.name !== 'site')) {
    const foot = P.at(b.tx + w + 0.6, b.ty - 0.6),
      mast = H + 14;
    P.rect(foot.x - 1, foot.y - 2, 3, 2, shade(CRANE, 0.6));
    P.rect(foot.x, foot.y - mast, 1, mast, CRANE);
    for (let z = 2; z < mast; z += 3) P.px(foot.x + 1, foot.y - z, shade(CRANE, 0.7));
    const a = Math.sin((t * 2 * Math.PI) / 20 + b.tx) * 1.2,
      jib = 16;
    const tip = { x: foot.x - Math.cos(a) * jib, y: foot.y - mast + Math.sin(a) * jib * 0.5 },
      tail = { x: foot.x + Math.cos(a) * 5, y: foot.y - mast - Math.sin(a) * 2.5 };
    P.line({ x: foot.x, y: foot.y - mast }, tip, CRANE);
    P.line({ x: foot.x, y: foot.y - mast }, tail, CRANE);
    P.rect(tail.x - 1, tail.y, 2, 2, 0x5a5a5a); // counterweight
    const drop = 8 + Math.round(4 * Math.sin(t * 0.7 + b.ty));
    P.line(tip, { x: tip.x, y: tip.y + drop }, 0x3a3a3a); // the hook's cable
    P.rect(tip.x - 1, tip.y + drop, 2, 1, 0x3a3a3a);
  }
  // The bulldozer working the cleared site back and forth.
  if (s.name === 'site') {
    const u = (t / 6) % 2,
      along = u < 1 ? u : 2 - u,
      q = P.at(b.tx + 0.3 + along * (w - 0.6), b.ty + d * 0.5);
    P.rect(q.x - 2, q.y - 3, 5, 2, DOZER);
    P.rect(q.x - 1, q.y - 5, 2, 2, shade(DOZER, 0.8));
    P.rect(q.x - 2, q.y - 1, 5, 1, 0x2b2b2b);
    P.rect(q.x + (u < 1 ? 3 : -3), q.y - 3, 1, 3, 0x6a6a6a); // the blade
  }
}

// For the map's draw(): works [{ kind, tx, ty, progress }], drawn on ctx, which carries the art transform. t: seconds.
export function drawWorks(ctx, works, t = 0) {
  if (!works?.length) return;
  const P = isoPainter(ctx, ART.ox, ART.oy);
  const order = [...works].sort((a, b) => a.tx + a.ty - (b.tx + b.ty));
  for (const b of order) paintWorks(P, b, b.progress, t);
}
