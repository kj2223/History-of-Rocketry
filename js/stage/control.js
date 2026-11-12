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
import { drawWallMap, controlTelevision, controlDesks, deskLines } from '../site/draw.js';
import { label, setText, colorOf, canvasPicture, gradientTexture, puffTexture } from './kit.js';

const INK = { go: 0x9fdc9a, warn: 0xe8c66a, bad: 0xd0634f };
const inkOf = tone => INK[tone] || INK.go;
let enamelTex = null; // one gradient shared by every desk
const LIMIT = 6; // the abort rule: six degrees off the planned line

// A console desk in its own units (190 wide, or 460 for yours, by 60), scaled by the room. Returns the container
// with update(c) to refresh its screens.
export function desk(d) {
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
  enamelTex ??= gradientTexture([
    [0, '#5c646a'],
    [0.75, '#414950'],
    [1, '#343a40'],
  ]);
  const enamel = new Sprite(enamelTex);
  enamel.width = dw;
  enamel.height = dh;
  const trim = new Graphics()
    .rect(0, 0, dw, 10)
    .fill(0x626a71)
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
      .fill(0x161e24)
      .rect(off, 16, sw, sh * 0.35)
      .fill({ color: 0x243139, alpha: 0.6 })
      .rect(off + 2, 18, sw - 4, 1)
      .fill({ color: 0xb2c8c5, alpha: 0.14 });
    const t = label('', 9, INK.go, { ax: 0, ay: 0.5 });
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
      tx.style.fill = inkOf(tone);
    });
    const lit = tone === 'bad' || tone === 'warn';
    lampG.visible = lit && (tone === 'warn' || Math.sin(t * 7) > -0.3);
    lampG.tint = inkOf(tone);
  };
  return c;
}

// The monitoring screen, as a piece any console room can hang on its wall: place(x, y, w, h) once the room knows its
// size, then draw(c) every frame; it redraws only when the telemetry has moved on.
export function telemetryScreen() {
  const c0 = new Container();
  let at = [0, 0, 100, 60];
  // The monitoring screen: a frame and its glass, the plot drawn fresh when the telemetry moves on.
  const monFrame = new Graphics();
  const plot = new Graphics();
  const monTitle = label('', 12, 0x5a6a60, { ax: 0, ay: 0 });
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
      .fill(0x0d1117);
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
      word(1, fs * 1.1, 0x9fdc9a).position.set(x + 12, rowY(0.52));
      setText(words[1], (f.phase || '').toUpperCase());
      word(2, fs, f.decision ? 0xe8c66a : 0x5a6a60).position.set(x + 12, rowY(0.8));
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
        word(i * 2, fs, 0x5a6a60).position.set(x + 12, ry);
        setText(words[i * 2], k);
        word(i * 2 + 1, fs * 1.15, inkOf(tone)).position.set(x + w * 0.38, ry);
        setText(words[i * 2 + 1], v);
      });
      // The fuel as a bar, beside its figure.
      const fy = top + rh * 2.5;
      plot.rect(x + w * 0.62, fy - 5, w * 0.33, 10).fill(0x1f2a30);
      plot
        .rect(x + w * 0.62, fy - 5, w * 0.33 * Math.max(0, Math.min(1, s.fuel ?? 1)), 10)
        .fill(rows[2][2] === 'warn' ? INK.warn : INK.go);
      return;
    }
    // The climb: three strips, each with its scale, its live figure, and the staging marked across all three.
    setText(monTitle, 'TELEMETRY · THE CLIMB');
    if (!trace.length) {
      word(0, fs * 1.3, 0x5a6a60, 0.5).position.set(x + w / 2, (top + y + h) / 2);
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
      plot.rect(left, sy + sh - 1, right - left, 1).fill({ color: 0x31413a, alpha: 0.8 });
      if (s.limit != null) {
        for (const d of [s.limit, -s.limit])
          plot.rect(left, py(d), right - left, 1).fill({ color: 0xd0634f, alpha: 0.45 });
        plot.rect(left, py(0), right - left, 1).fill({ color: 0x31413a, alpha: 1 });
      }
      const pts = [];
      for (const p of trace) pts.push(px(p.t), py(s.of(p)));
      if (pts.length >= 4) plot.poly(pts, false).stroke({ width: 1.5, color: 0x9fdc9a });
      const v = s.of(last),
        bad = s.limit != null && Math.abs(v) > s.limit;
      plot.circle(px(last.t), py(v), 2.5).fill(0xffffff);
      word(i * 2, Math.max(8, fs * 0.8), 0x5a6a60).position.set(right + 8, sy + sh * 0.3);
      setText(words[i * 2], s.name);
      word(i * 2 + 1, fs * 1.2, bad ? INK.bad : INK.go).position.set(right + 8, sy + sh * 0.68);
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
  const root = new Container();
  const shell = new Container(); // the room: rebuilt when the screen changes size
  const racks = new Graphics(); // the rack lamps, every frame
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

  const tele = telemetryScreen();
  monitor.addChild(tele);

  function layout(w, h) {
    const wallH = Math.round(h * 0.56),
      leftW = w * 0.055,
      galleryX = w * 0.87,
      wallL = w * 0.085,
      wallR = galleryX - w * 0.015;
    const tvX = wallL + w * 0.47;
    return {
      w,
      h,
      wallH,
      leftW,
      galleryX,
      wallL,
      wallR,
      map: [wallL, wallH * 0.05, w * 0.45, wallH * 0.6],
      tv: [tvX, wallH * 0.05, wallR - tvX, wallH * 0.3],
      mon: [tvX, wallH * 0.39, wallR - tvX, wallH * 0.26],
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
        [0, '#202831'],
        [0.53, '#343f47'],
        [1, '#20272c'],
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
        [0, '#2a3031'],
        [0.4, '#423d33'],
        [1, '#292824'],
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
    pool.tint = 0xefc683;
    pool.alpha = 0.16;
    shell.addChild(pool);
    // The racks along the left wall (their lamps are drawn every frame), and the gallery along the right.
    const bank = new Graphics().rect(0, 0, leftW, h).fill(0x1d2126);
    const units = Math.max(4, Math.floor(h / 90));
    L.units = [];
    for (let i = 0; i < units; i++) {
      const uy = 10 + (i * (h - 20)) / units,
        uh = (h - 20) / units - 8;
      bank.rect(5, uy, leftW - 10, uh).fill(0x2c3138);
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

    tele.place(...L.mon);
    deskKey = '';
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
      const c = desk(d);
      c.scale.set(backK);
      c.position.set(rowMid - bSpan / 2 + i * (190 * backK + backGap), wallH + floor * 0.16);
      deskLayer.addChild(c);
      desks.push(c);
    });
    const frontGap = 24;
    let fx = rowMid - ((4 * 190 + 460) * frontK + 4 * frontGap) / 2;
    for (const d of front) {
      const c = desk(d);
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
        racks.rect(14 + l * ((lw - 34) / 6), uy + 9, Math.max(3, lw / 26), 4).fill(on ? 0x9fdc9a : 0x31413a);
      }
    });
    map.update();
    tv.update();
    tele.draw(c);
  }

  const stale = () => false;
  return { root, update, stale, passThrough: true };
}
