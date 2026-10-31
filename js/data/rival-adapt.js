// HOW THE SOVIET MOON PROGRAMME ADAPTS (rules/rival-adapt.js) to how the race is going. Tune here. The keys are stored in saves.
//
// STANDING: Moscow reads the race from the firsts of the crewed era, the public scoreboard both sides kept: from -1 (every one
// American) to +1 (every one Soviet). The firsts counted, and how many must be decided before the standing reaches full strength.
export const RACE_FIRSTS = ['f_crew2', 'f_eva', 'f_rdv', 'f_dock', 'f_softland', 'f_lunorb', 'f_circum', 'f_moon', 'f_sample'];
export const FULL_STANDING_AFTER = 4;
// POSTURES, from the standing: below PUSH_FROM they push (behind), above COAST_FROM they coast (far ahead), steady between.
export const PUSH_FROM = -.2;
export const COAST_FROM = .5;
// PUSHING (behind, scaled by how far): every try's chance of working falls by up to PUSH_RISK of itself, a retry comes up to
// PUSH_HASTE sooner, and attempts not yet tried are pulled forward by up to PULL_PER_MONTH days each month, no more than MAX_SHIFT
// days in all. Hurried attempts fail more often, and a crewed one that fails loses its crew.
export const PUSH_RISK = .3;
export const PUSH_HASTE = .4;
export const PULL_PER_MONTH = 12;
export const MAX_SHIFT = 360;
// COASTING (far ahead, scaled by how far past COAST_FROM): retries come up to COAST_DELAY later, and attempts not yet tried slip
// by up to PULL_PER_MONTH days a month, no more than MAX_SHIFT in all. No extra care: the chance is the base chance.
export const COAST_DELAY = .5;
// What intelligence reports when Moscow changes posture.
export const POSTURE_WIRES = {
  push: '[INTELLIGENCE] Moscow is pushing its Moon programme hard after the American firsts. Expect earlier attempts, and more failures.',
  steady: '[INTELLIGENCE] The Soviet Moon programme has settled back to its own pace.',
  coast: '[INTELLIGENCE] Sure of its lead, Moscow is easing off the Moon programme. Its next attempts may slip.',
};
