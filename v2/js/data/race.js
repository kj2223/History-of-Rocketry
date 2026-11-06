// The race (V2 freeze §8). Soviet firsts happen on their real dates as anchor events; the agency learns of
// them through imperfect intelligence, and a public announcement is a separate event. Content.
// Dates are UTC, checked against the standard histories (Siddiqi, "Challenge to Apollo", NASA SP-4408;
// the NSSDCA master catalogue). A rival programme with its own failures arrives in V3.
import { dayOf } from '../core/calendar.js';

// `first` names what was done first; `comparable` is the agency capability that would have matched it
// (see rules/capabilities.js), or null where nothing in Mercury or Gemini compares.
// `announced` is days after the event that the world was told. `rumour` is what intelligence may hear
// beforehand. `wrong` is a plausible mistaken report, later revised; `partial` leaves out what matters.
export const SOVIET_ANCHORS = [
  { id: 'luna-2', day: dayOf(1959, 9, 13), first: 'first object to reach the Moon', comparable: null, announced: 0,
    report: 'Luna 2 struck the Moon east of Mare Serenitatis.', partial: 'a Soviet probe was tracked heading for the Moon.',
    wrong: 'a Soviet lunar probe missed the Moon and went into solar orbit.', rumour: 'Tyuratam is preparing another lunar shot.' },
  { id: 'luna-3', day: dayOf(1959, 10, 7), first: 'first pictures of the far side of the Moon', comparable: null, announced: 19,
    report: 'Luna 3 photographed the far side of the Moon and sent the pictures back.', partial: 'a Soviet probe is looping around the Moon.',
    wrong: 'a Soviet probe is in orbit around the Moon.', rumour: null },
  { id: 'korabl-sputnik-2', day: dayOf(1960, 8, 19), first: 'first animals recovered alive from orbit', comparable: 'orbital-recovery', announced: 1,
    report: 'Korabl-Sputnik 2 carried two dogs, Belka and Strelka, through a day in orbit and brought them back alive.',
    partial: 'a heavy Soviet satellite is in orbit and may carry animals.', wrong: 'a heavy Soviet satellite with animals aboard failed to return.', rumour: 'a recoverable Soviet capsule is being tested.' },
  { id: 'vostok-1', day: dayOf(1961, 4, 12), first: 'first person in space and in orbit', comparable: 'orbit', announced: 0, pressure: 'high',
    report: 'Yuri Gagarin made one orbit of the Earth in Vostok and landed alive.', partial: 'the Soviets have launched a man; whether he reached orbit is not confirmed.',
    wrong: 'the Soviets have launched a man, who made three orbits.', rumour: 'a crewed Soviet launch is close.' },
  { id: 'vostok-2', day: dayOf(1961, 8, 6), first: 'first full day in orbit', comparable: 'day-in-orbit', announced: 0,
    report: 'Gherman Titov flew seventeen orbits in Vostok 2, more than a day in space.', partial: 'a second Soviet crewed flight is in orbit.',
    wrong: 'a second Soviet crewed flight made six orbits.', rumour: null },
  { id: 'vostok-3-4', day: dayOf(1962, 8, 12), first: 'first two crewed spacecraft in orbit together', comparable: null, announced: 0,
    report: 'Vostok 3 and Vostok 4 flew in orbit at the same time and passed within a few kilometres; neither could manoeuvre.',
    partial: 'two Soviet crewed spacecraft are in orbit.', wrong: 'two Soviet spacecraft have rendezvoused and may have docked.', rumour: null },
  { id: 'vostok-6', day: dayOf(1963, 6, 16), first: 'first woman in space', comparable: null, announced: 0,
    report: 'Valentina Tereshkova flew three days in Vostok 6.', partial: 'another Soviet crewed flight is in orbit with Vostok 5.',
    wrong: 'a Soviet woman cosmonaut is in orbit but reported to be in difficulty.', rumour: null },
  { id: 'voskhod-1', day: dayOf(1964, 10, 12), first: 'first crew of more than one', comparable: 'multi-crew', announced: 0, pressure: 'high',
    report: 'Voskhod 1 carried three men, without spacesuits, for a day in orbit.', partial: 'a new Soviet spacecraft is in orbit with more than one man aboard.',
    wrong: 'a new Soviet spacecraft has two men aboard and can manoeuvre.', rumour: 'the Soviets are readying a larger crewed spacecraft.' },
  { id: 'voskhod-2', day: dayOf(1965, 3, 18), first: 'first spacewalk', comparable: 'eva', announced: 0, pressure: 'high',
    report: 'Alexei Leonov left Voskhod 2 for about twelve minutes on a tether.', partial: 'a two-man Soviet flight is in orbit with an airlock.',
    wrong: 'a cosmonaut left his spacecraft for more than an hour.', rumour: 'a Soviet spacewalk is planned.' },
  { id: 'luna-9', day: dayOf(1966, 2, 3), first: 'first soft landing on the Moon', comparable: null, announced: 0,
    report: 'Luna 9 landed softly on the Ocean of Storms and sent back pictures of the surface.', partial: 'a Soviet lunar probe has reached the surface; whether it survived is not known.',
    wrong: 'a Soviet lunar probe crashed on landing.', rumour: null },
];

// Award conditions after the first Soviet crewed flights (V2 freeze §8; GAME-DESIGN §11.2.16): Congress
// funds the race and expects crewed flights in return. Checked when the fiscal year closes.
export const RACE_CONDITIONS = {
  1962: { text: 'Congress expects at least two successful crewed flights this year', successfulFlights: 2, crewed: true },
  1965: { text: 'Congress expects at least three successful Gemini flights this year', successfulFlights: 3, crewed: true },
};
// A Soviet first the agency had not matched brings a supplementary appropriation offer of this size.
export const PRESSURE_SUPPLEMENTARY = { high: 3000000 };
