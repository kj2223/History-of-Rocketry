// THE MOON ON MISSION CONTROL'S BIG SCREEN (v0.8). On a flight to the Moon the front wall's middle screen stops showing
// the world map once she has left Earth orbit, as the MOCR's did: the translunar plot, with Earth, the Moon and the
// free-return figure eight between them and the spacecraft on it; the Moon with her orbit and the far side where the
// signal is lost; the powered descent as altitude against range to go, with the high and low gates; and, once down, the
// near side with the landing site. Every reading the screen shows is the flight's own (where she is, the board's
// lamps, the mission clock). Steady drawing only: the picture is redrawn when the flight moves on, and nothing flashes.
// Reads only what the room could see (c.flight, through game.js's console); never js/truth.
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { FLIGHTS } from '../data/flights.js';
import { label, setText } from './kit.js';
import { moonTexture } from './deep.js';

export const MOON_DISTANCE_KM = 384400;
// Where each landing was (or was aimed): latitude and longitude on the near side, east positive, as seen from Earth.
export const LANDING_SITES = {
  'apollo-11': [0.674, 23.473, 'SEA OF TRANQUILLITY'],
  'apollo-12': [-3.012, -23.422, 'OCEAN OF STORMS'],
  'apollo-13': [-3.67, -17.47, 'FRA MAURO'],
  'apollo-15': [26.132, 3.634, 'HADLEY-APENNINE'],
  'apollo-16': [-8.973, 15.5, 'DESCARTES'],
  'apollo-17': [20.191, 30.772, 'TAURUS-LITTROW'],
  'artemis-4': [-89.4, 0, 'SOUTH POLE'],
};
const HOME_PHASES = ['Trans-Earth injection', 'Coast home', 'Coming home', 'Entry'];
const ORBIT_HOURS = 2; // a low lunar orbit takes about two hours
// The descent's two gates (Apollo's): the high gate, where the crew first see the site, and the low gate, from where
// the commander flies her down by hand.
const GATES = [
  [0.68, 'HIGH GATE'],
  [0.88, 'LOW GATE'],
];

// Which picture the big screen shows, or null for the world map.
export function moonWallMode(c) {
  const f = c?.flight;
  if (!f || FLIGHTS[f.id]?.entry !== 'lunar') return null;
  if (f.phase === 'Powered descent') return 'descent';
  if (f.phase === 'On the surface') return 'surface';
  if (f.where && f.where.x >= 0.05) return f.where.x >= 0.97 && !HOME_PHASES.includes(f.phase) ? 'orbit' : 'translunar';
  return null;
}

// How far through the powered descent she is (0 at ignition, 1 on the surface): the descent's steps spread over it,
// so the calls come where they did, the low-fuel call in the last few hundred feet.
export function descentShare(f) {
  const steps = FLIGHTS[f.id]?.steps || [];
  const i = steps.findIndex(s => s.phase === 'Powered descent');
  if (i < 0) return 0;
  const start = steps[i].at;
  let end = start;
  for (let k = i + 1; k < steps.length && !steps[k].phase; k++) end = Math.max(end, steps[k].at);
  end += 0.03;
  return Math.max(0, Math.min(0.97, (f.at - start) / Math.max(0.01, end - start)));
}
// The descent's profile, stylised from Apollo's: from 15 km up and about 480 km out at ignition to the ground.
export const descentAltitude = s => 15000 * Math.pow(1 - s, 1.6);
export const descentRange = s => 480 * Math.pow(1 - s, 3);

// The spacecraft's place along the figure eight: 0 at Earth, 1 at the Moon, out and back.
export const legOf = f => (HOME_PHASES.includes(f.phase) ? 'home' : 'out');
// Behind the Moon, the signal is lost: the half of each orbit on the far side.
export const orbitAngle = f => ((f.at / ORBIT_HOURS) % 1) * Math.PI * 2;
export const behindMoon = f => Math.sin(orbitAngle(f)) > 0;

const fmt = n => Math.round(n).toLocaleString('en-US');
const get = h => {
  const t = Math.max(0, Math.round(h * 60));
  return `${String(Math.floor(t / 60)).padStart(3, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export function moonWall(look) {
  const root = new Container();
  root.visible = false;
  const frame = new Graphics();
  const plot = new Graphics();
  const moon = new Sprite(moonTexture());
  moon.anchor.set(0.5);
  const over = new Graphics();
  const words = new Container();
  root.addChild(frame, plot, moon, over, words);
  const pool = [];
  let used = 0;
  const word = (text, size, color, x, y, ax = 0, ay = 0.5) => {
    let t = pool[used];
    if (!t) {
      t = pool[used] = label('', size, color, { ax, ay });
      words.addChild(t);
    }
    used++;
    t.visible = true;
    t.style.fontSize = size;
    t.style.fill = color;
    t.anchor.set(ax, ay);
    t.position.set(x, y);
    setText(t, text);
    return t;
  };
  let at = [0, 0, 100, 60],
    key = '';
  root.place = (x, y, w, h) => {
    at = [x, y, w, h];
    frame.clear().rect(x, y, w, h).fill(look.glass);
    key = '';
  };
  const dashed = (pts, color, alpha, width, on = 6, off = 5) => {
    let acc = 0,
      draw = true;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i];
      if (draw) plot.moveTo(x0, y0).lineTo(x1, y1);
      acc += Math.hypot(x1 - x0, y1 - y0);
      if (acc > (draw ? on : off)) {
        acc = 0;
        draw = !draw;
      }
    }
    plot.stroke({ width, color, alpha });
  };
  const bez = (p0, p1, p2, n = 40) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        a = (1 - t) ** 2,
        b = 2 * (1 - t) * t,
        c = t * t;
      return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
    });
  const along = (pts, u) => pts[Math.max(0, Math.min(pts.length - 1, Math.round(u * (pts.length - 1))))];

  // Returns true when it has the screen (the world map then hides).
  root.draw = c => {
    const mode = moonWallMode(c);
    root.visible = !!mode;
    if (!mode) return false;
    const f = c.flight;
    const [x, y, w, h] = at;
    const k = `${mode}|${f.phase}|${Math.floor(f.at * 60)}|${JSON.stringify(f.status)}|${w}|${h}`;
    if (k === key) return true;
    key = k;
    plot.clear();
    over.clear();
    for (const t of pool) t.visible = false;
    used = 0;
    moon.visible = false;
    const fs = Math.max(9, Math.round(w / 48)),
      ink = look.ink,
      dim = look.dim,
      amber = 0xe8c66a;
    // The grid every display on the wall carries, faint.
    for (let gx = x + w / 12; gx < x + w; gx += w / 12) plot.rect(gx, y, 1, h).fill({ color: look.rule, alpha: 0.6 });
    for (let gy = y + h / 8; gy < y + h; gy += h / 8) plot.rect(x, gy, w, 1).fill({ color: look.rule, alpha: 0.6 });
    const title = (t, sub) => {
      word(t, fs * 1.15, ink, x + fs, y + fs * 1.2);
      if (sub) word(sub, fs * 0.85, dim, x + fs, y + fs * 2.5);
      word(`GET ${get(f.at)}`, fs, amber, x + w - fs, y + fs * 1.2, 1);
    };
    // The readings along the foot of the screen, in columns, clear of the plot.
    const rows = list => {
      const cw = (w - fs * 2) / Math.max(4, list.length),
        y0 = y + h - fs * 2.7;
      plot.rect(x + fs * 0.5, y0 - fs * 0.9, w - fs, 1).fill({ color: look.rule, alpha: 1 });
      list.forEach(([kk, v, warn], i) => {
        word(kk, fs * 0.75, dim, x + fs + i * cw, y0);
        word(String(v).toUpperCase(), fs, warn ? amber : ink, x + fs + i * cw, y0 + fs * 1.15);
      });
    };
    const lamp = name => {
      const v = f.status?.[name];
      return v ? [name, v[0], !!v[1]] : null;
    };

    if (mode === 'translunar' || mode === 'orbit') {
      const cy = y + h * 0.47,
        E = [x + w * 0.13, cy],
        M = [x + w * 0.8, cy],
        re = h * 0.11,
        rm = h * 0.06;
      // Earth, lit from the left, with its night side.
      plot.circle(E[0], E[1], re).fill(0x2d5d8a);
      plot.circle(E[0] - re * 0.25, E[1] - re * 0.2, re * 0.55).fill({ color: 0x3f8a5c, alpha: 0.7 });
      plot
        .moveTo(E[0], E[1] - re)
        .arc(E[0], E[1], re, -Math.PI / 2, Math.PI / 2)
        .closePath()
        .fill({ color: 0x050a10, alpha: 0.45 });
      word('EARTH', fs * 0.8, dim, E[0], E[1] - re - fs * 0.8, 0.5);
      moon.visible = true;
      moon.position.set(M[0], M[1]);
      moon.width = moon.height = rm * 2;
      word('MOON', fs * 0.8, dim, M[0] + rm * 2.6, M[1], 0);
      // The free-return figure eight: out above the line, round the far side, home below it.
      const loopR = rm * 1.9;
      const out = bez(
        [E[0] + re * 0.8, E[1] - re * 0.6],
        [(E[0] + M[0]) / 2, cy - h * 0.3],
        [M[0] - loopR * 0.7, M[1] - loopR * 0.7],
      );
      const loop = Array.from({ length: 31 }, (_, i) => {
        const a = -Math.PI * 0.75 + (i / 30) * Math.PI * 1.5;
        return [M[0] + Math.cos(a) * loopR, M[1] + Math.sin(a) * loopR];
      });
      const home = bez(
        [M[0] - loopR * 0.7, M[1] + loopR * 0.7],
        [(E[0] + M[0]) / 2, cy + h * 0.3],
        [E[0] + re * 0.8, E[1] + re * 0.6],
      );
      dashed(out, ink, 0.55, 1.5);
      dashed(loop, ink, 0.35, 1.2);
      dashed(home, ink, 0.55, 1.5);
      const leg = legOf(f);
      let pos;
      if (mode === 'orbit') {
        // In lunar orbit: the ring round the Moon, and her place on it. On the far side, the signal is lost.
        const ro = rm * 1.35,
          a = orbitAngle(f);
        plot.circle(M[0], M[1], ro).stroke({ width: 1.2, color: ink, alpha: 0.6 });
        pos = [M[0] + Math.sin(a) * ro, M[1] - Math.cos(a) * ro];
        // The far side, away from Earth, shaded on the plot.
        over
          .moveTo(M[0], M[1] - ro * 1.25)
          .arc(M[0], M[1], ro * 1.25, -Math.PI / 2, Math.PI / 2)
          .closePath()
          .fill({ color: 0x000000, alpha: 0.28 });
        word(
          behindMoon(f) ? 'LOSS OF SIGNAL · BEHIND THE MOON' : 'IN SIGHT OF EARTH',
          fs * 0.85,
          behindMoon(f) ? amber : ink,
          x + w - fs,
          y + fs * 2.6,
          1,
        );
      } else {
        const u = Math.min(1, f.where.x / 0.97);
        pos = leg === 'out' ? along(out, u) : along(home, 1 - u);
        // Her track so far, solid behind her.
        const done =
          leg === 'out'
            ? out.slice(0, Math.round(u * 40) + 1)
            : [...out, ...loop, ...home.slice(0, Math.round((1 - u) * 40) + 1)];
        if (done.length > 1) plot.poly(done.flat(), false).stroke({ width: 2.2, color: ink, alpha: 0.95 });
      }
      plot.circle(pos[0], pos[1], Math.max(3, fs * 0.35)).fill(0xffffff);
      plot.circle(pos[0], pos[1], Math.max(6, fs * 0.7)).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      title(
        mode === 'orbit' ? 'LUNAR ORBIT' : leg === 'out' ? 'TRANSLUNAR' : 'TRANSEARTH',
        `${(f.craft || '').toUpperCase()} · ${String(f.where?.label || f.phase).toUpperCase()}`,
      );
      const km = mode === 'orbit' ? MOON_DISTANCE_KM : f.where.x * MOON_DISTANCE_KM;
      rows(
        [
          ['FROM EARTH KM', fmt(km)],
          mode === 'orbit'
            ? ['ONE ORBIT', `ABOUT ${ORBIT_HOURS} H`]
            : ['TO THE MOON KM', fmt(Math.max(0, MOON_DISTANCE_KM - km))],
          lamp('SPS'),
          lamp('LM'),
        ].filter(Boolean),
      );
      return true;
    }

    if (mode === 'descent') {
      const s = descentShare(f);
      const px0 = x + w * 0.08,
        px1 = x + w * 0.72,
        py0 = y + h * 0.24,
        py1 = y + h * 0.7;
      // Altitude against range to go, both on root scales so the last minutes are not lost in a corner.
      const X = r => px1 - Math.sqrt(r / 480) * (px1 - px0),
        Y = a => py1 - Math.sqrt(a / 15000) * (py1 - py0);
      plot.rect(px0, py1, px1 - px0, 1.5).fill({ color: dim, alpha: 0.9 });
      plot.rect(px1, py0, 1.5, py1 - py0).fill({ color: dim, alpha: 0.9 });
      const path = Array.from({ length: 61 }, (_, i) => [X(descentRange(i / 60)), Y(descentAltitude(i / 60))]);
      dashed(path, ink, 0.5, 1.5);
      const flown = Array.from({ length: Math.max(2, Math.round(s * 60) + 1) }, (_, i) => {
        const t = Math.min(s, i / 60);
        return [X(descentRange(t)), Y(descentAltitude(t))];
      });
      plot.poly(flown.flat(), false).stroke({ width: 2.4, color: ink });
      for (const [gs, name] of GATES) {
        const gx = X(descentRange(gs)),
          gy = Y(descentAltitude(gs));
        plot.rect(gx - 4, gy - 4, 8, 8).stroke({ width: 1.2, color: amber, alpha: 0.85 });
        word(name, fs * 0.75, amber, gx + 8, gy - 10);
      }
      const [hx, hy] = [X(descentRange(s)), Y(descentAltitude(s))];
      plot.circle(hx, hy, Math.max(3, fs * 0.35)).fill(0xffffff);
      word('ALTITUDE', fs * 0.75, dim, px1 + 6, py0, 0);
      word('◂ RANGE TO GO', fs * 0.75, dim, px0, py1 + fs * 0.8, 0);
      const site = LANDING_SITES[f.id];
      title('POWERED DESCENT', `${(f.craft || '').toUpperCase()}${site ? ` · TO ${site[2]}` : ''}`);
      rows(
        [
          ['ALTITUDE M', fmt(descentAltitude(s))],
          ['RANGE KM', descentRange(s).toFixed(descentRange(s) < 10 ? 1 : 0)],
          lamp('DESCENT FUEL'),
          lamp('LM COMPUTER'),
        ].filter(Boolean),
      );
      return true;
    }

    // On the surface: the near side as seen from Earth, and the site.
    const r = Math.min(w * 0.3, h * 0.3),
      cx = x + w * 0.5,
      cy = y + h * 0.48;
    moon.visible = true;
    moon.position.set(cx, cy);
    moon.width = moon.height = r * 2;
    plot.circle(cx, cy, r).stroke({ width: 1, color: ink, alpha: 0.4 });
    for (const lat of [-60, -30, 0, 30, 60])
      plot
        .rect(
          cx - r * Math.cos((lat * Math.PI) / 180),
          cy - r * Math.sin((lat * Math.PI) / 180),
          2 * r * Math.cos((lat * Math.PI) / 180),
          1,
        )
        .fill({ color: ink, alpha: 0.25 });
    const site = LANDING_SITES[f.id];
    if (site) {
      const [lat, lon] = site,
        la = (lat * Math.PI) / 180,
        lo = (lon * Math.PI) / 180;
      const sx = cx + r * Math.cos(la) * Math.sin(lo),
        sy = cy - r * Math.sin(la);
      over
        .circle(sx, sy, Math.max(5, fs * 0.6))
        .stroke({ width: 2, color: amber })
        .moveTo(sx - fs * 1.4, sy)
        .lineTo(sx - fs * 0.7, sy)
        .moveTo(sx + fs * 0.7, sy)
        .lineTo(sx + fs * 1.4, sy)
        .moveTo(sx, sy - fs * 1.4)
        .lineTo(sx, sy - fs * 0.7)
        .moveTo(sx, sy + fs * 0.7)
        .lineTo(sx, sy + fs * 1.4)
        .stroke({ width: 1.5, color: amber });
      word(site[2], fs * 0.85, amber, sx + fs * 1.6, sy - fs * 0.8);
    }
    const steps = FLIGHTS[f.id]?.steps || [];
    const down = steps.find(s => s.phase === 'On the surface')?.at ?? f.at;
    title('ON THE SURFACE', `${(f.craft || '').toUpperCase()}${site ? ` · ${site[2]}` : ''}`);
    const lat = site?.[0] ?? 0,
      lon = site?.[1] ?? 0;
    rows(
      [
        ['ON THE MOON H:M', get(Math.max(0, f.at - down)).replace(/^0/, '')],
        [
          'SITE',
          `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`,
        ],
        lamp('LM'),
      ].filter(Boolean),
    );
    return true;
  };
  return root;
}
