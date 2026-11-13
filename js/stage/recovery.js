// RECOVERY, rebuilt in PixiJS (v0.8): where the flight ends, while Recovery reads the reports off the board. For a
// capsule, the recovery area: the ship on the horizon, the capsule riding the swell in its patch of green dye, the
// swimmers' raft beside it from Gemini on and the helicopter over it. The Mercury capsules came down without a collar
// and the destroyer or the helicopter took them straight out; Apollo's floated upright on its bags. The Shuttle rolls out
// on the runway with the convoy coming up; Dragon is lifted on to the deck of her recovery ship. If the crew was lost,
// the sea is empty and the ship's flag is at half mast. Calm, slow motion only: nothing flashes, the rotor is a steady
// blur. Reads only what Recovery could see, through game.js.
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { yearOf } from '../site/draw.js';
import { label, setText, outButton, puffTexture, gradientTexture } from './kit.js';

const W = 1600,
  H = 900,
  SEA = 430;

// Which craft came home, as Recovery sees it.
export function craftOf(g) {
  if (g.vehicle === 'shuttle') return 'shuttle';
  if (g.vehicle === 'dragon') return 'dragon';
  if (g.vehicle === 'sls') return 'orion';
  if (g.vehicle === 'redstone' || g.vehicle === 'atlas') return 'mercury';
  if (g.vehicle === 'titan') return 'gemini';
  return 'apollo';
}

// A capsule seen from the side, base down. size: its base width.
function capsule(kind) {
  const c = new Graphics();
  if (kind === 'mercury') {
    c.poly([-34, 0, 34, 0, 16, -62, 12, -92, -12, -92, -16, -62]).fill(0x24272b);
    c.rect(-38, -6, 76, 10).fill(0x7a5a3a);
    for (let y = -56; y > -90; y -= 8) c.rect(-14, y, 28, 2).fill({ color: 0xffffff, alpha: 0.12 });
  } else if (kind === 'gemini') {
    c.poly([-46, 0, 46, 0, 22, -70, 16, -110, -16, -110, -22, -70]).fill(0x1f2226);
    c.rect(-50, -6, 100, 10).fill(0x7a5a3a);
    c.rect(-8, -70, 16, 20).fill({ color: 0x9ab4c8, alpha: 0.6 });
  } else if (kind === 'dragon') {
    c.poly([-62, 0, 62, 0, 44, -80, 26, -104, -26, -104, -44, -80]).fill(0xf2f2ee);
    c.rect(-66, -8, 132, 12).fill(0x2a2a2a);
    c.rect(-50, -40, 100, 6).fill({ color: 0x1a1a1a, alpha: 0.5 });
    c.rect(-8, -70, 16, 12).fill({ color: 0x3a4a58, alpha: 0.8 });
  } else {
    // Apollo and Orion: the wide cone, white or silver, with the uprighting bags on top.
    const body = kind === 'orion' ? 0xe8e8e2 : 0xc8ccd0;
    c.poly([-70, 0, 70, 0, 10, -88, -10, -88]).fill(body);
    c.rect(-74, -8, 148, 12).fill(0x6a4a30);
    c.rect(-24, -54, 14, 14).fill({ color: 0x3a4a58, alpha: 0.8 });
    for (const x of [-12, 0, 12]) c.circle(x, -96, 10).fill(0xeeeeea);
  }
  return c;
}

export function recoveryScene({ leave }) {
  const g = game;
  const root = new Container();
  const world = new Container();
  root.addChild(world);
  const kind = craftOf(g);
  const lost = g.mission?.fate === 'killed';
  const runway = kind === 'shuttle';

  // ---- the sky and the sea (or the desert and the runway) ----
  const sky = new Sprite(
    gradientTexture(
      runway
        ? [
            [0, '#6f9cc4'],
            [1, '#e2d2b0'],
          ]
        : [
            [0, '#5b86b0'],
            [1, '#c9d8e0'],
          ],
    ),
  );
  sky.position.set(-800, -800);
  sky.width = W + 1600;
  sky.height = SEA + 800;
  const ground = new Graphics();
  if (runway) {
    ground.rect(-800, SEA, W + 1600, H - SEA + 800).fill(0xc9b48a);
    ground.rect(-800, SEA + 120, W + 1600, 150).fill(0x5a5a58);
    for (let x = -760; x < W + 800; x += 140) ground.rect(x, SEA + 192, 70, 6).fill(0xe8e2d0);
    ground
      .poly([0, SEA, 260, SEA - 30, 520, SEA - 12, 820, SEA - 40, 1100, SEA - 18, 1600, SEA - 26, 1600, SEA, 0, SEA])
      .fill(0x9a8a72);
  } else ground.rect(-800, SEA, W + 1600, H - SEA + 800).fill(0x24506e);
  world.addChild(sky, ground);

  // The swell: long slow bands of lighter water.
  const swell = new Graphics();
  world.addChild(swell);

  // ---- the recovery ship on the horizon, the flag at half mast if they were lost ----
  const ship = new Graphics();
  const year = yearOf(g);
  if (!runway) {
    if (kind === 'dragon') {
      // The recovery ship, close: her deck with the capsule lifted on to it.
      ship.poly([700, SEA + 40, 1500, SEA + 40, 1460, SEA + 120, 760, SEA + 120]).fill(0x3a3f45);
      ship.rect(1300, SEA - 60, 140, 100).fill(0xe8e6e0);
      ship.rect(860, SEA - 140, 12, 180).fill(0x2a2d30);
      ship
        .moveTo(866, SEA - 140)
        .lineTo(1020, SEA - 80)
        .stroke({ width: 6, color: 0x2a2d30 });
    } else {
      const x = 1150,
        y = SEA - 2;
      const carrier = year >= 1962 && kind !== 'mercury';
      if (carrier) {
        ship.poly([x - 230, y, x + 230, y, x + 210, y + 18, x - 210, y + 18]).fill(0x5d6670);
        ship.rect(x - 240, y - 8, 480, 8).fill(0x6c757e);
        ship.rect(x + 60, y - 50, 40, 42).fill(0x5d6670);
        ship.rect(x + 76, y - 76, 6, 26).fill(0x5d6670);
      } else {
        ship.poly([x - 120, y, x + 120, y, x + 100, y + 14, x - 100, y + 14]).fill(0x5d6670);
        ship.rect(x - 30, y - 30, 60, 30).fill(0x5d6670);
        ship.rect(x - 4, y - 58, 4, 30).fill(0x5d6670);
      }
    }
  }
  const flag = new Graphics();
  world.addChild(ship, flag);

  // ---- the craft, the dye, the raft, the helicopter ----
  const dye = new Sprite(puffTexture());
  dye.anchor.set(0.5);
  dye.tint = 0x58c48a;
  dye.alpha = 0.5;
  dye.width = 520;
  dye.height = 90;
  dye.position.set(620, 640);
  const craft = new Container();
  craft.position.set(620, 640);
  const raft = new Graphics();
  const heli = new Container();
  const heliBody = new Graphics();
  const rotor = new Graphics().ellipse(0, 0, 150, 8).fill({ color: 0x1a1d20, alpha: 0.28 });
  rotor.position.set(0, -54);
  const cable = new Graphics();
  heli.addChild(cable, heliBody, rotor);
  heli.position.set(640, 230);
  world.addChild(dye, raft, craft, heli);

  if (!lost && !runway) {
    if (kind === 'dragon') {
      craft.addChild(capsule('dragon'));
      craft.position.set(1000, SEA + 40);
      craft.scale.set(0.9);
      dye.visible = false;
      heli.visible = false;
    } else craft.addChild(capsule(kind));
    // The swimmers' raft from Gemini on.
    if (kind !== 'mercury' && kind !== 'dragon')
      raft.ellipse(0, 0, 70, 14).fill(0xe0a030).ellipse(0, -4, 54, 8).fill(0xc88a20);
    heliBody
      .roundRect(-90, -40, 160, 64, 26)
      .fill(year >= 1990 ? 0x4a5560 : 0x3e4a3e)
      .rect(60, -20, 140, 14)
      .fill(year >= 1990 ? 0x4a5560 : 0x3e4a3e)
      .rect(190, -44, 10, 40)
      .fill(0x2a2f2a)
      .roundRect(-82, -30, 50, 30, 10)
      .fill({ color: 0x9ab4c8, alpha: 0.7 })
      .rect(-40, 24, 6, 18)
      .fill(0x222222)
      .rect(30, 24, 6, 18)
      .fill(0x222222)
      .rect(-60, 40, 110, 4)
      .fill(0x222222)
      .rect(-4, -60, 8, 20)
      .fill(0x222222);
    // Orion was brought into the ship's well deck, and Dragon lifted aboard: no helicopter over either.
    heli.visible = kind !== 'orion' && kind !== 'dragon';
  } else {
    dye.visible = false;
    heli.visible = false;
  }
  if (runway && !lost) {
    // The orbiter rolled to a stop, from the side, and the convoy coming down the runway.
    const o = new Graphics()
      .poly([-260, -10, 200, -10, 250, 0, 200, 14, -260, 14])
      .fill(0xeeeeea)
      .poly([-260, -10, -330, -110, -290, -110, -200, -10])
      .fill(0xdedcd4)
      .rect(-200, 14, 400, 8)
      .fill(0x1c1c1c)
      .poly([-120, 22, 130, 22, 180, 14, -160, 14])
      .fill(0x1c1c1c)
      .rect(-180, 22, 8, 22)
      .fill(0x2a2a2a)
      .rect(140, 22, 8, 22)
      .fill(0x2a2a2a)
      .poly([200, -10, 250, 0, 200, 14])
      .fill(0x2a2a2a)
      .rect(150, -8, 30, 8)
      .fill(0x2c3a48)
      .roundRect(-250, -24, 70, 16, 6)
      .fill(0xe2e0d8);
    craft.addChild(o);
    craft.position.set(700, SEA + 160);
    for (let i = 0; i < 4; i++) {
      const v = new Graphics()
        .roundRect(0, -26, 80, 30, 4)
        .fill(i ? 0xe8e2d0 : 0xd8b040)
        .rect(8, -22, 20, 12)
        .fill(0x4a5a6a);
      v.position.set(1150 + i * 110, SEA + 196);
      v.speed = 18 + i * 2;
      world.addChild(v);
      (world.convoy ||= []).push(v);
    }
  }

  // ---- the words: where this is ----
  const where = label('', 18, 0xf1e6c8, { family: 'Georgia, serif' });
  const plate = new Graphics();
  root.addChild(plate, where);
  setText(
    where,
    lost
      ? 'The recovery area. The ships are searching.'
      : runway
        ? 'The runway: wheels stop.'
        : kind === 'dragon'
          ? 'The recovery ship: the capsule is on deck.'
          : 'The recovery area: the capsule is down.',
  );

  const out = outButton(leave);
  root.addChild(out);

  function update(dt, screen, reserve) {
    const roomW = Math.max(screen.width * 0.55, screen.width - reserve);
    const s = Math.max(roomW / W, screen.height / H);
    world.scale.set(s);
    world.position.set((roomW - W * s) / 2, (screen.height - H * s) / 2);
    out.position.set(10, screen.height - 86);
    where.position.set(roomW / 2, screen.height - 66);
    plate
      .clear()
      .roundRect(roomW / 2 - where.width / 2 - 16, screen.height - 86, where.width + 32, 40, 5)
      .fill({ color: 0x0f1218, alpha: 0.7 });
    const t = g.time || performance.now() / 1000;

    swell.clear();
    if (!runway)
      for (let i = 0; i < 9; i++) {
        const y = SEA + 20 + i * i * 6,
          x = ((t * (6 + i * 3) + i * 200) % 400) - 400;
        for (let k = x; k < W + 400; k += 400)
          swell.ellipse(k, y, 120 + i * 20, 2 + i * 0.6).fill({ color: 0x9ccbe0, alpha: 0.08 + i * 0.01 });
      }

    // The capsule rides the swell; the helicopter holds over it.
    if (!runway && kind !== 'dragon') {
      craft.y = 640 + Math.sin(t * 0.9) * 6;
      craft.rotation = Math.sin(t * 0.7) * 0.05;
      raft.position.set(760, 662 + Math.sin(t * 0.9 + 1) * 5);
      heli.y = 230 + Math.sin(t * 0.5) * 6;
      cable
        .clear()
        .moveTo(0, 40)
        .lineTo(-20, 330 + (craft.y - 640))
        .stroke({ width: 2, color: 0x222222, alpha: 0.7 });
    }
    for (const v of world.convoy || []) v.x = Math.max(980 + (v.x - 1150) * 0.1, v.x - v.speed * dt);

    // The flag on the ship: at half mast if the crew was lost.
    flag.clear();
    if (!runway && kind !== 'dragon') {
      const top = SEA - 2 - (year >= 1962 && kind !== 'mercury' ? 76 : 58);
      const fy = lost ? top + 14 : top;
      flag.rect(1150 + (year >= 1962 && kind !== 'mercury' ? 82 : 0), fy, 22, 12).fill(0xb03a2e);
    }
  }

  const stale = () => false;
  return { root, update, stale };
}
