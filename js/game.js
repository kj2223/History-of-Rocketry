// THE GAME STATE: the player's years on the range, round after round (WAC Corporal, V-2, Bumper, Aerobee, Viking, Vanguard),
// each from the hangar to the review, and the turning point where the first promotion offer comes. No DOM, no drawing.
// The player is one junior engineer on the site. Everyone else gets on with their own work, and the player can watch them.
// The story runs in beats; each beat says what the player is asked to do and where the others go.
import { PLACES, WORLD_W } from './data/white-sands.js';
import { dayOf, dateLabel, weekday } from './core/calendar.js';
import {
  flyLoose,
  newRound,
  flagSpots,
  staticFire,
  standRework,
  leakCheck,
  tankGauge,
  fly,
  wreckage,
  hasIgniterFault,
  hasPumpFault,
  hasLinerFault,
  hasInjectorFault,
  causesPresent,
  ellisReading,
  crewInspect,
  stationCall,
} from './truth/round.js';
import { TRAITS } from './world/people.js';
import { COSTS, planCost, lineFor, spend, dollars } from './world/budget.js';
import { KITS, SHORT, FAILED_BECAUSE, FAULT_AT_SPOT } from './data/kits.js';
import { SEASON, BETWEEN, FIRST_OFFER, offerFor, onPath, GEMINI_OFFER } from './data/campaign.js';
import { MERCURY_PEOPLE, MERCURY_ROLES, MERCURY_PLACES } from './data/mercury.js';
import { GEMINI_PEOPLE, GEMINI_ROLES, GEMINI_PLACES } from './data/gemini.js';
import { APOLLO_PLACES } from './data/apollo.js';
import { ASTRONAUTS, GROUPS } from './data/crew.js';
import { raceNews, RACE_FROM, apolloFire, skylabShield } from './world/race.js';
import {
  initRecord,
  addRound,
  shiftTrust,
  TRUST,
  turningPoint,
  answerOffer,
  pendingOffer,
  SEATS,
} from './career/record.js';
import { initProgramme, adopt, recordFlight, estimate, newFixes, rangeRecord } from './world/programme.js';

// g.day is the campaign day (0 is 1 January 1945). Each round starts on its SEASON date and plans to fly two days later.
export const START_MINUTE = 7 * 60 + 30,
  PLANNED_LAUNCH_DAY = 2;
export const EVENING = 19 * 60;
export const WALK = 90,
  TRUCK = 130,
  MINUTES_PER_SECOND = 4; // world units and game minutes per real second, at 1x

const PEOPLE = {
  you: { name: 'You', role: 'Junior engineer', color: '#ece4cf', x: 330 },
  ellis: { name: 'Ruth Ellis', role: 'Chief Engineer, your boss', color: '#5b6f8f', x: 210 },
  vega: { name: 'Daniel Vega', role: 'Pad lead', color: '#7b5a3a', hat: '#4d5b3a', x: 2000 },
  morgan: { name: 'Samuel Morgan', role: 'Range and tracking', color: '#3f6b5a', x: 1630 },
  kowalski: { name: 'Sgt. Kowalski', role: 'Ordnance crew', color: '#5d6a43', hat: '#3e4a2c', x: 650 },
  delgado: { name: 'Pvt. Delgado', role: 'Ordnance crew', color: '#5d6a43', hat: '#3e4a2c', x: 780 },
  // On the V-2 and Bumper rounds only.
  hoyt: { name: 'Walt Hoyt', role: 'V-2 crew chief, General Electric', color: '#6b4f6f', hat: '#2f3540', x: 840 },
  // On the Aerobee and Viking rounds. He stands clear of the office door, so a click on the door goes in.
  brandt: { name: 'Lt. Cmdr. Paul Brandt', role: 'Navy project officer', color: '#2f3f66', hat: '#e9e9e4', x: 405 },
  // In Mercury Control, from 1960.
  ...MERCURY_PEOPLE,
  // In Mission Control, Houston, from 1965.
  ...GEMINI_PEOPLE,
  // The astronaut flying this round, if anyone is: his name comes from the round. crew2 is the second crewman: a voice on
  // the loop, never on the site.
  pilot: { name: 'The astronaut', role: 'Astronaut', color: '#dcdad2', x: 560 },
  crew2: { name: 'The pilot', role: 'Astronaut', color: '#dcdad2', x: 600 },
};
const ROLES = Object.fromEntries(Object.entries(PEOPLE).map(([id, p]) => [id, p.role]));

// Whether you run this round as its test conductor: you plan it, run the count and chair the review.
export const conducting = () =>
  g.record.seat === 'test-conductor' && ['aerobee', 'viking', 'vanguard', 'juno', 'ranger'].includes(g.vehicle);
// Whether this round is paid from your own budget line: the Viking and Vanguard firings you conduct.
export const onBudget = () => conducting() && ['viking', 'vanguard', 'juno', 'ranger'].includes(g.vehicle);
// Whether the round flies from the Cape, where what falls lands in the Atlantic and the range reads it from telemetry.
export const atSea = () => g.site === 'cape';
export const budgetLine = () => lineFor(g.record, g.day);
// Hours each crew member takes to look a round over in your place. Visible: you can see how long they take.
export const INSPECTORS = {
  you: { name: 'You', hours: 0 },
  kowalski: { name: 'Sgt. Kowalski', hours: 5 },
  delgado: { name: 'Pvt. Delgado', hours: 2 },
};

// What the player can see and say about the current kind of round (data/kits.js).
export const kit = () => KITS[g.vehicle];

// g is the whole game state, one mutable object shared by every module. Reading a function, assume it can
// touch any of these. The field groups:
//
//   Campaign, carried between rounds and saved in the checkpoint:
//     seed            the campaign's random seed; the same seed makes the same campaign
//     roundIndex      this round's place in SEASON
//     roundStart      the SEASON date this round starts on
//     vehicle         this round's kind of vehicle (see the glossary)
//     day, clock      the campaign day (0 is 1 Jan 1945) and the minutes elapsed today
//     notes           the between-round write-ups
//     programme       what the team knows and carries (world/programme.js)
//     record          your record: rounds, seat, offers, and the hidden trust (career/record.js)
//
//   This round, cleared before each one by resetRound():
//     round           the round as the player can see it (truth/round.js makes the hidden part)
//     slipDays, offDays, launchDay   days slipped, days skipped, the day the round flies
//     looked, flagged, decided       the inspection: what you looked at, flagged, and concluded
//     plan, readings  your plan for the round and the readings it called for
//     rocket, truck   the round's rocket and the transporter, where they are and what they carry
//     stand, count    the static fire and the launch count, when they run
//     console, flight, mission, lunar, review, recovery
//                     the crewed-era console and flight state, and the round's review and recovery
//     jobs, pending   work in progress and what you are walking somewhere to do
//
//   The beat (see the glossary):
//     beat            which story stage the round is at; handlers live in the *_BEATS tables
//     objective       the one-line task the player is asked to do
//     dayDone         whether the day can be ended
//
//   Presentation, never saved:
//     time            seconds since the scene began (drives speech bubbles and camera holds)
//     speed, paused   the clock's rate and whether it runs
//     cam             where the camera looks along the site
//     people          everyone on the site, where they stand and what they say
//     marker, hover   the walking marker and the thing under the pointer
//     loop            the last lines spoken, for the radio-loop panel
//     standFlame, fade, fading   the firing's flame and scene fades
//     room, roomVersion      the open room panel and the count that redraws it
//     away            a scene away from the site (also saved: it survives a checkpoint)
//     saved, savedVersion    the last checkpoint and how many have been taken
// The crewed-era modules (mercury.js and lunar.js) register their beat tables and engine calls here at load time.
// game.js never imports them, so the imports run one way, down: they read the shared state and helpers, and this
// file calls back into what they registered. Until a module registers, its calls do nothing.
const EXTRA_BEATS = {};
const CREWED = {};
let crewedLoaded = false;
export const registerCrewed = (beats, engine) => {
  Object.assign(EXTRA_BEATS, beats);
  Object.assign(CREWED, engine);
  crewedLoaded = true;
};
export let g;

// A new season, or the morning a checkpoint was saved at (see checkpoint()).
export function newGame(seed = Math.floor(Math.random() * 1e9), from = null) {
  g = {
    seed,
    roundIndex: 0,
    vehicle: SEASON[0].vehicle,
    roundStart: SEASON[0].start,
    programme: initProgramme(),
    record: initRecord(),
    round: null,
    day: SEASON[0].start,
    clock: 0,
    time: 0,
    speed: 1,
    paused: false,
    cam: { x: 0, freeUntil: 0 },
    people: {},
    jobs: [],
    pending: null,
    marker: null,
    hover: null,
    beat: '',
    objective: '',
    dayDone: false,
    notes: [],
    loop: [],
    standFlame: 0,
    fade: 0,
    fading: null,
    room: null,
    roomVersion: 0,
    away: null,
    saved: null,
    savedVersion: 0,
    crewSwaps: {},
  };
  for (const [id, p] of Object.entries(PEOPLE))
    g.people[id] = { id, ...p, target: p.x, face: 1, bubble: null, working: false, hidden: false };
  if (!from) {
    startRound(0);
    return g;
  }
  resetRound();
  const at = roundIndexOf(from);
  Object.assign(
    g,
    structuredClone({
      seed: from.seed,
      roundIndex: at,
      roundStart: SEASON[at].start,
      programme: from.programme,
      record: from.record,
      round: from.round,
      day: from.day,
      clock: from.clock,
      notes: from.notes,
      slipDays: from.slipDays,
      offDays: from.offDays,
      looked: from.looked,
      flagged: from.flagged,
      decided: from.decided,
      away: from.away,
      review: from.review,
      launchDay: from.launchDay ?? null,
      plan: from.plan ?? null,
      mission: from.mission ?? null,
      crewSwaps: from.crewSwaps ?? {},
    }),
  );
  setVehicle();
  if (from.crewSwaps == null) {
    const losses = [];
    for (const loss of g.record.losses || []) {
      losses.push(loss);
      replaceLostCrew(lostIds({ losses: [loss] }), loss.day, lostIds({ losses }));
    }
  }
  if (g.away) g.room = 'away';
  retireSeats();
  // A season that ended in an older build (Apollo 15 was the last round in v0.5.2) carries on when this build has more.
  const beat = from.beat === 'seasonEnd' && nextIndex() != null && !pendingOffer(g.record) ? 'roundEnd' : from.beat;
  if (beat === 'roundEnd') catchUpOffer();
  morning(beat);
  return g;
}

// Seats this build no longer has (Aaron, 8 November 2026: the player stays Flight Director to 2030; the Center director
// and programme office wait for the management side). A save holding one, or with one of their offers still open, moves
// to the flight director's shift.
const RETIRED_SEATS = ['director', 'programme'];
function retireSeats() {
  const rec = g.record,
    open = rec.offers.at(-1);
  if (open && RETIRED_SEATS.includes(open.seat) && open.made && !open.answer) open.answer = 'withdrawn';
  if (!RETIRED_SEATS.includes(rec.seat)) return;
  rec.seat = 'flight';
  g.people.you.role = SEATS.flight;
  note('Houston has you back on a flight-director shift: the rest of your career is flown from the console.');
}

// Which round a checkpoint is on. Saves carry the round's id. Older ones carry only its place in the season, and the
// places moved when the Mercury, Gemini and Apollo rounds went in (Ranger 7 was round 18; it now comes after Apollo), so
// a round that does not match its place is found by its vehicle and the date.
export function roundIndexOf(saved) {
  if (saved.roundId) {
    const i = SEASON.findIndex(r => r.id === saved.roundId);
    if (i >= 0) return i;
  }
  const vehicle = saved.round?.vehicle;
  if (!vehicle || SEASON[saved.roundIndex]?.vehicle === vehicle) return saved.roundIndex;
  const fits = SEASON.map((r, i) => [r, i]).filter(([r]) => r.vehicle === vehicle && r.start <= saved.day);
  return fits.length ? fits[fits.length - 1][1] : saved.roundIndex;
}

// A round written up in a build before its turning point existed (Pioneer 4's NASA offer came in with Mercury): the
// offer is put to you now, as the review would have.
function catchUpOffer() {
  const round = SEASON[g.roundIndex],
    offer = round.turningPoint && offerFor(round.turningPoint);
  if (!offer || g.record.seat === offer.seat || g.record.offers.some(o => o.seat === offer.seat)) return;
  if (g.record.rounds[g.record.rounds.length - 1]?.id !== round.id) return;
  const o = turningPoint(g.record, offer, g.day);
  const by = g.people[offer.from || 'ellis'].name.split(' ').pop();
  note(
    o.made
      ? `${by} put your name forward: ${offer.title.toLowerCase()}.`
      : `${offer.title} was on offer. ${by} did not put your name forward.`,
  );
}

// Who flies round i: the season's crew, with everyone the game has lost replaced by the living astronaut who takes his
// place. Deaths are never scripted (C3); when one happens, the later crews hear about it here.
export function crewOf(i = g.roundIndex) {
  const crew = SEASON[i].crew;
  if (!crew || !g?.crewSwaps) return crew;
  const swaps = g.crewSwaps,
    start = roundStartOf(i),
    lost = lossDays();
  return crew.map(id => {
    let who = id;
    // A substitute can himself be lost later; the chain ends on a living man. A swap only reaches rounds that start
    // after the loss: a death changes nobody who has already flown, nor the crew of the flight it happened on.
    for (let n = 0; swaps[who] && lost[who] != null && lost[who] < start && n < Object.keys(swaps).length; n++)
      who = swaps[who];
    return who;
  });
}

// The day each lost astronaut was lost, by id. Older saves kept only the names, so those are read back through the roster.
export function lossDays(record = g.record) {
  const byName = Object.fromEntries(Object.entries(ASTRONAUTS).map(([id, a]) => [a.name, id]));
  const days = {};
  for (const l of record.losses || [])
    for (const id of l.ids ||
      l.name
        .split(', ')
        .map(n => byName[n])
        .filter(Boolean))
      days[id] ??= l.day;
  return days;
}

// Everyone the game has lost, by id. Older saves kept only the names, so those are read back through the roster.
export function lostIds(record = g.record) {
  const byName = Object.fromEntries(Object.entries(ASTRONAUTS).map(([id, a]) => [a.name, id]));
  return new Set(
    (record.losses || []).flatMap(
      l =>
        l.ids ||
        l.name
          .split(', ')
          .map(n => byName[n])
          .filter(Boolean),
    ),
  );
}

// The living astronaut who takes a lost man's place, or null if nobody is left. The pick is deterministic: someone from
// his own group if he can be, otherwise from the most recent group selected before the flight (so the Artemis seats go
// to the 1996 class before anyone from Mercury), never anyone the game has lost and never anyone already booked beside him.
function standIn(id, seatDay, gone, booked) {
  const own = GROUPS.find(gr => gr.ids.includes(id));
  const before = GROUPS.filter(gr => dayOf(gr.year, 1, 1) <= seatDay).reverse();
  const order = [...(own ? own.ids : []), ...before.flatMap(gr => gr.ids)];
  return order.find(who => who !== id && !gone.has(who) && !booked.has(who)) || null;
}

// An astronaut (or a whole crew) has died. The record keeps their names and ids; every crew still to come that he was
// on is re-flown by a living stand-in (standIn). Everyone lost in the same accident is gone before any seat is refilled,
// so a crewmate who died beside him is never picked.
export function recordDeaths(ids, day = g.day, round = SEASON[g.roundIndex].id) {
  const names = ids.map(id => ASTRONAUTS[id].name).join(', ');
  (g.record.losses = g.record.losses || []).push({ name: names, ids: [...ids], day, round });
  replaceLostCrew(ids, day, lostIds());
}

function replaceLostCrew(ids, day, gone) {
  // The rounds still to come: a death changes nobody who has already flown.
  const ahead = SEASON.map((r, i) => [r, i]).filter(([r, i]) => (r.crew || []).length && roundStartOf(i) > day);
  for (const id of ids) {
    const seats = ahead.filter(([, i]) => crewOf(i).includes(id));
    if (g.crewSwaps[id] || !seats.length) continue;
    const booked = new Set(seats.flatMap(([, i]) => crewOf(i) || []).filter(who => who !== id));
    const pick = standIn(id, roundStartOf(seats[0][1]), gone, booked);
    if (pick) g.crewSwaps[id] = pick;
  }
}

// The parts of the game that belong to one round, cleared before each.
function resetRound() {
  Object.assign(g, {
    console: null,
    jobs: [],
    pending: null,
    marker: null,
    rocket: { where: 'hangar', mated: false, x: 0, rise: 0 },
    truck: { x: PLACES.truck.x, target: PLACES.truck.x, dust: false, follow: false, then: null },
    stand: null,
    count: null,
    flight: null,
    lunar: null,
    review: null,
    recovery: null,
    slipDays: 0,
    launchDay: null,
    offDays: {},
    looked: {},
    flagged: {},
    decided: {},
    standFlame: 0,
    plan: null,
    readings: null,
  });
  for (const [id, p] of Object.entries(PEOPLE))
    Object.assign(g.people[id], { x: p.x, target: p.x, bubble: null, working: false, hidden: false });
}

// The kind of round the current one is, and who is on site for it.
function setVehicle() {
  g.vehicle = SEASON[g.roundIndex].vehicle;
  g.people.hoyt.hidden = !['v2', 'bumper'].includes(g.vehicle);
  g.people.brandt.hidden = ![
    'aerobee',
    'viking',
    'vanguard',
    'juno',
    'ranger',
    'redstone',
    'atlas',
    'titan',
    'saturn5',
  ].includes(g.vehicle);
  g.site = SEASON[g.roundIndex].site || 'white-sands';
  // A Mercury round: Mercury Control's people are on site, Ellis is back at JPL, and the others have Mercury jobs.
  g.crewed = !!SEASON[g.roundIndex].crewed;
  for (const id of Object.keys(MERCURY_PEOPLE)) g.people[id].hidden = !g.crewed;
  g.program = (g.crewed && SEASON[g.roundIndex].crewed) || null;
  const houston = g.crewed && g.program !== 'mercury';
  g.people.tate.hidden = !(g.crewed && (g.record.seat === 'engineer' || (houston && g.record.seat !== 'retro')));
  for (const id of Object.keys(GEMINI_PEOPLE)) g.people[id].hidden = !houston;
  g.people.crew2.hidden = true;
  if (crewOf()?.[1]) g.people.crew2.name = ASTRONAUTS[crewOf()[1]].name;
  g.people.ellis.hidden = g.crewed;
  const pilot = crewOf()?.[0];
  g.people.pilot.hidden = !pilot;
  if (pilot) Object.assign(g.people.pilot, { name: ASTRONAUTS[pilot].name, crewId: pilot });
  for (const [id, role] of Object.entries(ROLES))
    if (g.people[id])
      g.people[id].role =
        houston && GEMINI_ROLES[id] ? GEMINI_ROLES[id] : g.crewed && MERCURY_ROLES[id] ? MERCURY_ROLES[id] : role;
  if (houston && g.record.seat === 'retro') g.people.tate.role = 'Retrofire officer, back room';
  g.people.you.role = SEATS[g.record.seat];
  g.people.ellis.role = g.record.seat === 'junior' ? 'Chief Engineer, your boss' : 'Chief Engineer, JPL';
}
// What a building is called now: the Cape's Mercury buildings stand where the old ones did.
export const placeName = id =>
  (g.crewed && g.program === 'apollo' && APOLLO_PLACES[id]) ||
  (g.crewed && g.program !== 'mercury' && GEMINI_PLACES[id]) ||
  (g.crewed && MERCURY_PLACES[id]) ||
  PLACES[id]?.name;

// When round i starts: its date, later by any slip the Apollo programme has taken on.
export const roundStartOf = i => SEASON[i].start + (SEASON[i].crewed === 'apollo' ? g.programme.apolloSlip || 0 : 0);
// January 1967: the plugs-out test on the first crewed Apollo, in pure oxygen at full pressure. Whether the wiring
// sparks is the hidden layer's; nothing is scripted. Either way the next round hears how it went.
export function apolloFireLines() {
  const fire = apolloFire(g.seed, g.programme);
  if (!fire)
    return [
      'On 27 January 1967 the first Apollo crew ran the plugs-out test on Pad 34 in pure oxygen at full pressure. It went clean. Apollo 1 flew in February: two weeks in Earth orbit with a cabin that hummed and smelled of hot wiring, and came home.',
      'The programme office wants that wiring looked at before anyone goes to the Moon.',
    ];
  // The first Apollo crew as named in 1966, with anyone already lost replaced the way every later crew is.
  const day = dayOf(1967, 1, 27),
    gone = lostIds(),
    dead = [];
  for (const id of ['whitcomb', 'castellano', 'harlan']) {
    let who = id;
    for (let n = 0; g.crewSwaps?.[who] && n < 50; n++) who = g.crewSwaps[who];
    if (gone.has(who)) who = standIn(who, day, gone, new Set(dead));
    if (who) dead.push(who);
  }
  recordDeaths(dead, day, 'apollo-1');
  const names = dead.map(id => ASTRONAUTS[id].name).join(', ');
  const fix = adopt(g.programme, 'cabin');
  return [
    `On 27 January 1967, in the plugs-out test on Pad 34, a spark in the wiring under the couches lit the pure-oxygen cabin. ${names} died in seconds behind a hatch that opened inward. Nobody on the pad could reach them.`,
    'Apollo stopped for twenty months while the spacecraft was rebuilt.',
    fix || '',
  ].filter(Boolean);
}

// Round i: a fresh round built the way the team now builds them.
function startRound(i) {
  resetRound();
  g.roundIndex = i;
  setVehicle();
  g.roundStart = g.day = roundStartOf(i);
  g.clock = g.day * 1440 + START_MINUTE;
  // Fixes made between flights whatever the reviews said (Marshall's after MR-1 and Ham's flight).
  for (const cause of SEASON[i].adopt || []) adopt(g.programme, cause);
  const round = newRound(g.seed + i * 7919, { ...g.programme, ...SEASON[i].risk }, g.vehicle);
  if (SEASON[i].risk?.seg51Risk != null) round.seg51Risk = SEASON[i].risk.seg51Risk;
  round.initial = {
    faults: { ...round.faults },
    igniter: hasIgniterFault(round),
    pump: hasPumpFault(round),
    liner: hasLinerFault(round),
    injector: hasInjectorFault(round),
  };
  round.estimate = estimate(g.programme, g.vehicle, 1);
  g.round = round;
  if (g.crewed) return CREWED.startMission();
  morning('brief');
}

// ---- Work days and checkpoints ----
// Each morning with work for the player is saved as a checkpoint before the day begins: plain JSON, no running jobs.
// Days with nothing for the player's seat are skipped; what happened on them is told on arrival ("while you were away").
// A finished round is saved too ('roundEnd'), so quitting there resumes at the review's outcome, not before the count.
const MORNING_BEATS = [
  'brief',
  'staticPrep',
  'rollout',
  'roundEnd',
  'seasonEnd',
  'mBrief',
  'mLaunch',
  'mPadSafe',
  'sRoute',
  'sApollo8',
  'lCruise',
  'lEncounter',
];
export function morning(beat) {
  g.saved = structuredClone({
    seed: g.seed,
    roundIndex: g.roundIndex,
    roundId: SEASON[g.roundIndex].id,
    programme: g.programme,
    record: g.record,
    day: g.day,
    clock: g.clock,
    beat,
    round: g.round,
    notes: g.notes,
    slipDays: g.slipDays,
    offDays: g.offDays,
    looked: g.looked,
    flagged: g.flagged,
    decided: g.decided,
    away: g.away,
    review: g.review,
    launchDay: g.launchDay,
    plan: g.plan,
    mission: g.mission ?? null,
    crewSwaps: g.crewSwaps,
  });
  g.savedVersion++;
  setBeat(beat);
}
export const checkpoint = () => g.saved;

// Throws if a saved checkpoint cannot be resumed.
export function checkCheckpoint(saved) {
  const need = (ok, what) => {
    if (!ok) throw new Error(`missing or bad ${what}`);
  };
  need(saved && typeof saved === 'object', 'checkpoint');
  need(MORNING_BEATS.includes(saved.beat), 'beat');
  need(Number.isInteger(saved.day) && saved.day >= 0 && Number.isFinite(saved.clock), 'day');
  need(Number.isInteger(saved.seed) && Number.isInteger(saved.roundIndex) && SEASON[saved.roundIndex], 'season');
  need(
    saved.programme &&
      typeof saved.programme.weldRisk === 'number' &&
      Array.isArray(saved.programme.flights) &&
      Array.isArray(saved.programme.adopted),
    'programme',
  );
  need(saved.record && Array.isArray(saved.record.rounds) && Number.isFinite(saved.record.trust), 'record');
  need(
    saved.round && ['physical', 'observation', 'forecast'].every(k => Number.isInteger(saved.round.rng?.[k]?.state)),
    'round',
  );
  need(
    saved.round.faults &&
      typeof saved.round.faults === 'object' &&
      Array.isArray(saved.round.events) &&
      saved.round.estimate,
    'round record',
  );
  need(Array.isArray(saved.notes) && saved.notes.every(n => n && typeof n.text === 'string'), 'notebook');
  for (const k of ['offDays', 'looked', 'flagged', 'decided']) need(saved[k] && typeof saved[k] === 'object', k);
}

export function closeAway() {
  g.away = null;
  if (g.room === 'away') g.room = null;
}

// ---- Small helpers the beats use ----
export const you = () => g.people.you;
export function say(id, text, tone = '', seconds = 4.5) {
  const p = g.people[id];
  if (!p || typeof text !== 'string' || !text) return; // nothing to say: never put an empty bubble on the site
  p.bubble = { text, tone, until: g.time + seconds };
  g.loop.push({ who: p.name, text, tone, at: clockText() });
  if (g.loop.length > 40) g.loop.shift();
}
export const walk = (id, x) => {
  g.people[id].target = x;
};
export const place = (id, x) => {
  const p = g.people[id];
  p.x = p.target = x;
};
// Each note carries its round, so the notebook can show this round's notes and clear the earlier ones. The notebook keeps
// at most NOTEBOOK_MAX notes, dropping the oldest: your record keeps what each round came to.
export const NOTEBOOK_MAX = 300;
export function note(text) {
  g.notes.push({ at: clockText(), text, round: g.roundIndex });
  if (g.notes.length > NOTEBOOK_MAX) g.notes.splice(0, g.notes.length - NOTEBOOK_MAX);
}
// Clear the notebook of earlier rounds' notes. This round's stay: the review needs them. Returns how many went.
export function clearNotes() {
  const before = g.notes.length;
  g.notes = g.notes.filter(n => n.round === g.roundIndex);
  if (g.saved) {
    g.saved.notes = g.saved.notes.filter(n => n.round === g.saved.roundIndex);
    g.savedVersion++;
  }
  return before - g.notes.length;
}
const arrived = ids => ids.every(id => Math.abs(g.people[id].x - g.people[id].target) < 1);
export const roomChanged = () => {
  g.roomVersion++;
};

// A crew job at a place: the workers walk there, then work for `minutes` of game time. then() runs when it is done.
export function addJob({ label, at, who, minutes = 0, quiet = false, then }) {
  who.forEach((id, i) => walk(id, at + (i - (who.length - 1) / 2) * 22));
  g.jobs.push({ label, at, who, minutes, left: minutes, quiet, then });
}

export const dateText = (day = g.day) => `${weekday(day)} ${dateLabel(day)}`;
export function clockText(minute = g.clock) {
  const m = Math.floor(minute) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---- The beats ----
export function setBeat(name, objective) {
  g.beat = name;
  g.dayDone = false;
  if (g.crewed && !crewedLoaded)
    throw new Error(
      `beat ${name} needs the crewed modules, which did not register: load js/mercury.js (see registerCrewed)`,
    );
  (BEATS[name] || EXTRA_BEATS[name])?.();
  if (objective) g.objective = objective;
  roomChanged();
}

const BEATS = {
  brief() {
    if (conducting()) {
      g.objective =
        'You are the test conductor. Plan the round in the technical office: who looks her over, which firing, and the checks.';
      const line = `The range has us down for ${dateText(g.roundStart + PLANNED_LAUNCH_DAY)}. Your round, conductor. Don't lose me the slot.`;
      say('brandt', line, '', 8);
      note(
        `${SEASON[g.roundIndex].name[0].toUpperCase()}${SEASON[g.roundIndex].name.slice(1)}, with you as test conductor. Brandt: ${line}`,
      );
      g.people.kowalski.working = g.people.delgado.working = true;
      return;
    }
    g.objective = kit().inspect.objective;
    const line = briefLine();
    say('ellis', line, '', 8);
    note(`${SEASON[g.roundIndex].name[0].toUpperCase()}${SEASON[g.roundIndex].name.slice(1)}. Ellis: ${line}`);
    g.people.kowalski.working = g.people.delgado.working = true;
    if (!g.people.hoyt.hidden) {
      g.people.hoyt.working = true;
      say('hoyt', "She's all yours. Mind the vanes, they crack if you look at them wrong.", '', 6);
    }
  },
  board() {
    g.objective = 'Set the propellant load at the drawing board in the technical office.';
    walk('ellis', 240);
  },
  evening1() {
    g.objective = 'Your work for today is done. Watch the crew, or end the day.';
    g.dayDone = true;
  },
  staticPrep() {
    g.objective = `The crew is moving the ${kit().stand.thing} to the test stand. Go to the dugout for the static fire.`;
    place('you', PLACES.office.door);
    place('ellis', 230);
    g.rocket.where = 'carried';
    g.people.kowalski.working = g.people.delgado.working = false;
    place('kowalski', 660);
    place('delgado', 720);
    addJob({
      label: 'Carrying to the stand',
      at: PLACES.stand.x + 60,
      who: ['kowalski', 'delgado'],
      then: () => {
        g.rocket.where = 'stand';
        addJob({
          label: 'Plumbing in',
          at: PLACES.stand.x + 60,
          who: ['kowalski', 'delgado'],
          minutes: 50,
          then: () => {
            say('kowalski', 'Stage is plumbed in and loaded. Clear the stand!', 'go');
            walk('kowalski', PLACES.dugout.door - 20);
            walk('delgado', PLACES.dugout.door + 24);
            setBeat('static');
          },
        });
      },
    });
    walk('ellis', PLACES.dugout.door + 50);
    say('ellis', "I'll see you at the dugout.");
  },
  static() {
    const burn = g.plan?.burn || 'short';
    g.objective =
      burn === 'long'
        ? `The ${kit().stand.thing} is on the stand for a full-duration firing. Go into the dugout and run it.`
        : 'The stage is on the stand. Go into the dugout and run the static fire.';
    g.stand = { phase: 'ready', clock: 10, trace: null, shown: 0, held: false, burn };
  },
  afterStatic() {
    g.objective = 'The firing is done. Watch the crew, or end the day.';
    g.dayDone = true;
  },
  rollout() {
    g.objective =
      'Rollout. The crew is mating the booster and taking the round to the tower. Go to the blockhouse when it is up.';
    place('you', PLACES.office.door);
    place('ellis', 250);
    g.rocket.where = 'hangar';
    place('kowalski', 650);
    place('delgado', 780);
    // A leak check you planned as conductor is done first thing, before the booster goes on.
    let extra = 0;
    if (g.plan?.leak) {
      const r = leakCheck(g.round);
      extra = r.hours * 60;
      note(
        r.found
          ? `Planned leak check before rollout: leak at the ${r.found.toLowerCase()}, fixed.`
          : 'Planned leak check before rollout: nothing found.',
      );
    }
    addJob({
      label:
        {
          wac: 'Mating the booster',
          v2: 'Readying the V-2',
          bumper: 'Mating the WAC to the V-2',
          aerobee: extra ? 'Leak check, then mating the booster' : 'Mating the booster',
        }[g.vehicle] || (extra ? `Leak check, then readying the ${kit().name}` : `Readying the ${kit().name}`),
      at: PLACES.hangar.x + 190,
      who: ['kowalski', 'delgado'],
      minutes: 60 + extra,
      then: () => {
        g.rocket.mated = true;
        g.truck.target = PLACES.hangar.x + 130;
        g.truck.then = () => {
          g.rocket.where = 'truck';
          say('kowalski', "She's on the truck. Rolling out!", 'go');
          g.truck.target = PLACES.tower.x - 60;
          g.truck.dust = true;
          walk('kowalski', PLACES.tower.x - 40);
          walk('delgado', PLACES.tower.x - 70);
          g.truck.then = () => {
            g.truck.dust = false;
            addJob({
              label: 'Raising into the tower',
              at: PLACES.tower.x + 25,
              who: ['kowalski', 'delgado', 'vega', ...(g.people.hoyt.hidden ? [] : ['hoyt'])],
              minutes: 45,
              then: () => {
                g.rocket.where = 'tower';
                g.truck.target = PLACES.truck.x;
                say('vega', "Round is in the tower. Blockhouse, she's yours when you're ready.", 'go');
                setBeat('countReady');
              },
            });
          };
        };
      },
    });
    walk('ellis', PLACES.blockhouse.door - 30);
    walk('morgan', PLACES.blockhouse.door + 40);
  },
  countReady() {
    g.objective = 'The round is in the tower. Go into the blockhouse for the count.';
  },
  recovery() {
    g.objective = atSea()
      ? 'Go over to the telemetry building with Morgan: take the range car.'
      : 'Ride out with the recovery party: go to the truck.';
    // Board beside the truck, not in its bed: the door stands at the cab.
    walk('morgan', PLACES.truck.door + 55);
    walk('kowalski', PLACES.truck.door - 60);
    say(
      'morgan',
      atSea()
        ? kit().deep
          ? 'The tracking reports are coming in. Coming over?'
          : 'Whatever came down is in the Atlantic. The telemetry records are being pulled now. Coming?'
        : "Truck's leaving for the impact area. Coming?",
    );
  },
  review() {
    g.objective = conducting()
      ? 'You chair the review. Go to the technical office: the team will give you their readings, and the call is yours.'
      : 'Ellis wants your findings. Go to the technical office.';
    // The team's own readings of the evidence, each fallible in the same way Ellis is.
    if (conducting()) g.readings = { kowalski: ellisReading(g.round), morgan: ellisReading(g.round) };
    place('ellis', 230);
    place('morgan', 270);
    place('vega', 2000);
    place('kowalski', 650);
    place('delgado', 780);
    g.people.morgan.hidden = g.people.kowalski.hidden = g.people.you.hidden = false;
    place('you', PLACES.truck.door + 50);
  },
  roundEnd() {
    g.objective = 'The round is written up. Carry on to the next round from the office when you are ready.';
    if (!g.away) g.room = 'roundEnd';
  },
  seasonEnd() {
    // The way back from the uncrewed years (C1): Houston staffs Gemini and asks JPL for its range man. Made here, at the
    // branch's last round, for a player who declined the 1959 offer or was passed over — and for a save written before
    // this existed, which lands here on load. Never remade once answered or made.
    if (nextIndex() == null && g.record.path !== 'nasa' && !g.record.offers.some(o => o.seat === 'flight')) {
      turningPoint(g.record, GEMINI_OFFER, g.day);
      note('Houston is staffing Gemini. Ellis put your name forward.');
    }
    g.objective = 'Your years on the range are written up. Your record, and what comes next, are in the office.';
    if (!g.away) g.room = 'seasonEnd';
  },
};

// ---- Rooms: what each building offers right now ----
export function roomFor(id) {
  if (g.crewed) return CREWED.missionRoomFor(id);
  if (id === 'hangar')
    return g.beat === 'brief' && (!conducting() || g.plan?.inspector === 'you') ? 'inspect' : 'watch';
  if (id === 'office' && CREWED.lunarRoom?.()) return CREWED.lunarRoom();
  if (id === 'office')
    return g.beat === 'brief' && conducting() && !g.plan
      ? 'plan'
      : g.beat === 'board'
        ? 'board'
        : g.beat === 'review'
          ? conducting()
            ? 'chair'
            : 'review'
          : ['roundEnd', 'seasonEnd'].includes(g.beat)
            ? g.beat
            : 'watch';
  if (id === 'dugout') return g.beat === 'static' ? 'static' : 'watch';
  if (id === 'blockhouse') return g.beat === 'countReady' || g.count ? 'count' : 'watch';
  if (id === 'truck') return g.beat === 'recovery' ? 'recovery' : 'watch';
  return 'watch';
}

// ---- Planning the round, as test conductor ----
// plan: { inspector: 'you' | 'kowalski' | 'delgado', burn: 'short' | 'long', leak: bool }. A full-duration firing shows the
// liner's wall temperature, but the chamber has to be pulled and checked afterwards, which costs a day of the range slot.
export function finishPlan(plan) {
  if (!conducting() || g.beat !== 'brief' || g.plan) return;
  g.plan = { inspector: plan.inspector || 'you', burn: plan.burn === 'long' ? 'long' : 'short', leak: !!plan.leak };
  note(
    `Your plan: ${INSPECTORS[g.plan.inspector].name === 'You' ? 'you look her over yourself' : `${INSPECTORS[g.plan.inspector].name} looks her over`}; ${g.plan.burn === 'long' ? 'a full-duration firing' : 'a short start-up firing'} on the stand; ${g.plan.leak ? 'a leak check before rollout' : 'no extra leak check'}.`,
  );
  if (onBudget()) {
    if (COSTS.inspect[g.plan.inspector])
      spend(g.record, g.day, COSTS.inspect[g.plan.inspector], `${INSPECTORS[g.plan.inspector].name}'s inspection`);
    if (g.plan.leak) spend(g.record, g.day, COSTS.leak, 'leak check before rollout');
  }
  if (g.plan.inspector === 'you') {
    g.objective = kit().inspect.objective;
    roomChanged();
    return;
  }
  const who = g.plan.inspector,
    crew = g.people[who];
  say(who, "Right, I'll go over her now.");
  g.people.kowalski.working = g.people.delgado.working = false;
  addJob({
    label: `Inspecting the ${kit().name}`,
    at: PLACES.hangar.x + 190,
    who: [who],
    minutes: INSPECTORS[who].hours * 60,
    then: () => {
      const ids = crewInspect(g.round, TRAITS[who]);
      const hours = flagSpots(g.round, ids);
      g.flagged = Object.fromEntries(ids.map(id => [id, true]));
      const names = ids.map(id => kit().spots[id].name.toLowerCase());
      say(
        who,
        ids.length
          ? `I didn't like the look of the ${names.join(' and the ')}. We'll open ${ids.length === 1 ? 'it' : 'them'} up.`
          : 'She looks clean to me. Buttoning her up.',
        '',
        7,
      );
      note(ids.length ? `${crew.name} flagged: ${names.join(', ')}.` : `${crew.name} found nothing to flag.`);
      if (hours)
        addJob({
          label: 'Working the flags',
          at: PLACES.hangar.x + 190,
          who: ['kowalski', 'delgado'],
          minutes: hours * 60,
          then: () => say('kowalski', reportOnFlags(ids), '', 6),
        });
      setBeat('board');
    },
  });
  g.objective = `${crew.name} is looking the ${kit().name} over in the hangar. You can watch, or wait.`;
  roomChanged();
}

// ---- The hangar inspection ----
export function lookAt(id) {
  if (g.looked[id] != null) return;
  g.looked[id] = g.round.cues[id];
  g.clock += 15;
  const spot = kit().spots[id];
  note(`${spot.name}: ${g.round.cues[id] ? spot.cue : spot.sound}`);
  roomChanged();
}
export function finishInspection(flags) {
  const ids = Object.keys(flags).filter(k => flags[k]);
  g.flagged = { ...flags };
  const hours = flagSpots(g.round, ids);
  if (ids.length) {
    note(`You flagged: ${ids.map(id => kit().spots[id].name.toLowerCase()).join(', ')}.`);
    addJob({
      label: 'Working your flags',
      at: PLACES.hangar.x + 190,
      who: ['kowalski', 'delgado'],
      minutes: hours * 60,
      then: () => {
        g.people.kowalski.working = g.people.delgado.working = false;
        say('kowalski', reportOnFlags(ids), '', 6);
      },
    });
    g.people.kowalski.working = g.people.delgado.working = true;
    say('kowalski', `Right, we'll open up ${ids.length === 1 ? 'that one' : 'those'}.`);
  } else say('kowalski', "Clean bill of health, then. We'll button her up.");
  setBeat('board');
}
function reportOnFlags(ids) {
  const found = g.round.events.filter(e => e.includes('real')).length;
  return found
    ? `Good call. We found ${found === 1 ? 'a real one' : 'real trouble'} and fixed it.`
    : 'Opened it all up. Nothing wrong that we could see.';
}

// ---- The drawing board ----
export function setLoad(load) {
  g.round.propellantLoad = load;
  g.round.estimate = estimate(g.programme, g.vehicle, load);
}
export function finishBoard() {
  note(
    `Propellant load set to ${Math.round(g.round.propellantLoad * 100)}%. Drawing office estimate: ${g.round.estimate.low}–${g.round.estimate.high} km.`,
  );
  say(
    'ellis',
    g.round.propellantLoad >= 0.97
      ? "Full tanks. Fair enough, let's see what she does."
      : 'Playing it safe. Good, the range will thank you.',
  );
  g.clock += 40;
  setBeat('evening1');
}

// ---- The static fire, run by the player from the dugout ----
export function standStart() {
  const s = g.stand;
  if (s.phase === 'ready' || s.phase === 'held') {
    s.phase = 'count';
    roomChanged();
  }
}
export function standHold() {
  const s = g.stand;
  if (s.phase === 'count') {
    s.phase = 'held';
    say('you', 'Hold, hold, hold!', 'warn');
    roomChanged();
  }
}
export function standLeakCheck() {
  const s = g.stand;
  if (s.phase !== 'held' && s.phase !== 'ready') return;
  s.phase = 'leakcheck';
  const r = leakCheck(g.round);
  if (r.found) g.decided.leakFixed = r.found;
  note(
    r.found
      ? `Leak check before the firing: leak found at the ${r.found.toLowerCase()} and fixed.`
      : 'Leak check before the firing: nothing found.',
  );
  addJob({
    label: 'Leak check',
    at: PLACES.stand.x + 60,
    who: ['kowalski', 'delgado'],
    minutes: r.hours * 60,
    then: () => {
      say(
        'kowalski',
        r.found ? `Found it: the ${r.found.toLowerCase()}. Fixed.` : 'Nothing leaking that we can find.',
        r.found ? 'go' : '',
      );
      walk('kowalski', PLACES.dugout.door - 20);
      walk('delgado', PLACES.dugout.door + 24);
      s.phase = 'ready';
      s.clock = 10;
      roomChanged();
    },
  });
  roomChanged();
}
// The tank gauge the dugout shows before and during the firing, from the seconds since the stage was pressurised.
export const standTank = () => tankGauge(g.round, g.stand.pressurised || 0);

export function standDecide(choices) {
  const s = g.stand;
  g.decided = { ...g.decided, ...choices };
  let hours = 0;
  const st = kit().stand;
  if (choices.rework) {
    standRework(g.round);
    hours += 8;
    note(`You asked for this: ${st.rework.toLowerCase()}.`);
    if (onBudget()) spend(g.record, g.day, COSTS.rework, st.reworkJob.toLowerCase());
  }
  if (choices.leak) {
    const r = leakCheck(g.round);
    if (r.found) g.decided.leakFixed = r.found;
    hours += r.hours;
    note(
      r.found
        ? `Leak check after the firing: leak at the ${r.found.toLowerCase()}, fixed.`
        : 'Leak check after the firing: nothing found.',
    );
  }
  if (!choices.rework && !choices.leak) note('You cleared the stage for flight.');
  s.phase = 'decided';
  g.rocket.where = 'carried';
  addJob({
    label: 'Back to the hangar',
    at: PLACES.hangar.x + 160,
    who: ['kowalski', 'delgado'],
    then: () => {
      g.rocket.where = 'hangar';
      // A rework fills the next day, which is told as a day away; a leak check alone is done overnight.
      if (hours)
        addJob({
          label: choices.rework ? st.reworkJob : 'Leak check',
          at: PLACES.hangar.x + 190,
          who: ['kowalski', 'delgado'],
          minutes: hours * 60,
          quiet: hours >= 8,
          then: () => {},
        });
    },
  });
  if (s.burn === 'long' && onBudget()) spend(g.record, g.day, COSTS.long, 'full-duration firing');
  if (s.burn === 'long' && hours < 8) {
    g.slipDays += 1;
    g.offDays[g.day + 1] = 'The crew pulled the chamber after the full-duration firing and checked it over.';
    say('brandt', 'A full-duration firing costs us a day of range time. I hope it was worth it.', 'warn', 6);
  } else if (hours >= 8) {
    g.slipDays += 1;
    g.offDays[g.day + 1] = st.reworkDay;
    say('ellis', st.reworkSay, 'warn', 6);
  } else say('ellis', "Good. Let's get her ready for the tower.");
  setBeat('afterStatic');
}

// ---- The count, in the blockhouse ----
const COUNT = [
  { at: 600, who: 'vega', text: 'Pad crew at the tower. Final arming under way.' },
  { at: 540, who: 'morgan', text: 'Radar has the balloon. Winds light, from the west.' },
  { at: 450, who: 'ellis', text: 'PRESS, report tank pressure.', poll: 'tank' },
  {
    at: 360,
    who: 'vega',
    text: 'Arming complete. Pad crew coming in.',
    act: () => {
      walk('vega', PLACES.blockhouse.door + 10);
      walk('kowalski', PLACES.blockhouse.door + 60);
      walk('delgado', PLACES.blockhouse.door + 80);
    },
  },
  { at: 240, who: 'ellis', text: 'Tower is clear. Doors closing.' },
  { at: 180, who: 'morgan', text: 'Range is clear. Range is go.', tone: 'go' },
  { at: 120, who: 'ellis', text: 'PRESS, tank pressure and igniter circuit for the last time.', poll: 'final' },
  { at: 60, who: 'vega', text: 'One minute.' },
  { at: 30, who: 'vega', text: 'Thirty seconds. Cameras and recorders running.' },
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ at: n, who: 'vega', text: `${n}…`, quick: true })),
  { at: 0, who: 'vega', text: 'Fire!', tone: 'go' },
];
export const NORMAL_TANK = [22, 24];

export function countStart() {
  if (g.count) return;
  g.count = { clock: 600, next: 0, poll: null, held: false, readings: [], leakChecks: 0, since: 0 };
  place('you', PLACES.blockhouse.door - 10);
  setBeat(
    'count',
    conducting()
      ? 'Run the count. Poll your stations when the count reaches each poll, read your own gauges, and call a hold if anything looks wrong.'
      : 'Take part in the count. Answer your polls from the PRESS panel, and call a hold if anything looks wrong.',
  );
}
export const countTank = () => tankGauge(g.round, g.count.since);
// As test conductor you poll the stations; Delgado has PRESS. Each reports, and the GO or HOLD is yours.
function stationReports(count) {
  const reading = countTank(),
    inBand = reading >= NORMAL_TANK[0] && reading <= NORMAL_TANK[1];
  const pressGo = stationCall(g.round, inBand, TRAITS.delgado.lazyGo);
  count.reports = [
    {
      who: 'delgado',
      station: 'PRESS',
      text: `Tank at ${reading.toFixed(1)}. PRESS is ${pressGo ? 'go' : 'no-go'}.`,
      go: pressGo,
      reading,
    },
    { who: 'morgan', station: 'RANGE', text: 'Range is go.', go: true },
    {
      who: 'vega',
      station: 'PAD',
      text: count.poll === 'final' ? 'Igniter circuit has continuity. Pad is go.' : 'Pad is go.',
      go: true,
    },
  ];
  for (const r of count.reports) say(r.who, `${r.station}: ${r.text}`, r.go ? 'go' : 'bad', 3);
  note(
    `T-${Math.ceil(count.clock)} s poll: ${count.reports.map(r => `${r.station} ${r.go ? 'go' : 'no-go'}`).join(', ')}. PRESS read the tank at ${reading.toFixed(1)} bar.`,
  );
}

export function countAnswer(go) {
  const count = g.count;
  if (!count.poll) return;
  const reading = countTank();
  count.readings.push({ at: count.clock, value: reading, go });
  if (conducting()) {
    note(
      `T-${Math.ceil(count.clock)} s: the gauge on your console read ${reading.toFixed(1)} bar (normal ${NORMAL_TANK[0]}–${NORMAL_TANK[1]}). You called ${go ? 'GO' : 'HOLD'}.`,
    );
    say(
      'you',
      go ? 'All stations go. Continue the count.' : "Hold the count. I don't like that tank pressure.",
      go ? 'go' : 'bad',
    );
    count.reports = null;
  } else {
    note(
      `T-${count.clock} s: you read tank pressure ${reading.toFixed(1)} bar (normal ${NORMAL_TANK[0]}–${NORMAL_TANK[1]}) and called ${go ? 'GO' : 'HOLD'}.`,
    );
    say(
      'you',
      go
        ? `PRESS is go. Tank at ${reading.toFixed(1)}.`
        : `PRESS is no-go! Tank at ${reading.toFixed(1)}. Hold the count.`,
      go ? 'go' : 'bad',
    );
  }
  count.poll = null;
  if (!go) count.held = true;
  roomChanged();
}
export function countHold() {
  const count = g.count;
  if (count && !count.held) {
    count.held = true;
    say('you', 'Hold! Hold the count!', 'warn');
    roomChanged();
  }
}
export function countResume() {
  const count = g.count;
  if (count && count.held && !count.poll && !count.checking) {
    count.held = false;
    say(conducting() ? 'you' : 'ellis', 'Resuming the count.');
    roomChanged();
  }
}
export function countLeakCheck() {
  const count = g.count;
  if (!count || !count.held || count.checking) return;
  count.checking = true;
  count.poll = null;
  count.leakChecks++;
  say(conducting() ? 'you' : 'ellis', 'Send the pad crew out. Check every line on her.', 'warn');
  const r = leakCheck(g.round);
  addJob({
    label: 'Pad leak check',
    at: PLACES.tower.x + 25,
    who: ['vega', 'kowalski'],
    minutes: r.hours * 60,
    then: () => {
      say(
        'vega',
        r.found ? `Found a leak at the ${r.found.toLowerCase()}. Fixed it.` : 'Every line is tight. No leak.',
        r.found ? 'go' : '',
      );
      note(
        r.found
          ? `Pad leak check during the count: leak at the ${r.found.toLowerCase()}, fixed.`
          : 'Pad leak check during the count: nothing found.',
      );
      walk('vega', PLACES.blockhouse.door + 10);
      walk('kowalski', PLACES.blockhouse.door + 60);
      count.awaitCrew = true;
    },
  });
  roomChanged();
}

function tickCount(dt) {
  const count = g.count;
  if (count.awaitCrew && arrived(['vega', 'kowalski'])) {
    count.awaitCrew = false;
    count.checking = false;
    count.held = false;
    count.clock = 450;
    count.since = 0;
    count.next = COUNT.findIndex(s => s.at <= 450);
    say(conducting() ? 'you' : 'ellis', 'Recycling to T minus seven and a half minutes.', 'warn');
    roomChanged();
  }
  if (count.held || count.poll || count.checking) return;
  const rate = count.clock > 60 ? 12 : count.clock > 10 ? 3 : 1;
  count.clock = Math.max(0, count.clock - rate * dt);
  count.since += rate * dt;
  g.clock += (rate * dt) / 60;
  while (count.next < COUNT.length && COUNT[count.next].at >= count.clock) {
    const step = COUNT[count.next++];
    const who = step.who === 'ellis' && conducting() ? 'you' : step.who;
    say(who, step.text, step.tone || '', step.quick ? 1 : 4.5);
    step.act?.();
    if (step.poll) {
      count.poll = step.poll;
      count.clock = step.at;
      if (conducting()) stationReports(count);
      roomChanged();
      return;
    }
    if (step.at === 0) {
      launch();
      return;
    }
  }
}

// ---- The flight ----
function launch() {
  const result = fly(g.round);
  g.launchDay = g.day;
  g.count = null;
  g.rocket.where = 'flying';
  g.rocket.rise = 0;
  g.room = null;
  g.speed = 1;
  g.paused = false;
  g.flight = { result, t: 0, real: 0, view: 'site', calls: [], next: 0, schedule: flightCalls(result) };
  setBeat('flight', 'Watch the flight.');
}

function flightCalls(r) {
  const k = kit().calls,
    peakAt = r.path.reduce((best, p) => (p.h > best.h ? p : best), r.path[0]).t,
    end = r.path[r.path.length - 1].t,
    calls = [];
  if (r.failure !== 'holddown') calls.push({ t: 0, who: 'vega', text: k.lift, tone: 'go' });
  if (r.failure) {
    const lines = k.fail[r.failure];
    lines.forEach((line, i) =>
      calls.push({ t: line.t, who: 'morgan', text: line.text, tone: i === lines.length - 1 ? 'bad' : line.tone || '' }),
    );
  } else {
    for (const line of k.steady) calls.push({ t: line.t, who: 'morgan', text: line.text, tone: line.tone || '' });
    calls.push({ t: r.orbit || r.deep ? end - 40 : r.burn, who: 'morgan', text: k.burnout(r.burn), tone: 'go' });
  }
  // A lunar shot leaves the range plot: the tracking stations' word on her ends it.
  // One on her way to the Moon: JPL takes her from the Cape, and the next mornings follow her out (js/lunar.js).
  if (r.deep?.phase === 'cruise') {
    calls.push({ t: end, who: 'morgan', text: k.away(r), tone: r.failure ? 'warn' : 'go' });
    return calls.sort((a, b) => a.t - b.t);
  }
  if (r.deep) {
    calls.push({ t: end, who: 'morgan', text: k.final(r), tone: r.failure ? 'bad' : 'go' });
    return calls.sort((a, b) => a.t - b.t);
  }
  // A satellite never comes down: Minitrack's call that she is in orbit ends the plot.
  if (r.orbit) {
    calls.push({ t: end, who: 'morgan', text: k.orbit(r.orbit.perigee, r.orbit.apogee), tone: 'go' });
    return calls.sort((a, b) => a.t - b.t);
  }
  // Higher than the range has ever tracked: the radar's peak against every good flight before it.
  const best = Math.max(60, rangeRecord(g.programme)),
    high = r.radar > best;
  calls.push({
    t: peakAt,
    who: 'morgan',
    text: `Radar has the peak at about ${r.radar.toFixed(0)} kilometres${high ? ". Higher than anything we've flown!" : '.'}`,
    tone: high ? 'go' : '',
  });
  calls.push({ t: end, who: 'morgan', text: `Impact about ${r.range.toFixed(0)} kilometres downrange.` });
  return calls.sort((a, b) => a.t - b.t);
}

function tickFlight(dt) {
  const f = g.flight;
  f.real += dt;
  if (f.view === 'site') {
    g.rocket.rise += dt * (40 + g.rocket.rise * 2.2);
    if (f.real > 2.2) {
      f.view = 'board';
      g.rocket.where = 'gone';
    }
  }
  const rate = 5 * g.speed,
    before = f.t;
  f.t = Math.min(f.result.path[f.result.path.length - 1].t, f.t + rate * dt);
  g.clock += (f.t - before) / 60;
  while (f.next < f.schedule.length && f.schedule[f.next].t <= f.t) {
    const call = f.schedule[f.next++];
    say(call.who, call.text, call.tone);
    f.calls.push({ who: g.people[call.who].name, text: call.text, tone: call.tone });
    note(`T+${Math.round(call.t)} s, ${g.people[call.who].name}: ${call.text}`);
  }
  if (f.next >= f.schedule.length) {
    f.endWait = (f.endWait || 0) + dt;
    if (f.endWait > 3) {
      f.view = 'done';
      g.clock += 10;
      setBeat(f.result.deep?.phase === 'cruise' ? 'lLaunched' : 'recovery');
    }
  }
}

// ---- Recovery ----
export function rideOut() {
  if (g.beat !== 'recovery' || g.truck.follow) return;
  for (const id of ['you', 'morgan', 'kowalski']) g.people[id].hidden = true;
  g.truck.follow = true;
  g.truck.dust = true;
  g.truck.target = WORLD_W - 120;
  g.truck.then = () => {
    g.truck.dust = false;
    g.clock += 60;
    g.recovery = wreckage(g.round, atSea());
    for (const line of g.recovery)
      note(`${atSea() ? 'From the telemetry and radar records' : 'At the impact point'}: ${line}`);
    g.room = 'recovery';
    roomChanged();
  };
}
export function returnFromRecovery() {
  g.room = null;
  g.truck.follow = false;
  g.truck.x = g.truck.target = PLACES.truck.x;
  g.clock += 90;
  setBeat('review');
}

// ---- The review ----
// Ellis judges by her own reading of the wreck and the traces, not by the truth, and she can be wrong. If you differ, she
// goes with her reading unless your record has earned her trust. Whatever she concludes becomes the fix, right or wrong.
const short = SHORT;
export function present(key) {
  const view = ellisReading(g.round);
  let decision, reply, tone, agree;
  if (key === 'unknown') {
    decision = null;
    agree = true;
    tone = '';
    reply =
      view === 'nominal'
        ? 'Fair enough, though it looked like a good flight to me. Write up what you saw.'
        : `Fair. My money is on ${short[view]}, but we won't build a fix on a guess. Watch for it next round.`;
  } else if (key === view) {
    decision = view;
    agree = true;
    tone = 'go';
    shiftTrust(g.record, 1);
    reply =
      view === 'nominal'
        ? 'Agreed. A good round. Write it up.'
        : 'That fits what I see too. Write it up, and we fix it for the next round.';
  } else if (g.record.trust >= TRUST.defer) {
    decision = key;
    agree = false;
    tone = 'go';
    reply = `I'd have said ${short[view]}. But you've called these right before. We'll go with yours.`;
  } else {
    decision = view;
    agree = false;
    tone = 'warn';
    shiftTrust(g.record, -1);
    reply = `I don't see it. What we found says ${short[view]} to me, and that's what goes in the report.`;
  }
  const fix = decision ? adopt(g.programme, decision) : null;
  g.review = { key, view, agree, decision, fix };
  say('ellis', reply, tone, 8);
  note(`Review: you said "${kit().explanations[key]}" Ellis: ${reply}${fix ? ` ${fix}` : ''}`);
  finishReview({
    yourCall: key,
    ellis: decision ?? view,
    ellisView: view,
    agreed: agree,
    wentWithYou: !agree && decision === key,
    fix,
  });
}

// The review as test conductor: you chair it. Kowalski reads the wreck, Morgan the range data, Brandt wants his schedule.
// Whatever you conclude becomes the fix. Nobody overrules you now; the next flights will tell you if you were right.
export function chair(key) {
  if (!conducting() || g.beat !== 'review') return;
  const fix = key === 'unknown' ? null : adopt(g.programme, key);
  const r = g.readings || {};
  g.review = { key, view: r.kowalski, agree: true, decision: key === 'unknown' ? null : key, fix, chaired: true };
  const brandt = g.slipDays
    ? `We lost ${g.slipDays === 1 ? 'a day' : `${g.slipDays} days`} of range time on this one. Fix it without losing me more.`
    : "You kept to the slot. That's what I like to see.";
  say(
    'you',
    key === 'unknown'
      ? "We don't know enough yet. No change until we do."
      : `My finding: ${SHORT[key]}.${fix ? ` ${fix}` : ''}`,
    '',
    7,
  );
  say('brandt', brandt, g.slipDays ? 'warn' : 'go', 8);
  note(
    `Review, chaired by you: Kowalski read ${SHORT[r.kowalski]}, Morgan read ${SHORT[r.morgan]}. You concluded ${SHORT[key]}.${fix ? ` ${fix}` : ''} Brandt: ${brandt}`,
  );
  finishReview({ yourCall: key, chaired: true, readings: r, slipDays: g.slipDays, agreed: true, fix });
}

// What every review ends with: the flight on the programme's books, the round in your record, and a turning point if
// this round is one.
export function finishReview(entry) {
  const f = g.round.flight,
    seen = f.failure ? null : f.radar;
  if (onBudget()) {
    if (g.slipDays)
      spend(
        g.record,
        g.day,
        g.slipDays * COSTS.slipDay,
        `${g.slipDays} day${g.slipDays > 1 ? 's' : ''} of range time lost`,
      );
    const b = budgetLine();
    entry.budget = { fy: b.fy, spent: b.spent, line: b.line };
    note(
      `Your budget line, fiscal ${b.fy}: ${dollars(b.spent)} spent of ${dollars(b.line)}.${b.spent > b.line ? ' Over the line.' : ''}`,
    );
  }
  recordFlight(g.programme, { vehicle: g.vehicle, load: g.round.propellantLoad, apogee: seen, failure: f.failure });
  // After Sputnik every day lost is reported to Washington, and it goes on your record.
  if (SEASON[g.roundIndex].pressure && g.slipDays) {
    shiftTrust(g.record, -1);
    entry.pressured = true;
    note(
      `Washington wanted this round on the day. ${g.slipDays === 1 ? 'A day' : `${g.slipDays} days`} lost goes on your record.`,
    );
  }
  addRound(g.record, {
    id: SEASON[g.roundIndex].id,
    vehicle: g.vehicle,
    name: SEASON[g.roundIndex].name,
    day: g.launchDay ?? g.day,
    flight: f.text
      ? f.text
      : f.deep
        ? f.deep.text
        : f.failure
          ? `Lost at ${f.failAt} seconds.`
          : f.orbit
            ? `In orbit: perigee about ${f.orbit.perigee.toFixed(0)} km, apogee about ${f.orbit.apogee.toFixed(0)} km.`
            : `Radar peak about ${seen.toFixed(0)} km.`,
    load: g.round.propellantLoad,
    ...entry,
  });
  g.room = null;
  const tp = SEASON[g.roundIndex].turningPoint,
    offer = tp && offerFor(tp);
  if (offer && g.record.seat !== offer.seat) {
    const again = g.record.offers.some(o => o.seat === offer.seat);
    const o = turningPoint(g.record, offer, g.day);
    o.again = again;
    const by = g.people[offer.from || 'ellis'].name.split(' ').pop();
    note(
      o.made
        ? `${by} put your name forward: ${offer.title.toLowerCase()}.`
        : `${offer.title} was on offer. ${by} did not put your name forward.`,
    );
  }
  const scene = g.crewed ? CREWED.sceneAfterReview?.() : null;
  morning(scene || (nextIndex() != null ? 'roundEnd' : 'seasonEnd'));
}
// The next round on your path, or null when your years in this build are done.
export function nextIndex(from = g.roundIndex) {
  for (let i = from + 1; i < SEASON.length; i++) if (onPath(SEASON[i], g.record.path)) return i;
  return null;
}

// Ellis's opening line for a round: what the team changed since the last one, then the job.
function briefLine() {
  const last = g.record.rounds[g.record.rounds.length - 1];
  const lead = !last
    ? ''
    : last.fix
      ? `${last.fix} `
      : last.ellis === 'nominal'
        ? 'Last round flew well. '
        : 'We never pinned down what went wrong last time, so keep your eyes open. ';
  return `${lead}${kit().brief}`;
}

// Carry on to the next round of the season: the calendar jumps to its first day and tells you what happened meanwhile.
export function nextRound() {
  const i = nextIndex();
  if (g.beat !== 'roundEnd' || i == null || pendingOffer(g.record)) return;
  jumpTo(i);
}

// The calendar jump to round i: what happened meanwhile, then the round's first morning.
function jumpTo(i) {
  const from = g.day,
    next = SEASON[i];
  const lines = [...(BETWEEN[next.id] || [])];
  // The first Bumper's WAC is built to the standard the WAC rounds left behind, and the V-2s to what the V-2 round taught.
  // Each standing fix is told once, at the first change of vehicle after it was decided.
  if (next.vehicle !== SEASON[g.roundIndex].vehicle) {
    const fresh = newFixes(g.programme);
    if (fresh.length) lines.push(`What the reviews decided goes into the build: ${fresh.join(' ')}`);
  }
  if (!next.crewed) lines.push(`The crew built ${next.name} in the hangar.`);
  // The other side, from 1966, as Houston heard of it.
  if (next.crewed && next.crewed !== 'mercury')
    lines.push(...raceNews(g.seed, Math.max(from, RACE_FROM), roundStartOf(i)));
  if (next.id === 'apollo-6') lines.push(...apolloFireLines());
  // The workshop's launch damage is the hidden layer's; when it happened, Houston saw it on launch day, and the crew
  // flies up to fix it.
  if (next.id === 'skylab-2' && skylabShield(g.seed))
    lines.push(
      'The workshop went up on the last Saturn V, and sixty-three seconds into the climb the range saw something tear away from her. On the television from orbit her micrometeoroid shield is gone and one solar wing is jammed against the hull. She is hot inside, and the crew going up tomorrow is the repair party.',
    );
  g.away = { from: dateText(from), to: dateText(roundStartOf(i)), lines };
  startRound(i);
  // A fix the round brings with it whatever the reviews said (the redesigned booster joint at STS-26) is news now.
  if (next.adopt?.length) {
    const fresh = newFixes(g.programme);
    if (fresh.length) lines.push(`Going into the build from this flight: ${fresh.join(' ')}`);
  }
  g.room = 'away';
}

// After taking an offer that switches paths (the Gemini offer from the uncrewed years): the first round on the new path
// that starts after today and was not flown. The season array runs White Sands to Apollo with Ranger last, so the jump
// is backwards in the array and forward in the calendar.
export function rejoinIndex(path, day = g.day) {
  return SEASON.findIndex(r => onPath(r, path) && r.start > day && !g.record.rounds.some(flown => flown.id === r.id));
}

// The prototype's own debrief: the hidden truth laid open, for testing whether the round felt fair.
export function debrief() {
  const r = g.round,
    f = r.flight,
    initial = r.initial,
    spots = kit().spots;
  const planned = dateText(g.roundStart + PLANNED_LAUNCH_DAY),
    flown = dateText(g.launchDay);
  const faults = Object.entries(initial.faults).map(
    ([id, kind]) => `${FAULT_AT_SPOT[kind]} at the ${spots[id].name.toLowerCase()}`,
  );
  if (initial.igniter) faults.push('A WAC igniter prone to hang-fire (on a WAC, the rough start on the stand)');
  if (initial.pump) faults.push('A worn V-2 turbopump and steam generator (the low, rough start on the stand)');
  if (initial.liner) faults.push('A sustainer chamber liner coming unbonded (the hot wall on a full-duration firing)');
  if (initial.injector)
    faults.push('A Vanguard first-stage injector prone to burn through (the rough start on the stand)');
  return {
    outcome: f.failure ? `Failed: ${FAILED_BECAUSE[f.failure]}.` : `Flew to ${f.apogee.toFixed(0)} km.`,
    dates: flown === planned ? `Flown on ${flown}, on schedule.` : `Flown on ${flown}; the plan was ${planned}.`,
    faults: faults.length ? faults : ['None. This round was sound from the start.'],
    caught: r.events,
    stillThere: causesPresent(r).map(cause => SHORT[cause]),
    review: g.review,
  };
}

// The first promotion offer: take the seat, or turn it down and keep your own. Taking one that switches paths (the
// Gemini offer from the uncrewed years) jumps the calendar to the first round on the new path.
export function answerFirstOffer(take) {
  const before = g.record.path;
  const o = answerOffer(g.record, take);
  if (!o) return;
  const stranded = nextIndex() == null;
  const line = take
    ? "Good. They'll be glad of you. Come and see me when you need a second opinion."
    : stranded
      ? "Then JPL keeps you, and the uncrewed years are yours to finish. It's been a pleasure."
      : 'Your seat here is yours as long as you want it. They may ask again.';
  if (!g.people.ellis.hidden) say('ellis', line, take ? 'go' : '', 8);
  else if (g.crewed)
    say(
      'hollis',
      o.seat === 'programme'
        ? take
          ? 'Off the console, then. Get them their hardware on time, and get it right.'
          : 'Good. I need flight directors more than I need schedulers.'
        : o.seat === 'flight'
          ? take
            ? "Good. Houston's yours on your shift, Flight. Know your rules."
            : 'Then keep your seat. Somebody has to.'
          : take
            ? "Good luck in Hangar S. I'll want straight answers from you on flight day."
            : 'Glad to keep you, Retro.',
      take ? 'go' : '',
      8,
    );
  g.people.you.role = SEATS[g.record.seat];
  note(
    take
      ? `You took the offer: ${o.title.toLowerCase()}.`
      : `You turned down the offer: ${o.title.toLowerCase()}. You stay ${/^[aeiou]/i.test(SEATS[g.record.seat]) ? 'an' : 'a'} ${SEATS[g.record.seat].toLowerCase()}.`,
  );
  if (take && o.path && o.path !== before) {
    const i = rejoinIndex(o.path);
    if (i >= 0) {
      jumpTo(i);
      return;
    }
  }
  morning(nextIndex() != null ? 'roundEnd' : 'seasonEnd');
}

// ---- Ending the day ----
export function endDay() {
  if (!g.dayDone || g.fading) return;
  g.fading = { dir: 1, then: nextMorning };
}
function nextMorning() {
  const lines = [],
    left = g.day;
  // Overnight the crew finishes what it was doing.
  let guard = 0;
  while (g.jobs.length && guard++ < 20) {
    const job = g.jobs.shift();
    job.who.forEach(id => place(id, g.people[id].target));
    if (job.minutes && !job.quiet) lines.push(`Overnight the crew finished: ${job.label.toLowerCase()}.`);
    job.then?.();
  }
  for (const p of Object.values(g.people)) {
    p.bubble = null;
    p.working = false;
  }
  if (g.truck.then) {
    g.truck.x = g.truck.target;
    const t = g.truck.then;
    g.truck.then = null;
    t();
  }
  // Jump to the next day with work for you, past any days that need nobody in your seat.
  g.day += 1;
  while (g.offDays[g.day]) {
    lines.push(`${dateText(g.day)}: ${g.offDays[g.day]} Nothing needed you on site.`);
    note(`${dateText(g.day)}: ${g.offDays[g.day]}`);
    g.day += 1;
  }
  g.clock = g.day * 1440 + START_MINUTE;
  g.away = lines.length ? { from: dateText(left), to: dateText(g.day), lines } : null;
  if (g.away) g.room = 'away';
  const next =
    {
      evening1: 'staticPrep',
      afterStatic: 'rollout',
      mBrief: 'mLaunch',
      mScrub: 'mLaunch',
      mPadNight: 'mPadSafe',
      lLaunched: 'lCruise',
      lCruised: 'lEncounter',
    }[g.beat] || null;
  if (next) morning(next);
}

// ---- The tick: movement, jobs, bubbles, the count and the flight ----
export function tick(dt) {
  g.time += dt;
  if (g.fading) {
    g.fade = Math.max(0, Math.min(1, g.fade + g.fading.dir * dt * 1.6));
    if (g.fading.dir > 0 && g.fade >= 1) {
      const then = g.fading.then;
      g.fading = { dir: -1 };
      then();
    } else if (g.fading.dir < 0 && g.fade <= 0) g.fading = null;
    return;
  }
  if (g.paused) return;
  const k = g.speed;
  // Firings, counts and flights run in real seconds; otherwise the day runs fast, and stops at evening until the day is ended.
  const realTime = g.stand && ['count', 'firing'].includes(g.stand.phase);
  if (!g.count && !(CREWED.consoleLive?.() || false) && !g.flight?.view?.match(/site|board/))
    g.clock = Math.min(g.day * 1440 + EVENING, g.clock + (realTime ? dt / 60 : MINUTES_PER_SECOND * k * dt));
  for (const p of Object.values(g.people)) {
    const d = p.target - p.x,
      step = WALK * k * dt;
    if (Math.abs(d) > 0.5) {
      p.face = Math.sign(d);
      p.x += Math.sign(d) * Math.min(Math.abs(d), step);
    }
    if (p.bubble && g.time > p.bubble.until) p.bubble = null;
  }
  if (g.rocket.where === 'carried') {
    const crew = ['kowalski', 'delgado'].map(id => g.people[id].x);
    g.rocket.x = (crew[0] + crew[1]) / 2;
  }
  const td = g.truck.target - g.truck.x;
  if (Math.abs(td) > 0.5) g.truck.x += Math.sign(td) * Math.min(Math.abs(td), TRUCK * k * dt);
  else if (g.truck.then) {
    const t = g.truck.then;
    g.truck.then = null;
    t();
  }
  for (const job of [...g.jobs]) {
    if (!arrived(job.who)) continue;
    job.left -= MINUTES_PER_SECOND * k * dt;
    if (job.left <= 0) {
      g.jobs.splice(g.jobs.indexOf(job), 1);
      job.then?.();
    }
  }
  if (g.stand) tickStand(dt);
  if (g.count) tickCount(dt);
  if (g.flight && (g.flight.view === 'site' || g.flight.view === 'board')) tickFlight(dt);
  if (g.console) CREWED.tickConsole?.(dt);
  if (g.lunar) CREWED.tickLunar?.(dt);
  if (g.rocket.where === 'flying' && g.crewed) g.rocket.rise += dt * (30 + g.rocket.rise * 1.6);
  if (g.pending && Math.abs(you().x - you().target) < 1) {
    const p = g.pending;
    g.pending = null;
    p();
  }
}

function tickStand(dt) {
  const s = g.stand;
  if (s.phase === 'ready' || s.phase === 'held' || s.phase === 'count') s.pressurised = (s.pressurised || 0) + dt * 6;
  if (s.phase === 'count') {
    s.clock -= dt;
    if (s.clock <= 0) {
      s.phase = 'firing';
      s.shown = 0;
      const r = staticFire(g.round, s.burn);
      s.trace = r.trace;
      s.steady = r.steady;
      s.wall = r.wall;
      s.loose = r.loose;
      say('ellis', 'Ignition!', 'go', 2);
      roomChanged();
    }
  } else if (s.phase === 'firing') {
    s.shown = Math.min(s.trace.length, s.shown + dt * 10);
    g.standFlame = 1;
    if (s.shown >= s.trace.length && s.loose) return breakaway();
    if (s.shown >= s.trace.length) {
      s.phase = 'read';
      g.standFlame = 0;
      say('kowalski', 'Shutdown. Stand is safe.', 'go');
      const early = s.trace.slice(0, 25).map(p => p.pc),
        late = s.trace.slice(40).map(p => p.pc);
      const spread = Math.max(...early) - Math.min(...early.slice(8)),
        avg = late.reduce((a, b) => a + b, 0) / late.length;
      const tankEnd = s.trace[s.trace.length - 1].tank;
      const wall = s.trace[s.trace.length - 1].wall,
        endPc = s.trace.slice(-12).reduce((a, p) => a + p.pc, 0) / 12;
      note(
        `${s.burn === 'long' ? 'Full-duration firing' : 'Static fire'}: chamber pressure settled near ${avg.toFixed(1)} bar; the first seconds swung by about ${spread.toFixed(1)} bar. Tank pressure ended at ${tankEnd.toFixed(1)} bar.${s.burn === 'long' ? ` At shutdown the chamber was at ${endPc.toFixed(1)} bar.` : ''}${wall != null ? ` Chamber wall temperature ended at ${wall.toFixed(0)} K.` : ''}`,
      );
      roomChanged();
    }
  } else g.standFlame = 0;
}

// A round that breaks loose on the stand: it flies, the range cuts its engine, and the round is lost (Viking 8, 1952).
function breakaway() {
  const s = g.stand;
  s.phase = 'loose';
  g.standFlame = 0;
  say('kowalski', "She's loose! She's off the stand!", 'bad', 5);
  note('The round broke loose from the stand during the full-duration firing and flew.');
  const result = flyLoose(g.round);
  g.launchDay = g.day;
  g.rocket.where = 'gone';
  g.room = null;
  g.speed = 1;
  g.paused = false;
  g.flight = { result, t: 0, real: 3, view: 'board', calls: [], next: 0, schedule: flightCalls(result) };
  setBeat('flight', 'She broke loose. Watch the range plot.');
}

// The camera follows the player, or the truck on the way out, unless the player has scrolled it themselves.
export function updateCamera(viewW, dt) {
  const focus = g.truck.follow ? g.truck.x + 45 : g.flight && g.flight.view === 'site' ? PLACES.tower.x : you().x;
  if (g.time < g.cam.freeUntil) return;
  const target = Math.max(0, Math.min(WORLD_W - viewW, focus - viewW / 2));
  g.cam.x += (target - g.cam.x) * Math.min(1, dt * 4);
}
