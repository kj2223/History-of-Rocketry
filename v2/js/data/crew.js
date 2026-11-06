// Crew content (V2 freeze §7). Candidates are fictional people with records and references, never visible
// stats. Their traits are hidden: the player learns them from what each person does. Content, Provisional.
import { dayOf } from '../core/calendar.js';

// Selection rounds: when the board sits, how many it may pick and who applied.
export const SELECTIONS = [
  { id: 'group-1', day: dayOf(1959, 4, 2), picks: 7, for: 'Mercury' },
  { id: 'group-2', day: dayOf(1962, 9, 17), picks: 9, for: 'Gemini' },
];

const c = (id, group, name, service, flightHours, testPilot, education, reference, traits, medical = 'eligible') =>
  ({ id, group, name, record: { service, flightHours, testPilot, education, references: [reference] }, medical, traits });

export const CANDIDATES = [
  c('cand-01', 'group-1', 'Thomas Rourke', 'Air Force test pilot', 3500, true, 'BS aeronautical engineering', 'Steady under pressure; reports problems early.', { risk: 0.55, candour: 0.8, independence: 0.5 }),
  c('cand-02', 'group-1', 'Daniel Okafor', 'Navy test pilot', 3000, true, 'BS electrical engineering', 'Methodical. Asks hard questions of the engineers.', { risk: 0.35, candour: 0.75, independence: 0.7 }),
  c('cand-03', 'group-1', 'Earl Whitcomb', 'Marine Corps aviator', 4100, true, 'BS engineering', 'Fearless, sometimes to a fault.', { risk: 0.85, candour: 0.45, independence: 0.8 }),
  c('cand-04', 'group-1', 'Henry Lindqvist', 'Air Force test pilot', 2800, true, 'MS aeronautics', 'Precise flyer, quiet in debriefs.', { risk: 0.5, candour: 0.35, independence: 0.4 }),
  c('cand-05', 'group-1', 'Samuel Price', 'Navy test pilot', 2600, true, 'BS mechanical engineering', 'Team player; defers to the engineers.', { risk: 0.45, candour: 0.6, independence: 0.25 }),
  c('cand-06', 'group-1', 'Robert Achterberg', 'Air Force test pilot', 3200, true, 'BS aeronautical engineering', 'Competitive and outspoken.', { risk: 0.7, candour: 0.7, independence: 0.75 }),
  c('cand-07', 'group-1', 'Charles Moreau', 'Navy test pilot', 2900, true, 'BS physics', 'Cautious. Will not fly what he does not understand.', { risk: 0.25, candour: 0.65, independence: 0.6 }),
  c('cand-08', 'group-1', 'Walter Abernathy', 'Air Force fighter pilot', 2200, false, 'BS engineering', 'Good stick, limited test experience.', { risk: 0.6, candour: 0.5, independence: 0.5 }),
  c('cand-09', 'group-1', 'Glenn Tasker', 'Navy test pilot', 2400, true, 'BS aeronautical engineering', 'Strong systems knowledge.', { risk: 0.5, candour: 0.55, independence: 0.45 }, 'restricted'),
  c('cand-10', 'group-1', 'Peter Halvorsen', 'Air Force test pilot', 2000, true, 'BS mathematics', 'Calm; slow to commit.', { risk: 0.4, candour: 0.5, independence: 0.55 }),
  c('cand-11', 'group-2', 'James Kowalczyk', 'Air Force test pilot', 3300, true, 'MS astronautics', 'Rendezvous theory is his strength.', { risk: 0.45, candour: 0.7, independence: 0.65 }),
  c('cand-12', 'group-2', 'Frank Delacroix', 'Navy test pilot', 2700, true, 'BS aeronautical engineering', 'Even-tempered and thorough.', { risk: 0.5, candour: 0.6, independence: 0.4 }),
  c('cand-13', 'group-2', 'Edward Nakamura', 'Air Force test pilot', 3100, true, 'MS aeronautical engineering', 'Bold; pushes for more in every flight.', { risk: 0.8, candour: 0.5, independence: 0.7 }),
  c('cand-14', 'group-2', 'Richard Boateng', 'Navy test pilot', 2500, true, 'BS electrical engineering', 'Careful, precise checklists.', { risk: 0.3, candour: 0.75, independence: 0.5 }),
  c('cand-15', 'group-2', 'Neil Fairbanks', 'Civilian research pilot', 2300, true, 'BS aeronautical engineering', 'Unflappable in emergencies.', { risk: 0.55, candour: 0.55, independence: 0.6 }),
  c('cand-16', 'group-2', 'John Castellano', 'Navy test pilot', 2900, true, 'BS naval science', 'Gregarious; reports late when he thinks he can fix it himself.', { risk: 0.65, candour: 0.3, independence: 0.75 }),
  c('cand-17', 'group-2', 'Michael Brennan', 'Air Force test pilot', 2600, true, 'MS physics', 'Quiet perfectionist.', { risk: 0.4, candour: 0.6, independence: 0.35 }),
  c('cand-18', 'group-2', 'David Szabo', 'Marine Corps test pilot', 3400, true, 'BS engineering', 'Aggressive flyer, honest debriefs.', { risk: 0.75, candour: 0.8, independence: 0.6 }),
  c('cand-19', 'group-2', 'Paul Whitaker', 'Air Force test pilot', 2100, true, 'BS aeronautical engineering', 'Promising; little time in high-performance aircraft.', { risk: 0.5, candour: 0.5, independence: 0.5 }),
  c('cand-20', 'group-2', 'Stephen Adeyemi', 'Navy test pilot', 2800, true, 'MS aeronautics', 'Strong with people and machines.', { risk: 0.45, candour: 0.65, independence: 0.55 }),
  c('cand-21', 'group-2', 'Arthur Quinlan', 'Air Force fighter pilot', 1900, false, 'BS physics', 'Keen, not yet a test pilot.', { risk: 0.6, candour: 0.45, independence: 0.5 }),
];

// Mission-specific training (V2 freeze §7). Every crew member needs these for a vehicle before flying it.
// Two-person spacecraft also need teamwork training with the same partner, so a late substitution means
// the new pair trains together again.
export const TRAINING = {
  'mercury-redstone': { crew: 1, items: ['systems', 'emergencies', 'flight-profile'] },
  'mercury-atlas': { crew: 1, items: ['systems', 'emergencies', 'flight-profile'] },
  'gemini-titan': { crew: 2, items: ['systems', 'emergencies', 'flight-profile', 'teamwork'] },
};

// How a crew member gets out of the vehicle in each phase (V2 freeze §4). The first part of the flight is
// the launch phase; after it, an abort means ending the flight early.
export const ESCAPE = {
  'mercury-redstone': { launch: 'escape tower', later: 'early end of flight' },
  'mercury-atlas': { launch: 'escape tower', later: 'early retrofire' },
  'gemini-titan': { launch: 'ejection seats', later: 'early retrofire' },
};
