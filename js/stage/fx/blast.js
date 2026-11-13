// A ROCKET LOST ON THE PAD (v0.8 visual pass), as Vanguard TV-3 was in December 1957: she lifts a few feet, loses
// thrust, settles back and explodes. A white flash, the ground shaking, a fireball that boils up and turns to black
// smoke, a shockwave ring racing out over the sand, burning pieces thrown out on arcs, small fires on the ground, and a
// smoke column that hangs over the pad, thinning, for the rest of the day, over a scorched pad.
// state(g, dt, screen, s) is called each frame by the site scene with the game; the blast is g.flight.blast (game.js).
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../../data/white-sands.js';
import { puffTexture } from '../kit.js';
import { calm, swell } from './calm.js';
import { aftermath, blastAge, columnRate, landing } from './blast-time.js';

export const BLAST_SHAKE = 1.6; // seconds of shaking

function puffs() {
  const c = new Container();
  const live = [];
  c.add = (x, y, o) => {
    const s = new Sprite(puffTexture());
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = o.tint;
    s.alpha = o.alpha;
    s.scale.set(o.size);
    if (o.add) s.blendMode = 'add';
    c.addChild(s);
    live.push({ s, ...o, life: 0, a0: o.alpha });
  };
  c.update = dt => {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      const d = Math.exp(-(p.drag ?? 1) * dt);
      p.vx = p.vx * d + (p.wind ?? 0) * dt;
      p.vy = p.vy * d - (p.lift ?? 0) * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.scale.set(p.s.scale.x + p.grow * dt);
      const k = p.life / p.max;
      p.s.alpha = p.a0 * Math.max(0, 1 - k) ** 0.8;
      // A fireball darkens to smoke as it cools.
      if (p.cool) p.s.tint = cool(p.tint, Math.min(1, p.life / p.cool));
      if (p.life > p.max) {
        p.s.destroy();
        live.splice(i, 1);
      }
    }
  };
  c.count = () => live.length;
  return c;
}
function cool(tint, k) {
  const to = [0x2c, 0x26, 0x22];
  const ch = (s, t) => Math.round(((tint >> s) & 255) + (t - ((tint >> s) & 255)) * k);
  return (ch(16, to[0]) << 16) | (ch(8, to[1]) << 8) | ch(0, to[2]);
}

export function blastFx() {
  const scorch = new Graphics(); // on the ground, under everything else of hers
  const smoke = puffs(); // the black column and the cooled fireball
  const fire = puffs(); // the fireball's heat, additive
  const pieces = new Graphics();
  const ring = new Graphics();
  const flash = new Graphics();
  flash.blendMode = 'add';
  // The smoke hangs behind the people and the trucks going out to the pad (issue #250); the fire and pieces in front.
  const front = new Container();
  front.addChild(fire, pieces, ring);
  let seen = null,
    since = 0,
    debris = [],
    fires = [];

  function start(b, g) {
    seen = b;
    since = 0;
    const late = aftermath(b, g);
    const x = PLACES.tower.x + 25,
      y = GROUND - 30 - (b.rise || 0);
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8),
        sp = 120 + Math.random() * 320;
      debris.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        spin: (Math.random() - 0.5) * 14,
        r: Math.random() * 6,
        size: 2 + Math.random() * 5,
        burning: Math.random() < 0.5,
        down: false,
      });
    }
    // Come out to the site after it is over: the pieces lie where they fell, the fires are out, only smoke is left.
    if (late) {
      since = 60;
      for (const p of debris) {
        p.x = landing(p.x, p.y, p.vx, p.vy, GROUND + 4);
        p.y = GROUND + 4;
        p.down = true;
        p.burning = false;
      }
      fires = [];
      return;
    }
    fires = [...Array(6)].map(() => ({ x: x + (Math.random() - 0.5) * 220, life: 6 + Math.random() * 14 }));
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = 40 + Math.random() * 140;
      fire.add(x + Math.cos(a) * 10, y + Math.sin(a) * 10, {
        tint: [0xfff3c4, 0xffc455, 0xff8a2a][i % 3],
        alpha: 0.9,
        size: 0.6 + Math.random() * 0.8,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.7 - 30,
        grow: 1.6,
        drag: 2.2,
        lift: 20,
        max: 1.4 + Math.random() * 0.8,
        add: true,
      });
      smoke.add(x + Math.cos(a) * 8, y + Math.sin(a) * 8, {
        tint: 0xff9a40,
        alpha: 0.6,
        size: 0.5 + Math.random() * 0.6,
        vx: Math.cos(a) * sp * 0.6,
        vy: Math.sin(a) * sp * 0.4 - 40 - Math.random() * 40,
        grow: 1.1,
        drag: 0.9,
        lift: 30 + Math.random() * 30,
        cool: 1.2,
        wind: 4,
        max: 9 + Math.random() * 6,
      });
    }
  }

  // Returns the shake (screen px) for the frame.
  function state(g, dt, screen, s) {
    const b = g.flight?.blast;
    if (b && b !== seen) start(b, g);
    if (!b || b.day !== g.day) {
      if (seen && (!b || b.day !== g.day)) {
        seen = null;
        debris = [];
        fires = [];
      }
      scorch.clear();
      pieces.clear();
      ring.clear();
      flash.clear();
      smoke.update(dt);
      fire.update(dt);
      return { shakeX: 0, shakeY: 0 };
    }
    since += dt;
    const x = PLACES.tower.x + 25;
    // The scorch on the pad.
    scorch.clear();
    scorch.ellipse(x, GROUND + 3, 120, 9).fill({ color: 0x1a1612, alpha: Math.min(0.55, since * 2) });
    scorch.ellipse(x, GROUND + 2, 60, 5).fill({ color: 0x0c0a08, alpha: Math.min(0.6, since * 2) });
    // The flash: one soft, capped swell of light (photosensitivity: fx/calm.js), none in calm mode.
    flash.clear();
    const quiet = calm(),
      glow = quiet ? 0 : swell(since, 0.22, 0.08, 1.1);
    if (glow > 0.005) flash.rect(0, 0, screen.width, screen.height).fill({ color: 0xffe6c0, alpha: glow });
    // The shockwave: a ring racing out, and a skirt of dust thrown up along the ground with it.
    ring.clear();
    if (since < 0.9) {
      const r = 40 + since * 900;
      ring.ellipse(x, GROUND - 30, r, r * 0.55).stroke({ width: 3, color: 0xffffff, alpha: 0.5 * (1 - since / 0.9) });
      if (Math.random() < 0.9)
        for (const d of [-1, 1])
          smoke.add(x + d * r * 0.9, GROUND - 2, {
            tint: 0xcfc2a6,
            alpha: 0.5,
            size: 0.4,
            vx: d * 60,
            vy: -10,
            grow: 0.8,
            drag: 1.5,
            max: 3,
          });
    }
    // The pieces: thrown out on arcs, burning ones trailing smoke, lying where they fall.
    pieces.clear();
    for (const p of debris) {
      if (!p.down) {
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.spin * dt;
        if (p.y >= GROUND + 4) {
          p.y = GROUND + 4;
          p.down = true;
        }
        if (p.burning && Math.random() < 0.6)
          smoke.add(p.x, p.y, { tint: 0x4a423a, alpha: 0.25, size: 0.08, vx: 0, vy: -6, grow: 0.25, max: 2.5 });
      }
      const c = Math.cos(p.r),
        sn = Math.sin(p.r),
        h = p.size;
      pieces
        .poly([
          p.x - c * h + sn,
          p.y - sn * h - c,
          p.x + c * h + sn,
          p.y + sn * h - c,
          p.x + c * h - sn,
          p.y + sn * h + c,
          p.x - c * h - sn,
          p.y - sn * h + c,
        ])
        .fill(p.burning && since < 8 ? 0xffa040 : 0x2a2622);
    }
    // Fires on the ground, and the column of black smoke over the pad, thinning through the day.
    for (const f of fires) {
      f.life -= dt;
      if (f.life <= 0) continue;
      const fl = 6 + Math.sin(g.time * 13 + f.x) * 2;
      pieces
        .poly([f.x - 5, GROUND + 4, f.x, GROUND + 4 - fl * 1.6, f.x + 5, GROUND + 4])
        .fill({ color: 0xffa040, alpha: 0.85 });
      pieces
        .poly([f.x - 2.5, GROUND + 4, f.x, GROUND + 4 - fl, f.x + 2.5, GROUND + 4])
        .fill({ color: 0xfff0b0, alpha: 0.9 });
      if (Math.random() < 0.3)
        smoke.add(f.x, GROUND - 4, {
          tint: 0x3a342e,
          alpha: 0.45,
          size: 0.18,
          vx: 0,
          vy: -14,
          grow: 0.4,
          wind: 3,
          max: 5,
        });
    }
    const rate = columnRate(since, blastAge(b, g));
    if (smoke.count() < 260 && Math.random() < rate * dt * 3)
      smoke.add(x + (Math.random() - 0.5) * 40, GROUND - 10, {
        tint: 0x2c2723,
        alpha: aftermath(b, g) ? 0.3 : 0.55, // a thinner, greyer column once the fire is out
        size: 0.5 + Math.random() * 0.4,
        vx: 0,
        vy: -30 - Math.random() * 20,
        grow: 0.5,
        drag: 0.2,
        wind: 6,
        max: 16,
      });
    smoke.update(dt);
    fire.update(dt);
    // The shake.
    // The shake: a heavy rumble, a few times a second, dying away; none in calm mode.
    const a = since < BLAST_SHAKE && !quiet ? 6 * s * (1 - since / BLAST_SHAKE) ** 1.5 : 0;
    return { shakeX: a * Math.sin(g.time * 19), shakeY: a * Math.sin(g.time * 23 + 1) };
  }
  return { scorch, smoke, front, flash, state };
}
