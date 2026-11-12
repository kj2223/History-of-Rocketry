// THE SITE, rebuilt in PixiJS (v0.8), first pass: White Sands from the side. The sky with its sun and drifting
// clouds, the mountains in three parallax ranges, the haze and the sand, and the people walking about with their
// speech bubbles are drawn here. The buildings come from the old canvas drawing as one baked texture, and the moving
// machinery (the rocket, the truck, the rack, smoke, job bars, the hover name) from the old drawing on a clear overlay,
// until each is rebuilt. Clicks go through to the site canvas underneath, so walking and talking work as before.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { Container, Graphics, Sprite, Texture } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { bakedSite, drawSiteLive, skyFor, SKY, VIEW_H, GROUND, WORLD_W } from '../site/draw.js';
import { colorOf, speech, puffTexture, gradientTexture } from './kit.js';

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
  const back = new Container();
  root.addChild(back);
  const sky = new Sprite();
  const sun = new Graphics();
  const sunGlow = new Sprite(puffTexture());
  sunGlow.anchor.set(0.5);
  const clouds = new Graphics();
  back.addChild(sky, sunGlow, sun, clouds);
  const WIDE = 4000; // wider than any screen in site units
  const ranges = [
    [range(0x8d86a0, 380, [0, 60, 30, 120, 70, 150, 40, 90, 20], WIDE), 0.15],
    [range(0xa99a8c, 440, [10, 40, 25, 60, 15, 50, 35, 20, 45], WIDE), 0.3],
    [range(0xc6aa87, 490, [8, 28, 12, 35, 15, 32, 11, 23, 5], WIDE), 0.42],
  ];
  for (const [r] of ranges) back.addChild(r);
  const haze = new Sprite();
  const sand = new Sprite();
  const sandEdge = new Graphics();
  back.addChild(haze, sand, sandEdge);

  // ---- the site itself, in world units, moved by the camera ----
  const world = new Container();
  root.addChild(world);
  const buildings = new Sprite();
  world.addChild(buildings);
  const fore = new Sprite();
  world.addChild(fore);
  const people = new Graphics();
  world.addChild(people);
  // The machinery not yet rebuilt, drawn by the old code on a clear canvas the size of the screen.
  const liveCanvas = document.createElement('canvas');
  const liveCtx = liveCanvas.getContext('2d');
  let liveTex = null;
  const live = new Sprite();
  root.addChild(live);
  // Speech bubbles, in screen pixels so the words stay a readable size at any zoom.
  const bubbleLayer = new Container();
  root.addChild(bubbleLayer);
  const bubbles = new Map();
  const fade = new Graphics();
  root.addChild(fade);

  let bakedKey = '',
    skyKey = '',
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
    back.scale.set(s);
    world.scale.set(s);
    world.position.set(-camX * s, 0);

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
      setGrad(
        sky,
        [
          [0, skyNow[0]],
          [0.7, skyNow[1]],
          [1, skyNow[2]],
        ],
        0,
        0,
        vw + 2,
        GROUND,
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

    // The buildings: the baked layer, rebaked only when the site changes (a new blockhouse, the move, an era).
    const baked = bakedSite(g, s * (window.devicePixelRatio || 1));
    if (baked.key !== bakedKey) {
      bakedKey = baked.key;
      buildings.texture?.destroy(true);
      buildings.texture = Texture.from(baked.canvas);
      buildings.width = WORLD_W + 400;
      buildings.height = VIEW_H;
    }
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
      live.texture = liveTex;
      live.scale.set(1 / dpr);
    }
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    liveCtx.setTransform(s * dpr, 0, 0, s * dpr, -camX * s * dpr, 0);
    drawSiteLive(liveCtx, g, false);
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
      let by = (GROUND - 42) * s;
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
// The White Sands site first; the Cape's comes with the Cape rooms.
siteScene.accepts = g => g.site !== 'cape' && !g.crewed;
