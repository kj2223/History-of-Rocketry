// The point-mass entry model (V2 freeze §6.1). Pure mathematics: no game state, no hidden data, no random
// draws. physics.js gives it the true vehicle, the true retrofire and any wrong ground-supplied number, and
// keeps what it returns in the physical layer. Nobody sees these numbers directly.
//
// Planar flight over a spherical, non-rotating Earth: gravity, an exponential atmosphere, drag and lift.
// Mercury flies ballistic (its slow roll cancels lift); Gemini steers its lift with bank angle. Distances
// are along the ground track from the planned retrofire point; positive is downrange.

const MU = 3.986004e14, RE = 6371e3, RHO0 = 1.225, SCALE_HEIGHT = 7200, G0 = 9.80665;
const SUTTON_GRAVES = 1.7415e-4; // W m^-2 for air, with density in kg/m^3, velocity in m/s and nose radius in m
const ENTRY_INTERFACE = 120e3, CHUTES = 10e3;

const density = h => RHO0 * Math.exp(-Math.max(h, 0) / SCALE_HEIGHT);

// One step of the equations of motion in polar coordinates (r, θ, radial and tangential velocity).
const derivatives = (s, v) => {
  const [r, , vr, vt] = s, h = r - RE, speed = Math.hypot(vr, vt);
  const rho = density(h), q = 0.5 * rho * speed * speed;
  const drag = q / v.beta, lift = drag * v.ld * Math.cos(v.bank ?? 0);
  // Drag acts against velocity; lift acts perpendicular to it, upward for a positive cos(bank).
  const ax = speed ? -drag * vr / speed + lift * vt / speed : 0;
  const ay = speed ? -drag * vt / speed - lift * vr / speed : 0;
  return [vr, vt / r, -MU / (r * r) + vt * vt / r + ax, -vr * vt / r + ay, { q, rho, speed, decel: Math.hypot(drag, lift) }];
};

const rk4 = (s, v, dt) => {
  const add = (a, b, k) => a.map((x, i) => x + b[i] * k);
  const k1 = derivatives(s, v), k2 = derivatives(add(s, k1, dt / 2), v), k3 = derivatives(add(s, k2, dt / 2), v), k4 = derivatives(add(s, k3, dt), v);
  return { next: s.map((x, i) => x + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])), info: k1[4] };
};

// Fly from a state to the chute altitude. Returns where it came down and the loads on the way.
const descend = (start, v) => {
  let s = [...start], t = 0, peakG = 0, heat = 0, blackout = 0;
  while (s[0] - RE > CHUTES && t < 20000) {
    const inAir = s[0] - RE < ENTRY_INTERFACE, dt = inAir ? 0.5 : 5;
    const { next, info } = rk4(s, v, dt);
    if (inAir) {
      peakG = Math.max(peakG, info.decel / G0);
      heat += SUTTON_GRAVES * Math.sqrt(info.rho / v.noseRadius) * info.speed ** 3 * dt;
      if (info.speed > 5500 && s[0] - RE < 95e3) blackout += dt;
    }
    s = next; t += dt;
  }
  return { range: s[1] * RE, peakG, heatLoad: heat / 1e6, blackout, time: t };
};

// The state just after retrofire from a circular orbit. Thrust acts against the direction of flight, pitched
// down by `pitch` and turned out of plane by `yaw`; only the in-plane part slows the capsule.
const afterRetro = (v, { dv, pitch, yaw, late }) => {
  const r = RE + v.orbitAltitude, vc = Math.sqrt(MU / r);
  const along = dv * Math.cos(pitch) * Math.cos(yaw), down = dv * Math.sin(pitch) * Math.cos(yaw);
  // Firing late moves the retrofire point, and so the whole footprint, downrange.
  return [r, (vc / r) * late, -down, vc - along];
};

// A suborbital arc starts at its apogee, flying level.
const fromApogee = v => [RE + v.apogee, 0, 0, v.apogeeSpeed];

// Gemini's guidance chooses the bank angle that lands it where it believes the target is.
const steer = (start, v, target) => {
  const at = bank => descend(start, { ...v, bank }).range;
  let lo = 0, hi = Math.PI; // full lift up flies longest, full lift down shortest
  if (target >= at(lo)) return lo;
  if (target <= at(hi)) return hi;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (at(mid) > target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
};

// The whole entry. `retro` is what actually happened: { dvScale, pitchError, yawError, late } (radians, s).
// `navError` (m) is how far the guidance computer's idea of the target is from the real one.
export const flyEntry = (v, retro = {}, navError = 0) => {
  if (v.suborbital) return { ...descend(fromApogee(v), v), miss: 0 };
  const planned = { dv: v.retroDv, pitch: v.retroPitch, yaw: 0, late: 0 };
  const actual = { dv: v.retroDv * (1 + (retro.dvScale ?? 0)), pitch: v.retroPitch + (retro.pitchError ?? 0), yaw: retro.yawError ?? 0, late: retro.late ?? 0 };
  const lifting = v.ld > 0;
  const nominalBank = lifting ? v.nominalBank : 0;
  const aim = descend(afterRetro(v, planned), { ...v, bank: nominalBank }).range;
  const start = afterRetro(v, actual);
  // The computer steers for the target it believes in; a wrong ground-supplied number moves that target.
  const bank = lifting ? steer(start, v, aim + navError) : 0;
  const out = descend(start, { ...v, bank });
  return { ...out, aim, miss: out.range - aim, bank };
};

export const KM_PER_MILE = 1.609344;
