// START-UP: build the UI, then run the game clock once per second.
// Time controls: pause, 1x, 2x, 4x. While the launch view is open the game runs at 1x at most. The game saves every ten seconds and on close.
import { S, save } from './core/state.js';
import { createClock } from './core/clock.js';
import { tickSecond, daysPerSecond } from './rules/game.js';
import { autoLaunch } from './rules/auto.js';
import { initUI, render, refreshTimers, needsRender, markDirty } from './ui/screen.js';
import { launchView, isBusy, isCounting, startDirectorCount } from './ui/launch-view.js';
import { workTrajectoryTeam } from './ui/trajectory.js';
import './ui/input.js';

initUI();
let seconds = 0;
// `elapsed` is whole seconds of real time: 1 on a normal tick, or one clamped catch-up when the page returns from being hidden.
const gameStep = elapsed => {
  const ticks = (isBusy() ? Math.min(1, S.speed ?? 1) : (S.speed ?? 1)) * elapsed;
  // The launch director waits while you count down a rocket of your own: one launch on the range at a time.
  for (let i = 0; i < ticks; i++) if (tickSecond() | (!isCounting() && autoLaunch())) markDirty();
  // A first you are attending: Ellis has it on the pad, and the count runs in Watch.
  if (S.auto.pad && !launchView.count) startDirectorCount();
  if (ticks && workTrajectoryTeam(ticks * daysPerSecond())) markDirty();
  if (needsRender()) render();
  else refreshTimers();
  seconds += elapsed;
  if (seconds >= 10) { seconds %= 10; save(); }
};
// The clock stops while the page is hidden and applies one clamped catch-up on return.
const clock = createClock(gameStep);
document.addEventListener('visibilitychange', () => document.hidden ? clock.pause() : clock.resume());
// Closing the window saves too, so the last seconds of play are not lost.
window.addEventListener('beforeunload', save);
