// THE DUGOUT AND THE STAND IN THREE-QUARTERS (2D-HD rework, Aaron 20 November 2026): the static test seen from above,
// as a lit diorama in pixels. The dugout is cut open under its earth mound, with the crew at the panel and the
// periscope through the roof; the cable trench runs out across the desert to the stand, where the stage hangs in its
// tower over the flame pit. The sun throws the tower's shadow across the sand and swings it through the day
// (fx/daylight.js); when she fires, the flame runs down into the pit and out along the deflector, the smoke rolls away
// east and the whole site is lit orange. The near edge is out of focus. The readings are on the panel, which the scene
// zooms into (dugout.js, fx/zoom-view.js). 320 x 180 art pixels, PX units each. Presentation only.
import { BlurFilter, Container, Rectangle } from '../vendor/pixi.min.mjs';
import { PX, pixelLayer, shade, mix, pixelBack } from './pixel.js';
import { hdLayer } from './fx/hd.js';
import { speech } from './kit.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const HORIZON = 30;
// The dugout: the outside of its concrete shell, and the room inside (art pixels).
export const DUGOUT = { x: 50, y: 104, w: 94, h: 48 };
const ROOM = { x: DUGOUT.x + 4, y: DUGOUT.y + 4, w: DUGOUT.w - 8, h: DUGOUT.h - 8 };
const PANEL = { x: ROOM.x + 2, y: ROOM.y + 1, w: ROOM.w - 4, h: 9 };
const SEATS = [ROOM.x + 18, ROOM.x + ROOM.w / 2, ROOM.x + ROOM.w - 18];
const SHOULDERS = ROOM.y + 22;
// The stand: its pad, the middle of the tower, the nozzle, the pit and the deflector.
const ST = { x: 238, base: 108, top: 46 };
const NOZZLE = { x: ST.x, y: ST.base - 6 };
const SHADOW = 0x0a0c14;

export function dugoutRoom({ cape, sky, pass = true }) {
  const root = new Container();
  root.label = 'dugout-room';
  const M = { mx: 80, my: 40 };
  const far = pixelLayer(320, 180, M),
    ground = pixelLayer(320, 180, M),
    shadows = pixelLayer(320, 180, M),
    live = pixelLayer(320, 180, M),
    near = pixelLayer(320, 180, M);
  root.addChild(far.sprite, ground.sprite, shadows.sprite, live.sprite, near.sprite);
  const hd = hdLayer(320, 180, M);
  root.addChild(hd.root);
  // On the pixel pass (pixelate.js) the light and the blurred near edge are drawn over the pixels at full resolution,
  // so they stay smooth; the pass itself softens the far wall and the shadows enough.
  if (pass) hd.root.crisp = near.sprite.crisp = true;
  const farBlur = new BlurFilter({ strength: 3, quality: 2 }),
    nearBlur = new BlurFilter({ strength: 8, quality: 3 }),
    shadowBlur = new BlurFilter({ strength: 3, quality: 2 });
  const L0 = -M.mx,
    LW = 320 + 2 * M.mx;

  // ---- the sky band and the far distance ----
  const F = far;
  F.vgrad(L0, -M.my, LW, HORIZON + M.my, sky);
  if (cape) {
    F.rect(L0, HORIZON - 6, LW, 6, 0x3f6f8f);
    F.rect(L0, HORIZON - 6, LW, 1, 0x6a93ad);
    for (let y = HORIZON - 5; y < HORIZON; y += 2)
      for (let x = L0; x < L0 + LW; x++) if (hash(x >> 2, y) > 0.6) F.px(x, y, 0x52809e);
  } else
    for (const [base, amp, col, seed] of [
      [HORIZON - 2, 12, 0x9b8fa3, 3],
      [HORIZON, 7, 0xb5a28c, 9],
    ])
      for (let x = L0; x < L0 + LW; x++) {
        const h =
          amp *
          (0.55 + 0.3 * Math.sin(x * 0.045 + seed) + 0.15 * Math.sin(x * 0.13 + seed * 2) + 0.1 * hash(x >> 3, seed));
        const top = Math.round(base - h);
        const falling = Math.sin(x * 0.045 + seed) < Math.sin((x + 1) * 0.045 + seed);
        for (let y = top; y < HORIZON; y++) F.px(x, y, falling && y - top < 4 ? mix(col, 0x281e32, 0.2) : col);
        F.px(x, top, mix(col, 0xfff5e1, 0.25));
      }
  F.commit();

  // ---- the desert (or the Cape's scrub), seen from above, lighter toward us ----
  const G = ground;
  const sand = cape ? 0x8c9a5c : 0xcdb489;
  for (let y = HORIZON; y < 180 + M.my; y++) {
    const k = (y - HORIZON) / 150;
    const base = mix(shade(sand, 0.86), shade(sand, 1.04), Math.min(1, k));
    G.rect(L0, y, LW, 1, base);
    for (let x = L0; x < L0 + LW; x++) {
      const n = hash(x >> 2, y >> 1) * 0.6 + hash(x, y) * 0.4;
      if (n > 0.78) G.px(x, y, shade(base, 1.06));
      else if (n < 0.16) G.px(x, y, shade(base, 0.93));
    }
  }
  // Scrub and stones, scattered, bigger toward us.
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(L0 + hash(i, 7) * LW),
      y = Math.floor(HORIZON + 2 + hash(i, 11) ** 0.8 * (180 + M.my - HORIZON));
    if (x > DUGOUT.x - 22 && x < DUGOUT.x + DUGOUT.w + 22 && y > DUGOUT.y - 14 && y < DUGOUT.y + DUGOUT.h + 14)
      continue;
    if (x > ST.x - 34 && x < ST.x + 70 && y > ST.base - 14 && y < ST.base + 14) continue;
    const r = 1 + Math.floor(((y - HORIZON) / 150) * 3 * hash(i, 3));
    if (hash(i, 5) < 0.65) {
      const leaf = cape ? 0x4f6a3a : 0x6f7a4a;
      // A tuft: a low clump, wider than tall, lit on top.
      G.rect(x - r, y, 2 * r + 1, 1 + (r >> 1), shade(leaf, 0.78));
      G.rect(x - r + 1, y - 1, 2 * r - 1, 1, leaf);
      if (r > 1) G.rect(x - 1, y - 2, 2, 1, shade(leaf, 1.15));
      G.rect(x - r, y + 1 + (r >> 1), 2 * r + 2, 1, shade(sand, 0.82)); // its own little shadow
    } else G.rect(x, y, 1 + (r >> 1), 1, shade(sand, 0.7));
  }
  // The cable trench, from the dugout's door out to the stand.
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const x = Math.round(DUGOUT.x + DUGOUT.w + 6 + (ST.x - 22 - (DUGOUT.x + DUGOUT.w + 6)) * t),
      y = Math.round(DUGOUT.y + 24 + (ST.base + 2 - (DUGOUT.y + 24)) * t);
    G.rect(x, y, 2, 2, shade(sand, 0.72));
    G.px(x, y - 1, shade(sand, 1.1));
  }

  // The stand's pad, the pit under the nozzle and the deflector's run-out, east.
  G.poly(
    [
      [ST.x - 26, ST.base - 6],
      [ST.x + 22, ST.base - 6],
      [ST.x + 26, ST.base + 6],
      [ST.x - 22, ST.base + 6],
    ],
    0xb7b0a0,
  );
  G.rect(ST.x - 22, ST.base + 6, 48, 4, 0x8a8478);
  G.rect(ST.x - 6, ST.base - 4, 12, 8, 0x3a3530); // the pit
  G.rect(ST.x - 6, ST.base - 4, 12, 1, 0x141210);
  G.poly(
    [
      [ST.x + 6, ST.base - 4],
      [ST.x + 60, ST.base - 2],
      [ST.x + 66, ST.base + 10],
      [ST.x + 6, ST.base + 4],
    ],
    0x9a9384,
  );
  for (let x = ST.x + 10; x < ST.x + 62; x += 6) G.px(x, ST.base + 2, 0x7c766a);
  // Scorch on the run-out, from the firings before.
  G.glow(ST.x + 26, ST.base + 3, 22, 4, 0x6a5e50, 0.35);

  // ---- the dugout: the mound, the sandbags round its rim, the room cut open ----
  const D = DUGOUT;
  G.glow(D.x + D.w / 2, D.y + D.h / 2 + 2, D.w / 2 + 22, D.h / 2 + 16, 0x9a7b52, 1.4);
  G.rect(D.x - 10, D.y - 6, D.w + 20, D.h + 12, 0x9a7b52);
  for (let y = D.y - 6; y < D.y + D.h + 6; y++)
    for (let x = D.x - 10; x < D.x + D.w + 10; x++) {
      const n = hash(x, y);
      if (n < 0.08) G.px(x, y, 0x7d6342);
      else if (n > 0.95) G.px(x, y, 0xb59a70);
    }
  // Sandbags along the rim.
  for (let x = D.x - 8; x < D.x + D.w + 8; x += 6) {
    G.rect(x, D.y - 6, 5, 3, 0xb79d6e);
    G.rect(x, D.y - 6, 5, 1, 0xcdb688);
    G.rect(x, D.y + D.h + 3, 5, 3, 0xb79d6e);
    G.rect(x, D.y + D.h + 3, 5, 1, 0xcdb688);
  }
  // The concrete shell's cut top, then the room inside.
  G.rect(D.x, D.y, D.w, D.h, 0x8d887a);
  G.rect(D.x, D.y, D.w, 1, 0xa8a393);
  G.vgrad(ROOM.x, ROOM.y, ROOM.w, ROOM.h, [0x3d3a33, 0x45423a, 0x4d4a41]);
  for (let x = ROOM.x + 12; x < ROOM.x + ROOM.w; x += 14) G.rect(x, ROOM.y + 12, 1, ROOM.h - 12, 0x413e36);
  // The panel along the back wall, its face toward the crew (and us).
  G.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0x3c4a3a);
  G.rect(PANEL.x, PANEL.y, PANEL.w, 1, 0x566553);
  G.rect(PANEL.x - 1, PANEL.y + PANEL.h, PANEL.w + 2, 3, 0x6e6458);
  G.rect(PANEL.x - 1, PANEL.y + PANEL.h, PANEL.w + 2, 1, 0x8a7f70);
  for (let i = 0; i < 9; i++) {
    const x = PANEL.x + 5 + i * ((PANEL.w - 10) / 8);
    G.circ(x, PANEL.y + 4, 2, 0x151412);
    G.circ(x, PANEL.y + 4, 1, 0xefe6cf);
  }
  // The stairs up out of the room, on the east side, toward the stand.
  for (let i = 0; i < 5; i++) G.rect(D.x + D.w, D.y + 14 + i * 4, 8 - i, 4, i % 2 ? 0x77705f : 0x6d675a);
  // The periscope's head, through the roof at the west end.
  G.rect(ROOM.x + 4, ROOM.y + 2, 4, 6, 0x3f4a3a);
  G.ring(ROOM.x + 6, ROOM.y + 2, 2, 0x2a3328);
  G.commit();

  // ---- the near edge, out of focus: rocks and brush in the foreground ----
  const N = near;
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(L0 + hash(i, 41) * LW),
      y = Math.floor(170 + hash(i, 43) * 50);
    const r = 4 + Math.floor(hash(i, 47) * 7);
    const leaf = cape ? 0x3e5a2e : 0x5e6a3c;
    if (hash(i, 51) < 0.6) {
      N.circ(x, y, r, shade(leaf, 0.7));
      N.circ(x - 2, y - 2, r - 2, leaf);
    } else {
      N.circ(x, y, r - 1, 0x8a7a62);
      N.circ(x - 1, y - 1, r - 3, 0xa8977a);
    }
  }
  N.commit();

  const talk = SEATS.map(() => {
    const b = speech();
    root.addChild(b);
    return b;
  });
  const deskHit = new Container();
  deskHit.eventMode = 'static';
  deskHit.cursor = 'pointer';
  deskHit.hitArea = new Rectangle((D.x - 10) * PX, (D.y - 8) * PX, (D.w + 20) * PX, (D.h + 16) * PX);
  root.addChild(deskHit);

  // The smoke: puffs of pixels drifting east and up.
  const puffs = [];
  let sock = 0;
  // Each frame. L: the light of the moment (fx/daylight.js); power: how hard she burns (0 to about 1.3); people: up to
  // three at the panel, the player first; k: the scale the room is shown at (for the blur).
  function update({ L, power, firing, people, hdOn, t, k, dt, stage }) {
    far.sprite.filters = hdOn && !pass ? [farBlur] : null;
    near.sprite.filters = hdOn ? [nearBlur] : null;
    shadows.sprite.filters = hdOn ? [shadowBlur] : null;
    farBlur.strength = 0.4 * PX * k;
    nearBlur.strength = 1.6 * PX * k;
    shadowBlur.strength = pass ? 1.5 : 0.5 * PX * k; // on the pass, in art pixels
    const P = live,
      S = shadows;
    P.clear();
    S.clear();

    // The sun's shadows: a point h up lands kx h along the ground and ky h toward us from its foot.
    const sh = L.shadow;
    const kx = Math.max(-2.4, Math.min(2.4, 0.55 * sh.length * sh.dir)),
      ky = 0.2;
    shadows.sprite.alpha = Math.min(0.6, sh.alpha * 2.8);
    const cast = (x, foot, h) => [x + kx * h, foot + ky * h];
    // The tower: four legs, the platform, the stage between them.
    const legs = [
      [ST.x - 12, ST.base - 4],
      [ST.x + 12, ST.base - 4],
      [ST.x - 15, ST.base + 4],
      [ST.x + 15, ST.base + 4],
    ];
    const H = ST.base - ST.top;
    for (const [x, foot] of legs) {
      const [sx, sy] = cast(x, foot, H);
      S.line(x, foot, sx, sy, SHADOW);
      S.line(x + 1, foot, sx + 1, sy, SHADOW);
    }
    {
      const [a, b] = cast(ST.x - 15, ST.base, H),
        [c, d] = cast(ST.x + 15, ST.base, H);
      S.poly(
        [
          [a, b - 2],
          [c, d - 2],
          [c, d + 2],
          [a, b + 2],
        ],
        SHADOW,
      );
      const [ex, ey] = cast(ST.x, ST.base - 6, 46);
      S.poly(
        [
          [ST.x - 4, ST.base - 6],
          [ST.x + 4, ST.base - 6],
          [ex + 4, ey],
          [ex - 4, ey],
        ],
        SHADOW,
      );
    }
    // The mound's shadow, low and wide.
    {
      const [mx, my] = cast(D.x + D.w / 2, D.y + D.h + 6, 6);
      S.glow(Math.round(mx), Math.round(my), D.w / 2 + 16, 8, SHADOW, 1.4);
    }
    // The windsock's pole.
    {
      const [wx, wy] = cast(292, 98, 22);
      S.line(292, 98, wx, wy, SHADOW);
    }

    // The tower and the stage in it.
    const steel = 0x5b5f63,
      steelLit = 0x8a8f94;
    // The back legs first, the stage, then the front legs over it.
    for (const [x, foot] of legs.slice(0, 2)) P.rect(x, ST.top + 2, 2, foot - ST.top - 2, shade(steel, 0.8));
    for (let y = ST.top + 8; y < ST.base - 6; y += 10) P.line(ST.x - 12, y, ST.x + 12, y + 10, shade(steel, 0.75));
    // The stage: a slim body, a band, fins at its foot.
    const sb = stage || { body: 0xeeeae0, band: 0x1e1e1e };
    P.rect(ST.x - 4, ST.top + 10, 8, ST.base - ST.top - 16, sb.body);
    P.rect(ST.x + 2, ST.top + 10, 2, ST.base - ST.top - 16, shade(sb.body, 0.8));
    P.poly(
      [
        [ST.x - 4, ST.top + 10],
        [ST.x + 4, ST.top + 10],
        [ST.x, ST.top + 1],
      ],
      sb.body,
    );
    P.rect(ST.x - 4, ST.top + 22, 8, 3, sb.band);
    P.poly(
      [
        [ST.x - 4, ST.base - 14],
        [ST.x - 8, ST.base - 7],
        [ST.x - 4, ST.base - 8],
      ],
      sb.band,
    );
    P.poly(
      [
        [ST.x + 4, ST.base - 14],
        [ST.x + 8, ST.base - 7],
        [ST.x + 4, ST.base - 8],
      ],
      sb.band,
    );
    for (const [x, foot] of legs.slice(2)) {
      P.rect(x, ST.top, 2, foot - ST.top, steel);
      P.rect(x, ST.top, 1, foot - ST.top, steelLit);
    }
    for (let y = ST.top + 4; y < ST.base; y += 12) P.rect(ST.x - 15, y, 32, 1, steelLit);
    P.rect(ST.x - 17, ST.top - 2, 36, 3, steel); // the platform on top
    P.rect(ST.x - 17, ST.top - 2, 36, 1, steelLit);

    // The flame, down into the pit and out along the deflector; the smoke rolling away east.
    if (firing && power > 0.02) {
      const len = 4 + Math.round(6 * Math.min(1, power)),
        wob = Math.round(Math.sin(t * 40));
      P.poly(
        [
          [NOZZLE.x - 3, NOZZLE.y],
          [NOZZLE.x + 3, NOZZLE.y],
          [NOZZLE.x + 2 + wob, NOZZLE.y + len],
          [NOZZLE.x - 2 + wob, NOZZLE.y + len],
        ],
        0xffd27a,
      );
      P.rect(NOZZLE.x - 1, NOZZLE.y, 2, len - 1, 0xfff6d8);
      const reach = Math.round(20 + 36 * Math.min(1.3, power) + Math.sin(t * 23) * 2);
      P.poly(
        [
          [ST.x + 4, ST.base - 3],
          [ST.x + reach, ST.base - 1],
          [ST.x + reach + 4, ST.base + 5],
          [ST.x + 4, ST.base + 3],
        ],
        0xffb050,
      );
      P.poly(
        [
          [ST.x + 4, ST.base - 2],
          [ST.x + reach * 0.6, ST.base],
          [ST.x + 4, ST.base + 2],
        ],
        0xfff0c0,
      );
      if (Math.random() < Math.min(1, power) * dt * 40)
        puffs.push({ x: ST.x + reach * (0.6 + Math.random() * 0.4), y: ST.base, r: 3, age: 0 });
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      p.x += dt * (14 + p.age * 4);
      p.y -= dt * (6 + p.age * 3);
      p.r = 3 + p.age * 5;
      if (p.age > 5) puffs.splice(i, 1);
    }
    for (const p of puffs) {
      const fade = Math.max(0, 1 - p.age / 5);
      P.glow(Math.round(p.x), Math.round(p.y), Math.round(p.r), Math.round(p.r * 0.8), 0xa79d8c, 1.2 * fade);
      P.glow(
        Math.round(p.x - p.r / 3),
        Math.round(p.y - p.r / 3),
        Math.round(p.r * 0.6),
        Math.round(p.r * 0.5),
        0xd6cfc0,
        0.9 * fade,
      );
    }

    // The windsock.
    sock += dt;
    P.rect(292, 76, 1, 22, 0xd8d4c8);
    const flap = Math.round(Math.sin(sock * 3) * 1.5);
    P.poly(
      [
        [293, 76],
        [304, 77 + flap],
        [304, 79 + flap],
        [293, 80],
      ],
      0xe2702c,
    );
    P.rect(297, 77 + (flap >> 1), 2, 3, 0xf3efe6);

    // The crew at the panel, from above and behind.
    const order = [people[1], people[0], people[2]];
    SEATS.forEach((x, i) => {
      const p = order[i];
      // The chair under each, then whoever sits in it.
      P.rect(x - 6, SHOULDERS + 12, 12, 6, 0x2b2520);
      P.rect(x - 5, SHOULDERS + 12, 10, 1, 0x4a3f34);
      if (p) {
        pixelBack(P, x, SHOULDERS, p);
        if (p.id === 'you')
          P.poly(
            [
              [x + 11, SHOULDERS - 15],
              [x + 17, SHOULDERS - 15],
              [x + 14, SHOULDERS - 11],
            ],
            0xe8c66a,
          );
      }
      talk[i].position.set(x * PX, (SHOULDERS - 18) * PX);
      talk[i].update(p ? p.bubble : null);
    });
    P.commit();
    S.commit();

    hd.root.visible = hdOn;
    if (!hdOn) return;
    // The light: the day (or night) outside, darker in the dugout with its one lamp, orange round the flame.
    const amb = mix(0xffffff, L.tint ?? 0xffffff, 0.85);
    hd.begin(amb);
    hd.fill(ROOM.x, ROOM.y, ROOM.w, ROOM.h, shade(amb, 0.62));
    hd.light(ROOM.x + ROOM.w / 2, ROOM.y + 12, ROOM.w * 0.55, 16, 0xffe2b0, 0.45);
    hd.glow(ROOM.x + ROOM.w / 2, ROOM.y + 2, 8, 0xfff0c8, 0.5);
    if (L.sun?.up) hd.glow(L0 + 30 + (LW - 60) * (1 - L.sun.along), 6, 30, L.sunColor ?? 0xfffbea, 0.25);
    if (firing && power > 0.02) {
      const p = Math.min(1.3, power);
      hd.light(ST.x + 14, ST.base, 90 * p, 50 * p, 0xffb060, 0.8 * p);
      hd.glow(ST.x + 16, ST.base, 26 * p, 0xffd080, 0.6 * p, 10 * p);
      hd.glow(NOZZLE.x, NOZZLE.y + 3, 8, 0xfff2d0, 0.8 * p);
    }
    hd.vignette(0.35, 160, 90);
    hd.commit();
  }

  return { root, update, deskHit, focus: { ...DUGOUT } };
}
