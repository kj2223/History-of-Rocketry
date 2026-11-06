// THE ASTRONAUTS: the seven chosen for Mercury in April 1959. Fictional people, as everyone you work with is; the flights
// they fly are the real ones. What anyone can know about them: their service and their record. How they really are is
// hidden (world/crew.js): you learn it from what they do.
export const ASTRONAUTS = {
  rourke: { name: 'Thomas Rourke', service: 'Air Force test pilot', hours: 3500, note: 'Steady under pressure; reports problems early.', color: '#d9d4c7' },
  okafor: { name: 'Daniel Okafor', service: 'Navy test pilot', hours: 3000, note: 'Methodical. Asks hard questions of the engineers.', color: '#d9d4c7' },
  whitcomb: { name: 'Earl Whitcomb', service: 'Marine Corps aviator', hours: 4100, note: 'Fearless, sometimes to a fault.', color: '#d9d4c7' },
  lindqvist: { name: 'Henry Lindqvist', service: 'Air Force test pilot', hours: 2800, note: 'Precise flyer, quiet in debriefs.', color: '#d9d4c7' },
  price: { name: 'Samuel Price', service: 'Navy test pilot', hours: 2600, note: 'Team player; defers to the engineers.', color: '#d9d4c7' },
  achterberg: { name: 'Robert Achterberg', service: 'Air Force test pilot', hours: 3200, note: 'Competitive and outspoken.', color: '#d9d4c7' },
  moreau: { name: 'Charles Moreau', service: 'Navy test pilot', hours: 2900, note: 'Cautious. Will not fly what he does not understand.', color: '#d9d4c7' },
};
export const SEVEN = Object.keys(ASTRONAUTS);
