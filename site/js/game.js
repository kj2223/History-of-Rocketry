// THE SITE PROTOTYPE'S GAME STATE: one WAC Corporal round, from the hangar to the review. No DOM, no drawing.
// The player is one junior engineer on the site. Everyone else gets on with their own work, and the player can watch them.
// The story runs in beats; each beat says what the player is asked to do and where the others go.
import { PLACES, WORLD_W } from './draw.js';
import { newRound, SPOTS, flagSpots, apogeeEstimate, staticFire, reworkIgniter, leakCheck, tankGauge, fly, wreckage, EXPLANATIONS, hasLeak, hasWeldFault, hasIgniterFault } from './truth.js';

export const START_MINUTE = 7 * 60 + 30, PLANNED_LAUNCH_DAY = 2; // day 0 is Tuesday 9 October 1945; the plan is to fly on Thursday
export const EVENING = 19 * 60;
export const WALK = 90, TRUCK = 130, MINUTES_PER_SECOND = 4; // world units and game minutes per real second, at 1x

const PEOPLE = {
  you: { name: 'You', role: 'Junior engineer', color: '#ece4cf', x: 330 },
  ellis: { name: 'Ruth Ellis', role: 'Chief Engineer, your boss', color: '#5b6f8f', x: 210 },
  vega: { name: 'Daniel Vega', role: 'Pad lead', color: '#7b5a3a', hat: '#4d5b3a', x: 2000 },
  morgan: { name: 'Samuel Morgan', role: 'Range and tracking', color: '#3f6b5a', x: 1630 },
  kowalski: { name: 'Sgt. Kowalski', role: 'Ordnance crew', color: '#5d6a43', hat: '#3e4a2c', x: 650 },
  delgado: { name: 'Pvt. Delgado', role: 'Ordnance crew', color: '#5d6a43', hat: '#3e4a2c', x: 780 },
};

export let g;

export function newGame(seed = Math.floor(Math.random() * 1e9)) {
  const round = newRound(seed);
  round.initial = { faults: { ...round.faults }, igniter: hasIgniterFault(round) };
  round.estimate = apogeeEstimate(1);
  g = {
    round, day: 0, clock: START_MINUTE, time: 0, speed: 1, paused: false,
    cam: { x: 0, freeUntil: 0 }, people: {}, jobs: [], pending: null, marker: null, hover: null,
    rocket: { where: 'hangar', mated: false, x: 0, rise: 0 }, truck: { x: PLACES.truck.x, target: PLACES.truck.x, dust: false, follow: false },
    beat: '', objective: '', dayDone: false, notes: [], loop: [], standFlame: 0, fade: 0, fading: null,
    stand: null, count: null, flight: null, review: null, slipDays: 0, launchDay: null, room: null, roomVersion: 0,
    looked: {}, flagged: {}, decided: {},
  };
  for (const [id, p] of Object.entries(PEOPLE)) g.people[id] = { id, ...p, target: p.x, face: 1, bubble: null, working: false, hidden: false };
  setBeat('brief');
  return g;
}

// ---- Small helpers the beats use ----
export const you = () => g.people.you;
export function say(id, text, tone = '', seconds = 4.5) {
  const p = g.people[id];
  p.bubble = { text, tone, until: g.time + seconds };
  g.loop.push({ who: p.name, text, tone, at: clockText() });
  if (g.loop.length > 40) g.loop.shift();
}
export const walk = (id, x) => { g.people[id].target = x; };
export const place = (id, x) => { const p = g.people[id]; p.x = p.target = x; };
export function note(text) { g.notes.push({ at: clockText(), text }); }
const arrived = ids => ids.every(id => Math.abs(g.people[id].x - g.people[id].target) < 1);
export const roomChanged = () => { g.roomVersion++; };

// A crew job at a place: the workers walk there, then work for `minutes` of game time. then() runs when it is done.
export function addJob({ label, at, who, minutes = 0, then }) {
  who.forEach((id, i) => walk(id, at + (i - (who.length - 1) / 2) * 22));
  g.jobs.push({ label, at, who, minutes, left: minutes, then });
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dateText(day = g.day) {
  const d = new Date(1945, 9, 9 + day);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} October 1945`;
}
export function clockText(minute = g.clock) {
  const m = Math.floor(minute) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---- The beats ----
function setBeat(name, objective) {
  g.beat = name;
  g.dayDone = false;
  BEATS[name]?.();
  if (objective) g.objective = objective;
  roomChanged();
}

const BEATS = {
  brief() {
    g.objective = 'Go to the assembly hangar and look the WAC upper stage over before tomorrow\'s static fire.';
    say('ellis', 'Static fire tomorrow. Check the tank welds first, would you?', '', 7);
    note('Ellis: static fire tomorrow. Check the tank welds first.');
    g.people.kowalski.working = g.people.delgado.working = true;
  },
  board() { g.objective = 'Set the propellant load at the drawing board in the technical office.'; walk('ellis', 240); },
  evening1() { g.objective = 'Your work for today is done. Watch the crew, or end the day.'; g.dayDone = true; },
  staticPrep() {
    g.objective = 'The crew is moving the upper stage to the test stand. Go to the dugout for the static fire.';
    place('you', PLACES.office.door); place('ellis', 230);
    g.rocket.where = 'carried';
    g.people.kowalski.working = g.people.delgado.working = false;
    place('kowalski', 660); place('delgado', 720);
    addJob({ label: 'Carrying to the stand', at: PLACES.stand.x + 60, who: ['kowalski', 'delgado'], then: () => {
      g.rocket.where = 'stand';
      addJob({ label: 'Plumbing in', at: PLACES.stand.x + 60, who: ['kowalski', 'delgado'], minutes: 50, then: () => {
        say('kowalski', 'Stage is plumbed in and loaded. Clear the stand!', 'go');
        walk('kowalski', PLACES.dugout.door - 20); walk('delgado', PLACES.dugout.door + 24);
        setBeat('static');
      } });
    } });
    walk('ellis', PLACES.dugout.door + 50);
    say('ellis', 'I\'ll see you at the dugout.');
  },
  static() { g.objective = 'The stage is on the stand. Go into the dugout and run the static fire.'; g.stand = { phase: 'ready', clock: 10, trace: null, shown: 0, held: false }; },
  afterStatic() { g.objective = 'The firing is done. Watch the crew, or end the day.'; g.dayDone = true; },
  rollout() {
    g.objective = 'Rollout. The crew is mating the booster and taking the round to the tower. Go to the blockhouse when it is up.';
    place('you', PLACES.office.door); place('ellis', 250);
    g.rocket.where = 'hangar';
    place('kowalski', 650); place('delgado', 780);
    addJob({ label: 'Mating the booster', at: PLACES.hangar.x + 190, who: ['kowalski', 'delgado'], minutes: 60, then: () => {
      g.rocket.mated = true;
      g.truck.target = PLACES.hangar.x + 130;
      g.truck.then = () => {
        g.rocket.where = 'truck';
        say('kowalski', 'She\'s on the truck. Rolling out!', 'go');
        g.truck.target = PLACES.tower.x - 60; g.truck.dust = true;
        walk('kowalski', PLACES.tower.x - 40); walk('delgado', PLACES.tower.x - 70);
        g.truck.then = () => {
          g.truck.dust = false;
          addJob({ label: 'Raising into the tower', at: PLACES.tower.x + 25, who: ['kowalski', 'delgado', 'vega'], minutes: 45, then: () => {
            g.rocket.where = 'tower';
            g.truck.target = PLACES.truck.x;
            say('vega', 'Round is in the tower. Blockhouse, she\'s yours when you\'re ready.', 'go');
            setBeat('countReady');
          } });
        };
      };
    } });
    walk('ellis', PLACES.blockhouse.door - 30); walk('morgan', PLACES.blockhouse.door + 40);
  },
  countReady() { g.objective = 'The round is in the tower. Go into the blockhouse for the count.'; },
  recovery() {
    g.objective = 'Ride out with the recovery party: go to the truck.';
    walk('morgan', PLACES.truck.door + 30); walk('kowalski', PLACES.truck.door - 20);
    say('morgan', 'Truck\'s leaving for the impact area. Coming?');
  },
  review() {
    g.objective = 'Ellis wants your findings. Go to the technical office.';
    place('ellis', 230); place('morgan', 270); place('vega', 2000); place('kowalski', 650); place('delgado', 780);
    g.people.morgan.hidden = g.people.kowalski.hidden = g.people.you.hidden = false;
    place('you', PLACES.truck.door);
  },
  done() { g.objective = 'That is the end of the prototype round.'; },
};

// ---- Rooms: what each building offers right now ----
export function roomFor(id) {
  if (id === 'hangar') return g.beat === 'brief' ? 'inspect' : 'watch';
  if (id === 'office') return g.beat === 'board' ? 'board' : g.beat === 'review' ? 'review' : g.beat === 'done' ? 'debrief' : 'watch';
  if (id === 'dugout') return g.beat === 'static' ? 'static' : 'watch';
  if (id === 'blockhouse') return g.beat === 'countReady' || g.count ? 'count' : 'watch';
  if (id === 'truck') return g.beat === 'recovery' ? 'recovery' : 'watch';
  return 'watch';
}

// ---- The hangar inspection ----
export function lookAt(id) {
  if (g.looked[id] != null) return;
  g.looked[id] = g.round.cues[id];
  g.clock += 15;
  note(`${SPOTS[id].name}: ${g.round.cues[id] ? SPOTS[id].cue : SPOTS[id].sound}`);
  roomChanged();
}
export function finishInspection(flags) {
  const ids = Object.keys(flags).filter(k => flags[k]);
  g.flagged = { ...flags };
  const hours = flagSpots(g.round, ids);
  if (ids.length) {
    note(`You flagged: ${ids.map(id => SPOTS[id].name.toLowerCase()).join(', ')}.`);
    addJob({ label: 'Working your flags', at: PLACES.hangar.x + 190, who: ['kowalski', 'delgado'], minutes: hours * 60, then: () => {
      g.people.kowalski.working = g.people.delgado.working = false;
      say('kowalski', reportOnFlags(ids), '', 6);
    } });
    g.people.kowalski.working = g.people.delgado.working = true;
    say('kowalski', `Right, we'll open up ${ids.length === 1 ? 'that one' : 'those'}.`);
  } else say('kowalski', 'Clean bill of health, then. We\'ll button her up.');
  setBeat('board');
}
function reportOnFlags(ids) {
  const found = g.round.events.filter(e => e.includes('real')).length;
  return found ? `Good call. We found ${found === 1 ? 'a real one' : 'real trouble'} and fixed it.` : 'Opened it all up. Nothing wrong that we could see.';
}

// ---- The drawing board ----
export function setLoad(load) {
  g.round.propellantLoad = load;
  g.round.estimate = apogeeEstimate(load);
}
export function finishBoard() {
  note(`Propellant load set to ${Math.round(g.round.propellantLoad * 100)}%. Drawing office estimate: ${g.round.estimate.low}–${g.round.estimate.high} km.`);
  say('ellis', g.round.propellantLoad >= 0.97 ? 'Full tanks. Fair enough, let\'s see what she does.' : 'Playing it safe. Good, the range will thank you.');
  g.clock += 40;
  setBeat('evening1');
}

// ---- The static fire, run by the player from the dugout ----
export function standStart() { const s = g.stand; if (s.phase === 'ready' || s.phase === 'held') { s.phase = 'count'; roomChanged(); } }
export function standHold() { const s = g.stand; if (s.phase === 'count') { s.phase = 'held'; say('you', 'Hold, hold, hold!', 'warn'); roomChanged(); } }
export function standLeakCheck() {
  const s = g.stand;
  if (s.phase !== 'held' && s.phase !== 'ready') return;
  s.phase = 'leakcheck';
  const r = leakCheck(g.round);
  note(r.found ? `Leak check before the firing: leak found at the ${r.found.toLowerCase()} and fixed.` : 'Leak check before the firing: nothing found.');
  addJob({ label: 'Leak check', at: PLACES.stand.x + 60, who: ['kowalski', 'delgado'], minutes: r.hours * 60, then: () => {
    say('kowalski', r.found ? `Found it: the ${r.found.toLowerCase()}. Fixed.` : 'Nothing leaking that we can find.', r.found ? 'go' : '');
    walk('kowalski', PLACES.dugout.door - 20); walk('delgado', PLACES.dugout.door + 24);
    s.phase = 'ready'; s.clock = 10; roomChanged();
  } });
  roomChanged();
}
// The tank gauge the dugout shows before and during the firing, from the seconds since the stage was pressurised.
export const standTank = () => tankGauge(g.round, g.stand.pressurised || 0);

export function standDecide(choices) {
  const s = g.stand;
  g.decided = { ...choices };
  let hours = 0;
  if (choices.rework) { reworkIgniter(g.round); hours += 8; note('You asked for the igniter to be reworked.'); }
  if (choices.leak) { const r = leakCheck(g.round); hours += r.hours; note(r.found ? `Leak check after the firing: leak at the ${r.found.toLowerCase()}, fixed.` : 'Leak check after the firing: nothing found.'); }
  if (!choices.rework && !choices.leak) note('You cleared the stage for flight.');
  s.phase = 'decided';
  g.rocket.where = 'carried';
  addJob({ label: 'Back to the hangar', at: PLACES.hangar.x + 160, who: ['kowalski', 'delgado'], then: () => {
    g.rocket.where = 'hangar';
    if (hours) addJob({ label: choices.rework ? 'Reworking the igniter' : 'Leak check', at: PLACES.hangar.x + 190, who: ['kowalski', 'delgado'], minutes: hours * 60, then: () => {} });
  } });
  if (hours >= 8) { g.slipDays += 1; say('ellis', 'An igniter rework. That puts the launch back a day.', 'warn', 6); }
  else say('ellis', 'Good. Let\'s get her ready for the tower.');
  setBeat('afterStatic');
}

// ---- The count, in the blockhouse ----
const COUNT = [
  { at: 600, who: 'vega', text: 'Pad crew at the tower. Final arming under way.' },
  { at: 540, who: 'morgan', text: 'Radar has the balloon. Winds light, from the west.' },
  { at: 450, who: 'ellis', text: 'PRESS, report tank pressure.', poll: 'tank' },
  { at: 360, who: 'vega', text: 'Arming complete. Pad crew coming in.', act: () => { walk('vega', PLACES.blockhouse.door + 10); walk('kowalski', PLACES.blockhouse.door + 60); walk('delgado', PLACES.blockhouse.door + 80); } },
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
  setBeat('count', 'Take part in the count. Answer your polls from the PRESS panel, and call a hold if anything looks wrong.');
}
export const countTank = () => tankGauge(g.round, g.count.since);
export function countAnswer(go) {
  const c = g.count;
  if (!c.poll) return;
  const reading = countTank();
  c.readings.push({ at: c.clock, value: reading, go });
  note(`T-${c.clock} s: you read tank pressure ${reading.toFixed(1)} bar (normal ${NORMAL_TANK[0]}–${NORMAL_TANK[1]}) and called ${go ? 'GO' : 'HOLD'}.`);
  say('you', go ? `PRESS is go. Tank at ${reading.toFixed(1)}.` : `PRESS is no-go! Tank at ${reading.toFixed(1)}. Hold the count.`, go ? 'go' : 'bad');
  c.poll = null;
  if (!go) c.held = true;
  roomChanged();
}
export function countHold() { const c = g.count; if (c && !c.held) { c.held = true; say('you', 'Hold! Hold the count!', 'warn'); roomChanged(); } }
export function countResume() { const c = g.count; if (c && c.held && !c.poll && !c.checking) { c.held = false; say('ellis', 'Resuming the count.'); roomChanged(); } }
export function countLeakCheck() {
  const c = g.count;
  if (!c || !c.held || c.checking) return;
  c.checking = true; c.poll = null; c.leakChecks++;
  say('ellis', 'Send the pad crew out. Check every line on her.', 'warn');
  const r = leakCheck(g.round);
  addJob({ label: 'Pad leak check', at: PLACES.tower.x + 25, who: ['vega', 'kowalski'], minutes: r.hours * 60, then: () => {
    say('vega', r.found ? `Found a leak at the ${r.found.toLowerCase()}. Fixed it.` : 'Every line is tight. No leak.', r.found ? 'go' : '');
    note(r.found ? `Pad leak check during the count: leak at the ${r.found.toLowerCase()}, fixed.` : 'Pad leak check during the count: nothing found.');
    walk('vega', PLACES.blockhouse.door + 10); walk('kowalski', PLACES.blockhouse.door + 60);
    c.awaitCrew = true;
  } });
  roomChanged();
}

function tickCount(dt) {
  const c = g.count;
  if (c.awaitCrew && arrived(['vega', 'kowalski'])) {
    c.awaitCrew = false; c.checking = false; c.held = false; c.clock = 450; c.since = 0;
    c.next = COUNT.findIndex(s => s.at <= 450);
    say('ellis', 'Recycling to T minus seven and a half minutes.', 'warn');
    roomChanged();
  }
  if (c.held || c.poll || c.checking) return;
  const rate = c.clock > 60 ? 12 : c.clock > 10 ? 3 : 1;
  c.clock = Math.max(0, c.clock - rate * dt);
  c.since += rate * dt;
  g.clock += rate * dt / 60;
  while (c.next < COUNT.length && COUNT[c.next].at >= c.clock) {
    const step = COUNT[c.next++];
    say(step.who, step.text, step.tone || '', step.quick ? 1 : 4.5);
    step.act?.();
    if (step.poll) { c.poll = step.poll; c.clock = step.at; roomChanged(); return; }
    if (step.at === 0) { launch(); return; }
  }
}

// ---- The flight ----
function launch() {
  const result = fly(g.round);
  g.launchDay = g.day;
  g.count = null;
  g.rocket.where = 'flying'; g.rocket.rise = 0;
  g.room = null; g.speed = 1; g.paused = false;
  g.flight = { result, t: 0, real: 0, view: 'site', calls: [], next: 0, schedule: flightCalls(result) };
  setBeat('flight', 'Watch the flight.');
}

function flightCalls(r) {
  const peakAt = r.path.reduce((best, p) => (p.h > best.h ? p : best), r.path[0]).t, end = r.path[r.path.length - 1].t, calls = [];
  calls.push({ t: 0, who: 'vega', text: 'Liftoff! She\'s off the tower.', tone: 'go' });
  if (r.failure === 'ignition') calls.push({ t: 2, who: 'morgan', text: 'No sustainer light! She\'s going over!', tone: 'bad' });
  else {
    calls.push({ t: 1, who: 'morgan', text: 'Booster burnout. Sustainer lit.', tone: 'go' });
    if (r.failure === 'weld') calls.push({ t: 14, who: 'morgan', text: 'A flash! Pieces coming off her!', tone: 'bad' });
    else if (r.failure === 'leak') { calls.push({ t: 10, who: 'morgan', text: 'Sustainer burning. Track is good.' }); calls.push({ t: 24, who: 'morgan', text: 'Flame\'s out early! Burnout at 24 seconds.', tone: 'bad' }); }
    else { calls.push({ t: 10, who: 'morgan', text: 'Sustainer burning steady. Track is good.' }); calls.push({ t: r.burn, who: 'morgan', text: `Burnout at ${r.burn} seconds. Coasting.`, tone: 'go' }); }
  }
  calls.push({ t: peakAt, who: 'morgan', text: `Peak about ${r.apogee.toFixed(0)} kilometres${r.apogee > 60 ? '. Higher than anything we\'ve flown!' : '.'}`, tone: r.apogee > 60 ? 'go' : '' });
  calls.push({ t: end, who: 'morgan', text: `Impact about ${r.range.toFixed(0)} kilometres downrange.` });
  return calls.sort((a, b) => a.t - b.t);
}

function tickFlight(dt) {
  const f = g.flight;
  f.real += dt;
  if (f.view === 'site') {
    g.rocket.rise += dt * (40 + g.rocket.rise * 2.2);
    if (f.real > 2.2) { f.view = 'board'; g.rocket.where = 'gone'; }
  }
  const rate = 5 * g.speed, before = f.t;
  f.t = Math.min(f.result.path[f.result.path.length - 1].t, f.t + rate * dt);
  g.clock += (f.t - before) / 60;
  while (f.next < f.schedule.length && f.schedule[f.next].t <= f.t) {
    const c = f.schedule[f.next++];
    say(c.who, c.text, c.tone);
    f.calls.push({ who: g.people[c.who].name, text: c.text, tone: c.tone });
    note(`T+${Math.round(c.t)} s, ${g.people[c.who].name}: ${c.text}`);
  }
  if (f.next >= f.schedule.length) { f.endWait = (f.endWait || 0) + dt; if (f.endWait > 3) { f.view = 'done'; g.clock += 10; setBeat('recovery'); } }
}

// ---- Recovery ----
export function rideOut() {
  if (g.beat !== 'recovery' || g.truck.follow) return;
  for (const id of ['you', 'morgan', 'kowalski']) g.people[id].hidden = true;
  g.truck.follow = true; g.truck.dust = true; g.truck.target = WORLD_W - 120;
  g.truck.then = () => {
    g.truck.dust = false;
    g.clock += 60;
    g.recovery = wreckage(g.round);
    for (const line of g.recovery) note(`At the impact point: ${line}`);
    g.room = 'recovery'; roomChanged();
  };
}
export function returnFromRecovery() {
  g.room = null;
  g.truck.follow = false; g.truck.x = g.truck.target = PLACES.truck.x;
  g.clock += 90;
  setBeat('review');
}

// ---- The review ----
// Ellis judges by what the wreck and the traces show, not by the truth. She can be wrong too.
function ellisView() {
  const r = g.round.flight;
  if (r.failure) return r.failure;
  return 'nominal';
}
export function present(key) {
  const view = ellisView();
  const agree = key === view || key === 'unknown';
  g.review = { key, view, agree };
  const reply = key === 'unknown' ? 'Fair. We\'ll stand another one up on the test stand before the next round.'
    : agree ? (view === 'nominal' ? 'Agreed. A good round. Write it up.' : 'That fits what we found out there. Write it up, and we fix it on the next round.')
    : `I don't see it. What we found says something else: ${EXPLANATIONS[view].toLowerCase()}`;
  say('ellis', reply, agree ? 'go' : 'warn', 8);
  note(`Review: you said "${EXPLANATIONS[key]}" Ellis: ${reply}`);
  setBeat('done');
  g.room = 'debrief'; roomChanged();
}

// The prototype's own debrief: the hidden truth laid open, for testing whether the round felt fair.
export function debrief() {
  const r = g.round, f = r.flight, initial = r.initial;
  const planned = dateText(PLANNED_LAUNCH_DAY), flown = dateText(g.launchDay);
  const faults = Object.entries(initial.faults).map(([id, kind]) => `${kind === 'weld' ? 'A bad weld' : 'A leak'} at the ${SPOTS[id].name.toLowerCase()}`);
  if (initial.igniter) faults.push('An igniter prone to hang-fire (the rough start on the stand)');
  return {
    outcome: f.failure ? `Failed: ${{ ignition: 'the sustainer did not light properly', weld: 'a tank weld let go', leak: 'a leak starved the motor' }[f.failure]}.` : `Flew to ${f.apogee.toFixed(0)} km.`,
    dates: flown === planned ? `Flown on ${flown}, on schedule.` : `Flown on ${flown}; the plan was ${planned}.`,
    faults: faults.length ? faults : ['None. This round was sound from the start.'],
    caught: r.events,
    stillThere: [hasWeldFault(r) && 'a bad weld', hasLeak(r) && 'a leak', hasIgniterFault(r) && 'the igniter fault'].filter(Boolean),
    review: g.review,
  };
}

// ---- Ending the day ----
export function endDay() {
  if (!g.dayDone || g.fading) return;
  g.fading = { dir: 1, then: nextMorning };
}
function nextMorning() {
  // Overnight the crew finishes what it was doing.
  let guard = 0;
  while (g.jobs.length && guard++ < 20) {
    const job = g.jobs.shift();
    job.who.forEach(id => place(id, g.people[id].target));
    job.then?.();
  }
  for (const p of Object.values(g.people)) { p.bubble = null; p.working = false; }
  if (g.truck.then) { g.truck.x = g.truck.target; const t = g.truck.then; g.truck.then = null; t(); }
  g.day += 1 + (g.beat === 'afterStatic' ? g.slipDays : 0);
  g.clock = g.day * 1440 + START_MINUTE;
  if (g.beat === 'evening1') setBeat('staticPrep');
  else if (g.beat === 'afterStatic') {
    if (g.slipDays) note(`The igniter rework took the whole of ${dateText(g.day - 1)}.`);
    setBeat('rollout');
  }
}

// ---- The tick: movement, jobs, bubbles, the count and the flight ----
export function tick(dt) {
  g.time += dt;
  if (g.fading) {
    g.fade = Math.max(0, Math.min(1, g.fade + g.fading.dir * dt * 1.6));
    if (g.fading.dir > 0 && g.fade >= 1) { const then = g.fading.then; g.fading = { dir: -1 }; then(); }
    else if (g.fading.dir < 0 && g.fade <= 0) g.fading = null;
    return;
  }
  if (g.paused) return;
  const k = g.speed;
  // Firings, counts and flights run in real seconds; otherwise the day runs fast, and stops at evening until the day is ended.
  const realTime = g.stand && ['count', 'firing'].includes(g.stand.phase);
  if (!g.count && !g.flight?.view?.match(/site|board/)) g.clock = Math.min(g.day * 1440 + EVENING, g.clock + (realTime ? dt / 60 : MINUTES_PER_SECOND * k * dt));
  for (const p of Object.values(g.people)) {
    const d = p.target - p.x, step = WALK * k * dt;
    if (Math.abs(d) > 0.5) { p.face = Math.sign(d); p.x += Math.sign(d) * Math.min(Math.abs(d), step); }
    if (p.bubble && g.time > p.bubble.until) p.bubble = null;
  }
  if (g.rocket.where === 'carried') { const c = ['kowalski', 'delgado'].map(id => g.people[id].x); g.rocket.x = (c[0] + c[1]) / 2; }
  const td = g.truck.target - g.truck.x;
  if (Math.abs(td) > 0.5) g.truck.x += Math.sign(td) * Math.min(Math.abs(td), TRUCK * k * dt);
  else if (g.truck.then) { const t = g.truck.then; g.truck.then = null; t(); }
  for (const job of [...g.jobs]) {
    if (!arrived(job.who)) continue;
    job.left -= MINUTES_PER_SECOND * k * dt;
    if (job.left <= 0) { g.jobs.splice(g.jobs.indexOf(job), 1); job.then?.(); }
  }
  if (g.stand) tickStand(dt);
  if (g.count) tickCount(dt);
  if (g.flight && (g.flight.view === 'site' || g.flight.view === 'board')) tickFlight(dt);
  if (g.pending && Math.abs(you().x - you().target) < 1) { const p = g.pending; g.pending = null; p(); }
}

function tickStand(dt) {
  const s = g.stand;
  if (s.phase === 'ready' || s.phase === 'held' || s.phase === 'count') s.pressurised = (s.pressurised || 0) + dt * 6;
  if (s.phase === 'count') {
    s.clock -= dt;
    if (s.clock <= 0) {
      s.phase = 'firing'; s.shown = 0;
      const r = staticFire(g.round);
      s.trace = r.trace; s.steady = r.steady;
      say('ellis', 'Ignition!', 'go', 2);
      roomChanged();
    }
  } else if (s.phase === 'firing') {
    s.shown = Math.min(s.trace.length, s.shown + dt * 10);
    g.standFlame = 1;
    if (s.shown >= s.trace.length) {
      s.phase = 'read'; g.standFlame = 0;
      say('kowalski', 'Shutdown. Stand is safe.', 'go');
      const early = s.trace.slice(0, 25).map(p => p.pc), late = s.trace.slice(40).map(p => p.pc);
      const spread = Math.max(...early) - Math.min(...early.slice(8)), avg = late.reduce((a, b) => a + b, 0) / late.length;
      const tankEnd = s.trace[s.trace.length - 1].tank;
      note(`Static fire: chamber pressure settled near ${avg.toFixed(1)} bar; the first seconds swung by about ${spread.toFixed(1)} bar. Tank pressure ended at ${tankEnd.toFixed(1)} bar.`);
      roomChanged();
    }
  } else g.standFlame = 0;
}

// The camera follows the player, or the truck on the way out, unless the player has scrolled it themselves.
export function updateCamera(viewW, dt) {
  const focus = g.truck.follow ? g.truck.x + 45 : g.flight && g.flight.view === 'site' ? PLACES.tower.x : you().x;
  if (g.time < g.cam.freeUntil) return;
  const target = Math.max(0, Math.min(WORLD_W - viewW, focus - viewW / 2));
  g.cam.x += (target - g.cam.x) * Math.min(1, dt * 4);
}
