// Engineering belief vocabulary: anomalies teams can open and the hypotheses they weigh.
// Hypothesis IDs are a separate vocabulary from physical mechanism IDs and never name them.

// A prediction says whether a reading of `quantity` under matching conditions should be normal.
export const HYPOTHESES = {
  'liner-debond': {
    name: 'Chamber liner debonding under sustained heat',
    predicts: [
      { quantity: 'aerobee-sustainer.wall-temp', when: { burn: 'long' }, normal: false },
      { quantity: 'aerobee-sustainer.wall-temp', when: { burn: 'short' }, normal: true },
      { quantity: 'aerobee-sustainer.chamber-pressure', when: {}, normal: true },
    ],
  },
  'injector-blockage': {
    name: 'Partial injector blockage',
    predicts: [
      { quantity: 'aerobee-sustainer.wall-temp', when: {}, normal: false },
      { quantity: 'aerobee-sustainer.chamber-pressure', when: {}, normal: false },
    ],
  },
};

// An abnormal reading on the trigger quantity opens the anomaly with its candidate hypotheses.
export const ANOMALIES = {
  'sustainer-overtemp': { name: 'Sustainer runs hot', stage: 'aerobee-sustainer', trigger: 'aerobee-sustainer.wall-temp', hypotheses: ['liner-debond', 'injector-blockage'] },
};

// Ground test plans engineering can propose.
export const CANDIDATE_TESTS = [
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'short' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp'] },
];

// Flight conditions: every flight is a full-duration burn.
export const FLIGHT_CONDITIONS = { burn: 'long' };
