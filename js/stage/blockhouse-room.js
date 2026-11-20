// THE BLOCKHOUSE ROOM (2D-HD rework, Aaron 20 November 2026, "Three-quarter, walk left-right"): the room itself, seen
// from above and behind the firing desk, as a lit diorama in pixels. The back wall with the count clock, the lamp board
// and the periscopes; the long firing desk with a controller at each station, their backs to us; the lamps hanging
// over them, each throwing a pool of light on the floor and a shadow away from it. The near edge of the room is out of
// focus (tilt-shift). The readings are not read here: the scene zooms into the player's own desk for them
// (blockhouse.js). Everything is painted at 320 x 180 art pixels, PX world units each, like every pixel scene.
// Presentation only: reads what the player could see, through game.js.
import { BlurFilter, Container, Rectangle } from '../vendor/pixi.min.mjs';
import { PX, pixelLayer, shade, pixelLamp, pixelBack, pixelStanding } from './pixel.js';
import { hdLayer } from './fx/hd.js';
import { paintPad } from './pixel-pad.js';
import { label, setText, speech } from './kit.js';

// The layout, in art pixels.
const WALL = 58, // where the back wall meets the floor
  TOP = 66, // the top edge of the firing desk's cabinet
  FACE0 = 69, // the sloping instrument face, seen from behind its operators
  FACE1 = 88,
  LEDGE = 96, // the front of the writing ledge
  SHOULDERS = 100, // the top of a seated controller's shoulders
  DX = 22, // the desk's left end
  SW = 68, // a station's width
  NEAR = 168; // where the out-of-focus near edge of the room begins
export const roomStation = i => ({ x: DX + i * (SW + 2), y: FACE0, w: SW, h: LEDGE - FACE0 });
const SHADOW = 0x090b12;

export function blockhouseRoom({ g, built, cape, pal, stations, game }) {
  const root = new Container();
  root.label = 'blockhouse-room';
  const M = { mx: 80, my: 40 };
  // Far (the back wall, a little soft), the room (sharp), the shadows (soft), the live room, the near edge (blurred).
  const far = pixelLayer(320, 180, M),
    room = pixelLayer(320, 180, M),
    shadows = pixelLayer(320, 180, M),
    live = pixelLayer(320, 180, M),
    near = pixelLayer(320, 180, M);
  shadows.sprite.alpha = 0.55;
  root.addChild(far.sprite, room.sprite, shadows.sprite, live.sprite, near.sprite);
  const hd = hdLayer(320, 180, M);
  root.addChild(hd.root);
  const type = new Container();
  root.addChild(type);
  const say = (text, size, color, x, y, opts = {}) => {
    const t = label(text, size, color, { bold: true, ...opts });
    t.position.set(x * PX, y * PX);
    type.addChild(t);
    return t;
  };
  const farBlur = new BlurFilter({ strength: 2, quality: 2 }),
    nearBlur = new BlurFilter({ strength: 8, quality: 3 }),
    shadowBlur = new BlurFilter({ strength: 3, quality: 2 });

  const L0 = -M.mx,
    LW = 320 + 2 * M.mx;
  const wall = built ? pal.wall : pal.wallOld;

  // ---- the back wall and the ceiling ----
  const F = far;
  F.vgrad(L0, -M.my, LW, WALL + M.my, [shade(wall, 0.62), shade(wall, 0.78), shade(wall, 0.9), shade(wall, 0.82)]);
  const mortar = shade(wall, 0.66);
  if (!built)
    for (let y = 2; y < WALL; y += 6) {
      F.rect(L0, y, LW, 1, mortar);
      const off = (y / 6) % 2 ? 0 : 8;
      for (let x = L0 + off; x < L0 + LW; x += 16) F.rect(x, y, 1, 6, mortar);
    }
  else
    for (let y = 8; y < WALL; y += 9) {
      F.rect(L0, y, LW, 1, mortar);
      F.rect(L0, y + 1, LW, 1, shade(wall, 0.95));
    }
  F.rect(L0, -M.my, LW, 4 + M.my, pal.beam); // the roof beam along the top
  F.rect(L0, 4, LW, 1, shade(pal.beam, 0.55));
  F.rect(L0, WALL - 3, LW, 3, shade(wall, 0.5)); // the skirting, in the dark where wall meets floor

  // The count clock, over the middle of the wall: a dark box with the drum in it.
  const CK = { x: 116, y: 8, w: 88, h: 30 };
  F.rect(CK.x - 2, CK.y - 2, CK.w + 4, CK.h + 4, 0x15161a);
  F.rect(CK.x, CK.y, CK.w, CK.h, 0x1d1f22);
  F.rect(CK.x + 4, CK.y + 4, CK.w - 8, 16, 0x0e0908);
  F.box(CK.x + 4, CK.y + 4, CK.w - 8, 16, 0x3a2a22);
  const drum = say('T- --:--', 44, pal.count, CK.x + CK.w / 2, CK.y + 12.2, { family: pal.mono });
  const word = say('NO COUNT', 13, pal.label, CK.x + CK.w / 2, CK.y + 25);
  say(
    cape ? 'BLOCKHOUSE · CAPE CANAVERAL' : built ? 'LAUNCH CONTROL' : 'W.S.P.G. BLOCKHOUSE',
    11,
    pal.label,
    160,
    -1.4,
    {
      spacing: 1,
    },
  );

  // The lamp board, to the right of the clock.
  const LB = { x: 220, y: 12, w: 84, h: 22 };
  F.rect(LB.x - 2, LB.y - 2, LB.w + 4, LB.h + 4, 0x15161a);
  F.rect(LB.x, LB.y, LB.w, LB.h, 0x26282b);
  const LAMPS = [
    ['hold', 'HOLD', 0xe0543c],
    ['poll', 'POLL', 0xf0b440],
    ['igniter', 'IGN', 0x7fdc8a],
    ['fire', 'FIRE', 0xff8a5a],
  ];
  const lampAt = {};
  LAMPS.forEach(([id, name, color], i) => {
    const x = LB.x + 11 + i * 21;
    lampAt[id] = { x, y: LB.y + 8, color };
    say(name, 10, pal.label, x, LB.y + 17);
  });

  // The periscopes: tubes down through the roof to the eyepieces, each with its round view of the pad.
  const scopes = built ? [42, 84] : [60];
  const R = 9;
  for (const x of scopes) {
    F.rect(x - 3, -M.my, 6, 20 + M.my, 0x4d5157);
    F.rect(x - 2, -M.my, 1, 20 + M.my, 0x6a6e75);
    F.rect(x - 6, 18, 12, 4, 0x3d4046);
    F.circ(x + 1, 33, R + 3, shade(wall, 0.45));
    F.circ(x, 32, R + 2, 0xa8823f);
    F.ring(x, 32, R + 1, 0x7a5c2a);
    F.rect(x - 4, 44, 8, 5, 0x3d4046); // the eyepiece, at a standing man's eye
    F.rect(x - 3, 44, 6, 1, 0x5a5e66);
  }
  const views = scopes.map(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2 * R + 1;
    return { cv, ctx: cv.getContext('2d') };
  });

  // The lamps hanging over the desk: green enamel shades on long cords (one bare bulb in the first blockhouse).
  const lamps = built ? [70, 160, 250] : [160];
  for (const x of lamps) {
    F.rect(x, -M.my, 1, 44 + M.my, 0x1a1a1a);
    if (built) {
      F.poly(
        [
          [x - 7, 49],
          [x + 8, 49],
          [x + 4, 44],
          [x - 3, 44],
        ],
        0x2f5a3c,
      );
      F.rect(x - 7, 49, 16, 1, 0x1e3a28);
      F.rect(x - 4, 50, 9, 1, 0xfff4d0);
    } else {
      F.rect(x - 1, 44, 3, 2, 0x3d372f);
      F.circ(x, 47, 1, 0xffe9a8);
    }
  }
  F.commit();

  // ---- the floor, the firing desk, the chairs ----
  const Rm = room;
  Rm.vgrad(L0, WALL, LW, 180 + M.my - WALL, [
    shade(pal.floor, 0.72),
    shade(pal.floor, 0.9),
    pal.floor,
    shade(pal.floor, 0.95),
  ]);
  // Floor joints, a little wider apart nearer the camera, running to a point above the room.
  for (let y = WALL + 4, step = 6; y < 180 + M.my; y += step, step += 1.4)
    Rm.rect(L0, Math.round(y), LW, 1, shade(pal.floor, 0.8));
  for (let x = -280; x <= 600; x += 40)
    Rm.line(160 + (x - 160) * 0.55, WALL, 160 + (x - 160) * 1.5, 220, shade(pal.floor, 0.82));
  // A cable trench cover running along under the desk.
  Rm.rect(L0, LEDGE + 30, LW, 4, shade(pal.floor, 0.7));
  Rm.rect(L0, LEDGE + 30, LW, 1, shade(pal.floor, 1.12));

  // The desk: the cabinet top, the sloping face of each station, the writing ledge.
  const DW = 4 * SW + 3 * 2;
  Rm.rect(DX - 4, TOP - 2, DW + 8, 3, shade(pal.panel, 0.7));
  Rm.rect(DX - 4, TOP, DW + 8, FACE0 - TOP, pal.panelTop);
  Rm.rect(DX - 4, FACE0, DW + 8, FACE1 - FACE0, pal.panel);
  Rm.rect(DX - 6, FACE1, DW + 12, LEDGE - FACE1, pal.desk);
  Rm.rect(DX - 6, FACE1, DW + 12, 1, shade(pal.desk, 1.25));
  Rm.rect(DX - 6, LEDGE, DW + 12, 3, shade(pal.deskFront, 0.8));
  // The desk's ends, seen at an angle.
  Rm.poly(
    [
      [DX - 6, TOP - 2],
      [DX - 12, LEDGE + 3],
      [DX - 6, LEDGE + 3],
    ],
    shade(pal.panel, 0.6),
  );
  Rm.poly(
    [
      [DX + DW + 6, TOP - 2],
      [DX + DW + 12, LEDGE + 3],
      [DX + DW + 6, LEDGE + 3],
    ],
    shade(pal.panel, 0.75),
  );
  const mineAt = stations.findIndex(s => s.mine);
  const faces = stations.map((st, i) => {
    const { x } = roomStation(i);
    Rm.rect(x + 2, FACE0 + 2, SW - 4, FACE1 - FACE0 - 4, pal.face);
    // Each station's instruments, small: dials across the top, a row of lamps under them, a card of notes on the ledge.
    const dials = [];
    for (let k = 0; k < 4; k++) {
      const dx = x + 9 + k * 16;
      Rm.circ(dx, FACE0 + 7, 3, 0x151412);
      Rm.circ(dx, FACE0 + 7, 2, pal.dial);
      dials.push(dx);
    }
    const dots = [];
    for (let k = 0; k < 8; k++) dots.push(x + 6 + k * 8);
    Rm.rect(x + 8 + ((i * 23) % 30), FACE1 + 2, 9, 4, 0xe8e0c8); // papers on the ledge
    Rm.rect(x + 8 + ((i * 23) % 30), FACE1 + 2, 9, 1, 0xfff8e6);
    if (st.mine) Rm.box(x, FACE0, SW, FACE1 - FACE0, 0xe8c66a);
    return { x, dials, dots, st };
  });
  // The recorder desk behind the controllers, seen from above: four pen recorders with their paper running out over
  // the top, a telephone, the log book open.
  const RD = { x: 58, y: 138, w: 204 };
  Rm.rect(RD.x - 2, RD.y - 1, RD.w + 4, 2, shade(pal.desk, 0.8));
  Rm.rect(RD.x, RD.y, RD.w, 14, pal.desk);
  Rm.rect(RD.x, RD.y, RD.w, 1, shade(pal.desk, 1.25));
  Rm.rect(RD.x, RD.y + 14, RD.w, 10, pal.deskFront);
  Rm.rect(RD.x, RD.y + 14, RD.w, 1, shade(pal.deskFront, 0.7));
  for (let i = 0; i < 4; i++) {
    const x = RD.x + 8 + i * 34;
    Rm.rect(x, RD.y + 2, 26, 9, 0x2a2c2e);
    Rm.rect(x + 2, RD.y + 3, 22, 7, 0xf6f1e2);
    for (let gy = 1; gy < 3; gy++) Rm.rect(x + 2, RD.y + 3 + gy * 2, 22, 1, 0xdcd3bb);
    for (let j = 0; j < 22; j++)
      Rm.px(x + 2 + j, RD.y + 5 + Math.round(1.6 * Math.sin(j * 0.5 + i * 1.7)), i % 2 ? 0x4b6a8a : 0xa3321f);
  }
  Rm.rect(RD.x + 148, RD.y + 3, 22, 9, 0xe8e0c8); // the log, open
  Rm.rect(RD.x + 159, RD.y + 3, 1, 9, 0xbfb59a);
  for (let j = 0; j < 4; j++) Rm.rect(RD.x + 150, RD.y + 5 + j * 2, 7, 1, 0x8a8170);
  Rm.rect(RD.x + 180, RD.y + 4, 12, 7, 0x161616); // the telephone
  Rm.rect(RD.x + 179, RD.y + 3, 14, 2, 0x262626);
  Rm.commit();
  const tag =
    mineAt >= 0 ? say(`${stations[mineAt].label} · YOU`, 13, 0xe8c66a, roomStation(mineAt).x + SW / 2, TOP - 5) : null;
  if (tag) tag.alpha = 0.95;

  // ---- the near edge of the room, out of focus: the back of the observers' bench, a clipboard, a coffee can ----
  const N = near;
  N.rect(L0, NEAR + 4, LW, 180 + M.my - NEAR - 4, shade(pal.deskFront, 0.55));
  N.rect(L0, NEAR, LW, 5, shade(pal.desk, 0.9));
  N.rect(L0, NEAR, LW, 1, shade(pal.desk, 1.3));
  N.rect(40, NEAR - 3, 18, 5, 0xe8e0c8);
  N.rect(42, NEAR - 4, 14, 1, 0x7a6a4a);
  N.rect(232, NEAR - 6, 7, 8, 0x7a5032);
  N.rect(232, NEAR - 6, 7, 1, 0x9a7050);
  N.commit();

  // ---- the speech bubbles ----
  const talk = stations.map(() => {
    const b = speech();
    root.addChild(b);
    return b;
  });
  const extraTalk = [speech(), speech()];
  root.addChild(...extraTalk);

  // The player's own station: click it to look at it close up.
  const deskHit = new Container();
  deskHit.eventMode = 'static';
  deskHit.cursor = 'pointer';
  if (mineAt >= 0) {
    const r = roomStation(mineAt);
    deskHit.hitArea = new Rectangle(r.x * PX, (TOP - 8) * PX, r.w * PX, (SHOULDERS + 24 - TOP + 8) * PX);
  }
  root.addChild(deskHit);

  // Each frame. c: the count; read: the readings; lit: the status lamps; seated: who sits at each station (or null);
  // standing: up to two people standing in the room.
  let viewAt = -1;
  function update({ c, lit, read, seated, standing, hdOn, t, k }) {
    setText(
      drum,
      c ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}` : 'T- --:--',
    );
    setText(
      word,
      !c ? 'NO COUNT' : c.checking ? 'HOLD · PAD CREW OUT' : c.poll ? 'POLL' : c.held ? 'HOLDING' : 'COUNTING',
    );
    far.sprite.filters = hdOn ? [farBlur] : null;
    near.sprite.filters = hdOn ? [nearBlur] : null;
    shadows.sprite.filters = hdOn ? [shadowBlur] : null;
    farBlur.strength = 0.25 * PX * k;
    nearBlur.strength = 1.6 * PX * k;
    shadowBlur.strength = 0.6 * PX * k;

    const P = live,
      S = shadows;
    P.clear();
    S.clear();
    // The periscopes' views, repainted at most five times a second.
    const now = performance.now();
    if (viewAt < 0 || now - viewAt > 200) {
      viewAt = now;
      for (const v of views) {
        v.ctx.clearRect(0, 0, v.cv.width, v.cv.height);
        paintPad(v.ctx, game, v.cv.width);
      }
    }
    scopes.forEach((x, i) => P.disc(views[i].cv, x, 32, R, false));
    for (const [id, l] of Object.entries(lampAt)) pixelLamp(P, l.x, l.y, 3, l.color, lit[id]);

    // The desk's lamps: the stations' own lamps show the count's state in small (all quiet with no count).
    faces.forEach(({ dots, dials, st }, i) => {
      dots.forEach((x, j) => {
        const on = !!c && (j + i * 3) % 4 !== 0;
        const col = j === 7 && lit.hold ? 0xe0543c : j === 6 && lit.poll ? 0xf0b440 : (j + i) % 3 ? 0x7fdc8a : 0xf0b440;
        P.px(x, FACE0 + 13, on ? col : shade(col, 0.3));
        P.px(x + 1, FACE0 + 13, on ? shade(col, 0.8) : shade(col, 0.25));
      });
      // The needles, small: each sits where its reading is (or at rest).
      dials.forEach((x, j) => {
        const v = read ? Object.values(read)[(i * 4 + j) % Object.keys(read).length] : null;
        const a = typeof v === 'number' ? 2.4 + ((Math.abs(v) % 10) / 10) * 4.2 : 2.4;
        P.px(x + Math.round(1.6 * Math.cos(a)), FACE0 + 7 + Math.round(1.6 * Math.sin(a)), 0xb5302a);
      });
      void st;
    });

    // The people at the desk, their shadows thrown away from the nearest lamp and toward us.
    stations.forEach((st, i) => {
      const x = roomStation(i).x + SW / 2;
      const who = seated[i];
      const lx = lamps.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      const lean = (x - lx) * 0.35;
      // The chair and whoever is in it: shadow first.
      S.poly(
        [
          [x - 10, SHOULDERS + 26],
          [x + 10, SHOULDERS + 26],
          [x + 13 + lean, SHOULDERS + 40],
          [x - 13 + lean, SHOULDERS + 40],
        ],
        SHADOW,
      );
      if (who) {
        S.circ(x + lean * 0.9, SHOULDERS + 41, 6, SHADOW);
        pixelBack(P, x, SHOULDERS, who);
        if (who.id === 'you')
          P.poly(
            [
              [x + 12, SHOULDERS - 16],
              [x + 19, SHOULDERS - 16],
              [x + 15.5, SHOULDERS - 12],
            ],
            0xe8c66a,
          );
      }
      // The chair's back, between us and the controller, then its column and feet.
      P.rect(x - 7, SHOULDERS + 14, 14, 8, 0x2b2520);
      P.rect(x - 6, SHOULDERS + 14, 12, 1, 0x4a3f34);
      P.rect(x - 1, SHOULDERS + 22, 2, 5, 0x1d1915);
      P.rect(x - 7, SHOULDERS + 27, 14, 1, 0x1d1915);
      talk[i].position.set(x * PX, (SHOULDERS - 18) * PX);
      talk[i].update(who ? who.bubble : null);
    });
    // The desks' own shadows on the floor.
    S.rect(DX - 6, LEDGE + 3, DW + 12, 6, SHADOW);
    S.poly(
      [
        [58, 162],
        [262, 162],
        [270, 172],
        [62, 172],
      ],
      SHADOW,
    );
    // Anyone else in the room stands at the ends, by the periscopes and the door.
    standing.slice(0, 2).forEach((p, i) => {
      const x = i ? 306 : 12,
        feet = 132;
      S.poly(
        [
          [x - 7, feet],
          [x + 7, feet],
          [x + 12 + (i ? 6 : -6), feet + 16],
          [x - 2 + (i ? 6 : -6), feet + 16],
        ],
        SHADOW,
      );
      pixelStanding(P, x, feet, p);
      extraTalk[i].position.set(x * PX, (feet - 47) * PX);
      extraTalk[i].update(p.bubble);
    });
    for (let i = standing.length; i < 2; i++) extraTalk[i].update(null);
    P.commit();
    S.commit();

    hd.root.visible = hdOn;
    if (hdOn) light(c, lit, t);
  }

  // The light: a pool under each lamp and a beam through the dust, the glow of the clock and the lamps.
  function light(c, lit, t) {
    hd.begin(built ? 0x8c8c98 : 0x6e6a74);
    for (const x of lamps) {
      const warm = built ? 0xf2ecd8 : 0xffd9a0;
      hd.light(x, 98, built ? 62 : 120, built ? 34 : 60, warm, built ? 0.62 : 0.7);
      hd.light(x, 72, 40, 18, warm, 0.35);
      hd.lightBeam(x, 50, 14, 90, 60, 0, warm, 0.12);
      hd.beam(x, 50, 12, 80, 62, 0, 0xfff4e0, 0.07);
      hd.motes(x, 52, 12, 70, 56, 0, 0xfff8e4, 22, t, 0.4);
      hd.light(x, 146, 50, 18, warm, 0.3);
      hd.glow(x, 50, 10, 0xfff4d0, built ? 0.6 : 0.9, 4);
    }
    // The clock and the lamp board.
    hd.light(CK.x + CK.w / 2, CK.y + 12, 56, 22, 0xffc8a0, c ? 0.3 : 0.12);
    hd.glow(CK.x + CK.w / 2, CK.y + 12, 34, pal.count, c ? 0.18 : 0.05, 9);
    for (const [id, l] of Object.entries(lampAt)) if (lit[id]) hd.glow(l.x, l.y, 9, l.color, 0.5);
    // Daylight down each periscope.
    for (const x of scopes) {
      hd.light(x, 32, R + 14, R + 14, 0xbcd8ff, 0.3);
      hd.glow(x - 3, 29, R * 0.7, 0xffffff, 0.07);
    }
    // The faces of the desk glow a little where the lamps are lit.
    if (c) hd.glow(160, FACE0 + 13, 150, 0x9ff0b8, 0.05, 6);
    // The player's own station is a little brighter, so the eye goes to it.
    if (mineAt >= 0) {
      const r = roomStation(mineAt);
      hd.light(r.x + SW / 2, FACE0 + 10, SW * 0.7, 20, 0xffffff, 0.22);
    }
    hd.vignette(0.55, 160, 90);
    hd.commit();
  }

  return { root, update, deskHit, deskAt: mineAt >= 0 ? roomStation(mineAt) : roomStation(1) };
}
