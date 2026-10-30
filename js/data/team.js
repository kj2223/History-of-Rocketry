// THE CORE TEAM: the three people who start the programme with you at White Sands and stay with it. Each owns one part of
// the work (the speciality) and keeps a record of it (rules/team.js). The keys are stored in saves.
//   callSign: how their lines show on the loop, owns: what their speciality means in play
//   console: the launch-board station they cover until you hire its specialist (rules/launch-site.js coveredStations)
//   role, or roles { before, after } when an appointment changes it (Ruth Ellis becomes the launch director when you appoint one)
export const CORE_TEAM = {
  ellis: {
    name: 'Ruth Ellis', roles: { before: 'Chief Engineer', after: 'Chief Engineer & Launch Director' }, callSign: 'CHIEF', speciality: 'Vehicle integration',
    owns: 'Leads every failure review and signs every fix into the design. Covers the PROP console until you hire a Propulsion Engineer, appoint her launch director or give her an engineering remit. Once the Aerobee is routine she runs your launch campaigns.',
    console: 'prop',
  },
  vega: {
    name: 'Daniel Vega', role: 'Pad Lead', callSign: 'PAD', speciality: 'Range operations',
    owns: 'Runs the pad for every countdown, yours and the launch director\'s, and covers the RSO console until you hire a Range Safety Officer.',
    console: 'rso',
  },
  morgan: {
    name: 'Samuel Morgan', role: 'Range & Tracking Lead', callSign: 'RANGE', speciality: 'Tracking and measurement',
    owns: 'Tracks every flight on the range radar and measures every record. Covers the TLM console once the teleprinters are in.',
    console: 'tlm',
  },
};
