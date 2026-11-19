// THE SITE, rebuilt in PixiJS (v0.8): White Sands or the Cape from the side. The sky with its sun and drifting clouds,
// the mountains in three parallax ranges (or, at the Cape, the Atlantic and a line of palmettos), the haze and the sand,
// the buildings cut away in the style of the walk-in rooms (site-art.js), the windsock, flag, beacon and truck
// (site-live.js), the flames, smoke and dust, and the people walking about with their speech bubbles are drawn here.
// The rockets (js/site/rockets.js), the load on the truck, the Mercury Control screens, job bars and the hover name
// come from the canvas drawing on a clear overlay. Clicks go through to the site canvas underneath, so walking and
// talking work as before.
// Reads only what the player could see, through game.js (the scenes never import js/truth).
import { BlurFilter, Container, Graphics, Sprite, Texture } from '../vendor/pixi.min.mjs';
import { g as game } from '../game.js';
import { dateOf } from '../core/calendar.js';
import { drawSiteMachinery, siteLabelsShown, flyingRise, VIEW_H, GROUND } from '../site/draw.js';
import { colorOf, speech, puffTexture, gradientTexture } from './kit.js';
import { buildSite, dropSite, siteKey } from './site-art.js';
import { siteLive } from './site-live.js';
import { paintedRange, paintedSand, paintedSea, paintedScrub, U } from './site-backdrop.js';
import { launchFx, warmTint, tailOf, might } from './fx/launch.js';
import { hdLayer, hdWanted } from './fx/hd.js';
import { PLACES } from '../data/white-sands.js';
import { lightAt, daylightDressing } from './fx/daylight.js';
import { blastFx } from './fx/blast.js';
import { siteLife } from './fx/life.js';
import { siteTraffic } from './fx/traffic.js';
import { weatherLayers, mulTint, weatherNow } from './fx/weather.js';
import { flameLight, flameX, wetness } from './fx/flame-light.js';

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

// Pixel art (pixelate.js): lines thinner than this many site units are drawn one art pixel wide.
siteScene.hairline = 3.5;
// Slides a painted strip by a whole art pixel at a time, so its pixels stay on the pixel pass's grid.
const snapU = x => Math.round(x / U) * U;
export function siteScene() {
  const g = game;
  // With pixel art on, the mountains, the sand and the Cape's sea and scrub are hand-painted (site-backdrop.js); the
  // dev menu's No pixel art keeps the smooth shapes.
  let painted = true;
  try {
    painted = localStorage.getItem('pa-pixel') !== 'off';
  } catch {
    /* no storage: pixel art on */
  }
  let paintedGround = null,
    paintedStrip = null;
  const root = new Container();

  // ---- the backdrop, in site units (VIEW_H tall), scaled to the screen ----
  // Three depths, so the camera's tilt up after a launch moves the sky least and the ground most.
  const back = new Container();
  root.addChild(back);
  const backFar = new Container(),
    backMid = new Container(),
    backNear = new Container();
  back.addChild(backFar, backMid, backNear);
  // 2D-HD (fx/hd.js): the sky and the far mountains or sea are drawn smooth and a little out of focus, under the
  // pixels, which the pixel pass puts here, just over them.
  const pixelSlot = new Container();
  root.addChild(pixelSlot);
  root.pixelSlot = pixelSlot;
  const farBlur = new BlurFilter({ strength: 2, quality: 3 }),
    cloudBlur = new BlurFilter({ strength: 3, quality: 3 });
  const sky = new Sprite();
  const sun = new Graphics();
  const sunGlow = new Sprite(puffTexture());
  sunGlow.anchor.set(0.5);
  const clouds = new Graphics();
  // The time of day: stars, moon, shadows and searchlights (fx/daylight.js).
  const day = daylightDressing();
  // The day's weather (fx/weather.js): thunderheads and overcast far off, mist over the distance, dust on the ground,
  // rain over everything.
  const weather = weatherLayers();
  const life = siteLife();
  // The launch's flame as a moving light: shadows, lit cloud undersides, reflections on wet ground (fx/flame-light.js).
  const flame = flameLight();
  backFar.addChild(sky, day.stars, day.moon, sunGlow, sun, clouds, flame.cloudGlow, life.birds, weather.far);
  const WIDE = 4000; // wider than any screen in site units
  const makeRange = (color, base, peaks, far) =>
    painted ? paintedRange(color, base, peaks, WIDE, SPAN, far) : range(color, base, peaks, WIDE);
  const ranges = [
    [makeRange(0x8d86a0, 380, [0, 60, 30, 120, 70, 150, 40, 90, 20], 0), 0.15],
    [makeRange(0xa99a8c, 440, [10, 40, 25, 60, 15, 50, 35, 20, 45], 0.5), 0.3],
    [makeRange(0xc6aa87, 490, [8, 28, 12, 35, 15, 32, 11, 23, 5], 1), 0.42],
  ];
  for (const [r] of ranges) backMid.addChild(r);
  // The Cape's horizon: the Atlantic, flat as a table, with glints that drift, and a green band with palmettos.
  const sea = new Sprite();
  const glints = new Graphics();
  const scrub = new Graphics();
  const palms = new Graphics();
  backMid.addChild(sea, glints, life.surf, scrub, palms, weather.mist);
  // 2D-HD: the haze along the horizon, glowing, warmest when the sun is low (behind the site, so it never washes it).
  const horizonHaze = new Sprite(puffTexture());
  horizonHaze.anchor.set(0.5);
  horizonHaze.blendMode = 'add';
  backMid.addChild(horizonHaze);
  const PALM_SPAN = 140;
  const haze = new Sprite();
  const sand = new Sprite();
  const sandEdge = new Graphics();
  backNear.addChild(haze, sand, sandEdge);

  // ---- the site itself, in world units, moved by the camera ----
  const world = new Container();
  root.addChild(world);
  const fore = new Sprite();
  // A rocket lost on the pad (fx/blast.js): the scorch under everything, the fire and smoke over it.
  const blast = blastFx();
  world.addChild(fore, day.shadows, flame.shadows, flame.wet, blast.scorch, blast.smoke);
  let site = null,
    siteAt = '';
  const live = siteLive();
  world.addChild(live.behind, live.fire);
  // The umbilicals on the pad, and the traffic on the road (fx/traffic.js).
  const traffic = siteTraffic();
  world.addChild(traffic.pad);
  const people = new Graphics();
  world.addChild(people, traffic.road, live.truckLayer, live.dust, live.smoke, weather.ground);
  // The launch: its light on the site, the ground cloud and the trail (fx/launch.js).
  const fx = launchFx();
  world.addChild(fx.lightLayer, fx.front, fx.trail, blast.front);
  // The machinery not yet rebuilt, drawn by the old code on a clear canvas the size of the screen.
  const liveCanvas = document.createElement('canvas');
  const liveCtx = liveCanvas.getContext('2d');
  let liveTex = null;
  // After dark, the windows, doorways and floodlights glow over the dimmed site.
  const lightLayer = new Container();
  root.addChild(lightLayer);
  const nightLayer = new Container();
  nightLayer.addChild(day.beamLayer);
  root.addChild(nightLayer, weather.rain);
  const overlay = new Sprite();
  root.addChild(overlay);
  // The job bars, the walking marker and the hover name, on a canvas of their own that the pixel art pass keeps sharp.
  const labelCanvas = document.createElement('canvas');
  const labelCtx = labelCanvas.getContext('2d');
  let labelTex = null,
    labelsWere = true;
  const labels = new Sprite();
  labels.crisp = true;
  // In front of the rocket (the canvas overlay): the vapour off her when she is fuelled.
  const frontWorld = new Container();
  frontWorld.addChild(life.vapour);
  root.addChild(frontWorld, fx.flash, blast.flash);
  // 2D-HD light over the pixels, at full resolution: the haze along the horizon, the sun's bloom and its rays when it
  // is low, the bloom of the flame and of the ground cloud it lights. Built to the width of the screen.
  const hdBox = new Container();
  hdBox.crisp = true;
  root.addChild(hdBox);
  let hd = null,
    hdW = 0,
    sunX = 0,
    sunY = 0;
  // Speech bubbles, in screen pixels so the words stay a readable size at any zoom.
  const bubbleLayer = new Container();
  root.addChild(labels, bubbleLayer);
  const bubbles = new Map();
  const fade = new Graphics();
  root.addChild(fade);

  // The 2D-HD light for this frame (in site units across the screen).
  function hdLight(L, lf, vw, s, camX) {
    const on = hdWanted();
    // Only the sky and the far distance go soft: the two far ranges (or the sea). The near dunes stay in pixels, so
    // the ground the site stands on stays sharp.
    backFar.smooth = on;
    for (const far of [ranges[0][0], ranges[1][0], sea, glints]) {
      far.smooth = on;
      far.filters = on ? [farBlur] : null;
    }
    clouds.filters = flame.cloudGlow.filters = on ? [cloudBlur] : null;
    horizonHaze.visible = on;
    farBlur.strength = 1.6 * s;
    cloudBlur.strength = 2.4 * s;
    hdBox.visible = on;
    if (!on) return;
    const w = Math.ceil(vw) + 2;
    if (!hd || Math.abs(w - hdW) > 1) {
      hd?.destroy();
      hdW = w;
      hd = hdLayer(w, VIEW_H, { unit: 1, lightRes: 0.1, glowRes: 0.25 });
      hdBox.addChild(hd.root);
    }
    hdBox.scale.set(s);
    const tilt = lf.tilt,
      sky = L.sky;
    hd.begin(0xffffff);
    const low = L.sun.up ? L.sun.low : 0;
    horizonHaze.position.set(vw / 2, 470);
    horizonHaze.width = vw * 1.8;
    horizonHaze.height = 150;
    horizonHaze.tint = sky[2];
    horizonHaze.alpha = 0.3 + 0.4 * low;
    // The sun's bloom, and its rays slanting down through the haze when it is low.
    if (L.sun.up) {
      const sy = sunY + tilt * 0.3;
      hd.glow(sunX, sy, 120, L.sunColor, 0.18 + 0.22 * low);
      hd.glow(sunX, sy, 30, 0xffffff, 0.2);
      if (low > 0.25)
        for (const [lean, wide] of [
          [0.35, 90],
          [0.75, 120],
          [-0.3, 80],
          [-0.8, 110],
        ])
          hd.beam(
            sunX,
            sy,
            8,
            wide,
            520,
            Math.sign(sunX - w / 2) * Math.abs(lean) + lean * 0.4,
            L.sunColor,
            0.05 * low,
          );
    }
    // The flame: a white-hot bloom at the nozzle and a wide warm halo, and the ground cloud lit from inside.
    if (lf.glow > 0) {
      const v = g.vehicle,
        m = might(v),
        rise = Math.min(4000, flyingRise(g));
      const x = PLACES.tower.x + 25 - camX,
        y = GROUND - 6 - rise + tailOf(v) * 2 + tilt;
      hd.glow(x, y, 16 + 40 * m, 0xfff2d0, 0.75 * lf.glow, (16 + 40 * m) * 1.6);
      hd.glow(x, y + 10, 90 + 220 * m, 0xffa850, 0.32 * lf.glow);
      if (rise < 320) {
        const k = lf.glow * (1 - rise / 320);
        hd.glow(x, GROUND - 12 + tilt, 120 + 360 * m, 0xffc680, 0.3 * k, 26 + 40 * m);
        hd.motes(x, GROUND - 40 + tilt, 120 + 300 * m, 200 + 500 * m, 40, 0, 0xffe6b0, 40, g.time || 0, 0.8 * k, 2.5);
      }
    }
    hd.vignette(0.3, w / 2, VIEW_H * 0.45);
    hd.commit();
  }

  let cloudClock = 0,
    skyKey = '',
    lastW = 0,
    lastH = 0;
  function update(dt, screen) {
    const s = screen.height / VIEW_H,
      vw = screen.width / s,
      camX = g.cam.x,
      t = g.time;
    // The light of the moment, through the whole day (fx/daylight.js).
    // Ending the day on the site, the night passes as a time-lapse: evening runs on into the small hours as it fades,
    // and the morning comes up out of the dawn (game.js endDay; the screen dims only part way).
    const lapse = g.fading?.lapse && !g.room ? g.fading : null;
    let minute = g.clock % 1440,
      shade = g.fade;
    if (lapse) {
      const k = g.fade * g.fade * (3 - 2 * g.fade);
      minute = lapse.dir > 0 ? lapse.lapse.from + (25 * 60 - lapse.lapse.from) * k : 7.5 * 60 - 3 * 60 * g.fade;
      shade = 0.4 * g.fade;
    }
    cloudClock += dt * (lapse ? 30 : 1);
    const L = lightAt(minute),
      skyNow = L.sky,
      dusk = L.dusk,
      cape = g.site === 'cape';
    const W = weatherNow(g, minute); // the same weather the periscopes, TV and tracking camera show
    // The launch's shake and the camera's tilt up after her.
    const lf = fx.state(g, Math.min(0.1, dt), dusk, screen, s),
      tiltPx = lf.tilt * s;
    const bl = blast.state(g, Math.min(0.1, dt), screen, s);
    root.position.set(lf.shakeX + bl.shakeX, lf.shakeY + bl.shakeY);
    back.scale.set(s);
    backFar.y = lf.tilt * 0.3;
    backMid.y = lf.tilt * 0.6;
    backNear.y = lf.tilt;
    world.scale.set(s);
    world.position.set(-camX * s, tiltPx);

    // The sky, the sun, the haze and the sand: redrawn when the light or the screen changes.
    const key = `${L.key}|${Math.ceil(vw)}|${cape}`;
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
          [0, L.night > 0.3 ? '#090c1c' : '#2c5791'],
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
      if (painted) {
        paintedGround?.destroy(true);
        paintedGround = paintedSand(vw, cape);
        backNear.addChildAt(paintedGround, backNear.getChildIndex(sand) + 1);
        sand.visible = sandEdge.visible = false;
      }
      setGrad(
        fore,
        [
          [0, 'rgba(53,46,48,0)'],
          [1, `rgba(${dusk ? '53,46,68' : '75,57,40'},${(0.22 + 0.2 * L.night).toFixed(2)})`],
        ],
        0,
        GROUND + 45,
        vw + 2,
        VIEW_H - GROUND - 45,
      );
      // The sun crosses the sky from the east (right) in the morning to the west (left) at sunset, low and orange
      // at either end; after sunset it is gone.
      const sx = vw * (0.88 - 0.76 * L.sun.along),
        sy = 470 - 390 * L.sun.elevation;
      sunX = sx;
      sunY = sy;
      sun.clear();
      sun.visible = sunGlow.visible = L.sun.up;
      if (L.sun.up) sun.circle(sx, sy, 14 + 4 * L.sun.low).fill(L.sunColor);
      sunGlow.position.set(sx, sy);
      sunGlow.scale.set(3.8 + 1.4 * L.sun.low);
      sunGlow.tint = L.sunColor;
      sunGlow.alpha = 0.4;
      day.sky(L, vw);
      for (const [r] of ranges) r.visible = !cape;
      for (const k of [sea, glints, scrub, palms]) k.visible = cape;
      if (cape && painted) {
        sea.texture?.destroy(true);
        const pSea = paintedSea(vw);
        sea.texture = pSea.texture;
        sea.scale.copyFrom(pSea.scale);
        sea.position.copyFrom(pSea.position);
        pSea.destroy();
        paintedStrip?.destroy(true);
        paintedStrip = paintedScrub(vw);
        backMid.addChildAt(paintedStrip, backMid.getChildIndex(scrub));
        scrub.visible = palms.visible = false;
      } else if (paintedStrip) {
        paintedStrip.destroy(true);
        paintedStrip = null;
      }
      if (cape && !painted) {
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
    if (paintedGround) paintedGround.x = -snapU(camX % (paintedGround.tilePx * U));
    if (paintedStrip) paintedStrip.x = -snapU((camX * 0.4) % PALM_SPAN);
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
      drift = (cloudClock * (1 + W.wind * 0.08) + camX * 0.08) % spanC;
    clouds.clear();
    // A cloudier day has more and bigger clouds, greyer under overcast.
    const cloudSet = [
      [80, 120, 90],
      [520, 70, 130],
      [930, 160, 70],
      [1300, 100, 110],
      [1700, 140, 80],
      [300, 180, 120],
      [1100, 60, 150],
      [1500, 190, 100],
    ].slice(0, 3 + Math.round(5 * W.cloud));
    const cloudCol = mulTint(L.cloud, W.overcast > 0.3 ? 0xc4c8d0 : 0xffffff);
    const cloudSpots = [];
    for (const [x0, y, w0] of cloudSet) {
      const w = w0 * (0.8 + 0.6 * W.cloud);
      const x = ((((x0 - drift) % spanC) + spanC) % spanC) - 300;
      cloudSpots.push([x, y, w]);
      const col = { color: cloudCol, alpha: 0.55 - 0.3 * L.night + 0.2 * W.overcast };
      clouds.ellipse(x + w * 0.5, y, w * 0.5, w * 0.16).fill(col);
      clouds.ellipse(x + w * 0.35, y - w * 0.1, w * 0.22, w * 0.14).fill(col);
      clouds.ellipse(x + w * 0.62, y - w * 0.12, w * 0.26, w * 0.17).fill(col);
    }
    for (const [r, k] of ranges) r.x = painted ? -snapU((camX * k) % r.period) : -((camX * k) % r.period);

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
    live.update(g, Math.min(0.1, dt), W.wind);
    life.update(g, Math.min(0.1, dt), {
      vw,
      camX,
      wind: W.wind,
      night: L.night,
      fuelled: g.count != null || !!g.console || !!g.crewed,
      t,
    });
    traffic.update(g, Math.min(0.1, dt), { vw, camX, night: L.night, year: dateOf(g.day ?? 0).year });
    frontWorld.scale.set(s);
    frontWorld.position.set(-camX * s, tiltPx);
    // Dusk: the site itself darkens toward the sky's colour, and the lights come on.
    // A launch's flame lights it up warm, most of all at night.
    const dim = warmTint(mulTint(L.tint, weather.tint(W)), lf.glow, dusk);
    if (world.tint !== dim) world.tint = overlay.tint = dim;
    lightLayer.scale.set(s);
    lightLayer.position.set(-camX * s, tiltPx);
    for (const l of lightLayer.children) l.alpha = L.lamps * l.full * (0.92 + 0.08 * Math.sin(t * 7 + l.x));
    // The shadows along the ground, and the searchlights on a rocket standing on the pad at night.
    day.world(L, g, g.rocket.where === 'tower' ? GROUND - 160 : null, t);
    // The flame's own light: shadows swinging away from it, the clouds' undersides, and reflections when it is wet.
    {
      const rise = Math.min(4000, flyingRise(g)),
        fx0 = flameX(),
        lit = { glow: lf.glow, night: L.night };
      flame.ground(g, { fx: fx0, rise, ...lit });
      flame.clouds(cloudSpots, { sx: fx0 - camX, sy: GROUND - 8 - rise + lf.tilt * 0.7, m: might(g.vehicle), ...lit });
      flame.reflections(g, {
        wetK: wetness(W),
        lights: site?.lights || [],
        lamps: L.lamps,
        fx: fx0,
        rise,
        glow: lf.glow,
        camX,
        vw,
        sky: parseInt(L.sky[2].slice(1), 16),
      });
    }
    weather.update(W, L, { vw, camX, screen, s, t, dt: Math.min(0.1, dt) });
    nightLayer.scale.set(s);
    nightLayer.position.set(-camX * s, tiltPx);
    // The foreground darkens toward the bottom of the screen.
    fore.x = camX;
    hdLight(L, lf, vw, s, camX);

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
      labelCanvas.width = liveCanvas.width;
      labelCanvas.height = liveCanvas.height;
      labelTex?.destroy(true);
      labelTex = Texture.from(labelCanvas);
      labels.texture = labelTex;
      labels.scale.set(1 / dpr);
      labelsWere = true;
    }
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    liveCtx.setTransform(s * dpr, 0, 0, s * dpr, -camX * s * dpr, tiltPx * dpr);
    drawSiteMachinery(liveCtx, g, 'art');
    liveTex.source.update();
    const labelsNow = siteLabelsShown(g);
    if (labelsNow || labelsWere) {
      labelCtx.setTransform(1, 0, 0, 1, 0, 0);
      labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      labelCtx.setTransform(s * dpr, 0, 0, s * dpr, -camX * s * dpr, tiltPx * dpr);
      if (labelsNow) drawSiteMachinery(labelCtx, g, 'labels');
      labelTex.source.update();
    }
    labelsWere = labelsNow;

    // Bubbles: over each speaker, stacked upward when two would overlap.
    const talking = Object.values(g.people)
      .filter(p => !p.hidden && p.bubble)
      .sort((a, b) => a.bubble.until - b.bubble.until);
    const seen = new Set(),
      placed = [],
      // Bigger on tall screens so the words keep pace with the HTML panels.
      bubbleScale = 0.82 * Math.max(1, Math.min(1.6, screen.height / 900));
    for (const p of talking) {
      seen.add(p.id);
      let b = bubbles.get(p.id);
      if (!b) {
        b = speech(260);
        bubbleLayer.addChild(b);
        bubbles.set(p.id, b);
      }
      b.update(p.bubble);
      b.scale.set(bubbleScale);
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
    if (shade > 0) fade.rect(0, 0, screen.width, screen.height).fill({ color: 0x05080e, alpha: shade });
  }

  const stale = () => false;
  return { root, update, stale, passThrough: true };
}
// Every site: White Sands, the Cape, and the crewed years.
siteScene.accepts = () => true;
