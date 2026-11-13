// MISSION CONTROL, rebuilt in PixiJS (v0.8), first pass. The room is drawn here: the back wall and carpet, the
// equipment racks on the left with their lamps, the viewing gallery on the right, every console desk with its seated
// controller, its live screens and a lamp when that station has something lit, and the monitoring screen, which now
// carries all of the flight's telemetry: the climb on three strip charts (off the planned path against the abort
// limit, velocity, acceleration, with the staging marked), the orbit's status board in orbit, and the flight plan's
// place once she is in the flight proper. The wall map and the pad television still come from the old drawing as
// pictures until they are rebuilt. The clocks, the loop, the flight-plan rack and your panel stay HTML, over the
// same places on the wall as before. Reads only what the room could see, through game.js and the site drawing.
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { drawWallMap, controlTelevision, controlDesks, deskLines, uiEra, yearOf } from '../site/draw.js';
import { dayOf } from '../core/calendar.js';
import { label, setText, colorOf, canvasPicture, gradientTexture, puffTexture } from './kit.js';

// The room's look by era, as the interface's: console steel with green screens through Apollo, the Shuttle years'
// amber terminals, the flat grey monitors of 1996–2015, and the dark glass room of 2028 with its blue light.
export const LOOKS = {
  steel: {
    wall: ['#202831', '#343f47', '#20272c'],
    carpet: ['#2a3031', '#423d33', '#292824'],
    enamel: ['#5c646a', '#414950', '#343a40'],
    trim: 0x626a71,
    glass: 0x161e24,
    glassTop: 0x243139,
    ink: 0x9fdc9a,
    dim: 0x5a6a60,
    rule: 0x31413a,
    pool: 0xefc683,
    rack: 0x2c3138,
    screens: 0xffffff, // the old drawing's wall pictures, tinted to the room's screens
  },
  amber: {
    wall: ['#2a2622', '#3d3730', '#25221e'],
    carpet: ['#2d2a26', '#4a3d2e', '#2a2520'],
    enamel: ['#6e675c', '#4f4a42', '#3a3631'],
    trim: 0x7a7266,
    glass: 0x1a130b,
    glassTop: 0x2c2216,
    ink: 0xffb347,
    dim: 0x8a6a40,
    rule: 0x4a3a22,
    pool: 0xf0b070,
    rack: 0x35302a,
    screens: 0xffcf8a, // the old drawing's wall pictures, tinted to the room's screens
  },
  desktop: {
    wall: ['#4a525c', '#5d6670', '#3f464e'],
    carpet: ['#2f3a48', '#3a4656', '#28313c'],
    enamel: ['#a3a6a8', '#86898c', '#6c6f72'],
    trim: 0xb8bbbe,
    glass: 0x16305a,
    glassTop: 0x24467a,
    ink: 0xdbe8f4,
    dim: 0x7f93ad,
    rule: 0x2c4466,
    pool: 0xdfe6f0,
    rack: 0x3a4048,
    screens: 0xffffff, // the old drawing's wall pictures, tinted to the room's screens
  },
  glass: {
    wall: ['#0a0e14', '#141b25', '#0b0f15'],
    carpet: ['#0f1318', '#161c24', '#0c0f13'],
    enamel: ['#2a2f37', '#1f232a', '#16191e'],
    trim: 0x3fa9d8,
    glass: 0x07121c,
    glassTop: 0x0f2436,
    ink: 0x7fd7ff,
    dim: 0x3f6a85,
    rule: 0x15324a,
    pool: 0x4a9fd8,
    rack: 0x161b22,
    screens: 0xa8e4ff, // the old drawing's wall pictures, tinted to the room's screens
  },
};
export const lookOf = g => LOOKS[uiEra(g)] || LOOKS.steel;

// Which room the flight is run from, each drawn as its own:
//  - 'cape': Mercury Control at the Cape (1960 to Gemini 3): one big world map, the TV and the monitor beside it;
//  - 'mocr': Houston's Mission Operations Control Room (Gemini 4 in June 1965 to the mid-1990s): the front wall of five
//    projection screens, the big one in the middle with the map, the TV and the event lights on the left, the monitor
//    and the tracking stations' status board on the right; the floor stepped up in tiers behind the trench;
//  - 'fcr': the new flight control room (1996 on, and Artemis): one seamless video wall of tiles with the map, the TV,
//    the monitor and data windows in it, and a light strip along its top.
export const roomOf = g => ((g.day ?? 0) < dayOf(1965, 6, 1) ? 'cape' : yearOf(g) < 1996 ? 'mocr' : 'fcr');
// The tracking stations on the MOCR's status board, as the network was in each period.
export const STATIONS = [
  [1965, ['BDA', 'CYI', 'CRO', 'HAW', 'GYM', 'TEX', 'RKV', 'CSQ']],
  [1969, ['GDS', 'MAD', 'HSK', 'BDA', 'GWM', 'HAW', 'ACN', 'CRO']],
  [1981, ['BDA', 'MIL', 'GWM', 'HAW', 'GDS', 'MAD', 'CAN', 'TDRS']],
];
export const stationsFor = year => STATIONS.filter(([y]) => year >= y).at(-1)?.[1] ?? STATIONS[0][1];
const TONE = { warn: 0xe8c66a, bad: 0xd0634f };
const inkOf = (tone, look = LOOKS.steel) => TONE[tone] || look.ink;
const enamelTex = new Map(); // one gradient per look, shared by every desk
const LIMIT = 6; // the abort rule: six degrees off the planned line

// A console desk in its own units (190 wide, or 460 for yours, by 60), scaled by the room. Returns the container
// with update(c) to refresh its screens.
export function desk(d, look = LOOKS.steel) {
  const dw = d.yours ? 460 : 190,
    dh = 60;
  const c = new Container();
  const shadow = new Graphics().rect(5, dh, dw, 6).fill({ color: 0x0c0d0f, alpha: 0.38 });
  c.addChild(shadow);
  if (d.who) {
    const p = new Graphics();
    const px = dw / 2;
    p.rect(px - 18, -19, 36, 21).fill(0x272d32);
    p.rect(px - 14, -25, 28, 27).fill(colorOf(d.who.color || '#4a5568'));
    p.circle(px, -31, 8).fill(0xe2b993);
    p.moveTo(px - 7, -31)
      .arc(px, -31, 7, Math.PI, 2 * Math.PI)
      .stroke({ width: 2, color: 0x373b3e });
    if (d.who.hat) p.rect(px - 10, -38, 20, 4).fill(colorOf(d.who.hat));
    c.addChild(p);
  }
  if (!enamelTex.has(look))
    enamelTex.set(
      look,
      gradientTexture([
        [0, look.enamel[0]],
        [0.75, look.enamel[1]],
        [1, look.enamel[2]],
      ]),
    );
  const enamel = new Sprite(enamelTex.get(look));
  enamel.width = dw;
  enamel.height = dh;
  const trim = new Graphics()
    .rect(0, 0, dw, 10)
    .fill(look.trim)
    .rect(dw * 0.92, 0, dw * 0.08, dh)
    .fill({ color: 0x000000, alpha: 0.08 })
    .rect(1, 1, dw - 2, 1)
    .fill({ color: 0xdce4d7, alpha: 0.24 })
    .rect(0, dh - 3, dw, 3)
    .fill(0x262b30);
  c.addChild(enamel, trim);
  const offs = d.yours ? [10, 125, 240, 355] : [12, 100],
    sw = d.yours ? 105 : 74,
    sh = 30;
  const texts = [];
  for (const off of offs) {
    const glass = new Graphics()
      .rect(off - 2, 14, sw + 4, sh + 4)
      .fill(0x0d1117)
      .rect(off, 16, sw, sh)
      .fill(look.glass)
      .rect(off, 16, sw, sh * 0.35)
      .fill({ color: look.glassTop, alpha: 0.6 })
      .rect(off + 2, 18, sw - 4, 1)
      .fill({ color: 0xb2c8c5, alpha: 0.14 });
    const t = label('', 9, look.ink, { ax: 0, ay: 0.5 });
    t.position.set(off + 5, 31);
    const mask = new Graphics().rect(off, 16, sw, sh).fill(0xffffff);
    t.mask = mask;
    c.addChild(glass, mask, t);
    texts.push(t);
  }
  const name = label(d.label, 8, 0xc9d2da, { family: 'Arial, sans-serif', ax: 0, ay: 1 });
  name.position.set(10, dh - 4);
  c.addChild(name);
  // A station lamp, top right: lit amber or red when that station has something on its board.
  const lampG = new Graphics().circle(dw - 10, 5, 3.2).fill(0xffffff);
  lampG.visible = false;
  c.addChild(lampG);
  if (d.yours) {
    const mark = new Graphics()
      .poly([dw / 2 - 7, -44, dw / 2 + 7, -44, dw / 2, -51])
      .fill(0xe8c66a)
      .rect(3, 1, dw - 6, dh - 4)
      .stroke({ width: 2, color: 0xe8c66a });
    c.addChild(mark);
  }
  c.update = (con, t) => {
    const [lines, tone] = deskLines(con, d.duty, d.yours);
    texts.forEach((tx, i) => {
      setText(tx, lines[i] ?? '');
      tx.style.fill = inkOf(tone, look);
    });
    const lit = tone === 'bad' || tone === 'warn';
    lampG.visible = lit && (tone === 'warn' || Math.sin(t * 7) > -0.3);
    lampG.tint = inkOf(tone, look);
  };
  return c;
}

// The monitoring screen, as a piece any console room can hang on its wall: place(x, y, w, h) once the room knows its
// size, then draw(c) every frame; it redraws only when the telemetry has moved on.
export function telemetryScreen(look = LOOKS.steel) {
  const c0 = new Container();
  let at = [0, 0, 100, 60];
  // The monitoring screen: a frame and its glass, the plot drawn fresh when the telemetry moves on.
  const monFrame = new Graphics();
  const plot = new Graphics();
  const monTitle = label('', 12, look.dim, { ax: 0, ay: 0 });
  const monWords = new Container();
  c0.addChild(monFrame, plot, monTitle, monWords);
  const words = [];
  const word = (i, size, color, ax = 0) => {
    let t = words[i];
    if (!t) {
      t = words[i] = label('', size, color, { ax, ay: 0.5 });
      monWords.addChild(t);
    }
    t.visible = true;
    t.style.fontSize = size;
    t.style.fill = color;
    t.anchor.x = ax;
    return t;
  };
  let monKey = '';
  c0.place = (mx, my, mw, mh) => {
    at = [mx, my, mw, mh];
    monFrame
      .clear()
      .rect(mx - 6, my - 6, mw + 12, mh + 12)
      .fill(0x181b1f)
      .rect(mx, my, mw, mh)
      .fill(look.glass);
    monTitle.position.set(mx + 6, my + 4);
    monTitle.style.fontSize = Math.max(9, Math.round(mw / 30));
    monKey = '';
  };
  // The monitoring screen's telemetry, drawn fresh only when there is something new to show.
  c0.draw = c => {
    const [x, y, w, h] = at;
    const trace = c?.trace || [];
    const inFlight = c?.flight && !['ascent', 'insertion'].includes(c.phase);
    const inOrbit = !inFlight && c?.orbitT != null && c.status;
    const key = inFlight
      ? `f${c.flight.phaseNo}|${c.flight.phase}|${!!c.flight.decision}|${Math.floor(c.flight.at * 60)}`
      : inOrbit
        ? `o${JSON.stringify(c.status)}|${c.phase}`
        : `a${trace.length}|${w}|${h}`;
    if (key === monKey) return;
    monKey = key;
    plot.clear();
    for (const t of words) t.visible = false;
    const fs = Math.max(9, Math.round(w / 34));
    const top = y + fs + 12;
    if (inFlight) {
      const f = c.flight;
      setText(monTitle, `FLIGHT PLAN · ${(f.craft || '').toUpperCase()}`);
      const n = Math.max(1, f.phases || 1),
        at = Math.min(f.phaseNo || 1, n);
      const bw = (w - 24) / n,
        body = y + h - top,
        barH = Math.max(6, body * 0.12);
      for (let i = 0; i < n; i++)
        plot
          .rect(x + 12 + i * bw + 1, top + 4, bw - 2, barH)
          .fill(i + 1 < at ? 0x2f5a3a : i + 1 === at ? 0xe8c66a : 0x1f2a30);
      const rowY = k => top + 4 + barH + (body - barH - 4) * k;
      word(0, fs * 1.25, 0xe8c66a).position.set(x + 12, rowY(0.22));
      setText(words[0], `PHASE ${at} OF ${n}`);
      word(1, fs * 1.1, look.ink).position.set(x + 12, rowY(0.52));
      setText(words[1], (f.phase || '').toUpperCase());
      word(2, fs, f.decision ? 0xe8c66a : look.dim).position.set(x + 12, rowY(0.8));
      setText(words[2], f.decision ? 'A CALL IS WAITING' : 'NOMINAL');
      return;
    }
    if (inOrbit) {
      const s = c.status;
      setText(monTitle, 'ORBIT STATUS');
      const rows = [
        ['ORBIT', `${s.orbit ?? '-'} OF 3`, 'go'],
        ['OVER', String(s.station ?? '-').toUpperCase(), 'go'],
        ['FUEL', `${Math.round((s.fuel ?? 1) * 100)}%`, (s.fuel ?? 1) < 0.4 ? 'warn' : 'go'],
        [
          'SEG 51',
          String(s.seg51 && s.seg51 !== 'off' ? s.seg51 : 'off').toUpperCase(),
          s.seg51 && s.seg51 !== 'off' ? 'bad' : 'go',
        ],
        ['ATTITUDE', String(s.attitude ?? '-').toUpperCase(), s.attitude && s.attitude !== 'normal' ? 'warn' : 'go'],
      ];
      const rh = (y + h - top - 6) / rows.length;
      rows.forEach(([k, v, tone], i) => {
        const ry = top + rh * (i + 0.5);
        word(i * 2, fs, look.dim).position.set(x + 12, ry);
        setText(words[i * 2], k);
        word(i * 2 + 1, fs * 1.15, inkOf(tone, look)).position.set(x + w * 0.38, ry);
        setText(words[i * 2 + 1], v);
      });
      // The fuel as a bar, beside its figure.
      const fy = top + rh * 2.5;
      plot.rect(x + w * 0.62, fy - 5, w * 0.33, 10).fill(0x1f2a30);
      plot
        .rect(x + w * 0.62, fy - 5, w * 0.33 * Math.max(0, Math.min(1, s.fuel ?? 1)), 10)
        .fill(rows[2][2] === 'warn' ? TONE.warn : look.ink);
      return;
    }
    // The climb: three strips, each with its scale, its live figure, and the staging marked across all three.
    setText(monTitle, 'TELEMETRY · THE CLIMB');
    if (!trace.length) {
      word(0, fs * 1.3, look.dim, 0.5).position.set(x + w / 2, (top + y + h) / 2);
      setText(
        words[0],
        c && (c.phase === 'count' || c.phase === 'hold' || c.poll) ? 'STANDBY · AWAITING LIFTOFF' : 'STANDBY',
      );
      return;
    }
    const last = trace[trace.length - 1];
    const maxT = Math.max(c.burn || 0, last.t, 10);
    const left = x + 8,
      right = x + w - w * 0.22,
      px = t => left + (t / maxT) * (right - left);
    const vMax = Math.max(1, Math.ceil(Math.max(...trace.map(p => p.v)) * 1.15)),
      aMax = Math.max(4, Math.ceil(Math.max(...trace.map(p => p.acc)) * 1.15));
    const strips = [
      {
        name: 'OFF PLAN °',
        lo: -LIMIT * 1.25,
        hi: LIMIT * 1.25,
        of: p => p.off,
        limit: LIMIT,
        fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`,
      },
      { name: 'VELOCITY km/s', lo: 0, hi: vMax, of: p => p.v, fmt: v => v.toFixed(2) },
      { name: 'ACCEL g', lo: 0, hi: aMax, of: p => p.acc, fmt: v => v.toFixed(1) },
    ];
    const sh = (y + h - top - 4) / strips.length;
    strips.forEach((s, i) => {
      const sy = top + i * sh,
        py = v => sy + sh - 3 - ((Math.max(s.lo, Math.min(s.hi, v)) - s.lo) / (s.hi - s.lo)) * (sh - 6);
      plot.rect(left, sy + sh - 1, right - left, 1).fill({ color: look.rule, alpha: 0.8 });
      if (s.limit != null) {
        for (const d of [s.limit, -s.limit])
          plot.rect(left, py(d), right - left, 1).fill({ color: 0xd0634f, alpha: 0.45 });
        plot.rect(left, py(0), right - left, 1).fill({ color: look.rule, alpha: 1 });
      }
      const pts = [];
      for (const p of trace) pts.push(px(p.t), py(s.of(p)));
      if (pts.length >= 4) plot.poly(pts, false).stroke({ width: 1.5, color: look.ink });
      const v = s.of(last),
        bad = s.limit != null && Math.abs(v) > s.limit;
      plot.circle(px(last.t), py(v), 2.5).fill(0xffffff);
      word(i * 2, Math.max(8, fs * 0.8), look.dim).position.set(right + 8, sy + sh * 0.3);
      setText(words[i * 2], s.name);
      word(i * 2 + 1, fs * 1.2, bad ? TONE.bad : look.ink).position.set(right + 8, sy + sh * 0.68);
      setText(words[i * 2 + 1], s.fmt(v));
    });
    // Staging: a mark down all three strips wherever the stage changed.
    for (let i = 1; i < trace.length; i++)
      if (trace[i].stage !== trace[i - 1].stage)
        plot.rect(px(trace[i].t), top, 1, y + h - top - 4).fill({ color: 0xe8c66a, alpha: 0.5 });
  };
  return c0;
}

export function controlScene() {
  const g = game;
  const era = uiEra(g),
    look = lookOf(g),
    place = roomOf(g);
  const root = new Container();
  const shell = new Container(); // the room: rebuilt when the screen changes size
  const racks = new Graphics(); // the rack lamps and the MOCR's event lights, every frame
  const deskLayer = new Container();
  const monitor = new Container();
  root.addChild(shell, racks, deskLayer, monitor);
  let map = null,
    tv = null,
    lastW = 0,
    lastH = 0,
    deskKey = '',
    desks = [],
    L = null;

  const tele = telemetryScreen(look);
  monitor.addChild(tele);

  function layout(w, h) {
    const wallH = Math.round(h * 0.56),
      leftW = w * 0.055,
      galleryX = w * 0.87,
      wallL = w * 0.085,
      wallR = galleryX - w * 0.015;
    const base = { w, h, wallH, leftW, galleryX, wallL, wallR };
    if (place === 'cape') {
      const tvX = wallL + w * 0.47;
      return {
        ...base,
        map: [wallL, wallH * 0.05, w * 0.45, wallH * 0.6],
        tv: [tvX, wallH * 0.05, wallR - tvX, wallH * 0.3],
        mon: [tvX, wallH * 0.39, wallR - tvX, wallH * 0.26],
      };
    }
    // Houston: the big screen in the middle, two smaller ones each side of it (the video wall keeps the same plan,
    // its panes butted together).
    const span = wallR - wallL,
      gap = place === 'mocr' ? span * 0.018 : span * 0.006,
      mapW = span * 0.46,
      sideW = (span - mapW - gap * 2) / 2,
      top = wallH * 0.05,
      tall = wallH * 0.6,
      upper = tall * 0.5 - gap / 2,
      rightX = wallL + sideW + gap + mapW + gap;
    return {
      ...base,
      map: [wallL + sideW + gap, top, mapW, tall],
      tv: [wallL, top, sideW, upper],
      lights: [wallL, top + upper + gap, sideW, tall - upper - gap],
      mon: [rightX, top + upper + gap, sideW, tall - upper - gap],
      board: [rightX, top, sideW, upper],
    };
  }

  function buildShell(w, h) {
    // Gradients and pictures are this room's own textures: they go with it.
    for (const ch of shell.removeChildren())
      ch.destroy({ children: true, texture: !!ch.ownTex, textureSource: !!ch.ownTex });
    L = layout(w, h);
    const { wallH, leftW, galleryX, wallL, wallR } = L;
    const grad = (stops, x, y, gw, gh) => {
      const s = new Sprite(gradientTexture(stops));
      s.ownTex = true;
      s.position.set(x, y);
      s.width = gw;
      s.height = gh;
      shell.addChild(s);
      return s;
    };
    shell.addChild(new Graphics().rect(0, 0, w, h).fill(0x14171c));
    grad(
      [
        [0, look.wall[0]],
        [0.53, look.wall[1]],
        [1, look.wall[2]],
      ],
      leftW,
      0,
      galleryX - leftW,
      wallH,
    );
    const lines = new Graphics();
    for (let x = leftW; x < galleryX; x += (galleryX - leftW) / 12)
      lines.rect(x, 0, 2, wallH).fill({ color: 0x050d12, alpha: 0.3 });
    shell.addChild(lines);
    grad(
      [
        [0, look.carpet[0]],
        [0.4, look.carpet[1]],
        [1, look.carpet[2]],
      ],
      leftW,
      wallH,
      galleryX - leftW,
      h - wallH,
    );
    const floor = new Graphics();
    for (const depth of [0.12, 0.29, 0.52, 0.82])
      floor.rect(leftW, wallH + depth * (h - wallH), galleryX - leftW, 1).fill({ color: 0xe8ddbd, alpha: 0.08 });
    floor.rect(leftW, wallH, galleryX - leftW, 6).fill({ color: 0x000000, alpha: 0.3 });
    // The front wall's mountings: behind the map and screens, the clocks strip and the loop's board.
    floor.rect(wallL - 12, wallH * 0.05 - 6, wallR - wallL + 24, wallH * 0.63).fill({ color: 0x070c11, alpha: 0.45 });
    floor.rect(L.tv[0] - 6, L.tv[1] - 6, L.tv[2] + 12, L.tv[3] + 12).fill(0x181b1f);
    floor.rect(wallL - 4, wallH * 0.69 - 4, wallR - wallL + 8, wallH * 0.09 + 8).fill(0x22272e);
    floor.rect(wallL - 4, wallH * 0.81 - 4, wallR - wallL + 8, wallH * 0.17 + 8).fill(0x1b1f25);
    shell.addChild(floor);
    // A pool of warm light on the carpet in front of the consoles.
    const pool = new Sprite(puffTexture());
    pool.anchor.set(0.5);
    pool.position.set(w * 0.46, h * 0.8);
    pool.width = w * 0.75;
    pool.height = (h - wallH) * 0.9;
    pool.tint = look.pool;
    pool.alpha = 0.16;
    shell.addChild(pool);
    // The racks along the left wall (their lamps are drawn every frame), and the gallery along the right.
    const bank = new Graphics().rect(0, 0, leftW, h).fill(0x1d2126);
    const units = Math.max(4, Math.floor(h / 90));
    L.units = [];
    for (let i = 0; i < units; i++) {
      const uy = 10 + (i * (h - 20)) / units,
        uh = (h - 20) / units - 8;
      bank.rect(5, uy, leftW - 10, uh).fill(look.rack);
      bank.rect(10, uy + 5, leftW - 20, uh - 10).fill(0x0d1117);
      bank.rect(leftW / 2 - 8, uy + uh - 16, 16, 8).fill(0x454c55);
      for (let v = 0; v < 3; v++)
        bank.rect(14, uy + 21 + v * 3, Math.max(0, leftW - 28), 1).fill({ color: 0xadbdbf, alpha: 0.14 });
      L.units.push(uy);
    }
    shell.addChild(bank);
    const gw = w - galleryX;
    grad(
      [
        [0, '#292b2a'],
        [0.4, '#47433a'],
        [1, '#332f2b'],
      ],
      galleryX,
      0,
      gw,
      h,
    );
    const gal = new Graphics();
    const winW = Math.min(gw * 0.36, 130),
      winH = h * 0.12,
      gap = gw * 0.08,
      gx = galleryX + (gw - 2 * winW - gap) / 2,
      gy = h * 0.05;
    for (const wx of [gx, gx + winW + gap]) {
      gal.rect(wx - 3, gy - 3, winW + 6, winH + 6).fill(0x181f22);
      gal.rect(wx, gy, winW, winH).fill(0x426270);
      gal.rect(wx, gy, winW, winH * 0.5).fill({ color: 0x547889, alpha: 0.6 });
      gal.rect(wx + winW * 0.12, gy + winH * 0.1, winW * 0.07, winH * 0.8).fill({ color: 0xffffff, alpha: 0.12 });
      for (let i = 0; i < 3; i++) {
        const hx = wx + winW * (0.22 + i * 0.28),
          hy = gy + winH * (0.6 + ((i * 13) % 3) * 0.08),
          head = Math.min(winH * 0.15, Math.max(3, gw * 0.036));
        gal
          .rect(hx - head * 1.2, hy + head * 0.4, head * 2.4, gy + winH - hy - head * 0.4)
          .fill(i % 2 ? 0x35414b : 0x2a3438);
        gal.circle(hx, hy, head).fill(i % 2 ? 0xbc9c7d : 0x9b7f68);
      }
      gal.rect(wx - 2, gy + winH, winW + 4, Math.max(3, h * 0.008)).fill(0x33302b);
    }
    const floorY = gy + winH + Math.max(6, h * 0.015);
    gal.rect(galleryX + 2, floorY, gw - 4, h - floorY - 2).fill(0x2a2723);
    shell.addChild(gal);

    // The wall map and the pad television: the old drawing, as pictures, at the screen's own pixels.
    const dpr = window.devicePixelRatio || 1;
    const picture = ([x, y, pw, ph], paint, every) => {
      const pad = 6;
      const s = canvasPicture(
        Math.ceil((pw + pad * 2) * dpr),
        Math.ceil((ph + pad * 2) * dpr),
        ctx => {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          paint(ctx, pad, pad, pw, ph);
        },
        every,
      );
      s.ownTex = true;
      s.scale.set(1 / dpr);
      s.position.set(x - pad, y - pad);
      shell.addChild(s);
      return s;
    };
    map = picture(L.map, (ctx, x, y, pw, ph) => drawWallMap(ctx, g, x, y, pw, ph), 200);
    tv = picture(
      L.tv,
      (ctx, x, y, pw, ph) => {
        controlTelevision(ctx, g, x, y, pw, ph);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        for (let yy = y + 5; yy < y + ph; yy += 6) ctx.fillRect(x, yy, pw, 2);
      },
      50,
    );
    map.tint = tv.tint = look.screens;
    if (place !== 'cape') houstonWall();

    tele.place(...L.mon);
    deskKey = '';
  }

  // Houston's front wall beyond the map, the TV and the monitor: the event lights' panel and the stations' status board
  // (in the video wall, data windows), the tiered floor, and in the new room the light strip along the wall's top.
  function houstonWall() {
    const { w, h, wallH, leftW, galleryX, wallL, wallR } = L;
    const deco = new Graphics();
    const [lx, ly, lw, lh] = L.lights,
      [bx, by, bw, bh] = L.board;
    if (place === 'fcr') {
      // The video wall: one dark surface of tiles behind the panes, with fine seams.
      const top = L.map[1] - 8,
        bottom = L.map[1] + L.map[3] + 8;
      deco.rect(wallL - 8, top, wallR - wallL + 16, bottom - top).fill({ color: look.glass, alpha: 0.9 });
      const cols = 12,
        rows = 4;
      for (let i = 1; i < cols; i++)
        deco
          .rect(wallL - 8 + ((wallR - wallL + 16) * i) / cols, top, 1, bottom - top)
          .fill({ color: 0x000000, alpha: 0.5 });
      for (let j = 1; j < rows; j++)
        deco
          .rect(wallL - 8, top + ((bottom - top) * j) / rows, wallR - wallL + 16, 1)
          .fill({ color: 0x000000, alpha: 0.5 });
      // The light strip along the wall's top, and its wash down the wall.
      deco.rect(leftW, 0, galleryX - leftW, Math.max(3, h * 0.004)).fill(look.trim);
      const wash = new Sprite(
        gradientTexture([
          [0, `#${look.trim.toString(16).padStart(6, '0')}`],
          [1, 'rgba(0,0,0,0)'],
        ]),
      );
      wash.ownTex = true;
      wash.position.set(leftW, 0);
      wash.width = galleryX - leftW;
      wash.height = wallH * 0.05;
      wash.alpha = 0.25;
      // Behind the panes, not over them.
      shell.addChildAt(deco, shell.getChildIndex(map));
      shell.addChild(wash);
      // Data windows: a title bar and lines of figures.
      const windows = new Graphics();
      for (const [x, y, ww, wh] of [L.lights, L.board]) {
        windows.rect(x, y, ww, wh).fill(look.glassTop);
        windows.rect(x, y, ww, Math.max(10, wh * 0.1)).fill({ color: look.trim, alpha: 0.6 });
        for (let r = 0; r < 7; r++)
          windows
            .rect(
              x + ww * 0.06,
              y + wh * (0.22 + r * 0.1),
              ww * (0.35 + ((r * 37) % 50) / 100),
              Math.max(2, wh * 0.025),
            )
            .fill({ color: look.ink, alpha: 0.35 });
      }
      shell.addChild(windows);
    } else {
      // The MOCR: the event lights in their panel (lit each frame), and the status board, a lamp by each station.
      deco
        .rect(lx - 6, ly - 6, lw + 12, lh + 12)
        .fill(0x181b1f)
        .rect(lx, ly, lw, lh)
        .fill(0x0c0f12);
      deco
        .rect(bx - 6, by - 6, bw + 12, bh + 12)
        .fill(0x181b1f)
        .rect(bx, by, bw, bh)
        .fill(0x0c0f12);
      shell.addChild(deco);
      const names = stationsFor(yearOf(g)),
        rows = names.length / 2,
        size = Math.max(9, Math.min(14, (bh / (rows + 1.5)) * 0.6));
      const title = label('NETWORK STATUS', size, look.dim, { ax: 0.5, ay: 0, spacing: 1 });
      title.position.set(bx + bw / 2, by + 4);
      shell.addChild(title);
      const lamps = new Graphics();
      names.forEach((n, i) => {
        const col = i % 2,
          row = Math.floor(i / 2),
          x = bx + bw * (0.1 + col * 0.5),
          y = by + size * 1.8 + row * ((bh - size * 2.2) / rows);
        const t = label(n, size, look.ink, { ax: 0, ay: 0 });
        t.position.set(x + size * 1.4, y);
        shell.addChild(t);
        lamps.rect(x, y + size * 0.15, size * 0.9, size * 0.7).fill(0x5fb86a);
      });
      shell.addChild(lamps);
      // The tiers: each row of desks a step up from the one in front of it, the trench lowest by the wall.
      const floor = h - wallH,
        steps = new Graphics();
      for (const at of [0.1, 0.47]) {
        const y = wallH + floor * at;
        steps.rect(leftW, y, galleryX - leftW, floor * 0.035).fill({ color: 0x000000, alpha: 0.28 });
        steps.rect(leftW, y, galleryX - leftW, 2).fill({ color: 0xe8ddbd, alpha: 0.18 });
      }
      shell.addChild(steps);
    }
  }

  function buildDesks() {
    for (const ch of deskLayer.removeChildren()) ch.destroy({ children: true });
    const { w, h, wallH, leftW, galleryX } = L;
    const { back, front } = controlDesks(g);
    const floor = h - wallH,
      rowRight = galleryX - w * 0.01,
      rowMid = (leftW + rowRight) / 2,
      availW = rowRight - leftW - 40;
    const roomK = Math.max(1, h / 900);
    const frontK = Math.max(0.55, Math.min(1.4 * roomK, (availW - 4 * 24) / (4 * 190 + 460)));
    const backGap = 16,
      backK = Math.max(
        0.55,
        Math.min(1.25 * roomK, frontK * 0.9, (availW - (back.length - 1) * backGap) / (back.length * 190)),
      );
    const bSpan = back.length * 190 * backK + (back.length - 1) * backGap;
    desks = [];
    back.forEach((d, i) => {
      const c = desk(d, look);
      c.scale.set(backK);
      c.position.set(rowMid - bSpan / 2 + i * (190 * backK + backGap), wallH + floor * 0.16);
      deskLayer.addChild(c);
      desks.push(c);
    });
    const frontGap = 24;
    let fx = rowMid - ((4 * 190 + 460) * frontK + 4 * frontGap) / 2;
    for (const d of front) {
      const c = desk(d, look);
      c.scale.set(frontK);
      c.position.set(fx, wallH + floor * 0.6);
      deskLayer.addChild(c);
      desks.push(c);
      fx += (d.yours ? 460 : 190) * frontK + frontGap;
    }
  }

  function update(dt, screen) {
    const c = g.console;
    if (screen.width !== lastW || screen.height !== lastH) {
      lastW = screen.width;
      lastH = screen.height;
      buildShell(screen.width, screen.height);
    }
    const { back, front } = controlDesks(g);
    const key = [...back, ...front].map(d => `${d.id}:${d.label}:${d.who?.color}:${d.who?.hat}`).join('|');
    if (key !== deskKey) {
      deskKey = key;
      buildDesks();
    }
    for (const d of desks) d.update(c, g.time);
    // The racks' lamps, ticking over.
    racks.clear();
    const lw = L.leftW;
    L.units.forEach((uy, i) => {
      for (let l = 0; l < 6; l++) {
        const on = (i * 13 + l * 7 + Math.floor(g.time * 2)) % 5 < 3;
        racks.rect(14 + l * ((lw - 34) / 6), uy + 9, Math.max(3, lw / 26), 4).fill(on ? look.ink : look.rule);
      }
    });
    // The MOCR's event lights: each lamp comes on or goes off on its own slow beat, never in step with the rest.
    if (place === 'mocr') {
      const [lx, ly, lw, lh] = L.lights;
      const cols = 6,
        rows = 4,
        cw = lw / cols,
        rh = lh / rows;
      for (let i = 0; i < cols * rows; i++) {
        const beat = Math.floor(g.time / (5 + (i % 7)) + i * 0.618);
        const on = (beat * 7 + i * 3) % 5 < 2;
        const x = lx + (i % cols) * cw + cw * 0.15,
          y = ly + Math.floor(i / cols) * rh + rh * 0.2;
        racks
          .roundRect(x + cw * 0.05, y + rh * 0.05, cw * 0.6, rh * 0.45, 2)
          .fill(on ? (i % 9 === 4 ? 0xe8c66a : 0xe8e2c8) : 0x23272c);
      }
    }
    map.update();
    tv.update();
    tele.draw(c);
  }

  const stale = () => uiEra(g) !== era || roomOf(g) !== place;
  return { root, update, stale, passThrough: true };
}
