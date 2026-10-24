// START-UP: build the UI, then run the game clock once per second.
// Time controls: pause, 1x, 2x, 4x. While the launch view is open the game runs at 1x at most. The game saves every ten seconds.
import { S, save } from './core/state.js';
import { tickSecond, daysPerSecond } from './rules/game.js';
import { autoLaunch } from './rules/auto.js';
import { initUI, render, refreshTimers, needsRender, markDirty } from './ui/screen.js';
import { isBusy } from './ui/launch-view.js';
import { workTrajectoryTeam } from './ui/trajectory.js';
import './ui/input.js';

initUI();
let seconds = 0;
setInterval(() => {
  const ticks = isBusy() ? Math.min(1, S.speed ?? 1) : (S.speed ?? 1);
  for (let i = 0; i < ticks; i++) if (tickSecond() | autoLaunch()) markDirty();
  if (ticks && workTrajectoryTeam(ticks * daysPerSecond())) markDirty();
  if (needsRender()) render();
  else refreshTimers();
  if (++seconds % 10 == 0) save();
}, 1000);
