// THE PAD IN PIXELS (v0.8 pixel art pass): the view of the pad through a periscope or on a small screen, painted on
// the pixel grid (js/stage/pixel.js) instead of shrinking the site's full-size painting, whose thin lines vanished at
// this size. The same things show as on the site: the sky at this hour, the range behind (the Organ Mountains and the
// desert at White Sands, the sea and the scrub at the Cape), the tower, the round in it or climbing out of it with its
// flame and smoke, and the day's weather over it all.
import { skyFor, flyingRise } from '../site/draw.js';
import { weatherNow, weatherWash } from './fx/weather-day.js';
import { bayer, css } from './pixel.js';

// Each round's shape at this size: width and height in pixels, body and nose colours, fins, a roll pattern.
const SHAPES = {
  wac: { w: 2, h: 14, body: 0xefe9dc, nose: 0xc23b2b, booster: 4 },
  aerobee: { w: 2, h: 17, body: 0xd9dde0, nose: 0xc23b2b, booster: 5 },
  v2: { w: 4, h: 22, body: 0xefe9dc, nose: 0x2b2b2b, fins: true, checks: true },
  bumper: { w: 4, h: 22, body: 0xefe9dc, nose: 0x2b2b2b, fins: true, checks: true, top: 7 },
  viking: { w: 3, h: 24, body: 0xc9ced3, nose: 0x9aa0a6, fins: true },
  vanguard: { w: 3, h: 26, body: 0xf1f1ec, nose: 0x8a8f95, fins: false },
  juno: { w: 4, h: 27, body: 0xf1f1ec, nose: 0x2b2b2b, fins: false, stripes: true },
  redstone: { w: 4, h: 26, body: 0xf1f1ec, nose: 0x2b2b2b, fins: true },
  ranger: { w: 5, h: 30, body: 0xc9ced3, nose: 0x6a6f75, fins: false },
};
const shapeOf = v => SHAPES[v] || { w: 4, h: 26, body: 0xf1f1ec, nose: 0x2b2b2b, fins: true };

const SKY_DAY = ['#5d8fc4', '#a9c8e4', '#ead9b8'];

// Paints the pad into ctx, a canvas size x size (one canvas pixel per art pixel).
export function paintPad(ctx, g, size) {
  const put = (x, y, w, h, c) => {
    ctx.fillStyle = css(c);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const ground = Math.round(size * 0.8);
  // The sky: three bands, dithered together.
  const sky = skyFor(g.clock % 1440) || SKY_DAY;
  for (let y = 0; y < ground; y++) {
    const t = (y / ground) * 2,
      k = Math.min(1, Math.floor(t)),
      f = t - k;
    for (let x = 0; x < size; x++) put(x, y, 1, 1, f > bayer(x, y) ? sky[k + 1] : sky[k]);
  }
  const cape = g.site === 'cape';
  if (cape) {
    put(0, ground - 4, size, 2, 0x3f6f8f);
    put(0, ground - 2, size, 2, 0x5b7a3c);
  } else
    for (let x = 0; x < size; x++) {
      const h = Math.round(3 + 2 * Math.sin(x * 0.33 + 1) + Math.sin(x * 0.9));
      put(x, ground - h, 1, h, 0x8c86a0);
      put(x, ground - h, 1, 1, 0xa39cb5);
    }
  for (let y = ground; y < size; y++)
    for (let x = 0; x < size; x++)
      put(x, y, 1, 1, cape ? ((x * 7 + y * 3) % 9 ? 0xd9cfa6 : 0xc8bd92) : (x * 7 + y * 3) % 11 ? 0xd8c39a : 0xc4ab80);
  put(0, ground, size, 1, cape ? 0xb9ad84 : 0x9a8a6c);

  // The tower: two legs and the bracing between them.
  const cx = Math.round(size / 2) + 3,
    top = ground - Math.round(size * 0.62);
  const leg = 0x3a3a3a,
    brace = 0x55524c;
  for (let y = top; y < ground; y++) {
    put(cx - 4, y, 1, 1, leg);
    put(cx + 4, y, 1, 1, leg);
    const k = (y - top) % 6;
    put(cx - 4 + Math.round((k / 6) * 8), y, 1, 1, brace);
  }
  put(cx - 5, top - 1, 11, 1, leg);
  put(cx - 6, ground - 1, 13, 1, 0x4a463f);

  // The round: in the tower, or climbing out of it.
  const s = shapeOf(g.vehicle);
  const where = g.rocket?.where;
  if (where === 'tower' || where === 'flying') {
    const rise = where === 'flying' ? Math.round(flyingRise(g) * (size / 400)) : 0;
    const base = ground - 2 - rise,
      x0 = cx - Math.floor(s.w / 2);
    const bodyTop = base - s.h;
    put(x0, bodyTop, s.w, s.h, s.body);
    put(x0 + s.w - 1, bodyTop + 1, 1, s.h - 1, 0xb8b2a6);
    if (s.checks)
      for (let y = bodyTop + 3; y < base; y += 4) put(x0 + ((y / 4) % 2 ? 0 : s.w / 2), y, s.w / 2, 2, 0x2b2b2b);
    if (s.stripes) for (let y = bodyTop + 4; y < base; y += 6) put(x0, y, s.w, 1, 0x2b2b2b);
    // The nose: a point.
    for (let i = 0; i < Math.ceil(s.w / 2) + 1; i++)
      put(x0 + i, bodyTop - (Math.ceil(s.w / 2) - i), s.w - 2 * i, 1, s.nose);
    if (s.top) put(cx - 1, bodyTop - s.top, 2, s.top, 0xefe9dc);
    if (s.fins) {
      put(x0 - 1, base - 4, 1, 4, 0x5d5d5d);
      put(x0 + s.w, base - 4, 1, 4, 0x5d5d5d);
    }
    if (s.booster) put(x0, base, s.w, Math.min(s.booster, 3), 0x8a8a8a);
    if (where === 'flying') {
      const t = g.time || 0;
      const len = 4 + Math.round(2 * Math.abs(Math.sin(t * 23)));
      for (let i = 0; i < len; i++) {
        const w = Math.max(1, s.w - Math.floor(i / 2));
        put(cx - Math.floor(w / 2), base + i, w, 1, i < 2 ? 0xfff2c0 : i < 4 ? 0xffb347 : 0xe2572b);
      }
      // The smoke left at the pad, spreading as she climbs.
      const spread = Math.min(16, 3 + rise / 3);
      for (let j = 0; j < 5; j++)
        for (let i = -spread; i <= spread; i++)
          if ((1 - Math.abs(i) / (spread + 1)) * (1 - j / 5) > bayer(cx + i, ground - j) * 0.9)
            put(cx + i, ground - 1 - j, 1, 1, j < 2 ? 0xd8d4cc : 0xeae6de);
    }
  }
  weatherWash(ctx, weatherNow(g), 0, 0, size, size, g.time || 0);
}
