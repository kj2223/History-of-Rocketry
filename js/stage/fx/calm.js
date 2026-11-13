// PHOTOSENSITIVITY (Aaron, 13 Nov: the film flicker was hard to look at, and a seizure risk). Every effect in js/stage/fx
// keeps to these rules:
// - no flashing: nothing on screen changes brightness over a large area more than once in a burst, and never
//   repeatedly (well under the three-flashes-a-second limit); the film has no brightness flicker at all;
// - one-off brightenings (ignition, an explosion) are capped at FLASH_MAX and ramp in and out instead of popping;
// - fine detail that changes every frame (film grain) is faint and changes at film speed, not screen speed.
// "Calm effects" switches off the shake, the brightenings and the grain entirely. It is on when the computer asks for
// reduced motion, or from the dev menu (localStorage 'pa-calm' = 'on').
export const CALM_KEY = 'pa-calm';
export const FLASH_MAX = 0.22;

let media = null;
export function calm() {
  try {
    if (localStorage.getItem(CALM_KEY) === 'on') return true;
  } catch {
    /* no storage: fall through */
  }
  media ??= globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: false };
  return !!media.matches;
}

// A one-off brightening at `since` seconds after its cause: up over `rise`, down over `fall`, never above `peak`.
export function swell(since, peak, rise = 0.12, fall = 0.8) {
  if (since < 0 || since > rise + fall) return 0;
  const k = since < rise ? since / rise : 1 - (since - rise) / fall;
  return Math.min(FLASH_MAX, peak) * (k * k * (3 - 2 * k)); // smoothstep: no hard edge
}
