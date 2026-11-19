// THE FLAME AS A MOVING LIGHT (next-level visual pass, November 2026). The launch's flame is a light that moves:
// - the buildings and the people throw shadows away from it along the ground, long while she is low on the pad,
//   swinging in and shortening as she climbs, and fading as she goes;
// - the undersides of the clouds near her catch its glow, most of all after dark;
// - on a wet day (rain, or a squall just through) the ground holds reflections: the lamps and windows after dark,
//   the flame while she is low, and a faint sheen of the sky.
// Nothing here flashes: the light follows the launch's own glow, which ramps up and fades (fx/launch.js, fx/calm.js).
// Presentation only: it reads the game, never changes it.
import { Graphics } from '../../vendor/pixi.min.mjs';
import { GROUND, PLACES, footprint } from '../../data/white-sands.js';

// Where a shadow from a light at (lx, height above ground lh) past an edge at x of height h falls on the ground.
// Pure, for the tests. Returns the ground x, capped at `cap` units from the edge when the light is barely above it.
export function shadowReach(lx, lh, x, h, cap = 600) {
  const dir = Math.sign(x - lx) || 1;
  if (lh <= h + 1) return x + dir * cap;
  const reach = ((x - lx) * h) / (lh - h);
  return x + dir * Math.min(cap, Math.abs(reach));
}

// How wet the ground is (0..1) in this weather: rain falling, a rainy day, or the afternoon storms.
export function wetness(w) {
  if (!w) return 0;
  const k = (w.rain || 0) * 1.2 + (w.kind === 'rain' ? 0.6 : 0) + (w.kind === 'storms' ? 0.35 * (w.thunder || 0) : 0);
  return Math.max(0, Math.min(1, k));
}

// The flame's light on the scene. Built once; the site calls the three draws each frame.
export function flameLight() {
  // In the world, on the ground (with the day's shadows): the flame's shadows.
  const shadows = new Graphics();
  // In the far backdrop, over the clouds, added: the warm glow under the clouds near her.
  const cloudGlow = new Graphics();
  cloudGlow.blendMode = 'add';
  // In the world, on the ground, added: the reflections on wet ground.
  const wet = new Graphics();
  wet.blendMode = 'add';

  // fx: the flame's x in world units; rise: how high she is; glow: the launch's glow (0..1); night (0..1).
  function ground(g, { fx, rise, glow, night }) {
    shadows.clear();
    if (glow < 0.02) return;
    const lh = 14 + rise; // the flame's height over the ground
    const a = glow * (0.35 + 0.4 * night);
    const ids = ['office', 'hangar', 'stand', 'blockhouse'];
    if (!g.crewed) ids.push('dugout');
    if (g.truck) ids.push('truck');
    for (const id of ids) {
      const p = footprint(id, g);
      if (!p) continue;
      // The edge facing away from the flame throws the shadow; the edge facing it is where the shadow starts.
      const away = p.x + p.w / 2 < fx ? p.x : p.x + p.w;
      const end = shadowReach(fx, lh, away, p.h, 900);
      // A wedge along the ground from the far wall, soft at its tip: three bands, each shorter and darker.
      const dir = Math.sign(end - away) || 1;
      for (let k = 0; k < 3; k++) {
        const f = 1 - k * 0.25;
        const tip = away + (end - away) * f;
        shadows
          .poly([away + dir * 2, GROUND + 1, tip, GROUND + 1, tip, GROUND + 10 + 10 * f, away, GROUND + 18])
          .fill({ color: 0x140c08, alpha: a / 2.2 });
      }
    }
    for (const p of Object.values(g.people)) {
      if (p.hidden || Math.abs(p.x - fx) < 20) continue;
      const end = shadowReach(fx, lh, p.x, 34, 260);
      shadows
        .poly([p.x - 2, GROUND, p.x + 2, GROUND, end + 3, GROUND + 3, end - 3, GROUND + 3])
        .fill({ color: 0x140c08, alpha: a * 0.8 });
    }
  }

  // spots: the clouds as [x, y, width] in the backdrop's units; (sx, sy) the flame in the same units.
  function clouds(spots, { sx, sy, glow, night, m }) {
    cloudGlow.clear();
    if (glow < 0.02) return;
    const reach = 700 + 1000 * m;
    for (const [x, y, w] of spots) {
      const d = Math.hypot(x + w * 0.5 - sx, (y - sy) * 0.7);
      const k = Math.max(0, 1 - d / reach) ** 1.2 * glow * (0.35 + 0.65 * night);
      if (k < 0.01 || y > sy) continue;
      cloudGlow.ellipse(x + w * 0.5, y + w * 0.07, w * 0.46, w * 0.09).fill({ color: 0xff9a50, alpha: 0.8 * k });
      cloudGlow.ellipse(x + w * 0.5, y + w * 0.1, w * 0.3, w * 0.05).fill({ color: 0xffd090, alpha: 0.5 * k });
    }
  }

  // lights: the site's lamps as [x, y, w, h, tint, alpha]; lamps (0..1) how far they are on; sky: the horizon colour.
  function reflections(g, { wetK, lights, lamps, fx, rise, glow, camX, vw, sky }) {
    wet.clear();
    if (wetK < 0.03) return;
    // A faint sheen of the sky's light along the wet ground.
    wet.rect(camX - 10, GROUND + 2, vw + 20, 10).fill({ color: sky, alpha: 0.1 * wetK });
    wet.rect(camX - 10, GROUND + 12, vw + 20, 14).fill({ color: sky, alpha: 0.05 * wetK });
    // Each lamp and lit window, stretched down into the ground, broken into short strokes like ripples.
    if (lamps > 0.05)
      for (const [x, y, w, , tint, alpha] of lights) {
        if (x < camX - 60 || x > camX + vw + 60) continue;
        const len = Math.min(70, (GROUND - y) * 0.45),
          wd = Math.max(3, w * 0.12);
        for (let k = 0; k < len; k += 4) {
          const f = 1 - k / len;
          wet
            .rect(x - wd / 2 + Math.sin(k * 1.7 + x) * 1.5, GROUND + 3 + k, wd, 2)
            .fill({ color: tint, alpha: 0.32 * lamps * wetK * alpha * f });
        }
      }
    // The flame, while she is low over the pad: a long warm streak.
    if (glow > 0.02 && rise < 600) {
      const k = glow * (1 - rise / 600) * wetK;
      for (let d = 0; d < 90; d += 3) {
        const f = 1 - d / 90;
        wet
          .rect(fx - 6 * f - 2, GROUND + 3 + d, 12 * f + 4, 2)
          .fill({ color: d < 20 ? 0xfff0c8 : 0xffa850, alpha: 0.55 * k * f });
      }
    }
  }

  return { shadows, cloudGlow, wet, ground, clouds, reflections };
}

// The flame's x on the site, for the scene.
export const flameX = () => PLACES.tower.x + 25;
