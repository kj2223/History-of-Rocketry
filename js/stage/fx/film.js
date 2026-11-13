// THE ERA'S FILM (v0.8 visual pass): one grade laid over every PixiJS scene, so the whole game looks like the footage
// of its years. Late-1940s and 1950s newsreel: faded, warm, grainy, a dark vignette and the odd faint scratch. No flicker:
// the brightness never pulses (photosensitivity, fx/calm.js).
// 1958 to 1975 Kodachrome: rich warm colour, fine grain. 1976 to 1995 broadcast video: a touch cooler, scanlines.
// 1996 to 2015 early digital: nearly clean. From 2016: clean. The screens of Mission Control and the range plot get
// a lighter hand than the site and the walk-in rooms, so the readings stay crisp.
// The dev menu can switch it off (localStorage 'pa-film' = 'off').
import {
  ColorMatrixFilter,
  NoiseFilter,
  Container,
  Sprite,
  Graphics,
  Texture,
  TilingSprite,
} from '../../vendor/pixi.min.mjs';
import { calm } from './calm.js';

export const FILM_KEY = 'pa-film';
export const filmWanted = () => {
  try {
    return localStorage.getItem(FILM_KEY) !== 'off';
  } catch {
    return true;
  }
};

// The grade for a year. sat: saturation (0 = unchanged, -1 = grey); sepia: how far toward a warm print; contrast;
// lift: brightness; grain: film noise; vignette: how dark the corners go; scan: video scanlines; scratch.
export function filmLookFor(year) {
  if (year < 1958)
    return {
      name: 'newsreel',
      sat: -0.4,
      sepia: 0.3,
      contrast: 0.1,
      lift: 0.02,
      grain: 0.035,
      vignette: 0.6,
      scan: 0,
      scratch: 1,
    };
  if (year < 1976)
    return {
      name: 'kodachrome',
      sat: 0.18,
      sepia: 0.1,
      contrast: 0.09,
      lift: 0,
      grain: 0.05,
      vignette: 0.38,
      scan: 0,
      scratch: 0,
    };
  if (year < 1996)
    return {
      name: 'video',
      sat: -0.08,
      sepia: 0,
      contrast: 0.05,
      lift: 0.015,
      grain: 0.035,
      vignette: 0.28,
      scan: 0.09,
      scratch: 0,
      cool: 0.04,
    };
  if (year < 2016)
    return {
      name: 'digital',
      sat: 0.04,
      sepia: 0,
      contrast: 0.04,
      lift: 0,
      grain: 0.012,
      vignette: 0.18,
      scan: 0,
      scratch: 0,
    };
  return {
    name: 'clean',
    sat: 0.06,
    sepia: 0,
    contrast: 0.03,
    lift: 0,
    grain: 0,
    vignette: 0.12,
    scan: 0,
    scratch: 0,
  };
}

// How strongly the grade applies in each scene: full on the site and in the rooms, light on the screens.
export const FILM_STRENGTH = {
  site: 1,
  blockhouse: 0.85,
  dugout: 0.85,
  hangar: 0.85,
  sim: 0.6,
  control: 0.45,
  tracking: 0.3,
};

// 4x5 colour matrices, as Pixi's ColorMatrixFilter takes them (row-major, offsets in 0..1).
const ID = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
function mul(a, b) {
  // a after b
  const out = new Array(20);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out[r * 5 + c] = v;
    }
  return out;
}
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const LUMA = [0.299, 0.587, 0.114];
function saturation(s) {
  const k = 1 + s,
    m = [...ID];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r * 5 + c] = LUMA[c] * (1 - k) + (r === c ? k : 0);
  return m;
}
const SEPIA = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
function contrast(c, lift) {
  const k = 1 + c,
    o = (1 - k) / 2 + lift;
  return [k, 0, 0, 0, o, 0, k, 0, 0, o, 0, 0, k, 0, o, 0, 0, 0, 1, 0];
}
const cool = k => [1 - k, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 + k, 0, 0, 0, 0, 0, 1, 0];

// The whole grade as one matrix, at a strength (0 = none). Exported for the tests.
export function filmMatrix(look, strength = 1) {
  let m = saturation(look.sat * strength);
  if (look.sepia) m = mul(mix(ID, SEPIA, look.sepia * strength), m);
  if (look.cool) m = mul(cool(look.cool * strength), m);
  m = mul(contrast(look.contrast * strength, look.lift * strength), m);
  return m;
}

function vignetteTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.25)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return Texture.from(cv);
}
function scanTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 3;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 2, 4, 1);
  return Texture.from(cv);
}

// The film layer for the Pixi application: filters on the stage, and the vignette, scanlines and scratches on top.
// place() puts the top layer above the scene just added; update() follows the year and the scene each frame.
export function filmLayer(app) {
  const grade = new ColorMatrixFilter();
  const grain = new NoiseFilter({ noise: 0, seed: Math.random() });
  const top = new Container();
  const vignette = new Sprite(vignetteTexture());
  const scan = new TilingSprite({ texture: scanTexture(), width: 16, height: 16 });
  const marks = new Graphics();
  top.addChild(scan, vignette, marks);
  let on = null,
    t = 0,
    scratches = [],
    grainClock = 0;

  function update(id, year, dt, screen) {
    const want = filmWanted();
    if (want !== on) {
      on = want;
      app.stage.filters = on ? [grade, grain] : null;
      top.visible = on;
    }
    if (!on) return;
    t += dt;
    const look = filmLookFor(year),
      k = FILM_STRENGTH[id] ?? 0.7;
    app.stage.filterArea = screen;
    grade.matrix = filmMatrix(look, k);
    // The grain moves at film speed (12 a second), not every screen frame, and is off in calm mode.
    const quiet = calm();
    grain.noise = quiet ? 0 : look.grain * k;
    grainClock += dt;
    if (grainClock > 1 / 12) {
      grainClock = 0;
      grain.seed = Math.random();
    }
    grain.enabled = grain.noise > 0.001;
    vignette.width = screen.width;
    vignette.height = screen.height;
    vignette.alpha = look.vignette * k;
    scan.visible = look.scan > 0;
    if (scan.visible) {
      scan.width = screen.width;
      scan.height = screen.height;
      scan.tileScale.set(Math.max(1, Math.round(screen.height / 380)));
      scan.alpha = look.scan * k;
    }
    // Newsreel scratches: now and then a faint thin line that fades in, wanders a little and fades out. No specks.
    marks.clear();
    if (look.scratch && k > 0.5 && !quiet) {
      if (Math.random() < dt * 0.2)
        scratches.push({
          x: Math.random() * screen.width,
          age: 0,
          life: 1.2 + Math.random() * 1.5,
          drift: (Math.random() - 0.5) * 20,
        });
      scratches = scratches.filter(s => (s.age += dt) < s.life);
      for (const s of scratches) {
        s.x += s.drift * dt;
        const f = Math.sin((Math.PI * s.age) / s.life);
        marks.rect(s.x, 0, 1, screen.height).fill({ color: 0xf4ecd8, alpha: 0.07 * f });
      }
    }
  }
  return { top, update, place: () => app.stage.addChild(top) };
}
