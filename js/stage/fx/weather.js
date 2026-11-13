// THE WEATHER ON THE SITE (v0.8 visual pass). Each day has its weather, settled by the date and the place, so the same
// day always looks the same. It follows the climate: White Sands is mostly clear and dry, with heat haze in summer,
// dust when the wind is up, and the July and August monsoon's thunderheads over the mountains in the afternoon. The
// Cape is humid and hazy, with summer afternoon thunderstorms that build over the land and drift through as squalls,
// grey days of rain, and sea fog on winter mornings. The wind the forecast gave for the count (game.js siteWind) drives
// the dust and the rain's slant, and a rough sea in the recovery area (the mission's sea state) shows as a grey sea
// under low cloud.
// Nothing here flashes: there is no lightning (photosensitivity, fx/calm.js).
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { GROUND } from '../../data/white-sands.js';
import { puffTexture, gradientTexture } from '../kit.js';

const hash = (a, b) => {
  let h = Math.imul(a ^ Math.imul(b + 0x9e37, 2654435761), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp = v => Math.max(0, Math.min(1, v));
const ramp = (h, a, b) => clamp((h - a) / (b - a));

// The weather for a day. day: the game's day number; month 1..12; hour: of the day; windKmh: the forecast (or null);
// seaState: the recovery area's (or null). Pure, for the tests.
export const WEATHER_KEY = 'pa-weather';
export const WEATHER_KINDS = ['clear', 'cloud', 'storms', 'rain', 'fog', 'dust', 'rough'];
// The dev menu can force a kind of weather to look at (localStorage 'pa-weather').
export function forcedWeather() {
  try {
    const k = localStorage.getItem(WEATHER_KEY);
    return WEATHER_KINDS.includes(k) ? k : null;
  } catch {
    return null;
  }
}

export function weatherFor({ day, month, hour, cape, windKmh = null, seaState = null, force = null }) {
  const r = hash(day | 0, cape ? 2 : 1),
    r2 = hash(day | 0, 77);
  const summer = month >= 6 && month <= 9,
    monsoon = month === 7 || month === 8,
    winter = month <= 2 || month === 12;
  const wind = windKmh ?? Math.round(6 + 26 * r2 * r2);
  let kind = 'clear';
  if (cape) {
    if (seaState >= 5) kind = 'rough';
    else if (summer && r < 0.4) kind = 'storms';
    else if (r > 0.9) kind = 'rain';
    else if (winter && r > 0.6) kind = 'fog';
    else if (r > 0.65) kind = 'cloud';
  } else {
    if (monsoon && r < 0.35) kind = 'storms';
    else if (wind >= 25) kind = 'dust';
    else if (r > 0.8) kind = 'cloud';
  }
  if (force) kind = force;
  // How each part of the weather stands at this hour.
  const build = ramp(hour, 12.5, 15.5); // afternoon storms build over the land
  const w = {
    kind,
    wind,
    cloud: 0.25,
    overcast: 0,
    rain: 0,
    fog: 0,
    thunder: 0,
    dust: 0,
    haze: cape ? 0.25 : 0.1,
    devils: false,
    sea: cape && seaState >= 5 ? 1 : 0,
  };
  if (kind === 'cloud') w.cloud = 0.7;
  if (kind === 'rough') Object.assign(w, { cloud: 0.8, overcast: 0.55, haze: 0.35, wind: Math.max(wind, 30) });
  if (kind === 'rain') Object.assign(w, { cloud: 0.9, overcast: 0.75, rain: 0.8, haze: 0.4 });
  if (kind === 'fog') Object.assign(w, { fog: 1 - ramp(hour, 8.5, 10.5), haze: 0.4 });
  if (kind === 'storms') {
    w.thunder = build;
    w.cloud = 0.4 + 0.4 * build;
    // At the Cape a squall drifts over the site for a while in the late afternoon.
    if (cape) {
      const squall = clamp(1 - Math.abs(hour - (15.5 + r2 * 2)) / 0.6);
      w.rain = squall * 0.9;
      w.overcast = 0.2 * build + 0.5 * squall;
    } else w.overcast = 0.15 * build;
  }
  if (kind === 'dust')
    Object.assign(w, { dust: Math.max(0.5, clamp((wind - 18) / 20)), haze: 0.3, wind: Math.max(wind, 28) });
  // White Sands in summer: heat haze from late morning, and dust devils on calm hot afternoons.
  if (!cape && summer && kind !== 'storms') {
    w.haze = Math.max(w.haze, 0.3 * ramp(hour, 10, 13));
    w.devils = hour > 11 && hour < 17.5 && wind < 25;
  }
  return w;
}

// The scene's weather layers. Built once; update() each frame.
export function weatherLayers() {
  // Far: thunderheads and their rain shafts, behind the hills; an overcast sheet over the sky.
  const far = new Container();
  const heads = new Graphics();
  const shafts = new Graphics();
  const overcast = new Sprite();
  far.addChild(overcast, shafts, heads);
  // Between the hills and the ground: fog and haze.
  const mist = new Sprite();
  // On the ground: blowing dust and dust devils (world units).
  const ground = new Container();
  const blowing = new Graphics();
  const devilLayer = new Container();
  ground.addChild(blowing, devilLayer);
  // Over everything: the rain.
  const rain = new Graphics();
  let devils = [],
    mistKey = '',
    overKey = '';
  const drops = [...Array(320)].map(() => ({ x: Math.random(), y: Math.random(), s: 0.7 + Math.random() * 0.6 }));

  function update(w, L, { vw, camX, screen, s, t, dt }) {
    // Overcast: a grey sheet over the sky, darker at the top.
    const oKey = `${Math.round(w.overcast * 20)}|${Math.ceil(vw)}|${L.night > 0.5}`;
    if (oKey !== overKey) {
      overKey = oKey;
      overcast.texture?.destroy(true);
      const c = L.night > 0.5 ? '20,22,32' : '120,126,138';
      overcast.texture = gradientTexture([
        [0, `rgba(${c},${(0.85 * w.overcast).toFixed(2)})`],
        [1, `rgba(${c},${(0.45 * w.overcast).toFixed(2)})`],
      ]);
      overcast.position.set(0, -240);
      overcast.width = vw + 2;
      overcast.height = GROUND + 240;
    }
    overcast.visible = w.overcast > 0.01;
    // Thunderheads: towers of cloud that build through the afternoon, anvils spreading at the top, and grey rain
    // hanging under them. They sit at fixed places along the horizon, drifting slowly with the wind.
    heads.clear();
    shafts.clear();
    if (w.thunder > 0.02) {
      const lit = L.night > 0.4 ? 0x5a5a72 : L.sun.low > 0.5 ? 0xf2d2b8 : 0xf4f2ee,
        shade = L.night > 0.4 ? 0x2e2e40 : 0x9a9cac;
      for (const [x0, size] of [
        [0.18, 1],
        [0.62, 0.75],
        [0.95, 0.9],
      ]) {
        const x = ((((x0 * (vw + 600) + t * w.wind * 0.05 - camX * 0.05) % (vw + 600)) + vw + 600) % (vw + 600)) - 300;
        const h = 330 * size * w.thunder,
          base = 430,
          wd = 150 * size;
        // The tower of cloud: shaded lobes down its right side, sunlit ones over them on the left, a flat dark base.
        const lobes = [];
        for (let i = 0; i < 8; i++) {
          const k = i / 7;
          lobes.push([
            x + Math.sin(i * 2.3) * wd * 0.18,
            base - h * k * 0.92,
            wd * (0.62 - k * 0.22) * (0.6 + 0.4 * w.thunder),
          ]);
        }
        for (const [lx, ly, r] of lobes) heads.circle(lx + r * 0.22, ly + r * 0.12, r).fill(shade);
        for (const [lx, ly, r] of lobes) heads.circle(lx - r * 0.12, ly - r * 0.08, r * 0.86).fill(lit);
        heads.rect(x - wd * 0.62, base - 6, wd * 1.3, 10).fill(shade);
        // The anvil: spread flat at the top, blown downwind, a shadowed underside.
        if (w.thunder > 0.35) {
          const a = (w.thunder - 0.35) / 0.65,
            top = base - h;
          heads
            .poly([
              x - wd * 0.5,
              top + wd * 0.12,
              x - wd * 0.25,
              top - wd * 0.1,
              x + wd * (0.5 + 1.4 * a),
              top - wd * 0.12,
              x + wd * (0.68 + 1.6 * a),
              top - wd * 0.04,
              x + wd * (0.62 + 1.5 * a),
              top + wd * 0.06,
              x + wd * 0.35,
              top + wd * 0.3,
            ])
            .fill({ color: lit, alpha: 0.9 });
          heads
            .poly([
              x - wd * 0.3,
              top + wd * 0.16,
              x + wd * (0.62 + 1.5 * a),
              top + wd * 0.06,
              x + wd * 0.35,
              top + wd * 0.3,
            ])
            .fill({ color: shade, alpha: 0.6 });
        }
        // Rain hanging under the cloud.
        if (w.thunder > 0.5)
          for (let i = 0; i < 7; i++)
            shafts
              .rect(x - wd * 0.5 + i * wd * 0.15, base, wd * 0.1, 70)
              .fill({ color: 0x6a6e7c, alpha: 0.12 * (w.thunder - 0.5) * 2 });
      }
    }
    // Fog and haze: a pale band over the distance.
    const mk = `${Math.round(w.fog * 20)}|${Math.round(w.haze * 20)}|${Math.ceil(vw)}|${L.key}`;
    if (mk !== mistKey) {
      mistKey = mk;
      mist.texture?.destroy(true);
      const pale = L.night > 0.5 ? '70,74,96' : '232,232,226';
      const a = Math.min(0.92, w.fog * 0.85 + w.haze * 0.5);
      mist.texture = gradientTexture([
        [0, `rgba(${pale},0)`],
        [0.55, `rgba(${pale},${(a * 0.8).toFixed(2)})`],
        [1, `rgba(${pale},${a.toFixed(2)})`],
      ]);
      mist.position.set(0, 300 - 120 * w.fog);
      mist.width = vw + 2;
      mist.height = GROUND - 300 + 120 * w.fog + 10;
    }
    mist.visible = w.fog + w.haze > 0.02;

    // Blowing dust: low streaks racing along the ground with the wind.
    blowing.clear();
    if (w.dust > 0.02) {
      const speed = 60 + w.wind * 6;
      for (let i = 0; i < 40; i++) {
        const span = vw + 400,
          x = camX - 200 + ((((i * 97.3 + t * speed) % span) + span) % span),
          y = GROUND - 2 - ((i * 13) % 40),
          len = 30 + ((i * 7) % 40);
        blowing.rect(x, y, len, 2).fill({ color: 0xc9b089, alpha: 0.5 * w.dust });
      }
      blowing.rect(camX - 10, GROUND - 60, vw + 20, 62).fill({ color: 0xcdb48c, alpha: 0.22 * w.dust });
    }
    // Dust devils: a twisting column that wanders across the desert and dies away.
    if (w.devils && devils.length < 1 && Math.random() < dt * 0.04)
      devils.push({
        x: camX + Math.random() * vw,
        vx: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 20),
        age: 0,
        life: 20 + Math.random() * 15,
        puffs: [],
      });
    for (const d of devils) {
      d.age += dt;
      d.x += d.vx * dt;
      const strength = Math.sin((Math.PI * d.age) / d.life);
      if (Math.random() < 0.8 * strength) {
        const p = new Sprite(puffTexture());
        p.anchor.set(0.5);
        p.tint = 0xcdb48c;
        p.alpha = 0.3;
        p.scale.set(0.15);
        p.h = 0;
        p.a = Math.random() * 6.28;
        devilLayer.addChild(p);
        d.puffs.push(p);
      }
      for (let i = d.puffs.length - 1; i >= 0; i--) {
        const p = d.puffs[i];
        p.h += dt * 40;
        p.a += dt * 6;
        const r = 4 + p.h * 0.12;
        p.position.set(d.x + Math.cos(p.a) * r, GROUND - p.h);
        p.scale.set(0.12 + p.h * 0.002);
        p.alpha = 0.3 * Math.max(0, 1 - p.h / 150);
        if (p.h > 150) {
          p.destroy();
          d.puffs.splice(i, 1);
        }
      }
    }
    devils = devils.filter(d => {
      if (d.age < d.life || d.puffs.length) return true;
      return false;
    });
    if (!w.devils) for (const d of devils) d.age = Math.max(d.age, d.life);

    // Rain: streaks slanting with the wind, over the whole picture.
    rain.clear();
    if (w.rain > 0.02) {
      const n = Math.round(drops.length * w.rain),
        slant = Math.min(0.5, w.wind / 80),
        fall = screen.height * 1.6;
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += (fall * d.s * dt) / screen.height;
        d.x += (fall * slant * d.s * dt) / screen.width;
        if (d.y > 1) {
          d.y -= 1;
          d.x = Math.random();
        }
        if (d.x > 1) d.x -= 1;
        const x = d.x * screen.width,
          y = d.y * screen.height,
          len = 14 * s * d.s;
        rain
          .moveTo(x, y)
          .lineTo(x - slant * len, y - len)
          .stroke({ width: 1, color: L.night > 0.5 ? 0x9aa4c0 : 0xdfe6ee, alpha: 0.35 });
      }
    }
  }
  // How the weather dims the site: grey under overcast and rain, a touch lighter in fog.
  const tint = w => {
    const k = Math.max(w.overcast * 0.35, w.rain * 0.25);
    const v = Math.round(255 * (1 - k));
    const b = Math.round(255 * (1 - k * 0.8));
    return (v << 16) | (v << 8) | b;
  };
  return { far, mist, ground, rain, update, tint };
}

// Multiplies two tints channel by channel.
export function mulTint(a, b) {
  const ch = s => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
