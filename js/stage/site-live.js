// THE SITE'S MOVING DRESSING, drawn in PixiJS (v0.8): the windsock by the tower filling and sagging with the gusts,
// the flag between the office and the hangar, the beacon on the tower top that blinks after dark, and the truck in its
// era's paint with the recovery party riding it; the flame under the static stand and down the deflector, the launch
// flame and the smoke that boils out round the tower, and the dust behind the truck. Redrawn every frame in world
// units. The rocket itself, the load on the truck and the Mercury Control screens come from the canvas machinery layer.
import { Container, Graphics, Sprite } from '../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../data/white-sands.js';
import { eraOf, skyFor, SKY, flyingRise } from '../site/draw.js';
import { label, setText, particles, puffTexture } from './kit.js';

// The truck's paint by era: the services' olive drab, NASA white with a blue stripe from 1960, the Shuttle years' red.
const PAINT = {
  early: { body: 0x4d5b3a, cab: 0x56653f, frame: 0x37503f, ink: 0xe8e0c8, stripe: null },
  space: { body: 0xe3e1d9, cab: 0xeceae3, frame: 0x8a8f93, ink: 0x1f3a6e, stripe: 0x2b4a8a },
  apollo: { body: 0xe3e1d9, cab: 0xeceae3, frame: 0x8a8f93, ink: 0x1f3a6e, stripe: 0x2b4a8a },
  shuttle: { body: 0xf0efea, cab: 0xf6f5f0, frame: 0x8a8f93, ink: 0xb8352a, stripe: 0xb8352a },
};

// How wide each vehicle's tail is (half-width, in site units), so its flame and smoke are in proportion.
const TAIL = {
  wac: 4,
  aerobee: 4,
  v2: 7,
  bumper: 7,
  viking: 5,
  vanguard: 6,
  juno: 12,
  ranger: 15,
  redstone: 6,
  atlas: 15,
  titan: 14,
  saturn5: 22,
  saturnib: 18,
  shuttle: 26,
  sls: 28,
  dragon: 9,
};

// A flat flame from a nozzle at (x, y), pointing down: an orange body, a yellow core, a white heart and the shock diamonds.
function flameAt(gr, x, y, half, len, t) {
  const wob = Math.sin(t * 50) * half * 0.2 + Math.sin(t * 73) * half * 0.15;
  const tongue = (k, wk, color, alpha) =>
    gr
      .moveTo(x - half * wk, y)
      .quadraticCurveTo(x - half * wk * 1.25, y + len * k * 0.45, x + wob * k, y + len * k)
      .quadraticCurveTo(x + half * wk * 1.25, y + len * k * 0.45, x + half * wk, y)
      .closePath()
      .fill({ color, alpha });
  tongue(1, 1, 0xf07828, 0.85);
  tongue(0.72, 0.72, 0xffc450, 0.92);
  tongue(0.42, 0.42, 0xfff8dc, 0.97);
  for (let i = 1; i <= 3; i++) {
    const yy = y + len * 0.11 * i,
      r = half * (0.32 - i * 0.06);
    gr.poly([x, yy - r * 1.7, x + r, yy, x, yy + r * 1.7, x - r, yy]).fill({ color: 0xffffff, alpha: 0.7 });
  }
}

export function siteLive() {
  // The flames and their glow, added over the buildings; smoke and dust over everything near the ground.
  const fire = new Container();
  const glow = new Sprite(puffTexture());
  glow.anchor.set(0.5);
  glow.blendMode = 'add';
  glow.tint = 0xffa040;
  glow.alpha = 0;
  const plume = new Graphics();
  const smoke = particles();
  const dust = particles();
  fire.addChild(glow, plume);
  const behind = new Graphics(); // windsock, flag, beacon: behind the people
  const truckLayer = new Container(); // the truck: in front of them
  const truck = new Graphics();
  const door = label('', 8, 0xffffff, { family: 'Arial, sans-serif', bold: true });
  door.anchor.set(0, 0.5);
  door.resolution = 6;
  truckLayer.addChild(truck, door);

  // wind: the day's wind in km/h (fx/weather.js), which fills the windsock and sets the flag going.
  function update(g, dt, wind = 12) {
    const t = g.time;
    behind.clear();
    // The windsock: a striped cone on a pole.
    const wx = 1965,
      wy = GROUND - 70,
      steady = Math.min(1, 0.25 + wind / 28),
      fill = Math.max(0.15, Math.min(1, steady + 0.18 * Math.sin(t * (0.5 + wind * 0.03)) * Math.sin(t * 1.9)));
    behind.rect(wx - 1, wy, 2, 70).fill(0x7a7a7a);
    behind.circle(wx, wy, 1.6).fill(0x5a5a5a);
    for (let i = 0; i < 4; i++) {
      const a = i * 6 * fill,
        b = (i + 1) * 6 * fill,
        droop = (1 - fill) * 6,
        r1 = 4 - i * 0.6,
        r2 = 4 - (i + 1) * 0.6,
        d1 = (droop * i) / 4,
        d2 = (droop * (i + 1)) / 4;
      behind
        .poly([wx + a, wy + 4 - r1 + d1, wx + b, wy + 4 - r2 + d2, wx + b, wy + 4 + r2 + d2, wx + a, wy + 4 + r1 + d1])
        .fill(i % 2 ? 0xf2efe6 : 0xd9552b);
    }
    // The flag on its pole, rippling.
    const fx = 432,
      fy = GROUND - 104;
    behind.rect(fx - 1, fy - 2, 2, 106).fill(0xd8d4c8);
    behind.rect(fx, fy - 2, 1, 106).fill({ color: 0x281e14, alpha: 0.25 });
    behind.circle(fx, fy - 3, 2).fill(0xc9a74a);
    for (let i = 0; i < 12; i++) {
      const pace = 1.2 + wind * 0.09,
        wave = Math.sin(t * pace - i * 0.6) * i * (0.08 + Math.min(0.2, wind / 150)),
        light = 0.1 * Math.sin(t * pace - i * 0.6);
      for (let s = 0; s < 7; s++)
        behind.rect(fx + 1 + i * 2, fy + s * 2 + wave, 2, 2).fill(s % 2 ? 0xf2efe6 : 0xb0302c);
      if (i < 5) behind.rect(fx + 1 + i * 2, fy + wave, 2, 8).fill(0x2c3a6a);
      behind
        .rect(fx + 1 + i * 2, fy + wave, 2, 14)
        .fill({ color: light > 0 ? 0xffffff : 0x000000, alpha: Math.abs(light) });
    }
    // The tower-top beacon, which blinks after dark.
    const dusk = skyFor(g.clock % 1440) === SKY.dusk,
      tw = PLACES.tower,
      bx = tw.x + tw.w / 2,
      by = GROUND - tw.h - 4;
    if (dusk && Math.sin(t * 3) > 0) {
      behind.circle(bx, by, 7).fill({ color: 0xff3c28, alpha: 0.35 });
      behind.circle(bx, by, 2.5).fill(0xff5a3c);
    } else behind.circle(bx, by, 2.5).fill(0x7a2a22);

    // The truck: bed and cab, the stripe, the window with the crew behind it, three wheels, the service on the door.
    const x = g.truck.x,
      y = GROUND + 28,
      era = eraOf(g),
      paint = PAINT[era];
    truck.clear();
    truck.ellipse(x + 46, y + 1, 50, 3).fill({ color: 0x46341e, alpha: 0.22 });
    truck.rect(x, y - 30, 64, 22).fill(paint.body);
    truck.rect(x, y - 30, 64, 2).fill({ color: 0xffffff, alpha: 0.18 });
    truck.rect(x - 2, y - 32, 66, 3).fill(paint.frame); // the bed's top rail
    truck.roundRect(x + 64, y - 40, 26, 32, 3).fill(paint.cab);
    truck.rect(x + 86, y - 38, 4, 30).fill({ color: 0x281e14, alpha: 0.18 });
    truck.rect(x + 88, y - 16, 4, 6).fill(0x3a3a3a); // bumper
    truck.rect(x + 87, y - 22, 3, 3).fill(0xfff2c0); // headlamp
    if (paint.stripe) truck.rect(x, y - 13, 90, 3).fill(paint.stripe);
    truck.rect(x, y - 12, 64, 4).fill({ color: 0x000000, alpha: 0.2 });
    truck.rect(x + 71, y - 37, 14, 12).fill(paint.frame);
    truck.rect(x + 72, y - 36, 12, 10).fill(0x9fc0d0);
    truck.poly([x + 72, y - 36, x + 77, y - 36, x + 72, y - 30]).fill({ color: 0xffffff, alpha: 0.35 });
    if (g.truck.follow) {
      for (const px of [x + 75, x + 81]) {
        truck.circle(px, y - 31, 2.4).fill(0x2e3236);
        truck.rect(px - 2.5, y - 28.5, 5, 2.5).fill(0x2e3236);
      }
      truck.circle(x + 56, y - 41, 3.5).fill(0xe2b993);
      truck.rect(x + 52.5, y - 38, 7, 8).fill(0x5d6a78);
    }
    for (const wx of [x + 14, x + 44, x + 76]) {
      truck.circle(wx, y - 6, 7).fill(0x1e1e1e);
      truck.circle(wx, y - 6, 3).fill(0x8a8a8a);
      const a = -x / 7;
      truck.rect(wx + Math.cos(a) * 1.5 - 0.5, y - 6 + Math.sin(a) * 1.5 - 0.5, 1, 1).fill(0x3a3a3a);
    }
    setText(door, era !== 'early' ? 'NASA' : g.site === 'cape' ? 'U.S. NAVY' : 'U.S. ARMY');
    if (door.ink !== paint.ink) door.style.fill = door.ink = paint.ink;
    door.position.set(x + 8, y - 19);
  }
  // Fire, smoke and dust.
  function effects(g, dt) {
    const t = g.time;
    plume.clear();
    glow.alpha = 0;
    // The static stand: the flame runs down into the trench and turns east along the deflector, and the exhaust boils
    // out of the trench's far end.
    if (!g.crewed && g.standFlame > 0) {
      const p = g.standFlame,
        nx = PLACES.stand.x + 60,
        ny = GROUND - 40,
        floor = GROUND + 4,
        half = 5 * Math.min(1.6, (TAIL[g.vehicle] || 6) / 5);
      flameAt(plume, nx, ny, half, floor - ny, t);
      const reach = (34 + 30 * p) * (1 + 0.08 * Math.sin(t * 40));
      plume
        .poly([nx - 8, floor - 8, nx + reach * 0.6, floor - 6, nx + reach, floor + 4, nx - 6, floor + 2])
        .fill({ color: 0xffc060, alpha: 0.75 });
      glow.position.set(nx + 10, floor - 10);
      glow.scale.set(1.4 + 0.6 * p);
      glow.alpha = 0.55 * p;
      if (Math.random() < 0.8 * p)
        smoke.add(nx + 30 + Math.random() * 40, floor - 4, {
          tint: 0xbab1a2,
          alpha: 0.6,
          size: 0.35,
          vx: 28 + Math.random() * 30,
          vy: -18 - Math.random() * 22,
          grow: 0.55,
          fade: 0.17,
          life: 4,
        });
    }
    // The launch: the flame under her as she climbs, and the cloud boiling out round the tower's base while she is low.
    if (g.rocket.where === 'flying') {
      const rise = flyingRise(g),
        half = TAIL[g.vehicle] || 7,
        x = PLACES.tower.x + 25,
        y = GROUND - 8 - rise,
        len = half * (5 + Math.min(4, rise / 60)) * (1 + 0.06 * Math.sin(t * 37));
      // The flame stops at the pad and splashes out sideways along it.
      const floor = GROUND + 2,
        shown = Math.min(len, floor - y);
      flameAt(plume, x, y, half * 0.9, shown, t);
      if (shown < len) {
        const reach = (len - shown) * 0.8 + half;
        for (const d of [-1, 1])
          plume
            .poly([x, floor - half * 0.9, x + d * reach, floor - 3, x + d * reach * 0.8, floor + 3, x, floor + 2])
            .fill({ color: 0xffc060, alpha: 0.7 });
      }
      glow.position.set(x, y + len * 0.4);
      glow.scale.set(1.2 + half / 6);
      glow.alpha = 0.8 * Math.max(0, 1 - rise / 500);
      const low = Math.max(0, 1 - rise / 160);
      if (low > 0) {
        const n = 1 + Math.round(half / 6);
        for (let i = 0; i < n; i++)
          if (Math.random() < 0.9 * low) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            smoke.add(x + dir * (half + Math.random() * 20), GROUND - 4, {
              tint: 0xe7e2d6,
              alpha: 0.6,
              size: 0.25 + half / 50,
              vx: dir * (40 + Math.random() * 50 + half * 3),
              vy: -6 - Math.random() * 18,
              grow: 0.45 + half / 40,
              fade: 0.09,
              life: 7,
            });
          }
      }
      // A thin trail behind her once she is clear of the ground.
      if (rise > 30 && rise < 700 && Math.random() < 0.7)
        smoke.add(x + (Math.random() - 0.5) * half, y + len * 0.9, {
          tint: 0xefebe2,
          alpha: 0.5,
          size: 0.18 + half / 80,
          vx: 6,
          vy: 10,
          grow: 0.25,
          fade: 0.08,
          life: 6,
        });
    }
    // The truck's dust, kicked up behind whichever way she is going.
    if (g.truck.dust && Math.random() < 0.6) {
      const back = g.truck.target >= g.truck.x ? -1 : 1,
        bx = g.truck.x + (back < 0 ? 0 : 92);
      dust.add(bx + back * Math.random() * 8, GROUND + 24, {
        tint: 0xc8b089,
        alpha: 0.55,
        size: 0.15,
        vx: back * (10 + Math.random() * 20),
        vy: -8 - Math.random() * 10,
        grow: 0.4,
        fade: 0.3,
        life: 2,
      });
    }
    smoke.update(dt);
    dust.update(dt);
  }

  return {
    behind,
    truckLayer,
    fire,
    smoke,
    dust,
    update: (g, dt, wind) => {
      update(g, dt, wind);
      effects(g, dt);
    },
  };
}
