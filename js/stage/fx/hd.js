// 2D-HD LIGHT (v0.8 pixel art pass, step two): smooth light laid over the pixel art, as in the 2D-HD mockups Aaron
// asked to try on 15 November 2026 (mockups/2d-hd). The pixels stay crisp; only the light is soft.
// Two layers go over a scene's pixel layers and under its full-resolution type, so a reading is never dimmed or blurred:
// - the light map, multiplied over the picture: a dim ambient fill with pools of light where the lamps are, and the
//   corners falling away into shadow;
// - the glow, added over it: the halo round a bulb or a lit lamp (a fake bloom, placed by the scene, so it never blooms
//   a reading by accident), the beams through dusty air under a light, and the dust drifting in them.
// Both are small canvases drawn with ordinary 2D gradients and shown with smooth (linear) scaling.
// Nothing pulses or flashes (photosensitivity, fx/calm.js); the dust only drifts. The dev menu can switch it off
// (localStorage 'pa-hd' = 'off').
import { Container, Sprite, Texture } from '../../vendor/pixi.min.mjs';
import { PX, css } from '../pixel.js';

export const HD_KEY = 'pa-hd';
export const hdWanted = () => {
  try {
    return localStorage.getItem(HD_KEY) !== 'off';
  } catch {
    return true;
  }
};

const rgba = (c, a) => {
  const n = typeof c === 'number' ? c : parseInt(String(c).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
};

// A canvas shown as a smooth sprite over art-pixel coordinates, res canvas pixels to an art pixel.
function surface(w, h, mx, my, res, blendMode) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((w + 2 * mx) * res);
  cv.height = Math.ceil((h + 2 * my) * res);
  const ctx = cv.getContext('2d');
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'linear';
  const sprite = new Sprite(tex);
  sprite.scale.set(PX / res);
  sprite.position.set(-mx * PX, -my * PX);
  sprite.blendMode = blendMode;
  // Art-pixel coordinates from here on.
  const reset = () => ctx.setTransform(res, 0, 0, res, mx * res, my * res);
  reset();
  return { cv, ctx, tex, sprite, reset, all: [-mx, -my, w + 2 * mx, h + 2 * my] };
}

// A soft round (or, with ry, oval) spot of colour c at strength k, falling to nothing at the edge.
function spot(ctx, x, y, rx, ry, c, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(c, k));
  g.addColorStop(0.35, rgba(c, k * 0.55));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
  ctx.restore();
}

// A beam: from a source (x, y) of width w0 down (or along) to a footprint of width w1 at distance len, at angle lean
// (0 = straight down), brightest at the source.
function beamPath(ctx, x, y, w0, w1, len, lean) {
  const dx = Math.sin(lean) * len,
    dy = Math.cos(lean) * len;
  ctx.beginPath();
  ctx.moveTo(x - w0 / 2, y);
  ctx.lineTo(x + w0 / 2, y);
  ctx.lineTo(x + dx + w1 / 2, y + dy);
  ctx.lineTo(x + dx - w1 / 2, y + dy);
  ctx.closePath();
}

// A light layer for a scene w x h art pixels with a margin mx, my (as its pixel layers have).
export function hdLayer(w = 320, h = 180, { mx = 0, my = 0 } = {}) {
  const root = new Container();
  root.label = 'hd-light';
  const light = surface(w, h, mx, my, 0.5, 'multiply'),
    glow = surface(w, h, mx, my, 1, 'add');
  root.addChild(light.sprite, glow.sprite);
  const L = light.ctx,
    G = glow.ctx;
  const H = {
    root,
    // Starts a frame: the light map filled with the ambient colour, the glow cleared.
    begin(ambient) {
      L.globalCompositeOperation = 'source-over';
      L.fillStyle = css(ambient);
      L.fillRect(...light.all);
      L.globalCompositeOperation = 'lighter';
      G.clearRect(...glow.all);
      G.globalCompositeOperation = 'lighter';
    },
    // A pool of light on the light map (how much of the picture's own colour shows there).
    light(x, y, rx, ry, c, k = 1) {
      spot(L, x, y, rx, ry ?? rx, c, k);
    },
    // A soft beam of light on the light map, for where a beam lands and lights the floor.
    lightBeam(x, y, w0, w1, len, lean, c, k = 1) {
      const g = L.createLinearGradient(x, y, x + Math.sin(lean) * len, y + Math.cos(lean) * len);
      g.addColorStop(0, rgba(c, k));
      g.addColorStop(1, rgba(c, k * 0.25));
      L.fillStyle = g;
      beamPath(L, x, y, w0, w1, len, lean);
      L.fill();
    },
    // Darkens toward the edges of the art (k = how dark the corners go, 0 to 1). Drawn last on the light map.
    vignette(k, cx = w / 2, cy = h / 2) {
      L.globalCompositeOperation = 'multiply';
      const r = Math.hypot(w / 2 + mx, h / 2 + my);
      const g = L.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      const v = Math.round(255 * (1 - k));
      g.addColorStop(1, `rgb(${v},${v},${v})`);
      L.fillStyle = g;
      L.fillRect(...light.all);
      L.globalCompositeOperation = 'lighter';
    },
    // A halo added over the picture: the bloom round something bright.
    glow(x, y, rx, c, k = 0.5, ry) {
      spot(G, x, y, rx, ry ?? rx, c, k);
    },
    // A visible beam through dusty air, fading from the source.
    beam(x, y, w0, w1, len, lean, c, k = 0.15) {
      const g = G.createLinearGradient(x, y, x + Math.sin(lean) * len, y + Math.cos(lean) * len);
      g.addColorStop(0, rgba(c, k));
      g.addColorStop(0.6, rgba(c, k * 0.45));
      g.addColorStop(1, rgba(c, 0));
      G.fillStyle = g;
      beamPath(G, x, y, w0, w1, len, lean);
      G.fill();
    },
    // Dust drifting in a beam: n motes, slow, each seeded so they stay put from frame to frame. t is in seconds.
    motes(x, y, w0, w1, len, lean, c, n, t, k = 0.5) {
      G.fillStyle = css(c);
      for (let i = 0; i < n; i++) {
        const a = Math.sin(i * 12.9898 + x) * 43758.5453,
          b = Math.sin(i * 78.233 + y) * 12345.6789;
        const fa = a - Math.floor(a),
          fb = b - Math.floor(b);
        const along = (fa + t * (0.004 + 0.006 * fb)) % 1; // sinking slowly
        const across = fb - 0.5 + 0.08 * Math.sin(t * 0.4 + i);
        const wide = w0 + (w1 - w0) * along;
        const px = x + Math.sin(lean) * len * along + across * wide * 0.9,
          py = y + Math.cos(lean) * len * along;
        G.globalAlpha = k * (0.4 + 0.6 * fb) * Math.sin(Math.PI * along);
        G.fillRect(px, py, 0.6, 0.6);
      }
      G.globalAlpha = 1;
    },
    // Sends both to the graphics card.
    commit() {
      light.tex.source.update();
      glow.tex.source.update();
    },
    destroy() {
      root.destroy({ children: true, texture: true, textureSource: true });
    },
  };
  return H;
}
