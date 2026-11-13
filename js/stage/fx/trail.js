// THE TRACKING CAMERA'S SMOKE TRAIL (issue #246): a plain model, no Pixi, so it can be tested in node. The camera
// keeps the rocket in the middle of its frame, so the smoke she leaves streams down the picture. The trail is fed by
// spacing, not by frame: every step the gap between the newest puff and the nozzle is filled with puffs a fixed
// distance apart, so the column always reaches her flame however fast she climbs or the clock runs. Every puff moves
// by the same amount each step, so the spacing holds as they drift. When there are too many the oldest goes, never
// the newest (a cap that refused new puffs is what broke the trail up). Puffs only ever fade: no brightness pulses.

export const TRAIL_MAX = 240;
const FILL_MAX = 60; // puffs added in one step at most; past that the gap is bridged straight to the nozzle

export function makeTrail() {
  return { puffs: [] };
}

// o: { burning, nx, ny (the nozzle), size (a new puff's scale), spacing (px between puffs), drift (px down this step),
//      dt (real seconds), alpha (a new puff's alpha), bottom (y past which puffs are dropped) }
export function stepTrail(trail, o) {
  const P = trail.puffs;
  for (const q of P) {
    q.y += o.drift;
    q.size += o.dt * 0.12;
    q.alpha = Math.max(0, q.alpha - o.dt * 0.12);
  }
  for (let i = P.length - 1; i >= 0; i--) if (P[i].alpha <= 0 || P[i].y > o.bottom) P.splice(i, 1);
  if (o.burning) {
    const sp = Math.max(0.5, o.spacing);
    const last = P[P.length - 1];
    if (!last) P.push(puff(o.nx, o.ny, o));
    else {
      let lx = last.x,
        ly = last.y;
      const d = Math.hypot(o.nx - lx, o.ny - ly);
      const n = Math.floor(d / sp);
      if (n > FILL_MAX) P.push(puff(o.nx, o.ny, o));
      else
        for (let i = 1; i <= n; i++) {
          lx = last.x + ((o.nx - last.x) * i * sp) / d;
          ly = last.y + ((o.ny - last.y) * i * sp) / d;
          P.push(puff(lx, ly, o));
        }
    }
    while (P.length > TRAIL_MAX) P.shift();
  }
  return P;
}

function puff(x, y, o) {
  return { x, y, size: o.size, alpha: o.alpha };
}
