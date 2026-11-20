// THE SITE SEEN FROM ABOVE (2D-HD rework, Aaron 20 November 2026): the camera no longer looks along the ground at a
// horizon in the middle of the screen, but down on the site at three-quarters, as in the references he chose. The sky
// shrinks to a band at the top; under it the far distance (the Atlantic and the beach at the Cape, the mountains at
// White Sands) goes soft, as the far end of a model does under a close lens; and from there down to the bottom of the
// screen the ground is a plane you look down on: scrub or desert, the roads, the fence, the poles and the pads further
// along the coast, hand-painted pixel by pixel. The buildings still stand along the same line (GROUND) and the player
// still walks left and right along it, so every click and walk lands where it did.
// The camera is not a perspective one: everything on the plane slides with the site at the same speed, as it would
// under a camera far away with a long lens. The painting covers the whole site, so nothing on it ever repeats.
// One art pixel is U site units (600 / 180).
import { BlurFilter, Container } from '../vendor/pixi.min.mjs';
import { pixelLayer, mix, shade } from './pixel.js';
import { VIEW_H, GROUND } from '../site/draw.js';
import { WORLD_W, PLACES } from '../data/white-sands.js';

export const U = VIEW_H / 180;
// Where the far distance meets the sky, and where the ground plane starts (site units).
export const HORIZON = 82;
export const PLANE_TOP = 44 * U; // art row 44
const X0 = -700; // the painting starts this far left of the site's 0 (site units), and runs past its right end
const WIDE = WORLD_W + 2400;
const AW = Math.ceil(WIDE / U);
const GROW = Math.round(GROUND / U); // 156: the art row the buildings stand on

// A fixed scatter: the same speckle every time.
const hash = (x, y, s = 0) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth value noise in 0..1, and a few octaves of it.
function noise(x, y, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    fx = x - xi,
    fy = y - yi;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s),
    b = hash(xi + 1, yi, s),
    c = hash(xi, yi + 1, s),
    d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, scale, s, oct = 3) => {
  let t = 0,
    amp = 1,
    tot = 0;
  for (let o = 0; o < oct; o++) {
    t += noise((x / scale) * 2 ** o, (y / scale) * 2 ** o, s + o * 17) * amp;
    tot += amp;
    amp *= 0.5;
  }
  return t / tot;
};
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const by = (x, y) => BAYER[y & 3][x & 3] / 16;
// One of a palette's colours for t in 0..1, banded with the ordered dither (no smooth blends inside the pixels).
function ramp(t, cols, x, y) {
  const v = Math.max(0, Math.min(0.9999, t)) * (cols.length - 1),
    k = Math.floor(v);
  return cols[v - k > by(x, y) ? Math.min(k + 1, cols.length - 1) : k];
}

// A raw painting surface: a Uint32 buffer we write pixel by pixel, then put on the layer's canvas in one go.
function surface(h) {
  const P = pixelLayer(AW, h);
  const img = P.ctx.createImageData(AW, h);
  const buf = new Uint32Array(img.data.buffer);
  const abgr = c => 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
  const S = {
    P,
    set(x, y, c) {
      x |= 0;
      y |= 0;
      if (x >= 0 && x < AW && y >= 0 && y < h) buf[y * AW + x] = abgr(c);
    },
    get(x, y) {
      const v = buf[(y | 0) * AW + (x | 0)];
      return ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff);
    },
    has: (x, y) => x >= 0 && x < AW && y >= 0 && y < h && buf[(y | 0) * AW + (x | 0)] >>> 24 > 0,
    rect(x, y, w, hh, c) {
      for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) S.set(x + i, y + j, c);
    },
    // Darkens what is already painted (a shadow or the damp under a bush).
    dim(x, y, k) {
      if (S.has(x, y)) S.set(x, y, shade(S.get(x, y), k));
    },
    done() {
      P.ctx.putImageData(img, 0, 0);
      P.commit();
      P.sprite.scale.set(U);
      P.sprite.position.set(X0, 0);
      return P.sprite;
    },
  };
  return S;
}

// ---- dressing, painted on the plane: lit from above and the left, a darker side and a dark foot ----
function palmetto(S, x, y, r, seed, cols) {
  const [dark, mid, lit] = cols;
  for (let j = -r - 1; j <= 1; j++)
    for (let i = -r - 2; i <= r + 2; i++) {
      const d = (i / (r + 1.5)) ** 2 + ((j + r * 0.4) / (r * 0.75 + 0.5)) ** 2;
      if (d > 1 || hash(x + i, y + j, seed) < 0.12 + d * 0.3) continue;
      S.set(x + i, y + j, i < 0 && j < -r * 0.3 ? lit : d < 0.5 ? mid : dark);
    }
  // spiky fan tips
  for (let k = 0; k < r + 2; k++) {
    const a = Math.PI * (1.1 + (0.8 * k) / (r + 1));
    S.set(x + Math.round(Math.cos(a) * (r + 2)), y - r * 0.4 + Math.round(Math.sin(a) * (r * 0.8 + 1)), lit);
  }
  for (let i = -r; i <= r; i++) S.dim(x + i, y + 1, 0.8);
}
function cabbagePalm(S, x, y, h, seed) {
  const lean = (hash(x, y, seed) - 0.5) * 0.25;
  for (let k = 0; k < h; k++) {
    const xx = Math.round(x + lean * k);
    S.set(xx, y - k, k % 3 ? 0x7a6448 : 0x94805e);
    S.set(xx + 1, y - k, 0x5a4834);
  }
  const cx = Math.round(x + lean * h),
    cy = y - h;
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2,
      ln = 4 + hash(a, x, seed) * 3;
    for (let t = 0; t <= 1; t += 0.12) {
      const px = cx + Math.cos(ang) * ln * t,
        py = cy + Math.sin(ang) * ln * t * 0.55 + t * t * 3;
      S.set(px, py, Math.cos(ang) < -0.2 && Math.sin(ang) < 0.3 ? 0x86a64e : t < 0.6 ? 0x4f7a30 : 0x3b5e26);
    }
  }
  for (let i = -2; i <= 3; i++) S.dim(x + i, y + 1, 0.78);
}
function creosote(S, x, y, r, seed) {
  palmetto(S, x, y, r, seed, [0x4f5a2c, 0x67723a, 0x8a8f52]);
}
function yucca(S, x, y, seed) {
  for (let k = 0; k < 4; k++) S.set(x, y - k, 0x6b6a3a);
  for (const [dx, dy] of [
    [-2, -5],
    [-1, -6],
    [0, -7],
    [1, -6],
    [2, -5],
    [-2, -3],
    [2, -3],
  ])
    S.set(x + dx, y + dy, hash(dx, dy, seed) < 0.5 ? 0x9aa15e : 0x7b8446);
  S.set(x, y - 8, 0xf2ecd2); // the flower spike
  S.dim(x - 1, y + 1, 0.8);
  S.dim(x + 1, y + 1, 0.8);
}
// A pad further along the coast: a little service tower and the blast apron, seen small and far.
function farPad(S, x, y, year, seed) {
  for (let i = -6; i <= 10; i++) for (let j = -2; j <= 1; j++) S.set(x + i, y + j, j < 0 ? 0xc9c3b4 : 0xa9a395);
  const h = 14 + Math.floor(hash(x, y, seed) * 6);
  const red = year >= 1958 ? 0xc0482c : 0x8a8f96,
    dark = year >= 1958 ? 0x7e2c1c : 0x5d6168;
  for (let k = 0; k < h; k++) {
    S.set(x, y - 2 - k, red);
    S.set(x + 3, y - 2 - k, dark);
    if (k % 3 === 0) {
      S.set(x + 1, y - 2 - k, red);
      S.set(x + 2, y - 2 - k, dark);
    }
  }
  S.rect(x - 1, y - 3 - h, 6, 1, red);
  // the rocket on it, a white stick
  if (hash(x, y, seed + 1) < 0.6) for (let k = 0; k < h - 3; k++) S.set(x - 2, y - 2 - k, k < 2 ? 0xd9d6cd : 0xf4f2ec);
}
function pole(S, x, y, h) {
  for (let k = 0; k < h; k++) S.set(x, y - k, 0x6d5a42);
  S.rect(x - 2, y - h, 5, 1, 0x5a4834);
  S.dim(x + 1, y + 1, 0.8);
}

// The far distance (the band under the sky): smooth and out of focus, drawn under the pixels.
export function paintedFar(cape) {
  const H = 46;
  const S = surface(H);
  for (let x = 0; x < AW; x++) {
    if (cape) {
      // The Atlantic: deeper at the horizon, glints, the surf line, the beach, then the dune scrub.
      for (let y = 24; y < 34; y++)
        S.set(x, y, ramp((y - 24) / 10 + fbm(x, y, 30, 5) * 0.3, [0x4a7c9f, 0x5b8db0, 0x6f9fbf], x, y));
      if (hash(x, 3, 9) < 0.06) S.set(x, 26 + Math.floor(hash(x, 4, 9) * 6), 0xcfe3ee);
      S.set(x, 34, x % 3 ? 0xe8e4d6 : 0xf6f3ea);
      for (let y = 35; y < 39; y++) S.set(x, y, ramp(fbm(x, y, 18, 6), [0xc8b68a, 0xd9c9a0, 0xe8dcb8], x, y));
      for (let y = 39; y < H; y++) S.set(x, y, ramp(fbm(x, y, 14, 7), [0x44582f, 0x56693a, 0x6f7b48], x, y));
    } else {
      // Three ranges of mountains behind the range, fading into the haze.
      const ridges = [
        [10, 0x8d86a0, 34],
        [20, 0xa3958a, 24],
        [30, 0xbaa182, 14],
      ];
      for (const [base, col, amp] of ridges) {
        const top = Math.round(base + amp * (0.5 - fbm(x, base, 40, base, 2)) * 1.6) + 4;
        for (let y = Math.max(0, top); y < H; y++) S.set(x, y, hash(x, y, base) < 0.06 ? shade(col, 0.92) : col);
        S.set(x, top, mix(col, 0xfff5e1, 0.25));
      }
      for (let y = 38; y < H; y++) S.set(x, y, ramp(fbm(x, y, 20, 8), [0xc9b088, 0xd6bf98, 0xe0cda8], x, y));
    }
  }
  const sprite = S.done();
  sprite.smooth = true; // drawn soft, under the pixel picture (pixelate.js)
  return sprite;
}

// The ground plane, from the far distance down to the bottom of the screen, with everything standing on it.
export function paintedPlane(cape, year) {
  const H = 182;
  const S = surface(H);
  const top = 44;
  const grass = [0x33452a, 0x3f5530, 0x4d6534, 0x5f763a, 0x788644, 0x97955a];
  const sand = [0xbc9d73, 0xc9ac80, 0xd3b88c, 0xdcc49a, 0xe5d2ac];
  const roadC = cape ? [0xbfae88, 0xd4c6a2, 0xe2d6b6] : [0xb59c78, 0xc8b08a, 0xd8c29c];
  for (let x = 0; x < AW; x++)
    for (let y = top; y < H; y++) {
      // Further away is a little hazier and paler (the air between), nearer is richer.
      const far = Math.max(0, 1 - (y - top) / 50);
      let c;
      if (cape) {
        const t = fbm(x, y * 1.5, 40, 1) * 0.75 + fbm(x, y, 7, 2, 2) * 0.3 - 0.06;
        c = ramp(t, grass, x, y);
        if (fbm(x, y * 1.6, 16, 21) > 0.7) c = fbm(x, y, 3, 22, 1) > 0.5 ? 0xbcae86 : 0xa89a72;
      } else {
        c = ramp(fbm(x, y, 26, 3) * 0.9 + fbm(x, y, 4, 4, 2) * 0.15, sand, x, y);
        if (fbm(x, y * 1.6, 14, 23) > 0.74) c = fbm(x, y, 3, 24, 1) > 0.5 ? 0xe6dcc6 : 0xddd1b8; // gypsum
      }
      if (far > 0) c = mix(c, cape ? 0xb4c4c0 : 0xe2d6c4, 0.35 * far * (0.6 + 0.4 * by(x, y)));
      S.set(x, y, c);
    }
  // Grass blades in clumps (Cape) or dry tufts (White Sands): a lit tip, a dark root.
  for (let n = 0; n < AW * 7; n++) {
    const x = Math.floor(hash(n, 1, 31) * AW),
      y = top + 4 + Math.floor(hash(n, 2, 31) * (H - top - 4));
    if (cape) {
      const c = S.get(x, y);
      if (c === 0xa89a72 || c === 0xbcae86 || c === 0xcfc29a) continue;
      const lit = mix(c, 0xd8e08a, 0.32);
      S.set(x - 1, y - 1, lit);
      S.set(x + 1, y - 1, shade(c, 1.1));
      S.set(x, y - 2, lit);
      S.set(x, y - 1, shade(c, 1.05));
      S.dim(x, y, 0.74);
      S.dim(x + 1, y, 0.74);
    } else if (n % 4 === 0) {
      S.set(x, y - 1, 0x9c9460);
      S.set(x, y, 0x8a8150);
      S.set(x + 1, y, 0x7d7448);
    }
  }
  // The back service road, and the road along the front of the site that the buildings stand on.
  const road = (y0, h) => {
    for (let x = 0; x < AW; x++)
      for (let y = y0; y < y0 + h; y++) {
        S.set(x, y, ramp(fbm(x, y, 12, 41), roadC, x, y));
        if ((y === y0 + 1 || y === y0 + h - 2) && hash(x >> 3, y, 42) < 0.7) S.set(x, y, shade(roadC[0], 0.9)); // ruts
      }
    for (let x = 0; x < AW; x++) {
      S.dim(x, y0 - 1, 0.86);
      S.dim(x, y0 + h, 0.8);
    }
  };
  road(60, 4);
  road(GROW - 1, 14); // the sand the site stands on, where people walk
  // A drainage ditch behind the site (the Cape) or a dry wash (White Sands), with its banks.
  for (let x = 0; x < AW; x++) {
    if (fbm(x, 0, 90, 55, 1) < 0.45) continue; // the ditch runs in stretches
    const y0 = 104 + Math.round(5 * Math.sin(x / 61) + 2 * Math.sin(x / 17));
    S.dim(x, y0 - 1, 0.8);
    for (let j = 0; j < 3; j++)
      S.set(
        x,
        y0 + j,
        cape
          ? hash(x, j, 51) < 0.05
            ? 0x9fb8bd
            : j
              ? 0x48615e
              : 0x5c7872
          : ramp(fbm(x, j, 8, 52), [0xc8b28c, 0xd9c6a2], x, j),
      );
    S.set(x, y0 + 3, cape ? 0x2f4a24 : 0xa88f6c);
    if (cape && hash(x, 5, 53) < 0.12) S.set(x, y0 - 2, 0x7f9a46); // reeds
  }
  // The pole line along the back road, and the wire between.
  for (let x = 20; x < AW; x += 46) pole(S, x, 59, 12);
  // Further along the coast, other pads (the Cape's Missile Row) or the range's other stands.
  if (cape && year >= 1956)
    for (let x = 60; x < AW; x += 150 + Math.floor(hash(x, 1, 61) * 90)) farPad(S, x, 56, year, 61);
  // The scrub and the trees, scattered, never on the roads or the ditch.
  const clear = (x, y) => (y >= 58 && y <= 66) || (y >= 101 && y <= 109) || y >= GROW - 13;
  for (let n = 0; n < AW * 0.55; n++) {
    const x = Math.floor(hash(n, 7, 71) * AW),
      y = top + 6 + Math.floor(hash(n, 8, 71) * (GROW - 12 - top - 6));
    if (clear(x, y) || fbm(x, y * 1.5, 50, 72, 2) < 0.42) continue; // in clumps, with open ground between
    const k = hash(n, 9, 71);
    if (cape) {
      if (k < 0.16) cabbagePalm(S, x, y, 9 + Math.floor(hash(n, 10, 71) * 9), n);
      else palmetto(S, x, y, 2 + Math.floor(k * 4), n, [0x2c4a22, 0x3f6a2c, 0x6f9a42]);
    } else if (k < 0.2) yucca(S, x, y, n);
    else creosote(S, x, y, 1 + Math.floor(k * 3), n);
  }
  // The fence behind the site: posts and wire.
  const fy = GROW - 12;
  for (let x = 0; x < AW; x++) {
    if (x % 9 === 0) {
      for (let k = 0; k < 5; k++) S.set(x, fy - k, 0x8a867c);
      S.dim(x + 1, fy + 1, 0.8);
    }
    if (x % 2 === 0) S.set(x, fy - 3, 0x9d9a90);
    S.set(x, fy - 1, 0x9d9a90);
  }
  // Below the front road: the near ground, a band of scrub that runs out of the bottom of the picture.
  for (let n = 0; n < AW * 0.12; n++) {
    const x = Math.floor(hash(n, 11, 81) * AW),
      y = GROW + 17 + Math.floor(hash(n, 12, 81) * (H - GROW - 17));
    if (cape) palmetto(S, x, y, 2 + Math.floor(hash(n, 13, 81) * 3), n + 900, [0x2c4a22, 0x3f6a2c, 0x6f9a42]);
    else creosote(S, x, y, 1 + Math.floor(hash(n, 13, 81) * 3), n + 900);
  }
  // Each building and the tower sits in its own clearing of packed sand.
  for (const p of Object.values(PLACES)) {
    const x0 = Math.floor((p.x - X0) / U) - 3,
      x1 = Math.ceil((p.x + p.w - X0) / U) + 3;
    for (let x = x0; x <= x1; x++)
      for (let y = GROW - 14; y < GROW - 5; y++)
        if (y > GROW - 9 || by(x, y) < (y - (GROW - 14)) / 6) S.set(x, y, ramp(fbm(x, y, 10, 91), roadC, x, y));
  }
  return S.done();
}

// The near edge: big leaves and fronds at the bottom of the screen, out of focus because they are close to the lens.
// Painted in pixels, shown over everything (crisp) behind a blur, in site units like the world.
export function nearFringe(cape) {
  const H = 40;
  const S = surface(H);
  for (let n = 0; n < AW / 26; n++) {
    const cx = Math.floor(hash(n, 1, 101) * AW),
      cy = H + 2 + Math.floor(hash(n, 2, 101) * 6);
    const leaves = cape ? 9 : 6;
    for (let a = 0; a < leaves; a++) {
      const ang = Math.PI * (1.08 + (0.84 * a) / (leaves - 1)),
        ln = (cape ? 18 : 10) + hash(n, a, 102) * (cape ? 16 : 8);
      for (let t = 0; t <= 1; t += 0.03)
        for (let w = -1; w <= 1; w++) {
          const px = cx + Math.cos(ang) * ln * t + w * Math.sin(ang),
            py = cy + Math.sin(ang) * ln * t;
          S.set(
            px,
            py,
            cape ? (w < 0 ? 0x5a8a3c : w ? 0x22401a : 0x3d6a2a) : w < 0 ? 0x8a8f52 : w ? 0x4a5226 : 0x67723a,
          );
        }
    }
  }
  const sprite = S.done();
  sprite.position.y = VIEW_H - H * U + 4 * U;
  const box = new Container();
  box.addChild(sprite);
  box.crisp = true;
  box.filters = [new BlurFilter({ strength: 4, quality: 3 })];
  box.sprite = sprite;
  return box;
}
