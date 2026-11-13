// THE SITE'S BUILDINGS AND DRESSING, drawn in PixiJS (v0.8), in the style of the walk-in rooms: flat colour, light
// from the left with a darker right-hand face and a short shadow along the sand, and each building cut away to show
// the room you walk into, lit the way that room's scene is lit. Everything here stands still, so it is built once into
// a container (in world units) and rebuilt only when the site changes: the move to the Cape, the crewed years, the new
// blockhouse going up, or the era turning over. The same geometry as the old drawing (PLACES, NEW_BLOCKHOUSE,
// TRAINER), so every click and walk lands where it did.
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import {
  PLACES,
  GROUND,
  WORLD_W,
  VIEW_H,
  NEW_BLOCKHOUSE,
  TRAINER,
  newBlockhouseStands,
  footprint,
} from '../data/white-sands.js';
import { blockhouseState, SITES } from '../data/campaign.js';
import { eraOf } from '../site/draw.js';
import { label, puffTexture, gradientTexture } from './kit.js';

export const SIGN_X = 2930;
const W = WORLD_W + 800;

// What the static site depends on: rebuild when any of it changes.
export const siteKey = g => {
  const bs = blockhouseState(g.day);
  return `${g.site || 'white-sands'}|${g.crewed ? 'crewed' : 'uncrewed'}|${newBlockhouseStands(g) ? 'built' : bs.progress.toFixed(2)}|${eraOf(g)}`;
};

// ---- small helpers ----
const shade = (gr, x, y, w, h, k = 0.1, a = 0.18) =>
  gr.rect(x + w - Math.max(2, w * k), y, Math.max(2, w * k), h).fill({ color: 0x281e14, alpha: a });
function vgrad(stops, x, y, w, h) {
  const s = new Sprite(gradientTexture(stops));
  s.position.set(x, y);
  s.width = w;
  s.height = h;
  s.ownTex = true;
  return s;
}
function glowAt(x, y, w, h, tint, alpha) {
  const s = new Sprite(puffTexture());
  s.anchor.set(0.5);
  s.position.set(x, y);
  s.width = w;
  s.height = h;
  s.tint = tint;
  s.alpha = alpha;
  s.blendMode = 'add';
  return s;
}
// A hanging lamp and the cone of light it throws on the floor below.
function lampCone(gr, x, top, floor, spread, color = 0xf3dd8a, alpha = 0.1) {
  gr.rect(x - 0.5, top - 10, 1, 10).fill(0x222222);
  gr.poly([x - 5, top + 4, x - 3, top, x + 3, top, x + 5, top + 4]).fill(color);
  gr.poly([x - 5, top + 4, x - spread, floor, x + spread, floor, x + 5, top + 4]).fill({ color, alpha });
}
const worldText = (text, size, color, opts = {}) => {
  const t = label(text, size, color, opts);
  t.resolution = 6; // world text is scaled up with the site, so it is rasterised finer
  return t;
};

// ---- the ground: road, ruts, stones, scrub, and the aprons under the buildings ----
function ground(gr, g) {
  const cape = g.site === 'cape';
  for (let x = 12; x < W; x += 23) {
    const y = GROUND + 6 + ((x * 13) % (VIEW_H - GROUND - 8)),
      len = 8 + ((x * 7) % 27);
    gr.rect(x, y, len, 1).fill({ color: cape ? 0x70664a : 0x6d4e2d, alpha: 0.13 });
    gr.rect(x + 2, y - 1, len - 3, 1).fill({ color: 0xfff7dd, alpha: 0.2 });
  }
  for (let x = 60; x < W; x += 173)
    gr.circle(x + ((x * 13) % 44), GROUND + 16 + ((x * 7) % 40), 1.6 + (x % 3)).fill({ color: 0x78644a, alpha: 0.3 });
  for (let x = 110; x < W; x += 240)
    gr.rect(x, GROUND + 8 + ((x * 3) % 44), 26 + (x % 20), 3).fill({ color: 0xfff4d6, alpha: 0.25 });
  // The road out to the range, with its wheel ruts.
  gr.rect(0, GROUND + 30, W, 8).fill(cape ? 0xc9bf9c : 0xc3a87c);
  gr.rect(0, GROUND + 32, W, 1).fill({ color: 0x78644a, alpha: 0.25 });
  gr.rect(0, GROUND + 35, W, 1).fill({ color: 0x78644a, alpha: 0.25 });
  gr.rect(0, GROUND + 30, W, 1).fill({ color: 0xfbe8bd, alpha: 0.32 });
  // Each apron runs under the building as it stands that day.
  for (const p of ['office', 'hangar', 'blockhouse', 'tower'].map(id => footprint(id, g))) {
    const left = p.x - 12,
      width = p.w + 24;
    gr.poly([left + 8, GROUND, left + width - 8, GROUND, left + width, GROUND + 22, left, GROUND + 22]).fill(
      cape ? 0xb5ad99 : 0xb9a17c,
    );
    gr.rect(left, GROUND + 22, width, 2).fill({ color: 0x493d30, alpha: 0.24 });
    if (cape) {
      for (let j = left + 36; j < left + width - 10; j += 46)
        gr.rect(j, GROUND + 2, 1, 20).fill({ color: 0x493d30, alpha: 0.2 });
      gr.rect(p.door - 15, GROUND + 17, 30, 2).fill({ color: 0xffebb0, alpha: 0.55 });
    } else {
      gr.rect(p.door - 17, GROUND + 3, 3, 27).fill({ color: 0x493d30, alpha: 0.18 });
      gr.rect(p.door + 12, GROUND + 7, 3, 23).fill({ color: 0x493d30, alpha: 0.18 });
    }
  }
}

// ---- the dressing: telephone line, water, range stations, fence, sign, plants ----
function telephoneLine(gr, xs) {
  const top = GROUND - 96;
  for (let i = 0; i < xs.length - 1; i++)
    for (const dx of [-11, 11]) {
      const a = xs[i] + dx,
        b = xs[i + 1] + dx,
        sag = Math.min(18, (b - a) / 30);
      gr.moveTo(a, top + 2).quadraticCurveTo((a + b) / 2, top + 2 + sag * 2, b, top + 2);
    }
  gr.stroke({ width: 0.8, color: 0x282420, alpha: 0.55 });
  for (const x of xs) {
    gr.rect(x - 2, top - 4, 4, GROUND - top + 4).fill(0x6b5236);
    gr.rect(x + 1, top - 4, 1, GROUND - top + 4).fill({ color: 0x1e160e, alpha: 0.25 });
    gr.rect(x - 15, top, 30, 3).fill(0x5a4430);
    for (const dx of [-11, -5, 5, 11]) gr.rect(x + dx - 1, top - 3, 2, 3).fill(0x9fb6a8);
  }
}
function waterTank(gr, x) {
  const legs = GROUND - 70;
  gr.moveTo(x + 4, GROUND)
    .lineTo(x + 10, legs)
    .moveTo(x + 44, GROUND)
    .lineTo(x + 38, legs)
    .stroke({ width: 3, color: 0x6e5a42 });
  for (const y of [GROUND - 22, GROUND - 46]) gr.moveTo(x + 6, y).lineTo(x + 42, y);
  gr.moveTo(x + 6, GROUND - 22)
    .lineTo(x + 40, GROUND - 46)
    .moveTo(x + 42, GROUND - 22)
    .lineTo(x + 8, GROUND - 46);
  gr.stroke({ width: 1.2, color: 0x6e5a42 });
  gr.rect(x, legs - 40, 48, 40).fill(0x8a6d4c);
  gr.rect(x + 40, legs - 40, 8, 40).fill({ color: 0x281c10, alpha: 0.25 });
  gr.rect(x, legs - 40, 3, 40).fill({ color: 0xffeccc, alpha: 0.12 });
  for (const y of [legs - 32, legs - 18, legs - 6]) gr.rect(x, y, 48, 1.5).fill(0x3e3a36);
  gr.poly([x - 3, legs - 40, x + 24, legs - 54, x + 51, legs - 40]).fill(0x6e5a42);
  gr.rect(x + 22, legs, 3, GROUND - legs).fill(0x5a5f66);
}
function steelWaterTower(gr, x) {
  const top = GROUND - 92;
  gr.moveTo(x + 6, GROUND)
    .lineTo(x + 14, top + 26)
    .moveTo(x + 42, GROUND)
    .lineTo(x + 34, top + 26)
    .stroke({ width: 3, color: 0x8b9196 });
  gr.moveTo(x + 8, GROUND - 20)
    .lineTo(x + 40, GROUND - 20)
    .moveTo(x + 11, GROUND - 46)
    .lineTo(x + 37, GROUND - 46);
  gr.moveTo(x + 8, GROUND - 20)
    .lineTo(x + 37, GROUND - 46)
    .moveTo(x + 40, GROUND - 20)
    .lineTo(x + 11, GROUND - 46);
  gr.stroke({ width: 1.2, color: 0x8b9196 });
  gr.ellipse(x + 24, top + 14, 26, 18).fill(0xe9e7e1);
  gr.ellipse(x + 32, top + 16, 15, 15).fill({ color: 0x000000, alpha: 0.08 });
  gr.rect(x + 1, top + 10, 46, 5).fill(0xb8473a);
  gr.rect(x + 22, top - 8, 4, 6).fill(0x8b9196);
}
function theodoliteHut(gr, x) {
  gr.rect(x, GROUND - 38, 44, 38).fill(0xb8ad98);
  shade(gr, x, GROUND - 38, 44, 38, 0.15);
  gr.moveTo(x + 4, GROUND - 38)
    .arc(x + 22, GROUND - 38, 18, Math.PI, 0)
    .fill(0x9c917c);
  gr.rect(x + 19, GROUND - 56, 6, 18).fill(0x2c2a27);
  gr.rect(x + 6, GROUND - 22, 9, 22).fill(0x5a4630);
  for (let i = 0; i < 6; i++) gr.rect(x - 10 + i * 11 + (i > 2 ? 22 : 0), GROUND - 6, 10, 6).fill(0xb3a380);
  for (let i = 0; i < 5; i++) gr.rect(x - 5 + i * 11 + (i > 1 ? 22 : 0), GROUND - 11, 10, 5).fill(0xa69674);
}
function trackingCamera(gr, x) {
  gr.rect(x - 6, GROUND - 6, 60, 6).fill(0xc9c4b6);
  gr.rect(x + 18, GROUND - 34, 10, 28).fill(0x6c7177);
  gr.rect(x + 12, GROUND - 40, 22, 8).fill(0x4b4f55);
  const c = Math.cos(-0.5),
    s = Math.sin(-0.5),
    r = (px, py) => [x + 23 + px * c - py * s, GROUND - 44 + px * s + py * c];
  gr.poly([...r(-6, -8), ...r(34, -8), ...r(34, 4), ...r(-6, 4)]).fill(0x2f3338);
  gr.poly([...r(32, -9), ...r(38, -9), ...r(38, 5), ...r(32, 5)]).fill(0x1b1e22);
  gr.rect(x + 36, GROUND - 26, 18, 20).fill(0xd9d4c6);
  shade(gr, x + 36, GROUND - 26, 18, 20, 0.15);
}
function dish(gr, cx, cy, rx, deep, angle, face, back) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    const px = Math.cos(a) * rx,
      py = Math.sin(a) * deep;
    pts.push(cx + px * c - py * s, cy + px * s + py * c);
  }
  gr.poly(pts).fill(face);
  gr.moveTo(cx - rx * c, cy - rx * s)
    .lineTo(cx + rx * c, cy + rx * s)
    .stroke({ width: 3, color: back });
  const fx = cx + 0 * c - -deep * 2 * s,
    fy = cy + 0 * s + -deep * 2 * c;
  gr.moveTo(cx - rx * 0.6 * c, cy - rx * 0.6 * s)
    .lineTo(fx, fy)
    .lineTo(cx + rx * 0.6 * c, cy + rx * 0.6 * s)
    .stroke({ width: 1.2, color: 0x6d726f });
}
function fixedRadar(gr, x) {
  gr.rect(x + 20, GROUND - 40, 36, 40).fill(0xb9b5ab);
  shade(gr, x + 20, GROUND - 40, 36, 40, 0.15);
  gr.rect(x + 34, GROUND - 52, 8, 12).fill(0x4a4f55);
  dish(gr, x + 38, GROUND - 62, 30, 11, -0.45, 0xd7dad6, 0xaeb3af);
}
function radarTrailer(gr, x) {
  gr.rect(x, GROUND - 30, 70, 20).fill(0x5c6648);
  gr.rect(x, GROUND - 14, 70, 4).fill({ color: 0x000000, alpha: 0.18 });
  for (const wx of [x + 14, x + 26])
    gr.circle(wx, GROUND - 6, 6)
      .fill(0x1e1e1e)
      .circle(wx, GROUND - 6, 2.5)
      .fill(0x7a7a7a);
  gr.moveTo(x + 64, GROUND - 12)
    .lineTo(x + 66, GROUND)
    .stroke({ width: 2, color: 0x4e5458 });
  gr.rect(x + 40, GROUND - 44, 8, 14).fill(0x4a5240);
  dish(gr, x + 44, GROUND - 50, 22, 8, -0.5, 0xc9cdc8, 0xa5aaa6);
  gr.moveTo(x + 70, GROUND - 18)
    .quadraticCurveTo(x + 90, GROUND + 2, x + 110, GROUND - 1)
    .stroke({ width: 1, color: 0x3a3a3a });
}
function radome(gr, x) {
  gr.rect(x + 12, GROUND - 30, 52, 30).fill(0xb9b5ab);
  shade(gr, x + 12, GROUND - 30, 52, 30, 0.15);
  gr.moveTo(x + 38 + 28 * Math.cos(Math.PI * 0.85), GROUND - 52 + 28 * Math.sin(Math.PI * 0.85))
    .arc(x + 38, GROUND - 52, 28, Math.PI * 0.85, Math.PI * 2.15)
    .fill(0xf1f0eb);
  for (const k of [-0.5, 0, 0.5])
    gr.ellipse(x + 38, GROUND - 52, Math.abs(k) * 28 + 4, 28).stroke({ width: 1, color: 0x787d82, alpha: 0.3 });
  gr.ellipse(x + 46, GROUND - 50, 16, 22).fill({ color: 0x000000, alpha: 0.06 });
}
function fence(gr, x0, x1) {
  for (let x = x0; x < x1; x += 34) gr.rect(x - 1, GROUND - 22, 2, 22).fill(0x6e604c);
  for (const y of [GROUND - 20, GROUND - 13, GROUND - 6])
    gr.rect(x0, y, x1 - x0, 0.7).fill({ color: 0x464038, alpha: 0.6 });
}
function boundarySign(gr, layer, x, g) {
  gr.rect(x + 6, GROUND - 46, 4, 46)
    .fill(0x5a4630)
    .rect(x + 104, GROUND - 46, 4, 46)
    .fill(0x5a4630);
  gr.rect(x, GROUND - 62, 114, 30)
    .fill(0xe9e0c8)
    .rect(x + 2, GROUND - 60, 110, 26)
    .stroke({ width: 2, color: 0x8a3a2a });
  const name = worldText(SITES[g.site || 'white-sands'].name.toUpperCase(), 7, 0x2e2a24, {
    family: 'Arial, sans-serif',
    bold: true,
  });
  name.position.set(x + 57, GROUND - 51);
  if (name.width > 104) name.scale.set(104 / name.width);
  const keep = worldText('RESTRICTED AREA · KEEP OUT', 6, 0x8a3a2a, { family: 'Arial, sans-serif', bold: true });
  keep.position.set(x + 57, GROUND - 41);
  if (keep.width > 104) keep.scale.set(104 / keep.width);
  layer.addChild(name, keep);
}
function yucca(gr, x, y) {
  for (let a = -2.6; a <= -0.5; a += 0.3) gr.moveTo(x, y - 2).lineTo(x + Math.cos(a) * 10, y - 2 + Math.sin(a) * 10);
  gr.stroke({ width: 1.4, color: 0x6f7d48 });
  gr.moveTo(x, y - 4)
    .lineTo(x + 1, y - 24)
    .stroke({ width: 1, color: 0x8c7a54 });
  gr.rect(x - 1, y - 26, 4, 6).fill(0xefe6c4);
}
function creosote(gr, x, y, r) {
  gr.ellipse(x + r * 0.4, y, r * 1.1, r * 0.22).fill({ color: 0x46341e, alpha: 0.18 });
  gr.circle(x - r * 0.35, y - r * 0.4, r * 0.55).fill(0x7d8a4e);
  gr.circle(x + r * 0.3, y - r * 0.55, r * 0.6).fill(0x7d8a4e);
  gr.circle(x, y - r * 0.8, r * 0.5).fill(0x7d8a4e);
  gr.circle(x - r * 0.45, y - r * 0.7, r * 0.3).fill({ color: 0xfffadc, alpha: 0.18 });
}
function seaOats(gr, x, y, k = 1) {
  for (let i = -3; i <= 3; i++) gr.moveTo(x + i, y).quadraticCurveTo(x + i * 2, y - 8 * k, x + i * 3 + 2, y - 14 * k);
  gr.stroke({ width: 1, color: 0xa49a62 });
  for (let i = -1; i <= 1; i++) gr.rect(x + i * 3 + 2, y - 16 * k, 2, 3 * k).fill(0xc4b47a);
}

function dressing(gr, layer, g) {
  const cape = g.site === 'cape',
    era = eraOf(g);
  if (cape) steelWaterTower(gr, 22);
  else waterTank(gr, 22);
  if (era !== 'shuttle') telephoneLine(gr, [-30, 95, 404, 990, 1440, 1736]);
  if (era === 'early' || era === 'space') theodoliteHut(gr, 2290);
  else trackingCamera(gr, 2290);
  if (era === 'early') radarTrailer(gr, 2560);
  else if (era === 'shuttle') radome(gr, 2560);
  else fixedRadar(gr, 2560);
  boundarySign(gr, layer, SIGN_X, g);
  fence(gr, 2860, W);
  for (let x = 30; x < W - 20; x += 131) {
    const px = x + ((x * 17) % 60),
      near = Object.values(PLACES).some(p => px > p.x - 30 && px < p.x + p.w + 30);
    if (near) continue;
    if (cape) seaOats(gr, px, GROUND + 2);
    else if ((x / 131) % 3 < 1) yucca(gr, px, GROUND + 1);
    else creosote(gr, px, GROUND + 2, 7 + (x % 5));
  }
}
// Nearer the camera, below the road: bigger bushes, partly cut off by the bottom of the view.
function nearPlants(gr, g) {
  const cape = g.site === 'cape';
  for (let x = 140; x < W - 20; x += 377)
    if (cape) seaOats(gr, x + ((x * 7) % 90), GROUND + 70, 1.6);
    else creosote(gr, x + ((x * 7) % 90), GROUND + 74, 16 + (x % 7));
}

// ---- the clutter of a working range: what stands about between the buildings ----
// Oil drums, standing and one on its side.
function drums(gr, x) {
  for (const [dx, col] of [
    [0, 0x5d6b3e],
    [11, 0x8a3a2a],
    [22, 0x5d6b3e],
  ]) {
    gr.rect(x + dx, GROUND - 14, 10, 14).fill(col);
    gr.rect(x + dx + 7, GROUND - 14, 3, 14).fill({ color: 0x000000, alpha: 0.18 });
    for (const y of [GROUND - 10, GROUND - 4]) gr.rect(x + dx, y, 10, 1).fill({ color: 0x000000, alpha: 0.3 });
    gr.ellipse(x + dx + 5, GROUND - 14, 5, 1.5).fill({ color: 0xffffff, alpha: 0.15 });
  }
  gr.rect(x + 34, GROUND - 9, 14, 9).fill(0x5d6b3e);
  gr.ellipse(x + 48, GROUND - 4.5, 2, 4.5).fill(0x4a5631);
}
// Crates stacked by a door, stencilled.
function crates(gr, x) {
  for (const [dx, dy, w, h] of [
    [0, 0, 22, 16],
    [24, 0, 18, 13],
    [5, 16, 16, 12],
  ]) {
    gr.rect(x + dx, GROUND - dy - h, w, h).fill(0x9a7c52);
    gr.rect(x + dx, GROUND - dy - h, w, h).stroke({ width: 1, color: 0x6e5636 });
    gr.moveTo(x + dx, GROUND - dy - h)
      .lineTo(x + dx + w, GROUND - dy)
      .stroke({ width: 0.8, color: 0x6e5636 });
    gr.rect(x + dx + w - 4, GROUND - dy - h, 4, h).fill({ color: 0x000000, alpha: 0.12 });
  }
}
// A floodlight mast: a lattice pole, a cross-arm with three lamps that light the pad at dusk.
function floodMast(gr, x, lights) {
  const top = GROUND - 150;
  gr.moveTo(x - 4, GROUND)
    .lineTo(x - 1, top)
    .moveTo(x + 4, GROUND)
    .lineTo(x + 1, top)
    .stroke({ width: 1.6, color: 0x5d636b });
  for (let y = GROUND - 10; y > top; y -= 10)
    gr.moveTo(x - 4 + (GROUND - y) * 0.02, y).lineTo(x + 4 - (GROUND - y) * 0.02, y - 10);
  gr.stroke({ width: 0.8, color: 0x5d636b });
  gr.rect(x - 12, top - 2, 24, 3).fill(0x4b5056);
  for (const dx of [-9, 0, 9]) {
    gr.rect(x + dx - 3, top - 8, 6, 6).fill(0x2e3236);
    gr.rect(x + dx - 2, top - 4, 4, 2).fill(0xf6e7b0);
    lights.push([x + dx, top - 2, 34, 26, 0xfff0c0, 0.35]);
  }
  // The pool the lamps throw on the pad below them.
  lights.push([x, GROUND - 4, 110, 22, 0xfff0c0, 0.22]);
}
// The liquid-oxygen trailer: a long insulated tank on wheels, its vent, the frost on its belly.
function loxTrailer(gr, x, g) {
  const col = eraOf(g) === 'early' ? 0x7d8466 : 0xd8d8d2;
  gr.roundRect(x, GROUND - 30, 70, 20, 9).fill(col);
  gr.roundRect(x, GROUND - 30, 70, 20, 9).stroke({ width: 0.8, color: 0x3c3f42, alpha: 0.6 });
  gr.rect(x + 6, GROUND - 16, 58, 5).fill({ color: 0xffffff, alpha: 0.35 }); // frost
  gr.rect(x + 4, GROUND - 26, 62, 2).fill({ color: 0xffffff, alpha: 0.25 });
  gr.rect(x + 56, GROUND - 38, 3, 8).fill(0x6b7176);
  gr.rect(x + 2, GROUND - 12, 70, 3).fill(0x3c3f42);
  for (const wx of [x + 14, x + 52])
    gr.circle(wx, GROUND - 5, 5)
      .fill(0x1e1e1e)
      .circle(wx, GROUND - 5, 2)
      .fill(0x7a7a7a);
  gr.moveTo(x + 72, GROUND - 10)
    .lineTo(x + 84, GROUND - 3)
    .stroke({ width: 2, color: 0x3c3f42 });
  gr.ellipse(x + 30, GROUND - 4, 26, 2).fill({ color: 0xffffff, alpha: 0.2 }); // boil-off haze
}
// A generator cart with its exhaust stack, cabled toward the tower.
function generator(gr, x) {
  gr.rect(x, GROUND - 22, 36, 14).fill(0x8a7a3a);
  gr.rect(x + 28, GROUND - 22, 8, 14).fill({ color: 0x000000, alpha: 0.15 });
  for (let i = 0; i < 4; i++) gr.rect(x + 4 + i * 5, GROUND - 19, 2, 8).fill(0x5e522a);
  gr.rect(x + 30, GROUND - 30, 3, 8).fill(0x3c3f42);
  gr.rect(x - 2, GROUND - 8, 40, 3).fill(0x3c3f42);
  for (const wx of [x + 6, x + 30]) gr.circle(wx, GROUND - 3, 3.5).fill(0x1e1e1e);
  gr.moveTo(x, GROUND - 6)
    .quadraticCurveTo(x - 30, GROUND + 4, x - 60, GROUND)
    .stroke({ width: 1, color: 0x2a2a2a });
}
// A parked staff car: a jeep in the early years, a sedan later, a station wagon in the Shuttle years.
function car(gr, x, g) {
  const era = eraOf(g);
  if (era === 'early') {
    gr.rect(x, GROUND - 16, 44, 9).fill(0x56653f);
    gr.rect(x + 14, GROUND - 24, 2, 8).fill(0x3c4630);
    gr.rect(x + 8, GROUND - 19, 12, 3).fill(0x3c4630); // the folded screen
    gr.rect(x + 36, GROUND - 16, 8, 9).fill({ color: 0x000000, alpha: 0.15 });
    gr.circle(x + 30, GROUND - 13, 3).fill({ color: 0xe8e0c8, alpha: 0.9 }); // the white star
  } else {
    const body = era === 'shuttle' ? 0x8a3a2a : era === 'apollo' ? 0x2f5a7a : 0x3e4652;
    gr.roundRect(x, GROUND - 16, 52, 10, 3).fill(body);
    gr.poly([x + 10, GROUND - 16, x + 16, GROUND - 25, x + 36, GROUND - 25, x + 42, GROUND - 16]).fill(body);
    gr.poly([x + 13, GROUND - 16, x + 18, GROUND - 23, x + 25, GROUND - 23, x + 25, GROUND - 16]).fill(0x9fc0d0);
    gr.poly([x + 27, GROUND - 16, x + 27, GROUND - 23, x + 35, GROUND - 23, x + 39, GROUND - 16]).fill(0x9fc0d0);
    gr.rect(x, GROUND - 9, 52, 2).fill(0xc9cdd0);
  }
  for (const wx of [x + 9, x + 41])
    gr.circle(wx, GROUND - 5, 5)
      .fill(0x1e1e1e)
      .circle(wx, GROUND - 5, 2)
      .fill(0x8a8a8a);
}
// Sandbags along the front of the stand.
function sandbags(gr, x, n) {
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < n - r; i++)
      gr.roundRect(x + i * 9 + r * 4.5, GROUND - 5 - r * 4, 8, 4.5, 1.5).fill(r ? 0xbfae88 : 0xb3a380);
}
// The cable runs from the firing room out to the stand and the tower, laid along the sand.
function cables(gr, g) {
  const from = newBlockhouseStands(g)
    ? PLACES.blockhouse.x + NEW_BLOCKHOUSE.dx + PLACES.blockhouse.w + NEW_BLOCKHOUSE.dw
    : PLACES.blockhouse.x + PLACES.blockhouse.w;
  gr.moveTo(from, GROUND + 2)
    .lineTo(PLACES.tower.x, GROUND + 3)
    .stroke({ width: 1.4, color: 0x2a2a28, alpha: 0.7 });
  gr.moveTo(from, GROUND + 4)
    .lineTo(PLACES.tower.x + 4, GROUND + 5)
    .stroke({ width: 1, color: 0x2a2a28, alpha: 0.45 });
  if (!g.crewed)
    gr.moveTo(PLACES.blockhouse.x + (newBlockhouseStands(g) ? NEW_BLOCKHOUSE.dx : 0), GROUND + 3)
      .lineTo(PLACES.stand.x + 100, GROUND + 3)
      .stroke({ width: 1.2, color: 0x2a2a28, alpha: 0.6 });
}
// A name board over a door, so the buildings read at a glance.
function nameBoard(gr, layer, x, y, text) {
  const t = worldText(text, 6, 0xf1e6c8, { family: 'Arial, sans-serif', bold: true, spacing: 1 });
  const w = Math.max(40, t.width + 10);
  gr.rect(x - w / 2, y - 6, w, 12)
    .fill(0x2e2a24)
    .rect(x - w / 2, y - 6, w, 12)
    .stroke({ width: 1, color: 0x8a7a5a });
  t.position.set(x, y);
  layer.addChild(t);
}
function clutter(gr, layer, g, lights) {
  cables(gr, g);
  drums(gr, 912);
  if (!g.crewed) {
    crates(gr, 1000);
    sandbags(gr, PLACES.stand.x - 6, 6);
  } else crates(gr, 990);
  car(gr, 1700, g);
  floodMast(gr, 2002, lights);
  floodMast(gr, 2104, lights);
  loxTrailer(gr, 2124, g);
  generator(gr, 2228);
  const o = PLACES.office,
    h = PLACES.hangar;
  nameBoard(gr, layer, o.x + o.w / 2, GROUND - o.h - 3, g.crewed ? 'MERCURY CONTROL' : 'TECHNICAL OFFICE');
  nameBoard(gr, layer, h.x + h.w / 2, GROUND - h.h + (g.crewed ? 8 : 4), g.crewed ? 'HANGAR S' : 'ASSEMBLY');
  // Lit windows and doorways, for after dark.
  lights.push([o.x + o.w / 2, GROUND - 40, o.w * 1.1, 90, 0xffd890, 0.35]);
  lights.push([h.x + h.w / 2, GROUND - 50, h.w * 0.9, 110, g.crewed ? 0xf4f6ff : 0xffe2a0, 0.3]);
  const b = PLACES.blockhouse;
  lights.push([
    b.x + b.w / 2 + (newBlockhouseStands(g) ? NEW_BLOCKHOUSE.dx / 2 : 0),
    GROUND - 30,
    b.w * 1.2,
    70,
    0xffd28a,
    0.3,
  ]);
}

// ---- the buildings ----
// The technical office, cut away: plaster inside under a hanging lamp, the drawing board with a round pinned to it,
// the desks with their papers, the filing cabinet, the window and the door in from the site.
function office(c, gr, p) {
  const top = GROUND - p.h;
  gr.rect(p.x, top, p.w, p.h).fill(0xc9b79a);
  shade(gr, p.x, top, p.w, p.h, 0.07);
  gr.rect(p.x - 8, top - 8, p.w + 16, 10).fill(0x7d6b55);
  gr.rect(p.x - 8, top - 8, p.w + 16, 2).fill({ color: 0xffeccc, alpha: 0.25 });
  c.addChild(
    vgrad(
      [
        [0, '#a8957a'],
        [0.4, '#e5d5b6'],
        [1, '#c4ae8f'],
      ],
      p.x + 10,
      top + 12,
      p.w - 20,
      p.h - 12,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  g2.rect(p.x + 10, top + 12, p.w - 20, 6).fill({ color: 0x281e14, alpha: 0.12 });
  lampCone(g2, p.x + 70, top + 22, GROUND, 40, 0xffe4a8, 0.12);
  lampCone(g2, p.x + 170, top + 22, GROUND, 40, 0xffe4a8, 0.12);
  // The pinned chart on the back wall, and the window.
  g2.rect(p.x + 27, GROUND - 76, 49, 27).fill(0x967c5e);
  g2.rect(p.x + 32, GROUND - 71, 14, 16)
    .fill(0xe5d7b8)
    .rect(p.x + 51, GROUND - 69, 19, 13)
    .fill(0xe5d7b8);
  g2.rect(p.x + 54, GROUND - 64, 13, 1)
    .fill(0xb9a481)
    .rect(p.x + 54, GROUND - 61, 10, 1)
    .fill(0xb9a481);
  g2.rect(p.x + 195, top + 23, 28, 22)
    .fill(0xf4efe0)
    .rect(p.x + 196.5, top + 24.5, 25, 19)
    .fill(0x7aa0bb);
  g2.rect(p.x + 208.5, top + 23, 1.5, 22)
    .fill(0xf4efe0)
    .rect(p.x + 195, top + 33.5, 28, 1.5)
    .fill(0xf4efe0);
  // The drawing board, tilted, with a blueprint of a round on it.
  const bx = p.x + 150,
    by = GROUND - 46,
    a = -0.35,
    rot = (px, py) => [bx + px * Math.cos(a) - py * Math.sin(a), by + px * Math.sin(a) + py * Math.cos(a)];
  g2.poly([...rot(-31, -21), ...rot(31, -21), ...rot(31, 21), ...rot(-31, 21)]).fill(0x5a4630);
  g2.poly([...rot(-29, -19), ...rot(29, -19), ...rot(29, 19), ...rot(-29, 19)]).fill(0x2f5b8a);
  g2.poly([...rot(-14, 8), ...rot(-14, -12), ...rot(-10, -16), ...rot(-6, -12), ...rot(-6, 8)]).stroke({
    width: 1,
    color: 0xdfe9f2,
  });
  g2.moveTo(...rot(-22, 8))
    .lineTo(...rot(22, 8))
    .stroke({ width: 0.8, color: 0xdfe9f2 });
  g2.rect(p.x + 148, GROUND - 34, 3, 34).fill(0x5a4630);
  // A desk with a paper and an inkwell, and the filing cabinet in the corner.
  g2.rect(p.x + 30, GROUND - 30, 50, 4).fill(0x6b4f35);
  g2.rect(p.x + 34, GROUND - 26, 3, 26)
    .fill(0x6b4f35)
    .rect(p.x + 74, GROUND - 26, 3, 26)
    .fill(0x6b4f35);
  g2.rect(p.x + 44, GROUND - 34, 10, 4)
    .fill(0xfbf7ec)
    .rect(p.x + 57, GROUND - 35, 3, 5)
    .fill(0x232a33);
  g2.rect(p.x + 200, GROUND - 40, 22, 40).fill(0x7d8077);
  for (const y of [GROUND - 30, GROUND - 18]) g2.rect(p.x + 204, y, 14, 1.5).fill(0x5d6058);
  // The door in from the site.
  g2.rect(p.x + 100, GROUND - 40, 22, 40)
    .fill(0x6e5a40)
    .rect(p.x + 100, GROUND - 40, 22, 40)
    .stroke({ width: 1.5, color: 0x54432f });
  g2.rect(p.x + 117, GROUND - 22, 3, 3).fill(0xd8cfa8);
  g2.rect(p.x, GROUND - 4, p.w, 4).fill(0xb7a487);
}

// Mercury Control, cut away: the world map on the far wall, the television beside it (both lit live by the scene's
// moving layer) and the row of consoles with their green screens.
function mercuryControl(c, gr, p) {
  const top = GROUND - p.h;
  gr.rect(p.x, top, p.w, p.h).fill(0xd6d1c4);
  shade(gr, p.x, top, p.w, p.h, 0.06);
  gr.rect(p.x - 8, top - 8, p.w + 16, 10).fill(0xa7a194);
  c.addChild(
    vgrad(
      [
        [0, '#1b2026'],
        [0.6, '#2c343b'],
        [1, '#22282e'],
      ],
      p.x + 10,
      top + 12,
      p.w - 20,
      p.h - 12,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  g2.rect(p.x + 26, top + 16, p.w - 126, 52).fill(0x22272e);
  g2.rect(p.x + p.w - 92, top + 14, 62, 54)
    .fill(0x181b1f)
    .rect(p.x + p.w - 88, top + 18, 54, 46)
    .fill(0x0d1117);
  g2.rect(p.x + 20, GROUND - 26, p.w - 40, 16).fill(0x4b5258);
  g2.rect(p.x + 20, GROUND - 26, p.w - 40, 2).fill(0x6a737b);
  for (let i = 0; i < 6; i++) g2.rect(p.x + 28 + i * 34, GROUND - 23, 20, 6).fill(0x9fdc9a);
  c.addChild(glowAt(p.x + p.w / 2, GROUND - 22, p.w * 0.9, 30, 0x9fdc9a, 0.08));
}

// The assembly hangar: a quonset, cut away to show its floor under the hanging lamps, as its walk-in scene has it.
function quonset(c, gr, p) {
  const top = GROUND - p.h;
  gr.moveTo(p.x, GROUND)
    .lineTo(p.x, top + 40)
    .quadraticCurveTo(p.x + p.w / 2, top - 40, p.x + p.w, top + 40)
    .lineTo(p.x + p.w, GROUND)
    .fill(0x8c8f93);
  gr.moveTo(p.x, top + 40)
    .quadraticCurveTo(p.x + p.w / 2, top - 40, p.x + p.w, top + 40)
    .stroke({ width: 2, color: 0xb4b7ba });
  const inner = new Graphics()
    .moveTo(p.x + 12, GROUND)
    .lineTo(p.x + 12, top + 46)
    .quadraticCurveTo(p.x + p.w / 2, top - 22, p.x + p.w - 12, top + 46)
    .lineTo(p.x + p.w - 12, GROUND)
    .fill(0xffffff);
  const wall = vgrad(
    [
      [0, '#24292b'],
      [0.74, '#45504b'],
      [1, '#343b36'],
    ],
    p.x + 12,
    top - 20,
    p.w - 24,
    p.h + 20,
  );
  wall.mask = inner;
  c.addChild(inner, wall);
  const g2 = new Graphics();
  c.addChild(g2);
  for (let i = 1; i < 6; i++) {
    const x = p.x + (p.w * i) / 6;
    g2.rect(x - 1, top + 20, 2, p.h - 20).fill(0x55585d);
    g2.rect(x - 3, top + 22, 1, p.h - 22).fill(0x83868b);
    for (let y = top + 48; y < GROUND - 15; y += 18) g2.rect(x - 2, y, 2, 2).fill(0xa3a2a0);
  }
  for (let i = 1; i < 4; i++) lampCone(g2, p.x + (p.w * i) / 4, top + 42, GROUND - 6, 30, 0xf3dd8a, 0.1);
  g2.rect(p.x + 12, GROUND - 12, p.w - 24, 12)
    .fill(0x292c31)
    .rect(p.x + 12, GROUND - 13, p.w - 24, 1)
    .fill(0x717478);
  // The bench with its tools.
  g2.rect(p.x + 30, GROUND - 22, 70, 4).fill(0x6a5a44);
  g2.rect(p.x + 34, GROUND - 18, 3, 18)
    .fill(0x6a5a44)
    .rect(p.x + 94, GROUND - 18, 3, 18)
    .fill(0x6a5a44);
  g2.rect(p.x + 38, GROUND - 25, 19, 3)
    .fill(0xc3ae81)
    .rect(p.x + 75, GROUND - 29, 17, 7)
    .fill(0x515c4f);
  g2.rect(p.x + 12, GROUND - 3, p.w - 24, 3).fill({ color: 0x281e14, alpha: 0.2 });
}

// Hangar S, in the crewed years: a white steel-frame building with a band of clerestory windows and the agency's blue
// stripe, cut away to its clean bright floor under fluorescent strips, as the checkout scene has it.
function hangarS(c, gr, p) {
  const top = GROUND - p.h + 20;
  gr.rect(p.x, top, p.w, p.h - 20).fill(0xe6e3da);
  shade(gr, p.x, top, p.w, p.h - 20, 0.05);
  gr.poly([p.x - 10, top, p.x + p.w / 2, top - 26, p.x + p.w + 10, top]).fill(0xc9c5ba);
  gr.rect(p.x - 10, top - 2, p.w + 20, 4).fill(0xb2ada0);
  gr.rect(p.x, top + 6, p.w, 8).fill(0x2b3f6b);
  for (let x = p.x + 18; x < p.x + p.w - 30; x += 34) gr.rect(x, top + 18, 24, 10).fill(0x7aa0bb);
  c.addChild(
    vgrad(
      [
        [0, '#d7d4cc'],
        [0.7, '#eceae3'],
        [1, '#cfccc2'],
      ],
      p.x + 12,
      top + 34,
      p.w - 24,
      GROUND - top - 34,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  for (const lx of [p.x + p.w * 0.25, p.x + p.w * 0.5, p.x + p.w * 0.75]) {
    g2.rect(lx - 22, top + 36, 44, 4)
      .fill(0x787e7b)
      .rect(lx - 20, top + 37, 40, 2)
      .fill(0xfbfaf4);
    g2.poly([lx - 20, top + 40, lx + 20, top + 40, lx + 46, GROUND - 4, lx - 46, GROUND - 4]).fill({
      color: 0xffffed,
      alpha: 0.18,
    });
  }
  g2.rect(p.x + 12, top + 34, p.w - 24, 4).fill({ color: 0x526669, alpha: 0.18 });
  // A test cabinet and a work platform.
  g2.rect(p.x + 26, GROUND - 34, 34, 34)
    .fill(0x9da3a0)
    .rect(p.x + 24, GROUND - 36, 38, 3)
    .fill(0x5d6c70);
  for (const y of [GROUND - 26, GROUND - 18, GROUND - 10]) g2.rect(p.x + 29, y, 28, 1).fill(0xbec5c1);
  g2.rect(p.x + p.w - 90, GROUND - 46, 50, 2).fill(0xb8bcc2);
  g2.rect(p.x + p.w - 88, GROUND - 46, 2, 46)
    .fill(0xa3a7ad)
    .rect(p.x + p.w - 44, GROUND - 46, 2, 46)
    .fill(0xa3a7ad);
  g2.rect(p.x + 12, GROUND - 3, p.w - 24, 3).fill({ color: 0x281e14, alpha: 0.12 });
}

// The static test stand: an open steel frame over the flame pit, its deflector run-out, and the footings.
function stand(gr, p) {
  gr.rect(p.x - 10, GROUND - 4, p.w + 20, 8).fill(0x7a6a58);
  gr.rect(p.x + 40, GROUND - 2, 40, 8).fill(0x2a2420);
  // The pit reads as a pit (Aaron, 13 Nov: the bare dark slab looked like a glitch): a concrete lip round its mouth and
  // the steel grating the crew stand on over it, with the dark showing between the bars.
  gr.rect(p.x + 37, GROUND - 3, 3, 4)
    .fill(0xa89a86)
    .rect(p.x + 80, GROUND - 3, 3, 4)
    .fill(0xa89a86);
  for (let x = p.x + 42; x < p.x + 80; x += 5) gr.rect(x, GROUND - 2, 2, 2).fill(0x8a8f96);
  gr.rect(p.x + 40, GROUND - 3, 40, 1).fill(0x8a8f96);
  gr.poly([p.x + 80, GROUND + 4, p.x + 120, GROUND + 10, p.x + 120, GROUND + 14, p.x + 80, GROUND + 6]).fill(0x5b544a);
  const left = y => p.x + 20 + (10 * y) / p.h,
    right = y => p.x + 100 - (10 * y) / p.h;
  gr.moveTo(p.x + 20, GROUND)
    .lineTo(p.x + 30, GROUND - p.h)
    .lineTo(p.x + 90, GROUND - p.h)
    .lineTo(p.x + 100, GROUND);
  gr.stroke({ width: 4, color: 0x5b5f66 });
  gr.moveTo(p.x + 20, GROUND)
    .lineTo(p.x + 30, GROUND - p.h)
    .stroke({ width: 1.2, color: 0x9a9ea5 });
  for (let y = 30; y < p.h; y += 30) gr.moveTo(left(y), GROUND - y).lineTo(right(y), GROUND - y);
  gr.stroke({ width: 2, color: 0x5b5f66 });
  for (let y = 30; y < p.h; y += 30) {
    const y2 = Math.min(y + 30, p.h);
    gr.moveTo(left(y), GROUND - y)
      .lineTo(right(y2), GROUND - y2)
      .moveTo(right(y), GROUND - y)
      .lineTo(left(y2), GROUND - y2);
  }
  gr.stroke({ width: 1.2, color: 0x6b6f76 });
  gr.rect(p.x + 14, GROUND - 6, 14, 6)
    .fill(0x8a8f96)
    .rect(p.x + 92, GROUND - 6, 14, 6)
    .fill(0x8a8f96);
  gr.rect(p.x + 104, GROUND - 2, 30, 4).fill({ color: 0x281e14, alpha: 0.12 });
}
// The dugout: an earth mound with sandbags along it, its periscope, and the dark way down to the firing room.
function dugout(gr, p) {
  gr.moveTo(p.x - 20, GROUND)
    .quadraticCurveTo(p.x + p.w / 2, GROUND - p.h * 2, p.x + p.w + 20, GROUND)
    .fill(0x9b8a70);
  gr.moveTo(p.x - 20, GROUND)
    .quadraticCurveTo(p.x + p.w / 2 - 20, GROUND - p.h * 2, p.x + p.w / 2 + 6, GROUND - p.h * 0.95)
    .stroke({ width: 1.5, color: 0xc4b392, alpha: 0.6 });
  for (let i = 0; i < 13; i++) {
    const sx = p.x - 14 + i * 9,
      t = (sx + 3.5 - (p.x - 20)) / (p.w + 40),
      sy = GROUND - Math.round(4 * p.h * t * (1 - t)) - 3;
    gr.roundRect(sx, sy, 7, 4, 1.5).fill(0xb3a380);
  }
  gr.rect(p.x + 60, GROUND - p.h - 22, 4, 22)
    .fill(0x555a5f)
    .rect(p.x + 60, GROUND - p.h - 22, 10, 4)
    .fill(0x555a5f);
  gr.rect(p.x + 36, GROUND - 26, 16, 26).fill(0x2b241c);
  gr.rect(p.x + 36, GROUND - 26, 16, 3).fill({ color: 0x000000, alpha: 0.3 });
  gr.rect(p.x + 40, GROUND - 18, 8, 18).fill({ color: 0xffd28a, alpha: 0.18 }); // the lamp below, through the door
}
// The training building in the crewed years: a low block with the lit SIMULATION sign and the simulator inside it.
function trainer(c, gr, standP, dugP) {
  const x = standP.x - 10,
    w = dugP.x + dugP.w - x + 10,
    h = TRAINER.h;
  gr.rect(x, GROUND - h, w, h).fill(0xc8c2b2);
  shade(gr, x, GROUND - h, w, h, 0.05);
  gr.rect(x - 8, GROUND - h - TRAINER.roof, w + 16, TRAINER.roof + 2).fill(0xa9a291);
  c.addChild(
    vgrad(
      [
        [0, '#232830'],
        [1, '#2f353d'],
      ],
      x + 12,
      GROUND - h + 14,
      w - 24,
      h - 14,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  g2.rect(x + 40, GROUND - h + 20, w - 80, 22).fill(0x0d1117);
  g2.moveTo(x + 46, GROUND - h + 38)
    .quadraticCurveTo(x + w / 2, GROUND - h + 18, x + w - 46, GROUND - h + 36)
    .stroke({ width: 1, color: 0x9fdc9a });
  for (let i = 0; i < 4; i++)
    g2.rect(x + 30 + i * 52, GROUND - 30, 40, 18)
      .fill(0x4b5258)
      .rect(x + 36 + i * 52, GROUND - 26, 28, 8)
      .fill(0x9fdc9a);
  // The sign over the door, lit.
  g2.rect(x + w / 2 - 34, GROUND - h - TRAINER.roof - 14, 68, 12).fill(0xa3321f);
  c.addChild(glowAt(x + w / 2, GROUND - h - TRAINER.roof - 8, 120, 40, 0xe0543c, 0.35));
  const t = worldText('SIMULATION', 8, 0xfff2e8, { family: 'Courier New, monospace', bold: true, spacing: 1 });
  t.position.set(x + w / 2, GROUND - h - TRAINER.roof - 8);
  c.addChild(t);
}

// The old blockhouse: a squat concrete box with its periscope, cut away to the firing panel and its lamps.
function oldBlockhouse(c, gr, p) {
  const top = GROUND - p.h;
  gr.rect(p.x, top, p.w, p.h).fill(0xa7a196);
  shade(gr, p.x, top, p.w, p.h, 0.08);
  gr.rect(p.x - 10, top - 12, p.w + 20, 14)
    .fill(0x918b80)
    .rect(p.x - 10, top - 12, p.w + 20, 3)
    .fill(0xb8b2a6);
  gr.rect(p.x + 6, top + 24, 5, 14).fill(0x5c5f57);
  gr.rect(p.x + p.w - 24, top - 18, 4, 8).fill(0x777777);
  c.addChild(
    vgrad(
      [
        [0, '#3b3e37'],
        [1, '#565a50'],
      ],
      p.x + 14,
      top + 16,
      p.w - 28,
      p.h - 16,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  lampCone(g2, p.x + 80, top + 22, GROUND, 36, 0xffd28a, 0.1);
  g2.rect(p.x + 30, GROUND - 34, 80, 22).fill(0x2f3a2c);
  for (let i = 0; i < 6; i++) g2.circle(p.x + 38 + i * 12, GROUND - 27, 2.4).fill(0xcc9944);
  g2.circle(p.x + 38, GROUND - 19, 2.4).fill(0x66cc66);
  g2.rect(p.x + 140, top - 26, 6, 26 + 30)
    .fill(0x555555)
    .rect(p.x + 140, top - 26, 14, 5)
    .fill(0x555555);
  g2.rect(p.x + 136, top + 30, 14, 10).fill(0x3a3d40);
}
// The new blockhouse going up: footings, walls rising in scaffolding, then the roof slab.
function construction(gr, x, k) {
  const w = 150,
    h = 90,
    wall = Math.min(1, k / 0.8) * h;
  gr.rect(x - 6, GROUND - 6, w + 12, 6).fill(0x8f8a80);
  gr.rect(x, GROUND - wall, w, wall).fill(0xb9b3a6);
  if (k > 0.8) gr.rect(x - 8, GROUND - h - 14, (w + 16) * Math.min(1, (k - 0.8) / 0.2), 14).fill(0xa49e92);
  for (let sx = x - 10; sx <= x + w + 10; sx += 32) gr.moveTo(sx, GROUND).lineTo(sx, GROUND - h - 20);
  for (let sy = 24; sy < h + 20; sy += 24) gr.moveTo(x - 10, GROUND - sy).lineTo(x + w + 10, GROUND - sy);
  gr.stroke({ width: 2, color: 0x7b6a52 });
}
// The new blockhouse: bigger and squatter, a heavy roof, two periscopes, a firing room with more panels.
function newBlockhouse(c, gr, p) {
  const w = p.w + NEW_BLOCKHOUSE.dw,
    h = NEW_BLOCKHOUSE.h,
    x = p.x + NEW_BLOCKHOUSE.dx;
  gr.rect(x, GROUND - h, w, h).fill(0xb3ad9f);
  shade(gr, x, GROUND - h, w, h, 0.07);
  gr.rect(x - 14, GROUND - h - NEW_BLOCKHOUSE.roof, w + 28, NEW_BLOCKHOUSE.roof + 2).fill(0x9b9588);
  gr.rect(x - 14, GROUND - h - NEW_BLOCKHOUSE.roof, w + 28, 3).fill(0xc4bfb1);
  c.addChild(
    vgrad(
      [
        [0, '#3b3e37'],
        [1, '#565a50'],
      ],
      x + 16,
      GROUND - h + 18,
      w - 32,
      h - 18,
    ),
  );
  const g2 = new Graphics();
  c.addChild(g2);
  lampCone(g2, x + 80, GROUND - h + 24, GROUND, 40, 0xffd28a, 0.1);
  lampCone(g2, x + 180, GROUND - h + 24, GROUND, 40, 0xffd28a, 0.1);
  g2.rect(x + 28, GROUND - 38, 90, 26)
    .fill(0x2f3a2c)
    .rect(x + 130, GROUND - 38, 70, 26)
    .fill(0x2f3a2c);
  for (let i = 0; i < 7; i++) g2.circle(x + 36 + i * 12, GROUND - 30, 2.4).fill(0xcc9944);
  for (let i = 0; i < 5; i++) g2.circle(x + 138 + i * 12, GROUND - 22, 2.4).fill(0x66cc66);
  g2.rect(x + w - 40, GROUND - h + 22, 18, 50).fill(0x3a3d40);
  for (let i = 0; i < 5; i++) g2.rect(x + w - 37, GROUND - h + 28 + i * 9, 12, 2).fill(i % 2 ? 0x9fdc9a : 0x31413a);
  g2.rect(x + w - 66, GROUND - 34, 20, 34)
    .fill(0x5a5348)
    .rect(x + w - 63, GROUND - 31, 14, 31)
    .fill(0x6e6458);
  for (const px of [x + 40, x + w - 60])
    g2.rect(px, GROUND - h - 44, 6, 26)
      .fill(0x555555)
      .rect(px, GROUND - h - 44, 14, 5)
      .fill(0x555555);
}

// The launch tower: a slender lattice with its rails, platforms every so often, the ladder, and the top platform.
// Grey steel at White Sands; the Cape's service structure in its red lead paint.
function tower(gr, p, g) {
  const top = GROUND - p.h,
    steel = g.site === 'cape' ? 0xa8432f : 0x4e5560,
    light = g.site === 'cape' ? 0xd27a5e : 0x7d8590;
  gr.moveTo(p.x, GROUND)
    .lineTo(p.x + 14, top)
    .moveTo(p.x + p.w, GROUND)
    .lineTo(p.x + p.w - 14, top)
    .stroke({ width: 3, color: steel });
  gr.moveTo(p.x, GROUND)
    .lineTo(p.x + 14, top)
    .stroke({ width: 1, color: light });
  for (let y = 0; y < p.h; y += 20) {
    const k1 = y / p.h,
      k2 = (y + 20) / p.h,
      l1 = p.x + 14 * k1,
      r1 = p.x + p.w - 14 * k1,
      l2 = p.x + 14 * k2,
      r2 = p.x + p.w - 14 * k2;
    gr.moveTo(l1, GROUND - y)
      .lineTo(r1, GROUND - y)
      .moveTo(l1, GROUND - y)
      .lineTo(r2, GROUND - y - 20)
      .moveTo(r1, GROUND - y)
      .lineTo(l2, GROUND - y - 20);
  }
  gr.stroke({ width: 1.2, color: steel });
  for (let y = 80; y < p.h; y += 80) {
    const k = y / p.h;
    gr.rect(p.x + 14 * k - 6, GROUND - y - 1, p.w - 28 * k + 12, 3).fill(steel);
  }
  gr.rect(p.x + 8, top - 2, p.w - 16, 4).fill(steel);
  gr.moveTo(p.x + 8, top - 12).lineTo(p.x + p.w - 8, top - 12);
  for (const x of [p.x + 8, p.x + p.w / 2, p.x + p.w - 8]) gr.moveTo(x, top - 2).lineTo(x, top - 12);
  gr.stroke({ width: 1, color: steel });
  gr.rect(p.x + p.w / 2 - 1, top - 6, 2, 4).fill(steel);
  const lx = p.x + p.w - 20;
  gr.moveTo(lx, GROUND)
    .lineTo(lx + 6, top)
    .moveTo(lx + 5, GROUND)
    .lineTo(lx + 9, top);
  for (let y = 6; y < p.h; y += 6) {
    const k = y / p.h;
    gr.moveTo(lx + 6 * k, GROUND - y).lineTo(lx + 5 + 4 * k, GROUND - y);
  }
  gr.stroke({ width: 0.8, color: steel, alpha: 0.7 });
  gr.rect(p.x - 14, GROUND - 4, p.w + 28, 8).fill(0x7a6a58);
}

// Sun from the left: each building throws a short shadow to the right along the sand.
function shadows(gr, g) {
  const blocks = [
    [PLACES.office.x, PLACES.office.w + 8],
    [PLACES.hangar.x, PLACES.hangar.w],
  ];
  if (newBlockhouseStands(g))
    blocks.push([PLACES.blockhouse.x + NEW_BLOCKHOUSE.dx, PLACES.blockhouse.w + NEW_BLOCKHOUSE.dw + 14]);
  else blocks.push([PLACES.blockhouse.x, PLACES.blockhouse.w + 10]);
  if (g.crewed) blocks.push([PLACES.stand.x - 10, PLACES.dugout.x + PLACES.dugout.w - PLACES.stand.x + 30]);
  for (const [x, w] of blocks) {
    gr.poly([x + w, GROUND, x + w + 46, GROUND + 7, x + 18, GROUND + 7, x, GROUND]).fill({
      color: 0x46341e,
      alpha: 0.14,
    });
    gr.poly([x + w, GROUND, x + w + 24, GROUND + 4, x + w * 0.6, GROUND + 4]).fill({ color: 0x46341e, alpha: 0.08 });
  }
  const t = PLACES.tower;
  gr.moveTo(t.x + t.w / 2, GROUND + 3)
    .lineTo(t.x + t.w / 2 + 150, GROUND + 9)
    .stroke({ width: 2, color: 0x46341e, alpha: 0.16 });
}

// The whole static site, in world units: dressing behind, then the buildings, then the shadows in front of them.
export function buildSite(g) {
  const root = new Container();
  const back = new Graphics();
  const texts = new Container();
  root.addChild(back);
  ground(back, g);
  dressing(back, texts, g);
  const bld = new Container();
  root.addChild(bld);
  const piece = () => {
    const c = new Container(),
      gr = new Graphics();
    c.addChild(gr);
    bld.addChild(c);
    return [c, gr];
  };
  {
    const [c, gr] = piece();
    if (g.crewed) mercuryControl(c, gr, PLACES.office);
    else office(c, gr, PLACES.office);
  }
  {
    const [c, gr] = piece();
    if (g.crewed) hangarS(c, gr, PLACES.hangar);
    else quonset(c, gr, PLACES.hangar);
  }
  {
    const [c, gr] = piece();
    if (g.crewed) trainer(c, gr, PLACES.stand, PLACES.dugout);
    else {
      stand(gr, PLACES.stand);
      dugout(gr, PLACES.dugout);
    }
  }
  {
    const [c, gr] = piece();
    const p = PLACES.blockhouse;
    if (newBlockhouseStands(g)) newBlockhouse(c, gr, p);
    else {
      const k = blockhouseState(g.day).progress;
      if (k > 0) construction(gr, p.x - 160, k);
      const [c2, gr2] = piece();
      oldBlockhouse(c2, gr2, p);
    }
  }
  {
    const [, gr] = piece();
    tower(gr, PLACES.tower, g);
  }
  const lights = [];
  const props = new Graphics();
  root.addChild(props);
  clutter(props, texts, g, lights);
  root.lights = lights;
  const front = new Graphics();
  shadows(front, g);
  nearPlants(front, g);
  root.addChild(front, texts);
  return root;
}
// The site's own textures go with it when it is rebuilt.
export function dropSite(root) {
  const walk = c => {
    for (const ch of c.children) {
      if (ch.children?.length) walk(ch);
      if (ch.ownTex) ch.texture?.destroy(true);
    }
  };
  walk(root);
  root.destroy({ children: true });
}
