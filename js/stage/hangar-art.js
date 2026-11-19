// THE ASSEMBLY HANGAR, HAND-PAINTED (pixel art pass 2, 19 November 2026): the still room painted pixel by pixel on a
// 320 x 180 layer (pixel.js; one art pixel is PX = 5 scene units) instead of going through the automatic pixel pass as
// smooth shapes. The quonset: the corrugated arch and its ribs, the lamp shades on their cords, the stained concrete
// floor and its expansion joints, the bench, the tool board and the chalkboard's frame. Hangar S: the white walls and
// their dado stripe, the fluorescent fittings, the polished floor with its seams, the test cabinet, the banner's cloth.
// The round, the spacecraft, the spots, the cards, the crew and all text stay as they were, over this (hangar.js).
import { PX, mix } from './pixel.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const A = v => Math.round(v / PX);

// The floor's joints, converging on the middle of the room: the same lines the smooth drawing had.
function floorJoints(P, { L, LW, F, B, mid, col }) {
  for (let i = -6; i <= 14; i++) {
    const x0 = (mid + (i - 4) * 120) / PX,
      x1 = (mid + (i - 4) * 260) / PX,
      y1 = B,
      dy = y1 - F;
    for (let y = F + 1; y < y1; y++) {
      const x = Math.round(x0 + ((x1 - x0) * (y - F)) / dy);
      if (x >= L && x < L + LW) P.px(x, y, col);
    }
  }
}

// P: a pixelLayer(320, 180, { mx, my }). floor, mid, banner: hangar.js's layout (scene units; banner = its width).
export function paintHangar(P, { crewed, floor, mid, bannerW }) {
  const L = -P.mx,
    T = -P.my,
    LW = 320 + 2 * P.mx,
    B = 180 + P.my,
    F = A(floor),
    M = A(mid);
  if (crewed) {
    // ---- Hangar S ----
    P.vgrad(L, T, LW, A(80) - T, [0xe8e6df, 0xe8e6df, 0xe4e2db]);
    P.vgrad(L, A(80), LW, F - A(80), [0xdcdad3, 0xd9d7d0, 0xd3d1c9]);
    // The dado stripe: a thin line and a band, the blue-grey of the trim.
    P.rect(L, A(330), LW, 1, mix(0xd9d7d0, 0x526669, 0.15));
    P.rect(L, A(342), LW, 4, mix(0xd9d7d0, 0x526669, 0.15));
    P.rect(L, A(342), LW, 1, mix(0xd9d7d0, 0x526669, 0.22));
    // The wall's panel joints, faint.
    for (let x = L + 2; x < L + LW; x += 40) P.rect(x, A(80), 1, A(330) - A(80), 0xd2d0c8);
    for (let x = L + 2; x < L + LW; x += 40) P.rect(x, A(362), 1, F - A(362), 0xcfcdc5);
    // The skirting and the floor.
    P.rect(L, F - 2, LW, 2, 0xc3c1b8);
    P.vgrad(L, F, LW, B - F, [0xc4c1b7, 0xc9c6bc, 0xcdcac0]);
    P.rect(L, F, LW, 1, mix(0xc9c6bc, 0x000000, 0.14));
    P.rect(L, F + 1, LW, 1, mix(0xc9c6bc, 0x000000, 0.06));
    floorJoints(P, { L, LW, F, B, mid, col: mix(0xc9c6bc, 0x000000, 0.07) });
    // Polish: the fittings caught in the floor.
    for (const lx of [270, 800, 1330]) {
      const cx = A(lx);
      for (let y = F + 4; y < F + 16; y++)
        for (let x = cx - 14; x <= cx + 14; x++) if (hash(x, y) < 0.25 - (y - F) * 0.012) P.px(x, y, 0xd4d1c8);
    }
    // The fittings: housing, tube, end caps.
    for (const lx of [270, 800, 1330]) {
      const cx = A(lx);
      P.rect(cx - 23, A(70), 46, 4, 0x787e7b);
      P.rect(cx - 23, A(70), 46, 1, 0x8f9592);
      P.rect(cx - 22, A(75), 44, 2, 0xfbfaf4);
      P.rect(cx - 22, A(75) + 2, 44, 1, 0xe6e5de);
      P.px(cx - 23, A(75), 0x5f6562);
      P.px(cx + 22, A(75), 0x5f6562);
      P.rect(cx - 12, T, 1, A(70) - T, 0x9a9f9c);
      P.rect(cx + 11, T, 1, A(70) - T, 0x9a9f9c);
    }
    // The test cabinet at the left wall, its drawers ruled, its handles and feet.
    const cx = A(110),
      cy = A(floor - 150);
    P.rect(cx, cy, 34, 28, 0x9da3a0);
    P.rect(cx, cy, 1, 28, 0xb3b8b5);
    P.rect(cx + 33, cy, 1, 28, 0x858b88);
    P.rect(A(106), A(floor - 158), 36, 2, 0x5d6c70);
    P.rect(A(106), A(floor - 158), 36, 1, 0x72838a);
    for (const y of [floor - 125, floor - 98, floor - 71]) {
      P.rect(A(120), A(y), 30, 1, 0xbec5c1);
      P.rect(A(120), A(y) + 1, 30, 1, 0x8e9491);
      P.rect(cx + 15, A(y) + 3, 4, 1, 0x5d6c70);
    }
    P.rect(A(122), F - 2, 3, 2, 0x5d6c70);
    P.rect(A(254), F - 2, 3, 2, 0x5d6c70);
    // The banner's cloth: navy, its hem lit, its folds.
    const bw = A(bannerW),
      bx = M - Math.round(bw / 2),
      by = A(120);
    P.rect(bx, by, bw, A(56), 0x2b3f6b);
    P.rect(bx, by, bw, 1, 0x3b5283);
    P.rect(bx, by + A(56) - 1, bw, 1, 0x1f2f52);
    for (let x = bx + 9; x < bx + bw - 4; x += 18) P.rect(x, by + 1, 1, A(56) - 2, 0x283b64);
    P.rect(bx + 3, by - 4, 1, 4, 0x787e7b);
    P.rect(bx + bw - 4, by - 4, 1, 4, 0x787e7b);
    return;
  }
  // ---- the quonset ----
  // The end wall under the arch: corrugated sheet, its ribs of shadow.
  for (let y = T; y < F; y++)
    for (let x = L; x < L + LW; x++) {
      let c = 0x3d3f43;
      const r = (x + 400) % 4;
      if (r === 0) c = 0x36383c;
      else if (r === 1) c = 0x424448;
      if (hash(x, y) < 0.025) c = 0x34363a;
      P.px(x, y, c);
    }
  // The arch overhead, darker, with the line of its eave lit.
  for (let x = L; x < L + LW; x++) {
    const sx = x * PX;
    // The smooth drawing's quadratic: from (-800, 150) through control (MID, -80) to (W + 800, 150).
    const t = (sx + 800) / (1600 + 1600);
    const ey = (1 - t) * (1 - t) * 150 + 2 * (1 - t) * t * -80 + t * t * 150;
    const top = Math.round(ey / PX);
    for (let y = T; y < top; y++) {
      let c = 0x2f3134;
      if ((x + 400) % 4 === 0) c = 0x2a2c2f;
      if (y > top - 3) c = mix(0x2f3134, 0x000000, 0.2);
      P.px(x, y, c);
    }
    P.px(x, top, 0x4b4e53);
  }
  // The ribs: steel, lit on the left.
  for (let x = -160; x <= 1600 + 160; x += 200) {
    const top = A(130 - 50 * Math.cos((x - mid) / 2000)),
      rx = A(x) - 1;
    P.rect(rx, top, 2, F - top, 0x55585d);
    P.rect(rx - 1, top, 1, F - top, 0x83868b);
    for (let y = top + 6; y < F; y += 14) P.px(rx, y, 0x6a6d72); // the rivets
  }
  // The floor: concrete, stained and patched, the joints converging.
  P.vgrad(L, F, LW, B - F, [0x63625e, 0x6b6a66, 0x706f6a]);
  P.rect(L, F, LW, 2, mix(0x6b6a66, 0x000000, 0.28));
  for (let y = F + 2; y < B; y++)
    for (let x = L; x < L + LW; x++) {
      const k = hash(x, y);
      if (k < 0.03) P.px(x, y, 0x5f5e5a);
      else if (k > 0.985) P.px(x, y, 0x7a7974);
    }
  // Oil stains under where the rounds have lain.
  for (const [sx, sy, r] of [
    [620, 800, 9],
    [1010, 820, 6],
    [1300, 790, 5],
  ]) {
    const cx = A(sx),
      cy = A(sy);
    for (let j = -r; j <= r; j++)
      for (let i = -2 * r; i <= 2 * r; i++)
        if ((i / (2 * r)) ** 2 + (j / r) ** 2 <= 1 && hash(i + cx, j + cy) < 0.55) P.px(cx + i, cy + j, 0x5c5b57);
  }
  floorJoints(P, { L, LW, F, B, mid, col: mix(0x6b6a66, 0x000000, 0.15) });
  // The lamps: cords, enamel shades, the bulbs' lip.
  for (const lx of [400, 800, 1200]) {
    const cx = A(lx);
    P.rect(cx, T, 1, A(100) - T, 0x222222);
    P.poly(
      [
        [A(lx - 32), A(120)],
        [A(lx - 15), A(100)],
        [A(lx + 15), A(100)],
        [A(lx + 32), A(120)],
      ],
      0xd9c37a,
    );
    P.rect(A(lx - 15), A(100), A(30), 1, 0xf3dd8a);
    P.rect(A(lx - 32), A(120) - 1, A(64), 1, 0xf3dd8a);
    P.rect(cx - 2, A(120), 5, 1, 0xfff4cc);
  }
  // The bench: its top, legs, the vice, the parts box.
  const fy = floor;
  P.rect(A(30), A(fy - 150), A(220), 3, 0x6a5a44);
  P.rect(A(30), A(fy - 150), A(220), 1, 0x86735a);
  P.rect(A(40), A(fy - 136), 2, A(136), 0x5d4f3b);
  P.rect(A(230), A(fy - 136), 2, A(136), 0x5d4f3b);
  P.rect(A(40), A(fy - 60), A(192), 1, 0x5d4f3b); // the shelf
  P.rect(A(60), A(fy - 162), A(80), 2, 0xb9a783);
  P.rect(A(60), A(fy - 162), A(80), 1, 0xcdbd99);
  P.rect(A(170), A(fy - 178), A(60), A(28), 0x585d50);
  P.rect(A(170), A(fy - 178), A(60), 1, 0x6e7464);
  P.rect(A(172), A(fy - 170), A(56), 1, 0x464a40);
  // The tool board: pegboard, its holes, the tools hung on it.
  const tx = A(40),
    ty = A(fy - 290),
    tw = A(200),
    th = A(110);
  P.rect(tx, ty, tw, th, 0x4a4034);
  P.rect(tx, ty, tw, 1, 0x5c5042);
  for (let y = ty + 2; y < ty + th - 1; y += 3) for (let x = tx + 2; x < tx + tw - 1; x += 3) P.px(x, y, 0x3c342a);
  for (let i = 0; i < 4; i++) {
    const x0 = A(70 + i * 44),
      x1 = A(70 + i * 44 + (i % 2 ? 8 : -6));
    P.line(x0, A(fy - 272), x1, A(fy - 200), 0xb8b2a6);
    P.rect(x0 - 1, A(fy - 274), 3, 2, 0x8f8a80);
  }
  // The chalkboard's frame and slate; its words are written on it in the scene (hangar.js).
  const cx = A(30),
    cy = A(fy - 400);
  P.rect(cx - 1, cy - 1, A(240) + 2, A(80) + 2, 0x6a5a44);
  P.rect(cx - 1, cy - 1, A(240) + 2, 1, 0x86735a);
  P.rect(cx, cy, A(240), A(80), 0x2d3b33);
  for (let y = cy; y < cy + A(80); y++)
    for (let x = cx; x < cx + A(240); x++) if (hash(x, y * 7) < 0.06) P.px(x, y, 0x34443b); // old chalk
  P.rect(cx, cy + A(80), A(240), 1, 0x86735a); // the ledge
  P.px(cx + 30, cy + A(80) - 1, 0xe8e4d6);
}
