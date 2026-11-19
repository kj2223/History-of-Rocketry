// JPL'S TRACKING, HAND-PAINTED (pixel art pass 2, Aaron 18 November 2026: "hand-paint the range plot and JPL's
// screens, keeping every grid line and trace readable"). The room is painted at 320 x 180 pixels like the blockhouse
// (pixel.js): the wall and floor, the plotting board's frame and face with its grid, the elapsed-time board, the
// teletype's stand. The board's drawings (the Earth and the Moon, her track, the planets' orbits, the routes) are drawn
// by a pixel pen: the same calls deep.js makes on a PixiJS Graphics (moveTo, lineTo, circle, ellipse, poly, fill,
// stroke), drawn instead one art pixel at a time, every line a clean pixel wide, clipped to the board. The words stay
// full-resolution type over the pixels.
import { PX, shade, mix, colorNum } from './pixel.js';

const style = (s, bg) => {
  if (s == null) return { c: 0xffffff, w: 1 };
  if (typeof s === 'number') return { c: s, w: 1 };
  const c = colorNum(s.color ?? 0xffffff),
    w = s.width ?? 1;
  // A faint line is a whole art pixel wide here, so it is drawn fainter still, to weigh what the thin line did.
  const a = s.alpha != null && s.alpha < 1 ? s.alpha * (w < 2 ? 0.65 : 1) : 1;
  return { c: a < 1 ? mix(bg, c, Math.max(0.16, a)) : c, w };
};

// A pen that takes Graphics-like calls in world units and paints them on the pixel layer P. clip: [x, y, w, h] in
// world units, or null. bg: the colour under it, to stand in for transparency.
export function pixelPen(P, { clip = null, bg = 0x000000 } = {}) {
  const A = v => v / PX;
  let shapes = [],
    cur = null;
  const inClip = (x, y) => {
    if (!clip) return true;
    const [cx, cy, cw, ch] = clip.map(A);
    return x >= cx && y >= cy && x < cx + cw && y < cy + ch;
  };
  const dot = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (inClip(x, y)) P.px(x, y, c);
  };
  const seg = (x0, y0, x1, y1, c) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c);
  };
  const ellipsePts = (x, y, rx, ry) => {
    const n = Math.max(12, Math.ceil(Math.max(rx, ry) * 6));
    const pts = [];
    for (let i = 0; i <= n; i++)
      pts.push([x + Math.cos((i / n) * Math.PI * 2) * rx, y + Math.sin((i / n) * Math.PI * 2) * ry]);
    return pts;
  };
  const pen = {
    isPixelPen: true,
    clear() {
      shapes = [];
      cur = null;
      return pen;
    },
    moveTo(x, y) {
      cur = { kind: 'line', pts: [[A(x), A(y)]] };
      shapes.push(cur);
      return pen;
    },
    lineTo(x, y) {
      if (!cur || cur.kind !== 'line') pen.moveTo(x, y);
      else cur.pts.push([A(x), A(y)]);
      return pen;
    },
    circle(x, y, r) {
      shapes.push({ kind: 'ellipse', x: A(x), y: A(y), rx: A(r), ry: A(r) });
      cur = null;
      return pen;
    },
    ellipse(x, y, rx, ry) {
      shapes.push({ kind: 'ellipse', x: A(x), y: A(y), rx: A(rx), ry: A(ry) });
      cur = null;
      return pen;
    },
    rect(x, y, w, h) {
      shapes.push({ kind: 'rect', x: A(x), y: A(y), w: A(w), h: A(h) });
      cur = null;
      return pen;
    },
    poly(flat, close = true) {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push([A(flat[i]), A(flat[i + 1])]);
      shapes.push({ kind: 'poly', pts, close });
      cur = null;
      return pen;
    },
    fill(s) {
      const { c } = style(s, bg);
      for (const sh of shapes) {
        if (sh.kind === 'ellipse') {
          // Nothing round is drawn smaller than a five-pixel disc, so a planet or a craft still reads as round.
          const rx = Math.max(2, sh.rx),
            ry = Math.max(sh.rx < 2 ? 2 : 0.5, sh.ry);
          for (let j = Math.floor(-ry); j <= Math.ceil(ry); j++)
            for (let i = Math.floor(-rx); i <= Math.ceil(rx); i++)
              if ((i / rx) ** 2 + (j / ry) ** 2 <= 1.1) dot(sh.x + i, sh.y + j, c);
        } else if (sh.kind === 'rect') {
          for (let j = 0; j < Math.max(1, Math.round(sh.h)); j++)
            for (let i = 0; i < Math.max(1, Math.round(sh.w)); i++) dot(sh.x + i, sh.y + j, c);
        } else if (sh.kind === 'poly') {
          const xs = sh.pts.map(p => p[0]),
            ys = sh.pts.map(p => p[1]);
          for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
            for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
              if (inside(sh.pts, x + 0.5, y + 0.5)) dot(x, y, c);
        }
      }
      shapes = [];
      cur = null;
      return pen;
    },
    stroke(s) {
      const { c } = style(s, bg);
      for (const sh of shapes) {
        const pts =
          sh.kind === 'line'
            ? sh.pts
            : sh.kind === 'ellipse'
              ? ellipsePts(sh.x, sh.y, sh.rx, sh.ry)
              : sh.kind === 'rect'
                ? [
                    [sh.x, sh.y],
                    [sh.x + sh.w, sh.y],
                    [sh.x + sh.w, sh.y + sh.h],
                    [sh.x, sh.y + sh.h],
                    [sh.x, sh.y],
                  ]
                : sh.close
                  ? [...sh.pts, sh.pts[0]]
                  : sh.pts;
        if (pts.length === 1) dot(pts[0][0], pts[0][1], c);
        for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c);
      }
      shapes = [];
      cur = null;
      return pen;
    },
  };
  return pen;
}

function inside(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

// A hash for the room's speckle.
const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The room behind the board: the wall with its panels, the floor, and the board's light on the wall. P: a pixelLayer
// of 320 x 180 with a margin. plotting: the lit plotting board years (to 1975).
export function paintDeepRoom(P, { plotting, look, board, floor }) {
  const L = -P.mx,
    T = -P.my,
    LW = 320 + 2 * P.mx,
    F = Math.round(floor / PX);
  const wall = plotting ? 0x2e3330 : 0x22262b,
    ground = plotting ? 0x3a352c : 0x2a2d31;
  P.vgrad(L, T, LW, F - T, [shade(wall, 0.82), wall, shade(wall, 1.05)]);
  for (let x = -80; x < 400; x += 32) {
    P.rect(x, T, 1, F - T, shade(wall, 0.8));
    P.rect(x + 1, T, 1, F - T, shade(wall, 1.12));
  }
  // Acoustic tile in the plotting years, a fine weave on the later walls.
  for (let y = T; y < F; y++)
    for (let x = L; x < L + LW; x++)
      if (plotting ? x % 3 === 0 && y % 3 === 0 : hash(x, y) < 0.06) P.px(x, y, shade(wall, 0.88));
  // The board's light on the wall round it.
  const bx = board.x / PX,
    by = board.y / PX,
    bw = board.w / PX,
    bh = board.h / PX;
  P.glow(
    Math.round(bx + bw / 2),
    Math.round(by + bh / 2),
    Math.round(bw * 0.75),
    Math.round(bh * 0.85),
    shade(wall, 1.25),
    0.45,
  );
  // A picture rail and the skirting.
  P.rect(L, 16, LW, 1, shade(wall, 1.3));
  P.rect(L, 17, LW, 1, shade(wall, 0.7));
  P.rect(L, F - 3, LW, 3, shade(wall, 0.6));
  P.rect(L, F - 4, LW, 1, shade(wall, 1.2));
  // The floor: linoleum tiles in the plotting years, carpet after.
  P.vgrad(L, F, LW, 180 + P.my - F, [ground, shade(ground, 0.85), shade(ground, 0.7)]);
  P.rect(L, F, LW, 1, shade(ground, 0.55));
  for (let y = F + 1; y < 180 + P.my; y++)
    for (let x = L; x < L + LW; x++) {
      if (plotting) {
        if ((x + 400) % 12 === 0 || (y - F) % 6 === 0) P.px(x, y, shade(ground, 0.88));
      } else if (hash(x, y) < 0.08) P.px(x, y, shade(ground, 0.9));
    }
  void look;
}

// The board: its frame and face and grid; the elapsed-time board; the teletype's stand. Into the board layer.
export function paintDeepBoard(P, { plotting, look, board, dim }) {
  const bx = board.x / PX,
    by = board.y / PX,
    bw = board.w / PX,
    bh = board.h / PX;
  const frame = plotting ? 0x1c201d : 0x15181c,
    edge = plotting ? 0x4d5547 : colorNum(look.trim),
    face = plotting ? 0x101a1c : colorNum(look.glass);
  P.rect(bx - 4, by - 4, bw + 8, bh + 8, frame);
  P.box(bx - 4, by - 4, bw + 8, bh + 8, edge);
  P.rect(bx - 3, by - 3, bw + 6, 1, shade(edge, 1.3));
  for (const [sx, sy] of [
    [bx - 2, by - 2],
    [bx + bw + 1, by - 2],
    [bx - 2, by + bh + 1],
    [bx + bw + 1, by + bh + 1],
  ])
    P.px(sx, sy, shade(edge, 1.5));
  P.rect(bx, by, bw, bh, face);
  // The glass's sheen over the top third.
  for (let y = by; y < by + Math.round(bh * 0.35); y++)
    for (let x = bx; x < bx + bw; x++) if ((x + y) % 4 === 0) P.px(x, y, mix(face, 0xffffff, 0.04));
  // The grid: every 40 units, one pixel wide.
  const grid = mix(face, colorNum(dim), 0.24);
  for (let x = bx + 8; x < bx + bw; x += 8) P.rect(x, by + 1, 1, bh - 2, grid);
  for (let y = by + 8; y < by + bh; y += 8) P.rect(bx + 1, y, bw - 2, 1, grid);

  // The elapsed-time board (1120, 120, 420 x 170).
  P.rect(224, 24, 84, 34, 0x15181b);
  P.box(224, 24, 84, 34, 0x2a2f34);
  P.rect(225, 24, 82, 1, 0x3a4047);
  P.rect(226, 26, 80, 30, plotting ? 0x0f0b07 : colorNum(look.glass));
  for (let y = 27; y < 56; y += 2) P.rect(226, y, 80, 1, plotting ? 0x140f0a : shade(colorNum(look.glass), 1.1));

  // The teletype: its table, legs and the machine on it (1110..1550, 616..790).
  P.rect(222, 140, 88, 4, 0x5a4a38);
  P.rect(222, 140, 88, 1, 0x7a6750);
  P.rect(226, 144, 3, 14, 0x3e3328);
  P.rect(303, 144, 3, 14, 0x3e3328);
  P.rect(234, 126, 64, 14, 0x4a4840);
  P.rect(234, 126, 64, 1, 0x67645a);
  P.rect(238, 123, 56, 5, 0x5c594f);
  P.rect(240, 130, 52, 6, 0x34322c);
  for (let x = 242; x < 290; x += 3) P.px(x, 132, 0x5c594f);
  for (let x = 243; x < 290; x += 3) P.px(x, 134, 0x5c594f);
}
