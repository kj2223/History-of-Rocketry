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

// A capsule seen from the side, base down, as she floats: the heat shield's scorched rim, the panels and windows,
// and on Gemini and Apollo the flotation collar the swimmers fitted round her.
function capsule(kind, collar = false) {
  const c = new Graphics();
  if (kind === 'mercury') {
    c.poly([-34, 0, 34, 0, 16, -62, 12, -92, -12, -92, -16, -62]).fill(0x24272b);
    for (let y = -6; y > -60; y -= 7)
      c.rect(-34 + (-y / 62) * 18, y, 68 - (-y / 62) * 36, 1.5).fill({ color: 0xffffff, alpha: 0.1 });
    c.rect(-12, -92, 24, 30).fill(0x2c3034);
    for (let y = -88; y > -92 - 1; y -= 6) c.rect(-12, y, 24, 1).fill({ color: 0xffffff, alpha: 0.12 });
    c.rect(-8, -102, 16, 10).fill(0x3a3e42); // the antenna canister
    c.rect(-38, -6, 76, 10).fill(0x6a4a2c);
    c.rect(-38, -6, 76, 3).fill(0x8a6a44);
    c.rect(4, -44, 9, 10).fill({ color: 0x9ab4c8, alpha: 0.55 });
  } else if (kind === 'gemini') {
    c.poly([-46, 0, 46, 0, 22, -70, 16, -110, -16, -110, -22, -70]).fill(0x1f2226);
    for (let y = -8; y > -68; y -= 8)
      c.rect(-46 + (-y / 70) * 24, y, 92 - (-y / 70) * 48, 1.5).fill({ color: 0xffffff, alpha: 0.09 });
    c.rect(-9, -64, 7, 14)
      .fill({ color: 0x9ab4c8, alpha: 0.6 })
      .rect(2, -64, 7, 14)
      .fill({ color: 0x9ab4c8, alpha: 0.6 });
    c.rect(-16, -110, 32, 4).fill(0x8a8e92);
    c.rect(-50, -6, 100, 10).fill(0x6a4a2c);
  } else if (kind === 'dragon') {
    c.poly([-62, 0, 62, 0, 44, -80, 26, -104, -26, -104, -44, -80]).fill(0xf2f2ee);
    c.rect(-66, -8, 132, 12).fill(0x2a2a2a);
    c.rect(-50, -40, 100, 6).fill({ color: 0x1a1a1a, alpha: 0.5 });
    c.rect(-8, -70, 16, 12).fill({ color: 0x3a4a58, alpha: 0.8 });
    c.poly([26, -104, -26, -104, -20, -112, 20, -112]).fill(0xe2e2dc); // the nose cone, opened back
  } else {
    // Apollo and Orion: the wide cone with its scorched shield, the panels, the hatch and the uprighting bags.
    const body = kind === 'orion' ? 0xe8e8e2 : 0xc8ccd0;
    c.poly([-70, 0, 70, 0, 10, -88, -10, -88]).fill(body);
    c.poly([-70, 0, 70, 0, 52, -22, -52, -22]).fill({ color: 0x6a5030, alpha: kind === 'orion' ? 0.15 : 0.35 }); // the scorch
    for (const k of [0.35, 0.62]) {
      const y = -88 * k,
        hw = 70 - 60 * k;
      c.rect(-hw, y, hw * 2, 1.4).fill({ color: 0x5a5e62, alpha: 0.4 });
    }
    c.rect(-10, -56, 20, 22).fill({ color: 0x8a8e92, alpha: 0.8 }); // the hatch
    c.rect(-6, -52, 12, 8).fill({ color: 0x3a4a58, alpha: 0.85 });
    c.rect(-34, -40, 8, 8)
      .fill({ color: 0x3a4a58, alpha: 0.8 })
      .rect(26, -40, 8, 8)
      .fill({ color: 0x3a4a58, alpha: 0.8 });
    c.rect(-74, -8, 148, 12).fill(0x5a3e26);
    c.rect(-74, -8, 148, 3).fill(0x7a5a3a);
    for (const x of [-12, 0, 12])
      c.circle(x, -96, 10)
        .fill(0xeeeeea)
        .circle(x - 3, -99, 3)
        .fill({ color: 0xffffff, alpha: 0.7 });
  }
  if (collar) {
    // The flotation collar: a fat ring round her waist, the swimmers' work.
    const w = kind === 'gemini' ? 62 : 84;
    c.roundRect(-w, -18, w * 2, 16, 8).fill(kind === 'gemini' ? 0xd88a2a : 0x7c8a6a);
    c.roundRect(-w, -18, w * 2, 5, 3).fill({ color: 0xffffff, alpha: 0.18 });
  }
  return c;
}

// A swimmer, or a crewman in the raft: sitting, from the side. colour: wetsuit black, or the crew's garments.
function sitter(gr, x, y, colour, s = 1) {
  gr.rect(x - 6 * s, y - 16 * s, 12 * s, 16 * s).fill(colour);
  gr.circle(x, y - 22 * s, 6 * s).fill(colour === 0x16181a ? 0x16181a : 0xd6ac86);
  if (colour === 0x16181a) gr.rect(x - 4 * s, y - 25 * s, 8 * s, 3 * s).fill(0x6a8a9a); // the mask
}

// The recovery helicopter, from the side, by era: the Marine Corps' HUS-1 over Mercury, the Navy's Sea King from
// Gemini on. The rotor is a steady blur.
function helicopter(year) {
  const c = new Container();
  const b = new Graphics();
  if (year < 1965) {
    const olive = 0x48523e;
    b.ellipse(-30, 0, 62, 36).fill(olive); // the big round cabin
    b.poly([20, -18, 200, -6, 200, 4, 20, 22]).fill(olive); // the tapering boom
    b.poly([190, -6, 214, -48, 222, -48, 204, 4]).fill(olive); // the tail pylon
    b.ellipse(-62, -8, 22, 18).fill({ color: 0x9ab4c8, alpha: 0.6 }); // the cockpit glazing up front
    b.rect(-50, 30, 4, 14).fill(0x222222).rect(10, 30, 4, 14).fill(0x222222);
    b.circle(-48, 46, 6).fill(0x1a1a1a).circle(12, 46, 6).fill(0x1a1a1a);
    b.rect(-30, 6, 50, 3).fill({ color: 0xe8e2d0, alpha: 0.7 });
    b.rect(-6, -48, 8, 14).fill(0x222222);
  } else {
    const grey = year >= 1990 ? 0x4a5560 : 0x5c6670;
    b.roundRect(-110, -26, 190, 52, 18).fill(grey); // the boat-hulled fuselage
    b.poly([70, -22, 210, -10, 210, 4, 70, 20]).fill(grey);
    b.poly([196, -10, 218, -60, 230, -60, 214, 4]).fill(grey);
    b.roundRect(-110, 10, 190, 16, 8).fill({ color: 0x000000, alpha: 0.12 }); // the hull's lower side
    b.roundRect(-104, -18, 40, 22, 8).fill({ color: 0x9ab4c8, alpha: 0.65 });
    b.rect(-50, -10, 30, 22).fill({ color: 0x1a1d20, alpha: 0.85 }); // the open door, the crewman's hoist
    b.rect(-24, -24, 34, 6).fill(0x3a4048); // the hoist arm
    b.ellipse(-60, 26, 18, 7).fill(grey); // the sponsons
    b.ellipse(30, 26, 18, 7).fill(grey);
    b.rect(-4, -40, 30, 14).fill(0x3a4048); // the engines' cowl
    b.rect(8, -52, 6, 12).fill(0x222222);
    const navy = label('NAVY', 11, 0xf1ece0, { family: 'Arial, sans-serif', bold: true });
    navy.position.set(110, -2);
    c.addChild(navy);
  }
  const rotor = new Graphics().ellipse(0, 0, 170, 7).fill({ color: 0x1a1d20, alpha: 0.26 });
  rotor.position.set(year < 1965 ? -2 : 11, year < 1965 ? -50 : -54);
  const tail = new Graphics().circle(0, 0, 18).fill({ color: 0x1a1d20, alpha: 0.2 });
  tail.position.set(year < 1965 ? 218 : 224, year < 1965 ? -44 : -56);
  c.addChildAt(b, 0);
  c.addChild(rotor, tail);
  c.hook = year < 1965 ? [-14, 36] : [-26, -18];
  return c;
}

// The recovery ship, on the horizon or close: a destroyer for the early capsules, a carrier from 1962, the amphibious
// dock ship that takes Orion into her well deck, the offshore vessel that lifts Dragon aboard.
function recoveryShip(kind, year, x, y) {
  const s = new Graphics(),
    grey = 0x5d6670,
    dark = 0x4a525a,
    light = 0x7a838c;
  if (kind === 'orion') {
    s.poly([x - 260, y, x + 240, y, x + 220, y + 22, x - 240, y + 22]).fill(grey);
    s.rect(x - 200, y - 30, 280, 30).fill(light);
    s.poly([x - 40, y - 30, x + 60, y - 30, x + 40, y - 92, x - 20, y - 92]).fill(grey); // the enclosed mast
    s.rect(x - 160, y - 54, 110, 24).fill(light);
    for (let i = 0; i < 6; i++) s.rect(x - 150 + i * 16, y - 46, 8, 5).fill(0x2a3038);
    s.rect(x + 160, y - 8, 70, 8).fill(dark); // the stern gate down to the well deck
    return s;
  }
  if (kind === 'mercury' || year < 1962) {
    // A destroyer: low hull, raked bow, two stacks, the mast, a gun forward and aft.
    s.poly([x - 140, y - 4, x + 150, y - 10, x + 120, y + 16, x - 130, y + 16]).fill(grey);
    s.rect(x - 40, y - 26, 90, 20).fill(light);
    s.rect(x - 20, y - 46, 30, 20).fill(light);
    s.rect(x + 10, y - 40, 10, 18)
      .fill(dark)
      .rect(x + 30, y - 36, 10, 14)
      .fill(dark);
    s.rect(x - 8, y - 78, 3, 32)
      .fill(dark)
      .rect(x - 20, y - 68, 26, 2)
      .fill(dark);
    s.rect(x - 100, y - 14, 20, 8)
      .fill(dark)
      .rect(x + 80, y - 18, 20, 8)
      .fill(dark);
    s.rect(x - 92, y - 16, 22, 2).fill(dark);
    return s;
  }
  // A carrier: the flight deck overhanging the hull, the island with its stack and masts, aircraft on deck.
  s.poly([x - 230, y, x + 220, y, x + 200, y + 20, x - 210, y + 20]).fill(grey);
  s.rect(x - 250, y - 10, 500, 10).fill(light);
  s.rect(x - 250, y - 10, 500, 2).fill(0x9aa2aa);
  s.rect(x + 50, y - 52, 60, 42).fill(grey);
  s.rect(x + 56, y - 48, 48, 6).fill({ color: 0x2a3038, alpha: 0.8 });
  s.rect(x + 62, y - 66, 26, 14).fill(dark); // the stack
  s.rect(x + 92, y - 96, 4, 44)
    .fill(dark)
    .rect(x + 80, y - 86, 28, 2)
    .fill(dark); // the mast
  s.ellipse(x + 94, y - 98, 10, 3).fill(dark);
  for (const px of [-190, -130, -70, 150, 200]) {
    // helicopters and aircraft parked on deck, as small dark shapes
    s.roundRect(x + px, y - 16, 26, 6, 3).fill(dark);
    s.rect(x + px + 22, y - 18, 3, 8).fill(dark);
  }
  if (kind === 'apollo' && year >= 1968) {
    // the quarantine trailer on the hangar deck lift (Apollo 11 to 14), a bright box by the island
    s.rect(x - 20, y - 18, 30, 8).fill(0xd6d8d6);
  }
  return s;
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
  const year = yearOf(g);
  const sky = new Sprite(
    gradientTexture(
      runway
        ? [
            [0, '#5d8fbf'],
            [0.7, '#b9cbd6'],
            [1, '#ecdcb8'],
          ]
        : [
            [0, '#3f6f9e'],
            [0.65, '#9fbfd4'],
            [1, '#dfe7e6'],
          ],
    ),
  );
  sky.position.set(-800, -800);
  sky.width = W + 1600;
  sky.height = SEA + 800;
  // The sun, high and soft, and a few slow clouds.
  const sun = new Sprite(puffTexture());
  sun.anchor.set(0.5);
  sun.width = sun.height = 260;
  sun.alpha = 0.55;
  sun.tint = 0xfff4d8;
  sun.position.set(1000, 120);
  const sunDisc = new Graphics().circle(1000, 120, 26).fill({ color: 0xfffbea, alpha: 0.9 });
  const clouds = new Container();
  for (const [cx, cy, cw] of [
    [180, 150, 320],
    [620, 90, 260],
    [1320, 190, 380],
    [1700, 120, 300],
  ]) {
    for (let k = 0; k < 4; k++) {
      const p = new Sprite(puffTexture());
      p.anchor.set(0.5);
      p.width = cw * (0.5 + k * 0.15);
      p.height = cw * 0.22;
      p.position.set(cx + (k - 1.5) * cw * 0.22, cy - (k % 2) * 12);
      p.alpha = 0.7;
      clouds.addChild(p);
    }
  }
  const ground = new Graphics();
  let sea = null;
  if (runway) {
    // The lakebed or the Cape's runway: distant hills, the hard flat ground, the runway and its marks.
    ground
      .poly([
        -800,
        SEA,
        0,
        SEA - 22,
        260,
        SEA - 54,
        520,
        SEA - 26,
        820,
        SEA - 70,
        1100,
        SEA - 32,
        1400,
        SEA - 58,
        1800,
        SEA - 20,
        2400,
        SEA - 30,
        2400,
        SEA,
        -800,
        SEA,
      ])
      .fill(0x8f8a86);
    ground
      .poly([-800, SEA, 200, SEA - 14, 600, SEA - 6, 1000, SEA - 18, 1500, SEA - 8, 2400, SEA - 12, 2400, SEA])
      .fill(0xa49680);
    ground.rect(-800, SEA, W + 1600, H - SEA + 800).fill(0xcdb88e);
    for (let i = 0; i < 40; i++)
      ground.rect(-800 + ((i * 173) % 3200), SEA + 30 + ((i * 59) % 300), 60, 2).fill({ color: 0x9a8a6a, alpha: 0.35 });
    ground.rect(-800, SEA + 120, W + 1600, 150).fill(0x5a5a58);
    ground
      .rect(-800, SEA + 124, W + 1600, 3)
      .fill(0xe8e2d0)
      .rect(-800, SEA + 263, W + 1600, 3)
      .fill(0xe8e2d0);
    for (let x = -760; x < W + 800; x += 140) ground.rect(x, SEA + 192, 70, 6).fill(0xe8e2d0);
    for (let x = -800; x < W + 800; x += 37)
      ground.rect(x, SEA + 150 + ((x * 7) % 90), 30, 1.5).fill({ color: 0x2a2a2a, alpha: 0.25 }); // tyre marks
  } else {
    sea = new Sprite(
      gradientTexture([
        [0, '#6c9cb8'],
        [0.12, '#3f7596'],
        [1, '#14364e'],
      ]),
    );
    sea.position.set(-800, SEA);
    sea.width = W + 1600;
    sea.height = H - SEA + 800;
    // The haze along the horizon.
    ground.rect(-800, SEA - 14, W + 1600, 14).fill({ color: 0xe6eeee, alpha: 0.35 });
  }
  world.addChild(sky, sun, sunDisc, clouds);
  if (sea) world.addChild(sea);
  world.addChild(ground);

  // The swell: long slow bands of lighter crest and darker trough, closer and bigger toward you; and under the sun, a
  // path of glints that drift with the swell at a steady brightness.
  const swell = new Graphics();
  const glints = new Graphics();
  world.addChild(swell, glints);

  // ---- the recovery ship, the flag at half mast if they were lost ----
  const ship = new Container();
  const shipX = kind === 'dragon' ? 1100 : 1150;
  if (!runway) {
    if (kind === 'dragon') {
      // The recovery ship, close: her bridge forward, the flat after deck with the capsule lifted on to it, the crane.
      const d = new Graphics();
      d.poly([640, SEA + 40, 1540, SEA + 40, 1500, SEA + 130, 690, SEA + 130]).fill(0x2f3a46);
      d.rect(640, SEA + 34, 900, 8).fill(0xe8e6e0);
      d.rect(1330, SEA - 70, 170, 104).fill(0xeeece6);
      for (let i = 0; i < 6; i++) d.rect(1342 + i * 26, SEA - 56, 18, 12).fill(0x2a3a48);
      d.rect(1360, SEA - 92, 110, 22).fill(0xe2e0da);
      d.rect(1410, SEA - 128, 6, 36).fill(0x2a2d30);
      d.ellipse(1330, SEA - 72, 60, 6).fill({ color: 0x2a2d30, alpha: 0.6 }); // the helipad's edge
      d.rect(860, SEA - 150, 12, 190).fill(0xd8b040);
      d.moveTo(866, SEA - 150)
        .lineTo(1020, SEA - 86)
        .stroke({ width: 7, color: 0xd8b040 });
      d.moveTo(1020, SEA - 86)
        .lineTo(1010, SEA - 10)
        .stroke({ width: 1.5, color: 0x222222 });
      for (const px of [930, 1060, 1180]) sitter(d, px, SEA + 34, 0x2a3a5a, 1.2);
      ship.addChild(d);
    } else ship.addChild(recoveryShip(kind, year, shipX, SEA - 2));
  }
  const flag = new Graphics();
  world.addChild(ship, flag);

  // ---- the craft, the dye, the raft, the swimmers, the helicopter ----
  const dye = new Sprite(puffTexture());
  dye.anchor.set(0.5);
  dye.tint = 0x58c48a;
  dye.alpha = 0.5;
  dye.width = 560;
  dye.height = 100;
  dye.position.set(620, 646);
  const collar = kind === 'gemini' || kind === 'apollo';
  const craft = new Container();
  craft.position.set(620, 640);
  const raft = new Graphics();
  const heli = helicopter(year);
  const cable = new Graphics();
  heli.addChildAt(cable, 0);
  heli.position.set(660, 230);
  world.addChild(dye, raft, craft, heli);
  // Who sits in the raft: the swimmers in black, and the crew once out of the hatch (in their isolation garments on
  // the first three landings, July 1969 to April 1970).
  const crewColour = kind === 'apollo' && year >= 1969 && year <= 1970 ? 0x7c8a6a : 0x3a5a8a;
  const crewN = kind === 'apollo' ? 3 : kind === 'gemini' ? 2 : 0;

  if (!lost && !runway) {
    if (kind === 'dragon') {
      craft.addChild(capsule('dragon'));
      craft.position.set(1000, SEA + 40);
      craft.scale.set(0.9);
      dye.visible = false;
      heli.visible = false;
    } else craft.addChild(capsule(kind, collar));
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
    glints.clear();
    if (!runway) {
      for (let i = 0; i < 14; i++) {
        const k = i / 13,
          y = SEA + 8 + k * k * 440,
          len = 60 + k * 260,
          gap = 220 + k * 340,
          x = ((t * (4 + k * 14) + i * 170) % gap) - gap;
        for (let px = x; px < W + gap; px += gap) {
          swell.ellipse(px, y, len, 1 + k * 3).fill({ color: 0xb4d8e8, alpha: 0.07 + k * 0.08 });
          swell
            .ellipse(px + gap / 2, y + 3 + k * 5, len * 0.8, 1 + k * 4)
            .fill({ color: 0x0a2a3e, alpha: 0.1 + k * 0.1 });
        }
      }
      // The sun's path on the water: short glints, drifting, never brighter or dimmer.
      for (let i = 0; i < 40; i++) {
        const k = ((i * 37) % 40) / 40,
          y = SEA + 6 + k * k * 300,
          spread = 20 + k * 120,
          x = 1000 + Math.sin(i * 12.9 + t * 0.25) * spread;
        glints.rect(x, y, 6 + k * 18, 1 + k * 1.5).fill({ color: 0xfff6dc, alpha: 0.22 });
      }
    }

    // The capsule rides the swell; the raft beside her with the swimmers and the crew; the helicopter holds over the
    // raft with its hoist down (over Mercury, it takes the capsule herself).
    if (!runway && kind !== 'dragon') {
      craft.y = 640 + Math.sin(t * 0.9) * 6;
      craft.rotation = Math.sin(t * 0.7) * 0.05;
      const rx = 800,
        ry = 664 + Math.sin(t * 0.9 + 1) * 5;
      raft.clear();
      if (kind !== 'mercury' && kind !== 'orion' && !lost) {
        raft
          .ellipse(rx, ry, 84, 16)
          .fill(0xe0a030)
          .ellipse(rx, ry - 5, 66, 9)
          .fill(0xc88a20);
        for (let i = 0; i < 2 + crewN; i++)
          sitter(raft, rx - 52 + i * (104 / (1 + crewN)), ry - 4, i < 2 ? 0x16181a : crewColour, 1.1);
      }
      heli.y = 262 + Math.sin(t * 0.5) * 6;
      heli.x = kind === 'mercury' ? 700 : 840;
      const [hx, hy] = heli.hook;
      const toX = kind === 'mercury' ? craft.x - heli.x : rx - heli.x - 30,
        toY = kind === 'mercury' ? craft.y - 100 - heli.y : ry - 40 - heli.y;
      cable.clear().moveTo(hx, hy).lineTo(toX, toY).stroke({ width: 2, color: 0x222222, alpha: 0.75 });
      if (kind !== 'mercury') cable.roundRect(toX - 9, toY, 18, 22, 4).stroke({ width: 2, color: 0x2a2a2a }); // the rescue net
    }
    for (const v of world.convoy || []) v.x = Math.max(980 + (v.x - 1150) * 0.1, v.x - v.speed * dt);

    // The flag on the ship's mast: at half mast if the crew was lost.
    flag.clear();
    if (!runway && kind !== 'dragon') {
      const carrier = !(kind === 'mercury' || year < 1962) && kind !== 'orion';
      const mx = kind === 'orion' ? shipX + 10 : carrier ? shipX + 94 : shipX - 7,
        top = SEA - 2 - (kind === 'orion' ? 104 : carrier ? 104 : 86);
      flag.rect(mx, lost ? top + 16 : top, 20, 12).fill(0xb22234);
      flag.rect(mx, lost ? top + 16 : top, 8, 6).fill(0x3c3b6e);
      flag.rect(mx - 1, top, 1.5, 40).fill(0x2a2d30);
    }
  }

  const stale = () => false;
  return { root, update, stale };
}
