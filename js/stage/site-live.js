// THE SITE'S MOVING DRESSING, drawn in PixiJS (v0.8): the windsock by the tower filling and sagging with the gusts,
// the flag between the office and the hangar, the beacon on the tower top that blinks after dark, and the truck in its
// era's paint with the recovery party riding it. Redrawn every frame in world units. The rocket, its flame and smoke,
// the load on the truck and the Mercury Control screens still come from the old drawing's machinery layer.
import { Container, Graphics } from '../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../data/white-sands.js';
import { eraOf, skyFor, SKY } from '../site/draw.js';
import { label, setText } from './kit.js';

// The truck's paint by era: the services' olive drab, NASA white with a blue stripe from 1960, the Shuttle years' red.
const PAINT = {
  early: { body: 0x4d5b3a, cab: 0x56653f, frame: 0x37503f, ink: 0xe8e0c8, stripe: null },
  space: { body: 0xe3e1d9, cab: 0xeceae3, frame: 0x8a8f93, ink: 0x1f3a6e, stripe: 0x2b4a8a },
  apollo: { body: 0xe3e1d9, cab: 0xeceae3, frame: 0x8a8f93, ink: 0x1f3a6e, stripe: 0x2b4a8a },
  shuttle: { body: 0xf0efea, cab: 0xf6f5f0, frame: 0x8a8f93, ink: 0xb8352a, stripe: 0xb8352a },
};

export function siteLive() {
  const behind = new Graphics(); // windsock, flag, beacon: behind the people
  const truckLayer = new Container(); // the truck: in front of them
  const truck = new Graphics();
  const door = label('', 8, 0xffffff, { family: 'Arial, sans-serif', bold: true });
  door.anchor.set(0, 0.5);
  door.resolution = 6;
  truckLayer.addChild(truck, door);

  function update(g) {
    const t = g.time;
    behind.clear();
    // The windsock: a striped cone on a pole.
    const wx = 1965,
      wy = GROUND - 70,
      fill = 0.75 + 0.25 * Math.sin(t * 0.7) * Math.sin(t * 1.9);
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
      const wave = Math.sin(t * 3 - i * 0.6) * i * 0.18,
        light = 0.1 * Math.sin(t * 3 - i * 0.6);
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
  return { behind, truckLayer, update };
}
