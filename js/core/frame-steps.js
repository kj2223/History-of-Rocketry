// THE FRAME CLOCK: how a frame's real time is handed to the game. The game moves in steps of at most MAX_STEP seconds
// (so a walk or a firing never jumps), but every real second is played: a slow frame is played as several steps
// instead of being cut short. Before v0.8 a frame gave the game at most 0.05 s, so when a scene drew slowly (the PixiJS
// rooms at a few frames a second on some machines) the whole game slowed with it: a ten-second firing count took
// minutes. A stall longer than MAX_CATCH_UP (the window hidden, the machine asleep) is not caught up.
export const MAX_STEP = 0.05,
  MAX_CATCH_UP = 0.5;
export function frameSteps(seconds) {
  let left = Math.max(0, Math.min(MAX_CATCH_UP, seconds));
  const steps = [];
  while (left > 1e-9) {
    const s = Math.min(MAX_STEP, left);
    steps.push(s);
    left -= s;
  }
  return steps;
}
