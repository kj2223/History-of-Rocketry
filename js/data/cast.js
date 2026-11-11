// WHO HOLDS EACH DESK: the flight control team changes over the decades. A seat keeps its id ('hollis' is the director
// of flight operations' seat, whoever sits in it), and the person in it changes at the years below. The people are
// fictional, as everywhere else in the game. The first holder of each seat is the one in game.js and data/mercury.js
// and data/gemini.js; each later entry takes over from the year given, with its own name, coat and pronoun.
// Handovers are staggered, as they were in the real rooms: a few faces from Apollo are still there for the Shuttle.

export const SUCCESSIONS = {
  // Director of flight operations, from Gemini on (in Mercury, the flight director).
  hollis: [
    { from: 1981, name: 'Ray Castellano', color: '#45506a', he: true },
    { from: 1993, name: 'Joan Whitlock', color: '#5a4660', he: false },
    { from: 2020, name: 'David Okafor', color: '#3c4c5e', he: true },
  ],
  // The flight director on the other shift.
  dorsey: [
    { from: 1986, name: 'Lyle Henning', color: '#4a4f3c', he: true },
    { from: 1998, name: 'Teresa Molina', color: '#5c4a3e', he: false },
    { from: 2020, name: 'Priya Raman', color: '#4e3f5c', he: false },
  ],
  // Retrofire officer.
  tate: [
    { from: 1981, name: 'Ken Ostrowski', color: '#505a64', he: true },
    { from: 2000, name: 'Aisha Grant', color: '#5a4a52', he: false },
  ],
  // EECOM, the spacecraft's systems.
  kessler: [
    { from: 1981, name: 'Dale Fenwick', color: '#4e5c46', he: true },
    { from: 1998, name: 'Laura Chen', color: '#4a5866', he: false },
    { from: 2022, name: 'Marcus Bell', color: '#465448', he: true },
  ],
  // Booster.
  albrecht: [
    { from: 1981, name: 'Tom Riggs', color: '#66584a', he: true },
    { from: 1993, name: 'Sandra Nygaard', color: '#6a5248', he: false },
    { from: 2020, name: 'Jamal Ortiz', color: '#5e5446', he: true },
  ],
  // Network: Morgan has been tracking rockets since White Sands.
  morgan: [
    { from: 1975, name: 'Grace Whitaker', color: '#3f6458', he: false },
    { from: 1998, name: 'Ben Takahashi', color: '#3c5e60', he: true },
    { from: 2020, name: 'Elena Ruiz', color: '#466850', he: false },
  ],
  // Recovery, from the Navy: officers rotate through.
  reyes: [
    { from: 1973, name: 'Cmdr. James Ferrell', color: '#2f3f66', hat: '#e9e9e4', he: true },
    { from: 1988, name: 'Cmdr. Dana Pierce', color: '#2f3f66', hat: '#e9e9e4', he: false },
    { from: 2020, name: 'Lt. Cmdr. Rosa Alvarez', color: '#2f3f66', hat: '#e9e9e4', he: false },
  ],
  // Pad leader: Vega has had the pad since White Sands.
  vega: [
    { from: 1975, name: 'Lou Brennan', color: '#76583e', hat: '#e2e2dc', he: true },
    { from: 1998, name: 'Carla Mendes', color: '#6e5440', hat: '#e2e2dc', he: false },
    { from: 2020, name: 'Tyler Kim', color: '#5e5e66', hat: '#e2e2dc', he: true },
  ],
  // The pad crew: the Army's ordnance men at White Sands, NASA's own technicians from Gemini on.
  kowalski: [
    { from: 1965, name: 'Ed Price', color: '#6a7480', hat: '#e2e2dc', he: true },
    { from: 1990, name: 'Roy Tillman', color: '#6a7480', hat: '#e2e2dc', he: true },
    { from: 2018, name: 'Jess Harlow', color: '#6a7480', hat: '#e2e2dc', he: false },
  ],
  delgado: [
    { from: 1965, name: 'Manny Ortega', color: '#6a7480', hat: '#e2e2dc', he: true },
    { from: 1990, name: 'Kim Sutton', color: '#6a7480', hat: '#e2e2dc', he: false },
    { from: 2018, name: 'Omar Haddad', color: '#6a7480', hat: '#e2e2dc', he: true },
  ],
};

// What some desks are called as the hardware changes, from the year given. Later entries win.
export const ROLES_FROM = [
  {
    from: 1965,
    roles: { vega: 'Pad leader, Launch Complex 19', kowalski: 'Pad technician', delgado: 'Pad technician' },
  },
  { from: 1967, roles: { vega: 'Pad leader, Launch Complex 39', albrecht: 'Booster, Marshall' } },
  { from: 1981, roles: { reyes: 'Recovery and landing sites', albrecht: 'Booster, the solids and main engines' } },
  {
    from: 2020,
    roles: { vega: 'Pad leader, Launch Complex 39A', reyes: 'Recovery, the ships at sea', albrecht: 'Booster' },
  },
];
export const rolesIn = year => Object.assign({}, ...ROLES_FROM.filter(r => r.from <= year).map(r => r.roles));

// Who holds a seat in a year: the latest succession that has started, or null for the first holder.
export const holderIn = (id, year) => (SUCCESSIONS[id] || []).filter(s => s.from <= year).pop() || null;
// A name as people say it in the room: the surname, without a rank.
export const surname = name => name.split(' ').pop();
