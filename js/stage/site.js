// THE SITE, rebuilt in PixiJS (v0.8): White Sands or the Cape from the side. The sky with its sun and drifting clouds,
// the mountains in three parallax ranges (or, at the Cape, the Atlantic and a line of palmettos), the haze and the sand,
// the buildings cut away in the style of the walk-in rooms (site-art.js), the windsock, flag, beacon and truck
// (site-live.js), the flames, smoke and dust, and the people walking about with their speech bubbles are drawn here.
// The rockets (js/site/rockets.js), the load on the truck, the Mercury Control screens, job bars and the hover name
// come from the canvas drawing on a clear overlay. Clicks go through to the site canvas underneath, so walking and
// talking work as before.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Sprite, Texture } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { drawSiteMachinery, skyFor, SKY, VIEW_H, GROUND } from '../site/draw.js';
import { colorOf, speech, puffTexture, gradientTexture } from './kit.js';
import { buildSite, dropSite, siteKey } from './site-art.js';
import { siteLive } from './site-live.js';
import { launchFx, warmTint } from './fx/launch.js';

// How far the sky is drawn above the top of the frame (site units), for the camera's tilt after a launch.
const SKY_ABOVE = 240;

// One mountain range: the same ridge the canvas drew (peaks repeating every half-span), long enough to scroll.
const SPAN = 260;
function range(color, base, peaks, width) {
  const period = (SPAN / 2) * peaks.length;
  const pts = [];
  for (let x = 0, i = 0; x <= width + period + SPAN; x += SPAN / 2, i++) pts.push([x, base - peaks[i % peaks.length]]);
  const gr = new Graphics();
  gr.poly([0, GROUND, ...pts.flat(), pts.at(-1)[0], GROUND]).fill(color);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    if (by > ay)
      gr.poly([ax, ay, bx, by, bx, GROUND, ax + (bx - ax) * 0.45, GROUND]).fill({ color: 0x281e32, alpha: 0.13 });
    else gr.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 1.5, color: 0xfff5e1, alpha: 0.18 });
  }
  gr.period = period;
  return gr;
}

export function siteScene() {
  const g = game;
  const root = new Container();

  // ---- the backdrop, in site units (VIEW_H tall), scaled to the screen ----
  // Three depths, so the camera's tilt up after a launch moves the sky least and the ground most.
  const back = new Container();
  root.addChild(back);
  const backFar = new Container(),
    backMid = new Container(),
    backNear = new Container();
  back.addChild(backFar, backMid, backNear);
  const sky = new Sprite();
  const sun = new Graphics();
  const sunGlow = new Sprite(puffTexture());
  sunGlow.anchor.set(0.5);
  const clouds = new Graphics();
  backFar.addChild(sky, sunGlow, sun, clouds);
  const WIDE = 4000; // wider than any screen in site units
  const ranges = [
    [range(0x8d86a0, 380, [0, 60, 30, 120, 70, 150, 40, 90, 20], WIDE), 0.15],
    [range(0xa99a8c, 440, [10, 40, 25, 60, 15, 50, 35, 20, 45], WIDE), 0.3],
    [range(0xc6aa87, 490, [8, 28, 12, 35, 15, 32, 11, 23, 5], WIDE), 0.42],
  ];
  for (const [r] of ranges) backMid.addChild(r);
  // The Cape's horizon: the Atlantic, flat as a table, with glints that drift, and a green band with palmettos.
  const sea = new Sprite();
  const glints = new Graphics();
  const scrub = new Graphics();
  const palms = new Graphics();
  backMid.addChild(sea, glints, scrub, palms);
  const PALM_SPAN = 140;
  const haze = new Sprite();
  const sand = new Sprite();
  const sandEdge = new Graphics();
  backNear.addChild(haze, sand, sandEdge);

  // ---- the site itself, in world units, moved by the camera ----
  const world = new Container();
  root.addChild(world);
  const fore = new Sprite();
  world.addChild(fore);
  let site = null,
    siteAt = '';
  const live = siteLive();
  world.addChild(live.behind, live.fire);
  const people = new Graphics();
  world.addChild(people, live.truckLayer, live.dust, live.smoke);
  // The launch: its light on the site, the ground cloud and the trail (fx/launch.js).
  const fx = launchFx();
  world.addChild(fx.lightLayer, fx.front, fx.trail);
  // The machinery not yet rebuilt, drawn by the old code on a clear canvas the size of the screen.
  const liveCanvas = document.createElement('canvas');
  const liveCtx = liveCanvas.getContext('2d');
  let liveTex = null;
  // After dark, the windows, doorways and floodlights glow over the dimmed site.
  const lightLayer = new Container();
  root.addChild(lightLayer);
  const overlay = new Sprite();
  root.addChild(overlay);
  root.addChild(fx.flash);
  // Speech bubbles, in screen pixels so the words stay a readable size at any zoom.
  const bubbleLayer = new Container();
  root.addChild(bubbleLayer);
  const bubbles = new Map();
  const fade = new Graphics();
  root.addChild(fade);

  let skyKey = '',
    lastW = 0,
    lastH = 0;
  function update(dt, screen) {
    const s = screen.height / VIEW_H,
      vw = screen.width / s,
      camX = g.cam.x,
      t = g.time;
    const skyNow = skyFor(g.clock % 1440),
      dusk = skyNow === SKY.dusk,
      cape = g.site === 'cape';
    // The launch's shake and the camera's tilt up after her.
    const lf = fx.state(g, Math.min(0.1, dt), dusk, screen, s),
      tiltPx = lf.tilt * s;
    root.position.set(lf.shakeX, lf.shakeY);
    back.scale.set(s);
    backFar.y = lf.tilt * 0.3;
    backMid.y = lf.tilt * 0.6;
    backNear.y = lf.tilt;
    world.scale.set(s);
    world.position.set(-camX * s, tiltPx);

    // The sky, the sun, the haze and the sand: redrawn when the light or the screen changes.
    const key = `${skyNow[0]}|${Math.ceil(vw)}|${cape}`;
    if (key !== skyKey) {
      skyKey = key;
      const setGrad = (sp, stops, x, y, w, h) => {
        sp.texture?.destroy(true);
        sp.texture = gradientTexture(stops);
        sp.position.set(x, y);
        sp.width = w;
        sp.height = h;
      };
      // The sky reaches above the frame, deepening, for when the camera tilts up after a launch.
      const top = SKY_ABOVE / (SKY_ABOVE + GROUND),
        at = k => top + k * (1 - top);
      setGrad(
        sky,
        [
          [0, dusk ? '#16142a' : '#2c5791'],
          [at(0), skyNow[0]],
          [at(0.7), skyNow[1]],
          [1, skyNow[2]],
        ],
        0,
        -SKY_ABOVE,
        vw + 2,
        GROUND + SKY_ABOVE,
      );
      setGrad(
        haze,
        [
          [0, 'rgba(0,0,0,0)'],
          [1, skyNow[2]],
        ],
        0,
        340,
        vw + 2,
        GROUND - 340,
      );
      haze.alpha = 0.35;
      setGrad(
        sand,
        cape
          ? [
              [0, '#e4d8b4'],
              [0.55, '#d9caa0'],
              [1, '#c8b88d'],
            ]
          : [
              [0, '#d9c39a'],
              [0.55, '#d3b88c'],
              [1, '#bc9d73'],
            ],
        0,
        GROUND,
        vw + 2,
        VIEW_H - GROUND,
      );
      sandEdge
        .clear()
        .rect(0, GROUND, vw + 2, 5)
        .fill(cape ? 0xd3c597 : 0xcdb489);
      setGrad(
        fore,
        [
          [0, 'rgba(53,46,48,0)'],
          [1, dusk ? 'rgba(53,46,68,.38)' : 'rgba(75,57,40,.22)'],
        ],
        0,
        GROUND + 45,
        vw + 2,
        VIEW_H - GROUND - 45,
      );
      const sx = vw * 0.12,
        sy = dusk ? 400 : 90;
      sun
        .clear()
        .circle(sx, sy, dusk ? 18 : 14)
        .fill(dusk ? 0xffd29a : 0xfffbea);
      sunGlow.position.set(sx, sy);
      sunGlow.scale.set(dusk ? 5 : 3.8);
      sunGlow.tint = dusk ? 0xffbe78 : 0xfffceb;
      sunGlow.alpha = 0.4;
      for (const [r] of ranges) r.visible = !cape;
      for (const k of [sea, glints, scrub, palms]) k.visible = cape;
      if (cape) {
        setGrad(
          sea,
          [
            [0, '#61869a'],
            [0.55, '#436e88'],
            [1, '#385d72'],
          ],
          0,
          440,
          vw + 2,
          GROUND - 440,
        );
        scrub
          .clear()
          .rect(0, 488, vw + 2, GROUND - 488)
          .fill(0x5b7a3c)
          .rect(0, 488, vw + 2, 2)
          .fill({ color: 0x86a35a, alpha: 0.7 });
        palms.clear();
        for (let x = 0; x < vw + PALM_SPAN * 2; x += PALM_SPAN) {
          palms
            .moveTo(x, 492)
            .quadraticCurveTo(x + 4, 472, x + 2, 454)
            .stroke({ width: 2, color: 0x5a4a32 });
          for (const a of [-2.6, -2.1, -1.6, -1.1, -0.6])
            palms
              .moveTo(x + 2, 454)
              .quadraticCurveTo(
                x + 2 + Math.cos(a) * 10,
                454 + Math.sin(a) * 9,
                x + 2 + Math.cos(a) * 17,
                462 + Math.sin(a) * 9,
              )
              .stroke({ width: 3, color: 0x3f6a35, cap: 'round' });
        }
      }
    }
    if (cape) {
      palms.x = -((camX * 0.4) % PALM_SPAN);
      glints.clear();
      for (let x = ((((-camX * 0.2) % 70) + 70) % 70) - 70; x < vw; x += 70) {
        const k = Math.round(x + camX * 0.2);
        glints
          .rect(x, 452 + ((((k * 3) % 20) + 20) % 20), 26, 2)
          .fill({ color: 0xffffff, alpha: 0.25 + 0.08 * Math.sin(t + k) });
      }
    }
    // Clouds drift with the wind, and a little with the camera.
    const spanC = vw + 600,
      drift = (t * 2 + camX * 0.08) % spanC;
    clouds.clear();
    for (const [x0, y, w] of [
      [80, 120, 90],
      [520, 70, 130],
      [930, 160, 70],
      [1300, 100, 110],
      [1700, 140, 80],
    ]) {
      const x = ((((x0 - drift) % spanC) + spanC) % spanC) - 300;
      const col = { color: dusk ? 0xf0aa96 : 0xffffff, alpha: dusk ? 0.35 : 0.55 };
      clouds.ellipse(x + w * 0.5, y, w * 0.5, w * 0.16).fill(col);
      clouds.ellipse(x + w * 0.35, y - w * 0.1, w * 0.22, w * 0.14).fill(col);
      clouds.ellipse(x + w * 0.62, y - w * 0.12, w * 0.26, w * 0.17).fill(col);
    }
    for (const [r, k] of ranges) r.x = -((camX * k) % r.period);

    // The buildings and dressing, rebuilt only when the site changes (a new blockhouse, the move, the crewed years, an era).
    const sk = siteKey(g);
    if (sk !== siteAt) {
      siteAt = sk;
      if (site) dropSite(site);
      site = buildSite(g);
      world.addChildAt(site, 0);
      for (const l of lightLayer.removeChildren()) l.destroy();
      for (const [x, y, w, h, tint, alpha] of site.lights) {
        const l = new Sprite(puffTexture());
        l.anchor.set(0.5);
        l.position.set(x, y);
        l.width = w;
        l.height = h;
        l.tint = tint;
        l.blendMode = 'add';
        l.full = alpha;
        lightLayer.addChild(l);
      }
    }
    live.update(g, Math.min(0.1, dt));
    // Dusk: the site itself darkens toward the sky's colour, and the lights come on.
    // A launch's flame lights it up warm, most of all at night.
    const dim = warmTint(dusk ? 0xb4a6bf : 0xffffff, lf.glow, dusk);
    if (world.tint !== dim) world.tint = overlay.tint = dim;
    lightLayer.scale.set(s);
    lightLayer.position.set(-camX * s, tiltPx);
    for (const l of lightLayer.children) l.alpha = dusk ? l.full * (0.92 + 0.08 * Math.sin(t * 7 + l.x)) : 0;
    // The foreground darkens toward the bottom of the screen.
    fore.x = camX;

    // The people: legs that step while they walk, coat, head, hat, the sparks of work, the marker over you.
    people.clear();
    for (const p of Object.values(g.people)) {
      if (p.hidden) continue;
      const x = p.x,
        y = GROUND,
        walking = Math.abs(p.target - p.x) > 1,
        step = walking ? Math.sin(t * 12 + p.x * 0.05) * 4 : 0;
      people.ellipse(x, y + 1, 6, 2).fill({ color: 0x000000, alpha: 0.18 });
      people
        .moveTo(x, y - 12)
        .lineTo(x - step, y)
        .moveTo(x, y - 12)
        .lineTo(x + step, y)
        .stroke({ width: 2.4, color: 0x2b2620, cap: 'round' });
      people.roundRect(x - 4.5, y - 26, 9, 15, 2.5).fill(colorOf(p.color));
      people.circle(x, y - 30, 4.2).fill(0xe2b993);
      if (p.hat) people.roundRect(x - 5, y - 35, 10, 3, 1).fill(colorOf(p.hat));
      if (p.working && !walking)
        people
          .rect(x + 6 * (p.face || 1), y - 20 + Math.sin(t * 9) * 3, 2, 2)
          .fill(Math.sin(t * 20) > 0 ? 0xffe28a : 0xffffff);
      if (p.id === 'you') people.poly([x - 4, y - 44, x + 4, y - 44, x, y - 39]).fill(0xe8c66a);
    }

    // The machinery overlay, at the screen's own pixels.
    const dpr = window.devicePixelRatio || 1;
    if (screen.width !== lastW || screen.height !== lastH) {
      lastW = screen.width;
      lastH = screen.height;
      liveCanvas.width = Math.ceil(screen.width * dpr);
      liveCanvas.height = Math.ceil(screen.height * dpr);
      liveTex?.destroy(true);
      liveTex = Texture.from(liveCanvas);
      overlay.texture = liveTex;
      overlay.scale.set(1 / dpr);
    }
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    liveCtx.setTransform(s * dpr, 0, 0, s * dpr, -camX * s * dpr, tiltPx * dpr);
    drawSiteMachinery(liveCtx, g);
    liveTex.source.update();

    // Bubbles: over each speaker, stacked upward when two would overlap.
    const talking = Object.values(g.people)
      .filter(p => !p.hidden && p.bubble)
      .sort((a, b) => a.bubble.until - b.bubble.until);
    const seen = new Set(),
      placed = [];
    for (const p of talking) {
      seen.add(p.id);
      let b = bubbles.get(p.id);
      if (!b) {
        b = speech(260);
        b.scale.set(0.82);
        bubbleLayer.addChild(b);
        bubbles.set(p.id, b);
      }
      b.update(p.bubble);
      const bx = (p.x - camX) * s,
        w = b.width,
        h = b.height;
      let by = (GROUND - 42) * s + tiltPx;
      for (let moved = true, n = 0; moved && n < 8; n++) {
        moved = false;
        for (const r of placed)
          if (
            bx - w / 2 < r.x + r.w / 2 + 4 &&
            bx + w / 2 + 4 > r.x - r.w / 2 &&
            by - h < r.y + 4 &&
            by + 4 > r.y - r.h
          ) {
            by = r.y - r.h - 6;
            moved = true;
          }
      }
      placed.push({ x: bx, y: by, w, h });
      b.position.set(bx, by);
    }
    for (const [id, b] of bubbles)
      if (!seen.has(id)) {
        b.destroy({ children: true });
        bubbles.delete(id);
      }

    fade.clear();
    if (g.fade > 0) fade.rect(0, 0, screen.width, screen.height).fill({ color: 0x05080e, alpha: g.fade });
  }

  const stale = () => false;
  return { root, update, stale, passThrough: true };
}
// Every site: White Sands, the Cape, and the crewed years.
siteScene.accepts = () => true;
