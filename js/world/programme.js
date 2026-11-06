// THE PROGRAMME AS THE TEAM KNOWS IT: what has been flown, what has been fixed, and the drawing office's estimates.
// It carries from round to round, and from the WAC rounds into Bumper, whose upper stage is a WAC. The fixes are what the
// reviews decided, right or wrong: a fix for the wrong cause changes nothing that matters, and the real fault stays as
// likely as before.

// How likely each fault is on a new round before any fix (hidden from the player, but the team's fixes move them).
export const initProgramme = () => ({ igniter: 'wac-upper/r1', turbopump: 'v2/r1', weldRisk: 0.55, leakRisk: 0.45, vaneRisk: 0.4, sepRisk: 0.35, flights: [], adopted: [] });

// What the review decided, turned into a standing change to how rounds are built. Returns the line Ellis gives, or null.
const FIXES = {
  ignition: { text: 'Every WAC upper stage now gets the reworked igniter as standard.', apply: p => { p.igniter = 'wac-upper/r3'; } },
  weld: { text: 'Every tank seam is now X-rayed before the stage leaves the shop.', apply: p => { p.weldRisk *= 0.4; } },
  leak: { text: 'Every fitting is now pressure-tested and safety-wired before rollout.', apply: p => { p.leakRisk *= 0.4; } },
  turbopump: { text: 'Every V-2 now has its turbopump and steam generator refurbished before it leaves the hangar.', apply: p => { p.turbopump = 'v2/r2'; } },
  vanes: { text: 'Every graphite jet vane now goes under a lens, and any with a crack is replaced.', apply: p => { p.vaneRisk *= 0.4; } },
  separation: { text: 'Every separation bolt and firing lead is now tested on the bench before it goes on the stack.', apply: p => { p.sepRisk *= 0.4; } },
};
export function adopt(programme, cause) {
  const fix = FIXES[cause];
  if (!fix || programme.adopted.includes(cause)) return null;
  fix.apply(programme);
  programme.adopted.push(cause);
  return fix.text;
}
// The standing fixes so far, in Ellis's words, for the news between rounds.
export const fixesInForce = programme => programme.adopted.map(c => FIXES[c]?.text).filter(Boolean);

// A flight the radar tracked to its peak. Only good flights tell the drawing office about the vehicle's performance.
export function recordFlight(programme, { vehicle = 'wac', load, apogee, failure }) {
  programme.flights.push({ vehicle, load, apogee: failure ? null : apogee, failure: failure || null });
}
// The highest peak the radar has seen on this range so far, in km (0 before anything has flown well).
export const rangeRecord = programme => Math.max(0, ...programme.flights.map(f => f.apogee ?? 0));

// The drawing office's apogee estimate for a propellant load (share of full, 0.85–1). Before anything has flown it is
// the paper figure with a wide spread. Each good flight of the same kind pulls the middle toward what the radar saw and
// narrows it.
const loadFactor = load => (0.55 + 0.45 * load) ** 2;
// km for a full load: the office's pre-flight figures, a little pessimistic. A Bumper has never flown, so its spread is widest.
export const PAPER = { wac: { apogee: 62, spread: 0.18 }, v2: { apogee: 140, spread: 0.22 }, bumper: { apogee: 300, spread: 0.3 } };
export const PAPER_APOGEE = PAPER.wac.apogee;
export function estimate(programme, vehicle = 'wac', load = 1) {
  if (typeof vehicle === 'number') { load = vehicle; vehicle = 'wac'; } // estimate(programme, load) means a WAC
  const paper = PAPER[vehicle];
  const good = programme.flights.filter(f => (f.vehicle || 'wac') === vehicle && f.apogee != null);
  const seen = good.map(f => f.apogee / loadFactor(f.load));
  const full = (paper.apogee + seen.reduce((a, b) => a + b, 0)) / (1 + seen.length);
  const spread = paper.spread / (1 + 0.8 * seen.length);
  const mid = full * loadFactor(load);
  return { low: Math.round(mid * (1 - spread)), high: Math.round(mid * (1 + spread)), flights: seen.length };
}
