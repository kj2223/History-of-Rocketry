// THE SCENE KIT (v0.8 PixiJS rebuild): the pieces every rebuilt scene draws with. Instruments (dials, lamps, a count
// drum, pen recorders), seated and standing cut-out people, speech bubbles, and the way out. Flat, stylised shapes in
// the era's palette; each piece is a Container with an update(), so a scene builds it once and moves only the needles.
import { Container, Graphics, Text, BlurFilter, Texture, Sprite, Rectangle } from '../vendor/pixi.min.mjs';

// The palettes, by interface era (uiEra in js/site/draw.js). 'field': the late-1940s and 1950s range, olive steel,
// cream dial faces, typed labels. 'steel': the Mercury years, grey steel, lamp buttons, Nixie orange.
export const PALETTE = {
  field: {
    wall: 0x7d7a71,
    wallOld: 0x6f6c64,
    floor: 0x4a4740,
    beam: 0x4e4b45,
    panel: 0x3c4a3a,
    panelTop: 0x566553,
    face: 0x2f3a2c,
    desk: 0x6e6458,
    deskFront: 0x4a433a,
    dial: 0xf1ead3,
    ink: 0x2b261c,
    band: 0x7fbf6a,
    label: 0xd8d2c0,
    mono: 'Courier New, Courier, monospace',
    count: 0xff8a5a,
  },
  steel: {
    wall: 0x6d7378,
    wallOld: 0x6d7378,
    floor: 0x3e4246,
    beam: 0x45494d,
    panel: 0x4a5056,
    panelTop: 0x666d74,
    face: 0x2b3035,
    desk: 0x5c6066,
    deskFront: 0x3b3f44,
    dial: 0xeeeeea,
    ink: 0x1d1f22,
    band: 0x6fc88a,
    label: 0xd6dbe0,
    mono: 'Courier New, Courier, monospace',
    count: 0xff9b45,
  },
};
export const paletteFor = era => PALETTE[era] || PALETTE.field;

export function label(text, size, color, opts = {}) {
  const t = new Text({
    text,
    style: {
      fontFamily: opts.family || 'Courier New, Courier, monospace',
      fontSize: size,
      fill: color,
      fontWeight: opts.bold ? 'bold' : 'normal',
      letterSpacing: opts.spacing ?? 0,
      align: opts.align || 'center',
      wordWrap: !!opts.wrap,
      wordWrapWidth: opts.wrap || 0,
    },
  });
  t.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.5);
  t.resolution = 2;
  return t;
}
// Changes a Text only when the words change: Pixi re-rasterises a Text on every change.
export const setText = (t, s) => {
  if (t.text !== s) t.text = s;
};

// A round dial: cream face, the channel's green band, ticks, the needle, the reading under it. ch: a channel from
// js/truth/channels.js (via game.js): label, unit, band, range.
export function dial(ch, r, pal, short = ch.label) {
  const c = new Container();
  const [min, max] = ch.range;
  const ang = v => Math.PI * 0.75 + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * Math.PI * 1.5;
  const face = new Graphics();
  face.circle(0, 0, r + 5).fill(0x2a2a24);
  face.circle(0, 0, r).fill(pal.dial);
  if (ch.band)
    face
      .moveTo(Math.cos(ang(ch.band[0])) * (r - 7), Math.sin(ang(ch.band[0])) * (r - 7))
      .arc(0, 0, r - 7, ang(ch.band[0]), ang(ch.band[1]))
      .stroke({ width: Math.max(4, r * 0.13), color: pal.band });
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5,
      big = i % 5 === 0;
    face
      .moveTo(Math.cos(a) * (r - (big ? 12 : 7)), Math.sin(a) * (r - (big ? 12 : 7)))
      .lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2))
      .stroke({ width: big ? 2 : 1, color: pal.ink });
  }
  const needle = new Graphics();
  needle
    .moveTo(0, 0)
    .lineTo(r - 9, 0)
    .stroke({ width: 2.5, color: 0xa3321f });
  needle.circle(0, 0, 4).fill(0x2b261c);
  needle.rotation = ang(min);
  const name = label(
    `${short.toUpperCase()}${ch.unit ? ` · ${ch.unit.toUpperCase()}` : ''}`,
    Math.max(12, r * 0.24),
    pal.label,
    {
      bold: true,
    },
  );
  name.position.set(0, r + 12);
  const read = label('—', Math.max(14, r * 0.34), pal.ink, { bold: true });
  read.position.set(0, r * 0.45);
  c.addChild(face, needle, read, name);
  let shown = min;
  c.update = (v, dt = 1 / 60) => {
    if (v == null || typeof v !== 'number') {
      setText(read, '—');
      v = min;
    } else setText(read, Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));
    // A needle has weight: it swings to the reading rather than jumping.
    shown += (v - shown) * Math.min(1, dt * 6);
    needle.rotation = ang(shown);
  };
  return c;
}

// A round lamp with its name under it; lit lamps glow.
export function lamp(name, color, r, pal) {
  const c = new Container();
  const glow = new Graphics().circle(0, 0, r * 1.7).fill(color);
  glow.filters = [new BlurFilter({ strength: r * 0.7 })];
  glow.blendMode = 'add';
  glow.alpha = 0;
  const bezel = new Graphics().circle(0, 0, r + 3).fill(0x1b1c1e);
  const lens = new Graphics();
  const t = label(name, Math.max(13, r * 0.7), pal.label, { bold: true });
  t.position.set(0, r + 16);
  c.addChild(glow, bezel, lens, t);
  let was = null;
  c.update = on => {
    if (on === was) return;
    was = on;
    lens
      .clear()
      .circle(0, 0, r)
      .fill(on ? color : darken(color, 0.25));
    lens.circle(-r * 0.3, -r * 0.35, r * 0.28).fill({ color: 0xffffff, alpha: on ? 0.55 : 0.12 });
    glow.alpha = on ? 0.55 : 0;
  };
  c.update(false);
  return c;
}
export const darken = (color, k) => {
  const r = (color >> 16) & 255,
    g = (color >> 8) & 255,
    b = color & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
};

// A horizontal bar gauge, for propellant loaded and propellant left.
export function bar(ch, w, h, pal, short = ch.label) {
  const c = new Container();
  const back = new Graphics().rect(0, 0, w, h).fill(0x15130f).stroke({ width: 2, color: 0x2b2a24 });
  const fill = new Graphics();
  const name = label(short.toUpperCase(), 13, pal.label, { bold: true, ax: 0 });
  name.position.set(0, h + 12);
  c.addChild(back, fill, name);
  c.update = v => {
    const k = v == null ? 0 : Math.max(0, Math.min(1, (v - ch.range[0]) / (ch.range[1] - ch.range[0])));
    fill
      .clear()
      .rect(2, 2, (w - 4) * k, h - 4)
      .fill(pal.band);
    setText(name, `${short.toUpperCase()}  ${v == null ? '—' : `${v.toFixed(1)} ${ch.unit}`}`);
  };
  return c;
}

// Pen recorders: paper strips scrolling under the pens, drawing the readings they are given (newest at the right).
export function recorder(w, h, channels, pal) {
  const c = new Container();
  const n = channels.length,
    sw = (w - (n - 1) * 8) / n;
  const frame = new Graphics().rect(-6, -6, w + 12, h + 32).fill(0x2a2c2e);
  const paper = new Graphics();
  const pens = new Graphics();
  c.addChild(frame, paper, pens);
  channels.forEach((ch, i) => {
    const t = label(ch.label.toUpperCase(), 13, pal.label, { bold: true });
    t.position.set(i * (sw + 8) + sw / 2, h + 13);
    c.addChild(t);
  });
  for (let i = 0; i < n; i++) {
    const x = i * (sw + 8);
    paper.rect(x, 0, sw, h).fill(0xf6f1e2);
    for (let gy = 1; gy < 4; gy++) paper.rect(x, (gy * h) / 4, sw, 1).fill(0xd6cdb5);
    if (channels[i].band) {
      const y = v => h - ((v - channels[i].range[0]) / (channels[i].range[1] - channels[i].range[0])) * h;
      paper
        .rect(x, y(channels[i].band[1]), sw, y(channels[i].band[0]) - y(channels[i].band[1]))
        .fill({ color: 0x6fc88a, alpha: 0.18 });
    }
  }
  const hist = channels.map(() => []);
  c.update = (values, push) => {
    if (push) values.forEach((v, i) => (hist[i].push(v), hist[i].length > 120 && hist[i].shift()));
    pens.clear();
    channels.forEach((ch, i) => {
      const x0 = i * (sw + 8),
        pts = hist[i];
      const y = v =>
        h - ((Math.max(ch.range[0], Math.min(ch.range[1], v)) - ch.range[0]) / (ch.range[1] - ch.range[0])) * h;
      let started = false;
      pts.forEach((v, j) => {
        if (v == null) return;
        const px = x0 + sw - (pts.length - 1 - j) * (sw / 120);
        if (started) pens.lineTo(px, y(v));
        else (pens.moveTo(px, y(v)), (started = true));
      });
      if (started) pens.stroke({ width: 1.4, color: i % 2 ? 0x4b6a8a : 0xa3321f });
    });
  };
  return c;
}

// A controller seen from behind at the desk: chair, shoulders, head, an era hat now and then. p: g.people[id].
export function seatedBack(p, you) {
  const c = new Container();
  const g = new Graphics();
  g.rect(-30, 30, 60, 70).fill(0x3b352d); // the chair back
  c.addChild(g);
  const person = new Graphics();
  c.addChild(person);
  const mark = new Graphics().poly([-9, 0, 9, 0, 0, 9]).fill(0xe8c66a);
  mark.position.set(58, -42);
  c.addChild(mark);
  let who = undefined;
  c.update = (q, t = 0) => {
    mark.visible = !!q && q.id === 'you';
    if (q === who) return;
    who = q;
    person.clear();
    if (!q) return;
    const s = 1.35;
    person.roundRect(-34 * s, 0, 68 * s, 62 * s, 12 * s).fill(colorOf(q.color));
    person.rect(-7 * s, -10 * s, 14 * s, 12 * s).fill(0xe2b993);
    person.circle(0, -26 * s, 22 * s).fill(q.id === 'ellis' ? 0x6b4a32 : 0x3a2c22);
    if (q.hat) person.ellipse(0, -40 * s, 24 * s, 9 * s).fill(colorOf(q.hat));
  };
  c.update(p ?? null);
  return c;
}
export const colorOf = css => {
  if (typeof css === 'number') return css;
  const m = /^#([0-9a-f]{6})$/i.exec(css || '');
  if (m) return parseInt(m[1], 16);
  const s = /^#([0-9a-f]{3})$/i.exec(css || '');
  return s
    ? parseInt(
        s[1].replace(/./g, ch => ch + ch),
        16,
      )
    : 0x777777;
};

// A speech bubble over a head: cream card, dark type, a tail pointing down. tone 'go' / 'warn' / 'bad' colour its edge.
export function speech(maxW = 320) {
  const c = new Container();
  const card = new Graphics();
  const t = label('', 17, 0x1d1a14, { family: 'Georgia, serif', wrap: maxW - 24, align: 'left', ax: 0, ay: 0 });
  t.position.set(12, 8);
  c.addChild(card, t);
  c.visible = false;
  let was = '';
  c.update = bubble => {
    c.visible = !!bubble;
    if (!bubble) return;
    const key = bubble.text + bubble.tone;
    if (key === was) return;
    was = key;
    setText(t, bubble.text);
    const w = Math.min(maxW, t.width + 24),
      h = t.height + 16;
    const edge = { go: 0x6fc88a, warn: 0xe8c66a, bad: 0xd0634f }[bubble.tone] || 0x3a3a3a;
    card
      .clear()
      .roundRect(0, 0, w, h, 8)
      .fill(0xf8f3e3)
      .stroke({ width: 2, color: edge })
      .poly([w / 2 - 8, h, w / 2 + 8, h, w / 2, h + 12])
      .fill(0xf8f3e3);
    c.pivot.set(w / 2, h + 12);
  };
  return c;
}

// A picture drawn by the old canvas code (the pad through a periscope, a television), as a texture in the scene: the
// bridge while a picture has not been rebuilt in Pixi yet. paint(ctx, w, h) is called on every update.
export function canvasPicture(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = Texture.from(cv);
  const s = new Sprite(tex);
  s.update = () => {
    ctx.clearRect(0, 0, w, h);
    paint(ctx, w, h);
    tex.source.update();
  };
  return s;
}

// The way out of a room, bottom left: a card that calls leave() when pressed. The scene places it each frame.
export function outButton(leave, text = '◂ Out to the site') {
  const out = new Container();
  const card = new Graphics()
    .roundRect(0, 0, 180, 40, 5)
    .fill({ color: 0x0f1218, alpha: 0.85 })
    .stroke({ width: 1, color: 0xe8c66a });
  const t = label(text, 16, 0xf1e6c8, { family: 'Georgia, serif' });
  t.position.set(90, 20);
  out.addChild(card, t);
  out.eventMode = 'static';
  out.cursor = 'pointer';
  out.hitArea = new Rectangle(0, 0, 180, 40);
  out.on('pointertap', () => leave());
  return out;
}

// A soft round puff (white, fading to nothing at the edge), tinted for smoke, dust, vapour and glow.
let puffTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  puffTex = Texture.from(cv);
  return puffTex;
}

// Particles: puffs that drift, grow and fade. add(x, y, opts) makes one; update(dt) moves them all.
export function particles() {
  const c = new Container();
  const live = [];
  c.add = (x, y, o = {}) => {
    const s = new Sprite(puffTexture());
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = o.tint ?? 0xffffff;
    s.alpha = o.alpha ?? 0.6;
    s.scale.set(o.size ?? 0.3);
    if (o.add) s.blendMode = 'add';
    c.addChild(s);
    live.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, grow: o.grow ?? 0.4, fade: o.fade ?? 0.5, life: 0, max: o.life ?? 2 });
  };
  c.update = dt => {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.scale.set(p.s.scale.x + p.grow * dt);
      p.s.alpha = Math.max(0, p.s.alpha - p.fade * dt);
      if (p.life > p.max || p.s.alpha <= 0) {
        p.s.destroy();
        live.splice(i, 1);
      }
    }
  };
  return c;
}

// A person standing, seen from the front: legs, coat, head, the era hat now and then, and the marker over you.
// update(p) redraws only when the person changes. Feet at 0; the head's top near -150.
export function standingFigure() {
  const c = new Container();
  const body = new Graphics();
  const mark = new Graphics().poly([-9, 0, 9, 0, 0, 9]).fill(0xe8c66a);
  mark.position.set(0, -178);
  c.addChild(body, mark);
  let who;
  c.update = p => {
    c.visible = !!p;
    mark.visible = !!p && p.id === 'you';
    if (p === who) return;
    who = p;
    body.clear();
    if (!p) return;
    body.ellipse(0, 2, 34, 8).fill({ color: 0x000000, alpha: 0.25 });
    body.rect(-17, -62, 14, 62).fill(0x2b2620);
    body.rect(3, -62, 14, 62).fill(0x2b2620);
    body.roundRect(-26, -124, 52, 70, 8).fill(colorOf(p.color));
    body.roundRect(-34, -118, 12, 52, 5).fill(darken(colorOf(p.color), 0.8));
    body.roundRect(22, -118, 12, 52, 5).fill(darken(colorOf(p.color), 0.8));
    body.rect(-6, -132, 12, 10).fill(0xe2b993);
    body.circle(0, -146, 18).fill(0xe2b993);
    body
      .moveTo(-18, -148)
      .arc(0, -148, 18, Math.PI, 2 * Math.PI)
      .closePath()
      .fill(p.id === 'ellis' ? 0x6b4a32 : 0x3a2c22);
    if (p.hat) body.ellipse(0, -160, 22, 7).fill(colorOf(p.hat));
  };
  c.update(null);
  return c;
}
