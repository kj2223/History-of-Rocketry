// THE ASSEMBLY HANGAR, rebuilt in PixiJS (v0.8): the inspection. The round lies on its cradles under the quonset's
// lamps; each spot on the list is pinned where it is on the hardware, with its card above or below. Look at a spot and
// what you found is drawn on the metal at that point: a damp stain and drips at a leak, a crack along a weld, a scorch
// ring elsewhere; a chalk tick where it was sound. Flagged spots are ringed in red. The room panel keeps the decision.
// In the crewed years the same scene is Hangar S: white walls and the maker's banner, Mercury's or Gemini's spacecraft
// big on its checkout stand with the spots down either side, or the Saturn's stages on their cradles for Apollo.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Rectangle } from '../vendor/pixi.min.mjs';
import { g as game, kit, dateText, placeName } from '../game.js';
import { capsuleSpots, programOf } from '../mercury.js';
import { roundShape, uiEra, PLACES } from '../site/draw.js';
import { SHAPE, spotAt, spread } from '../site/interiors.js';
import { inspectFlags } from '../scenes/rooms.js';
import { atPlace } from '../data/white-sands.js';
import { KITS } from '../data/kits.js';
import { label, speech, canvasPicture, outButton, standingFigure } from './kit.js';

export const W = 1600,
  H = 900;
const FLOOR = 760,
  CY = 380, // the round's centre line
  MID = 800,
  TAG_W = 310,
  TAG_GAP = 12;

const inside = g =>
  Object.values(g.people).filter(
    p =>
      !p.hidden &&
      (Math.abs(p.x - PLACES.hangar.door) < (PLACES.hangar.w ?? 120) / 2 + 60 || atPlace('hangar', g, p.x)),
  );

// What the inspector sees at a spot once it has been looked at, by the kind of fault the spot is listed for.
const MARK = { leak: 'leak', lox: 'leak', oring: 'leak', fitting: 'leak', weld: 'crack', tank: 'crack' };

export function hangarScene({ leave, look, engLook }) {
  const g = game;
  const crewed = !!g.crewed,
    capsule = crewed && programOf() !== 'apollo';
  const era = uiEra(g);
  const spots = KITS[g.vehicle]?.spots || {};
  const mated = !!g.rocket.mated,
    here = crewed || g.rocket.where === 'hangar';
  const [len0, half] = SHAPE[g.vehicle] || [100, 10];
  const len =
    (g.vehicle === 'wac' || g.vehicle === 'aerobee') && mated ? 86 : g.vehicle === 'bumper' && mated ? 160 : len0;
  const k = Math.min(1150 / len, 95 / half),
    tailX = MID + (len * k) / 2,
    bodyR = half * k;
  const root = new Container();
  const world = new Container();
  root.addChild(world);

  // ---- Hangar S: white walls, a clean floor, the fluorescent fittings and the maker's banner ----
  const roomS = new Graphics();
  roomS.rect(-800, -800, W + 1600, FLOOR + 800).fill(0xd9d7d0);
  roomS.rect(-800, -800, W + 1600, 880).fill(0xe8e6df);
  roomS.rect(-800, 330, W + 1600, 6).fill({ color: 0x526669, alpha: 0.15 });
  roomS.rect(-800, 342, W + 1600, 20).fill({ color: 0x526669, alpha: 0.15 });
  roomS.rect(-800, FLOOR, W + 1600, H - FLOOR + 800).fill(0xc9c6bc);
  roomS.rect(-800, FLOOR, W + 1600, 8).fill({ color: 0x000000, alpha: 0.12 });
  for (let i = -6; i <= 14; i++) roomS.moveTo(MID + (i - 4) * 120, FLOOR).lineTo(MID + (i - 4) * 260, H + 200);
  roomS.stroke({ width: 1, color: 0x000000, alpha: 0.06 });
  for (const lx of [270, 800, 1330]) {
    roomS
      .poly([lx - 110, 92, lx + 110, 92, lx + 360, FLOOR + 40, lx - 360, FLOOR + 40])
      .fill({ color: 0xffffed, alpha: 0.18 });
    roomS.rect(lx - 116, 70, 232, 18).fill(0x787e7b);
    roomS.rect(lx - 112, 75, 224, 12).fill(0xfbfaf4);
  }
  // A test cabinet against the wall at the left, its drawers ruled.
  roomS.rect(110, FLOOR - 150, 170, 140).fill(0x9da3a0);
  roomS.rect(106, FLOOR - 158, 178, 11).fill(0x5d6c70);
  for (const y of [FLOOR - 125, FLOOR - 98, FLOOR - 71]) roomS.rect(120, y, 150, 2).fill(0xbec5c1);
  roomS
    .rect(122, FLOOR - 12, 14, 12)
    .fill(0x5d6c70)
    .rect(254, FLOOR - 12, 14, 12)
    .fill(0x5d6c70);
  const banner = label(placeName('hangar').toUpperCase(), 25, 0xffffff, { family: 'Arial, sans-serif', bold: true });
  const bannerW = Math.min(950, Math.max(550, banner.width + 60));
  roomS.rect(MID - bannerW / 2, 120, bannerW, 56).fill(0x2b3f6b);
  banner.position.set(MID, 148);
  if (crewed) world.addChild(roomS, banner);
  else {
    roomS.destroy();
    banner.destroy();
  }
  if (!crewed) {
    // ---- the quonset: the arched roof and its ribs, the lamps, the concrete floor ----
    const room = new Graphics();
    room.rect(-800, -800, W + 1600, FLOOR + 800).fill(0x3d3f43);
    room.rect(-800, FLOOR, W + 1600, H - FLOOR + 800).fill(0x6b6a66);
    room.rect(-800, FLOOR, W + 1600, 10).fill({ color: 0x000000, alpha: 0.28 });
    for (let i = -6; i <= 14; i++) room.moveTo(MID + (i - 4) * 120, FLOOR).lineTo(MID + (i - 4) * 260, H + 200);
    room.stroke({ width: 1, color: 0x000000, alpha: 0.15 });
    room
      .moveTo(-800, -800)
      .lineTo(W + 800, -800)
      .lineTo(W + 800, 150)
      .quadraticCurveTo(MID, -80, -800, 150)
      .fill(0x2f3134);
    for (let x = -160; x <= W + 160; x += 200) {
      const top = 130 - 50 * Math.cos((x - MID) / 2000);
      room.rect(x - 4, top, 8, FLOOR - top).fill(0x55585d);
      room.rect(x - 6, top, 2, FLOOR - top).fill(0x83868b);
    }
    world.addChild(room);
    const lights = new Graphics();
    for (const lx of [400, 800, 1200]) {
      lights.moveTo(lx, 0).lineTo(lx, 100).stroke({ width: 2, color: 0x222222 });
      lights.poly([lx - 32, 120, lx - 15, 100, lx + 15, 100, lx + 32, 120]).fill(0xf3dd8a);
      lights
        .poly([lx - 32, 120, lx - 280, FLOOR + 70, lx + 280, FLOOR + 70, lx + 32, 120])
        .fill({ color: 0xf3dd8a, alpha: 0.06 });
    }
    world.addChild(lights);
    // The bench at the left wall, the tool board over it, and the chalkboard with the round's name.
    const shop = new Graphics();
    shop.rect(30, FLOOR - 150, 220, 14).fill(0x6a5a44);
    shop.rect(40, FLOOR - 136, 10, 136).fill(0x6a5a44);
    shop.rect(230, FLOOR - 136, 10, 136).fill(0x6a5a44);
    shop.rect(60, FLOOR - 162, 80, 12).fill(0xb9a783);
    shop.rect(170, FLOOR - 178, 60, 28).fill(0x585d50);
    shop.rect(40, FLOOR - 290, 200, 110).fill(0x4a4034);
    for (let i = 0; i < 4; i++)
      shop
        .moveTo(70 + i * 44, FLOOR - 272)
        .lineTo(70 + i * 44 + (i % 2 ? 8 : -6), FLOOR - 200)
        .stroke({ width: 3, color: 0xb8b2a6 });
    shop
      .rect(30, FLOOR - 400, 240, 80)
      .fill(0x2d3b33)
      .stroke({ width: 4, color: 0x6a5a44 });
    world.addChild(shop);
    const board = label(kit().name, 22, 0xe8e4d6, { family: 'Georgia, serif' });
    board.position.set(150, FLOOR - 374);
    const boardDate = label(dateText(), 15, 0xe8e4d6, { family: 'Georgia, serif' });
    boardDate.position.set(150, FLOOR - 342);
    world.addChild(board, boardDate);
  }

  // ---- the hardware: the round on its cradles (the old canvas drawing of the round, as a texture), or Mercury's or
  // Gemini's spacecraft standing big on its checkout stand ----
  const gemini = g.vehicle === 'titan',
    CXC = MID,
    KC = gemini ? 14 : 16,
    BASE = FLOOR - 130 - (gemini ? 8 * KC : 0),
    TALL = gemini ? 21 : 20; // her height, in her own units
  // The spacecraft's half-width at a height up her side, in her own units (the heat shield at 0).
  const capsuleHalf = y => (gemini ? (y <= 16 ? 11 - y * (6.5 / 16) : 3.2) : y <= 14 ? 9 - y * (5 / 14) : 3);
  if (capsule) {
    const stand = new Graphics();
    stand.rect(CXC - 210, BASE + (gemini ? 8 * KC : 0), 420, 22).fill(0x8a8f96);
    const deck = BASE + (gemini ? 8 * KC : 0) + 22;
    for (const x of [CXC - 190, CXC + 170]) stand.rect(x, deck, 20, FLOOR - deck).fill(0x7a7f86);
    // The work platforms either side, their rails and legs.
    for (const px of [CXC - 330, CXC + 330]) {
      stand.rect(px - 64, 400, 128, 6).fill(0xb8bcc2);
      stand
        .rect(px - 60, 340, 4, 60)
        .fill(0xb8bcc2)
        .rect(px + 56, 340, 4, 60)
        .fill(0xb8bcc2);
      stand.rect(px - 64, 340, 128, 4).fill(0xb8bcc2);
      stand
        .rect(px - 60, 406, 6, FLOOR - 406)
        .fill(0xa3a7ad)
        .rect(px + 54, 406, 6, FLOOR - 406)
        .fill(0xa3a7ad);
    }
    stand.ellipse(CXC, FLOOR + 8, 240, 14).fill({ color: 0x000000, alpha: 0.12 });
    const craft = new Graphics();
    const u = (x, y) => [CXC + x * KC, BASE - y * KC];
    const top = gemini ? 16 : 14,
      neck = gemini ? 21 : 20,
      foot = capsuleHalf(0),
      shoulder = capsuleHalf(top);
    if (gemini)
      craft
        .poly([...u(-foot, 0), ...u(foot, 0), ...u(15, -8), ...u(-15, -8)])
        .fill(0xdedcd4)
        .stroke({ width: 2, color: 0x9a9890 }); // the adapter
    craft.poly([...u(-foot, 0), ...u(foot, 0), ...u(shoulder, top), ...u(-shoulder, top)]).fill(0x1d1f22);
    // The shingles, catching the light.
    for (let y = 1.2; y < top; y += 1.6)
      craft
        .moveTo(...u(-capsuleHalf(y) + 0.4, y))
        .lineTo(...u(capsuleHalf(y) - 0.4, y))
        .stroke({ width: 1, color: 0xffffff, alpha: 0.09 });
    craft
      .poly([...u(-foot * 0.55, 0), ...u(-foot * 0.15, 0), ...u(-shoulder * 0.1, top), ...u(-shoulder * 0.45, top)])
      .fill({ color: 0xffffff, alpha: 0.06 });
    craft.rect(CXC - 3 * KC, BASE - neck * KC, 6 * KC, (neck - top) * KC).fill(0x26292d);
    craft.rect(CXC - foot * KC, BASE, 2 * foot * KC, 2 * KC * 0.6).fill(0x7a6a58); // the heat shield
    // The window, and Gemini's two hatches.
    if (gemini)
      for (const x of [-2.6, 1.0])
        craft.poly([...u(x, 11), ...u(x + 1.6, 11), ...u(x + 1.4, 13.6), ...u(x + 0.2, 13.6)]).fill(0x4a6a86);
    else craft.poly([...u(-1.6, 11), ...u(1.6, 11), ...u(1.2, 8), ...u(-1.2, 8)]).fill(0x4a6a86);
    world.addChild(stand, craft);
  } else {
    const steel = crewed;
    const cradles = new Graphics();
    for (const f of [0.15, 0.5, 0.85]) {
      const cx = tailX - f * len * k,
        top = CY + Math.min(bodyR, 90) * 0.6;
      cradles.rect(cx - 26, top, 52, FLOOR - 12 - top).fill(steel ? 0x8a8f96 : 0x6a5a44);
      cradles.rect(cx - 44, FLOOR - 12, 88, 12).fill(steel ? 0x6d7278 : 0x5a4c3a);
      cradles.rect(cx - 30, top - 6, 60, 8).fill(steel ? 0xa9aeb4 : 0x9a7950);
    }
    cradles.ellipse(MID, FLOOR + 8, (len * k) / 2, 12).fill({ color: 0x000000, alpha: 0.2 });
    world.addChild(cradles);
  }
  const MX = 60,
    MY = Math.max(80, bodyR * 1.4);
  if (here && !capsule) {
    const pw = Math.ceil(len * k + 2 * MX),
      ph = Math.ceil(2 * MY);
    const pic = canvasPicture(pw * 2, ph * 2, ctx => {
      ctx.save();
      ctx.scale(2, 2);
      ctx.translate(MX + len * k, MY);
      ctx.scale(k, k);
      roundShape(ctx, g, 0, 0, -Math.PI / 2, mated);
      ctx.restore();
    });
    pic.update();
    pic.scale.set(0.5);
    pic.position.set(tailX - len * k - MX, CY - MY);
    world.addChild(pic);
  } else if (!here) {
    const t = label(
      `The ${kit().name} is out of the hangar${g.rocket.where === 'stand' ? ', on the test stand' : g.rocket.where === 'tower' ? ', in the tower' : ''}.`,
      28,
      0xb8b2a6,
      { family: 'Georgia, serif' },
    );
    t.style.fontStyle = 'italic';
    t.position.set(MID, CY);
    world.addChild(t);
  }

  // ---- what was found, drawn on the metal; the pins, the leader lines, the cards ----
  const marks = new Graphics();
  const pins = new Graphics();
  const leaders = new Graphics();
  const cards = new Container();
  // ---- the crew on the floor, under the cards so nobody hides one ----
  const crew = [0, 1, 2, 3].map(() => {
    const f = standingFigure();
    const b = speech(300);
    world.addChild(f);
    return { f, b };
  });
  world.addChild(marks, leaders, pins, cards);
  // Bubbles go over everything.
  const talk = new Container();
  world.addChild(talk);
  for (const c of crew) talk.addChild(c.b);

  const out = outButton(leave);
  root.addChild(out);

  // The state of each spot, as the canvas hangar had it.
  // The state of each spot: on the inspection list (uncrewed), or in the spacecraft checkout (crewed).
  const fittingFixed = () => g.vehicle === 'wac' && spots.fitting && g.decided.leakFixed === spots.fitting.name;
  const seenOf = id => {
    if (crewed) return g.mission?.checkout?.[id]?.text ?? null;
    if (id === 'fitting' && fittingFixed()) return 'Leak check found and fixed the leak at this fitting.';
    if (g.looked[id] == null) return null;
    return g.looked[id] ? spots[id].cue : spots[id].sound;
  };
  // Whether a look found something on the metal there.
  const foundAt = id =>
    crewed ? !!g.mission?.checkout?.[id]?.cue : g.looked[id] === true && !(id === 'fitting' && fittingFixed());
  const flagsNow = () => (crewed ? g.mission?.flags || {} : inspectFlags());
  const actionableNow = () => (crewed ? g.room === 'checkout' : g.room === 'inspect');
  const spotIds = () => (crewed ? capsuleSpots() : Object.keys(spots));

  let sig = '',
    pinList = [],
    tw = TAG_W; // a card's width: narrower when a row has many
  function card(sp, seen, flagged, open) {
    const c = new Container();
    const name = label(sp.name, 20, 0xf1e6c8, {
      family: 'Georgia, serif',
      bold: true,
      wrap: tw - 24,
      align: 'left',
      ax: 0,
      ay: 0,
    });
    name.position.set(12, 10);
    const noteText = seen
      ? seen.length > 110
        ? `${seen.slice(0, 108)}…`
        : seen
      : open
        ? 'Click to look closely'
        : 'Not looked at';
    const note = label(noteText, 17, open ? 0xe8c66a : 0xb8bfca, {
      family: 'Georgia, serif',
      wrap: tw - 24,
      align: 'left',
      ax: 0,
      ay: 0,
    });
    if (open) note.style.fontStyle = 'italic';
    note.position.set(12, 14 + name.height);
    let h = 22 + name.height + note.height;
    const flag = flagged ? label('FLAGGED FOR THE CREW', 15, 0xe07a66, { bold: true, ax: 0, ay: 0 }) : null;
    if (flag) {
      flag.position.set(12, h - 4);
      h += 20;
    }
    const back = new Graphics()
      .roundRect(0, 0, tw, h, 6)
      .fill({ color: 0x14181e, alpha: 0.94 })
      .stroke({ width: flagged || open ? 2 : 1, color: flagged ? 0xd0634f : open ? 0xe8c66a : 0x4a5464 });
    c.addChild(back, name, note);
    if (flag) c.addChild(flag);
    if (open) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.hitArea = new Rectangle(0, 0, tw, h);
      c.on('pointertap', () => (crewed ? engLook?.(sp.id) : look(sp.id)));
    }
    return { c, h };
  }
  // Cards in a line (a row across, or a column down) are pushed apart so none covers another.
  function pushApart(list, key, size, lo, hi) {
    list.sort((a, b) => a[key] - b[key]);
    for (let i = 1; i < list.length; i++)
      list[i][key] = Math.max(list[i][key], list[i - 1][key] + size(list[i - 1]) + TAG_GAP);
    const over = list.length ? list.at(-1)[key] + size(list.at(-1)) - hi : 0;
    if (over > 0) for (const m of list) m[key] -= over;
    for (let i = list.length - 2; i >= 0; i--)
      list[i][key] = Math.min(list[i][key], list[i + 1][key] - size(list[i]) - TAG_GAP);
    // Then from the start again, so nothing is pushed off the low end into its neighbour (the whole line fits).
    if (list.length) list[0][key] = Math.max(lo, list[0][key]);
    for (let i = 1; i < list.length; i++)
      list[i][key] = Math.max(list[i][key], list[i - 1][key] + size(list[i - 1]) + TAG_GAP);
  }
  function layout() {
    const actionable = actionableNow();
    const flags = flagsNow();
    const ids = spotIds().filter(id => spots[id] && (actionable || seenOf(id) != null));
    const list = spread(
      ids.map(id => ({ id, name: spots[id].name, f: spotAt(id, spots[id].name) })),
      capsule ? 0.2 : Math.min(0.16, 0.9 / Math.max(1, ids.length)),
    );
    const s = `${actionable}|${here}|${list.map(sp => `${sp.id}:${seenOf(sp.id)}:${!!flags[sp.id]}`).join('|')}`;
    if (s === sig) return;
    sig = s;
    cards.removeChildren().forEach(c => c.destroy({ children: true }));
    marks.clear();
    leaders.clear();
    if (!here) return (pinList = []);
    const perRow = capsule ? 1 : Math.ceil(list.length / 2);
    tw = Math.min(TAG_W, Math.floor((W - 40 - (perRow - 1) * TAG_GAP) / Math.max(1, perRow)));
    const made = list.map((sp, i) => {
      const seen = seenOf(sp.id),
        flagged = !!flags[sp.id],
        open = seen == null && actionable;
      const side = i % 2 ? 1 : -1;
      // On the spacecraft a spot sits up her side, left or right; on a round, along her length.
      const up = Math.max(0.05, Math.min(0.95, sp.f)) * TALL;
      const py = capsule ? BASE - up * KC : CY,
        px = capsule ? CXC + side * capsuleHalf(up) * KC * 0.6 : tailX - sp.f * len * k;
      const { c, h } = card(sp, seen, flagged, open);
      return { sp, c, h, px, py, side, up: i % 2 === 0, seen, flagged, open };
    });
    if (capsule) {
      // Two columns, either side of her, each card level with its spot as far as the others allow.
      for (const col of [made.filter(m => m.side < 0), made.filter(m => m.side > 0)]) {
        col.forEach(m => (m.y = m.py - m.h / 2));
        pushApart(col, 'y', m => m.h, 20, FLOOR + 100);
        for (const m of col) m.x = m.side < 0 ? CXC - 230 - tw : CXC + 230;
      }
    } else
      for (const row of [made.filter(m => m.up), made.filter(m => !m.up)]) {
        row.forEach(m => (m.x = Math.max(20, Math.min(W - tw - 20, m.px - tw / 2))));
        pushApart(row, 'x', () => tw, 20, W - 20);
        for (const m of row) m.y = m.up ? CY - bodyR - 60 - m.h : CY + bodyR + 60;
      }
    for (const m of made) {
      m.c.position.set(m.x, m.y);
      cards.addChild(m.c);
      const ex = capsule ? (m.side < 0 ? m.x + tw : m.x) : m.x + tw / 2,
        ey = capsule ? m.y + m.h / 2 : m.up ? m.y + m.h : m.y;
      if (m.open) leaders.moveTo(m.px, m.py).lineTo(ex, ey).stroke({ width: 2, color: 0xe8c66a });
      else {
        const n = Math.hypot(ex - m.px, ey - m.py) / 9;
        for (let i = 0; i < n; i += 2)
          leaders
            .moveTo(m.px + ((ex - m.px) * i) / n, m.py + ((ey - m.py) * i) / n)
            .lineTo(m.px + ((ex - m.px) * Math.min(n, i + 1)) / n, m.py + ((ey - m.py) * Math.min(n, i + 1)) / n);
        leaders.stroke({ width: 2, color: 0xf1e6c8, alpha: 0.7 });
      }
      // What the inspector found, drawn on the metal.
      const r = capsule ? 18 : Math.max(14, Math.min(26, bodyR * 0.5)),
        X = m.px,
        Y = m.py;
      if (foundAt(m.sp.id)) {
        const kind = MARK[spots[m.sp.id].fault] || (/weld|seam/i.test(m.sp.name) ? 'crack' : 'scorch');
        if (kind === 'leak') {
          marks.ellipse(X, Y + 2, r * 0.8, r * 0.55).fill({ color: 0x3f4a2c, alpha: 0.55 });
          for (const [dx, l] of [
            [-5, 16],
            [4, 24],
          ])
            marks.roundRect(X + dx - 2, Y + r * 0.4, 4, l, 2).fill({ color: 0x55603a, alpha: 0.7 });
        } else if (kind === 'crack') {
          marks
            .moveTo(X - r, Y - 3)
            .lineTo(X - r * 0.4, Y + 4)
            .lineTo(X, Y - 5)
            .lineTo(X + r * 0.5, Y + 3)
            .lineTo(X + r, Y - 2)
            .stroke({ width: 2.5, color: capsule ? 0xd9cdb8 : 0x2a1a14 });
        } else marks.circle(X, Y, r * 0.7).fill({ color: capsule ? 0xb07a40 : 0x5a3a20, alpha: 0.35 });
        marks.circle(X, Y, r + 6).stroke({ width: 2, color: 0xf4f1e6, alpha: 0.8 });
      } else if (m.seen != null) {
        marks
          .moveTo(X - 8, Y - r - 2)
          .lineTo(X - 2, Y - r + 5)
          .lineTo(X + 10, Y - r - 10)
          .stroke({ width: 3, color: 0xe8f0dc, alpha: 0.85 });
      }
      if (m.flagged) marks.circle(X, Y, r + 11).stroke({ width: 3, color: 0xd0634f });
    }
    pinList = made;
  }

  const glow = new Graphics();
  glow.blendMode = 'add';
  world.addChild(glow);

  function update(dt, screen, reserve) {
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const s = Math.min(roomW / W, screen.height / H);
    world.scale.set(s);
    world.position.set((roomW - W * s) / 2, (screen.height - H * s) / 2);
    out.position.set(10, screen.height - 40 - 46);
    const t = g.time;
    layout();
    // The pins: open spots pulse gold, looked-at spots are cream, flagged ones red.
    pins.clear();
    glow.clear();
    for (const m of pinList) {
      const color = m.flagged ? 0xd0634f : m.open ? 0xe8c66a : 0xf1e6c8;
      pins.circle(m.px, m.py, 8).fill(color).stroke({ width: 2, color: 0x1b1c1e });
      if (m.open) glow.circle(m.px, m.py, 14 + 4 * Math.sin(t * 4)).fill({ color: 0xe8c66a, alpha: 0.25 });
    }
    // The crew on the floor in front of her; you are at the spot you are looking at, not on the floor.
    const people = inside(g).filter(p => p.id !== 'you' || !actionableNow());
    crew.forEach((c, i) => {
      const p = people[i];
      const x = 180 + ((i + 0.5) / Math.max(1, Math.min(4, people.length))) * 1240;
      c.f.position.set(x, FLOOR + 110);
      c.f.update(p || null);
      c.b.position.set(x, FLOOR - 70);
      c.b.update(p ? p.bubble : null);
    });
  }

  const keyNow = () =>
    `${uiEra(g)}|${g.vehicle}|${!!g.rocket.mated}|${!!g.crewed || g.rocket.where === 'hangar'}|${!!g.crewed}`;
  const key = keyNow();
  const stale = () => keyNow() !== key;
  return { root, update, stale };
}
