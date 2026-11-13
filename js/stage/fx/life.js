// THE SITE ALIVE (v0.8 visual pass): small motion that makes the place feel lived in.
// - A fuelled rocket on the pad breathes: liquid oxygen boils off and white vapour spills from her vents and rolls
//   down her side, drifting with the wind (not the WAC Corporal or Aerobee, which burned acid and aniline, nor the
//   Titan II, whose propellants stored at room temperature).
// - Birds cross the sky now and then by day: gulls at the Cape, ravens over the desert.
// - At the Cape the surf breaks along the shore and the swell rolls in, livelier when the wind is up.
// The windsock and flag answer the day's wind in site-live.js.
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../../data/white-sands.js';
import { puffTexture } from '../kit.js';

// Which vehicles carry liquid oxygen, and their height on the pad in site units (for where the vents are).
const LOX_HEIGHT = {
  v2: 120,
  bumper: 150,
  viking: 140,
  vanguard: 130,
  juno: 140,
  ranger: 220,
  redstone: 150,
  atlas: 200,
  saturnib: 300,
  saturn5: 400,
  shuttle: 330,
  sls: 400,
  dragon: 260,
};
export const breathes = v => v in LOX_HEIGHT;
// How tall she stands on the pad (site units), for the fuelled vehicles; 0 for the rest.
export const padHeight = v => LOX_HEIGHT[v] || 0;

export function siteLife() {
  const vapour = new Container(); // world units
  const live = [];
  const birds = new Graphics(); // far backdrop units
  const surf = new Graphics(); // mid backdrop units (the Cape's sea)
  let flock = null,
    nextFlock = 3;

  function update(g, dt, { vw, camX, wind, night, fuelled, t }) {
    // Vapour off a fuelled rocket.
    const h = LOX_HEIGHT[g.vehicle];
    if (fuelled && h && g.rocket.where === 'tower' && live.length < 120) {
      const x = PLACES.tower.x + 25,
        drift = Math.max(4, wind * 0.6);
      for (const k of [0.38, 0.72])
        if (Math.random() < 6 * dt) {
          const s = new Sprite(puffTexture());
          s.anchor.set(0.5);
          s.tint = 0xf6f8fa;
          s.alpha = 0;
          s.scale.set(0.18 + h / 2000);
          s.position.set(x + 6 + Math.random() * 4, GROUND - 8 - h * k);
          vapour.addChild(s);
          live.push({
            s,
            vx: drift * (0.6 + Math.random() * 0.6),
            vy: 6 + Math.random() * 6,
            life: 0,
            max: 3 + Math.random() * 2,
          });
        }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt; // cold vapour sinks
      p.s.scale.set(p.s.scale.x + 0.35 * dt);
      const k = p.life / p.max;
      p.s.alpha = 0.5 * Math.min(1, k * 4) * (1 - k);
      if (p.life > p.max) {
        p.s.destroy();
        live.splice(i, 1);
      }
    }

    // Birds: a loose flock crossing the sky every minute or so by day, wings beating slowly.
    birds.clear();
    nextFlock -= dt;
    if (!flock && nextFlock <= 0 && night < 0.3) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      flock = {
        dir,
        x: dir > 0 ? -60 : vw + 60,
        y: 110 + Math.random() * 120,
        speed: 28 + Math.random() * 14,
        members: [...Array(4 + Math.floor(Math.random() * 6))].map((_, i) => ({
          dx: -dir * (i * 14 + Math.random() * 10),
          dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 6 + Math.random() * 4,
          phase: Math.random() * 6,
        })),
      };
    }
    if (flock) {
      flock.x += flock.dir * flock.speed * dt;
      const cape = g.site === 'cape',
        ink = cape ? 0xf2f2ee : 0x2a2622;
      for (const b of flock.members) {
        const bx = flock.x + b.dx,
          by = flock.y + b.dy + Math.sin(t * 0.8 + b.phase) * 3,
          flap = Math.sin(t * 5 + b.phase) * 3; // about one beat a second
        birds
          .moveTo(bx - 5, by - flap)
          .lineTo(bx, by)
          .lineTo(bx + 5, by - flap)
          .stroke({ width: 1.4, color: ink, alpha: 0.85 });
      }
      if (flock.x < -300 || flock.x > vw + 300) {
        flock = null;
        nextFlock = 40 + Math.random() * 50;
      }
    }

    // The Cape's sea: swell lines rolling toward the shore and the surf along it.
    surf.clear();
    if (g.site === 'cape') {
      const rough = Math.min(1, wind / 35);
      for (let r = 0; r < 4; r++) {
        const y = 446 + r * 10 + ((t * (3 + rough * 4)) % 10);
        const alpha = ((0.08 + 0.12 * rough) * (y - 440)) / 48;
        for (let x = (-(camX * 0.4) % 90) - 90; x < vw + 90; x += 90)
          surf.rect(x + ((r * 37) % 60), y, 34 + rough * 20, 1.2).fill({ color: 0xffffff, alpha });
      }
      // Surf: a broken white line along the beach, pulsing gently as the waves come in.
      const surge = 0.5 + 0.5 * Math.sin(t * 0.7);
      for (let x = (-(camX * 0.4) % 24) - 24; x < vw + 24; x += 24)
        surf
          .rect(x, 484 - surge * 1.5, 16 + 6 * Math.sin(x * 0.3 + t), 2.5)
          .fill({ color: 0xffffff, alpha: 0.5 + 0.3 * rough });
    }
  }
  return { vapour, birds, surf, update };
}
