// THE RANGE PLOT, rebuilt in PixiJS (v0.8): the tracking board the range watches a round fly on. A phosphor screen in
// its steel bezel, the grid in kilometres, the drawing office's estimate, the earlier rounds of this vehicle faint
// behind her, and her track as the radar paints it, with the pen's glow at its head. Beside the plot, the range's
// own readings: the time, her height, her range, and what the radar's last two fixes make of her speed and her
// climb, the highest she has reached so far. The loop's last calls float along the bottom. Reads only what the
// range could see, through game.js and the world record (the scenes never import js/truth).
import { Container, Graphics, Sprite, Texture } from '../vendor/pixi.min.mjs';
import { g as game, flightTrouble } from '../game.js';
import { weatherNow } from './fx/weather-day.js';
import { rangeCamera } from './fx/range-camera.js';
import { SITES } from '../data/campaign.js';
import { KITS } from '../data/kits.js';
import { earlierTracks } from '../world/programme.js';
import { label, setText, speech, puffTexture } from './kit.js';

const GREEN = 0x8fd6a8,
  BRIGHT = 0x9ff0b8,
  DIM = 0x5fae7f,
  GRID = 0x1f3b2d,
  AMBER = 0xe8c66a;

function niceStep(span) {
  const raw = span / 6,
    mag = 10 ** Math.floor(Math.log10(raw)),
    n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

// The phosphor's glow, brighter in the middle: one radial gradient, drawn once per screen size.
function phosphorTexture(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(w / 4));
  cv.height = Math.max(2, Math.round(h / 4));
  const ctx = cv.getContext('2d');
  const r = Math.max(cv.width, cv.height) * 0.7;
  const grad = ctx.createRadialGradient(cv.width / 2, cv.height / 2, 0, cv.width / 2, cv.height / 2, r);
  grad.addColorStop(0, '#173023');
  grad.addColorStop(1, '#08120e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);
  return Texture.from(cv);
}

export function trackingScene() {
  const g = game;
  const root = new Container();
  const screenBg = new Sprite();
  const bezel = new Graphics();
  const grid = new Container(); // rebuilt when the scale or the screen changes
  const past = new Graphics();
  const estimate = new Graphics();
  const track = new Graphics();
  const pen = new Sprite(puffTexture());
  pen.anchor.set(0.5);
  pen.tint = BRIGHT;
  pen.blendMode = 'add';
  const penDot = new Graphics().circle(0, 0, 4).fill(0xffffff);
  const peakMark = new Graphics();
  const scan = new Graphics(); // the scanlines over the glass
  const words = new Container();
  const bubbles = new Container();
  // What went wrong, on the plot: a ring where the loop called it, its words, and for a break-up the radar's returns
  // from the pieces falling away (v0.8 failures you can see). The tracking camera's picture sits in the plot's corner.
  const trouble = new Graphics();
  const troubleWords = label('', 13, AMBER, { ax: 0, ay: 1, bold: true });
  const camera = rangeCamera();
  root.addChild(
    screenBg,
    grid,
    estimate,
    past,
    track,
    trouble,
    peakMark,
    pen,
    penDot,
    scan,
    bezel,
    words,
    troubleWords,
    camera,
    bubbles,
  );

  const title = label('', 15, GREEN, { ax: 0, ay: 0 });
  const readTitle = label('RANGE READINGS', 13, DIM, { ax: 0, ay: 0, spacing: 2 });
  words.addChild(title, readTitle);
  const READS = ['TIME', 'ALTITUDE', 'RANGE', 'SPEED', 'CLIMB', 'HIGHEST'];
  const reads = READS.map(name => {
    const k = label(name, 12, DIM, { ax: 0, ay: 0, spacing: 1 });
    const v = label('', 22, GREEN, { ax: 0, ay: 0, bold: true });
    words.addChild(k, v);
    return { k, v };
  });
  const callCards = [0, 1, 2].map(() => {
    const b = speech(300);
    b.scale.set(0.72);
    bubbles.addChild(b);
    return b;
  });

  let key = '',
    drawnUpto = -1,
    P = null;

  function rebuild(w, h, f) {
    const deep = !!f.result.deep;
    const before = deep || f.result.orbit ? [] : earlierTracks(g.programme, g.vehicle);
    const beforeTop = Math.max(0, ...before.flatMap(b => b.trace.map(q => q[1]))),
      beforeRange = Math.max(0, ...before.flatMap(b => b.trace.map(q => q[0])));
    const top = Math.max(80, deep ? 0 : g.round.estimate.high * 1.15, f.result.apogee * 1.1, beforeTop * 1.1),
      hStep = niceStep(top);
    const range = Math.max(f.result.range, beforeRange),
      maxH = Math.ceil(top / hStep) * hStep,
      xStep = range <= 40 ? 5 : range <= 120 ? 10 : niceStep(range * 1.1);
    const pad = 70,
      side = Math.min(260, Math.max(190, w * 0.17)), // the readings column on the right
      maxX = Math.max(30, Math.ceil(range / xStep) * xStep + xStep);
    const left = pad,
      right = w - side - 30,
      bottom = h - pad - 20,
      topY = 90;
    const px = x => left + (x / maxX) * (right - left),
      py = km => bottom - (km / maxH) * (bottom - topY);
    P = { px, py, left, right, bottom, topY, w, h, side, deep, before, maxH };

    screenBg.texture?.destroy(true);
    screenBg.texture = phosphorTexture(w, h);
    screenBg.width = w;
    screenBg.height = h;

    bezel.clear();
    bezel.rect(0, 0, w, 14).fill(0x111914);
    bezel.rect(0, h - 14, w, 14).fill(0x111914);
    bezel.rect(0, 14, 14, h - 28).fill(0x111914);
    bezel.rect(w - 14, 14, 14, h - 28).fill(0x111914);
    bezel.rect(14.5, 14.5, w - 29, h - 29).stroke({ width: 1, color: 0x394439 });
    for (const x of [7, w - 8])
      bezel
        .rect(x, 5, 2, 3)
        .fill(0x525a4b)
        .rect(x, h - 8, 2, 3)
        .fill(0x525a4b);
    // The readings column: its own ruled panel, right of the plot.
    const rx = w - side - 10;
    bezel.rect(rx, topY - 10, side - 10, bottom - topY + 20).stroke({ width: 1, color: 0x2c4a39 });

    for (const ch of grid.removeChildren()) ch.destroy();
    const lines = new Graphics();
    grid.addChild(lines);
    for (let k = 0; k <= maxH; k += hStep) {
      lines.rect(left, py(k), right - left, 1).fill(GRID);
      const t = label(k >= 10000 ? `${k / 1000}k km` : `${k} km`, 12, DIM, { ax: 1 });
      t.position.set(left - 8, py(k));
      grid.addChild(t);
    }
    for (let k = 0; k <= maxX; k += xStep) {
      lines.rect(px(k), py(maxH), 1, bottom - py(maxH)).fill(GRID);
      const t = label(`${k}`, 12, DIM);
      t.position.set(px(k), bottom + 14);
      grid.addChild(t);
    }
    const unit = label('km downrange', 12, DIM);
    unit.position.set((left + right) / 2, bottom + 34);
    grid.addChild(unit);

    estimate.clear();
    if (!deep) {
      const lo = py(g.round.estimate.low),
        hi = py(g.round.estimate.high);
      estimate.rect(px(0), hi, right - px(0), lo - hi).fill({ color: AMBER, alpha: 0.05 });
      for (let x = px(0); x < right; x += 12) {
        estimate.rect(x, lo, 6, 1).fill({ color: AMBER, alpha: 0.4 });
        estimate.rect(x, hi, 6, 1).fill({ color: AMBER, alpha: 0.4 });
      }
      const t = label('drawing-office estimate', 11, AMBER, { ax: 1, ay: 1 });
      t.alpha = 0.7;
      t.position.set(right - 4, hi - 4);
      grid.addChild(t);
    }

    // Earlier rounds: a dim track each, labelled at its peak with what the range wrote of it.
    past.clear();
    before.forEach((b, n) => {
      const pts = b.trace.flatMap(([x, hh]) => [px(x), py(hh)]);
      if (pts.length >= 4) past.poly(pts, false).stroke({ width: 1.5, color: GREEN, alpha: 0.22 });
      const peak = b.trace.reduce((a, q) => (q[1] > a[1] ? q : a), b.trace[0]);
      const t = label(
        `${before.length - n === 1 ? 'last round' : `${before.length - n} rounds back`}: ${b.failure ? `lost at ${b.failAt} s` : `${Math.round(b.apogee ?? peak[1])} km`}`,
        11,
        GREEN,
        { ax: 0, ay: 1 },
      );
      t.alpha = 0.5;
      t.position.set(px(peak[0]) + 6, py(peak[1]) - 4 - 12 * n);
      grid.addChild(t);
    });

    scan.clear();
    for (let y = 16; y < h - 16; y += 4) scan.rect(16, y, w - 32, 1).fill({ color: 0x000000, alpha: 0.12 });

    title.position.set(left, 30);
    setText(title, `${SITES[g.site || 'white-sands'].plot} · RANGE PLOT · ${KITS[g.vehicle].range}`);
    readTitle.position.set(rx + 14, topY);
    const rowH = Math.min(56, (bottom - topY - 30) / READS.length);
    P.readEnd = topY + 30 + READS.length * rowH;
    reads.forEach((r, i) => {
      r.k.position.set(rx + 14, topY + 30 + i * rowH);
      r.v.position.set(rx + 14, topY + 30 + i * rowH + 16);
      r.v.style.fontSize = Math.max(16, Math.min(24, rowH * 0.36));
    });
    drawnUpto = -1;
  }

  function update(dt, screen) {
    const f = g.flight;
    if (!f) return;
    const w = screen.width,
      h = screen.height;
    const k = `${w}|${h}|${g.roundIndex}|${f.result.apogee}|${f.result.range}`;
    if (k !== key) {
      key = k;
      rebuild(w, h, f);
    }
    const path = f.result.path,
      upto = Math.min(path.length - 1, Math.floor(f.t));
    const { px, py } = P;
    if (upto !== drawnUpto) {
      drawnUpto = upto;
      track.clear();
      const pts = [];
      for (let i = 0; i <= upto; i++) pts.push(px(path[i].x), py(path[i].h));
      if (pts.length >= 4) {
        track.poly(pts, false).stroke({ width: 7, color: 0x6cdc99, alpha: 0.13 });
        track.poly(pts, false).stroke({ width: 2, color: BRIGHT });
      }
      // The highest point so far, ticked on the track.
      let peak = path[0];
      for (let i = 0; i <= upto; i++) if (path[i].h > peak.h) peak = path[i];
      peakMark.clear();
      if (peak.h > 0) peakMark.rect(px(peak.x) - 6, py(peak.h), 12, 1).fill({ color: AMBER, alpha: 0.8 });
      // The range's readings: from the radar's last two fixes.
      const p = path[upto],
        q = path[Math.max(0, upto - 1)],
        dtp = Math.max(1, p.t - q.t);
      const speed = Math.hypot(p.x - q.x, p.h - q.h) / dtp,
        climb = (p.h - q.h) / dtp;
      const vals = [
        `T+${String(Math.floor(f.t)).padStart(3, '0')} s`,
        `${p.h.toFixed(1)} km`,
        `${p.x.toFixed(1)} km`,
        upto ? `${(speed * 1000).toFixed(0)} m/s` : '—',
        upto ? `${climb >= 0 ? '+' : ''}${(climb * 1000).toFixed(0)} m/s` : '—',
        `${peak.h.toFixed(1)} km`,
      ];
      reads.forEach((r, i) => setText(r.v, vals[i]));
      reads[4].v.style.fill = upto && climb < 0 ? AMBER : GREEN;
    }
    // The trouble, once the loop has called it.
    const bad = flightTrouble(g);
    trouble.clear();
    troubleWords.visible = false;
    if (bad && f.t >= bad.at) {
      const q = path[Math.min(path.length - 1, Math.round(bad.at))];
      const x = px(q.x),
        y = py(q.h);
      trouble.circle(x, y, 11).stroke({ width: 2, color: AMBER });
      troubleWords.visible = true;
      troubleWords.position.set(x + 18, y - 16);
      setText(
        troubleWords,
        `T+${Math.round(bad.at)} s · ${
          bad.kind === 'break'
            ? 'BREAK-UP'
            : bad.kind === 'tumble'
              ? 'TUMBLING'
              : bad.rso
                ? 'RANGE SAFETY CUTOFF'
                : bad.kind === 'loose'
                  ? 'CUTOFF SENT'
                  : bad.upper
                    ? 'NO UPPER STAGE'
                    : 'THRUST LOST'
        }`,
      );
      // The radar paints the pieces: dotted tracks falling away from the break, on simple ballistic arcs.
      if (bad.kind === 'break') {
        const since = f.t - bad.at,
          vx0 = path[Math.min(path.length - 1, Math.round(bad.at) + 1)].x - q.x || 0.3;
        for (let i = 0; i < 5; i++) {
          const vx = vx0 * (0.4 + i * 0.25),
            vh = 0.25 - i * 0.12;
          for (let s = 0; s < Math.min(since, 90); s += 3) {
            const hh = q.h + vh * s - 0.0049 * s * s;
            if (hh < 0) break;
            trouble.circle(px(q.x + vx * s), py(hh), 1.6).fill({ color: GREEN, alpha: 0.55 });
          }
        }
      }
    }
    // The tracking camera, top left of the plot, while there is anything to see of her (not on the deep shots).
    camera.visible = !P.deep;
    if (camera.visible) {
      const cw = Math.min(camera.W, (P.right - P.left) * 0.34);
      camera.scale.set(cw / camera.W);
      camera.position.set(P.left + 14, P.topY + 6);
      camera.update(f, bad, g.vehicle, dt, weatherNow(g));
    }

    const p = path[upto];
    pen.position.set(px(p.x), py(p.h));
    penDot.position.set(px(p.x), py(p.h));
    pen.scale.set(0.9 + Math.sin(g.time * 8) * 0.1);
    pen.alpha = 0.7;

    // The loop: the latest calls, stacked in the readings column under the figures, newest at the bottom.
    const calls = f.calls.slice(-3);
    let y = P.bottom + 4;
    for (let i = callCards.length - 1; i >= 0; i--) {
      const b = callCards[i],
        c = calls[calls.length - callCards.length + i];
      b.update(c ? { text: `${c.who}: ${c.text}`, tone: c.tone } : null);
      if (!c) continue;
      if (y - b.height < P.readEnd) {
        b.visible = false; // no room left under the readings: the older calls give way
        continue;
      }
      b.position.set(P.w - P.side / 2 - 15, y);
      y -= b.height + 8;
    }
  }

  const stale = () => false;
  return { root, update, stale };
}
