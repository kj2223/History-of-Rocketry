// TWILIGHT LAUNCHES (next-level visual pass, November 2026). After sunset, or before sunrise, the ground is in shadow
// but the sky high up is still in sunlight. A rocket climbing out of the dusk leaves an exhaust plume that lights up
// as it reaches that sunlight: a glowing fan that spreads wide in the thin air, pink and gold low down, white and blue
// higher, and hangs over the site for a minute or more after she is gone (seen from the Cape and Vandenberg on many
// real evening and dawn launches). By day and in full night it is not there.
// Nothing here flashes: each puff fades in over seconds and out over a minute. Presentation only.
import { Container, Sprite } from '../../vendor/pixi.min.mjs';
import { GROUND } from '../../data/white-sands.js';
import { puffTexture } from '../kit.js';
import { SUNRISE, SUNSET } from './daylight.js';

// How much the high sky is still sunlit while the ground is dark (0..1), at an hour of the day. It comes on as the
// sun sets, is brightest a quarter of an hour later, and is gone about 100 minutes after; the same before dawn.
export const TWILIGHT_SPAN = 1.7;
export function twilightOf(hour) {
  const after = (hour - SUNSET) / TWILIGHT_SPAN,
    before = (SUNRISE - hour) / TWILIGHT_SPAN;
  const k = after >= 0 && after <= 1 ? after : before >= 0 && before <= 1 ? before : -1;
  if (k < 0) return 0;
  return k < 0.15 ? k / 0.15 : (1 - k) / 0.85;
}

// The height above the pad (site units) above which her exhaust is in sunlight.
export const SUNLIT_FROM = 360;

// The plume's sprites, in world units. update() once a frame.
export function twilightPlume() {
  const root = new Container();
  const puffs = [];
  let laidTo = 0;
  const tex = puffTexture();

  // flying: whether she is in the air; rise: how high; x: her x; tw: twilightOf(now); m: her size (launch.js might);
  // wind: km/h. The plume keeps its own puffs after she has gone, so it hangs on while the camera settles.
  function update(dt, { flying, rise, x, tw, m, wind }) {
    if (!flying) laidTo = 0;
    if (flying && tw > 0.02 && rise > SUNLIT_FROM) {
      for (let r = Math.max(laidTo, SUNLIT_FROM); r < rise && puffs.length < 90; r += 36) {
        const high = Math.min(1, (r - SUNLIT_FROM) / 600);
        const glowS = new Sprite(tex),
          coreS = new Sprite(tex);
        for (const sp of [glowS, coreS]) {
          sp.anchor.set(0.5);
          sp.blendMode = 'add';
          sp.position.set(x + (Math.random() - 0.5) * 6, GROUND - 8 - r);
          sp.alpha = 0;
          root.addChild(sp);
        }
        // Low in the sunlight the light is the sunset's, higher it is white with blue at the edges.
        glowS.tint = high < 0.4 ? 0xff8a78 : 0x8fb0ff;
        coreS.tint = high < 0.4 ? 0xffd2a0 : 0xf4f0ff;
        puffs.push({
          glowS,
          coreS,
          age: 0,
          high,
          spread: (1 + 2.5 * high) * (0.6 + m),
          drift: wind * 0.25 * (0.5 + high),
        });
      }
      laidTo = Math.max(laidTo, rise);
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      const life = 90;
      // In over three seconds, out over the last minute.
      const a = Math.min(1, p.age / 3) * Math.max(0, Math.min(1, (life - p.age) / 60)) * tw;
      const size = 0.5 + p.spread * Math.min(1, p.age / 40) ** 0.6;
      p.glowS.scale.set(size * 2.6, size * 1.6);
      p.coreS.scale.set(size * 1.1, size * 0.7);
      p.glowS.alpha = 0.2 * a;
      p.coreS.alpha = 0.22 * a * Math.max(0.3, 1 - p.age / 50);
      p.glowS.x += p.drift * dt;
      p.coreS.x = p.glowS.x;
      if (p.age > life || (tw <= 0.01 && p.age > 3)) {
        p.glowS.destroy();
        p.coreS.destroy();
        puffs.splice(i, 1);
      }
    }
  }
  return { root, update, count: () => puffs.length };
}
