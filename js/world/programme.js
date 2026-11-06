// THE WAC PROGRAMME AS THE TEAM KNOWS IT: what has been flown, what has been fixed, and the drawing office's estimate.
// It carries from round to round. The fixes are what the review decided, right or wrong: a fix for the wrong cause
// changes nothing that matters, and the real fault stays as likely as before.

// How likely each fault is on a new round before any fix (hidden from the player, but the team's fixes move them).
export const initProgramme = () => ({ igniter: 'wac-upper/r1', weldRisk: 0.55, leakRisk: 0.45, flights: [], adopted: [] });

// What the review decided, turned into a standing change to how rounds are built. Returns the line Ellis gives, or null.
const FIXES = {
  ignition: { text: 'Every upper stage now gets the reworked igniter as standard.', apply: p => { p.igniter = 'wac-upper/r3'; } },
  weld: { text: 'Every tank seam is now X-rayed before the stage leaves the shop.', apply: p => { p.weldRisk *= 0.4; } },
  leak: { text: 'Every fitting is now pressure-tested and safety-wired before rollout.', apply: p => { p.leakRisk *= 0.4; } },
};
export function adopt(programme, cause) {
  const fix = FIXES[cause];
  if (!fix || programme.adopted.includes(cause)) return null;
  fix.apply(programme);
  programme.adopted.push(cause);
  return fix.text;
}

// A flight the radar tracked to its peak. Only good flights tell the drawing office about the vehicle's performance.
export function recordFlight(programme, { load, apogee, failure }) {
  programme.flights.push({ load, apogee: failure ? null : apogee, failure: failure || null });
}

// The drawing office's apogee estimate for a propellant load (share of full, 0.85–1). Before anything has flown it is
// the paper figure with a wide spread. Each good flight pulls the middle toward what the radar saw and narrows it.
const loadFactor = load => (0.55 + 0.45 * load) ** 2;
export const PAPER_APOGEE = 62; // km for a full load: the office's pre-flight figure, a little pessimistic
export function estimate(programme, load) {
  const good = programme.flights.filter(f => f.apogee != null);
  const seen = good.map(f => f.apogee / loadFactor(f.load));
  const full = (PAPER_APOGEE + seen.reduce((a, b) => a + b, 0)) / (1 + seen.length);
  const spread = 0.18 / (1 + 0.8 * seen.length);
  const mid = full * loadFactor(load);
  return { low: Math.round(mid * (1 - spread)), high: Math.round(mid * (1 + spread)), flights: seen.length };
}
