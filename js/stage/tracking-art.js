// THE RANGE PLOT, HAND-PAINTED (pixel art pass 2, Aaron 18 November 2026: "hand-paint the range plot and JPL's
// screens, keeping every grid line and trace readable"). The plot was left smooth by the automatic pixel pass, whose
// faint grid and thin trace broke up into dots. Here every line is drawn on purpose one art pixel wide, on the pixel
// grid, in colours picked to read against the phosphor: the glass with its glow and scanlines, the steel bezel and its
// screws, the readings column's rule, the grid, the drawing office's estimate, the earlier rounds' tracks; and, live,
// her track with a soft halo, the peak tick, the trouble ring and the radar's returns from the pieces.
// All the words and figures stay full-resolution type over this (tracking.js).
import { artLayer, hash } from './control-art.js';
import { mix, shade } from './pixel.js';

export const GREEN = 0x8fd6a8,
  BRIGHT = 0x9ff0b8,
  DIM = 0x5fae7f,
  GRID = 0x1f3d30,
  AMBER = 0xe8c66a;
const BG = 0x08120e,
  GLOW = 0x173023,
  STEEL = 0x111914;

// The still screen. P0: the plot's layout in screen units (tracking.js rebuild()); s: screen pixels to an art pixel.
export function paintPlot({
  w,
  h,
  s,
  left,
  right,
  bottom,
  topY,
  side,
  px,
  py,
  maxH,
  hStep,
  maxX,
  xStep,
  estimate,
  before,
}) {
  const P = artLayer(w, h, s);
  const A = v => Math.round(v / s);
  const aw = Math.ceil(w / s),
    ah = Math.ceil(h / s);
  // The phosphor: dark at the edges, glowing toward the middle, in dithered steps.
  P.rect(0, 0, aw, ah, BG);
  const cx = Math.round(aw / 2),
    cy = Math.round(ah / 2);
  for (const [k, c] of [
    [1, mix(BG, GLOW, 0.35)],
    [0.8, mix(BG, GLOW, 0.65)],
    [0.55, GLOW],
  ])
    P.glow(cx, cy, Math.round(aw * 0.62 * k), Math.round(ah * 0.7 * k), c, 0.95);
  // Scanlines: every other row a shade darker.
  P.ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 1; y < ah; y += 2) P.ctx.fillRect(0, y, aw, 1);

  // The grid, one art pixel wide; the zero lines a step brighter.
  const L = A(left),
    R = A(right),
    B = A(bottom),
    T = A(py(maxH));
  for (let k = 0; k <= maxH; k += hStep) P.rect(L, A(py(k)), R - L + 1, 1, k === 0 ? mix(GRID, DIM, 0.5) : GRID);
  for (let k = 0; k <= maxX; k += xStep) P.rect(A(px(k)), T, 1, B - T + 1, k === 0 ? mix(GRID, DIM, 0.5) : GRID);
  // Minor ticks along the axes, between the grid lines.
  for (let k = xStep / 2; k < maxX; k += xStep) P.rect(A(px(k)), B - 1, 1, 2, mix(GRID, DIM, 0.4));
  for (let k = hStep / 2; k < maxH; k += hStep) P.rect(L, A(py(k)), 2, 1, mix(GRID, DIM, 0.4));

  // The drawing office's estimate: a faint amber band between dashed edges.
  if (estimate) {
    const lo = A(py(estimate.low)),
      hi = A(py(estimate.high));
    P.ctx.fillStyle = 'rgba(232,198,106,0.06)';
    P.ctx.fillRect(L, hi, R - L, lo - hi);
    const dash = mix(BG, AMBER, 0.55);
    for (let x = L; x < R; x += 4) {
      P.rect(x, lo, 2, 1, dash);
      P.rect(x, hi, 2, 1, dash);
    }
  }
  // Earlier rounds: a dim track each.
  const faint = mix(BG, GREEN, 0.3);
  for (const b of before)
    trace(
      P,
      b.trace.map(([x, hh]) => [A(px(x)), A(py(hh))]),
      faint,
    );

  // The readings column's rule.
  const rx = A(w - side - 10);
  P.box(rx, A(topY - 10), A(side - 10), A(bottom - topY + 20), 0x2c4a39);

  // The bezel: dark steel, a lit inner lip, screws at the corners.
  const bz = Math.max(2, A(14));
  P.rect(0, 0, aw, bz, STEEL);
  P.rect(0, ah - bz, aw, bz, STEEL);
  P.rect(0, 0, bz, ah, STEEL);
  P.rect(aw - bz, 0, bz, ah, STEEL);
  P.box(bz, bz, aw - 2 * bz, ah - 2 * bz, 0x394439);
  P.rect(bz + 1, bz + 1, aw - 2 * bz - 2, 1, shade(0x394439, 0.7));
  for (let x = 0; x < aw; x++) for (const y of [0, ah - 1]) if (hash(x, y) < 0.15) P.px(x, y, shade(STEEL, 1.4));
  for (const [sx, sy] of [
    [1, 1],
    [aw - 2, 1],
    [1, ah - 2],
    [aw - 2, ah - 2],
  ]) {
    P.px(sx, sy, 0x6a7362);
    P.px(sx + (sx > 1 ? -1 : 1), sy, 0x3b4236);
  }
  P.commit();
  return P;
}

// A track through art-pixel points, joined with one-pixel lines.
export function trace(P, pts, c) {
  for (let i = 1; i < pts.length; i++) P.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c);
}

// Her track as the radar paints it: a soft halo a pixel either side, the bright line over it. pts in art pixels.
export function paintTrack(P, pts) {
  const halo = mix(BG, 0x6cdc99, 0.28);
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ])
    trace(
      P,
      pts.map(([x, y]) => [x + dx, y + dy]),
      halo,
    );
  trace(P, pts, BRIGHT);
}
