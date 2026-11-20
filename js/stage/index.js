// THE SCENE LAYER (v0.8 PixiJS rebuild). One WebGL canvas under the HTML panels, in the same place as the old site
// canvas. Each scene rebuilt in Pixi is listed in SCENES; a scene not yet rebuilt is still drawn by the old canvas code,
// so the game stays playable while the rebuild goes room by room. The dev menu can switch back to the old drawing for
// comparison (localStorage 'pa-renderer' = 'canvas').
import * as PIXI from '../vendor/pixi.min.mjs';

const { Application } = PIXI;
import { blockhouseScene } from './blockhouse.js';
import { dugoutScene } from './dugout.js';
import { hangarScene } from './hangar.js';
import { siteScene } from './site.js';
import { controlScene } from './control.js';
import { trackingScene } from './tracking.js';
import { simScene } from './sim.js';
import { deepScene } from './deep.js';
import { recoveryScene } from './recovery.js';
import { g } from '../game.js';
import { yearOf } from '../site/draw.js';
import { filmLayer } from './fx/film.js';
import { transitionLayer, transitionKind } from './fx/transition.js';
import { pixelPass, setHairline, artFrame } from './pixelate.js';

// A scene may decline a room it does not draw yet (accepts(g) false): the old canvas draws that one.
const SCENES = {
  blockhouse: blockhouseScene,
  dugout: dugoutScene,
  hangar: hangarScene,
  site: siteScene,
  control: controlScene,
  tracking: trackingScene,
  sim: simScene,
  deep: deepScene,
  recovery: recoveryScene,
};
export const RENDERER_KEY = 'pa-renderer';
// The pixel art look (pixelate.js): on unless the dev menu switches it off, to compare (localStorage 'pa-pixel' = 'off').
export const PIXEL_KEY = 'pa-pixel';
export const pixelWanted = () => {
  try {
    return localStorage.getItem(PIXEL_KEY) !== 'off';
  } catch {
    return true;
  }
};

let frameBox = null;
let app = null,
  host = null,
  current = null,
  currentId = null,
  builtFor = null,
  failed = false,
  film = null,
  cut = null,
  pixels = null;

// The desktop app forbids eval (its Content-Security-Policy, desktop/main.js), and PixiJS builds its shader code with
// it unless its 'unsafe-eval' add-on is loaded. The add-on ships as a classic script that patches the classes on a
// global PIXI, so the module's classes are handed to it on one first. Without it the scene layer could not start in
// the app, and every room quietly fell back to the old drawing.
function allowNoEval() {
  if (globalThis.PIXI?.generateShaderSyncPolyfill) return Promise.resolve();
  globalThis.PIXI = { ...PIXI };
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/pixi-unsafe-eval.min.js', import.meta.url).href;
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load the PixiJS no-eval add-on'));
    document.head.appendChild(s);
  });
}

// Starts Pixi in the host element. If WebGL cannot start, the game carries on with the old drawing.
export async function startStage(el, hooks) {
  host = el;
  try {
    await allowNoEval();
    const a = new Application();
    await a.init({
      resizeTo: el,
      background: '#0d0c0a',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false,
    });
    el.appendChild(a.canvas);
    app = a;
    app.hooks = hooks;
    film = filmLayer(app);
    // The pixel pass's picture sits under every scene; the scene itself then draws only its type over it.
    pixels = pixelPass(app.renderer);
    // The scene and its pixels sit in the whole-pixel frame (pixelate.js artFrame), centred in the window.
    frameBox = new PIXI.Container();
    frameBox.label = 'art-frame';
    app.stage.addChildAt(frameBox, 0);
    frameBox.addChild(pixels.sprite);
    cut = transitionLayer();
  } catch (e) {
    failed = true;
    console.error('The scene layer could not start; drawing with the old canvas.', e);
  }
}

// For tests and the screenshot tools: the Pixi application, once started.
export const stageApp = () => app;

export const pixiWanted = () => {
  try {
    return localStorage.getItem(RENDERER_KEY) !== 'canvas';
  } catch {
    return true;
  }
};
// A scene drawn with ordinary shapes and pixelated declares how thin a line may be before it is drawn one art pixel
// wide (its factory's `hairline`, in its own units). Off for the scenes that paint their own pixels.
const hairlineFor = id => (pixelWanted() && SCENES[id]?.hairline) || 0;
const takes = id => !!id && !!SCENES[id] && (!SCENES[id].accepts || SCENES[id].accepts(g));
export const hasScene = id => takes(id);

// Draws scene `id` this frame if it has been rebuilt in Pixi and the layer is on. Returns true when it drew, false
// when the old canvas should draw instead (and then the layer is hidden).
export function stageFrame(id, dt, reserve) {
  const use = !!app && !failed && takes(id) && pixiWanted();
  if (!use) {
    if (host && !host.hidden) host.hidden = true;
    if (current) drop();
    return false;
  }
  // A scene holds the game it was built for, so a load, a new game or a jump builds it again.
  if (currentId !== id || builtFor !== g || current?.stale?.()) {
    drop();
    setHairline(hairlineFor(id));
    current = SCENES[id](app.hooks);
    currentId = id;
    builtFor = g;
    frameBox.addChild(current.root);
    // The site lets clicks through to the canvas underneath, which still does the walking and talking.
    host.classList.toggle('pass', !!current.passThrough);
    film?.place();
    // The way in to the new scene, in the era's manner (fx/transition.js).
    if (cut) {
      app.stage.addChild(cut.cover);
      cut.start(transitionKind(id, yearOf(g)));
    }
  }
  if (host.hidden) {
    host.hidden = false;
    app.resize();
  }
  setHairline(hairlineFor(id));
  const frame = artFrame(app.screen.width, app.screen.height);
  frameBox.y = frame.y;
  current.update(dt, frame, reserve);
  setHairline(0);
  // A scene still drawn with ordinary shapes is turned into pixel art here; the blockhouse paints its own pixels.
  if (SCENES[id].hairline && pixelWanted()) pixels.draw(current.root, frame);
  else pixels?.release();
  film?.update(id, yearOf(g), dt, app.screen);
  cut?.update(dt, app.screen);
  app.render();
  return true;
}

function drop() {
  if (!current) return;
  pixels?.release();
  frameBox.removeChild(current.root);
  current.root.destroy({ children: true });
  current = null;
  currentId = null;
}
