// THE ASSEMBLY HANGAR, rebuilt in PixiJS (v0.8): the inspection. The round lies on its cradles under the quonset's
// lamps; each spot on the list is pinned where it is on the hardware, with its card above or below. Look at a spot and
// what you found is drawn on the metal at that point: a damp stain and drips at a leak, a crack along a weld, a scorch
// ring elsewhere; a chalk tick where it was sound. Flagged spots are ringed in red. The room panel keeps the decision.
// The uncrewed hangar only for now; Hangar S and the Apollo checkout come with the Cape rooms.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Rectangle } from '../vendor/pixi.min.mjs';
import { g as game, kit, dateText } from '../game.js';
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

export function hangarScene({ leave, look }) {
  const g = game;
  const era = uiEra(g);
  const spots = KITS[g.vehicle]?.spots || {};
  const mated = !!g.rocket.mated,
    here = g.rocket.where === 'hangar';
  const [len0, half] = SHAPE[g.vehicle] || [100, 10];
  const len =
    (g.vehicle === 'wac' || g.vehicle === 'aerobee') && mated ? 86 : g.vehicle === 'bumper' && mated ? 160 : len0;
  const k = Math.min(1150 / len, 95 / half),
    tailX = MID + (len * k) / 2,
    bodyR = half * k;
  const root = new Container();
  const world = new Container();
  root.addChild(world);

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

  // ---- the round on its cradles (the old canvas drawing of the round, as a texture), or the empty cradles ----
  const cradles = new Graphics();
  for (const f of [0.15, 0.5, 0.85]) {
    const cx = tailX - f * len * k,
      top = CY + Math.min(bodyR, 90) * 0.6;
    cradles.rect(cx - 26, top, 52, FLOOR - 12 - top).fill(0x6a5a44);
    cradles.rect(cx - 44, FLOOR - 12, 88, 12).fill(0x5a4c3a);
    cradles.rect(cx - 30, top - 6, 60, 8).fill(0x9a7950);
  }
  cradles.ellipse(MID, FLOOR + 8, (len * k) / 2, 12).fill({ color: 0x000000, alpha: 0.2 });
  world.addChild(cradles);
  const MX = 60,
    MY = Math.max(80, bodyR * 1.4);
  if (here) {
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
  } else {
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
  world.addChild(marks, leaders, pins, cards);

  // ---- the crew on the floor ----
  const crew = [0, 1, 2, 3].map(() => {
    const f = standingFigure();
    const b = speech(300);
    world.addChild(f);
    return { f, b };
  });
  // Bubbles go over everything.
  const talk = new Container();
  world.addChild(talk);
  for (const c of crew) talk.addChild(c.b);

  const out = outButton(leave);
  root.addChild(out);

  // The state of each spot, as the canvas hangar had it.
  const fittingFixed = () => g.vehicle === 'wac' && spots.fitting && g.decided.leakFixed === spots.fitting.name;
  const seenOf = id => {
    if (id === 'fitting' && fittingFixed()) return 'Leak check found and fixed the leak at this fitting.';
    if (g.looked[id] == null) return null;
    return g.looked[id] ? spots[id].cue : spots[id].sound;
  };

  let sig = '',
    pinList = [];
  function layout() {
    const actionable = g.room === 'inspect';
    const flags = inspectFlags();
    const ids = Object.keys(spots).filter(id => actionable || seenOf(id) != null);
    const list = spread(
      ids.map(id => ({ id, name: spots[id].name, f: spotAt(id, spots[id].name) })),
      Math.min(0.16, 0.9 / Math.max(1, ids.length)),
    );
    const s = `${actionable}|${here}|${list.map(sp => `${sp.id}:${seenOf(sp.id)}:${!!flags[sp.id]}`).join('|')}`;
    if (s === sig) return;
    sig = s;
    cards.removeChildren().forEach(c => c.destroy({ children: true }));
    marks.clear();
    leaders.clear();
    if (!here) return (pinList = []);
    // Each card: the spot's name, then what was seen, or the invitation to look.
    const made = list.map((sp, i) => {
      const px = tailX - sp.f * len * k,
        up = i % 2 === 0;
      const seen = seenOf(sp.id),
        flagged = !!flags[sp.id],
        open = seen == null && actionable;
      const c = new Container();
      const name = label(sp.name, 20, 0xf1e6c8, {
        family: 'Georgia, serif',
        bold: true,
        wrap: TAG_W - 24,
        align: 'left',
        ax: 0,
        ay: 0,
      });
      name.position.set(12, 10);
      const noteText = seen
        ? seen.length > 110
          ? `${seen.slice(0, 108)}…`
          : seen
        : actionable
          ? 'Click to look closely'
          : 'Not looked at';
      const note = label(noteText, 17, open ? 0xe8c66a : 0xb8bfca, {
        family: 'Georgia, serif',
        wrap: TAG_W - 24,
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
      const card = new Graphics()
        .roundRect(0, 0, TAG_W, h, 6)
        .fill({ color: 0x14181e, alpha: 0.94 })
        .stroke({ width: flagged || open ? 2 : 1, color: flagged ? 0xd0634f : open ? 0xe8c66a : 0x4a5464 });
      c.addChild(card, name, note);
      if (flag) c.addChild(flag);
      if (open) {
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new Rectangle(0, 0, TAG_W, h);
        c.on('pointertap', () => look(sp.id));
      }
      return { sp, c, h, px, up, seen, flagged, open };
    });
    // Cards in the same row are pushed apart so none covers another.
    for (const row of [made.filter(m => m.up), made.filter(m => !m.up)]) {
      row.forEach(m => (m.x = Math.max(20, Math.min(W - TAG_W - 20, m.px - TAG_W / 2))));
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) row[i].x = Math.max(row[i].x, row[i - 1].x + TAG_W + TAG_GAP);
      const over = row.length ? row.at(-1).x - (W - TAG_W - 20) : 0;
      if (over > 0) for (const m of row) m.x -= over;
      for (let i = row.length - 2; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - TAG_W - TAG_GAP);
    }
    for (const m of made) {
      const y = m.up ? CY - bodyR - 60 - m.h : CY + bodyR + 60;
      m.c.position.set(m.x, y);
      cards.addChild(m.c);
      const ex = m.x + TAG_W / 2,
        ey = m.up ? y + m.h : y;
      if (m.open) leaders.moveTo(m.px, CY).lineTo(ex, ey).stroke({ width: 2, color: 0xe8c66a });
      else {
        const n = Math.hypot(ex - m.px, ey - CY) / 9;
        for (let i = 0; i < n; i += 2)
          leaders
            .moveTo(m.px + ((ex - m.px) * i) / n, CY + ((ey - CY) * i) / n)
            .lineTo(m.px + ((ex - m.px) * Math.min(n, i + 1)) / n, CY + ((ey - CY) * Math.min(n, i + 1)) / n);
        leaders.stroke({ width: 2, color: 0xf1e6c8, alpha: 0.7 });
      }
      // What the inspector found, drawn on the metal.
      const r = Math.max(14, Math.min(26, bodyR * 0.5));
      if (g.looked[m.sp.id] === true && !(m.sp.id === 'fitting' && fittingFixed())) {
        const kind = MARK[spots[m.sp.id].fault] || (/weld|seam/i.test(m.sp.name) ? 'crack' : 'scorch');
        if (kind === 'leak') {
          marks.ellipse(m.px, CY + 2, r * 0.8, r * 0.55).fill({ color: 0x3f4a2c, alpha: 0.55 });
          for (const [dx, l] of [
            [-5, 16],
            [4, 24],
          ])
            marks.roundRect(m.px + dx - 2, CY + r * 0.4, 4, l, 2).fill({ color: 0x55603a, alpha: 0.7 });
        } else if (kind === 'crack') {
          marks
            .moveTo(m.px - r, CY - 3)
            .lineTo(m.px - r * 0.4, CY + 4)
            .lineTo(m.px, CY - 5)
            .lineTo(m.px + r * 0.5, CY + 3)
            .lineTo(m.px + r, CY - 2)
            .stroke({ width: 2.5, color: 0x2a1a14 });
        } else marks.circle(m.px, CY, r * 0.7).fill({ color: 0x5a3a20, alpha: 0.35 });
        marks.circle(m.px, CY, r + 6).stroke({ width: 2, color: 0xf4f1e6, alpha: 0.8 });
      } else if (m.seen != null) {
        marks
          .moveTo(m.px - 8, CY - r - 2)
          .lineTo(m.px - 2, CY - r + 5)
          .lineTo(m.px + 10, CY - r - 10)
          .stroke({ width: 3, color: 0xe8f0dc, alpha: 0.85 });
      }
      if (m.flagged) marks.circle(m.px, CY, r + 11).stroke({ width: 3, color: 0xd0634f });
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
      pins.circle(m.px, CY, 8).fill(color).stroke({ width: 2, color: 0x1b1c1e });
      if (m.open) glow.circle(m.px, CY, 14 + 4 * Math.sin(t * 4)).fill({ color: 0xe8c66a, alpha: 0.25 });
    }
    // The crew on the floor in front of her; you are at the spot you are looking at, not on the floor.
    const people = inside(g).filter(p => p.id !== 'you' || g.room !== 'inspect');
    crew.forEach((c, i) => {
      const p = people[i];
      const x = 180 + ((i + 0.5) / Math.max(1, Math.min(4, people.length))) * 1240;
      c.f.position.set(x, FLOOR + 110);
      c.f.update(p || null);
      c.b.position.set(x, FLOOR - 70);
      c.b.update(p ? p.bubble : null);
    });
  }

  const key = `${era}|${g.vehicle}|${mated}|${here}`;
  const stale = () => `${uiEra(g)}|${g.vehicle}|${!!g.rocket.mated}|${g.rocket.where === 'hangar'}` !== key;
  return { root, update, stale };
}
// Only the uncrewed hangar is rebuilt so far.
hangarScene.accepts = g => !g.crewed;
