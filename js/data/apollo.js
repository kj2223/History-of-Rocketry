// PROJECT APOLLO, PART ONE: the programme office that opens when Mercury closes, and the study that picks how to reach the Moon
// (rules/apollo.js). Tune the study and the three architectures here. The keys are stored in saves.

// THE STUDY you commission when Apollo opens. cost ($), days it takes with the lead at pace 1, quality: how far it narrows the
// estimates (0 to 1, before experience is added).
export const STUDY_SIZES = {
  quick: { name: 'In-house study', cost: 60000, days: 150, quality: .25, why: 'The Mercury engineers work it up themselves. Quicker to commission, rougher figures.' },
  full: { name: 'Full study with contractor proposals', cost: 160000, days: 240, quality: .5, why: 'Three industry teams cost each approach in detail. Slower and dearer, much firmer figures.' },
};
// What the study's lead and its experience add to its quality. A lead who moved over from Mercury adds ROLLOVER_QUALITY times
// their pace; each crewed Mercury flight adds MERCURY_FLIGHT_QUALITY, up to MERCURY_QUALITY_CAP. Quality never passes QUALITY_CAP.
export const ROLLOVER_QUALITY = .1;
export const MERCURY_FLIGHT_QUALITY = .03, MERCURY_QUALITY_CAP = .15;
export const QUALITY_CAP = .85;
// Without the Mercury spacecraft lead, the study is led by engineers new to spacecraft: it takes this many times as long.
export const NEW_TEAM_SLOWDOWN = 1.25;
// How wide an estimate starts, as a fraction of the value either side, before any quality.
export const ESTIMATE_WIDTH = .4;
// Gemini evidence firms up the rendezvous risk of the architectures that need one: each capability shown takes this share off
// the remaining width of that estimate.
export const GEMINI_EVIDENCE = { rdv: .3, dock: .3, eva: .1 };

// THE ARCHITECTURES. Each carries its true figures as nominal values; the true ones are rolled within TRUE_SPREAD when Apollo opens.
//   cost: development cost to the first landing attempt ($), years: from the choice to the first landing attempt,
//   risk: chance a landing mission loses its crew (a fraction), launches: Saturn-class launches per landing,
//   booster: the rocket it needs, rendezvous: where the spacecraft must meet ('earth', 'moon' or null), gemini: whether Gemini's
//   rendezvous and docking evidence bears on its risk
export const TRUE_SPREAD = .2;
export const ARCHITECTURES = {
  direct: {
    name: 'Direct ascent', booster: 'Nova', launches: 1, rendezvous: null, cost: 6000000, years: 8.5, risk: .07,
    why: 'One enormous rocket sends the whole spacecraft to the Moon, lands it tail-first and flies it home. No rendezvous anywhere, but the Nova would be the largest machine ever built, and its landing stage must set down something the size of a lighthouse.',
  },
  eor: {
    name: 'Earth-orbit rendezvous', booster: 'Saturn V', launches: 2, rendezvous: 'earth', gemini: 1, cost: 4500000, years: 7, risk: .055,
    why: 'Two Saturn launches meet in Earth orbit, where one fuels the other for the trip. The hard joining manoeuvres happen close to home, in reach of the tracking network with no signal delay, and a crew in trouble can come straight down. Two launches must both go right, and the landing craft is still large.',
  },
  lor: {
    name: 'Lunar-orbit rendezvous', booster: 'Saturn V', launches: 1, rendezvous: 'moon', gemini: 1, cost: 3500000, years: 6, risk: .065,
    why: 'One Saturn V. A small, light lander goes down while the mother ship waits in lunar orbit, then the two meet again a quarter of a million miles from home. The cheapest and quickest, but the rendezvous that must work is the one nobody can help with.',
  },
};
export const ARCHITECTURE_ORDER = ['direct', 'eor', 'lor'];
