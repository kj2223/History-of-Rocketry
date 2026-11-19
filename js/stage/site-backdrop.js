// THE SITE'S BACKDROP, HAND-PAINTED (pixel art pass 2, Aaron 18 and 19 November 2026): the three ranges of mountains
// behind White Sands, the sand the site stands on, and at the Cape the Atlantic, the scrub and the palmettos, painted
// pixel by pixel instead of going through the automatic pixel pass as smooth shapes. Each is a strip, a whole number of
// its own repeats long, that site.js slides with the camera at its depth, a whole art pixel at a time.
// One art pixel is U site units: the site is VIEW_H (600) units tall and the picture 180 pixels, so U = 10/3.
// The ranges keep the same ridge lines the smooth drawing had, so nothing moves on the skyline when pixel art is
// switched off and on.
import { pixelLayer, shade, mix } from './pixel.js';
import { VIEW_H, GROUND } from '../site/draw.js';

export const U = VIEW_H / 180;
// A fixed scatter for rock, ripples and leaves: the same speckle every time the backdrop is painted.
const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const ROWS = Math.round(GROUND / U); // 156: the art row where the ground starts

// A strip of art w x h pixels, shown at U site units a pixel with its top at site height y.
function strip(w, h, y = 0) {
  const P = pixelLayer(Math.ceil(w), Math.ceil(h));
  P.sprite.scale.set(U);
  P.sprite.position.set(0, y);
  return P;
}

// One range of mountains, as range() in site.js drew it (peaks every half span, repeating), painted: lit faces and
// shadowed ones, a bright edge along the rising ridges, rock bands, gullies down the shadowed faces and, on the
// nearer ranges, scrub along the foot. far: 0 for the farthest range to 1 for the nearest.
export function paintedRange(color, base, peaks, width, span, far) {
  const period = (span / 2) * peaks.length;
  const pts = [];
  for (let x = 0, i = 0; x <= width + period + span; x += span / 2, i++) pts.push([x, base - peaks[i % peaks.length]]);
  const aw = Math.ceil(pts.at(-1)[0] / U);
  const P = strip(aw, ROWS);
  const lit = shade(color, 1.07),
    dark = mix(color, 0x281e32, 0.16),
    darker = mix(color, 0x281e32, 0.26),
    rock = shade(color, 0.94),
    edge = mix(color, 0xfff5e1, 0.22),
    brush = mix(color, 0x5a5a32, 0.35 + 0.15 * far);
  const periodPx = Math.round(period / U);
  for (let x = 0; x < aw; x++) {
    const sx = x * U;
    let i = Math.min(pts.length - 2, Math.floor(sx / (span / 2)));
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    const f = (sx - ax) / (bx - ax),
      ridge = Math.round((ay + (by - ay) * f) / U);
    const falling = by > ay;
    // A repeat of the pattern on every period, so the strip tiles when it slides back.
    const hx = x % periodPx;
    for (let y = ridge; y < ROWS; y++) {
      // The shadowed face: the far side of each peak, its edge running from the peak down and back toward the foot,
      // as the smooth drawing's shadow did; the edge itself dithered so it reads as a slope, not a wall.
      const yS = y * U,
        along = falling ? (sx - ax) / ((bx - ax) * 0.45 * Math.max(0.01, (yS - ay) / (GROUND - ay))) : 0;
      const inShadow = falling && (along >= 1 || (along > 0.85 && (x + y) % 2 === 0));
      let c = inShadow ? dark : color;
      // A lit edge just under the rising ridges.
      if (!falling && y - ridge < 2) c = lit;
      // Rock: scattered flecks and the odd short ledge, never a regular pattern.
      const k = hash(hx, y);
      if (k < 0.05) c = inShadow ? darker : rock;
      else if (k > 0.985 && !inShadow) c = lit;
      else if (hash(hx >> 2, y) < 0.04) c = inShadow ? darker : rock;
      P.px(x, y, c);
    }
    // The ridge line: lit along the rising slopes, dark along the falling ones.
    P.px(x, ridge, falling ? darker : edge);
    // Scrub along the foot of the nearer ranges.
    if (far > 0)
      for (let y = ROWS - 1 - Math.round(8 * far); y < ROWS; y++)
        if (y >= ridge + 2 && hash(hx, y * 3) < 0.09 + 0.12 * far) P.px(x, y, brush);
  }
  P.commit();
  P.sprite.period = period;
  P.sprite.periodPx = periodPx;
  return P.sprite;
}

// The ground the site stands on, a little wider than the screen, repeating every TILE art pixels: the sand's banding,
// wind ripples, pebbles and, at White Sands, dry tufts; at the Cape, paler sand with shell grit. From GROUND down.
const TILE = 96;
export function paintedSand(vw, cape) {
  const aw = Math.ceil((vw + 2) / U) + TILE;
  const ah = Math.ceil((VIEW_H - GROUND) / U) + 1;
  const P = strip(aw, ah, GROUND);
  const cols = cape ? [0xe4d8b4, 0xd9caa0, 0xc8b88d] : [0xd9c39a, 0xd3b88c, 0xbc9d73];
  P.vgrad(0, 0, aw, ah, cols);
  // The lip where the ground meets the backdrop.
  P.rect(0, 0, aw, 1, cape ? 0xd3c597 : 0xcdb489);
  P.rect(0, 1, aw, 1, mix(cols[0], 0xffffff, 0.12));
  for (let x = 0; x < aw; x++) {
    const hx = x % TILE;
    for (let y = 2; y < ah; y++) {
      const base = mix(cols[0], cols[2], y / ah);
      // Wind ripples: short wavy lines, lit on one side, shadowed on the other.
      const wave = Math.round(Math.sin((hx / TILE) * Math.PI * 6 + y * 1.7) * 1.2);
      if ((y + wave) % 5 === 0 && hash(hx >> 2, y) > 0.3) {
        P.px(x, y, shade(base, 0.93));
        if (y > 2) P.px(x, y - 1, shade(base, 1.04));
      } else if (hash(hx, y) < 0.025)
        P.px(x, y, shade(base, 0.82)); // pebbles
      else if (cape && hash(hx, y + 40) < 0.02) P.px(x, y, 0xf2ead2); // shell grit
    }
    // Dry tufts at White Sands, a pixel or two of grass sticking up from the sand.
    if (!cape && hash(hx, 99) < 0.03) {
      const ty = 3 + Math.floor(hash(hx, 98) * (ah - 5));
      P.px(x, ty, 0x8a8150);
      P.px(x, ty - 1, 0x9c9460);
      P.px(x + 1, ty, 0x7d7448);
    }
  }
  P.commit();
  P.sprite.tilePx = TILE;
  return P.sprite;
}

// The Cape's horizon: the Atlantic (still: its glints drift in site.js), from site height 440 to the scrub.
export function paintedSea(vw) {
  const top = 440,
    aw = Math.ceil((vw + 2) / U),
    ah = Math.ceil((GROUND - top) / U);
  const P = strip(aw, ah, top);
  P.vgrad(0, 0, aw, ah, [0x61869a, 0x4f7a91, 0x436e88, 0x385d72]);
  // The line where sea meets sky, and long low swells, closer together toward the horizon.
  P.rect(0, 0, aw, 1, 0x7b9db0);
  for (let y = 2; y < ah; y++) {
    const gap = 2 + Math.floor(y / 4);
    if (y % gap) continue;
    for (let x = 0; x < aw; x++)
      if (hash(x >> 2, y) > 0.45) P.px(x, y, hash(x, y) > 0.8 ? 0x7395a8 : shade(0x436e88, 0.88));
  }
  P.commit();
  return P.sprite;
}

// The Cape's green band behind the site, with its palmettos every PALM art pixels, sliding with the camera at 0.4.
const PALM = 42; // 140 site units, as the smooth drawing spaced them
export function paintedScrub(vw) {
  const top = 452,
    aw = Math.ceil((vw + 2) / U) + PALM * 2,
    ah = Math.ceil((GROUND - top) / U);
  const P = strip(aw, ah, top);
  const band = Math.round((488 - top) / U); // where the scrub's top edge is, in rows from the strip's top
  P.rect(0, band, aw, ah - band, 0x5b7a3c);
  P.rect(0, band, aw, 1, 0x86a35a);
  for (let x = 0; x < aw; x++) {
    const hx = x % PALM;
    // Bushes along the top of the band, and the band's own leafy texture.
    const bump = Math.round(hash(hx >> 1, 3) * 2);
    for (let y = band - bump; y < band; y++) P.px(x, y, 0x5b7a3c);
    if (bump) P.px(x, band - bump, 0x86a35a);
    for (let y = band + 1; y < ah; y++) {
      const k = hash(hx, y + 11);
      if (k < 0.18) P.px(x, y, 0x4a6631);
      else if (k > 0.93) P.px(x, y, 0x7a9852);
    }
  }
  // The palmettos: a leaning trunk and a crown of fronds.
  for (let px = 0; px < aw; px += PALM) {
    const foot = band + 1,
      crown = foot - 12;
    for (let y = crown; y <= foot; y++) P.px(px + Math.round((foot - y) * 0.08), y, y % 3 ? 0x5a4a32 : 0x6c5a3e);
    const cx = px + 1;
    for (const [dx, dy] of [
      [-5, 2],
      [-4, 1],
      [-3, 0],
      [-2, -1],
      [-1, -1],
      [1, -1],
      [2, -1],
      [3, 0],
      [4, 1],
      [5, 2],
      [-2, 1],
      [2, 1],
      [0, -2],
      [-4, 3],
      [4, 3],
    ])
      P.px(cx + dx, crown + dy, dy < 0 ? 0x4f7e40 : 0x3f6a35);
    P.px(cx, crown, 0x3a5a2e);
  }
  P.commit();
  P.sprite.tilePx = PALM;
  return P.sprite;
}
