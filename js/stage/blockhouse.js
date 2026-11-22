// THE BLOCKHOUSE (v0.8, pixel art pass): the count, seen from behind the firing panel, painted at 320 x 180 pixels
// and scaled up crisp (js/stage/pixel.js). Every reading the blockhouse had is on the wall or the desk: the count drum,
// the status lamps, the pressurisation panel's dials (each tank, the pressurant, propellant loaded, oxygen
// temperature), the firing panel (continuity, arming, the firing bus), the range scope, and pen recorders tracing the
// tanks. The numbers and labels are full-resolution type over the pixels; the room panel keeps only the call.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Rectangle } from '../vendor/pixi.min.mjs';
import { g as game, countChannels, stageChannels, conducting, pressValve, pressOffered } from '../game.js';
import { uiEra } from '../site/draw.js';
import { paintPad } from './pixel-pad.js';
import { hdLayer, hdWanted } from './fx/hd.js';
import { blockhouseState } from '../data/campaign.js';
import { inside as insideOf } from '../site/interiors.js';
import { paletteFor, label, setText, speech, outButton } from './kit.js';
import { blockhouseRoom } from './blockhouse-room.js';
import { roomAndDesk } from './fx/zoom-view.js';
import {
  PX,
  pixelLayer,
  shade,
  dialFace,
  dialNeedle,
  dialAngle,
  pixelLamp,
  pixelBack,
  pixelStanding,
} from './pixel.js';

export const W = 1600,
  H = 900,
  FLOOR = 640;
const STATIONS = [
  { id: 'range', label: 'RANGE' },
  { id: 'press', label: 'PRESS' },
  { id: 'tc', label: 'TEST CONDUCTOR' },
  { id: 'pad', label: 'PAD · FIRING' },
];
// The layout in art pixels (one pixel is PX world units).
const FL = FLOOR / PX, // 128: where the wall meets the floor
  ST_W = 70,
  ST_GAP = 4,
  X0 = 14,
  DESK = 72,
  FACE_Y = 76,
  FACE_H = 33,
  SEAT_TOP = 126; // the top of a seated controller's shoulders
const stX = i => X0 + i * (ST_W + ST_GAP);

// Who is in the blockhouse: the people staying within reach of its door (js/site/interiors.js, shared with the old room).
const inside = g => insideOf(g, 'blockhouse', 180);
const seats = () => {
  const tc = conducting();
  return { range: 'morgan', press: tc ? 'delgado' : 'you', tc: tc ? 'you' : 'ellis', pad: 'vega' };
};

// The scene: built once per visit (and again if the room changes era or blockhouse); update() moves it each frame.
export function blockhouseScene({ leave }) {
  const g = game;
  const cape = g.site === 'cape',
    built = cape || blockhouseState(g.day).built,
    era = uiEra(g),
    pal = paletteFor(era);
  const chans = Object.fromEntries(stageChannels().map(c => [c.id, c]));
  const root = new Container();
  const world = new Container();
  root.addChild(world);
  // The still room is painted with a margin all round, so a window wider or taller than 16:9 shows more room.
  const back = pixelLayer(320, 180, { mx: 80, my: 40 }),
    live = pixelLayer();
  world.addChild(back.sprite, live.sprite);
  // The 2D-HD light over the pixels and under the type, so the readings stay sharp and bright (fx/hd.js).
  const hd = hdLayer(320, 180, { mx: 80, my: 40 });
  world.addChild(hd.root);
  const type = new Container(); // the full-resolution type, over the pixels
  world.addChild(type);
  // A label at art-pixel position (x, y).
  const say = (text, size, color, x, y, opts = {}) => {
    const t = label(text, size, color, { bold: true, ...opts });
    t.position.set(x * PX, y * PX);
    type.addChild(t);
    return t;
  };
  const B = back;

  // ---- the room: the wall (cinder block in the first blockhouse, poured concrete in the later ones), the roof beam,
  // the lights, the floor ----
  const wall = built ? pal.wall : pal.wallOld;
  const L0 = -B.mx,
    LW0 = 320 + 2 * B.mx;
  B.vgrad(L0, -B.my, LW0, FL + B.my, [shade(wall, 0.8), shade(wall, 0.86), wall, shade(wall, 1.07)]);
  const mortar = shade(wall, 0.8);
  if (!built)
    for (let y = 8; y < FL; y += 7) {
      B.rect(L0, y, LW0, 1, mortar);
      const off = (y / 7) % 2 ? 0 : 9;
      for (let x = L0 + off; x < L0 + LW0; x += 18) B.rect(x, y, 1, 7, mortar);
    }
  else
    for (let y = 14; y < FL; y += 9) {
      B.rect(L0, y, LW0, 1, mortar);
      B.rect(L0, y + 1, LW0, 1, shade(wall, 1.1));
      for (let x = L0 + 37; x < L0 + LW0; x += 64) B.px(x, y + 4, mortar);
    }
  if (built)
    for (const lx of [60, 160, 260]) {
      B.rect(lx - 18, 8, 36, 2, 0xf4f0dc);
      B.rect(lx - 18, 10, 36, 1, shade(wall, 0.6));
      B.glow(lx, 14, 60, 40, shade(wall, 1.16), 0.45);
    }
  else {
    B.rect(94, 8, 1, 9, 0x2c2822);
    B.rect(92, 16, 5, 2, 0x3d372f);
    B.glow(94, 26, 46, 30, shade(wall, 1.18), 0.55);
    B.circ(94, 19, 1, 0xffe9a8);
  }
  B.rect(L0, -B.my, LW0, 7 + B.my, pal.beam);
  B.rect(L0, 7, LW0, 1, shade(pal.beam, 0.6));
  B.vgrad(L0, FL, LW0, 180 + B.my - FL, [pal.floor, shade(pal.floor, 0.75), shade(pal.floor, 0.6)]);
  B.rect(L0, FL, LW0, 1, shade(pal.floor, 0.6));
  for (let x = -320; x <= 640; x += 32)
    B.line(160 + (x - 160) * 0.6, FL + 1, 160 + (x - 160) * 1.6, 179 + B.my, shade(pal.floor, 0.88));

  // ---- the periscopes: the pad, round, in a brass ring ----
  const scopes = built
    ? [
        [34, 40, 'PERISCOPE 1'],
        [93, 40, 'PERISCOPE 2'],
      ]
    : [[46, 40, 'PERISCOPE']];
  const R = built ? 22 : 25;
  for (const [cx, cy, name] of scopes) {
    B.rect(cx + R + 2, 8, 4, cy - 10, 0x4d5157);
    B.rect(cx + R + 3, 8, 1, cy - 10, 0x6a6e75);
    B.rect(cx + R - 2, cy - 3, 9, 6, 0x4d5157);
    B.circ(cx + 1, cy + 2, R + 3, shade(wall, 0.55));
    B.circ(cx, cy, R + 2, 0xa8823f);
    B.ring(cx, cy, R + 1, 0x7a5c2a);
    for (let a = 3.3; a < 4.9; a += 0.05)
      B.px(cx + Math.round((R + 2) * Math.cos(a)), cy + Math.round((R + 2) * Math.sin(a)), 0xe0c07a);
    say(name, 15, pal.label, cx, cy + R + 7, { family: 'Georgia, serif', bold: false });
  }
  // Each view is the pad painted in pixels (pixel-pad.js); the second periscope's glass is a little green.
  const views = scopes.map((s, i) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2 * R + 1;
    const ctx = cv.getContext('2d');
    return {
      cv,
      paint() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        paintPad(ctx, game, cv.width);
        if (i === 1) {
          ctx.fillStyle = 'rgba(30,60,40,.18)';
          ctx.fillRect(0, 0, cv.width, cv.width);
        }
      },
    };
  });

  // ---- the count drum and the status lamps, over the conductor's end of the panel ----
  const CX = built ? 140 : 128;
  B.rect(CX, 16, 68, 30, 0x2c2e30);
  B.box(CX - 1, 15, 70, 32, 0x1b1c1e);
  B.rect(CX + 4, 22, 60, 15, 0x120c0a);
  B.box(CX + 4, 22, 60, 15, 0x3a2a22);
  B.rect(CX + 5, 23, 58, 1, 0x1f1612);
  say(
    cape ? 'BLOCKHOUSE · CAPE CANAVERAL' : built ? 'LAUNCH CONTROL · NEW BLOCKHOUSE' : 'W.S.P.G. BLOCKHOUSE',
    14,
    pal.label,
    CX + 34,
    19.4,
    {
      spacing: 1,
    },
  );
  const drum = say('T- --:--', 48, pal.count, CX + 34, 30.2, { family: pal.mono });
  const word = say('NO COUNT', 16, pal.label, CX + 34, 42);

  const LX = CX + 76,
    LW = 312 - LX;
  B.rect(LX, 16, LW, 30, 0x2c2e30);
  B.box(LX - 1, 15, LW + 2, 32, 0x1b1c1e);
  const LAMPS = [
    ['hold', 'HOLD', 0xe0543c],
    ['poll', 'POLL', 0xf0b440],
    ['igniter', 'IGNITER', 0x7fdc8a],
    ['fire', 'FIRE', 0xff8a5a],
  ];
  const lampAt = {};
  LAMPS.forEach(([id, name, color], i) => {
    const x = Math.round(LX + LW / 8 + (i * LW) / 4);
    lampAt[id] = { x, y: 27, color };
    say(name, 13, pal.label, x, 37.5);
  });

  // ---- the pen recorders, tracing the tanks and the pressurant (and the oxygen's temperature where there is one) ----
  const traced = ['tank.ox', 'tank.fuel', 'bottle', chans['lox.temp'] ? 'lox.temp' : 'bus'].map(id => chans[id]);
  const RY = 52,
    RH = 10,
    RW = 312 - CX,
    SW = Math.floor((RW - 3 * 2) / 4);
  B.rect(CX - 1, RY - 2, RW + 2, RH + 9, 0x2a2c2e);
  traced.forEach((ch, i) => {
    const x = CX + i * (SW + 2);
    B.rect(x, RY, SW, RH, 0xf6f1e2);
    for (let gy = 1; gy < 4; gy++) B.rect(x, RY + Math.round((gy * RH) / 4), SW, 1, 0xdcd3bb);
    say(ch.label.toUpperCase(), 12, pal.label, x + SW / 2, RY + RH + 3.6);
  });
  const hist = traced.map(() => []);

  // ---- the firing panel: one long desk, a station each ----
  const DW = 4 * ST_W + 3 * ST_GAP;
  B.rect(X0 - 5, DESK, DW + 10, 38, pal.panel);
  B.rect(X0 - 5, DESK, DW + 10, 2, pal.panelTop);
  B.rect(X0 - 7, DESK + 38, DW + 14, 4, pal.desk);
  B.rect(X0 - 7, DESK + 38, DW + 14, 1, shade(pal.desk, 1.2));
  B.rect(X0 - 6, DESK + 42, DW + 12, FL - DESK - 42, pal.deskFront);
  for (let x = X0; x < X0 + DW; x += 29) B.rect(x, DESK + 42, 1, FL - DESK - 42, shade(pal.deskFront, 0.85));
  B.rect(X0 - 6, FL - 1, DW + 12, 1, shade(pal.deskFront, 0.7));
  const seatOf = seats();
  STATIONS.forEach((st, i) => {
    const x = stX(i);
    const mine = seatOf[st.id] === 'you';
    B.rect(x, FACE_Y, ST_W, FACE_H, pal.face);
    B.box(x, FACE_Y, ST_W, FACE_H, shade(pal.face, 0.75));
    if (mine) B.box(x - 1, FACE_Y - 1, ST_W + 2, FACE_H + 2, 0xe8c66a);
    say(st.label + (mine ? ' · YOU' : ''), 15, mine ? 0xe8c66a : pal.label, x + ST_W / 2, FACE_Y + 3.4);
    // The empty chair, which a controller covers when there is one.
    const cx = x + ST_W / 2;
    B.rect(cx - 9, SEAT_TOP + 2, 18, 20, 0x2b2520);
    B.rect(cx - 8, SEAT_TOP + 2, 16, 1, 0x3e352c);
    B.rect(cx - 1, SEAT_TOP + 22, 2, 6, 0x2b2520);
    B.rect(cx - 7, SEAT_TOP + 28, 14, 1, 0x2b2520);
  });

  // RANGE: the plot scope and its sweep, the range-clear lamp.
  const rx = stX(0);
  const scope = { x: rx + 17, y: 94, r: 11 };
  B.circ(scope.x, scope.y, scope.r + 1, 0x151412);
  B.circ(scope.x, scope.y, scope.r, 0x0d1a12);
  B.ring(scope.x, scope.y, 6, 0x1f3b2d);
  B.rect(scope.x - scope.r + 1, scope.y, 2 * scope.r - 1, 1, 0x15281e);
  const rangeLamp = { x: rx + 50, y: 89 };
  say('RANGE CLEAR', 12, pal.label, rx + 50, 97);

  // PRESS: a dial for each tank and the pressurant, propellant loaded, the oxygen's temperature.
  const ppx = stX(1);
  const shortName = {
    'tank.ox': chans['lox.temp'] ? 'LOX' : 'Acid',
    'tank.fuel': 'Fuel',
    bottle: chans.bottle.label.startsWith('Helium') ? 'Helium' : 'Gas gen',
  };
  const dials = ['tank.ox', 'tank.fuel', 'bottle'].map((id, i) => {
    const d = { id, x: ppx + 12 + i * 23, y: 89, r: 7, ang: dialAngle(chans[id]), shown: chans[id].range[0] };
    dialFace(B, d.x, d.y, d.r, chans[id]);
    d.read = say('—', 12, pal.ink, d.x, d.y + 3.2, { family: pal.mono });
    say(
      `${shortName[id].toUpperCase()}${chans[id].unit ? ` · ${chans[id].unit.toUpperCase()}` : ''}`,
      11,
      pal.label,
      d.x,
      d.y + 10.6,
    );
    return d;
  });
  const loaded = { ch: chans.loaded, x: ppx + 4, y: 105, w: chans['lox.temp'] ? 34 : 62 };
  B.rect(loaded.x - 1, loaded.y - 1, loaded.w + 2, 4, 0x2b2a24);
  B.rect(loaded.x, loaded.y, loaded.w, 2, 0x15130f);
  loaded.t = say('LOADED —', 11, pal.label, loaded.x, loaded.y - 2.6, { ax: 0 });
  let lox = null;
  if (chans['lox.temp']) {
    lox = { ch: chans['lox.temp'], x: ppx + 42, y: 105, w: 24 };
    B.rect(lox.x - 1, lox.y - 1, lox.w + 2, 4, 0x2b2a24);
    B.rect(lox.x, lox.y, lox.w, 2, 0x15130f);
    lox.t = say('LOX —', 11, pal.label, lox.x, lox.y - 2.6, { ax: 0 });
  }
  // TEST CONDUCTOR: the seconds counter, the hold button, the intercom keys.
  const tx = stX(2);
  B.rect(tx + 4, 82, 34, 11, 0x120c0a);
  B.box(tx + 4, 82, 34, 11, 0x3a2a22);
  const secs = say('---', 26, pal.count, tx + 21, 87.6, { family: pal.mono });
  B.circ(tx + 54, 89, 7, 0x151412);
  B.circ(tx + 54, 89, 6, 0x7a1f16);
  B.circ(tx + 54, 88, 5, 0xd0634f);
  B.px(tx + 52, 86, 0xff9a8a);
  say('HOLD', 12, 0xffffff, tx + 54, 88.2);
  for (let k = 0; k < 5; k++) {
    B.rect(tx + 4 + k * 7, 97, 5, 4, 0x26292c);
    B.rect(tx + 4 + k * 7, 97, 5, 1, 0x3a3e42);
  }
  say('INTERCOM', 12, pal.label, tx + 21, 104.6);

  // PAD · FIRING: continuity, arming, the firing bus, the firing key in its guard.
  const fx = stX(3);
  const contLamp = { x: fx + 11, y: 83 },
    armLamp = { x: fx + 11, y: 97 };
  say('CONTINUITY', 11, pal.label, fx + 11, 89.6);
  say('ARMED', 11, pal.label, fx + 11, 103.6);
  const bus = { id: 'bus', x: fx + 33, y: 92, r: 7, ang: dialAngle(chans.bus), shown: chans.bus.range[0] };
  dialFace(B, bus.x, bus.y, bus.r, chans.bus);
  bus.read = say('—', 11, pal.ink, bus.x, bus.y + 3.4, { family: pal.mono });
  say('BUS · V', 11, pal.label, bus.x, bus.y + 10);
  B.rect(fx + 46, 81, 19, 19, 0x1b1c1e);
  B.rect(fx + 48, 83, 15, 15, 0xcc9944);
  B.rect(fx + 48, 83, 15, 1, 0xe2b866);
  B.circ(fx + 55, 90, 3, 0x2a2a2a);
  say('FIRE', 12, pal.label, fx + 55, 104);
  const keyAt = { x: fx + 55, y: 90 };

  // ---- speech, over the pixels at full resolution ----
  const talk = STATIONS.map(() => {
    const b = speech();
    world.addChild(b);
    return b;
  });
  const extraTalk = [speech(), speech()];
  world.addChild(...extraTalk);
  back.commit();

  // ---- the way out ----
  // The press valve (hands-on idea 4): in the terminal count, press and hold on the PRESS panel to top the tanks up.
  // An empty hit box over the panel, since drawn shapes are not hit-tested while the pixel pass has them (pixelate.js).
  const valveHit = new Container();
  valveHit.eventMode = 'static';
  valveHit.hitArea = new Rectangle(stX(1) * PX, FACE_Y * PX, ST_W * PX, FACE_H * PX);
  valveHit.on('pointerdown', () => pressValve(true));
  for (const ev of ['pointerup', 'pointerupoutside', 'pointerleave']) valveHit.on(ev, () => pressValve(false));
  world.addChild(valveHit);
  const out = outButton(leave);
  root.addChild(out);

  // ---- the room, and the zoom into the player's own desk (2D-HD rework, Aaron 20 November 2026) ----
  // The scene opens on the room seen from above and behind the desk; when the player is running the count it moves in
  // to their own desk (the panel above, the readings full size) after a moment. The button and a click on the desk
  // move between the two.
  const seat0 = seats();
  const room = blockhouseRoom({
    g,
    built,
    cape,
    pal,
    game,
    stations: STATIONS.map(st => ({ id: st.id, label: st.label, mine: seat0[st.id] === 'you' })),
  });
  root.addChildAt(room.root, 0);
  const zoom = roomAndDesk({
    room: room.root,
    desk: world,
    focus: room.deskAt,
    W,
    H,
    auto: () => !!g.count && !!g.room?.startsWith('count'),
  });
  root.addChild(zoom.toggle);
  room.deskHit.on('pointertap', zoom.goIn);

  // ---- each frame ----
  let lastPush = -1,
    viewAt = -1;
  function update(dt, screen, reserve) {
    // Fit the room and the desk into the screen left of the room panel, as the canvas interiors did (fx/zoom-view.js).
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const { e, rs } = zoom.update(dt, 0, 0, roomW, screen.height);
    out.position.set(10, screen.height - 40 - 46);
    zoom.toggle.position.set(10, screen.height - 40 - 46 - 48);

    const c = g.count,
      t = g.time;
    valveHit.cursor = pressOffered() ? 'pointer' : 'default';
    const read = c ? countChannels() : null;
    const v = id => (read ? read[id] : null);
    setText(
      drum,
      c ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}` : 'T- --:--',
    );
    setText(
      word,
      !c ? 'NO COUNT' : c.checking ? 'HOLD · PAD CREW OUT' : c.poll ? 'POLL' : c.held ? 'HOLDING' : 'COUNTING',
    );
    const P = live;
    P.clear();

    // The periscopes: the views are repainted at most five times a second.
    const now = performance.now();
    if (viewAt < 0 || now - viewAt > 200) {
      viewAt = now;
      views.forEach(vw => vw.paint());
    }
    scopes.forEach(([cx, cy], i) => {
      P.disc(views[i].cv, cx, cy, R, false);
      // The graticule: a dotted cross, so it marks the middle without hiding the pad.
      for (let k = -R; k <= R; k += 2) {
        P.px(cx + k, cy, 0x2a3a40);
        P.px(cx, cy + k, 0x2a3a40);
      }
    });

    // The status lamps.
    const lit = {
      hold: !!c && (c.held || c.checking),
      poll: !!c && !!c.poll,
      igniter: !!read && read.igniter,
      fire: !!c && c.clock <= 10 && !c.held && !c.poll,
    };
    for (const [id, l] of Object.entries(lampAt)) pixelLamp(P, l.x, l.y, 4, l.color, lit[id]);

    // A point on the recorders each count second; the paper stands still when the count does.
    const sec = c ? Math.floor(c.since ?? 0) : -1;
    if (c && sec !== lastPush)
      traced.forEach((ch, i) => (hist[i].push(v(ch.id)), hist[i].length > SW * 3 && hist[i].shift()));
    lastPush = sec;
    traced.forEach((ch, i) => {
      const x0 = CX + i * (SW + 2),
        pts = hist[i],
        ink = i % 2 ? 0x4b6a8a : 0xa3321f;
      const y = val =>
        RY +
        RH -
        1 -
        ((Math.max(ch.range[0], Math.min(ch.range[1], val)) - ch.range[0]) / (ch.range[1] - ch.range[0])) * (RH - 1);
      let prev = null;
      for (let j = 0; j < pts.length; j += 3) {
        const val = pts[j];
        const px = x0 + SW - 1 - Math.floor((pts.length - 1 - j) / 3);
        if (val == null || px < x0) {
          prev = null;
          continue;
        }
        const py = Math.round(y(val));
        if (prev) P.line(prev[0], prev[1], px, py, ink);
        else P.px(px, py, ink);
        prev = [px, py];
      }
    });

    // The range scope's sweep, with a fading trail.
    if (c) {
      const a = t * 2;
      for (const [back, col] of [
        [0.5, 0x1f4a32],
        [0.25, 0x3f8a5a],
        [0, 0x9ff0b8],
      ])
        P.line(
          scope.x,
          scope.y,
          scope.x + Math.round((scope.r - 1) * Math.cos(a - back)),
          scope.y + Math.round((scope.r - 1) * Math.sin(a - back)),
          col,
        );
    }
    pixelLamp(P, rangeLamp.x, rangeLamp.y, 3, 0x7fdc8a, !!c);

    // The dials: a needle has weight, so it swings to the reading rather than jumping.
    for (const d of [...dials, bus]) {
      const val = v(d.id);
      setText(
        d.read,
        val == null || typeof val !== 'number' ? '—' : Math.abs(val) >= 100 ? String(Math.round(val)) : val.toFixed(1),
      );
      const target = typeof val === 'number' ? val : chans[d.id].range[0];
      d.shown += (target - d.shown) * Math.min(1, dt * 6);
      dialNeedle(P, d.x, d.y, d.r, d.ang(d.shown));
    }
    for (const b of [loaded, lox]) {
      if (!b) continue;
      const val = v(b.ch.id);
      const kk = val == null ? 0 : Math.max(0, Math.min(1, (val - b.ch.range[0]) / (b.ch.range[1] - b.ch.range[0])));
      P.rect(b.x, b.y, Math.round(b.w * kk), 2, pal.band);
      setText(b.t, `${b === loaded ? 'LOADED' : 'LOX'} ${val == null ? '—' : `${val.toFixed(1)} ${b.ch.unit}`}`);
    }
    setText(secs, c ? `${Math.ceil(c.clock)} s` : '---');
    pixelLamp(P, contLamp.x, contLamp.y, 3, 0x7fdc8a, !!read && read.igniter);
    pixelLamp(P, armLamp.x, armLamp.y, 3, 0xf0b440, !!c && c.clock <= 60);
    const turned = c && c.clock <= 1;
    if (turned) P.line(keyAt.x, keyAt.y, keyAt.x + 3, keyAt.y - 3, 0xefe6cf);
    else P.rect(keyAt.x, keyAt.y - 4, 1, 4, 0xefe6cf);

    // Who sits where, who stands at the back, and what they are saying.
    const seat = seats();
    const here = new Set(inside(g).map(p => p.id));
    if (c) here.add('you');
    const away = id => g.jobs.some(j => (j.who || []).includes(id));
    const seated = STATIONS.map(st => {
      const who = g.people[seat[st.id]];
      return who && !who.hidden && (c ? !away(who.id) : here.has(who.id)) ? who : null;
    });
    STATIONS.forEach((st, i) => {
      const who = seated[i];
      const x = stX(i) + ST_W / 2;
      if (who) {
        pixelBack(P, x, SEAT_TOP, who);
        if (who.id === 'you')
          P.poly(
            [
              [x + 12, SEAT_TOP - 14],
              [x + 19, SEAT_TOP - 14],
              [x + 15.5, SEAT_TOP - 10],
            ],
            0xe8c66a,
          );
      }
      talk[i].position.set(x * PX, DESK * PX - 4);
      talk[i].update(who && e >= 0.5 ? who.bubble : null);
    });
    const extra = [...here].map(id => g.people[id]).filter(p => p && !Object.values(seat).includes(p.id));
    extra.slice(0, 2).forEach((p, i) => {
      const x = i ? 302 : 18,
        feet = 160;
      pixelStanding(P, x, feet, p);
      extraTalk[i].position.set(x * PX, (feet - 47) * PX);
      extraTalk[i].update(e >= 0.5 ? p.bubble : null);
    });
    for (let i = extra.length; i < 2; i++) extraTalk[i].update(null);
    const hdOn = hdWanted();
    if (e < 1) {
      const quiet = b => (e < 0.5 ? b : null);
      room.update({
        c,
        lit,
        read,
        seated: seated.map(w => (w ? { ...w, bubble: quiet(w.bubble) } : null)),
        standing: extra.slice(0, 2).map(p => ({ ...p, bubble: quiet(p.bubble) })),
        hdOn,
        t,
        k: rs,
      });
    }
    P.commit();
    hd.root.visible = hdOn;
    if (hd.root.visible) light(c, read, lit);
  }

  // The light: the room's own lamps, the daylight down the periscopes, and the halo of everything lit on the panel.
  function light(c, read, lit) {
    const t = g.time || 0;
    hd.begin(built ? 0x9696a0 : 0x77737a);
    if (built)
      for (const lx of [60, 160, 260]) {
        hd.light(lx, 30, 95, 75, 0xf2f0e6, 0.5);
        hd.lightBeam(lx, 10, 36, 96, FL - 10, 0, 0xf2f0e6, 0.12);
        hd.beam(lx, 11, 34, 92, FL - 4, 0, 0xf4f2ea, 0.07);
        hd.motes(lx, 12, 30, 80, FL - 14, 0, 0xfff8e4, 26, t, 0.4);
        hd.glow(lx, 9, 24, 0xfffbea, 0.55, 4);
        hd.glow(lx, 12, 46, 0xf4f0dc, 0.12, 16);
      }
    else {
      // The one bare bulb: a warm pool under it and a cone of light through the dust.
      hd.light(94, 40, 160, 120, 0xffd9a0, 0.62);
      hd.lightBeam(94, 20, 6, 150, FL, 0, 0xffd9a0, 0.18);
      hd.beam(94, 20, 4, 130, FL + 10, 0, 0xffdca0, 0.12);
      hd.motes(94, 22, 6, 120, FL - 10, 0, 0xfff0c8, 40, t, 0.55);
      hd.glow(94, 19, 7, 0xfff4d0, 0.95);
      hd.glow(94, 21, 34, 0xffd890, 0.22);
    }
    // The desk: a little light thrown down on to the panel, so the faces read.
    hd.light(stX(0) + (4 * ST_W + 3 * ST_GAP) / 2, FACE_Y + 14, 175, 34, 0xffffff, 0.3);
    // Daylight down the periscopes; once she lights, the glass glows with the flame.
    const flying = g.rocket?.where === 'flying';
    for (const [cx, cy] of scopes) {
      hd.light(cx, cy, R + 26, R + 26, 0xbcd8ff, 0.35);
      hd.glow(cx - R / 3, cy - R / 3, R * 0.7, 0xffffff, 0.07);
      if (flying) hd.glow(cx, cy + R / 2, R + 14, 0xffa860, 0.22);
    }
    // The count drum and the lamps: a bloom round each lit thing.
    hd.glow(CX + 34, 30, 36, pal.count, c ? 0.16 : 0.05, 10);
    for (const [id, l] of Object.entries(lampAt)) if (lit[id]) hd.glow(l.x, l.y, 11, l.color, 0.55);
    if (c) {
      hd.glow(rangeLamp.x, rangeLamp.y, 8, 0x7fdc8a, 0.45);
      hd.glow(scope.x, scope.y, 15, 0x9ff0b8, 0.14);
      hd.glow(tx + 21, 87.5, 22, pal.count, 0.1, 7);
      if (c.clock <= 60) hd.glow(armLamp.x, armLamp.y, 8, 0xf0b440, 0.45);
    }
    if (read && read.igniter) hd.glow(contLamp.x, contLamp.y, 8, 0x7fdc8a, 0.45);
    hd.vignette(0.5, 160, 70);
    hd.commit();
  }

  // Rebuild when the blockhouse itself changes (the new one is built, the move to the Cape, a new era).
  const key = `${cape}|${built}|${era}|${conducting()}`;
  const stale = () => {
    const nowBuilt = g.site === 'cape' || blockhouseState(g.day).built;
    return `${g.site === 'cape'}|${nowBuilt}|${uiEra(g)}|${conducting()}` !== key;
  };
  return { root, update, stale };
}
