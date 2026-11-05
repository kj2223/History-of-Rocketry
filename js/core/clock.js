// GAME CLOCK: runs `step` once per second, stops while the page is hidden, and on return applies one clamped catch-up.
// Browsers throttle hidden-tab timers unpredictably, so elapsed time is measured by the wall clock instead of counted.
export const MAX_CATCHUP_SECONDS = 60;
export const catchUpSeconds = (hiddenMs) => Math.max(0, Math.min(MAX_CATCHUP_SECONDS, Math.floor(hiddenMs / 1000)));
export function createClock(step, { now = Date.now, setTimer = setInterval, clearTimer = clearInterval } = {}) {
  let timer = null, hiddenAt = null;
  const start = () => { timer = setTimer(() => step(1), 1000); };
  const pause = () => {
    if (hiddenAt != null) return;
    hiddenAt = now();
    clearTimer(timer); timer = null;
  };
  const resume = () => {
    if (hiddenAt == null) return;
    const seconds = catchUpSeconds(now() - hiddenAt);
    hiddenAt = null;
    if (seconds) step(seconds);
    start();
  };
  start();
  return { pause, resume };
}
