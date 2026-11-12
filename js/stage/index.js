// THE SCENE LAYER (v0.8 PixiJS rebuild). One WebGL canvas under the HTML panels, in the same place as the old site
// canvas. Each scene rebuilt in Pixi is listed in SCENES; a scene not yet rebuilt is still drawn by the old canvas code,
// so the game stays playable while the rebuild goes room by room. The dev menu can switch back to the old drawing for
// comparison (localStorage 'pa-renderer' = 'canvas').
import { Application } from '../vendor/pixi.min.mjs';
import { blockhouseScene } from './blockhouse.js';
import { dugoutScene } from './dugout.js';

const SCENES = { blockhouse: blockhouseScene, dugout: dugoutScene };
export const RENDERER_KEY = 'pa-renderer';

let app = null,
  host = null,
  current = null,
  currentId = null,
  failed = false;

// Starts Pixi in the host element. If WebGL cannot start, the game carries on with the old drawing.
export async function startStage(el, hooks) {
  host = el;
  try {
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
  } catch (e) {
    failed = true;
    console.error('The scene layer could not start; drawing with the old canvas.', e);
  }
}

export const pixiWanted = () => {
  try {
    return localStorage.getItem(RENDERER_KEY) !== 'canvas';
  } catch {
    return true;
  }
};
export const hasScene = id => !!SCENES[id];

// Draws scene `id` this frame if it has been rebuilt in Pixi and the layer is on. Returns true when it drew, false
// when the old canvas should draw instead (and then the layer is hidden).
export function stageFrame(id, dt, reserve) {
  const use = !!app && !failed && !!id && !!SCENES[id] && pixiWanted();
  if (!use) {
    if (host && !host.hidden) host.hidden = true;
    if (current) drop();
    return false;
  }
  if (currentId !== id || current?.stale?.()) {
    drop();
    current = SCENES[id](app.hooks);
    currentId = id;
    app.stage.addChild(current.root);
  }
  if (host.hidden) {
    host.hidden = false;
    app.resize();
  }
  current.update(dt, app.screen, reserve);
  app.render();
  return true;
}

function drop() {
  if (!current) return;
  app.stage.removeChild(current.root);
  current.root.destroy({ children: true });
  current = null;
  currentId = null;
}
