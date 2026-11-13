// When the pad blast happened, by the game's clock (issue #250). The site scene may not be on screen when she blows up:
// the player can be in the blockhouse or on the range plot, and come out to the site an hour later. The fireball,
// flash and shake belong to the moment; anyone arriving later sees only the aftermath: the scorch, the pieces lying
// where they fell, and a thin column of smoke thinning through the day. Plain numbers, no Pixi, for the tests.

export const AFTERMATH_MIN = 2; // game minutes after the blast past which the site shows only its aftermath

export const blastAge = (b, g) => (b?.clock == null || g?.clock == null ? 0 : Math.max(0, g.clock - b.clock));
export const aftermath = (b, g) => blastAge(b, g) > AFTERMATH_MIN;

// How many smoke puffs a second rise from the pad: a thick column at first, thinning over the next hour or two to a
// wisp. since: real seconds this scene has watched it; age: game minutes since the blast.
export function columnRate(since, age = 0) {
  const fresh = since < 20 ? 6 : 6 * Math.exp(-(since - 20) / 60);
  const later = 2.5 * Math.exp(-age / 90);
  return Math.max(0.3, Math.min(fresh, later > 0 && age > AFTERMATH_MIN ? later : fresh));
}

// Where a piece thrown out at (x, y) with velocity (vx, vy) comes to rest on the ground (gravity 260, as blast.js).
export function landing(x, y, vx, vy, ground) {
  const t = (vy + Math.sqrt(vy * vy + 4 * 130 * Math.max(0, ground - y))) / 260;
  return x + vx * t;
}
