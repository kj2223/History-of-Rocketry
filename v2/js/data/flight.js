// Public flight-operations content (V2 freeze §6.3, §6.4): what Flight Control's own analysts predict for an
// entry, the recovery forces the agency can position, and the Retrofire officer's working figures.
// These are the agency's design estimates and plans. The true physics lives in physical.js. Provisional.

// The engineers' prediction for a nominal entry of each crewed vehicle, and how wide tracking leaves the
// footprint (one standard deviation along the track, km). The spacecraft's own entry claims are scoped to
// the loads its evidence covers; a vehicle predicted to exceed that envelope is not ready for crew.
export const ENTRY_DESIGN = {
  'mercury-redstone': { spacecraft: 'mercury-capsule', heatLoad: 1.3, peakG: 10, footprint: 20, retro: false },
  'mercury-atlas': { spacecraft: 'mercury-capsule', heatLoad: 80, peakG: 8, footprint: 30, retro: true },
  'gemini-titan': { spacecraft: 'gemini', heatLoad: 115, peakG: 4.5, footprint: 15, retro: true },
};

// The quantities an entry and recovery produce. The spacecraft claims are evidence for the hardware; the
// landing point and the blackout are records of the flight, not claims about the hardware.
export const ENTRY_CLAIMS = spacecraft => [`${spacecraft}.heat-load`, `${spacecraft}.entry-g`, `${spacecraft}.water-ingress`];
export const ENTRY_RECORDS = ['vehicle.landing-miss', 'vehicle.blackout'];

// Where an early retrofire is timed to come down: contingency areas back along the track from the planned
// point, in km. Flight Control picks the next one the spacecraft can reach when the crew calls it.
export const CONTINGENCY_AREAS = [-1500, -3000, -4500];

// Recovery forces (V2 freeze §6.4). Stations are distances along the ground track from the predicted
// landing point, in km. A helicopter reaches anything within its radius of a station; beyond that a ship
// steams there. Costs are per flight.
export const RECOVERY_FORCES = {
  minimal: { name: 'one destroyer at the predicted point', stations: [0], helicopters: false, cost: 80000 },
  primary: { name: 'a carrier group with helicopters at the predicted point', stations: [0], helicopters: true, cost: 250000 },
  extended: { name: 'a carrier group at the predicted point and destroyers in contingency areas along the track', stations: [...CONTINGENCY_AREAS, 0, 1500], helicopters: true, cost: 450000 },
};
export const RECOVERY_SPEEDS = { helicopterRadius: 120, helicopter: 160, ship: 45, hookup: 0.4 }; // km, km/h, km/h, h

// Retrofire data (V2 freeze §6.3). The Retrofire officer computes it and Flight Control sends it; an
// independent check costs analyst time on every flight. A wrong number is a timing error for a ballistic
// capsule and a wrong target for Gemini's guidance computer.
export const RETROFIRE = {
  baseErrorChance: 0.12, workloadPerFlight: 0.35, independentCheckCatches: 0.75, independentCheckCost: 15000,
  wrongTime: [4, 12], // s
  wrongTarget: [60e3, 160e3], // m
};

export const CREW_CONDITION = [[3, 'good'], [8, 'tired'], [Infinity, 'exhausted']]; // hours in the water

// Hours from splashdown to pickup for a landing `missKm` along the track from the predicted point.
export const pickupHours = (missKm, force) => {
  const f = RECOVERY_FORCES[force], sp = RECOVERY_SPEEDS;
  const nearest = Math.min(...f.stations.map(x => Math.abs(missKm - x)));
  const travel = f.helicopters && nearest <= sp.helicopterRadius ? nearest / sp.helicopter : nearest / sp.ship;
  return sp.hookup + travel;
};
export const crewCondition = hours => CREW_CONDITION.find(([h]) => hours <= h)[1];
