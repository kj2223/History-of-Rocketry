// MANAGEMENT MODE: the heads you appoint (Aaron's answers 4A and 8A, 19 Nov 2026). Five posts from the start; the
// flight director and the astronaut office open when Mercury flights begin. Everyone else is crews hired by headcount.
// The people are fictional, each based on the kind of person who held such a post, with fictional names and
// backgrounds (answer M6). Each carries three hidden traits, 0 to 1: risk (how much risk they will accept), candour
// (how plainly they report bad news) and independence (how far they act without asking). The traits are never shown;
// they show only in what the person does.

export const POSTS = [
  { id: 'launch', name: 'Launch operations', text: 'Runs the pads, the count and the launch crews.' },
  { id: 'vehicles', name: 'Vehicle team', text: 'Takes each rocket from the factory to the pad and signs it off.' },
  { id: 'payloads', name: 'Payloads', text: 'Readies the satellites and probes, and works with the laboratories.' },
  { id: 'safety', name: 'Range safety', text: 'Decides whether a rocket going wrong is destroyed, and when.' },
  { id: 'deputy', name: 'Deputy', text: 'Stands in for you, and runs the base day to day.' },
  {
    id: 'flight',
    name: 'Flight director',
    text: 'Runs crewed flights from the control centre.',
    opens: 'mercury',
  },
  {
    id: 'astronauts',
    name: 'Astronaut office',
    text: 'Leads the astronauts and speaks for them.',
    opens: 'mercury',
  },
];

// Three people for each post. risk, candour, independence are hidden.
export const CANDIDATES = {
  launch: [
    {
      id: 'albers',
      name: 'Konrad Albers',
      text: 'Came over with the German rocket team in 1945; has run the Army’s firing lab at the Cape since 1952.',
      risk: 0.35,
      candour: 0.6,
      independence: 0.75,
    },
    {
      id: 'keane',
      name: 'Thomas Keane',
      text: 'Air Force launch officer on the Thor programme; quick, and proud of keeping to the schedule.',
      risk: 0.65,
      candour: 0.45,
      independence: 0.6,
    },
    {
      id: 'marsh',
      name: 'Edith Marsh',
      text: 'Ran test operations for Martin on Vanguard; cautious, and keeps every anomaly in her log.',
      risk: 0.2,
      candour: 0.85,
      independence: 0.4,
    },
  ],
  vehicles: [
    {
      id: 'brauner',
      name: 'Heinz Brauner',
      text: 'Huntsville engineer who brought the Jupiter C and Juno II through checkout.',
      risk: 0.3,
      candour: 0.7,
      independence: 0.55,
    },
    {
      id: 'delgado',
      name: 'Ramon Delgado',
      text: 'Convair field engineer on the early Atlas flights; knows its quirks better than anyone.',
      risk: 0.5,
      candour: 0.55,
      independence: 0.7,
    },
    {
      id: 'whitcomb',
      name: 'Arthur Whitcomb',
      text: 'Douglas man from the Thor line; practical, likes a fix he can see.',
      risk: 0.55,
      candour: 0.4,
      independence: 0.5,
    },
  ],
  payloads: [
    {
      id: 'pell',
      name: 'Walter Pell',
      text: 'From the Jet Propulsion Laboratory; built the radio and instruments on the first Explorers.',
      risk: 0.45,
      candour: 0.75,
      independence: 0.65,
    },
    {
      id: 'okafor',
      name: 'Samuel Okafor',
      text: 'Naval Research Laboratory physicist from Vanguard’s satellite group.',
      risk: 0.3,
      candour: 0.8,
      independence: 0.45,
    },
    {
      id: 'lindqvist',
      name: 'Greta Lindqvist',
      text: 'Space Technology Laboratories engineer behind the Able probes; ambitious about the Moon.',
      risk: 0.6,
      candour: 0.6,
      independence: 0.6,
    },
  ],
  safety: [
    {
      id: 'hollister',
      name: 'Col. Ray Hollister',
      text: 'Air Force Missile Test Center; has pressed the destruct button more than once.',
      risk: 0.25,
      candour: 0.7,
      independence: 0.8,
    },
    {
      id: 'beaumont',
      name: 'Maj. Louis Beaumont',
      text: 'Range engineer who drew the Cape’s impact lines; slow to destroy a rocket that might still make it.',
      risk: 0.55,
      candour: 0.6,
      independence: 0.5,
    },
    {
      id: 'kerrigan',
      name: 'Anne Kerrigan',
      text: 'Civilian range planner; strict about the coastline and the shipping lanes.',
      risk: 0.15,
      candour: 0.85,
      independence: 0.6,
    },
  ],
  deputy: [
    {
      id: 'faraday',
      name: 'George Faraday',
      text: 'Came from the old NACA laboratories; careful with money and with Congress.',
      risk: 0.3,
      candour: 0.65,
      independence: 0.35,
    },
    {
      id: 'reyes',
      name: 'Lt. Col. Daniel Reyes',
      text: 'On loan from the Army Ballistic Missile Agency; used to running things his own way.',
      risk: 0.5,
      candour: 0.5,
      independence: 0.85,
    },
    {
      id: 'stannard',
      name: 'Helen Stannard',
      text: 'Ran the Cape office for the Vanguard programme; knows every contractor by name.',
      risk: 0.4,
      candour: 0.75,
      independence: 0.5,
    },
  ],
  flight: [
    {
      id: 'carver',
      name: 'Walt Carver',
      text: 'NACA Langley engineer from the Space Task Group; calm on the loop.',
      risk: 0.4,
      candour: 0.8,
      independence: 0.6,
    },
    {
      id: 'mallory',
      name: 'Frank Mallory',
      text: 'Flight test engineer from Edwards; trusts the pilot to fly it.',
      risk: 0.6,
      candour: 0.6,
      independence: 0.7,
    },
    {
      id: 'tanaka',
      name: 'Kenji Tanaka',
      text: 'Range tracking engineer; reads the data before he trusts anyone’s word.',
      risk: 0.25,
      candour: 0.7,
      independence: 0.45,
    },
  ],
  astronauts: [
    {
      id: 'harland',
      name: 'Cdr. Wes Harland',
      text: 'Navy test pilot from the first astronaut group; competitive, outspoken.',
      risk: 0.6,
      candour: 0.75,
      independence: 0.7,
    },
    {
      id: 'brannock',
      name: 'Maj. Tom Brannock',
      text: 'Marine aviator; the public face the press already loves.',
      risk: 0.5,
      candour: 0.55,
      independence: 0.5,
    },
    {
      id: 'mercer',
      name: 'Capt. Lou Mercer',
      text: 'Air Force test pilot; looks after his people before himself.',
      risk: 0.45,
      candour: 0.8,
      independence: 0.55,
    },
  ],
};

// Whether a post can be filled yet. Mercury's posts open on the day of the first Mercury flight on the manifest.
export function postOpen(post, day, flights) {
  if (!post.opens) return true;
  const first = flights.filter(f => f.programme === post.opens).map(f => f.launch);
  return first.length > 0 && day >= Math.min(...first);
}

export const candidate = (postId, id) => CANDIDATES[postId]?.find(c => c.id === id) ?? null;

// The posts as they stand: who holds each, or the candidates if it is open and empty.
export function staffing(heads, day, flights) {
  return POSTS.map(p => ({
    ...p,
    open: postOpen(p, day, flights),
    head: candidate(p.id, heads?.[p.id]),
    candidates: CANDIDATES[p.id],
  }));
}
