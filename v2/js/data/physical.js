// HIDDEN PHYSICAL TRUTH (freeze §4.1). Only js/rules/physics.js may import this file.
// Mechanism IDs here are deliberately opaque and unrelated to engineering hypothesis IDs.

// True nominal value of each quantity for the baseline vehicle.
export const BASE = {
  wac: { 'wac-upper.chamber-pressure': 20, 'vehicle.apogee': 70, 'vehicle.deviation': 2.5 },
  aerobee: { 'aerobee-sustainer.wall-temp': 610, 'aerobee-sustainer.chamber-pressure': 20.5, 'vehicle.apogee': 110, 'vehicle.deviation': 1.5 },
  viking: { 'viking.chamber-pressure': 21, 'vehicle.apogee': 170, 'vehicle.deviation': 1 },
  bumper: { 'v2.chamber-pressure': 15.5, 'wac-upper.chamber-pressure': 20, 'v2|wac-upper.separation': 0.2, 'vehicle.apogee': 390, 'vehicle.deviation': 2 },
  // V2. Apogee in km: a Redstone arc tops out near 187 km, an orbit near 260 km, a missile's arc far higher.
  'mercury-redstone': { 'redstone.chamber-pressure': 22, 'mercury-capsule.cabin-pressure': 0.38, 'vehicle.apogee': 187, 'vehicle.deviation': 1.5 },
  'mercury-atlas': { 'atlas.chamber-pressure': 41, 'mercury-capsule.cabin-pressure': 0.38, 'vehicle.apogee': 260, 'vehicle.deviation': 1 },
  'gemini-titan': { 'titan-ii.chamber-pressure': 54, 'gemini.cabin-pressure': 0.37, 'vehicle.apogee': 280, 'vehicle.deviation': 1 },
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
