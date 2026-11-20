// A LIVING TITLE SCREEN (next-level visual pass, November 2026). Behind the title the game you were last playing is
// shown as a diorama: its own site, its own year and its own hour, drawn by the same scene as the game (so the era's
// look, the weather, the smoke and the light are all there). The game stands still while the title is up: only the
// camera drifts slowly along the site, and the camera is put back where it was when you go in. Nothing flashes, and
// Calm effects (fx/calm.js) holds the camera still. The dev menu's switch (localStorage 'pa-title-scene' = 'off')
// brings back the plain title. Presentation only: the game's state is never changed.
import { WORLD_W } from '../data/white-sands.js';
import { calm } from '../stage/fx/calm.js';

export const TITLE_SCENE_KEY = 'pa-title-scene';
export const DRIFT_SPAN = 600; // site units the camera wanders over
export const DRIFT_PERIOD = 90; // seconds for one slow sweep there and back

export const titleSceneWanted = () => {
  try {
    return localStorage.getItem(TITLE_SCENE_KEY) !== 'off';
  } catch {
    return true;
  }
};

// Where the camera sits t seconds into the title, from where it was (x0) on a screen viewW wide. Pure, for the tests.
export function driftAt(x0, t, viewW, still = false) {
  const span = Math.min(DRIFT_SPAN, Math.max(0, WORLD_W - viewW));
  const centre = Math.max(span / 2, Math.min(WORLD_W - viewW - span / 2, x0));
  // It eases away from where you left it over the first twenty seconds, so the picture never jumps.
  const ease = Math.min(1, t / 20),
    k = ease * ease * (3 - 2 * ease);
  const x = still ? x0 : x0 + (centre + (span / 2) * Math.sin((2 * Math.PI * t) / DRIFT_PERIOD) - x0) * k;
  return Math.max(0, Math.min(WORLD_W - viewW, x));
}

// Whether the title is showing the scene now: the site leaves off its names and speech bubbles.
export const titleShowing = () => held !== null;

let held = null,
  t = 0;

// Once a frame while the title is up. draw(): the scene's frame for the site; false when it can't (no PixiJS).
export function titleSceneFrame(g, dt, viewW, draw) {
  if (!titleSceneWanted() || !g?.cam) return leaveTitleScene(g);
  if (held === null) {
    held = g.cam.x;
    t = 0;
  }
  t += Math.min(0.1, dt);
  g.cam.x = driftAt(held, t, viewW, calm());
  const shown = !!draw();
  setFull(shown);
  return shown;
}

// On the way out of the title (or with the scene off): the camera goes back and the plain title returns.
export function leaveTitleScene(g) {
  if (held !== null && g?.cam) g.cam.x = held;
  held = null;
  setFull(false);
  return false;
}

// The scene fills the window under the title; the renderer is told when its box changes size.
function setFull(on) {
  if (typeof document === 'undefined' || document.body.classList.contains('title-scene') === on) return;
  document.body.classList.toggle('title-scene', on);
  window.dispatchEvent(new Event('resize'));
}
