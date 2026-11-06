// The minimal facility catalogue (freeze §6.1). Exclusive kinds take one reservation at a time per unit;
// shared kinds take up to `capacity` overlapping reservations.

export const FACILITY_KINDS = {
  range: { name: 'Range and pads', exclusive: true, enables: ['flight', 'pad-firing', 'checkout'] },
  'static-stand': { name: 'Static test stand', exclusive: true, enables: ['ground'] },
  'environmental-chamber': { name: 'Environmental chamber', exclusive: true, enables: ['environmental'] },
  'structural-rig': { name: 'Structural rig', exclusive: true, enables: ['structural'] },
  'instrumentation-lab': { name: 'Instrumentation lab', exclusive: false, enables: ['calibration'] },
  'integration-space': { name: 'Integration space', exclusive: false, enables: ['integration-assessment', 'assembly'] },
  tracking: { name: 'Tracking', exclusive: false, enables: ['flight'] },
  archive: { name: 'Archive', exclusive: false, enables: ['records'] },
};

// White Sands at the start of 1945.
export const STARTING_UNITS = [
  { id: 'pad-1', kind: 'range', capacity: 1 },
  { id: 'stand-1', kind: 'static-stand', capacity: 1 },
  { id: 'instrument-lab', kind: 'instrumentation-lab', capacity: 2 },
  { id: 'integration-1', kind: 'integration-space', capacity: 2 },
  { id: 'tracking-1', kind: 'tracking', capacity: 1 },
  { id: 'archive-hq', kind: 'archive', capacity: 1 },
];

// V2 (V2 freeze §3). NASA formation transfers NACA's laboratory test facilities, whichever way V2 opens.
export const NACA_TRANSFER = [
  { id: 'env-1', kind: 'environmental-chamber', capacity: 1, name: 'Langley environmental chamber' },
  { id: 'struct-1', kind: 'structural-rig', capacity: 1, name: 'Langley structures laboratory' },
];

// The standard 1958 agency for a fresh start: Cape Canaveral pads, a stand, tracking and records.
// Unit ids match V1's so the same tools and screens work with either opening.
export const STARTING_UNITS_1958 = [
  { id: 'pad-1', kind: 'range', capacity: 1, name: 'Launch Complex 5 (Redstone)' },
  { id: 'pad-2', kind: 'range', capacity: 1, name: 'Launch Complex 14 (Atlas)' },
  { id: 'stand-1', kind: 'static-stand', capacity: 1, name: 'Huntsville static test stand' },
  { id: 'instrument-lab', kind: 'instrumentation-lab', capacity: 2 },
  { id: 'integration-1', kind: 'integration-space', capacity: 2, name: 'Hangar S' },
  { id: 'tracking-1', kind: 'tracking', capacity: 1, name: 'Cape tracking station' },
  { id: 'archive-hq', kind: 'archive', capacity: 1 },
];
