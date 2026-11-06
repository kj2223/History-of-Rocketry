// THE HIDDEN TRUTH OF A LONG FLIGHT: what is really wrong with a Gemini or Apollo spacecraft, what each of the flight
// director's answers really leads to, and where she really comes down. No DOM, no drawing. The rooms never import this.
//
// The spacecraft's troubles are the round's hidden faults (truth/round.js puts them at their spots), plus a few with no
// spot: a wrong number from the ground's computers. Everything is decided from draws taken once, when the flight reaches
// orbit, so a look in the checkout room or a sim never shifts it.
import { draw, normal } from '../core/rng.js';
import { flyEntry, flyLunarEntry, GEMINI_ENTRY, LUNAR_ENTRY } from './entry.js';
import { ORBIT_RECOVERY } from './orbit.js';

const DEG = Math.PI / 180;
// A fixed number of physical draws for every long flight.
export const FLIGHT_DRAWS = 16;
// How often each trouble comes out as it really did: the fuel cells settling, a hatch that will not seal, a stuck
// computer coming back.
export const ODDS = { fuelcellRecovers: 0.75, hatchJams: 0.3, hatchFreedByRest: 0.85, computerBack: 0.2, batteriesShort: 0.3 };
// The navigation error Gemini 5 really had: the ground sent a wrong number for the Earth's rotation, and she came down
// about 80 miles short.
export const NAV_ERROR_KM = -129;

// Decided once, as she reaches orbit. The flags are the spacecraft's real troubles; d are the draws the answers use.
export function flightTruth(round, id) {
  const ph = round.rng.physical, d = [...Array(FLIGHT_DRAWS)].map(() => draw(ph));
  const kinds = new Set(Object.values(round.faults || {}));
  const t = { id, d, flags: {} };
  for (const k of ['fuelcell', 'hatch', 'computer', 'thruster', 'tank', 'alarm', 'ascent', 'lightning', 'pogo', 'rover']) t.flags[k] = kinds.has(k);
  t.flags.navdata = !!round.navdata;
  t.fuelcellRecovers = d[0] < ODDS.fuelcellRecovers;
  return (round.flightTruth = t);
}
export const flag = (round, name) => !!round.flightTruth?.flags[name];

// What an answer really leads to. state is the flight's own record of what has happened so far (the controller keeps it).
// Returns { lines, note, verdict ('good', 'bad', 'fair'), judge (the review's line), endAt (hours: come home then),
// capability, hurt, set (state changes) }.
export function resolve(round, id, choice, state) {
  const t = round.flightTruth, f = t.flags, d = t.d;
  const out = { lines: [], verdict: 'fair', judge: '', set: {} };
  const R = RESOLVE[id];
  return R ? R(choice, { f, d, t, state, out, round }) || out : out;
}

const RESOLVE = {
  eva(choice, { f, d, out }) {
    if (choice === 'cancel') {
      out.lines.push(['crew2', 'Copy, no spacewalk. That\'s a disappointment, Houston.', 'warn']);
      out.verdict = f.hatch ? 'fair' : 'bad';
      out.judge = f.hatch ? 'The hatch was stiff, and you weren\'t going to bet a crew on it. I can\'t fault that, but Apollo wanted the spacewalk.' : 'There was nothing wrong with that hatch. We gave away the spacewalk for nothing.';
      return out;
    }
    const delayed = choice === 'delay';
    const jams = f.hatch && (delayed ? d[1] >= ODDS.hatchFreedByRest : d[1] < ODDS.hatchJams);
    if (delayed) out.lines.push(['crew2', 'An orbit\'s rest and another go at the latch. It moves easier now.', 'go']);
    out.lines.push(['crew2', 'Hatch is open. I\'m going out. This is the greatest thing I have ever done!', 'go']);
    out.lines.push(['kessler', 'Flight, EECOM: cabin is at zero. Suit pressure good.', '']);
    out.capability = 'eva';
    if (jams) {
      out.lines.push(['pilot', 'Houston, the hatch will not latch. We\'re working it… we have it closed, but it took everything we had.', 'bad']);
      out.hurt = 0.2;
      out.verdict = 'bad';
      out.judge = 'That hatch was bad and we opened it anyway. It nearly didn\'t close, and you don\'t come home with a hatch open.';
      out.note = 'After the spacewalk the hatch would not latch. The crew forced it closed after a long fight, both of them exhausted.';
    } else {
      out.verdict = 'good';
      out.judge = f.hatch && delayed ? 'You gave the hatch an orbit and a second go. It closed clean. That\'s how it\'s done.' : 'A clean spacewalk. Apollo can put that in its plans.';
      out.note = f.hatch ? 'The hatch was stiff, but it latched after the spacewalk.' : 'The hatch latched cleanly after the spacewalk.';
    }
    return out;
  },
  computer(choice, { d, out }) {
    if (choice === 'retry' && d[2] < ODDS.computerBack) {
      out.lines.push(['kessler', 'Flight, EECOM: she\'s back! The computer came up on the restart.', 'go']);
      out.set.computer = 'up'; out.verdict = 'fair'; out.judge = 'You let them work the computer, and it came back. Lucky, too.';
      return out;
    }
    if (choice === 'retry') out.lines.push(['kessler', 'Flight, EECOM: no joy. She\'s dead. We\'ve spent an orbit on it.', 'warn']);
    out.lines.push(['dorsey', 'Rolling entry, then. Retro, plan it Mercury style.', 'warn']);
    out.set.computer = 'down';
    out.verdict = choice === 'ballistic' ? 'good' : 'fair';
    out.judge = choice === 'ballistic' ? 'The computer was dead. A rolling entry was the right call.' : 'The computer was never coming back. An orbit spent finding that out.';
    return out;
  },
  fuelcell1(choice, { t, d, out }) {
    if (choice === 'home') {
      out.lines.push(['dorsey', 'Plan for the next good area. Recovery, tell the ships.', 'warn']);
      out.endAt = 7; out.set.short = true;
      out.verdict = 'fair';
      out.judge = t.fuelcellRecovers ? 'Kessler\'s people say the pressure would have settled. We came home on the rule, and Apollo still doesn\'t know if a crew lasts eight days.' : 'The cells were going. Coming home on the rule was right.';
      if (!t.fuelcellRecovers) out.verdict = 'good';
      return out;
    }
    out.lines.push(['kessler', 'Powering down to the minimum. We\'ll watch it through the night.', '']);
    if (!t.fuelcellRecovers) {
      out.lines.push(['kessler', 'Flight, EECOM: the pressure kept falling. The cells are going. We are on batteries.', 'bad']);
      out.endAt = 22; out.set.short = true; out.set.batteries = true;
      out.hurt = d[3] < ODDS.batteriesShort ? 0.15 : 0;
      out.verdict = 'bad';
      out.judge = 'The cells were going and we let her drift on them until they died. She came home on batteries.';
      out.note = 'Overnight the fuel cells failed. The spacecraft came home early on its batteries.';
    } else { out.note = 'Overnight the fuel-cell pressure fell to about 12 psi and held there.'; out.judge = 'The pressure settled, and drifting kept the flight. It was against the rule, and it came off.'; }
    return out;
  },
  fuelcell2(choice, { out }) {
    if (choice === 'home') {
      out.lines.push(['dorsey', 'Home at the next good area, then.', '']);
      out.endAt = 30; out.set.short = true; out.verdict = 'fair';
      out.judge = 'The cells were holding. Eight days was there for the taking.';
      return out;
    }
    out.lines.push(['pilot', 'Eight days. We\'ll drift and keep warm, Houston.', 'go']);
    out.verdict = 'good'; out.judge = 'Eight days on a sick spacecraft, and the cells held. Apollo needed that.';
    return out;
  },
  rdvplan(choice, { f, d, out }) {
    const bad = choice === 'onboard' && f.computer;
    if (bad) {
      out.lines.push(['pilot', 'Houston, the computer reset in the middle of the burn. We\'re high and fast. We\'ll fly it on the charts.', 'bad']);
      if (d[10] < 0.5) {
        out.lines.push(['kessler', 'Flight, they\'re short of fuel to close. They\'ve stopped at twelve miles. No rendezvous.', 'bad']);
        out.verdict = 'bad'; out.judge = 'The computer had been resetting all morning, and we flew the rendezvous on it. We never caught Gemini 7.';
        return out;
      }
      out.lines.push(['pilot', 'Closing on the charts… a hundred and twenty feet and stopped. We\'re there.', 'go']);
      out.capability = 'rendezvous'; out.verdict = 'fair'; out.judge = 'The computer failed in the burn and the crew got there on their charts. We shouldn\'t have needed them to.';
      return out;
    }
    out.lines.push(['pilot', choice === 'onboard' ? 'Radar and computer agree. Braking. A hundred and twenty feet, and stopped.' : 'Flying the ground\'s numbers. Braking… a hundred and twenty feet, and stopped.', 'go']);
    out.capability = 'rendezvous';
    out.verdict = choice === 'onboard' || f.computer ? 'good' : 'fair';
    out.judge = choice === 'ground' && !f.computer ? 'We got there on the ground\'s numbers. The spacecraft could have done it cheaper, and Apollo needs to know it can.' : 'Rendezvous. Apollo can put that in its plans.';
    return out;
  },
  tumble(choice, { d, out }) {
    out.set.short = true;
    if (choice === 'secondary') {
      out.endAt = 10.5; out.set.secondary = true;
      out.lines.push(['tate', 'Flight, Retro: retrofire over Africa, splashdown in the western Pacific, area 7-3. The destroyer Mason is on her way.', 'go']);
      out.verdict = 'good'; out.judge = 'The re-entry thrusters were spent. You followed the rule and brought them home alive.';
      return out;
    }
    out.endAt = 34;
    out.lines.push(['kessler', 'Flight, EECOM: re-entry thruster fuel is low. If we hold a day, she has what\'s left for entry, maybe.', 'warn']);
    if (d[11] < 0.4) { out.hurt = 0.6; out.verdict = 'bad'; out.judge = 'The re-entry thrusters had too little left after a day. She swung through the entry. That rule is there for a reason.'; out.note = 'By entry the re-entry thrusters were nearly dry. The spacecraft swung through the entry.'; }
    else { out.verdict = 'bad'; out.judge = 'You held them up a day against the rule with the re-entry thrusters half spent. It came off. Don\'t do it again.'; }
    return out;
  },
  evaplan(choice, { d, out }) {
    if (choice === 'standup') {
      out.lines.push(['crew2', 'Standing in the hatch. Photographs, and a look round. Copy, no tasks.', '']);
      out.verdict = 'fair'; out.judge = 'Safe, and it taught Apollo nothing it didn\'t know. Gemini 12 was the last chance to show the work could be done.';
      return out;
    }
    if (choice === 'full') {
      if (d[12] < 0.6) {
        out.lines.push(['crew2', 'Houston, my visor\'s fogging. I can\'t see the handholds. I need to rest.', 'bad']);
        out.lines.push(['kessler', 'Flight, Surgeon says heart rate one-seventy and climbing. Bring him in.', 'bad']);
        out.verdict = 'bad'; out.judge = 'The full list wore him out the way it wore out Gemini 9A. We knew that, and we flew it anyway.';
        out.note = 'The spacewalker overheated and his visor fogged. The spacewalk was cut short with most tasks undone.';
        out.hurt = 0.05;
        return out;
      }
      out.lines.push(['crew2', 'Last task done. Tired, Houston, but done.', 'go']);
      out.capability = 'evawork'; out.verdict = 'fair'; out.judge = 'He got through the whole list. Lucky: Gemini 9A\'s man didn\'t.';
      return out;
    }
    out.lines.push(['crew2', 'Foot restraints on. Torque wrench… done. Resting. Next task.', 'go']);
    out.lines.push(['kessler', 'Flight, Surgeon: heart rate steady, under a hundred and twenty.', 'go']);
    out.capability = 'evawork'; out.verdict = 'good'; out.judge = 'Two hours outside and he came back fresh. That\'s what Apollo needed to see.';
    return out;
  },
  navcheck(choice, { f, out }) {
    if (choice === 'check') {
      out.set.secondary = true;
      out.lines.push(['tate', f.navdata ? 'Flight, Retro: the back room found it. The rotation constant in the numbers was wrong. Corrected, and we fire one orbit late.' : 'Flight, Retro: the numbers check. We fire one orbit late, into the secondary area.', f.navdata ? 'warn' : '']);
      if (f.navdata) { out.set.navFixed = true; out.verdict = 'good'; out.judge = 'The back room\'s check caught a wrong constant in the numbers. She\'d have come down well short.'; }
      else { out.verdict = 'fair'; out.judge = 'The numbers were good. The check cost a revolution and a longer wait for the ship.'; }
      return out;
    }
    out.lines.push(['tate', 'Numbers are in the computer. Retrofire on time.', 'go']);
    out.verdict = f.navdata ? 'bad' : 'fair';
    out.judge = f.navdata ? 'The number for the Earth\'s rotation we sent up was wrong. Nobody checked it.' : '';
    return out;
  },
};

// Retrofire and entry for Gemini. state.computer 'down' flies a rolling entry with no lift. Sets round.end.
export function geminiEntry(round, state) {
  const t = round.flightTruth, d = t.d;
  const ballistic = state.computer === 'down';
  const v = ballistic ? { ...GEMINI_ENTRY, ld: 0, nominalBank: 0 } : GEMINI_ENTRY;
  const retro = { dvScale: 0.01 * (d[4] - 0.5), yawError: (ballistic ? 6 : 1.5) * (d[5] - 0.5) * DEG, pitchError: (ballistic ? 3 : 1) * (d[6] - 0.5) * DEG, late: ballistic ? 3 * d[7] : 0.3 };
  const nav = t.flags.navdata && !state.navFixed ? NAV_ERROR_KM * 1000 : 0;
  const e = flyEntry(v, retro, nav);
  const capsule = state.hurt && d[8] < state.hurt ? 'damaged' : 'safe';
  round.end = { ...(round.end || {}), outcome: 'entry', miss: e.miss / 1000, entryG: e.peakG, heat: e.heatLoad, blackout: e.blackout, capsule, ballistic, secondary: !!state.secondary, nav: nav / 1000 };
  return round.end;
}

// Coming home from the Moon: the corridor the midcourse burns left her in (state.gammaError, degrees). Sets round.end.
export function lunarEntry(round, state) {
  const t = round.flightTruth, d = t.d;
  const e = flyLunarEntry(LUNAR_ENTRY, state.gammaError || 0, 30e3 * (d[9] - 0.5));
  let capsule = 'safe';
  if (e.skip || e.peakG > 18) capsule = 'lost';
  else if (e.peakG > 13 || (state.hurt && d[8] < state.hurt)) capsule = 'damaged';
  round.end = { ...(round.end || {}), outcome: 'entry', miss: e.skip ? 0 : e.miss / 1000, entryG: e.peakG, heat: e.heatLoad, blackout: e.blackout, capsule, skip: !!e.skip, lunar: true };
  return round.end;
}

// After the blackout: where the spacecraft's computer thinks she is, and the tracking radar's fix. Two observation draws.
export function flightPredictions(round) {
  const ob = round.rng.observation, e = round.end, n1 = normal(ob), n2 = normal(ob);
  // The computer steered for the point the ground gave it: if that point was wrong, so is the computer's idea of where she is.
  const believed = e.miss - (e.nav || 0);
  return (round.ip = { planned: 0, retro: (e.ballistic ? e.miss + 60 * n1 : believed + 8 * n1), radar: e.miss + 12 * n2 });
}

// Hours from splashdown until the crew is on the ship. The secondary area has one destroyer and no carrier.
export function flightRecoveryHours(end, aim, cond, trained, waited, orbitHours) {
  const R = ORBIT_RECOVERY, prep = trained ? R.ready : R.slow;
  if (end.secondary) return prep + 1.2 + Math.abs(end.miss) / R.downrange.ship + (cond.seaState > 4 ? R.crane : 0);
  return orbitHours(end, aim, cond, trained, waited);
}
