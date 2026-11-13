// GOING FROM ONE SCENE TO ANOTHER (v0.8 visual pass), in the era's own way, instead of a hard cut:
// - into the screens (Mission Control, the range plot, the simulator) from 1958: a television warming up, the
//   picture opening from a thin bright line across the middle to the full height;
// - in the newsreel years: an iris opening from a point, as the films of the day cut between scenes;
// - otherwise: a short lift out of the dark.
// Nothing flashes: the picture is only revealed (photosensitivity, fx/calm.js). Calm mode uses the short lift.
import { Graphics } from '../../vendor/pixi.min.mjs';
import { calm } from './calm.js';

const SCREENS = new Set(['control', 'tracking', 'sim', 'deep']);
export function transitionKind(id, year) {
  if (calm()) return 'lift';
  if (SCREENS.has(id) && year >= 1958) return 'crt';
  if (year < 1958) return 'iris';
  return 'lift';
}
export const LENGTH = { crt: 0.55, iris: 0.6, lift: 0.3 };

export function transitionLayer() {
  const cover = new Graphics();
  let kind = null,
    t = 0;
  function start(k) {
    kind = k;
    t = 0;
  }
  function update(dt, screen) {
    cover.clear();
    if (!kind) return;
    t += Math.min(dt, 1 / 30);
    const len = LENGTH[kind],
      k = Math.min(1, t / len),
      e = k * k * (3 - 2 * k),
      W = screen.width,
      H = screen.height;
    if (k >= 1) {
      kind = null;
      return;
    }
    // The dark is drawn around the opening, never as a shape with a hole cut in it: PixiJS fills the whole cover when
    // a hole reaches the edge of its shape, which showed as a frame of full black at the end of every way in.
    const dark = 0x050505;
    if (kind === 'crt') {
      // The line opens first across, then up and down.
      const wide = Math.min(1, e * 2.2),
        tall = Math.max(0.004, (e - 0.25) / 0.75),
        w = W * wide,
        h = Math.min(H, Math.max(2, H * tall)),
        x = (W - w) / 2,
        y = (H - h) / 2;
      if (y > 0) cover.rect(0, 0, W, y).rect(0, y + h, W, H - y - h);
      if (x > 0) cover.rect(0, y, x, h).rect(x + w, y, W - x - w, h);
      cover.fill(dark);
    } else if (kind === 'iris') {
      // A ring from the edge of the opening out past the corners of the screen.
      const r = Math.hypot(W, H) * 0.5 * e,
        ring = Math.hypot(W, H);
      cover.circle(W / 2, H / 2, r + ring / 2).stroke({ color: dark, width: ring });
    } else {
      cover.rect(0, 0, W, H).fill({ color: dark, alpha: 1 - e });
    }
  }
  return { cover, start, update, busy: () => !!kind };
}
