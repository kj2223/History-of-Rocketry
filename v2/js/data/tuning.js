// Every number the freeze calls tuning (§13). Rules read these; changing them is not a design change.

export const TUNING = {
  samplesPerDay: 1,
  lossChance: { ground: 0.02, flight: 0.12 },
  observationNoise: 0.01,
  routineDistinctTests: 3,
  recurringFindingThreshold: 2,
  greenlightWindowDays: 182,
  delegationSuccessfulFlights: 2,
  reversalFailures: 2,
  reversalWindowDays: 365,
  workloadWarningJobs: 4,
  consequentialCommitment: 250000,
  preservationCostPerDay: 400,
  recycleYield: 0.5,
  recordsPerArchiveUnit: 200,
  retentionShareOfSavings: 0.5,
  operatingCostPerQuarter: 60000,
  awards: { 1945: 400000, 1946: 900000, 1947: 1200000, 1948: 1500000, 1949: 1600000, 1950: 1800000, 1951: 2200000, 1952: 2500000,
    1953: 2600000, 1954: 2800000, 1955: 3500000, 1956: 4500000, 1957: 5000000, 1958: 9000000, 1959: 12000000,
    // V2: the share of NASA's budget that Mercury, Gemini and their support would see, on V1's scale.
    1960: 14000000, 1961: 16000000, 1962: 20000000, 1963: 24000000, 1964: 26000000, 1965: 26000000, 1966: 24000000, 1967: 20000000 },
  // Staff pacing (freeze §2.2, §8.2): how long cases and meetings take, and how teams space their work.
  staffCaseDays: 28,
  staffMeetingDays: 14,
  staffGreenlightPrepDays: 60,
  proposalSnoozeDays: 30,
  staffTestBookingDays: 10,
  staffLaunchBookingDays: 5,
  staffFlightCost: 20000,
  staffFlightSpacingDays: 60,
  // Facility work (freeze §6.4): building a unit costs this per unit of capacity; an upgrade costs a share of it
  // per capacity step (at least one step). A deposit is paid when work starts and the balance on completion.
  facilityBuildCost: { range: 120000, 'static-stand': 90000, 'environmental-chamber': 150000, 'structural-rig': 100000,
    'instrumentation-lab': 50000, 'integration-space': 60000, tracking: 80000, archive: 30000 },
  // Months of design and contractor work between a programme's greenlight and its first deliverable vehicle.
  designDays: { viking: 720, 'mercury-redstone': 540, 'mercury-atlas': 600, 'gemini-titan': 820 },
  facilityUpgradeShare: 0.5,
  facilityDepositShare: 0.5,
  // People (V2 freeze §15): how far one rewarded or discouraged act moves a hidden trait, and its bounds.
  traitDrift: 0.03,
  traitBounds: [0.05, 0.95],
  // At most this many acts of one kind count when V1 heads get traits on import, so no single habit saturates.
  importSignalCap: 8,
  jobDays: { 'integration-assessment': 10, recycle: 14, repair: 7, upgrade: 60, commissioning: 30 },
};
