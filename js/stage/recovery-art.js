// RECOVERY, HAND-PAINTED (pixel art pass 2, 19 November 2026): the still parts of the recovery area painted pixel by
// pixel on a 320 x 180 layer (pixel.js; one art pixel is PX = 5 scene units) instead of going through the automatic
// pixel pass as smooth shapes. The sky in fine dithered steps, the sun and its halo, the clouds lit on top and grey
// beneath, the sea darkening toward you with the haze on the horizon; or for the Shuttle the hills, the lakebed and the
// runway with its edge lines, centre dashes and tyre marks. The swell and the glints on the water, the ship, the
// capsule, the raft, the helicopter and the convoy stay as they were, over this (recovery.js), and keep moving.
import { PX, mix } from './pixel.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const A = v => Math.round(v / PX);
const hex = s => parseInt(s.slice(1), 16);

// The colour at t (0 to 1) along a list of [stop, '#rrggbb'] pairs, as the smooth drawing's gradient had it.
const along = (stops, t) => {
  for (let i = 1; i < stops.length; i++)
    if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1],
        [b, cb] = stops[i];
      return mix(hex(ca), hex(cb), (t - a) / Math.max(1e-6, b - a));
    }
  return hex(stops.at(-1)[1]);
};

const SKY_SEA = [
    [0, '#3f6f9e'],
    [0.65, '#9fbfd4'],
    [1, '#dfe7e6'],
  ],
  SKY_LAND = [
    [0, '#5d8fbf'],
    [0.7, '#b9cbd6'],
    [1, '#ecdcb8'],
  ],
  WATER = [
    [0, '#6c9cb8'],
    [0.12, '#3f7596'],
    [1, '#14364e'],
  ];

// P: a pixelLayer(320, 180, { mx, my }). sea: recovery.js's SEA (scene units). runway: the Shuttle's landing.
export function paintRecovery(P, { sea, runway }) {
  const L = -P.mx,
    T = -P.my,
    LW = 320 + 2 * P.mx,
    B = 180 + P.my,
    S = A(sea);
  // ---- the sky: its gradient ran from 800 units above the top to the horizon ----
  const skyStops = runway ? SKY_LAND : SKY_SEA;
  const skyAt = y => along(skyStops, Math.max(0, Math.min(1, (y * PX + 800) / (sea + 800))));
  const rows = [];
  for (let i = 0; i <= 40; i++) rows.push(skyAt(T + ((S - T) * i) / 40));
  P.vgrad(L, T, LW, S - T, rows);
  // The sun: a dithered halo and its disc.
  const sx = A(1000),
    sy = A(120);
  P.glow(sx, sy, 24, 24, mix(skyAt(sy), 0xfff4d8, 0.22), 0.7);
  P.glow(sx, sy, 14, 14, mix(skyAt(sy), 0xfff4d8, 0.45), 0.8);
  P.glow(sx, sy, 8, 8, mix(skyAt(sy), 0xfffbea, 0.75), 1);
  P.circ(sx, sy, 5, 0xfffbea);
  // The clouds: puffs side by side, lit on top and grey beneath, thinned at the edges.
  for (const [cx, cy, cw] of [
    [180, 150, 320],
    [620, 90, 260],
    [1320, 190, 380],
    [1700, 120, 300],
  ])
    for (let k = 0; k < 4; k++) {
      const px = A(cx + (k - 1.5) * cw * 0.22),
        py = A(cy - (k % 2) * 12),
        rx = Math.round((cw * (0.5 + k * 0.15)) / PX / 2.6),
        ry = Math.max(2, Math.round((cw * 0.22) / PX / 2.6));
      for (let j = -ry; j <= ry; j++)
        for (let i = -rx; i <= rx; i++) {
          const d = (i / rx) ** 2 + (j / ry) ** 2;
          if (d > 1 || (d > 0.7 && hash(px + i, py + j) < 0.5)) continue;
          const base = skyAt(py + j),
            top = j < -ry / 3,
            low = j > ry / 3;
          P.px(px + i, py + j, mix(base, top ? 0xffffff : low ? 0xd9e0e6 : 0xf3f5f6, top ? 0.8 : 0.66));
        }
    }
  if (!runway) {
    // ---- the sea: darkening toward you, a few still flecks under the swell, the haze on the horizon ----
    const seaAt = y => along(WATER, Math.max(0, Math.min(1, (y * PX - sea) / (900 - sea + 800))));
    const srows = [];
    for (let i = 0; i <= 40; i++) srows.push(seaAt(S + ((B - S) * i) / 40));
    P.vgrad(L, S, LW, B - S, srows);
    for (let y = S + 2; y < B; y++) {
      const k = (y - S) / (B - S),
        len = 2 + Math.round(k * 10);
      for (let x = L; x < L + LW; x += len + 3 + Math.round(k * 9))
        if (hash(x, y) < 0.18) P.rect(x + Math.round(hash(y, x) * 4), y, len, 1, mix(seaAt(y), 0x0a2a3e, 0.22));
    }
    for (let j = 0; j < 3; j++) P.rect(L, S - 3 + j, LW, 1, mix(skyAt(S - 3 + j), 0xe6eeee, 0.35 + j * 0.08));
    P.rect(L, S, LW, 1, mix(seaAt(S), 0xe6eeee, 0.4));
    return;
  }
  // ---- the hills, the lakebed and the runway ----
  const far = [
      [-800, 0],
      [0, 22],
      [260, 54],
      [520, 26],
      [820, 70],
      [1100, 32],
      [1400, 58],
      [1800, 20],
      [2400, 30],
    ],
    near = [
      [-800, 0],
      [200, 14],
      [600, 6],
      [1000, 18],
      [1500, 8],
      [2400, 12],
    ];
  const heightAt = (pts, sx) => {
    for (let i = 1; i < pts.length; i++)
      if (sx <= pts[i][0]) {
        const [ax, ay] = pts[i - 1],
          [bx, by] = pts[i];
        return { h: ay + ((by - ay) * (sx - ax)) / (bx - ax), rising: by > ay };
      }
    return { h: pts.at(-1)[1], rising: false };
  };
  for (const [pts, col] of [
    [far, 0x8f8a86],
    [near, 0xa49680],
  ])
    for (let x = L; x < L + LW; x++) {
      const { h, rising } = heightAt(pts, x * PX),
        top = S - Math.round(h / PX);
      for (let y = top; y < S; y++) {
        let c = col;
        if (rising && y - top < 3) c = mix(col, 0xfff5e1, 0.15);
        else if (!rising && y - top < 3) c = mix(col, 0x2a2430, 0.1);
        if (hash(x, y) < 0.05) c = mix(c, 0x000000, 0.06);
        P.px(x, y, c);
      }
      if (top < S) P.px(x, top, mix(skyAt(top), col, 0.6)); // the haze softens the ridge
    }
  // The lakebed: hard pale ground, cracked.
  const BED = 0xcdb88e;
  P.vgrad(L, S, LW, B - S, [mix(BED, 0xecdcb8, 0.3), BED, mix(BED, 0x000000, 0.06)]);
  for (let i = 0; i < 40; i++) P.rect(A(-800 + ((i * 173) % 3200)), A(sea + 30 + ((i * 59) % 300)), 12, 1, 0xb5a37c);
  for (let y = S + 1; y < B; y++)
    for (let x = L; x < L + LW; x++) if (hash(x, y) < 0.02) P.px(x, y, mix(BED, 0x000000, 0.1));
  // The runway, its edge lines, the centre dashes, the tyre marks.
  const ry = A(sea + 120),
    rh = A(150);
  P.rect(L, ry, LW, rh, 0x5a5a58);
  for (let y = ry; y < ry + rh; y++)
    for (let x = L; x < L + LW; x++) if (hash(x, y) < 0.06) P.px(x, y, hash(y, x) < 0.5 ? 0x535351 : 0x62625f);
  P.rect(L, A(sea + 124), LW, 1, 0xe8e2d0);
  P.rect(L, A(sea + 263), LW, 1, 0xe8e2d0);
  for (let x = -760; x < 1600 + 800; x += 140) P.rect(A(x), A(sea + 192), A(70), 1, 0xe8e2d0);
  for (let x = -800; x < 1600 + 800; x += 37) P.rect(A(x), A(sea + 150 + ((x * 7) % 90)), 6, 1, 0x4c4c4a);
}
