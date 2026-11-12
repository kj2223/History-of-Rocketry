// THE SIMULATOR, rebuilt in PixiJS (v0.8): the training room in the old building at the Cape. The lit SIMULATION sign
// over the door (nobody forgets this is a sim), the same telemetry screen as Mission Control's, the sim clock in big
// figures, the sim supervisor behind his glass with the failures he can throw at you on his board, and your console
// with you at it. The sim loop's latest call floats over the room. The panel keeps the decision.
// Reads only what the room could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { label, setText, speech, outButton, puffTexture } from './kit.js';
import { desk, telemetryScreen } from './control.js';

const W = 1600,
  H = 900,
  FLOOR = 760;

function pool(x, y, w, h, tint, alpha) {
  const s = new Sprite(puffTexture());
  s.anchor.set(0.5);
  s.position.set(x, y);
  s.width = w;
  s.height = h;
  s.tint = tint;
  s.alpha = alpha;
  return s;
}

export function simScene({ leave }) {
  const g = game;
  const root = new Container();
  const world = new Container();
  root.addChild(world);

  // ---- the room: plain walls with their seams, a rail, the floor, two pools of light ----
  const room = new Graphics();
  room.rect(-800, -800, W + 1600, FLOOR + 800).fill(0x2a2f36);
  room.rect(-800, FLOOR, W + 1600, H - FLOOR + 800).fill(0x34312c);
  for (let x = -400; x < W + 400; x += 120) room.rect(x, 0, 2, FLOOR).fill({ color: 0xffffff, alpha: 0.04 });
  room.rect(-800, 520, W + 1600, 18).fill(0x242931);
  room.rect(-800, 520, W + 1600, 3).fill(0x4b5156);
  room.rect(-800, FLOOR, W + 1600, 8).fill({ color: 0x000000, alpha: 0.25 });
  world.addChild(room);
  world.addChild(pool(470, 340, 1100, 760, 0x649da7, 0.22), pool(1390, 300, 600, 600, 0x9eaec0, 0.16));

  // ---- the sign over the door ----
  const signGlow = pool(800, 70, 620, 220, 0xe0543c, 0);
  signGlow.blendMode = 'add';
  const sign = new Graphics();
  const signWord = label('SIMULATION', 30, 0x8a6a60, { bold: true, spacing: 4 });
  signWord.position.set(800, 70);
  world.addChild(signGlow, sign, signWord);

  // ---- the wall: the telemetry screen and the sim clock ----
  const tele = telemetryScreen();
  tele.place(110, 150, 700, 330);
  world.addChild(tele);
  const clock = new Graphics()
    .rect(870, 150, 300, 150)
    .fill(0x181b1f)
    .rect(880, 160, 280, 100)
    .fill(0x120d08)
    .rect(870, 300, 300, 3)
    .fill(0x6b7278);
  const clockTitle = label('SIM CLOCK', 13, 0x8c949b, { spacing: 2 });
  clockTitle.position.set(1020, 280);
  const clockDigits = label('--:--', 54, 0xff9a3c, { bold: true });
  clockDigits.position.set(1020, 202);
  const clockWord = label('', 14, 0xe8c66a, { spacing: 2 });
  clockWord.position.set(1020, 245);
  const clockGlow = pool(1020, 205, 300, 120, 0xff7a2a, 0.12);
  clockGlow.blendMode = 'add';
  world.addChild(clock, clockGlow, clockDigits, clockWord, clockTitle);

  // ---- the sim supervisor behind his glass, and his failures board ----
  const sup = new Graphics();
  sup.rect(1230, 120, 330, 290).fill(0x181b1f);
  sup.rect(1244, 134, 302, 262).fill(0x3a4a5a);
  sup.rect(1340, 254, 96, 70).fill(0x5d6a78); // his shoulders
  sup.circle(1388, 232, 22).fill(0xe2b993);
  sup
    .moveTo(1366, 230)
    .arc(1388, 232, 21, Math.PI, 2 * Math.PI)
    .stroke({ width: 4, color: 0x373b3e });
  sup.rect(1254, 324, 282, 62).fill(0x4b5258); // his desk
  sup.rect(1262, 140, 20, 250).fill({ color: 0xffffff, alpha: 0.08 });
  sup.poly([1480, 134, 1514, 134, 1396, 396, 1362, 396]).fill({ color: 0xb6d8e9, alpha: 0.1 });
  sup.rect(1230, 408, 330, 4).fill(0x6b7278);
  const supName = label('SIM SUPERVISOR', 15, 0xd8d2c0, { family: 'Georgia, serif', spacing: 1 });
  supName.position.set(1395, 432);
  const failures = new Graphics();
  world.addChild(sup, failures, supName);

  // ---- your console, with you at it ----
  const yours = desk({ who: g.people.you, label: 'YOU · SIM CONSOLE', duty: 'retro', yours: true });
  yours.scale.set(1.75);
  yours.position.set(800 - (460 * 1.75) / 2, 660);
  world.addChild(yours);

  // ---- the sim loop's last call, over the room ----
  const talk = speech(520);
  talk.scale.set(1.1);
  talk.position.set(800, 570);
  world.addChild(talk);

  const out = outButton(leave);
  root.addChild(out);

  function update(dt, screen, reserve) {
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const s = Math.min(roomW / W, screen.height / H);
    world.scale.set(s);
    world.position.set((roomW - W * s) / 2, (screen.height - H * s) / 2);
    out.position.set(10, screen.height - 40 - 46);
    const c = g.console && g.console.kind === 'sim' ? g.console : null,
      t = g.time;

    // The sign is lit while a sim runs.
    sign
      .clear()
      .rect(640, 40, 320, 60)
      .fill(c ? 0xa3321f : 0x4a2420);
    signWord.style.fill = c ? 0xfff2e8 : 0x8a6a60;
    signGlow.alpha = c ? 0.35 + Math.sin(t * 2) * 0.04 : 0;

    tele.draw(c);
    setText(
      clockDigits,
      c
        ? c.phase === 'count' || c.poll || c.phase === 'hold'
          ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}`
          : c.phase === 'debrief'
            ? 'END'
            : `T+${Math.floor(c.t || 0)}`
        : '--:--',
    );
    setText(clockWord, c ? (c.poll ? 'POLL' : (c.phase || '').toUpperCase()) : 'STANDBY');
    clockGlow.alpha = c ? 0.14 : 0.04;

    // His failures board: one lamp for each station he can fail, lit when that station has a lamp lit in the sim.
    failures.clear();
    const lit = c?.lamps || {};
    const names = ['EECOM', 'RETRO', 'FIDO', 'BOOSTER', 'NETWORK'];
    names.forEach((n, i) => {
      const on = !!lit[n];
      const x = 1270 + i * 54;
      failures.rect(x, 338, 40, 12).fill(on ? (Math.sin(t * 8) > 0 ? 0xe0543c : 0x7a2a20) : c ? 0x2f5a3a : 0x31413a);
    });

    yours.update(c, t);
    const last = c && c.chatter.length ? c.chatter[c.chatter.length - 1] : null;
    talk.update(last ? { text: `${last.who}: ${last.text}`, tone: last.tone } : null);
  }

  const stale = () => false;
  return { root, update, stale };
}
