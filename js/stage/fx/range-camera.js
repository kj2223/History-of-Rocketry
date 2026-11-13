// THE RANGE'S TRACKING CAMERA (v0.8 visual pass, failures you can see): a long-lens camera on its mount following the
// round up, inset in the corner of the range plot, as the ranges filmed every round. A good round climbs away on its
// flame and shrinks into the sky until burnout and out of sight. When something goes wrong the camera shows what the
// loop is shouting about (game.js flightTrouble):
//  - 'break': she comes apart in a cloud that boils and cools, the pieces falling out of it trailing smoke;
//  - 'tumble': she rolls off her line, the flame wandering, and the trail curls after her;
//  - 'cut' and 'loose': the flame dies, she coasts, slows, and noses over.
// The cloud's light is one capped swell (fx/calm.js), never repeated; calm mode keeps the cloud and drops the glow.
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { puffTexture, label, setText } from '../kit.js';
import { calm, swell } from './calm.js';
import { makeTrail, stepTrail } from './trail.js';
import { weatherLook, weatherBelow } from './weather-day.js';

const W = 320,
  H = 210;

export function rangeCamera() {
  const root = new Container();
  const frame = new Graphics();
  const view = new Container();
  const mask = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  view.mask = mask;
  const sky = new Graphics();
  const trail = new Container();
  const rocket = new Container();
  const body = new Graphics();
  const flame = new Sprite(puffTexture());
  flame.anchor.set(0.5, 0.1);
  flame.tint = 0xffc070;
  flame.blendMode = 'add';
  rocket.addChild(flame, body);
  const cloud = new Container();
  const glow = new Sprite(puffTexture());
  glow.anchor.set(0.5);
  glow.tint = 0xffd8a0;
  glow.blendMode = 'add';
  glow.alpha = 0;
  const pieces = new Graphics();
  const rain = new Graphics();
  view.addChild(sky, trail, cloud, pieces, rocket, glow, rain);
  const caption = label('TRACKING CAMERA', 11, 0x9fdcb0, { ax: 0, ay: 0, spacing: 1 });
  caption.position.set(6, H + 4);
  root.addChild(view, mask, frame, caption);
  frame
    .rect(-4, -4, W + 8, H + 8)
    .stroke({ width: 3, color: 0x2a3330 })
    .rect(0, 0, W, H)
    .stroke({ width: 1, color: 0x55625a });

  let striped = false,
    drawn = false,
    smoke = makeTrail(),
    bits = [],
    lastT = 0,
    gone = false;

  function drawBody(v) {
    striped = v === 'v2' || v === 'bumper';
    body.clear();
    // A slim round seen side on, nose up: the V-2's black and white quarters, the others white with a dark nose.
    body.rect(-5, -46, 10, 46).fill(0xeeeeea);
    if (striped) body.rect(-5, -46, 5, 23).fill(0x1a1a1a).rect(0, -23, 5, 23).fill(0x1a1a1a);
    body.poly([-5, -46, 5, -46, 0, -60]).fill(0x2a2a2a);
    body.poly([-5, -8, -11, 2, -5, 0]).fill(0x5a5a5a).poly([5, -8, 11, 2, 5, 0]).fill(0x5a5a5a);
    if (v === 'bumper') body.rect(-3, -74, 6, 14).fill(0xd8d8d2).poly([-3, -74, 3, -74, 0, -82]).fill(0x2a2a2a);
  }

  let rainClock = 0;
  // f: the flight; trouble: flightTrouble(g) or null; v: the vehicle; dt: real seconds; wx: the day's weather (weatherNow).
  root.update = (f, trouble, v, dt, wx = null) => {
    if (!drawn) {
      drawn = true;
      drawBody(v);
    }
    const t = f.t,
      burn = f.result.burn ?? 60;
    const at = trouble ? trouble.at : Infinity;
    const p = f.result.path[Math.min(f.result.path.length - 1, Math.floor(t))];
    // The sky darkens as she climbs; the camera's view of her shrinks with the distance.
    const dark = Math.min(1, p.h / 120);
    // The day's weather (issue #249): grey sky, rain, fog or dust while she is low, clear once she is through the cloud.
    const L = weatherLook(wx ? weatherBelow(wx, 1 - p.h / 4) : { overcast: 0, cloud: 0, rain: 0, fog: 0, dust: 0 });
    let skyCol = mix(0x8fb4d4, 0x101a2c, dark);
    skyCol = mix(skyCol, 0x7a8088, L.grey * 0.7);
    if (L.dust > 0) skyCol = mix(skyCol, 0xc4aa80, L.dust * 0.45);
    if (L.fog > 0) skyCol = mix(skyCol, 0xdee2e4, L.fog * 0.7);
    sky
      .clear()
      .rect(0, 0, W, H)
      .fill(skyCol)
      .rect(0, H * 0.6, W, H * 0.4)
      .fill({ color: 0xffffff, alpha: 0.08 * (1 - dark) });
    rainClock += dt;
    rain.clear();
    if (L.rain > 0.02) {
      const n = Math.round(30 + 60 * L.rain),
        len = 16;
      for (let i = 0; i < n; i++) {
        const sx = (i * 0.618034 * W * 3) % W,
          sy = ((((i * 0.37) % 1) * H + rainClock * H * 0.9) % (H + len)) - len;
        rain.moveTo(sx, sy).lineTo(sx - len * L.slant, sy + len);
      }
      rain.stroke({ width: 1, color: 0xd2d8e0, alpha: 0.45 * L.rain });
    }
    const k = Math.max(0.12, 1 / (1 + p.h / 6));
    rocket.scale.set(k * 1.4);
    const cx = W / 2,
      cy = H * 0.55;

    // Before the trouble: she climbs on her flame, the trail streaming down the frame.
    const since = t - at;
    const burning = t < Math.min(burn, at) && !gone;
    flame.visible = !gone;
    flame.alpha = burning ? 0.9 : Math.max(0, flame.alpha - dt * 1.2);
    flame.scale.set(0.55, burning ? 1.1 + 0.08 * Math.sin(t * 9) : flame.scale.y * 0.97);
    flame.position.set(0, 0);
    // A tumble rolls her off her line; a cut or a loose round noses over as she slows.
    let rot = 0;
    if (trouble && since > 0) {
      if (trouble.kind === 'tumble') rot = Math.min(6, since * 0.9);
      else if (trouble.kind !== 'break') rot = Math.min(Math.PI * 0.9, Math.max(0, since - 3) * 0.12);
    }
    rocket.rotation = rot;
    rocket.position.set(cx + (trouble?.kind === 'tumble' && since > 0 ? Math.sin(since * 0.7) * 30 : 0), cy);

    // The trail: smoke left behind as she goes, streaming down the frame as the camera follows her up (fx/trail.js
    // keeps it joined to her flame; issue #246). Every puff moves together, so the column stays even.
    const step = Math.max(0, t - lastT);
    lastT = t;
    const size = 0.25 * k * 3;
    stepTrail(smoke, {
      burning,
      nx: rocket.x - Math.sin(rot) * 40 * k,
      ny: rocket.y + Math.cos(rot) * 20 * k,
      size,
      spacing: size * 64 * 0.3,
      drift: (26 + 40 * k) * Math.min(step, 0.5) * 0.5,
      dt,
      alpha: 0.55 * (1 - dark * 0.6),
      bottom: H + 40,
    });
    const tint = striped ? 0xd8d0c0 : 0xe8e4dc;
    while (trail.children.length < smoke.puffs.length) {
      const s = new Sprite(puffTexture());
      s.anchor.set(0.5);
      trail.addChild(s);
    }
    trail.children.forEach((s, i) => {
      const q = smoke.puffs[i];
      s.visible = !!q;
      if (!q) return;
      s.tint = tint;
      s.position.set(q.x, q.y);
      s.scale.set(q.size);
      s.alpha = q.alpha;
    });

    // She comes apart: the rocket goes, a cloud boils up where she was, pieces fall out of it trailing smoke.
    if (trouble?.kind === 'break' && since >= 0 && !gone) {
      gone = true;
      rocket.visible = false;
      for (let i = 0; i < 9; i++) {
        const s = new Sprite(puffTexture());
        s.anchor.set(0.5);
        s.position.set(cx + (i - 4) * 4, cy - 20 * k);
        s.tint = 0xff9a50;
        s.alpha = 0.8;
        s.scale.set(0.3);
        cloud.addChild(s);
      }
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.45;
        bits.push({
          x: cx,
          y: cy - 20 * k,
          vx: Math.cos(a) * (30 + i * 6),
          vy: Math.sin(a) * (30 + (i % 3) * 10),
          trail: [],
        });
      }
    }
    if (gone) {
      const real = Math.max(0, since / 5); // the plot runs at five flight seconds to the real one
      cloud.children.forEach((s, i) => {
        s.scale.set(0.3 + Math.min(2.2, real * 0.9) * (0.8 + (i % 3) * 0.15));
        s.x += (i - 4) * dt * 6;
        s.y -= dt * 4;
        // Orange heat cooling to grey smoke, thinning slowly.
        s.tint = mix(0xff9a50, 0x6a6560, Math.min(1, real / 1.5));
        s.alpha = Math.max(0.15, 0.8 - real * 0.12);
      });
      pieces.clear();
      for (const b of bits) {
        b.vy += 40 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.trail.push([b.x, b.y]);
        if (b.trail.length > 24) b.trail.shift();
        for (let j = 1; j < b.trail.length; j++)
          pieces
            .moveTo(b.trail[j - 1][0], b.trail[j - 1][1])
            .lineTo(b.trail[j][0], b.trail[j][1])
            .stroke({ width: 3, color: 0x3a3632, alpha: (j / b.trail.length) * 0.5 });
        pieces.circle(b.x, b.y, 2.5).fill(0xffb060);
      }
      // One soft brightening as she goes, capped; none in calm mode.
      glow.position.set(cx, cy - 20 * k);
      glow.scale.set(3);
      glow.alpha = calm() ? 0 : swell(real, 0.5, 0.15, 1.2) * 3;
    }

    setText(
      caption,
      gone
        ? 'TRACKING CAMERA · SHE HAS BROKEN UP'
        : trouble && since > 0
          ? trouble.kind === 'tumble'
            ? 'TRACKING CAMERA · TUMBLING'
            : trouble.rso
              ? 'TRACKING CAMERA · RANGE SAFETY CUT HER ENGINE'
              : trouble.kind === 'loose'
                ? 'TRACKING CAMERA · CUTOFF SENT'
                : 'TRACKING CAMERA · THRUST GONE'
          : p.h > 90
            ? 'TRACKING CAMERA · OUT OF SIGHT'
            : 'TRACKING CAMERA',
    );
    rocket.alpha = p.h > 90 ? Math.max(0, 1 - (p.h - 90) / 20) : 1;
  };
  root.W = W;
  root.H = H;
  return root;
}

function mix(a, b, k) {
  const ch = (c, s) => (c >> s) & 255;
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
