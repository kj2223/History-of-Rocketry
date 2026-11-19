// MISSION CONTROL, HAND-PAINTED (pixel art pass 2, Aaron 18 and 19 November 2026): the room's still parts painted
// pixel by pixel instead of going through the automatic pixel pass as smooth shapes. The back wall with its panels and
// acoustic tile, the front wall's recess round the big screens, the clocks' and the loop's backplates, the carpet with
// its weave, seams, tiers and the pool of light, the equipment racks, the viewing gallery's windows with the visitors
// behind the glass, and every console desk (enamel, trim, push-buttons, screen bezels). Nothing here moves or changes
// brightness: the rack lamps, the event lights, the people, the readings and every word stay where they were, drawn
// over this painting (control.js), and the type stays full resolution (pixelate.js).
// The room is laid out in screen units (control.js's layout), so it is painted at the pixel pass's own size, one art
// pixel to `s` screen pixels, and lands exactly on the pass's grid.
import { pixelLayer, shade, mix, colorNum } from './pixel.js';

// A fixed scatter for weave and grain: the same speckle every time the room is painted.
export const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// A painting surface for a scene laid out in screen units: aw x ah art pixels, each s screen pixels.
export function artLayer(w, h, s) {
  const P = pixelLayer(Math.ceil(w / s), Math.ceil(h / s));
  P.sprite.scale.set(s);
  P.sprite.position.set(0, 0);
  P.s = s;
  return P;
}

// A raised plate: face colour, a lit top and left edge, a shadowed bottom and right edge.
export function plate(P, x, y, w, h, c, { lit = 1.3, dark = 0.6, screws = false } = {}) {
  P.rect(x, y, w, h, c);
  P.rect(x, y, w, 1, shade(c, lit));
  P.rect(x, y, 1, h, shade(c, (lit + 1) / 2));
  P.rect(x, y + h - 1, w, 1, shade(c, dark));
  P.rect(x + w - 1, y, 1, h, shade(c, dark));
  if (screws && w > 8 && h > 6)
    for (const [sx, sy] of [
      [x + 2, y + 2],
      [x + w - 3, y + 2],
      [x + 2, y + h - 3],
      [x + w - 3, y + h - 3],
    ])
      P.px(sx, sy, shade(c, 1.6));
}
// A recess cut into a surface: shadowed top and left, lit lip at the bottom and right.
export function recess(P, x, y, w, h, c, around) {
  P.rect(x, y, w, h, c);
  P.rect(x - 1, y - 1, w + 2, 1, shade(around, 0.55));
  P.rect(x - 1, y, 1, h, shade(around, 0.65));
  P.rect(x - 1, y + h, w + 2, 1, shade(around, 1.25));
  P.rect(x + w, y - 1, 1, h + 1, shade(around, 1.12));
}

// Faint text-like dashes on a data screen, the way a line of figures reads from across a room.
function figures(P, x, y, w, rows, c, seed = 0) {
  for (let r = 0; r < rows; r++) {
    let at = x;
    const end = x + w * (0.45 + hash(r, seed) * 0.5);
    for (let k = 0; at < end; k++) {
      const len = 1 + Math.floor(hash(k + seed, r * 7) * 4);
      P.rect(at, y + r * 2, Math.min(len, end - at), 1, c);
      at += len + 1 + (hash(r, k + seed) < 0.2 ? 2 : 0);
    }
  }
}

// The whole still room. o: { w, h, s, look, place, era, L } with L the room's layout (control.js).
export function paintControlRoom({ w, h, s, look, place, era, L }) {
  const P = artLayer(w, h, s);
  const A = v => Math.round(v / s);
  const aw = Math.ceil(w / s),
    ah = Math.ceil(h / s);
  const wall = look.wall.map(colorNum),
    carpet = look.carpet.map(colorNum);
  const x0 = A(L.leftW),
    x1 = A(L.galleryX),
    wy = A(L.wallH);
  P.rect(0, 0, aw, ah, 0x14171c);

  // ---- the back wall ----
  P.vgrad(x0, 0, x1 - x0, wy, [wall[0], wall[1], wall[2]]);
  // Its finish by era: perforated acoustic tile in the steel and Shuttle rooms, fabric panels in the 1990s room, dark
  // ribbed panels in the glass room.
  for (let y = 0; y < wy; y++)
    for (let x = x0; x < x1; x++) {
      if (era === 'steel' || era === 'amber') {
        if (x % 3 === 1 && y % 3 === 1) P.px(x, y, shade(mix(wall[0], wall[1], y / wy), 0.84));
      } else if (era === 'desktop') {
        const k = hash(x, y);
        if (k < 0.1) P.px(x, y, shade(mix(wall[0], wall[1], y / wy), 0.92));
        else if (k > 0.94) P.px(x, y, shade(mix(wall[0], wall[1], y / wy), 1.07));
      } else if (y % 4 === 0) P.px(x, y, shade(mix(wall[0], wall[1], y / wy), 1.35));
    }
  // The panels' seams: a dark joint with a lit edge beside it.
  const seams = 12;
  for (let i = 1; i < seams; i++) {
    const sx = Math.round(x0 + ((x1 - x0) * i) / seams);
    P.rect(sx, 0, 1, wy, shade(wall[1], 0.62));
    P.rect(sx + 1, 0, 1, wy, shade(wall[1], 1.12));
  }
  // The cornice along the top, and the kick strip and its rail along the foot of the wall.
  P.rect(x0, 0, x1 - x0, 2, shade(wall[0], 0.7));
  P.rect(x0, 2, x1 - x0, 1, shade(wall[0], 1.2));
  P.rect(x0, wy - 3, x1 - x0, 3, shade(wall[2], 0.62));
  P.rect(x0, wy - 4, x1 - x0, 1, shade(wall[2], 1.25));

  // ---- the front wall: the recess round the big screens, their frames, the clocks' and the loop's backplates ----
  const rx = A(L.wallL - 12),
    ry = A(L.wallH * 0.05 - 6),
    rw = A(L.wallR - L.wallL + 24),
    rh = A(L.wallH * 0.63);
  recess(P, rx, ry, rw, rh, mix(wall[1], 0x070c11, 0.55), wall[1]);
  for (let x = rx + 3; x < rx + rw - 2; x += 24) {
    P.px(x, ry + 1, shade(mix(wall[1], 0x070c11, 0.55), 1.7));
    P.px(x, ry + rh - 2, shade(mix(wall[1], 0x070c11, 0.55), 1.7));
  }
  const frame = ([x, y, fw, fh], pad = 1) => {
    const fx = A(x) - pad,
      fy = A(y) - pad,
      fW = A(fw) + 2 * pad,
      fH = A(fh) + 2 * pad;
    P.rect(fx - 1, fy - 1, fW + 2, fH + 2, 0x0a0c0f);
    plate(P, fx, fy, fW, fH, 0x1c2024, { lit: 1.5, dark: 0.7 });
    P.rect(fx + pad, fy + pad, fW - 2 * pad, fH - 2 * pad, 0x0c0f12);
  };
  frame(L.map);
  frame(L.tv);
  const strip = (y, sh, c) =>
    plate(P, A(L.wallL - 4), A(y - 4), A(L.wallR - L.wallL + 8), A(sh + 8), c, { screws: true });
  strip(L.wallH * 0.69, L.wallH * 0.09, 0x22272e);
  strip(L.wallH * 0.81, L.wallH * 0.17, 0x1b1f25);

  if (place === 'fcr') {
    // The video wall: one dark surface of tiles behind the panes, with fine seams and a lit corner to each tile.
    const top = A(L.map[1] - 8),
      bottom = A(L.map[1] + L.map[3] + 8),
      vx = A(L.wallL - 8),
      vw = A(L.wallR - L.wallL + 16);
    const glass = colorNum(look.glass);
    P.rect(vx, top, vw, bottom - top, glass);
    const cols = 12,
      rows = 4;
    for (let i = 0; i <= cols; i++) {
      const sx = Math.round(vx + (vw * i) / cols);
      if (i > 0 && i < cols) P.rect(sx, top, 1, bottom - top, shade(glass, 0.4));
      for (let j = 0; j < rows; j++) P.px(sx + 1, Math.round(top + ((bottom - top) * j) / rows) + 1, shade(glass, 2));
    }
    for (let j = 1; j < rows; j++) P.rect(vx, Math.round(top + ((bottom - top) * j) / rows), vw, 1, shade(glass, 0.4));
    // The light strip along the wall's top, and its wash down the wall, dithered away.
    const trim = colorNum(look.trim);
    P.rect(x0, 0, x1 - x0, 1, shade(trim, 1.3));
    P.rect(x0, 1, x1 - x0, 1, trim);
    const washH = Math.max(3, A(L.wallH * 0.08));
    P.vgrad(x0, 2, x1 - x0, washH, [mix(wall[0], trim, 0.45), mix(wall[0], trim, 0.18), wall[0]]);
    // Data windows: a title bar and lines of figures.
    for (const [x, y, ww, wh] of [L.lights, L.board]) {
      const dx = A(x),
        dy = A(y),
        dW = A(ww),
        dH = A(wh);
      P.rect(dx, dy, dW, dH, colorNum(look.glassTop));
      P.rect(dx, dy, dW, Math.max(2, Math.round(dH * 0.1)), mix(colorNum(look.glassTop), trim, 0.6));
      figures(
        P,
        dx + Math.max(2, Math.round(dW * 0.06)),
        dy + Math.round(dH * 0.22),
        dW * 0.86,
        Math.floor(dH * 0.34),
        mix(colorNum(look.glassTop), colorNum(look.ink), 0.4),
        dx,
      );
    }
  } else if (place === 'mocr') {
    // The event lights' panel (its lamps are lit each frame) and the network status board's panel.
    frame(L.lights);
    frame(L.board);
  }

  // ---- the floor: carpet with its weave, its seams running back to the front wall, and a pool of light ----
  P.vgrad(x0, wy, x1 - x0, ah - wy, [carpet[0], carpet[1], carpet[2]]);
  for (let y = wy; y < ah; y++)
    for (let x = x0; x < x1; x++) {
      const k = hash(x, y),
        base = mix(carpet[0], carpet[1], Math.min(1, (y - wy) / Math.max(1, (ah - wy) * 0.4)));
      // A low, close weave: a soft fleck here and there, never a pattern that crawls when the room is watched.
      if (k < 0.06) P.px(x, y, shade(base, 0.92));
      else if (k > 0.97) P.px(x, y, shade(base, 1.06));
    }
  const cx = Math.round((x0 + x1) / 2);
  for (let i = -6; i <= 6; i++) {
    const top = cx + i * ((x1 - x0) / 13),
      foot = cx + i * ((x1 - x0) / 13) * 2.2;
    P.line(Math.round(top), wy + 1, Math.round(foot), ah, shade(carpet[1], 0.95));
  }
  for (const depth of [0.12, 0.29, 0.52, 0.82])
    P.rect(x0, Math.round(wy + depth * (ah - wy)), x1 - x0, 1, shade(carpet[1], 1.06));
  P.glow(A(w * 0.46), A(h * 0.8), A(w * 0.37), A((h - L.wallH) * 0.42), shade(carpet[1], 1.25), 0.32);
  // The wall's shadow on the carpet.
  P.rect(x0, wy, x1 - x0, 1, shade(carpet[0], 0.5));
  for (let x = x0; x < x1; x++) if ((x + wy) % 2) P.px(x, wy + 1, shade(carpet[0], 0.7));
  if (place === 'mocr') {
    // The tiers: each row of desks a step up from the one in front of it, the trench lowest by the wall.
    for (const at of [0.1, 0.47]) {
      const y = Math.round(wy + (ah - wy) * at),
        riser = Math.max(2, Math.round((ah - wy) * 0.035));
      const base = mix(carpet[0], carpet[1], 0.6);
      P.rect(x0, y, x1 - x0, riser, shade(base, 0.62));
      P.rect(x0, y, x1 - x0, 1, mix(base, 0xe8ddbd, 0.35));
      for (let x = x0; x < x1; x += 2) P.px(x + ((y + riser) % 2), y + riser, shade(base, 0.7));
    }
  }

  // ---- the racks along the left wall: cabinets with vents, meters and, through the 1980s, tape reels ----
  P.rect(0, 0, x0, ah, 0x1d2126);
  P.rect(x0 - 1, 0, 1, ah, 0x121518);
  const rack = colorNum(look.rack);
  for (const uy of L.units) {
    const uh = (h - 20) / L.units.length - 8;
    const ux = A(5),
      top = A(uy),
      uw = Math.max(4, x0 - 2 * ux),
      uH = A(uh);
    plate(P, ux, top, uw, uH, rack, { screws: true });
    P.rect(ux + 1, top + 1, uw - 2, 2, 0x0d1117); // the lamp row's bezel (the lamps tick over in control.js)
    const inner = top + 4;
    P.rect(ux + 1, inner, uw - 2, uH - 6, 0x0d1117);
    for (let v = 0; v < 3; v++) P.rect(ux + 2, inner + 1 + v * 2, uw - 4, 1, shade(rack, 0.8));
    if ((era === 'steel' || era === 'amber') && uH > 14) {
      const r = Math.max(2, Math.min(Math.floor((uw - 4) / 4), Math.floor((uH - 12) / 2)));
      const ry2 = inner + 7 + r;
      for (const rx2 of [ux + 1 + Math.round(uw * 0.28), ux + Math.round(uw * 0.72)]) {
        P.circ(rx2, ry2, r, 0x2a2e33);
        P.ring(rx2, ry2, r, 0x5d646c);
        P.circ(rx2, ry2, 1, 0x9aa3ab);
      }
    } else {
      for (let k = 0; k < 3; k++) P.rect(ux + 2, inner + 8 + k * 3, uw - 4, 1, shade(rack, 1.3));
    }
    P.rect(Math.round(x0 / 2) - 2, top + uH - 3, 4, 1, 0x6a727b);
  }

  // ---- the viewing gallery on the right: panelling, two windows with visitors behind the glass, its floor ----
  const gx0 = A(L.galleryX);
  const gw = w - L.galleryX;
  P.vgrad(gx0, 0, aw - gx0, ah, [0x292b2a, 0x47433a, 0x332f2b]);
  for (let x = gx0; x < aw; x++)
    for (let y = 0; y < ah; y++) {
      if ((x - gx0) % 6 === 0) P.px(x, y, 0x24221f);
      else if (hash(x, y >> 2) < 0.07) P.px(x, y, mix(0x47433a, 0x5a5348, 0.6));
    }
  P.rect(gx0, 0, 1, ah, 0x121518);
  const winW = Math.min(gw * 0.36, 130),
    winH = h * 0.12,
    gap = gw * 0.08,
    gx = L.galleryX + (gw - 2 * winW - gap) / 2,
    gy = h * 0.05;
  for (const [n, wxS] of [gx, gx + winW + gap].entries()) {
    const wx = A(wxS),
      wyy = A(gy),
      ww = A(winW),
      wh = A(winH);
    P.rect(wx - 1, wyy - 1, ww + 2, wh + 2, 0x181f22);
    P.vgrad(wx, wyy, ww, wh, [0x547889, 0x426270, 0x3a5662]);
    // The visitors: heads and shoulders, a little apart, a touch dimmed by the glass.
    const q = Math.max(1, Math.round(ww / 16)),
      behind = c => mix(c, 0x426270, 0.3);
    for (let i = 0; i < 3; i++) {
      const hx = wx + Math.round(ww * (0.2 + i * 0.3)),
        hy = wyy + Math.round(wh * (0.5 + ((i * 13 + n * 5) % 3) * 0.08));
      P.rect(hx - 2 * q, hy + 2 * q, 5 * q, wyy + wh - hy - 2 * q, behind(i % 2 ? 0x35414b : 0x2a3438));
      P.rect(hx - q, hy, 2 * q + 1, 2 * q, behind((i + n) % 2 ? 0xbc9c7d : 0x9b7f68));
      P.rect(hx - q, hy - 1, 2 * q + 1, 1, behind(0x3a2c22));
    }
    // A streak of light across the glass.
    for (let k = 0; k < wh; k += 1) {
      const sx = wx + Math.round(ww * 0.62) + Math.round(k * 0.45);
      if (sx < wx + ww && k % 3 !== 2) P.px(sx, wyy + wh - 1 - k, mix(0x6d93a4, 0xffffff, 0.12));
    }
    P.rect(wx - 1, wyy + wh + 1, ww + 2, 1, 0x4b453c);
    P.rect(wx - 1, wyy + wh + 2, ww + 2, 1, 0x1e1c19);
  }
  const floorY = A(gy + winH + Math.max(6, h * 0.015));
  P.rect(gx0 + 1, floorY, aw - gx0 - 1, ah - floorY, 0x2a2723);
  for (let y = floorY; y < ah; y += 4) P.rect(gx0 + 1, y, aw - gx0 - 1, 1, 0x24211e);
  P.commit();
  return P;
}

// A console desk painted in pixels: its enamel, the trim along its top with a row of push-buttons, the screens' bezels
// and glass, the kick plate. dw x dh: the desk in its own units; k: its scale in the room; s: screen pixels to an art
// pixel. offs, sw, sh: where its screens are, in desk units. Returns the sprite, sized to sit in the desk's container.
export function paintDesk({ dw, dh, k, s, look, offs, sw, sh, era }) {
  const u = v => Math.round((v * k) / s);
  const P = pixelLayer(Math.max(4, u(dw)), Math.max(4, u(dh)));
  P.sprite.scale.set(s / k);
  P.sprite.position.set(0, 0);
  const W = P.w,
    H = P.h;
  const en = look.enamel.map(colorNum),
    trim = colorNum(look.trim);
  P.vgrad(0, 0, W, H, [en[0], en[1], en[1], en[2]]);
  // The end panel, a shade darker, with its joint.
  const end = Math.max(1, Math.round(W * 0.08));
  P.rect(W - end, 0, end, H, shade(en[1], 0.88));
  P.rect(W - end, 0, 1, H, shade(en[1], 0.7));
  // The trim along the top: a lit edge and, in the console years, a row of lamp push-buttons.
  const tH = Math.max(2, u(10));
  P.rect(0, 0, W, tH, trim);
  P.rect(0, 0, W, 1, shade(trim, 1.3));
  P.rect(0, tH - 1, W, 1, shade(trim, 0.72));
  if (tH >= 2 && era !== 'glass') {
    const caps = era === 'desktop' ? [0xd8dadb, 0xc0c3c5] : [0xd8d0b0, 0x8fb08a, 0xd9a05a, 0xa8b4c4, 0xc96a55];
    for (let x = 2; x < W - end - 2; x += 3) {
      if (hash(x, W) < 0.25) continue;
      P.px(x, tH - 2 > 0 ? tH - 2 : 0, caps[Math.floor(hash(x, H) * caps.length)]);
    }
  } else if (era === 'glass') P.rect(1, tH - 1, W - 2, 1, shade(trim, 1.4));
  // The screens: a dark bezel, the glass shaded from its top, a fleck of light on it.
  const glass = colorNum(look.glass),
    gTop = colorNum(look.glassTop);
  for (const off of offs) {
    const bx = u(off - 2),
      by = u(14),
      bW = u(sw + 4),
      bH = u(sh + 4);
    P.rect(bx, by, bW, bH, 0x0d1117);
    P.rect(bx, by + bH, bW, 1, shade(en[1], 1.18));
    const gx = u(off),
      gy = u(16),
      gW = Math.max(1, u(sw)),
      gH = Math.max(1, u(sh));
    P.vgrad(gx, gy, gW, gH, [gTop, glass, glass]);
    if (gW > 3) P.px(gx + gW - 2, gy, mix(gTop, 0xb2c8c5, 0.3));
  }
  // The kick plate.
  const kH = Math.max(1, u(3));
  P.rect(0, H - kH, W, kH, 0x262b30);
  P.rect(0, H - kH - 1, W, 1, shade(en[2], 0.8));
  P.commit();
  return P.sprite;
}
