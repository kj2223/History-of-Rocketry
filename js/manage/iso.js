// MANAGEMENT MODE: isometric pixel painting. The base is painted at art resolution (one canvas pixel = one art pixel)
// and shown scaled up by a whole number with nearest-neighbour pixels, like every other scene (DESIGN.md §1). Tiles are
// 2:1 diamonds, TW x TH art pixels. Every shape is filled row by row with whole pixels, so no edge is smoothed.
export const TW = 16,
  TH = 8;

export const hex = c => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);
export const shade = (c, k) => {
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const bayer = (x, y) => BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;

// A painter over a 2D context at art resolution. ox, oy: where tile (0, 0)'s top corner sits.
export function isoPainter(ctx, ox, oy) {
  const fill = c => (ctx.fillStyle = hex(c));
  const at = (tx, ty, z = 0) => ({ x: ox + (tx - ty) * (TW / 2), y: oy + (tx + ty) * (TH / 2) - z });
  // A convex polygon, filled by rows. pattern(x, y) may return another colour for a pixel (dither, texture).
  function poly(pts, c, pattern) {
    const ys = pts.map(p => p.y),
      y0 = Math.round(Math.min(...ys)),
      y1 = Math.round(Math.max(...ys));
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5;
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
          const x = a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x);
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
      if (lo > hi) continue;
      const xa = Math.round(lo),
        xb = Math.round(hi);
      if (!pattern) {
        fill(c);
        ctx.fillRect(xa, y, xb - xa, 1);
      } else
        for (let x = xa; x < xb; x++) {
          fill(pattern(x, y) ?? c);
          ctx.fillRect(x, y, 1, 1);
        }
    }
  }
  const P = {
    ctx,
    at,
    poly,
    px(x, y, c) {
      fill(c);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    },
    rect(x, y, w, h, c) {
      fill(c);
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    // The ground face of a footprint (tx, ty, w, d tiles), raised z art pixels.
    flat(tx, ty, w, d, c, z = 0, pattern) {
      poly([at(tx, ty, z), at(tx + w, ty, z), at(tx + w, ty + d, z), at(tx, ty + d, z)], c, pattern);
    },
    // A box standing on a footprint, h art pixels tall: lit top, the right face in half light, the left in shade.
    box(tx, ty, w, d, h, c, { top = c, z = 0, pattern } = {}) {
      const g = (x, y, k) => at(x, y, k);
      poly(
        [g(tx, ty + d, z), g(tx + w, ty + d, z), g(tx + w, ty + d, z + h), g(tx, ty + d, z + h)],
        shade(c, 0.72),
        pattern,
      );
      poly(
        [g(tx + w, ty, z), g(tx + w, ty + d, z), g(tx + w, ty + d, z + h), g(tx + w, ty, z + h)],
        shade(c, 0.9),
        pattern,
      );
      P.flat(tx, ty, w, d, top, z + h);
    },
    // A one-pixel line.
    line(a, b, c) {
      fill(c);
      const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) | 0;
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0;
        ctx.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), 1, 1);
      }
    },
  };
  return P;
}
