// THE LAUNCH, made to feel big (v0.8 visual pass), on top of the flame and pad smoke in site-live.js:
// - a flash as she lights, brighter after dark and for the big vehicles;
// - the ground shaking, hardest in the first seconds and for the biggest engines, dying away as she climbs;
// - her light thrown over the whole site, warm orange, strongest at night;
// - the exhaust rolling out along the ground in great billows that swallow the buildings: dust at White Sands, and
//   steam off the water deluge for the big vehicles at the Cape;
// - the camera tilting up to follow her, the sky deepening as it looks higher, until she climbs out of the frame
//   trailing her smoke.
// state(g, dt) is called once a frame by the site scene and returns the shake and the camera's tilt; the scene moves
// its layers (and the canvas overlay with the rocket on it) by them.
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { PLACES, GROUND } from '../../data/white-sands.js';
import { flyingRise, yearOf } from '../../site/draw.js';
import { puffTexture } from '../kit.js';
import { calm, swell } from './calm.js';

// Half-width of each vehicle's tail in site units (as site-live.js), for the size of everything here.
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
export const tailOf = v => TAIL[v] || 7;

// How hard a vehicle shakes the ground, 0..1, by its size: a WAC Corporal barely, a Saturn V or SLS fully.
export const might = v => Math.min(1, Math.max(0.15, (tailOf(v) - 3) / 22));

// Where the camera looks while she climbs: how far up (site units) for a given rise. It holds on the pad as she
// clears the tower, then follows her up to a limit and lets her go out of the top of the frame.
export const TILT_MAX = 460;
export const tiltFor = rise => Math.max(0, Math.min(TILT_MAX, (rise - 140) * 0.8));

// Billows that roll out fast and slow down, rise a little, grow and fade: the ground cloud of a launch.
function billows() {
  const c = new Container();
  const live = [];
  c.add = (x, y, o) => {
    const s = new Sprite(puffTexture());
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = o.tint;
    s.alpha = o.alpha;
    s.scale.set(o.size);
    c.addChild(s);
    live.push({
      s,
      vx: o.vx,
      vy: o.vy,
      grow: o.grow,
      fade: o.fade,
      drag: o.drag ?? 1.2,
      life: 0,
      max: o.life,
      a0: o.alpha,
    });
  };
  c.update = dt => {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d - 3 * dt; // the warm cloud lifts slowly
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.scale.set(p.s.scale.x + p.grow * dt * Math.max(0.2, 1 - p.life / p.max));
      p.s.alpha = p.a0 * Math.max(0, 1 - p.life / p.max) ** 0.7;
      if (p.life > p.max) {
        p.s.destroy();
        live.splice(i, 1);
      }
    }
  };
  c.count = () => live.length;
  return c;
}

export function launchFx() {
  // In the world, over the buildings and the people: the ground cloud and the trail high up.
  const front = billows();
  const trail = billows();
  // In the world, additive: the plume's light on everything round the pad.
  const light = new Sprite(puffTexture());
  light.anchor.set(0.5);
  light.blendMode = 'add';
  light.tint = 0xff9a48;
  light.alpha = 0;
  const lightLayer = new Container();
  lightLayer.addChild(light);
  // On the screen, over everything: the ignition flash.
  const flash = new Graphics();
  flash.blendMode = 'add';

  let was = false,
    since = 0,
    tilt = 0,
    trailAt = 0,
    phase = [Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9];

  // dusk: whether it is dark. Returns { shakeX, shakeY (screen px), tilt (site units), glow (0..1) }.
  function state(g, dt, dusk, screen, s) {
    const flying = g.rocket.where === 'flying',
      rise = flyingRise(g),
      v = g.vehicle,
      half = tailOf(v),
      m = might(v);
    if (flying && !was) {
      since = 0;
      phase = phase.map(() => Math.random() * 9);
    }
    was = flying;
    if (flying) since += dt;

    // The camera tilts up after her, and settles back down once she is gone.
    const want = flying ? tiltFor(rise) : 0;
    tilt += (want - tilt) * Math.min(1, dt * (flying ? 2.6 : 1.4));
    if (!flying && tilt < 0.5) tilt = 0;

    // The shake: builds over the first half second, dies away as she climbs.
    let shakeX = 0,
      shakeY = 0;
    const quiet = calm();
    if (flying && !quiet) {
      const build = Math.min(1, since / 0.6),
        fall = Math.max(0, 1 - rise / 700),
        a = (1 + 4 * m) * build * fall * s;
      const t = g.time;
      // A rumble, not a buzz: a few shakes a second.
      shakeX = a * (Math.sin(t * 17 + phase[0]) * 0.6 + Math.sin(t * 26 + phase[1]) * 0.4);
      shakeY = a * (Math.sin(t * 21 + phase[2]) * 0.6 + Math.sin(t * 29 + phase[3]) * 0.4);
    }

    // The ignition: one soft swell of light, capped and smoothed (fx/calm.js), never a white pop.
    flash.clear();
    if (flying && !quiet) {
      const k = swell(since, (0.08 + 0.12 * m) * (dusk ? 1.6 : 1), 0.15, 0.9);
      if (k > 0.005) flash.rect(0, 0, screen.width, screen.height).fill({ color: 0xffe2b0, alpha: k });
    }

    // The plume's light, following the flame up.
    const x = PLACES.tower.x + 25,
      y = GROUND - 8 - rise + half * 4;
    const glow = flying ? Math.min(1, since / 0.25) * Math.max(0, 1 - rise / 900) : 0;
    light.position.set(x, Math.min(GROUND, y));
    light.width = light.height = 500 + 1600 * m;
    light.alpha = glow * (dusk ? 0.75 : 0.32);

    // The ground cloud while she is low, rolling both ways along the ground.
    if (flying && rise < 260) {
      const cape = g.site === 'cape',
        steam = cape && yearOf(g) >= 1960 && half >= 12;
      const tint = steam ? 0xf2f0ea : cape ? 0xe4ddcc : 0xd8c6a2;
      const n = Math.round((1 + 5 * m) * Math.max(0.3, 1 - rise / 260));
      for (let i = 0; i < n; i++) {
        if (front.count() > 260) break;
        const dir = Math.random() < 0.5 ? -1 : 1,
          speed = (120 + Math.random() * 180) * (0.5 + m);
        front.add(x + dir * (half + Math.random() * half * 2), GROUND - 2 - Math.random() * 10, {
          tint,
          alpha: 0.55 + Math.random() * 0.2,
          size: 0.4 + m * 0.9 + Math.random() * 0.4,
          vx: dir * speed,
          vy: -Math.random() * 14,
          grow: 0.7 + m * 1.4,
          drag: 0.9,
          life: 6 + Math.random() * 5 + m * 5,
        });
      }
    }
    // The trail high up, where the camera follows her.
    // Puffs are laid every few units along the path flown since the last frame, so the trail is unbroken however fast
    // she goes or however slowly the frame drew.
    if (!flying) trailAt = 0;
    const from = Math.max(trailAt, 200, rise - 900);
    if (flying && rise > 200 && rise < 4000) trailAt = rise;
    for (let r = from; flying && r < Math.min(rise, 4000) && trail.count() < 320; r += 6 + half * 0.6) {
      const ty = GROUND - 8 - r + half * 6;
      trail.add(x + (Math.random() - 0.5) * half, ty, {
        tint: 0xf0ece4,
        alpha: 0.45,
        size: 0.2 + m * 0.5,
        vx: 4 + Math.random() * 6,
        vy: 0,
        grow: 0.35 + m * 0.6,
        drag: 0.5,
        life: 5 + m * 4,
      });
    }
    front.update(dt);
    trail.update(dt);
    return { shakeX, shakeY, tilt, glow };
  }

  return { front, trail, lightLayer, flash, state };
}

// The site's own tint warmed by the plume's light: base (white by day, the dusk blue at night) toward the flame's
// orange, by glow (0..1) and how dark it is.
export function warmTint(base, glow, dusk) {
  if (glow <= 0) return base;
  const k = glow * (dusk ? 0.7 : 0.18),
    to = [0xff, 0xd2, 0x98];
  const r = (base >> 16) & 255,
    gr = (base >> 8) & 255,
    b = base & 255;
  const mixc = (a, c) => Math.round(a + (c - a) * k);
  return (mixc(r, to[0]) << 16) | (mixc(gr, to[1]) << 8) | mixc(b, to[2]);
}
