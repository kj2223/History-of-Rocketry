// START-UP: build the UI, then run the game clock once per second.
// Time controls: pause, 1x, 2x, 4x. While the launch view is open the game runs at 1x at most. The game saves every ten seconds and on close.
import { S, save } from './core/state.js';
import { tickSecond, daysPerSecond } from './rules/game.js';
import { autoLaunch } from './rules/auto.js';
import { initUI, render, refreshTimers, needsRender, markDirty } from './ui/screen.js';
import { launchView, isBusy, isCounting, startDirectorCount } from './ui/launch-view.js';
import { workTrajectoryTeam } from './ui/trajectory.js';
import './ui/input.js';

initUI();
let seconds = 0;
setInterval(() => {
  const ticks = isBusy() ? Math.min(1, S.speed ?? 1) : (S.speed ?? 1);
  // The launch director waits while you count down a rocket of your own: one launch on the range at a time.
  for (let i = 0; i < ticks; i++) if (tickSecond() | (!isCounting() && autoLaunch())) markDirty();
  // A first you are attending: Ellis has it on the pad, and the count runs in Watch.
  if (S.auto.pad && !launchView.count) startDirectorCount();
  if (ticks && workTrajectoryTeam(ticks * daysPerSecond())) markDirty();
  if (needsRender()) render();
  else refreshTimers();
  if (++seconds % 10 == 0) save();
}, 1000);
// Closing the window saves too, so the last seconds of play are not lost.
window.addEventListener('beforeunload', save);
