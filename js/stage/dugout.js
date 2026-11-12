// THE TEST STAND DUGOUT, rebuilt in PixiJS (v0.8), from the static fire test scene. A cutaway: the dugout under its
// earth mound on the left, the stand out on the desert on the right with the stage in it. Every reading the stand
// carried is on the dugout's panel: the count drum, the lamps, a dial for each tank, the pressurant, the chamber, the
// thrust (and the turbopump or the chamber wall where the stage has one), bars for propellant loaded and left, the
// oxygen's temperature and the firing bus, and the pen recorder tracing the firing. The flame, the smoke out of the
// trench and the dust shaken off the dugout roof follow the chamber pressure. The room panel keeps only the decision.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { g as game, kit, standChannels, stageChannels } from '../game.js';
import { standStructure, roundShape, skyFor, uiEra, PLACES, GROUND } from '../site/draw.js';
import { atPlace } from '../data/white-sands.js';
import {
  paletteFor,
  label,
  setText,
  dial,
  lamp,
  bar,
  seatedBack,
  speech,
  canvasPicture,
  colorOf,
  outButton,
  particles,
  puffTexture,
} from './kit.js';

export const W = 1600,
  H = 900;
const SURFACE = 560; // the desert's surface in the scene
const DUG = { x: 30, y: 170, w: 850, h: 630 }; // the dugout's room, inside its concrete shell
const CON = { x: 50, y: 240, w: 810, h: 390 }; // the instrument panel
// The stand picture: the site around the stand, from the old canvas drawing, at 2 scene pixels to a site unit.
const PK = 2,
  STAND_X = 1300, // where the round's centre line falls in the scene
  PIC_W = 640,
  PIC_H = 480,
  PIC_GROUND = 400; // the ground line in the picture
const site = PLACES.stand.x + 60;
const toScene = (sx, sy) => [STAND_X + (sx - site) * PK, SURFACE + (sy - GROUND) * PK];

const inside = g =>
  Object.values(g.people).filter(
    p => !p.hidden && (Math.abs(p.x - PLACES.dugout.door) < 140 || atPlace('dugout', g, p.x)),
  );

export function dugoutScene({ leave }) {
  const g = game;
  const era = uiEra(g),
    pal = paletteFor(era),
    cape = g.site === 'cape';
  const chans = Object.fromEntries(stageChannels().map(c => [c.id, c]));
  const root = new Container();
  const world = new Container();
  root.addChild(world);

  // ---- the backdrop: sky, the mountains far off, the desert ----
  const back = new Graphics();
  world.addChild(back);
  const sky = skyFor(g.clock % 1440).map(colorOf);
  const mix = (a, b, k) =>
    (Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k) << 16) |
    (Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k) << 8) |
    Math.round((a & 255) * (1 - k) + (b & 255) * k);
  for (let i = 0; i < 14; i++) {
    const k = i / 13,
      c = k < 0.5 ? mix(sky[0], sky[1], k * 2) : mix(sky[1], sky[2], (k - 0.5) * 2);
    back.rect(-800, -800 + i * ((SURFACE + 800) / 14), W + 1600, (SURFACE + 800) / 14 + 1).fill(c);
  }
  if (cape) back.rect(-800, SURFACE - 40, W + 1600, 40).fill(0x3f6f8f);
  else {
    back
      .poly([
        700,
        SURFACE,
        760,
        470,
        820,
        430,
        860,
        455,
        930,
        380,
        990,
        420,
        1040,
        395,
        1110,
        450,
        1180,
        410,
        1260,
        460,
        1340,
        420,
        1420,
        470,
        1500,
        440,
        1600,
        480,
        2400,
        470,
        2400,
        SURFACE,
      ])
      .fill(0x9b8fa3);
    back
      .poly([
        700,
        SURFACE,
        800,
        505,
        900,
        490,
        1000,
        515,
        1120,
        485,
        1250,
        512,
        1380,
        495,
        1500,
        520,
        1600,
        505,
        2400,
        510,
        2400,
        SURFACE,
      ])
      .fill(0xb5a28c);
  }
  back.rect(-800, SURFACE, W + 1600, H - SURFACE + 800).fill(cape ? 0x8c9a5c : 0xcdb489);
  for (let i = 0; i < 60; i++) {
    const x = 880 + ((i * 197) % 1500),
      y = SURFACE + 12 + ((i * 53) % (H - SURFACE - 20));
    back.ellipse(x, y, 10 + (i % 4) * 6, 2).fill({ color: cape ? 0x6f7c46 : 0xa88f66, alpha: 0.5 });
  }
  for (const [x, s] of [
    [1480, 1.3],
    [1560, 0.8],
    [1010, 0.7],
  ]) {
    back.ellipse(x, SURFACE + 4, 22 * s, 11 * s).fill(0x6f7a4a);
    back.ellipse(x + 8 * s, SURFACE, 14 * s, 9 * s).fill(0x7f8a55);
  }
  const windsock = new Graphics();
  world.addChild(windsock);
  const pole = new Graphics().rect(1530, 380, 4, SURFACE - 380).fill(0x7c7c7c);
  world.addChild(pole);

  // ---- the stand and the stage on it (the old canvas drawing, as a texture), the crew when they are out there ----
  const standPic = canvasPicture(PIC_W, PIC_H, ctx => {
    ctx.save();
    ctx.translate(PIC_W / 2 - site * PK, PIC_GROUND - GROUND * PK);
    ctx.scale(PK, PK);
    standStructure(ctx, PLACES.stand);
    if (g.rocket.where === 'stand') roundShape(ctx, g, site, GROUND - 40, 0, false);
    for (const p of Object.values(g.people))
      if (!p.hidden && Math.abs(p.x - site) < 120) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 4, GROUND - 26, 8, 15);
        ctx.fillStyle = '#3a3128';
        ctx.fillRect(p.x - 4, GROUND - 11, 3, 11);
        ctx.fillRect(p.x + 1, GROUND - 11, 3, 11);
        ctx.fillStyle = '#e2b993';
        ctx.beginPath();
        ctx.arc(p.x, GROUND - 30, 4, 0, 7);
        ctx.fill();
        if (p.hat) {
          ctx.fillStyle = p.hat;
          ctx.fillRect(p.x - 5, GROUND - 35, 10, 3);
        }
      }
    ctx.restore();
  });
  standPic.position.set(STAND_X - PIC_W / 2, SURFACE - PIC_GROUND);
  // The flame pit under the stand, and the deflector's run-out to the east.
  const pit = new Graphics();
  const PIT_FLOOR = SURFACE + 44,
    DEFLECT_SLOPE = 26 / 140; // the deflector's run-out falls 26 over 140
  pit.rect(STAND_X - 50, SURFACE - 2, 100, 46).fill(0x3a3631);
  pit
    .poly([
      STAND_X - 50,
      SURFACE + 44,
      STAND_X + 50,
      SURFACE + 44,
      STAND_X + 190,
      SURFACE + 70,
      STAND_X + 190,
      SURFACE + 88,
    ])
    .fill(0x5b544a);
  world.addChild(pit, standPic);
  // The cable from the stand back to the dugout.
  const cable = new Graphics()
    .moveTo(DUG.x + DUG.w + 30, SURFACE + 6)
    .lineTo(STAND_X - 70, SURFACE + 4)
    .stroke({ width: 4, color: 0x2a2a28 });
  world.addChild(cable);
  const [nx, ny] = toScene(site, GROUND - 40); // the nozzle
  const glow = new Sprite(puffTexture());
  glow.anchor.set(0.5);
  glow.tint = 0xffa040;
  glow.blendMode = 'add';
  glow.alpha = 0;
  glow.position.set(nx, ny + 40);
  const plume = new Graphics();
  plume.blendMode = 'add';
  const smoke = particles();
  world.addChild(glow, plume, smoke);

  // ---- the dugout, cut away: the earth mound and sandbags over a concrete room, the stairs up to the desert ----
  const dug = new Graphics();
  dug
    .poly([-800, 120, 0, 120, 160, 100, 420, 112, 700, 130, 900, 160, 1000, SURFACE, 1000, H + 800, -800, H + 800])
    .fill(0x9a7b52);
  for (let i = 0; i < 12; i++) dug.rect(-800, 150 + i * 60, 1700, 2).fill({ color: 0x7d6342, alpha: 0.5 });
  for (let i = 0; i < 12; i++)
    dug
      .roundRect(20 + i * 72, 104 - (i % 2) * 6 + (i > 8 ? (i - 8) * 8 : 0), 70, 22, 8)
      .fill(0xb79d6e)
      .stroke({ width: 2, color: 0x8a7350 });
  dug.rect(DUG.x - 18, DUG.y - 18, DUG.w + 36, DUG.h + 36).fill(0x6f6a5d);
  dug.rect(DUG.x, DUG.y, DUG.w, DUG.h).fill(0x4d4a41);
  dug.rect(DUG.x, DUG.y, DUG.w, 50).fill(0x45423a);
  for (let i = 1; i < 8; i++) dug.rect(DUG.x + i * 106, DUG.y, 2, DUG.h).fill({ color: 0x3e3b33, alpha: 0.6 });
  dug.rect(DUG.x, DUG.y + DUG.h - 12, DUG.w, 12).fill(0x37352f);
  // The doorway and the stairs up to the desert.
  const doorX = DUG.x + DUG.w;
  dug.rect(doorX, SURFACE, 18, DUG.y + DUG.h - SURFACE).fill(0x2c2a25);
  const steps = 8,
    rise = (DUG.y + DUG.h - SURFACE) / steps;
  for (let i = 0; i < steps; i++)
    dug
      .rect(doorX + 18 + i * 12, DUG.y + DUG.h - (i + 1) * rise, 110 - i * 12, rise + 1)
      .fill(i % 2 ? 0x77705f : 0x6d675a);
  // The periscope up through the roof.
  dug.rect(780, 80, 14, DUG.y - 70).fill(0x3f4a3a);
  dug.rect(766, 68, 42, 22).fill(0x323b2e);
  dug.rect(806, 72, 10, 14).fill(0x1d2420);
  world.addChild(dug);
  // A lamp hanging from the roof, and its light.
  const bulb = new Graphics();
  bulb.rect(455, DUG.y, 2, 34).fill(0x222222);
  bulb.circle(456, DUG.y + 40, 9).fill(0xfff2c0);
  const roomLight = new Sprite(puffTexture());
  roomLight.anchor.set(0.5);
  roomLight.position.set(456, DUG.y + 60);
  roomLight.scale.set(11);
  roomLight.tint = 0xffd88a;
  roomLight.alpha = 0.16;
  roomLight.blendMode = 'add';
  world.addChild(bulb, roomLight);

  // ---- the panel ----
  const panel = new Graphics();
  panel.roundRect(CON.x, CON.y, CON.w, CON.h, 6).fill(pal.panel).stroke({ width: 3, color: 0x2f382c });
  panel.rect(CON.x + 8, CON.y + 8, CON.w - 16, 24).fill(pal.face);
  panel.rect(CON.x - 8, CON.y + CON.h, CON.w + 16, 24).fill(pal.desk);
  panel.rect(CON.x + 6, CON.y + CON.h + 24, CON.w - 12, DUG.y + DUG.h - 12 - CON.y - CON.h - 24).fill(pal.deskFront);
  world.addChild(panel);
  const plate = label('', 15, pal.label, { bold: true, spacing: 1 });
  plate.position.set(CON.x + CON.w / 2, CON.y + 20);
  world.addChild(plate);

  // The count drum and the word under it.
  const drumBox = new Graphics()
    .roundRect(CON.x + 20, CON.y + 44, 240, 72, 4)
    .fill(0x120c0a)
    .stroke({ width: 3, color: 0x3a2a22 });
  const drum = label('—', 44, pal.count, { bold: true, family: pal.mono });
  drum.position.set(CON.x + 140, CON.y + 80);
  const word = label('', 15, pal.label, { bold: true, spacing: 2 });
  word.position.set(CON.x + 140, CON.y + 132);
  world.addChild(drumBox, drum, word);
  // The lamps.
  const LAMPS = [
    ['press', 'PRESSURISED', 0xf0b440],
    ['igniter', 'IGNITER', 0x7fdc8a],
    ['fire', 'FIRE', 0xff8a5a],
    ['hold', 'HOLD', 0xe0543c],
  ];
  const lamps = Object.fromEntries(
    LAMPS.map(([id, name, color], i) => {
      const l = lamp(name, color, 13, pal);
      l.position.set(CON.x + [62, 150, 212, 268][i], CON.y + 168);
      world.addChild(l);
      return [id, l];
    }),
  );

  // The pen recorder: the firing traced on paper, chamber in black, tank in red, chamber wall in amber.
  const REC = { x: CON.x + 330, y: CON.y + 46, w: 460, h: 140 };
  const recBox = new Graphics();
  recBox.rect(REC.x - 8, REC.y - 8, REC.w + 16, REC.h + 16).fill(0x2a2c2e);
  recBox.rect(REC.x, REC.y, REC.w, REC.h).fill(0xf6f1e2);
  const pcBand = kit()?.stand?.pc;
  const recY = v => REC.y + REC.h - (Math.max(0, Math.min(30, v)) / 30) * REC.h;
  for (let v = 5; v < 30; v += 5)
    recBox.rect(REC.x, recY(v), REC.w, 1).fill({ color: 0x9fb8a8, alpha: v % 10 ? 0.5 : 0.9 });
  if (pcBand)
    recBox
      .rect(REC.x, recY(pcBand[1]), REC.w, recY(pcBand[0]) - recY(pcBand[1]))
      .fill({ color: 0x7fbf6a, alpha: 0.18 });
  const ink = new Graphics();
  const pen = new Graphics();
  const recKey = label('', 13, pal.label, { bold: true });
  recKey.position.set(REC.x + REC.w / 2, REC.y + REC.h + 22);
  world.addChild(recBox, ink, pen, recKey);

  // The dials: each tank, the pressurant, the chamber, the thrust, and the pump or the chamber wall.
  const short = {
    'tank.ox': chans['lox.temp'] ? 'LOX' : /acid/i.test(chans['tank.ox'].label) ? 'Acid' : 'Ox',
    'tank.fuel': 'Fuel',
    bottle: chans.bottle.label.startsWith('Helium') ? 'Helium' : 'Gas gen',
    pc: 'Chamber',
    thrust: 'Thrust',
    rpm: 'Pump',
    wall: 'Wall',
  };
  const dialIds = ['tank.ox', 'tank.fuel', 'bottle', 'pc', 'thrust', 'rpm', 'wall'].filter(id => chans[id]);
  const step = (CON.w - 40) / dialIds.length;
  const dials = dialIds.map((id, i) => {
    const d = dial(chans[id], 40, pal, short[id]);
    d.position.set(CON.x + 20 + step * (i + 0.5), CON.y + 260);
    world.addChild(d);
    return [id, d];
  });
  // The bars: propellant loaded and left, the oxygen's temperature, the firing bus.
  const barIds = [
    ['loaded', 'Loaded'],
    ['left', 'Left'],
    ['lox.temp', 'LOX'],
    ['bus', 'Bus'],
  ].filter(([id]) => chans[id]);
  const bw = (CON.w - 40 - (barIds.length - 1) * 30) / barIds.length;
  const bars = barIds.map(([id, name], i) => {
    const b = bar(chans[id], bw, 12, pal, name);
    b.position.set(CON.x + 20 + i * (bw + 30), CON.y + 340);
    world.addChild(b);
    return [id, b];
  });

  // ---- the people at the panel, seen from behind, and what they say ----
  const SEATS = [210, 455, 700];
  const chairs = SEATS.map(x => {
    const c = seatedBack(null);
    c.position.set(x, CON.y + CON.h + 90);
    world.addChild(c);
    return c;
  });
  const talk = SEATS.map(() => {
    const b = speech(300);
    world.addChild(b);
    return b;
  });

  // Dust shaken off the roof at ignition, over everything in the room.
  const dust = particles();
  world.addChild(dust);

  const out = outButton(leave);
  root.addChild(out);

  // ---- each frame ----
  let base = { x: 0, y: 0 },
    wasFiring = false;
  function update(dt, screen, reserve) {
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const k = Math.min(roomW / W, screen.height / H);
    world.scale.set(k);
    base = { x: (roomW - W * k) / 2, y: (screen.height - H * k) / 2 };
    out.position.set(10, screen.height - 40 - 46);
    const t = g.time,
      s = g.stand,
      phase = s ? s.phase : null;
    const read = s && g.round ? standChannels() : null;
    const v = id => (read && id in read ? read[id] : null);
    const firing = phase === 'firing';
    const pc = v('pc') ?? 0;
    const nominal = pcBand ? (pcBand[0] + pcBand[1]) / 2 : 20;
    const power = firing ? Math.max(0, pc / nominal) : 0;

    // She shakes the dugout a little while she fires, by how hard she burns.
    const shake = power * 2.4;
    world.position.set(base.x + (Math.random() - 0.5) * shake * k, base.y + (Math.random() - 0.5) * shake * k);

    setText(
      plate,
      `STATIC TEST STAND  ·  ${!s ? 'NO FIRING' : s.burn === 'long' ? 'FULL DURATION · 30 s' : 'START-UP FIRING · 8 s'}`,
    );
    setText(
      drum,
      !s
        ? '—'
        : phase === 'count'
          ? `T-${Math.ceil(s.clock)}`
          : firing
            ? 'FIRE'
            : phase === 'read' || phase === 'decided'
              ? 'CUTOFF'
              : phase === 'held'
                ? 'HOLD'
                : phase === 'leakcheck'
                  ? 'CREW'
                  : phase === 'ready'
                    ? 'READY'
                    : 'SAFE',
    );
    setText(
      word,
      !s
        ? ''
        : {
            ready: 'STAGE PRESSURISED',
            count: 'FIRING COUNT',
            held: 'COUNT HELD',
            leakcheck: 'CREW ON THE STAND',
            firing: 'FIRING',
            read: 'SHUT DOWN',
            decided: 'SHUT DOWN',
          }[phase] || '',
    );
    lamps.press.update(!!s && ['ready', 'held', 'count', 'leakcheck', 'firing'].includes(phase));
    lamps.igniter.update(!!read && !!read.igniter && ['ready', 'held', 'count', 'firing'].includes(phase));
    lamps.fire.update(firing);
    lamps.hold.update(phase === 'held' && Math.sin(t * 6) > -0.3);
    for (const [id, d] of dials) d.update(v(id), dt);
    for (const [id, b] of bars) b.update(v(id));

    // The recorder: ink as far as the firing has gone, the pens resting at the latest point.
    const trace = s && s.trace,
      shown = trace ? Math.max(0, Math.floor(s.shown)) : 0,
      span = trace ? trace[trace.length - 1].t : s && s.burn === 'long' ? 30 : 8;
    const X = tt => REC.x + 4 + (tt / span) * (REC.w - 8);
    const wallOn = !!(trace && trace[0] && trace[0].wall != null);
    const wallY = kelvin => recY(kelvin * 0.03);
    ink.clear();
    if (trace && shown > 1) {
      const pts = trace.slice(0, shown);
      for (const [key, color, map] of [
        ['tank', 0xb0281c, recY],
        ['pc', 0x1d1b17, recY],
        ...(wallOn ? [['wall', 0xc98a1c, wallY]] : []),
      ]) {
        ink.moveTo(X(pts[0].t), map(pts[0][key]));
        for (const p of pts) ink.lineTo(X(p.t), map(p[key]));
        ink.stroke({ width: 1.8, color });
      }
      if (wallOn && kit().stand.wall) {
        const y = wallY(kit().stand.wall[1]);
        for (let x = REC.x; x < REC.x + REC.w; x += 10) ink.moveTo(x, y).lineTo(x + 5, y);
        ink.stroke({ width: 1.4, color: 0xc98a1c });
      }
    }
    pen.clear();
    const last = trace && shown > 0 ? trace[shown - 1] : null;
    const penX = last ? X(last.t) : REC.x + 4;
    pen.rect(penX - 1, REC.y - 4, 2, REC.h + 8).fill(0x55534a);
    const tank = last ? last.tank : v('tank.ox');
    if (tank != null) pen.circle(penX, recY(tank), 3.5).fill(0xb0281c);
    pen.circle(penX, recY(last ? last.pc : 0), 3.5).fill(0x1d1b17);
    setText(recKey, `RECORDER · CHAMBER black · TANK red${wallOn ? ' · WALL amber, limit dashed' : ''}`);

    // The flame: its length and brightness follow the chamber pressure, so a rough start shows as a stuttering flame.
    plume.clear();
    if (power > 0.02) {
      // The flame runs down into the pit and no further: at the pit floor it turns along the deflector, east.
      const floor = PIT_FLOOR - 4,
        len = Math.min(50 + 110 * power, floor - ny),
        wob = Math.sin(t * 50) * 3,
        down = ny + len;
      plume
        .poly([nx - 14, ny, nx + 14, ny, nx + 7 + wob, down, nx - 7 + wob, down])
        .fill({ color: 0xffd27a, alpha: 0.9 });
      plume.poly([nx - 7, ny, nx + 7, ny, nx + wob / 2, ny + len * 0.7]).fill({ color: 0xfff6d8, alpha: 0.95 });
      for (let i = 0; i < 3; i++) plume.circle(nx, ny + 12 + i * 14, 4 - i).fill({ color: 0xffffff, alpha: 0.6 });
      if (down >= floor - 1) {
        const reach = 40 + 70 * power + wob;
        plume
          .poly([nx - 12, floor - 14, nx + reach * 0.6, floor - 12, nx + reach, floor + 6, nx - 10, floor + 2])
          .fill({ color: 0xffc060, alpha: 0.75 });
      }
      // Exhaust out of the pit along the deflector, then rising: smoke billowing east from the flame's foot.
      if (Math.random() < 0.9 * power) {
        const along = Math.random() * 60;
        smoke.add(nx + 20 + along, PIT_FLOOR - 6 + along * DEFLECT_SLOPE, {
          tint: 0xa79d8c,
          alpha: 0.7,
          size: 0.5,
          vx: 70 + Math.random() * 60,
          vy: -25 - Math.random() * 35,
          grow: 1.1,
          fade: 0.2,
          life: 3.5,
        });
      }
      if (Math.random() < 0.6 * power)
        smoke.add(nx + 10 + Math.random() * 30, PIT_FLOOR - 10, {
          tint: 0xff9a40,
          alpha: 0.5,
          size: 0.4,
          vx: 70,
          vy: -20,
          grow: 0.8,
          fade: 0.8,
          life: 0.7,
          add: true,
        });
    }
    glow.alpha = power * 0.9;
    glow.scale.set(5 + power * 3);
    roomLight.alpha = 0.16 + power * 0.05 + Math.sin(t * 2.1) * 0.01;
    if (firing && !wasFiring)
      for (let i = 0; i < 30; i++)
        dust.add(DUG.x + 20 + Math.random() * (DUG.w - 40), DUG.y + 6, {
          tint: 0xb9a582,
          alpha: 0.6,
          size: 0.1,
          vy: 40 + Math.random() * 60,
          grow: 0.03,
          fade: 0.25,
          life: 2.5,
        });
    wasFiring = firing;
    smoke.update(dt);
    dust.update(dt);

    const flap = Math.sin(t * 3) * 4;
    windsock
      .clear()
      .poly([1534, 382, 1590, 388 + flap, 1590, 402 + flap, 1534, 404])
      .fill(0xe2702c)
      .rect(1554, 384 + flap / 2, 6, 19)
      .fill(0xf3efe6);
    standPic.update();

    // Who is at the panel: you in the middle, the others either side.
    const here = inside(g).sort((a, b) => (a.id === 'you' ? -1 : b.id === 'you' ? 1 : 0));
    const order = [here[1], here[0], here[2]];
    chairs.forEach((c, i) => {
      const p = order[i];
      c.update(p || null, t);
      talk[i].position.set(c.x, CON.y - 6);
      talk[i].update(p ? p.bubble : null);
    });
  }

  const key = `${era}|${g.site}|${g.vehicle}`;
  const stale = () => `${uiEra(g)}|${g.site}|${g.vehicle}` !== key;
  return { root, update, stale };
}
