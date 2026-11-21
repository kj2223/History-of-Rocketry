// THE PIXEL LAYER (v0.8 pixel art pass): the scenes are painted at 320 x 180 pixels and scaled up with crisp,
// nearest-neighbour pixels (6x on a 1080p screen), as in the mockups Aaron approved on 15 November 2026. Only the
// picture is pixel art: the readings, labels, speech and the call panel stay at full resolution on top, so they read
// as clearly as before.
// A scene's world is 1600 x 900 units, so one art pixel is PX = 5 world units. A layer is a small canvas shown as a
// Sprite; the scene paints its still parts once into one layer, and its moving parts (needles, lamps, people) into a
// second layer that it clears and repaints every frame.
import { Texture } from '../vendor/pixi.min.mjs';
import { ownedTextureSprite } from './kit.js';

export const PX = 5,
  PW = 320,
  PH = 180;

// Colours: numbers (0xrrggbb) or CSS strings.
export const css = c => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);
export const shade = (c, k) => {
  const n = typeof c === 'number' ? c : parseInt(String(c).slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255);
};
export const mix = (a, b, t) => {
  const n = c => (typeof c === 'number' ? c : parseInt(String(c).slice(1), 16));
  const x = n(a),
    y = n(b);
  const ch = s => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// The 4 x 4 ordered-dither table: how gradients and soft light are drawn without blending.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const bayer = (x, y) => BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;

// A painting surface w x h art pixels, shown in the scene at PX world units a pixel. Every shape lands on whole pixels.
// mx, my: a margin painted beyond the scene's own 320 x 180 on each side (coordinates run from -mx), so a wide or tall
// window shows more of the room instead of black bars.
export function pixelLayer(w = PW, h = PH, { mx = 0, my = 0 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w + 2 * mx;
  cv.height = h + 2 * my;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(mx, my);
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  const sprite = ownedTextureSprite(tex);
  sprite.scale.set(PX);
  sprite.position.set(-mx * PX, -my * PX);
  const fill = c => {
    ctx.fillStyle = css(c);
  };
  const P = {
    sprite,
    ctx,
    w,
    h,
    mx,
    my,
    clear() {
      ctx.clearRect(-mx, -my, w + 2 * mx, h + 2 * my);
    },
    // Sends the painting to the graphics card: once after painting a still layer, every frame for a live one.
    commit() {
      tex.source.update();
    },
    px(x, y, c) {
      fill(c);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    },
    rect(x, y, rw, rh, c) {
      if (rw <= 0 || rh <= 0) return;
      fill(c);
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
    },
    // A one-pixel outline.
    box(x, y, rw, rh, c) {
      P.rect(x, y, rw, 1, c);
      P.rect(x, y + rh - 1, rw, 1, c);
      P.rect(x, y, 1, rh, c);
      P.rect(x + rw - 1, y, 1, rh, c);
    },
    // A checkerboard of two colours (a half tone).
    dith(x, y, rw, rh, c1, c2, phase = 0) {
      P.rect(x, y, rw, rh, c1);
      fill(c2);
      for (let j = 0; j < rh; j++)
        for (let i = (j + phase) % 2; i < rw; i += 2) ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    },
    // A vertical gradient through a list of colours, banded with ordered dither.
    vgrad(x, y, rw, rh, cols) {
      const n = cols.length;
      for (let j = 0; j < rh; j++) {
        const t = (j / Math.max(1, rh - 1)) * (n - 1),
          k = Math.min(n - 2, Math.floor(t)),
          f = t - k;
        if (n === 1) {
          P.rect(x, y + j, rw, 1, cols[0]);
          continue;
        }
        P.rect(x, y + j, rw, 1, cols[k]);
        fill(cols[k + 1]);
        for (let i = 0; i < rw; i++) if (f > bayer(x + i, y + j)) ctx.fillRect(x + i, y + j, 1, 1);
      }
    },
    // Soft light without blending: a dithered ellipse of colour c, densest at the middle. rx, ry: radii.
    glow(cx, cy, rx, ry, c, strength = 0.5) {
      fill(c);
      for (let j = -ry; j <= ry; j++)
        for (let i = -rx; i <= rx; i++) {
          const d = (i / rx) ** 2 + (j / ry) ** 2;
          if (d >= 1) continue;
          if ((1 - d) * strength > bayer(cx + i, cy + j)) ctx.fillRect(cx + i, cy + j, 1, 1);
        }
    },
    line(x0, y0, x1, y1, c) {
      fill(c);
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0;
        ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
      }
    },
    // A filled pixel disc, row by row so the edge stays hard.
    circ(cx, cy, r, c) {
      fill(c);
      cx = Math.round(cx);
      cy = Math.round(cy);
      for (let j = -r; j <= r; j++) {
        const half = Math.floor(Math.sqrt(r * r + r * 0.8 - j * j));
        if (Number.isNaN(half)) continue;
        ctx.fillRect(cx - half, cy + j, 2 * half + 1, 1);
      }
    },
    // A one-pixel ring.
    ring(cx, cy, r, c) {
      fill(c);
      cx = Math.round(cx);
      cy = Math.round(cy);
      for (let j = -r - 1; j <= r + 1; j++)
        for (let i = -r - 1; i <= r + 1; i++) {
          const d = i * i + j * j;
          if (d >= r * r - r && d <= r * r + r) ctx.fillRect(cx + i, cy + j, 1, 1);
        }
    },
    // A filled triangle or any convex or concave polygon, by pixel centres.
    poly(pts, c) {
      fill(c);
      const ys = pts.map(p => p[1]),
        xs = pts.map(p => p[0]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
          if (inside(pts, x + 0.5, y + 0.5)) ctx.fillRect(x, y, 1, 1);
    },
    // Draws a picture (a canvas) into a pixel disc: the periscope's view, a television.
    disc(img, cx, cy, r, smooth = true) {
      ctx.save();
      ctx.beginPath();
      for (let j = -r; j <= r; j++) {
        const half = Math.floor(Math.sqrt(r * r + r * 0.8 - j * j));
        if (!Number.isNaN(half)) ctx.rect(cx - half, cy + j, 2 * half + 1, 1);
      }
      ctx.clip();
      ctx.imageSmoothingEnabled = smooth;
      ctx.drawImage(img, cx - r, cy - r, 2 * r + 1, 2 * r + 1);
      ctx.imageSmoothingEnabled = false;
      ctx.restore();
    },
    // Draws a picture into a rectangle, downsampled to the pixel grid.
    picture(img, x, y, rw, rh) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, x, y, rw, rh);
      ctx.imageSmoothingEnabled = false;
    },
  };
  return P;
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

// ---- pieces every pixel scene draws with ----

// A dial face: dark rim, cream face, ticks. No green band: the limits are on the red-line card (js/scenes/redlines.js),
// and reading the needle against them is the player's job (hands-on idea 1, Aaron 20 November 2026). The needle is
// drawn live with dialNeedle().
// ang(v) maps a reading to an angle over 270 degrees, as the full-resolution dials did.
export function dialAngle(ch) {
  const [min, max] = ch.range;
  return v => Math.PI * 0.75 + ((Math.max(min, Math.min(max, v ?? min)) - min) / (max - min)) * Math.PI * 1.5;
}
export function dialFace(P, cx, cy, r, ch, face = 0xefe6cf, ink = 0x4a4236) {
  P.circ(cx, cy, r + 1, 0x151412);
  P.circ(cx, cy, r, face);
  for (let i = 0; i <= 10; i += r >= 9 ? 1 : 2) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    P.px(cx + Math.round((r - 0.5) * Math.cos(a)), cy + Math.round((r - 0.5) * Math.sin(a)), ink);
  }
}
export function dialNeedle(P, cx, cy, r, a, c = 0xb5302a) {
  P.line(cx, cy, cx + Math.round((r - 2) * Math.cos(a)), cy + Math.round((r - 2) * Math.sin(a)), c);
  P.px(cx, cy, 0x151412);
}

// A round lamp: bezel and lens; lit, a dithered glow round it.
export function pixelLamp(P, cx, cy, r, color, on) {
  if (on) P.glow(cx, cy, r + 4, r + 4, shade(color, 0.6), 0.9);
  P.circ(cx, cy, r + 1, 0x151412);
  P.circ(cx, cy, r, on ? color : shade(color, 0.3));
  P.px(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), on ? 0xffffff : shade(color, 0.45));
}

// A controller seen from behind at a desk, in pixels: shoulders, neck, head, the era hat now and then. x: middle;
// top: the top of the shoulders. p: g.people[id].
export function pixelBack(P, x, top, p) {
  const shirt = colorNum(p.color);
  const dark = shade(shirt, 0.78),
    darker = shade(shirt, 0.62);
  for (let j = 0; j < 22; j++) {
    const w = 11 + Math.min(j, 4);
    P.rect(x - w, top + j, 2 * w, 1, shirt);
    P.rect(x + w - 4, top + j, 4, 1, dark);
    if (j > 4) P.px(x - 5, top + j, darker);
  }
  P.px(x - 11, top, darker);
  P.px(x + 10, top, darker);
  P.rect(x - 2, top - 3, 4, 3, 0xc49a78);
  const hair = p.id === 'ellis' ? 0x6b4a32 : 0x3a2a1e;
  P.circ(x, top - 9, 7, hair);
  P.px(x - 3, top - 15, shade(hair, 1.5));
  P.px(x - 2, top - 16, shade(hair, 1.5));
  P.rect(x - 8, top - 9, 1, 3, 0xc49a78);
  P.rect(x + 8, top - 9, 1, 3, 0xc49a78);
  if (p.hat) {
    const hat = colorNum(p.hat);
    P.rect(x - 7, top - 17, 15, 4, hat);
    P.rect(x - 9, top - 13, 19, 1, shade(hat, 0.75));
  }
}

// A person standing, seen from the front, in pixels. x: middle; feet: the ground line. About 40 pixels tall.
export function pixelStanding(P, x, feet, p) {
  const coat = colorNum(p.color);
  P.rect(x - 8, feet, 17, 2, 0x1e1b16);
  P.rect(x - 6, feet - 13, 5, 13, 0x2b2620);
  P.rect(x + 1, feet - 13, 5, 13, 0x2b2620);
  P.rect(x - 8, feet - 30, 16, 18, coat);
  P.rect(x + 4, feet - 30, 4, 18, shade(coat, 0.8));
  P.rect(x - 10, feet - 29, 3, 13, shade(coat, 0.75));
  P.rect(x + 8, feet - 29, 3, 13, shade(coat, 0.75));
  P.rect(x - 1, feet - 32, 3, 2, 0xc49a78);
  P.circ(x, feet - 37, 5, 0xe2b993);
  const hair = p.id === 'ellis' ? 0x6b4a32 : 0x3a2c22;
  P.rect(x - 5, feet - 43, 11, 4, hair);
  P.px(x - 2, feet - 37, 0x2b2620);
  P.px(x + 2, feet - 37, 0x2b2620);
  if (p.hat) {
    const hat = colorNum(p.hat);
    P.rect(x - 5, feet - 45, 11, 3, hat);
    P.rect(x - 7, feet - 42, 15, 1, shade(hat, 0.75));
  }
}

export const colorNum = c => {
  if (typeof c === 'number') return c;
  const m = /^#([0-9a-f]{6})$/i.exec(c || '');
  if (m) return parseInt(m[1], 16);
  const s = /^#([0-9a-f]{3})$/i.exec(c || '');
  return s
    ? parseInt(
        s[1].replace(/./g, ch => ch + ch),
        16,
      )
    : 0x777777;
};
