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
