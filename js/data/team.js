// THE CORE TEAM: the three people who start the programme with you at White Sands and stay with it. Each owns one part of
// the work (the speciality) and keeps a record of it (rules/team.js). The keys are stored in saves.
//   callSign: how their lines show on the loop, owns: what their speciality means in play
//   role, or roles { before, after } when an appointment changes it (Daniel Vega becomes the launch director when you appoint one)
export const CORE_TEAM = {
  ellis: {
    name: 'Ruth Ellis', role: 'Chief Engineer', callSign: 'CHIEF', speciality: 'Vehicle integration',
    owns: 'Leads every failure review and signs every fix into the design.',
  },
  vega: {
    name: 'Daniel Vega', roles: { before: 'Pad Lead', after: 'Launch Director' }, callSign: 'LD', speciality: 'Range operations',
    owns: 'Runs the pad for every countdown. Appointed launch director, flies your campaigns.',
  },
  morgan: {
    name: 'Samuel Morgan', role: 'Range & Tracking Lead', callSign: 'RANGE', speciality: 'Tracking and measurement',
    owns: 'Tracks every flight on the range radar and measures every record.',
  },
};
