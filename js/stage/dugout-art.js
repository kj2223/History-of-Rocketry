// THE TEST STAND DUGOUT, HAND-PAINTED (pixel art pass 2, Aaron 18 and 19 November 2026): the still parts of the
// cutaway painted pixel by pixel on a 320 x 180 layer (pixel.js; one art pixel is PX = 5 scene units) instead of going
// through the automatic pixel pass as smooth shapes. The sky, the far ranges with lit and shadowed faces (or at the
// Cape the sea), the desert with its scrub and pebbles, the flame pit and the deflector's run-out, the earth mound with
// its layers and stones, the sandbags along the top, the concrete room with its shuttering marks, the doorway and the
// stairs up, the periscope through the roof. The panel, its readings, the stand, the flame and the smoke stay as they
// were, over this (dugout.js).
import { PX, shade, mix } from './pixel.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const A = v => Math.round(v / PX);
// The ridge's height at art column x, from a list of scene-unit points.
const ridgeAt = (pts, x) => {
  const sx = x * PX;
  for (let i = 1; i < pts.length; i++)
    if (sx <= pts[i][0]) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        f = (sx - ax) / Math.max(1, bx - ax);
      return { y: (ay + (by - ay) * f) / PX, falling: by > ay };
    }
  return { y: pts.at(-1)[1] / PX, falling: false };
};
const FAR = [
  [700, 560],
  [760, 470],
  [820, 430],
  [860, 455],
  [930, 380],
  [990, 420],
  [1040, 395],
  [1110, 450],
  [1180, 410],
  [1260, 460],
  [1340, 420],
  [1420, 470],
  [1500, 440],
  [1600, 480],
  [2400, 470],
];
const NEAR = [
  [700, 560],
  [800, 505],
  [900, 490],
  [1000, 515],
  [1120, 485],
  [1250, 512],
  [1380, 495],
  [1500, 520],
  [1600, 505],
  [2400, 510],
];

// P: a pixelLayer(320, 180, { mx, my }). sky: three colours, top to horizon. dug, surface, standX: dugout.js's layout.
export function paintDugout(P, { sky, cape, dug, surface, standX }) {
  const L = -P.mx,
    T = -P.my,
    LW = 320 + 2 * P.mx,
    S = A(surface);
  // ---- the sky and the distance ----
  // Many close steps, so the dither between any two is fine grain, not a checkerboard.
  const stops = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    stops.push(
      t < 0.35 ? sky[0] : t < 0.7 ? mix(sky[0], sky[1], (t - 0.35) / 0.35) : mix(sky[1], sky[2], (t - 0.7) / 0.3),
    );
  }
  P.vgrad(L, T, LW, S - T, stops);
  if (cape) {
    P.rect(L, S - 8, LW, 8, 0x3f6f8f);
    P.rect(L, S - 8, LW, 1, 0x6a93ad);
    for (let y = S - 6; y < S; y += 2) for (let x = L; x < L + LW; x++) if (hash(x >> 2, y) > 0.6) P.px(x, y, 0x52809e);
  } else
    for (const [pts, col, far] of [
      [FAR, 0x9b8fa3, true],
      [NEAR, 0xb5a28c, false],
    ])
      for (let x = A(700); x < 320 + P.mx; x++) {
        const { y: ry, falling } = ridgeAt(pts, x);
        const top = Math.round(ry);
        for (let y = top; y < S; y++) {
          let c = falling && y - top < 6 ? mix(col, 0x281e32, 0.18) : col;
          if (!falling && y - top < 2) c = mix(col, 0xfff5e1, 0.18);
          if (hash(x, y) < 0.05) c = shade(c, far ? 0.95 : 0.92);
          if (!far && y > S - 4 && hash(x, y * 3) < 0.12) c = mix(col, 0x6f7a4a, 0.5);
          P.px(x, y, c);
        }
        P.px(x, top, falling ? mix(col, 0x281e32, 0.25) : mix(col, 0xfff5e1, 0.3));
      }
  // ---- the desert ----
  const sand = cape ? 0x8c9a5c : 0xcdb489;
  P.vgrad(L, S, LW, 180 + P.my - S, [shade(sand, 1.04), sand, shade(sand, 0.9)]);
  P.rect(L, S, LW, 1, shade(sand, 1.12));
  for (let y = S + 1; y < 180 + P.my; y++)
    for (let x = A(880); x < 320 + P.mx; x++) {
      const k = hash(x, y);
      if (k < 0.03) P.px(x, y, shade(sand, 0.8));
      else if ((y + Math.round(Math.sin(x * 0.4) * 1.2)) % 5 === 0 && hash(x >> 2, y) > 0.4)
        P.px(x, y, shade(sand, 0.93));
    }
  // Scrub: three bushes, dark under, lit on top.
  for (const [sx, s] of [
    [1480, 1.3],
    [1560, 0.8],
    [1010, 0.7],
  ]) {
    const cx = A(sx),
      r = Math.max(2, Math.round(4 * s));
    for (let j = -r; j <= 0; j++)
      for (let i = -r - 1; i <= r + 1; i++)
        if ((i / (r + 1)) ** 2 + (j / r) ** 2 <= 1 && hash(i + cx, j) > 0.12)
          P.px(cx + i, S + 1 + j, j < -r / 2 ? 0x7f8a55 : 0x6f7a4a);
    P.rect(cx - r, S + 1, 2 * r + 1, 1, 0x4f5636);
  }
  // ---- the flame pit under the stand and the deflector's run-out ----
  const px0 = A(standX - 50);
  P.rect(px0, S, A(100), 9, 0x3a3631);
  P.rect(px0, S, A(100), 1, 0x26231f);
  P.poly(
    [
      [A(standX - 50), S + 9],
      [A(standX + 50), S + 9],
      [A(standX + 190), S + 14],
      [A(standX + 190), S + 18],
    ],
    0x5b544a,
  );
  for (let x = px0 + 1; x < px0 + A(100); x += 3) P.px(x, S + 8, 0x2a2724);

  // ---- the earth mound over the dugout: layers, stones, roots ----
  const mound = [
    [-800, 120],
    [0, 120],
    [160, 100],
    [420, 112],
    [700, 130],
    [900, 160],
    [1000, surface],
    [1000, 1700],
    [-800, 1700],
  ].map(([x, y]) => [x / PX, y / PX]);
  P.poly(mound, 0x9a7b52);
  for (let y = 18; y < 180 + P.my; y++)
    for (let x = L; x < A(1000); x++) {
      if (!insidePoly(mound, x + 0.5, y + 0.5)) continue;
      // The layers dug through: a darker band every twelve pixels, wavering.
      const band = (y + Math.round(Math.sin(x * 0.15 + y * 0.05) * 1.5)) % 12;
      if (band === 0) P.px(x, y, 0x7d6342);
      else if (band === 1 && hash(x, y) > 0.5) P.px(x, y, 0x8a6d48);
      const k = hash(x, y);
      if (k < 0.025) P.px(x, y, 0x6b5537);
      else if (k > 0.988) P.px(x, y, 0xb59a70);
    }
  // The mound's top edge, lit.
  for (let x = L; x < A(1000); x++) {
    for (let y = 18; y < S; y++)
      if (insidePoly(mound, x + 0.5, y + 0.5)) {
        P.px(x, y, 0xb08f62);
        break;
      }
  }
  // ---- the sandbags along the top ----
  for (let i = 0; i < 12; i++) {
    const bx = A(20 + i * 72),
      by = A(104 - (i % 2) * 6 + (i > 8 ? (i - 8) * 8 : 0)),
      bw = A(70),
      bh = A(22);
    P.rect(bx + 1, by, bw - 2, bh, 0xb79d6e);
    P.rect(bx, by + 1, bw, bh - 2, 0xb79d6e);
    P.rect(bx + 1, by, bw - 2, 1, 0xcdb688);
    P.rect(bx + 1, by + bh - 1, bw - 2, 1, 0x8a7350);
    P.rect(bx + bw - 1, by + 1, 1, bh - 2, 0x8a7350);
    // The tie at the end and the stitching along the seam.
    P.rect(bx + bw - 3, by + 1, 1, bh - 2, 0x9d8459);
    for (let x = bx + 2; x < bx + bw - 3; x += 2) P.px(x, by + Math.floor(bh / 2), 0xa48a5e);
  }
  // ---- the concrete room ----
  const dx = A(dug.x),
    dy = A(dug.y),
    dw = A(dug.w),
    dh = A(dug.h);
  P.rect(dx - 4, dy - 4, dw + 8, dh + 8, 0x6f6a5d);
  P.rect(dx - 4, dy - 4, dw + 8, 1, 0x837e70);
  P.vgrad(dx, dy, dw, dh, [0x45423a, 0x4d4a41, 0x4d4a41, 0x47443c]);
  for (let i = 1; i < 8; i++) {
    const x = dx + Math.round((i * 106) / PX);
    P.rect(x, dy, 1, dh, 0x3e3b33);
    P.rect(x + 1, dy, 1, dh, 0x55524a);
  }
  // Shuttering marks: the boards the concrete was poured against.
  for (let y = dy + 4; y < dy + dh - 3; y += 5)
    for (let x = dx; x < dx + dw; x++) if (hash(x >> 3, y) > 0.55) P.px(x, y, 0x48453d);
  P.rect(dx, dy + dh - 2, dw, 2, 0x37352f);
  // ---- the doorway and the stairs up to the desert ----
  const doorX = dx + dw;
  P.rect(doorX, S, 4, dy + dh - S, 0x2c2a25);
  const steps = 8,
    rise = (dy + dh - S) / steps;
  for (let i = 0; i < steps; i++) {
    const sy = Math.round(dy + dh - (i + 1) * rise),
      sx = doorX + 4 + Math.round((i * 12) / PX);
    P.rect(sx, sy, Math.round((110 - i * 12) / PX), Math.ceil(rise), i % 2 ? 0x77705f : 0x6d675a);
    P.rect(sx, sy, Math.round((110 - i * 12) / PX), 1, 0x8a8370);
  }
  // ---- the periscope through the roof ----
  P.rect(A(780), A(80), 3, A(dug.y - 70), 0x3f4a3a);
  P.rect(A(781), A(80), 1, A(dug.y - 70), 0x56634f);
  P.rect(A(766), A(68), 8, 4, 0x323b2e);
  P.rect(A(766), A(68), 8, 1, 0x4a5644);
  P.rect(A(806), A(72), 2, 3, 0x1d2420);
}

function insidePoly(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
