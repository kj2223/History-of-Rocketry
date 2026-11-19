// THE SIMULATOR, HAND-PAINTED (pixel art pass 2, 19 November 2026): the training room's still parts painted pixel by
// pixel on a 320 x 180 layer (pixel.js; one art pixel is PX = 5 scene units) instead of going through the automatic
// pixel pass as smooth shapes. The painted block walls and their seams, the chair rail, the tiled floor, the two pools
// of light from the screens, the sign's box over the door, the sim clock's case, the supervisor's window with its
// frame, sill and glass. The telemetry screen, the clock's figures, the sign's lamp, the supervisor himself and his
// failures board, your console and the calls stay as they were, over this (sim.js).
import { PX, mix } from './pixel.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const A = v => Math.round(v / PX);

// P: a pixelLayer(320, 180, { mx, my }). floor: sim.js's FLOOR (scene units).
export function paintSim(P, { floor }) {
  const L = -P.mx,
    T = -P.my,
    LW = 320 + 2 * P.mx,
    B = 180 + P.my,
    F = A(floor),
    RAIL = A(520);
  const WALL = 0x2a2f36,
    LOW = 0x272b32,
    TILE = 0x34312c;
  // The light the screens throw on the wall: colours mixed into the wall at four strengths.
  const pools = [
    [A(470), A(340), A(550), A(380), 0x649da7, 0.22],
    [A(1390), A(300), A(300), A(300), 0x9eaec0, 0.16],
  ];
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const lit = (x, y, c) => {
    for (const [cx, cy, rx, ry, pc, k] of pools) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      // The wash in steps of a twentieth, Bayer-dithered between, so it fades with no rim.
      const lv = k * (1 - d) ** 0.9 * 20,
        b = Math.floor(lv),
        step = b + (lv - b > (BAYER[y & 3][(x + 400) & 3] + 0.5) / 16 ? 1 : 0);
      if (step) c = mix(c, pc, step / 20);
    }
    return c;
  };
  // ---- the walls: painted block, its courses and seams ----
  for (let y = T; y < F; y++)
    for (let x = L; x < L + LW; x++) {
      let c = y < RAIL ? WALL : LOW;
      const course = y >= 0 && y % 8 === 7,
        joint = (x + 400 + (Math.floor(y / 8) % 2) * 8) % 16 === 0;
      if (y >= 0 && y < RAIL && (course || joint)) c = mix(c, 0x000000, 0.12);
      if ((x * PX + 2000) % 120 < PX && y >= 0 && y < F) c = mix(c, 0xffffff, 0.04); // the old seams
      if (hash(x, y) < 0.02) c = mix(c, 0x000000, 0.08);
      P.px(x, y, lit(x, y, c));
    }
  // The chair rail.
  P.rect(L, RAIL, LW, 4, 0x242931);
  P.rect(L, RAIL, LW, 1, 0x4b5156);
  P.rect(L, RAIL + 3, LW, 1, 0x1c2026);
  // ---- the floor: tiles, the wall's shadow at its foot ----
  for (let y = F; y < B; y++)
    for (let x = L; x < L + LW; x++) {
      let c = TILE;
      const row = Math.floor((y - F) / 6),
        tx = (x + 400 + (row % 2) * 6) % 12;
      if ((y - F) % 6 === 5 || tx === 0) c = mix(TILE, 0x000000, 0.18);
      else if ((y - F) % 6 === 0) c = mix(TILE, 0xffffff, 0.04);
      if (hash(x, y) < 0.03) c = mix(c, 0x000000, 0.1);
      P.px(x, y, c);
    }
  P.rect(L, F, LW, 1, mix(TILE, 0x000000, 0.35));
  P.rect(L, F + 1, LW, 1, mix(TILE, 0x000000, 0.2));
  // ---- the sign's box over the door (its face and word are drawn live in sim.js) ----
  P.rect(A(640) - 1, A(40) - 1, A(320) + 2, A(60) + 2, 0x15181c);
  P.rect(A(640) - 1, A(100) + 1, A(320) + 2, 1, 0x3a3f45);
  // ---- the sim clock's case: the housing, its window, the brass rule ----
  P.rect(A(870), A(150), A(300), A(150), 0x181b1f);
  P.rect(A(870), A(150), A(300), 1, 0x2a2f35);
  P.rect(A(880), A(160), A(280), A(100), 0x120d08);
  P.rect(A(880), A(160), A(280), 1, 0x0b0805);
  P.rect(A(870), A(300), A(300), 1, 0x6b7278);
  for (const x of [A(874), A(1164)]) for (const y of [A(154), A(294)]) P.px(x, y, 0x3a3f45); // its screws
  // ---- the supervisor's window: frame, the room behind, the sill ----
  const sx = A(1230),
    sy = A(120),
    sw = A(330),
    sh = A(290);
  P.rect(sx, sy, sw, sh, 0x181b1f);
  P.rect(sx, sy, sw, 1, 0x2a2f35);
  const gx = A(1244),
    gy = A(134),
    gw = A(302),
    gh = A(262);
  P.vgrad(gx, gy, gw, gh, [0x3e4e5e, 0x3a4a5a, 0x34434f]);
  // The control room behind him: a far wall, a rack of lamps.
  P.rect(gx, gy + 6, gw, 1, 0x33414f);
  for (let x = gx + 4; x < gx + gw - 4; x += 5) P.px(x, gy + 10, hash(x, 3) > 0.7 ? 0x7da36a : 0x2f3c47);
  // His desk under the window, its edge lit.
  P.rect(A(1254), A(324), A(282), A(62), 0x4b5258);
  P.rect(A(1254), A(324), A(282), 1, 0x667077);
  // The glass: a frame bar, two streaks across.
  P.rect(A(1262), gy, 4, gh, mix(0x3a4a5a, 0xffffff, 0.08));
  P.line(A(1480), gy, A(1362), gy + gh - 1, mix(0x3a4a5a, 0xb6d8e9, 0.18));
  P.line(A(1494), gy, A(1376), gy + gh - 1, mix(0x3a4a5a, 0xb6d8e9, 0.12));
  P.rect(sx, A(408), sw, 1, 0x6b7278);
  P.rect(sx, A(408) + 1, sw, 1, 0x3a3f45);
}
