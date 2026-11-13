// THE BLOCKHOUSE, rebuilt in PixiJS (v0.8): the count, seen from behind the firing panel. Every reading the
// blockhouse had is on the wall or the desk: the count drum, the status lamps, the pressurisation panel's dials (each
// tank, the pressurant, propellant loaded, oxygen temperature), the firing panel (continuity, arming, the firing bus),
// the range scope, and pen recorders tracing the tanks. The room panel keeps only the call.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics } from '../vendor/pixi.min.mjs';
import { g as game, countChannels, stageChannels, conducting } from '../game.js';
import { padPicture, uiEra } from '../site/draw.js';
import { blockhouseState } from '../data/campaign.js';
import { inside as insideOf } from '../site/interiors.js';
import {
  paletteFor,
  label,
  setText,
  dial,
  lamp,
  bar,
  recorder,
  seatedBack,
  speech,
  canvasPicture,
  colorOf,
  outButton,
} from './kit.js';

export const W = 1600,
  H = 900,
  FLOOR = 640;
const STATIONS = [
  { id: 'range', label: 'RANGE' },
  { id: 'press', label: 'PRESS' },
  { id: 'tc', label: 'TEST CONDUCTOR' },
  { id: 'pad', label: 'PAD · FIRING' },
];
const ST_W = 350,
  ST_GAP = 22,
  X0 = (W - (4 * ST_W + 3 * ST_GAP)) / 2,
  DESK_Y = 360;

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

  // ---- the room: concrete wall with formwork marks, the roof beam, the lights, the floor ----
  const room = new Graphics();
  room.rect(-800, -800, W + 1600, FLOOR + 800).fill(built ? pal.wall : pal.wallOld);
  for (let y = 40; y < FLOOR; y += 46) {
    room.rect(-800, y, W + 1600, 2).fill({ color: 0x000000, alpha: 0.07 });
    room.rect(-800, y + 2, W + 1600, 1).fill({ color: 0xd9cfb5, alpha: 0.12 });
  }
  room.rect(-800, FLOOR, W + 1600, H - FLOOR + 800).fill(pal.floor);
  room.rect(-800, FLOOR, W + 1600, 8).fill({ color: 0x000000, alpha: 0.25 });
  room.rect(-800, -800, W + 1600, 838).fill(pal.beam);
  world.addChild(room);
  const light = new Graphics();
  if (built)
    for (const lx of [300, 800, 1300]) {
      light.rect(lx - 90, 38, 180, 9).fill(0xf4f0dc);
      light.poly([lx - 90, 47, lx - 260, FLOOR, lx + 260, FLOOR, lx + 90, 47]).fill({ color: 0xf4f0dc, alpha: 0.05 });
    }
  else {
    light.moveTo(470, 38).lineTo(470, 76).stroke({ width: 2, color: 0x222222 });
    light.circle(470, 84, 10).fill(0xffe9a8);
    light.circle(470, 84, 320).fill({ color: 0xf9da9e, alpha: 0.08 });
  }
  world.addChild(light);

  // ---- the periscopes: the pad, round, in a brass ring (the old canvas painting, as a texture for now) ----
  const scopes = built
    ? [
        [190, 200, 'PERISCOPE 1'],
        [450, 200, 'PERISCOPE 2'],
      ]
    : [[230, 200, 'PERISCOPE']];
  const R = built ? 118 : 128;
  const pictures = scopes.map(([cx, cy, name], i) => {
    const tube = new Graphics();
    tube.rect(cx + R + 6, 38, 20, cy - 18).fill(0x5b5f66);
    tube.rect(cx + R - 8, cy + 6, 50, 28).fill(0x5b5f66);
    tube.circle(cx + 5, cy + 8, R + 16).fill(0x34352f);
    tube.circle(cx, cy, R + 10).fill(0xb08a4a);
    world.addChild(tube);
    const pic = canvasPicture(256, 256, (ctx, w, h) => {
      padPicture(ctx, game, 0, 0, w, h);
      if (i === 1) {
        ctx.fillStyle = 'rgba(30,60,40,.18)';
        ctx.fillRect(0, 0, w, h);
      }
    });
    pic.position.set(cx - R, cy - R);
    pic.width = pic.height = 2 * R;
    const mask = new Graphics().circle(cx, cy, R).fill(0xffffff);
    pic.mask = mask;
    world.addChild(pic, mask);
    const cross = new Graphics();
    cross
      .moveTo(cx - R, cy)
      .lineTo(cx + R, cy)
      .moveTo(cx, cy - R)
      .lineTo(cx, cy + R)
      .stroke({ width: 1, color: 0x000000, alpha: 0.35 });
    cross.arc(cx, cy, R + 5, Math.PI * 1.05, Math.PI * 1.58).stroke({ width: 2, color: 0xffe6af, alpha: 0.5 });
    world.addChild(cross);
    const t = label(name, 16, pal.label, { family: 'Georgia, serif' });
    t.position.set(cx, cy + R + 26);
    world.addChild(t);
    return pic;
  });

  // ---- the count drum and the status lamps, over the conductor's end of the panel ----
  const clockX = built ? 700 : 640;
  const board = new Graphics();
  board.roundRect(clockX, 80, 340, 150, 6).fill(0x2c2e30).stroke({ width: 3, color: 0x1b1c1e });
  board
    .roundRect(clockX + 20, 112, 300, 76, 4)
    .fill(0x120c0a)
    .stroke({ width: 2, color: 0x3a2a22 });
  world.addChild(board);
  const boardTitle = label(
    cape ? 'BLOCKHOUSE · CAPE CANAVERAL' : built ? 'LAUNCH CONTROL · NEW BLOCKHOUSE' : 'W.S.P.G. BLOCKHOUSE',
    15,
    pal.label,
    { bold: true, spacing: 1 },
  );
  boardTitle.position.set(clockX + 170, 97);
  const drum = label('T- --:--', 50, pal.count, { bold: true, family: pal.mono });
  drum.position.set(clockX + 170, 151);
  const word = label('NO COUNT', 17, pal.label, { bold: true, spacing: 2 });
  word.position.set(clockX + 170, 210);
  world.addChild(boardTitle, drum, word);

  const lampX = clockX + 380;
  const lampBoard = new Graphics().roundRect(lampX, 80, W - 40 - lampX, 150, 6).fill(0x2c2e30);
  world.addChild(lampBoard);
  const LAMPS = [
    ['hold', 'HOLD', 0xe0543c],
    ['poll', 'POLL', 0xf0b440],
    ['igniter', 'IGNITER', 0x7fdc8a],
    ['fire', 'FIRE', 0xff8a5a],
  ];
  const lamps = Object.fromEntries(
    LAMPS.map(([id, name, color], i) => {
      const l = lamp(name, color, 20, pal);
      l.position.set(lampX + 50 + i * ((W - 40 - lampX - 60) / 4), 140);
      world.addChild(l);
      return [id, l];
    }),
  );

  // ---- the pen recorders, tracing the tanks and the pressurant (and the oxygen's temperature where there is one) ----
  const traced = ['tank.ox', 'tank.fuel', 'bottle', chans['lox.temp'] ? 'lox.temp' : 'bus'].map(id => chans[id]);
  const pens = recorder(W - 40 - clockX, 52, traced, pal);
  pens.position.set(clockX, 258);
  world.addChild(pens);

  // ---- the firing panel: one long desk, a station each ----
  const desk = new Graphics();
  desk.rect(X0 - 24, DESK_Y, 4 * ST_W + 3 * ST_GAP + 48, 190).fill(pal.panel);
  desk.rect(X0 - 24, DESK_Y, 4 * ST_W + 3 * ST_GAP + 48, 8).fill(pal.panelTop);
  desk.rect(X0 - 34, DESK_Y + 190, 4 * ST_W + 3 * ST_GAP + 68, 20).fill(pal.desk);
  desk.rect(X0 - 28, DESK_Y + 210, 4 * ST_W + 3 * ST_GAP + 56, FLOOR - DESK_Y - 210).fill(pal.deskFront);
  world.addChild(desk);
  const S = {}; // the instruments, by station
  const seatOf = seats();
  STATIONS.forEach((st, i) => {
    const x = X0 + i * (ST_W + ST_GAP);
    const face = new Graphics().rect(x, DESK_Y + 18, ST_W, 166).fill(pal.face);
    const mine = seatOf[st.id] === 'you';
    if (mine) face.rect(x - 3, DESK_Y + 15, ST_W + 6, 172).stroke({ width: 3, color: 0xe8c66a });
    world.addChild(face);
    const t = label(st.label + (mine ? ' · YOU' : ''), 16, mine ? 0xe8c66a : pal.label, { bold: true });
    t.position.set(x + ST_W / 2, DESK_Y + 33);
    world.addChild(t);
    S[st.id] = { x, y: DESK_Y + 48 };
  });
  // RANGE: the plot scope and its sweep, the range-clear lamp.
  {
    const { x, y } = S.range;
    const scope = new Graphics();
    scope.circle(x + 80, y + 62, 56).fill(0x0d1a14);
    scope.circle(x + 80, y + 62, 28).stroke({ width: 1, color: 0x1f3b2d });
    const sweep = new Graphics();
    sweep.position.set(x + 80, y + 62);
    sweep.moveTo(0, 0).lineTo(56, 0).stroke({ width: 2, color: 0x9ff0b8 });
    const clear = lamp('RANGE CLEAR', 0x7fdc8a, 15, pal);
    clear.position.set(x + 250, y + 50);
    world.addChild(scope, sweep, clear);
    S.range.sweep = sweep;
    S.range.clear = clear;
  }
  // PRESS: a dial for each tank and the pressurant, propellant loaded, the oxygen's temperature.
  {
    const { x, y } = S.press;
    const shortName = {
      'tank.ox': chans['lox.temp'] ? 'LOX' : 'Acid',
      'tank.fuel': 'Fuel',
      bottle: chans.bottle.label.startsWith('Helium') ? 'Helium' : 'Gas gen',
    };
    const dials = ['tank.ox', 'tank.fuel', 'bottle'].map((id, i) => {
      const d = dial(chans[id], 40, pal, shortName[id]);
      d.position.set(x + 60 + i * 115, y + 34);
      world.addChild(d);
      return [id, d];
    });
    const loaded = bar(chans.loaded, chans['lox.temp'] ? 170 : 310, 12, pal, 'Loaded');
    loaded.position.set(x + 20, y + 100);
    world.addChild(loaded);
    S.press.dials = dials;
    S.press.loaded = loaded;
    if (chans['lox.temp']) {
      const lox = bar(chans['lox.temp'], 120, 12, pal, 'LOX');
      lox.position.set(x + 210, y + 100);
      world.addChild(lox);
      S.press.lox = lox;
    }
  }
  // TEST CONDUCTOR: the seconds counter, the hold button, the intercom keys.
  {
    const { x, y } = S.tc;
    const box = new Graphics()
      .rect(x + 20, y + 6, 170, 52)
      .fill(0x120c0a)
      .stroke({ width: 2, color: 0x3a2a22 });
    const secs = label('---', 30, pal.count, { bold: true, family: pal.mono });
    secs.position.set(x + 105, y + 33);
    const hold = new Graphics();
    hold.circle(x + 270, y + 38, 30).fill(0x7a1f16);
    hold.circle(x + 270, y + 35, 25).fill(0xd0634f);
    const holdT = label('HOLD', 14, 0xffffff, { bold: true });
    holdT.position.set(x + 270, y + 36);
    const keys = new Graphics();
    for (let k = 0; k < 5; k++) keys.roundRect(x + 22 + k * 34, y + 80, 26, 20, 3).fill(0x26292c);
    const keysT = label('INTERCOM', 13, pal.label, { bold: true });
    keysT.position.set(x + 105, y + 116);
    world.addChild(box, secs, hold, holdT, keys, keysT);
    S.tc.secs = secs;
  }
  // PAD · FIRING: continuity, arming, the firing bus, the firing key in its guard.
  {
    const { x, y } = S.pad;
    const cont = lamp('CONTINUITY', 0x7fdc8a, 14, pal);
    cont.position.set(x + 55, y + 18);
    const armed = lamp('ARMED', 0xf0b440, 14, pal);
    armed.position.set(x + 55, y + 78);
    const bus = dial(chans.bus, 30, pal, 'Bus');
    bus.position.set(x + 160, y + 58);
    const guard = new Graphics();
    guard.rect(x + 232, y + 6, 92, 92).fill(0x1b1c1e);
    guard.rect(x + 242, y + 16, 72, 72).fill(0xcc9944);
    guard.circle(x + 278, y + 52, 16).fill(0x2a2a2a);
    const key = new Graphics().rect(-4, -20, 8, 20).fill(0xdddddd);
    key.position.set(x + 278, y + 52);
    const keyT = label('FIRE', 14, pal.label, { bold: true });
    keyT.position.set(x + 278, y + 112);
    world.addChild(cont, armed, bus, guard, key, keyT);
    Object.assign(S.pad, { cont, armed, bus, key });
  }

  // ---- the people: a controller at each station, seen from behind; anyone else stands at the back ----
  const chairs = STATIONS.map((st, i) => {
    const c = seatedBack(null);
    c.position.set(X0 + i * (ST_W + ST_GAP) + ST_W / 2, DESK_Y + 300);
    world.addChild(c);
    return c;
  });
  const standers = new Graphics();
  world.addChild(standers);
  const talk = STATIONS.map(() => {
    const b = speech();
    world.addChild(b);
    return b;
  });
  const extraTalk = [speech(), speech()];
  world.addChild(...extraTalk);

  // ---- the way out ----
  const out = outButton(leave);
  root.addChild(out);

  // ---- each frame ----
  let lastPush = -1;
  function update(dt, screen, reserve) {
    // Fit the room into the screen left of the room panel, as the canvas interiors did.
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const k = Math.min(roomW / W, screen.height / H);
    world.scale.set(k);
    world.position.set((roomW - W * k) / 2, (screen.height - H * k) / 2);
    out.position.set(10, screen.height - 40 - 46);

    const c = g.count,
      t = g.time;
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
    lamps.hold.update(!!c && (c.held || c.checking));
    lamps.poll.update(!!c && !!c.poll);
    lamps.igniter.update(!!read && read.igniter);
    lamps.fire.update(!!c && c.clock <= 10 && !c.held && !c.poll);
    // A point on the recorders each count second; the paper stands still when the count does.
    const sec = c ? Math.floor(c.since ?? 0) : -1;
    pens.update(
      traced.map(ch => v(ch.id)),
      c && sec !== lastPush,
    );
    lastPush = sec;

    S.range.sweep.rotation = c ? t * 2 : 0;
    S.range.clear.update(!!c);
    for (const [id, d] of S.press.dials) d.update(v(id), dt);
    S.press.loaded.update(v('loaded'));
    S.press.lox?.update(v('lox.temp'));
    setText(S.tc.secs, c ? `${Math.ceil(c.clock)} s` : '---');
    S.pad.cont.update(!!read && read.igniter);
    S.pad.armed.update(!!c && c.clock <= 60);
    S.pad.bus.update(v('bus'), dt);
    S.pad.key.rotation = c && c.clock <= 1 ? 0.8 : 0;

    for (const p of pictures) p.update();

    // Who sits where, who stands at the back, and what they are saying.
    const seat = seats();
    const here = new Set(inside(g).map(p => p.id));
    if (c) here.add('you');
    const away = id => g.jobs.some(j => (j.who || []).includes(id));
    STATIONS.forEach((st, i) => {
      const who = g.people[seat[st.id]];
      const present = who && !who.hidden && (c ? !away(who.id) : here.has(who.id));
      chairs[i].update(present ? who : null, t);
      talk[i].position.set(chairs[i].x, DESK_Y - 4);
      talk[i].update(present ? who.bubble : null);
    });
    standers.clear();
    const extra = [...here].map(id => g.people[id]).filter(p => p && !Object.values(seat).includes(p.id));
    extra.slice(0, 2).forEach((p, i) => {
      const x = i ? W - 90 : 90,
        y = FLOOR + 160;
      standers.rect(x - 22, y - 120, 44, 70).fill(colorOf(p.color));
      standers.circle(x, y - 140, 18).fill(0xe2b993);
      if (p.hat) standers.rect(x - 22, y - 162, 44, 10).fill(colorOf(p.hat));
      standers.rect(x - 18, y - 50, 14, 50).fill(0x2b2620);
      standers.rect(x + 4, y - 50, 14, 50).fill(0x2b2620);
      extraTalk[i].position.set(x, y - 166);
      extraTalk[i].update(p.bubble);
    });
    for (let i = extra.length; i < 2; i++) extraTalk[i].update(null);
  }

  // Rebuild when the blockhouse itself changes (the new one is built, the move to the Cape, a new era).
  const key = `${cape}|${built}|${era}|${conducting()}`;
  const stale = () => {
    const nowBuilt = g.site === 'cape' || blockhouseState(g.day).built;
    return `${g.site === 'cape'}|${nowBuilt}|${uiEra(g)}|${conducting()}` !== key;
  };
  return { root, update, stale };
}
