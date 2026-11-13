// THE DAY'S WEATHER, worked out from the game alone (no Pixi), so the site, the blockhouse periscopes, the control
// room's TV and the range's tracking camera all show the same sky, and the tests can check it. fx/weather.js draws
// it on the site; weatherWash() lays it over a canvas picture (the periscopes and the TV shots). Nothing flashes.
import { dateOf } from '../../core/calendar.js';

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

// The weather now, from the game: the same call the site makes (stage/site.js), for every other view of the outdoors.
export function weatherNow(g, minute = (g.clock ?? 0) % 1440) {
  return weatherFor({
    day: g.day ?? 0,
    month: dateOf(g.day ?? 0).month,
    hour: minute / 60,
    cape: g.site === 'cape',
    windKmh: g.round?.wind?.kmh ?? null,
    seaState: g.mission?.cond?.seaState ?? null,
    force: forcedWeather(),
  });
}

// How a picture of the outdoors looks in this weather: how far the sky goes grey, the rain over it, the fog and dust
// over everything. Plain numbers, so both the canvas and the Pixi views can use them.
export function weatherLook(w) {
  return {
    grey: Math.min(0.85, w.overcast + Math.max(0, w.cloud - 0.5) * 0.35),
    rain: w.rain,
    fog: w.fog,
    dust: w.dust,
    slant: Math.min(0.6, (w.wind ?? 0) / 60),
  };
}

// Lay the weather over a canvas picture of the outdoors (x, y, w, h), already drawn. time: seconds, to move the rain.
// The rain is fine grey streaks falling steadily: no brightness changes from frame to frame.
export function weatherWash(ctx, wx, x, y, w, h, time = 0) {
  const L = weatherLook(wx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (L.grey > 0.02) {
    ctx.fillStyle = `rgba(118,124,132,${(0.6 * L.grey).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
  }
  if (L.dust > 0.02) {
    ctx.fillStyle = `rgba(196,170,128,${(0.45 * L.dust).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
  }
  if (L.fog > 0.02) {
    ctx.fillStyle = `rgba(222,226,228,${(0.7 * L.fog).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
  }
  if (L.rain > 0.02) {
    const n = Math.round(30 + 60 * L.rain),
      len = h * 0.08,
      fall = h * 0.9;
    ctx.strokeStyle = `rgba(210,216,224,${(0.45 * L.rain).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, h / 300);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sx = x + ((i * 0.618034 * w * 3) % w),
        sy = y + ((((i * 0.37) % 1) * h + time * fall) % (h + len)) - len;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - len * L.slant, sy + len);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// The weather as seen from higher up: below the cloud base all of it, above it none (k from 1 down to 0).
export function weatherBelow(w, k) {
  const q = Math.max(0, Math.min(1, k));
  return { ...w, cloud: w.cloud * q, overcast: w.overcast * q, rain: w.rain * q, fog: w.fog * q, dust: w.dust * q };
}
