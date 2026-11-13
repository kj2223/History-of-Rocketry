// THE LIGHT OF THE DAY (v0.8 visual pass): the site's sky, sun and colour follow the clock through the whole day
// instead of switching between two looks. A soft warm morning, the white of midday, the golden hour, the sunset,
// the blue dusk and the deep night with its stars and moon. The sun climbs and sets across the sky, the buildings
// and people throw shadows along the ground that lengthen and swing as it moves, and after dark the pad is
// floodlit, with searchlights on the rocket from the space years on.
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { GROUND } from '../../data/white-sands.js';
import { footprint, PLACES } from '../../data/white-sands.js';
import { yearOf } from '../../site/draw.js';
import { puffTexture } from '../kit.js';

// [hour, sky top, sky middle, sky at the horizon, the site's tint, how dark (0 day .. 1 deep night)]
const KEYS = [
  [0, '#0b1024', '#18203c', '#2c3050', 0x7a84a6, 1],
  [4.5, '#0b1024', '#18203c', '#2c3050', 0x7a84a6, 1],
  [5.75, '#1e2446', '#55506e', '#b8806a', 0x9890ac, 0.7],
  [6.75, '#45689a', '#cfa08e', '#f4b47c', 0xdcc8c0, 0.2],
  [7.75, '#6f97c6', '#b9cfe2', '#f0d8b4', 0xfff1e2, 0],
  [10, '#5d8fc4', '#a9c8e4', '#ead9b8', 0xffffff, 0],
  [15.5, '#5d8fc4', '#a9c8e4', '#ead9b8', 0xffffff, 0],
  [17, '#5a86b8', '#d6bf98', '#f4c487', 0xffedd4, 0],
  [18, '#3a4466', '#a8687a', '#f0a060', 0xd8b8c0, 0.25],
  [18.75, '#2b3150', '#8a5a6a', '#e09a62', 0xb4a6bf, 0.5],
  [19.75, '#151b36', '#2e2d4e', '#5e4258', 0x8c8cb0, 0.85],
  [21, '#0b1024', '#18203c', '#2c3050', 0x7a84a6, 1],
  [24, '#0b1024', '#18203c', '#2c3050', 0x7a84a6, 1],
];
const hex = css => parseInt(css.slice(1), 16);
const lerpRGB = (a, b, k) => {
  const ch = (v, s) => (v >> s) & 255;
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
const css = c => `#${c.toString(16).padStart(6, '0')}`;

export const SUNRISE = 6.2,
  SUNSET = 19.2;

// The light at a minute of the day. Pure, for the tests.
export function lightAt(minute) {
  const h = (((minute % 1440) + 1440) % 1440) / 60;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i],
    b = KEYS[i + 1],
    k = (h - a[0]) / (b[0] - a[0] || 1);
  const sky = [1, 2, 3].map(j => css(lerpRGB(hex(a[j]), hex(b[j]), k)));
  const tint = lerpRGB(a[4], b[4], k),
    night = a[5] + (b[5] - a[5]) * k;
  // The sun: up from the east (right) at sunrise, over, and down in the west (left) at sunset.
  const day = (h - SUNRISE) / (SUNSET - SUNRISE),
    elevation = day > 0 && day < 1 ? Math.sin(Math.PI * day) : 0;
  const low = 1 - Math.min(1, elevation * 2.2);
  return {
    hour: h,
    sky,
    tint,
    night,
    dusk: night >= 0.35,
    lamps: Math.max(0, Math.min(1, (night - 0.2) / 0.4)),
    stars: Math.max(0, Math.min(1, (night - 0.55) / 0.35)),
    sun: { up: elevation > 0, along: Math.max(0, Math.min(1, day)), elevation, low },
    sunColor: lerpRGB(0xfffbea, 0xffb46a, low),
    // Shadows: how long (times the height) and which way along the ground (away from the sun), and how dark.
    shadow: {
      length: elevation > 0.04 ? Math.min(3.2, 0.35 / Math.max(0.11, elevation)) : 0,
      dir: day < 0.5 ? -1 : 1,
      alpha: elevation > 0.04 ? 0.34 * Math.min(1, elevation * 6) : 0,
    },
    cloud: lerpRGB(
      lerpRGB(0xffffff, 0xf0aa96, Math.min(1, low * 0.8 + night * 0.4)),
      0x3a3f5c,
      Math.max(0, (night - 0.5) * 2),
    ),
    key: Math.floor(minute / 3),
  };
}

// Stars, the moon, the shadows and the searchlights.
export function daylightDressing() {
  const stars = new Graphics();
  const moon = new Graphics();
  const shadows = new Graphics();
  const beams = new Graphics();
  beams.blendMode = 'add';
  const shine = new Sprite(puffTexture());
  shine.anchor.set(0.5);
  shine.blendMode = 'add';
  shine.tint = 0xdfe8ff;
  const beamLayer = new Container();
  beamLayer.addChild(beams, shine);
  let starW = 0;

  // vw: the screen's width in site units. Stars and moon are drawn in the far backdrop's units.
  function sky(L, vw) {
    if (Math.ceil(vw) !== starW) {
      starW = Math.ceil(vw);
      stars.clear();
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < Math.round(starW / 9); i++) {
        const r = rnd() < 0.08 ? 1.3 : 0.7;
        stars.circle(rnd() * starW, -240 + rnd() * 640, r).fill({ color: 0xffffff, alpha: 0.4 + rnd() * 0.6 });
      }
    }
    stars.alpha = L.stars;
    stars.visible = L.stars > 0;
    moon.clear();
    if (L.night > 0.5) {
      const mx = vw * 0.72,
        my = 110;
      moon.circle(mx, my, 11).fill({ color: 0xf2efe2, alpha: Math.min(1, (L.night - 0.5) * 3) });
      moon.circle(mx + 4, my - 2, 10).fill({ color: 0x0b1024, alpha: 0.18 * Math.min(1, (L.night - 0.5) * 3) });
    }
  }

  // The buildings' and people's shadows along the ground, and after dark the searchlights on the rocket at the pad.
  function world(L, g, rocketY, t) {
    shadows.clear();
    const sh = L.shadow;
    if (sh.alpha > 0.005) {
      const ids = ['office', 'hangar', 'stand', 'blockhouse', 'tower'];
      if (!g.crewed) ids.push('dugout');
      for (const id of ids) {
        const p = footprint(id, g);
        if (!p) continue;
        const reach = Math.min(420, p.h * sh.length) * sh.dir,
          a = sh.alpha * (id === 'tower' ? 0.45 : 1);
        const x0 = p.x,
          x1 = p.x + p.w;
        // A band along the ground from the base, running away from the sun and fading as it goes.
        for (let k = 0; k < 3; k++) {
          const f = (k + 1) / 3;
          shadows
            .poly([
              sh.dir > 0 ? x0 + 4 : x1 - 4,
              GROUND + 1,
              sh.dir > 0 ? x1 + reach * f : x0 + reach * f,
              GROUND + 1,
              sh.dir > 0 ? x1 + reach * f + 6 * sh.dir : x0 + reach * f + 6 * sh.dir,
              GROUND + 9 + 6 * f,
              sh.dir > 0 ? x0 + 10 : x1 - 10,
              GROUND + 9 + 6 * f,
            ])
            .fill({ color: 0x2a1e14, alpha: a / 2 });
        }
      }
      for (const p of Object.values(g.people)) {
        if (p.hidden) continue;
        const reach = 34 * sh.length * sh.dir;
        shadows
          .poly([p.x - 2, GROUND, p.x + 2, GROUND, p.x + reach + 3, GROUND + 3, p.x + reach - 3, GROUND + 3])
          .fill({ color: 0x2a1e14, alpha: sh.alpha * 0.9 });
      }
    }
    // Searchlights: from the space years, a rocket on the pad at night stands in crossed white beams.
    beams.clear();
    shine.alpha = 0;
    const lit = L.lamps > 0.05 && rocketY != null && yearOf(g) >= 1957;
    if (lit) {
      const x = PLACES.tower.x + 25;
      for (const [from, spread] of [
        [x - 300, 1],
        [x + 320, 1],
        [x - 170, 0.7],
      ]) {
        const sway = Math.sin(t * 0.3 + from) * 4;
        for (const [w, alpha] of [
          [34, 0.045],
          [18, 0.06],
          [7, 0.08],
        ])
          beams
            .poly([
              from - 3,
              GROUND + 6,
              from + 3,
              GROUND + 6,
              x + w * spread + sway,
              rocketY - 30,
              x - w * spread + sway,
              rocketY + 30,
            ])
            .fill({ color: 0xe6eeff, alpha: alpha * L.lamps });
      }
      shine.position.set(x, rocketY);
      shine.width = 120;
      shine.height = 320;
      shine.alpha = 0.32 * L.lamps;
    }
  }
  return { stars, moon, shadows, beamLayer, sky, world };
}
