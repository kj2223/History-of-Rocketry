// JPL'S TRACKING, rebuilt in PixiJS (v0.8): the room the deep-space flights are followed from. A big plotting board on
// the wall, the tracking stations' lamps under it (the one that has her lit), the elapsed-time board, the teletype
// printing the reports as they come in, and, near the end, the monitor with what she sees.
//  - Pioneer and Ranger (g.lunar, the technical office): the Earth–Moon plot with her track, then Goldstone's plot of the
//    Moon coming in, and Ranger's pictures on the monitor once the cameras are on.
//  - The robotic missions (g.beat probeHandover / probeEncounter / probePlayback, JPL): the inner and outer planets
//    where they really were on the day, each craft's route out to them, and the planet on the monitor on encounter days.
// The board is a lit plotting board through Apollo, amber screens in the Shuttle years, then the flat screens of the
// desktop and glass eras (control.js's looks). Nothing flashes: the lamps are steady and the pictures change smoothly.
// Reads only what the room could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Sprite, Texture } from '../vendor/pixi.min.mjs';
import { g as game, probeStep } from '../game.js';
import { SEASON } from '../data/campaign.js';
import { dateOf } from '../core/calendar.js';
import { MOON_KM, MOON_RADIUS } from '../lunar.js';
import { PLANETS, ROUTES, planetAt, craftAt, routeReach } from '../data/deep-space.js';
import { yearOf } from '../site/draw.js';
import { label, setText, outButton, puffTexture, standingFigure } from './kit.js';
import { lookOf } from './control.js';

const W = 1600,
  H = 900,
  FLOOR = 790;
const BOARD = { x: 60, y: 170, w: 1000, h: 440 };
const AU_KM = 149.6e6;
const fmt = n => Math.round(n).toLocaleString('en-US');

// Which kind of deep flight is on, or null.
export function deepMode(g) {
  if (g.lunar && ['cruise', 'encounter'].includes(g.room)) return g.room === 'cruise' ? 'cruise' : 'approach';
  if (['probeHandover', 'probeEncounter', 'probePlayback'].includes(g.room) && SEASON[g.roundIndex]?.probe)
    return ROUTES[SEASON[g.roundIndex].id] ? 'solar' : 'moonProbe';
  return null;
}

// The Moon as a picture, painted once: lit from the upper left, its seas and craters.
let moonTex = null;
function moonTexture() {
  if (moonTex) return moonTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d'),
    r = 126,
    c = 128;
  const light = ctx.createRadialGradient(c - r * 0.4, c - r * 0.45, 0, c, c, r);
  light.addColorStop(0, '#eee5cf');
  light.addColorStop(0.56, '#c7bda8');
  light.addColorStop(1, '#817b72');
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(70, 75, 75, .25)';
  for (const [x, y, rx, ry] of [
    [-0.42, -0.25, 0.26, 0.2],
    [0.28, -0.3, 0.2, 0.16],
    [0.5, 0.08, 0.16, 0.2],
    [0.1, 0.22, 0.17, 0.1],
    [-0.15, 0.05, 0.12, 0.1],
  ]) {
    ctx.beginPath();
    ctx.ellipse(c + x * r, c + y * r, rx * r, ry * r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [a, b, s] of [
    [-0.34, 0.44, 0.07],
    [0.32, 0.54, 0.13],
    [-0.62, 0.13, 0.09],
    [0.66, 0.37, 0.06],
    [0.04, -0.67, 0.05],
    [-0.14, 0.38, 0.095],
    [-0.5, -0.58, 0.035],
  ]) {
    ctx.fillStyle = 'rgba(68, 61, 55, .3)';
    ctx.beginPath();
    ctx.arc(c + a * r, c + b * r, s * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 247, 224, .45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c + a * r, c + b * r, s * r, 0.1, 2.6);
    ctx.stroke();
  }
  moonTex = Texture.from(cv);
  return moonTex;
}

// The ground Ranger's cameras see in the last hour: a field of craters of every size, painted once, grey.
let groundTex = null;
function groundTexture() {
  if (groundTex) return groundTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8d8a80';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512,
      y = rnd() * 512,
      s = 2 + rnd() ** 3 * 46;
    ctx.fillStyle = 'rgba(40,38,34,.35)';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,230,215,.45)';
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, s, 2.4, 5.6);
    ctx.stroke();
  }
  groundTex = Texture.from(cv);
  return groundTex;
}

// A planet as the monitor shows it: a lit disc in its colour, bands on the giants, Saturn's rings.
function planetPicture(id) {
  const p = PLANETS[id] || { color: 0xc7bda8 };
  const c = new Container();
  if (id === 'moon') {
    const s = new Sprite(moonTexture());
    s.anchor.set(0.5);
    s.width = s.height = 160;
    c.addChild(s);
    return c;
  }
  const g = new Graphics();
  if (p.ring) g.ellipse(0, 0, 150, 26).stroke({ width: 10, color: 0xcdbb88, alpha: 0.8 });
  g.circle(0, 0, 80).fill(p.color);
  if (id === 'jupiter' || id === 'saturn')
    for (const [y, a] of [
      [-40, 0.25],
      [-14, 0.3],
      [12, 0.22],
      [38, 0.28],
    ])
      g.ellipse(0, y, 78 * Math.sqrt(1 - (y / 80) ** 2), 6).fill({ color: 0x6e4f35, alpha: a });
  if (id === 'jupiter') g.ellipse(26, 26, 13, 7).fill({ color: 0xb4583a, alpha: 0.7 });
  if (id === 'mars')
    g.ellipse(-14, -10, 30, 14)
      .fill({ color: 0x6e3420, alpha: 0.35 })
      .ellipse(0, -72, 20, 6)
      .fill({ color: 0xffffff, alpha: 0.7 });
  // The night side.
  g.circle(0, 0, 80).fill({ color: 0x000000, alpha: 0 });
  const shade = new Graphics()
    .moveTo(10, -80)
    .arc(0, 0, 80, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12)
    .closePath()
    .fill({ color: 0x000000, alpha: 0.42 });
  if (p.ring) g.moveTo(-150, 0).arc(0, 0, 150, Math.PI, 2 * Math.PI, true);
  c.addChild(g, shade);
  return c;
}

const STATIONS = {
  early: ['Cape', 'Antigua', 'Johannesburg', 'Woomera', 'Goldstone'],
  dsn: ['Goldstone', 'Canberra', 'Madrid'],
};

export function deepScene({ leave }) {
  const g = game;
  const root = new Container();
  const world = new Container();
  root.addChild(world);
  const look = lookOf(g);
  const plotting = yearOf(g) < 1976; // the lit plotting board with its pins, before the screens came

  // ---- the room ----
  const room = new Graphics();
  room.rect(-800, -800, W + 1600, FLOOR + 800).fill(plotting ? 0x2e3330 : 0x22262b);
  room.rect(-800, FLOOR, W + 1600, H - FLOOR + 800).fill(plotting ? 0x3a352c : 0x2a2d31);
  for (let x = -400; x < W + 400; x += 160) room.rect(x, 0, 2, FLOOR).fill({ color: 0xffffff, alpha: 0.035 });
  room.rect(-800, FLOOR - 6, W + 1600, 6).fill({ color: 0x000000, alpha: 0.3 });
  const glow = new Sprite(puffTexture());
  glow.anchor.set(0.5);
  glow.position.set(BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2);
  glow.width = BOARD.w * 1.5;
  glow.height = BOARD.h * 1.6;
  glow.tint = plotting ? 0x9fb8a8 : look.pool;
  glow.alpha = 0.16;
  world.addChild(room, glow);

  // ---- the board: frame, face, the fixed drawing (rebuilt when the mode changes), the moving drawing ----
  const frame = new Graphics()
    .rect(BOARD.x - 18, BOARD.y - 18, BOARD.w + 36, BOARD.h + 36)
    .fill(plotting ? 0x1c201d : 0x15181c)
    .rect(BOARD.x - 18, BOARD.y - 18, BOARD.w + 36, BOARD.h + 36)
    .stroke({ width: 2, color: plotting ? 0x4d5547 : look.trim });
  const face = new Graphics()
    .rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h)
    .fill(plotting ? 0x101a1c : look.glass)
    .rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h * 0.35)
    .fill({ color: 0xffffff, alpha: 0.025 });
  const fixed = new Container();
  const moving = new Graphics();
  const marks = new Container();
  const title = label('', 18, plotting ? 0xe8e2c8 : look.ink, { ax: 0, ay: 0, spacing: 2, bold: true });
  title.position.set(BOARD.x + 18, BOARD.y + 14);
  const note = label('', 13, plotting ? 0x8fa49a : look.dim, { ax: 1, ay: 1 });
  note.position.set(BOARD.x + BOARD.w - 14, BOARD.y + BOARD.h - 10);
  world.addChild(frame, face, fixed, moving, marks, title, note);
  const INK = plotting ? 0xe8c66a : look.ink,
    DIM = plotting ? 0x4f6660 : look.rule,
    TEXT = plotting ? 0xb9c4b8 : look.dim;

  // ---- the stations' lamps under the board ----
  const lamps = new Container();
  lamps.position.set(BOARD.x, BOARD.y + BOARD.h + 42);
  world.addChild(lamps);
  let lampKey = '';
  function drawLamps(names, lit) {
    const key = names.join() + '|' + lit;
    if (key === lampKey) return;
    lampKey = key;
    lamps.removeChildren().forEach(c => c.destroy());
    const step = BOARD.w / names.length;
    names.forEach((n, i) => {
      const on = n === lit;
      const x = i * step + step / 2;
      const plate = new Graphics()
        .roundRect(x - step / 2 + 8, 0, step - 16, 58, 4)
        .fill(plotting ? 0x262b27 : 0x1b1f24)
        .circle(x, 18, 9)
        .fill(on ? 0x8fe0a0 : 0x2c3a31)
        .circle(x, 18, 9)
        .stroke({ width: 1.5, color: 0x11140f });
      lamps.addChild(plate);
      if (on) {
        const halo = new Sprite(puffTexture());
        halo.anchor.set(0.5);
        halo.position.set(x, 18);
        halo.scale.set(0.9);
        halo.tint = 0x8fe0a0;
        halo.alpha = 0.5;
        halo.blendMode = 'add';
        lamps.addChild(halo);
      }
      const t = label(n.toUpperCase(), 13, on ? 0xe8f2e0 : 0x8a948a, { spacing: 1 });
      t.position.set(x, 43);
      lamps.addChild(t);
    });
  }

  // ---- the elapsed-time board ----
  const clock = new Graphics()
    .roundRect(1120, 120, 420, 170, 6)
    .fill(0x15181b)
    .roundRect(1132, 132, 396, 146, 4)
    .fill(plotting ? 0x0f0b07 : look.glass);
  const clockBig = label('', 54, plotting ? 0xff9b45 : look.ink, { bold: true });
  clockBig.position.set(1330, 188);
  const clockSmall = label('', 15, plotting ? 0xc8a070 : look.dim, { spacing: 1 });
  clockSmall.position.set(1330, 250);
  world.addChild(clock, clockBig, clockSmall);

  // ---- the monitor: what she sees, near the end ----
  const monitor = new Container();
  monitor.position.set(1330, 460);
  monitor.scale.set(0.82);
  const tvBox = new Graphics()
    .roundRect(-200, -140, 400, 280, 14)
    .fill(0x2a2c2c)
    .roundRect(-180, -122, 360, 244, 10)
    .fill(0x0b0d0d);
  const tvPic = new Container();
  const tvMask = new Graphics().roundRect(-180, -122, 360, 244, 10).fill(0xffffff);
  tvPic.mask = tvMask;
  const ground = new Sprite(groundTexture());
  ground.anchor.set(0.5);
  const tvPlanet = new Container();
  tvPic.addChild(ground, tvPlanet);
  const lines = new Graphics();
  for (let y = -120; y < 122; y += 4) lines.rect(-180, y, 360, 1).fill({ color: 0x000000, alpha: 0.18 });
  const tvWord = label('', 16, 0xd0d6c8, { spacing: 2 });
  tvWord.position.set(0, 160);
  monitor.addChild(tvBox, tvPic, tvMask, lines, tvWord);
  world.addChild(monitor);

  // ---- the teletype, and the reports it has printed ----
  const tty = new Graphics()
    .rect(1110, 700, 440, 18)
    .fill(0x5a4a38)
    .rect(1130, 718, 16, 72)
    .fill(0x3e3328)
    .rect(1514, 718, 16, 72)
    .fill(0x3e3328)
    .roundRect(1170, 630, 320, 72, 8)
    .fill(0x4a4840)
    .roundRect(1190, 616, 280, 26, 6)
    .fill(0x5c594f)
    .rect(1200, 650, 260, 30)
    .fill(0x34322c);
  const paper = new Container();
  const paperBg = new Graphics();
  const paperText = label('', 13, 0x2b261c, { ax: 0, ay: 1, wrap: 284, align: 'left' });
  paperText.position.set(1188, 612);
  paper.addChild(paperBg, paperText);
  const paperMask = new Graphics().rect(1170, 300, 330, 320).fill(0xffffff);
  paper.mask = paperMask;
  world.addChild(paper, paperMask, tty);
  // Morgan by the board, moving the pin.
  const morgan = standingFigure();
  morgan.position.set(1085, FLOOR);
  morgan.scale.set(1.15);
  world.addChild(morgan);

  const out = outButton(leave);
  root.addChild(out);

  let legend = [];
  const boardMask = new Graphics().rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h).fill(0xffffff);
  world.addChild(boardMask);
  moving.mask = boardMask;
  fixed.mask = boardMask;
  let mode = null,
    lastLog = '',
    planetKey = '';

  // The board's fixed drawing for this mode, once.
  function build(m) {
    fixed.removeChildren().forEach(c => c.destroy({ children: true }));
    marks.removeChildren().forEach(c => c.destroy({ children: true }));
    const grid = new Graphics();
    for (let x = BOARD.x + 40; x < BOARD.x + BOARD.w; x += 40)
      grid.moveTo(x, BOARD.y + 6).lineTo(x, BOARD.y + BOARD.h - 6);
    for (let y = BOARD.y + 40; y < BOARD.y + BOARD.h; y += 40)
      grid.moveTo(BOARD.x + 6, y).lineTo(BOARD.x + BOARD.w - 6, y);
    grid.stroke({ width: 1, color: DIM, alpha: 0.45 });
    fixed.addChild(grid);
    if (m === 'cruise' || m === 'moonProbe') {
      const { x0, x1, mid } = em();
      const earth = new Graphics()
        .circle(x0, mid, 28)
        .fill(0x2f5f8c)
        .poly([
          x0 - 18,
          mid - 6,
          x0 - 6,
          mid - 18,
          x0 + 6,
          mid - 12,
          x0 + 2,
          mid - 2,
          x0 - 6,
          mid + 2,
          x0 - 8,
          mid + 14,
          x0 - 16,
          mid + 8,
        ])
        .fill(0x6f8f6a)
        .ellipse(x0 + 8, mid + 8, 12, 5)
        .fill({ color: 0xffffff, alpha: 0.35 })
        .circle(x0, mid, 28)
        .stroke({ width: 2, color: 0x9cc4d8, alpha: 0.6 });
      const moon = new Sprite(moonTexture());
      moon.anchor.set(0.5);
      moon.position.set(x1, mid);
      moon.width = moon.height = 34;
      const path = new Graphics();
      for (let i = 0; i <= 60; i += 2) {
        const d0 = (MOON_KM * i) / 60,
          d1 = (MOON_KM * (i + 1)) / 60;
        path.moveTo(emX(d0), emY(d0)).lineTo(emX(d1), emY(d1));
      }
      path.stroke({ width: 2, color: TEXT, alpha: 0.5 });
      const axis = new Graphics().moveTo(x0, BOARD.y + BOARD.h - 60).lineTo(x1, BOARD.y + BOARD.h - 60);
      for (let k = 100000; k < MOON_KM; k += 100000) {
        axis.moveTo(emX(k), BOARD.y + BOARD.h - 66).lineTo(emX(k), BOARD.y + BOARD.h - 54);
        const t = label(`${k / 1000},000 km`, 13, TEXT);
        t.position.set(emX(k), BOARD.y + BOARD.h - 38);
        fixed.addChild(t);
      }
      axis.stroke({ width: 1.5, color: TEXT, alpha: 0.6 });
      const en = label('EARTH', 14, TEXT, { spacing: 2 }),
        mn = label(`MOON  ${fmt(MOON_KM)} KM`, 14, TEXT, { spacing: 2 });
      en.position.set(x0, mid + 50);
      mn.position.set(x1 - 40, mid + 46);
      fixed.addChild(path, axis, earth, moon, en, mn);
    } else if (m === 'approach') {
      const moon = new Sprite(moonTexture());
      moon.anchor.set(0.5);
      moon.position.set(BOARD.x + BOARD.w * 0.42, BOARD.y + BOARD.h / 2);
      fixed.addChild(moon);
      fixed.moon = moon;
    } else if (m === 'solar') {
      const id = SEASON[g.roundIndex].id;
      const { cx, cy, rad } = solar(id);
      const sun = new Sprite(puffTexture());
      sun.anchor.set(0.5);
      sun.position.set(cx, cy);
      sun.scale.set(1.1);
      sun.tint = 0xffd27a;
      sun.blendMode = 'add';
      const orbits = new Graphics().circle(cx, cy, 6).fill(0xffe2a0);
      const reach = routeReach(id);
      for (const [pid, p] of Object.entries(PLANETS)) {
        if (p.au > reach * 1.05) continue;
        orbits.circle(cx, cy, rad(p.au)).stroke({ width: 1, color: TEXT, alpha: 0.35 });
      }
      // The whole route as planned, dashed.
      const plan = new Graphics();
      for (const craft of ROUTES[id]) {
        const L = craft.legs;
        for (let d = L[0].day; d < L[L.length - 1].day; d += 6) {
          const [a0, r0] = craftAt(craft, d),
            [a1, r1] = craftAt(craft, d + 3);
          plan.moveTo(cx + Math.cos(a0) * rad(r0), cy - Math.sin(a0) * rad(r0));
          plan.lineTo(cx + Math.cos(a1) * rad(r1), cy - Math.sin(a1) * rad(r1));
        }
      }
      plan.stroke({ width: 1.5, color: INK, alpha: 0.35 });
      orbits.mask = boardMask;
      fixed.addChild(sun, orbits, plan);
      // The flight plan's list down the right of the board: every place each craft passes, and when.
      let y = BOARD.y + 60;
      const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      legend = [];
      for (const craft of ROUTES[id]) {
        const head = label(craft.name.toUpperCase(), 15, INK, { ax: 0, ay: 0, bold: true, spacing: 1 });
        head.position.set(BOARD.x + BOARD.w * 0.66, y);
        fixed.addChild(head);
        y += 26;
        for (const l of craft.legs) {
          const dd = dateOf(l.day);
          const t = label(
            `${l.what === 'launch' ? 'Launch' : `${PLANETS[l.planet].name} ${l.what}`}  ${dd.date} ${MON[dd.month - 1]} ${dd.year}`,
            13,
            TEXT,
            { ax: 0, ay: 0 },
          );
          t.position.set(BOARD.x + BOARD.w * 0.66 + 18, y);
          const tick = new Graphics();
          tick.position.set(BOARD.x + BOARD.w * 0.66 + 6, y + 8);
          fixed.addChild(t, tick);
          legend.push({ day: l.day, t, tick });
          y += 21;
        }
        y += 12;
      }
    }
  }
  // The Earth–Moon board's scale.
  const em = () => ({ x0: BOARD.x + 90, x1: BOARD.x + BOARD.w - 110, mid: BOARD.y + BOARD.h * 0.6 });
  const emX = d => em().x0 + ((em().x1 - em().x0) * d) / MOON_KM,
    emY = d => em().mid - 150 * Math.sin(Math.PI * Math.min(1, d / MOON_KM));
  // The planets' board: distances from the Sun on a square-root scale, so Venus and Neptune fit on one board, and the
  // drawing fitted to the board round the route and the planets it passes (the Sun stays on it).
  const fits = new Map();
  function solar(id) {
    if (fits.has(id)) return fits.get(id);
    const sq = au => Math.sqrt(au);
    const pts = [[0, 0]];
    for (const craft of ROUTES[id]) {
      const L = craft.legs;
      for (let d = L[0].day; d <= L[L.length - 1].day; d += 10) {
        const [a, r] = craftAt(craft, d);
        pts.push([Math.cos(a) * sq(r), Math.sin(a) * sq(r)]);
      }
    }
    const xs = pts.map(p => p[0]),
      ys = pts.map(p => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const room = { x: BOARD.x + 60, y: BOARD.y + 60, w: BOARD.w * 0.62 - 60, h: BOARD.h - 110 };
    const k = Math.min(room.w / Math.max(0.5, maxX - minX), room.h / Math.max(0.5, maxY - minY));
    const cx = room.x + room.w / 2 - ((minX + maxX) / 2) * k,
      cy = room.y + room.h / 2 + ((minY + maxY) / 2) * k;
    const f = { cx, cy, rad: au => sq(au) * k };
    fits.set(id, f);
    return f;
  }

  function update(dt, screen, reserve) {
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const s = Math.min(roomW / W, screen.height / H);
    world.scale.set(s);
    world.position.set((roomW - W * s) / 2, (screen.height - H * s) / 2);
    out.position.set(10, screen.height - 86);

    const m = deepMode(g);
    if (!m) return;
    morgan.update(m === 'cruise' || m === 'approach' ? g.people.morgan : null);
    if (m !== mode) {
      mode = m;
      build(m);
    }
    moving.clear();
    const here = SEASON[g.roundIndex],
      L = g.lunar;
    let tv = null; // what the monitor shows: { ground: k } for Ranger's pictures, { planet } on encounter days
    if (m === 'cruise') {
      setText(title, plotting ? `${here.name.toUpperCase()}: JPL TRACKING` : `${here.name}: tracking`);
      setText(note, L.vehicle === 'ranger' ? 'Height above the line not to scale' : 'Not to scale');
      // Her track; one that turns back is drawn a little below the way out.
      let peak = 0,
        first = true;
      for (const d of L.trail) {
        const back = d < peak - 1;
        peak = Math.max(peak, d);
        const y = emY(d) + (back ? 40 * (1 - d / peak) + 10 : 0);
        if (first) moving.moveTo(emX(d), y);
        else moving.lineTo(emX(d), y);
        first = false;
      }
      moving.stroke({ width: 4, color: INK });
      const back = L.dist < peak - 1;
      const hx = emX(L.dist),
        hy = emY(L.dist) + (back ? 40 * (1 - L.dist / Math.max(1, peak)) + 10 : 0);
      moving.circle(hx, hy, 9).fill(0xffffff).circle(hx, hy, 9).stroke({ width: 2, color: 0x222222 });
      drawLamps(STATIONS.early, L.station);
      setText(clockBig, `HOUR ${Math.floor(L.h)}`);
      setText(clockSmall, `${fmt(Math.round(L.dist / 1000) * 1000)} KM FROM EARTH`);
    } else if (m === 'approach') {
      setText(title, plotting ? 'GOLDSTONE: THE MOON COMING IN' : 'Goldstone: the approach');
      setText(
        note,
        L.vehicle === 'ranger'
          ? 'Green: the aim point. Amber: where the last fix puts her'
          : 'Amber: her line past the Moon',
      );
      const r = Math.min(190, (34 * 60) / (L.minutes + 9));
      const moon = fixed.moon;
      moon.width = moon.height = r * 2;
      const cx = moon.x,
        cy = moon.y;
      if (L.vehicle === 'ranger') {
        moving
          .moveTo(cx - 10, cy)
          .lineTo(cx + 10, cy)
          .moveTo(cx, cy - 10)
          .lineTo(cx, cy + 10);
        moving.stroke({ width: 2.5, color: 0x6fc88a });
        const off = (r * (L.predicted || 0)) / MOON_RADIUS;
        moving.circle(cx + off * 0.8, cy - off * 0.6, 9).stroke({ width: 2.5, color: 0xe8c66a });
        if (L.video) tv = { ground: 1 - Math.min(1, L.minutes / Math.max(1, L.lead || 20)) };
        else if (L.video === false) tv = { none: 'NO VIDEO' };
      } else {
        const off = Math.min(BOARD.w * 0.5, r * (1 + (L.predicted || 0) / MOON_RADIUS / 12));
        for (let y = BOARD.y + 8; y < BOARD.y + BOARD.h - 8; y += 16)
          moving.moveTo(cx + off, y).lineTo(cx + off, y + 8);
        moving.stroke({ width: 2.5, color: 0xe8c66a });
      }
      drawLamps(STATIONS.early, 'Goldstone');
      setText(clockBig, L.minutes > 0 ? `${Math.ceil(L.minutes)} MIN` : L.vehicle === 'ranger' ? 'IMPACT' : 'PASSED');
      setText(
        clockSmall,
        L.vehicle === 'ranger'
          ? L.video
            ? `${fmt(L.pictures)} PICTURES`
            : L.lead
              ? `CAMERAS ON AT ${L.lead} MIN`
              : 'CAMERAS OFF'
          : 'TO CLOSEST APPROACH',
      );
    } else {
      // The robotic missions: the planets on the day, the routes flown so far, the craft.
      const id = here.id,
        day = g.day;
      const step = g.room === 'probeEncounter' ? probeStep() : null;
      setText(title, plotting ? `${here.name.toUpperCase()}` : here.name);
      if (m === 'moonProbe') {
        setText(note, 'Not to scale');
        const k = step ? 0.85 : 0.08;
        const d = MOON_KM * k;
        moving.moveTo(emX(0), emY(0));
        for (let i = 1; i <= 30; i++) moving.lineTo(emX((d * i) / 30), emY((d * i) / 30));
        moving.stroke({ width: 4, color: INK });
        moving.circle(emX(d), emY(d), 9).fill(0xffffff);
        if (step) tv = { planet: 'moon' };
        setText(clockBig, `DAY ${Math.max(0, day - here.start)}`);
        setText(clockSmall, `${fmt(Math.round(d / 1000) * 1000)} KM FROM EARTH`);
      } else {
        setText(note, 'Distances from the Sun not to scale');
        const { cx, cy, rad } = solar(id);
        const reach = routeReach(id);
        const at = (a, r) => [cx + Math.cos(a) * rad(r), cy - Math.sin(a) * rad(r)];
        while (marks.children.length) marks.removeChildAt(0).destroy({ children: true });
        const placed = [];
        for (const [pid, p] of Object.entries(PLANETS)) {
          if (p.au > reach * 1.05) continue;
          const [x, y] = at(...planetAt(pid, day));
          moving.circle(x, y, p.r).fill(p.color);
          if (p.ring) moving.ellipse(x, y, p.r * 1.9, p.r * 0.5).stroke({ width: 2, color: 0xcdbb88 });
          // A name is left off where it would sit on another planet's.
          if (placed.some(([px, py]) => Math.abs(px - x) < 60 && Math.abs(py - y) < 18)) continue;
          placed.push([x, y]);
          const n = label(p.name, 13, TEXT);
          n.position.set(x, y + p.r + 12);
          marks.addChild(n);
        }
        for (const l of legend) {
          const done = day >= l.day;
          l.tick
            .clear()
            .circle(0, 0, 4)
            .fill(done ? INK : 0x000000)
            .circle(0, 0, 4)
            .stroke({ width: 1, color: TEXT });
          l.t.alpha = done ? 1 : 0.6;
        }
        let near = null,
          far = 0,
          nth = 0;
        for (const craft of ROUTES[id]) {
          const L0 = craft.legs[0].day;
          if (day < L0) continue;
          for (let d = L0; d < day; d += 4) {
            const [x0, y0] = at(...craftAt(craft, d)),
              [x1, y1] = at(...craftAt(craft, Math.min(day, d + 4)));
            moving.moveTo(x0, y0).lineTo(x1, y1);
          }
          moving.stroke({ width: 3.5, color: INK });
          const [a, r] = craftAt(craft, day);
          const [x, y] = at(a, r);
          moving.circle(x, y, 7).fill(0xffffff).circle(x, y, 7).stroke({ width: 2, color: 0x222222 });
          const n = label(craft.name, 14, INK, { bold: true, ax: 0 });
          n.position.set(x + 12, y - 14 + nth++ * 22);
          marks.addChild(n);
          // Her distance from Earth, for the board.
          const [ea, er] = planetAt('earth', day);
          const dx = Math.cos(a) * r - Math.cos(ea) * er,
            dy = Math.sin(a) * r - Math.sin(ea) * er;
          far = Math.max(far, Math.hypot(dx, dy));
          // The planet she is at today, for the monitor.
          const leg = craft.legs.find(l => Math.abs(l.day - day) <= 45 && l.planet !== 'earth');
          if (leg) near = leg.planet;
        }
        if (step && near) tv = { planet: near };
        if (g.room === 'probePlayback') tv = { planet: 'mars' };
        const years = (day - here.start) / 365.25;
        setText(clockBig, years >= 2 ? `YEAR ${Math.floor(years) + 1}` : `DAY ${Math.max(0, day - here.start)}`);
        const km = far * AU_KM,
          light = (km / 299792 / 60).toFixed(km > 2e9 ? 0 : 1);
        setText(
          clockSmall,
          km > 0
            ? `${km > 1e9 ? `${(km / 1e9).toFixed(1)} BILLION` : `${fmt(km / 1e6)} MILLION`} KM · SIGNAL ${light} MIN`
            : 'ON THE PAD',
        );
      }
      // The Deep Space Network's three stations take her in turn round the clock.
      const hour = Math.floor((g.clock % 1440) / 60);
      drawLamps(STATIONS.dsn, STATIONS.dsn[Math.floor(((hour + 16) % 24) / 8)]);
    }

    // The monitor, where the teletype's paper was: near the end all eyes are on the pictures.
    monitor.visible = !!tv;
    paper.visible = !tv;
    if (tv) {
      ground.visible = !!tv.ground || tv.ground === 0;
      tvPlanet.visible = !!tv.planet;
      if (ground.visible) {
        // Closer and closer, smoothly: the field grows from the whole frame to a few craters.
        const k = 0.75 + tv.ground ** 2 * 5;
        ground.scale.set(k);
        ground.position.set(-40 * tv.ground, 30 * tv.ground);
        setText(tvWord, `RANGER: ${fmt(L.pictures)} PICTURES`);
      } else if (tv.planet) {
        if (planetKey !== tv.planet) {
          planetKey = tv.planet;
          tvPlanet.removeChildren().forEach(c => c.destroy({ children: true }));
          tvPlanet.addChild(planetPicture(tv.planet));
        }
        setText(tvWord, (PLANETS[tv.planet]?.name || 'The Moon').toUpperCase());
      } else setText(tvWord, tv.none || '');
    }

    // The teletype's paper: the latest reports, newest at the bottom, fed out a little when a new one comes.
    const log = (L?.log || []).slice(-4);
    const text =
      m === 'solar' || m === 'moonProbe'
        ? [here.probe.tracking, probeStep()?.report].filter(Boolean).slice(-2).join('\n\n')
        : log.map(l => `${l.at}  ${l.text}`).join('\n\n');
    if (text !== lastLog) {
      lastLog = text;
      setText(paperText, text.toUpperCase());
      const h = Math.min(320, paperText.height + 24);
      paperBg
        .clear()
        .rect(1176, 618 - h, 308, h)
        .fill(0xece4cc)
        .rect(1176, 618 - h, 308, 3)
        .fill(0xd8ceb0);
    }
  }

  const stale = () => false;
  return { root, update, stale };
}
