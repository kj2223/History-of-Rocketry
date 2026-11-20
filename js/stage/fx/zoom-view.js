// THE ROOM AND THE DESK (2D-HD rework, Aaron 20 November 2026): a scene that opens on its room in three-quarters (a lit
// diorama in pixels) and moves in to the player's own desk or panel for the readings. The room grows about the desk
// until the desk fills the screen, and the close-up comes up out of it. A button and a click on the desk move between
// the two; while the player has work on the panel (the count running, a firing) the view moves in by itself after a
// moment, unless the player has already chosen.
// Both views are W x H scene units (PX units an art pixel) and fit the same box. Presentation only.
import { setText, outButton } from '../kit.js';
import { PX } from '../pixel.js';

const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// room, desk: Containers in scene units. focus: the desk in the room, in art pixels {x, y, w, h}. auto(): whether the
// player has work on the panel now. words: the button's two labels.
export function roomAndDesk({
  room,
  desk,
  focus,
  W = 1600,
  H = 900,
  auto = () => false,
  words = ['▾ Your desk', '▴ The room'],
}) {
  let z = 0,
    zt = 0,
    since = 0,
    chosen = false;
  const toggle = outButton(() => {
    zt = zt > 0.5 ? 0 : 1;
    chosen = true;
  }, words[0]);
  const goIn = () => {
    zt = 1;
    chosen = true;
  };
  // Fits both views into the box (x0, y0, bw, bh) at a whole number of device pixels to each art pixel, where that
  // fits, so the pixels stay even (pixelate.js artFrame). Returns e (0 the room, 1 the desk) and the scales.
  function update(dt, x0, y0, bw, bh, grid = 0) {
    const dpr = globalThis.devicePixelRatio || 1;
    const fit = Math.min(bw / W, bh / H);
    const k = fit * PX * dpr >= 1 ? Math.floor(fit * PX * dpr + 1e-6) / (PX * dpr) : fit;
    const ox = x0 + (bw - W * k) / 2,
      oy = y0 + (bh - H * k) / 2;
    since += dt;
    if (!chosen && since > 1.4 && auto()) zt = 1;
    z += Math.sign(zt - z) * Math.min(Math.abs(zt - z), dt * 1.7);
    const e = smooth(0, 1, z);
    // At rest on a scene the pixel pass draws (pixelate.js), the view sits on the pass's own grid (grid CSS pixels).
    const g = grid && (e === 0 || e === 1) ? grid : 1 / dpr;
    const snap = v => Math.round(v / g) * g;
    setText(toggle.children[1], zt > 0.5 ? words[1] : words[0]);
    const Zr = W / (focus.w * PX);
    const F = { x: (focus.x + focus.w / 2) * PX, y: (focus.y + focus.h / 2) * PX };
    const rs = k * (1 + (Zr - 1) * e);
    const S = {
      x: ox + F.x * k + (ox + (W * k) / 2 - (ox + F.x * k)) * e,
      y: oy + F.y * k + (oy + (H * k) / 2 - (oy + F.y * k)) * e,
    };
    room.scale.set(rs);
    room.position.set(snap(S.x - F.x * rs), snap(S.y - F.y * rs));
    room.alpha = 1 - smooth(0.6, 1, e);
    room.visible = e < 1;
    const ds = rs / Zr;
    desk.scale.set(ds);
    desk.position.set(snap(S.x - (W / 2) * ds), snap(S.y - (H / 2) * ds));
    desk.alpha = smooth(0.3, 0.75, e);
    desk.visible = e > 0;
    return { e, k, rs, ds, base: { x: snap(S.x - (W / 2) * ds), y: snap(S.y - (H / 2) * ds) } };
  }
  return { toggle, goIn, update };
}
