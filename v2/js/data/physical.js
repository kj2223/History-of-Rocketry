// HIDDEN PHYSICAL TRUTH (freeze §4.1). Only js/rules/physics.js may import this file.
// Mechanism IDs here are deliberately opaque and unrelated to engineering hypothesis IDs.

// True nominal value of each quantity for the baseline vehicle.
export const BASE = {
  wac: { 'wac-upper.chamber-pressure': 20, 'vehicle.apogee': 70, 'vehicle.deviation': 2.5 },
  aerobee: { 'aerobee-sustainer.wall-temp': 610, 'aerobee-sustainer.chamber-pressure': 20.5, 'vehicle.apogee': 110, 'vehicle.deviation': 1.5 },
  viking: { 'viking.chamber-pressure': 21, 'vehicle.apogee': 170, 'vehicle.deviation': 1 },
  bumper: { 'v2.chamber-pressure': 15.5, 'wac-upper.chamber-pressure': 20, 'v2|wac-upper.separation': 0.2, 'vehicle.apogee': 390, 'vehicle.deviation': 2 },
  // V2. Apogee in km: a Redstone arc tops out near 187 km, an orbit near 260 km, a missile's arc far higher.
  'mercury-redstone': { 'redstone.chamber-pressure': 22, 'mercury-capsule.cabin-pressure': 0.38, 'vehicle.apogee': 187, 'vehicle.deviation': 1.5, 'vehicle.abort-sensing': 0.2 },
  'mercury-atlas': { 'atlas.chamber-pressure': 41, 'mercury-capsule.cabin-pressure': 0.38, 'vehicle.apogee': 260, 'vehicle.deviation': 1, 'vehicle.abort-sensing': 0.2 },
  'gemini-titan': { 'titan-ii.chamber-pressure': 54, 'gemini.cabin-pressure': 0.37, 'vehicle.apogee': 280, 'vehicle.deviation': 1, 'vehicle.abort-sensing': 0.2 },
  'atlas-icbm': { 'atlas.chamber-pressure': 41, 'vehicle.apogee': 1300, 'vehicle.deviation': 1.5 },
  'titan-icbm': { 'titan-ii.chamber-pressure': 54, 'vehicle.apogee': 1300, 'vehicle.deviation': 1 },
};

// What each revision really does to true values (the coupled performance cost included).
export const REVISION_EFFECTS = {
  'aerobee-sustainer/r2': { 'aerobee-sustainer.wall-temp': -20, 'vehicle.apogee': -6 },
  'wac-upper/r2': { 'v2|wac-upper.separation': -0.1, 'vehicle.apogee': 4 },
};

// Relative noise of the true value from article to article and run to run.
export const SCATTER = 0.015;

// Mechanisms present in hardware. A mechanism acts on revisions of its stage unless a revision in the
// chain is listed in `absentFrom`. `effects` show whenever it is active; `onFailure` shows only on the
// flights it actually brings down.
export const MECHANISMS = {
  'pm-07': {
    stage: 'aerobee-sustainer',
    absentFrom: ['aerobee-sustainer/r2'],
    when: { burn: 'long' },
    effects: { 'aerobee-sustainer.wall-temp': 180 },
    flightFailureChance: 0.25,
  },
  // Captured V-2s were old, reassembled hardware; roughly a third failed at White Sands.
  // A short stand firing shows it as low chamber pressure at start-up.
  'pm-03': { stage: 'v2', absentFrom: ['v2/r2'], when: { burn: 'short' }, effects: { 'v2.chamber-pressure': -3.5 }, flightFailureChance: 0.3 },
  // Early WAC Corporal firings lost a fair share of rounds to ignition and feed trouble.
  // A short stand firing shows it as a rough, low-pressure start.
  'pm-11': { stage: 'wac-upper', absentFrom: ['wac-upper/r3'], when: { burn: 'short' }, effects: { 'wac-upper.chamber-pressure': -5 }, flightFailureChance: 0.2 },
  // Early Vikings lost flights to premature motor cutoff. Only a full-duration stand firing shows it,
  // as chamber pressure sagging late in the burn.
  'pm-19': { stage: 'viking', absentFrom: ['viking/r2'], when: { burn: 'long' }, effects: { 'viking.chamber-pressure': -5 }, flightFailureChance: 0.25 },
  // ---- V2 ----
  // Mercury-Redstone 1 shut down a few inches off the pad when its tail plugs pulled out in the wrong order.
  // A short stand firing shows the cutoff circuit dropping chamber pressure at start-up.
  'pm-31': { stage: 'redstone', absentFrom: ['redstone/r2'], when: { burn: 'short' }, effects: { 'redstone.chamber-pressure': -4 }, flightFailureChance: 0.2 },
  // Early Atlas engines suffered rough combustion at ignition. Present in the military Atlas D too, so the
  // military flight record shows its losses.
  'pm-41': { stage: 'atlas', absentFrom: ['atlas/lv3b-r2'], when: { burn: 'short' }, effects: { 'atlas.chamber-pressure': -5 }, flightFailureChance: 0.2 },
  // Titan II pogo: longitudinal oscillation late in the first-stage burn. Rarely lost a missile, but the
  // loads were beyond what a crew could work through.
  'pm-51': { stage: 'titan-ii', absentFrom: ['titan-ii/glv-r2'], when: { burn: 'long' }, effects: { 'titan-ii.chamber-pressure': -6 }, flightFailureChance: 0.1 },
  // A Mercury hatch seal that leaks over a mission-length soak.
  'pm-61': { stage: 'mercury-capsule', absentFrom: ['mercury-capsule/r2'], when: { burn: 'long' }, effects: { 'mercury-capsule.cabin-pressure': -0.07 }, flightFailureChance: 0.05 },
};

// Mechanisms every new V1 campaign starts with, besides the worked-case defect.
export const LATENT = ['pm-03', 'pm-11', 'pm-19'];
// Mechanisms present in Mercury and Gemini hardware, whichever way V2 opens.
export const LATENT_V2 = ['pm-31', 'pm-41', 'pm-51', 'pm-61'];

// ---- V2: entry and recovery (V2 freeze §6) ----
const DEG = Math.PI / 180;

// The true flight-path physics of each spacecraft for the entry model (rules/entry-model.js). Ballistic
// coefficient in kg/m², lift-to-drag ratio, heat-shield nose radius in m, retrofire Δv in m/s and its pitch
// below the flight direction. Mercury flies ballistic; Gemini banks its lift. A Redstone arc starts at apogee.
const MERCURY = { beta: 260, ld: 0, noseRadius: 2.4, retroDv: 170, retroPitch: 34 * DEG, orbitAltitude: 160e3 };
export const ENTRY_VEHICLES = {
  'mercury-redstone': { ...MERCURY, suborbital: true, apogee: 187e3, apogeeSpeed: 1250 },
  'mercury-atlas': { ...MERCURY },
  'gemini-titan': { beta: 340, ld: 0.19, noseRadius: 2.3, retroDv: 100, retroPitch: 20 * DEG, orbitAltitude: 160e3, nominalBank: 60 * DEG },
};

// How far retrofire really departs from plan, one flight to the next: Δv as a fraction, attitude in
// radians, timing in s. Now and then the attitude reference itself is off (MA-7's horizon scanner), which
// gives a large yaw error; rarely a retro rocket fails to fire and the burn falls short.
export const RETRO_ERRORS = {
  dvScale: 0.01, pitch: 1 * DEG, yaw: 1.5 * DEG, late: 0.5,
  attitudeFaultChance: 0.08, attitudeFault: 20 * DEG,
  shortBurnChance: 0.02, shortBurn: 0.33,
};

// The heat shield and the capsule in the water. A shield is safe well below its true capacity; nearer it,
// and beyond it, burn-through grows likely (V2 freeze §6.2: chemistry is not simulated, only the odds).
// Water gets into a floating capsule at its true leak rate, and it sinks once it has taken on enough.
export const SPACECRAFT_TRUTH = {
  'mercury-capsule': { heatCapacity: 115, leakPerHour: 6, sinksAt: 150 },
  gemini: { heatCapacity: 150, leakPerHour: 2.5, sinksAt: 200 },
};
// Burn-through is impossible below this share of capacity, certain at `certainAt` of it, and rises as a square between.
export const BURN_THROUGH = { safeBelow: 0.8, certainAt: 1.2 };

// ---- V2: Gemini mission objectives (V2 freeze §5) ----
// True values for each objective reading on the first Gemini spacecraft. Fuel cell output falls by `sagPerDay`
// over the flight. A spacewalk with nothing to brace against costs far more effort than the planners think.
// Objective readings vary much more from flight to flight than engine readings.
export const OBJECTIVE_TRUTH = {
  'gemini.fuel-cell-output': { base: 1, sagPerDay: 0.045 },
  'gemini.eva-workload': { base: 1.35 },
  'gemini.rendezvous-error': { base: 1.6 },
  'gemini.docking-misalignment': { base: 3 },
};
export const OBJECTIVE_REVISION_EFFECTS = {
  'gemini/r2': { 'gemini.fuel-cell-output': { sagPerDay: 0.008 } },
  'gemini/r3': { 'gemini.eva-workload': { base: 0.6 } },
};
export const OBJECTIVE_SCATTER = 0.12;
