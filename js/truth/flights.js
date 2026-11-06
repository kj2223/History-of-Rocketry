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
export const ODDS = { fuelcellRecovers: 0.75, hatchJams: 0.3, hatchFreedByRest: 0.85, computerBack: 0.2, batteriesShort: 0.3,
  // Apollo: lightning that killed the parachute pyros, a burning smell that becomes a fire, a computer that gives up under
  // the alarms, a landing with the fuel gone.
  pyrosDead: 0.15, cabinFire: 0.3, computerQuits: 0.1, hardLanding: 0.06 };
// The navigation error Gemini 5 really had: the ground sent a wrong number for the Earth's rotation, and she came down
// about 80 miles short.
export const NAV_ERROR_KM = -129;

// Decided once, as she reaches orbit. The flags are the spacecraft's real troubles; d are the draws the answers use.
export function flightTruth(round, id) {
  const ph = round.rng.physical, d = [...Array(FLIGHT_DRAWS)].map(() => draw(ph));
  const kinds = new Set(Object.values(round.faults || {}));
  const t = { id, d, flags: {} };
  for (const k of ['fuelcell', 'hatch', 'computer', 'thruster', 'pogo', 'j2', 'relight', 'sps', 'tank', 'cabin', 'alarm', 'ascent', 'chute']) t.flags[k] = kinds.has(k);
  t.flags.navdata = !!round.navdata;
  t.flags.lightning = !!round.lightning;
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
  sps6(choice, { f, d, out }) {
    if (choice === 'stay') {
      out.set.short = true; out.set.earthEntry = true;
      out.lines.push(['dorsey', 'Bring her home from orbit. We\'ll get the entry test another time.', '']);
      out.verdict = 'fair'; out.judge = 'No high-speed entry test. The heat shield goes to the Moon on the first flight\'s evidence alone.';
      return out;
    }
    if (f.sps && d[13] < 0.5) {
      out.set.short = true; out.set.earthEntry = true;
      out.lines.push(['kessler', 'Flight, EECOM: the service engine shut down early. Chamber pressure fell away. She\'s not going high.', 'bad']);
      out.verdict = 'fair'; out.judge = 'The service engine failed on the long burn. Better here than behind the Moon.';
      return out;
    }
    out.lines.push(['kessler', 'Flight, EECOM: a long burn on the service engine, and she\'s climbing. She\'ll come in fast.', 'go']);
    out.verdict = 'good'; out.judge = 'The service engine did a job it was never meant for, and we got the entry test.';
    return out;
  },
  pogo(choice, { f, out }) {
    const shown = ['pogo', 'j2', 'relight'].filter(k => f[k]);
    if (choice === 'third') {
      out.slip = 60;
      out.lines.push(['hollis', 'A third empty Saturn. That\'s two months, and the Russians are not waiting.', 'warn']);
      out.verdict = 'fair'; out.judge = shown.length ? 'Caution after a rough flight. It cost us two months.' : 'She flew clean and we flew another empty one. Two months gone for nothing.';
      return out;
    }
    out.lines.push(['hollis', shown.length ? 'Then Marshall fixes every one of those before a crew sits on top of her.' : 'She flew clean. A crew rides the next one.', 'go']);
    out.verdict = 'good'; out.judge = shown.length ? 'We understood every failure and fixed it. Putting a crew on the next one was the right call.' : 'A clean flight, and a crew on the next one. Right.';
    out.fixes = shown;
    return out;
  },
  tli(choice, { f, d, out }) {
    if (choice === 'nogo') {
      out.set.earthOnly = true; out.set.short = true; out.set.earthEntry = true; out.endAt = 10;
      out.lines.push(['dorsey', 'No-go for TLI. We fly her in Earth orbit and bring her home.', 'warn']);
      out.verdict = f.relight ? 'fair' : 'bad';
      out.judge = f.relight ? 'The restart bottle was leaking. She might not have lit. Staying home was defensible.' : 'The third stage was good. We gave away the Moon for nothing.';
      return out;
    }
    if (f.relight && d[13] < 0.6) {
      out.set.earthOnly = true; out.set.short = true; out.set.earthEntry = true; out.endAt = 10;
      out.lines.push(['albrecht', 'Flight, Booster: no ignition on the S-IVB. She\'s staying in Earth orbit.', 'bad']);
      out.verdict = 'fair'; out.judge = 'The third stage would not relight. We tried, and nobody was hurt by trying.';
      return out;
    }
    out.lines.push(['albrecht', 'Flight, Booster: good burn. Cutoff. She\'s on her way to the Moon.', 'go']);
    out.lines.push(['pilot', 'Roger, Houston. You\'re go for the Moon. We\'re on our way.', 'go']);
    out.verdict = 'good'; out.judge = f.relight ? 'The third stage relit on a low bottle. It worked, and it was close.' : 'A clean injection.';
    return out;
  },
  loi(choice, { f, d, out }) {
    if (choice === 'nogo') {
      out.set.home = true; out.set.short = true;
      out.lines.push(['pilot', 'Copy, no LOI. We\'ll swing round and see you on the other side.', 'warn']);
      out.verdict = f.sps ? 'good' : 'bad';
      out.judge = f.sps ? 'The service engine had a bad valve. You kept them on the free return. That rule saved their lives.' : 'The service engine was sound. We came all that way and didn\'t stop.';
      return out;
    }
    if (f.sps && d[14] < 0.5) {
      out.set.stranded = true;
      out.lines.push(['morgan', 'Flight, Network: acquisition of signal. She\'s in lunar orbit.', 'go']);
      out.verdict = 'bad'; out.judge = 'The service engine had failed its check and we put them in lunar orbit on it. It burned once. It never burned again.';
      return out;
    }
    out.lines.push(['morgan', 'Flight, Network: acquisition of signal, right on time. She\'s in lunar orbit.', 'go']);
    out.capability = null;
    out.verdict = f.sps ? 'fair' : 'good';
    out.judge = f.sps ? 'The service engine had come up short on its check and we went anyway. It held. Don\'t count on that twice.' : 'A good insertion behind the Moon.';
    return out;
  },
  mcc(choice, { t, out }) {
    const err = entryAngleError(t);
    out.set.gammaError = choice === 'burn' ? 0.15 * err : err;
    out.lines.push(choice === 'burn' ? ['tate', 'Flight, Retro: midcourse seven is done. She\'s in the middle of the corridor.', 'go'] : ['tate', 'Flight, Retro: no burn. She comes in where she\'s pointed.', '']);
    const outside = err > 0.65 || err < -0.95;
    out.verdict = choice === 'burn' ? 'good' : outside ? 'bad' : 'fair';
    out.judge = choice === 'skip' && outside ? 'The entry angle was outside the corridor and we left it there.' : choice === 'skip' ? 'We left the entry angle where it was. It was inside the corridor, just.' : 'A trim burn into the middle of the corridor.';
    return out;
  },
  tank(choice, { d, out }) {
    out.set.home = true; out.set.short = true; out.endAt = 140;
    if (choice === 'direct') {
      if (d[15] < 0.5) {
        out.set.lost = true;
        out.lines.push(['kessler', 'Flight… the service engine didn\'t light. The tank took out its feed. We have no burn.', 'bad']);
        out.verdict = 'bad'; out.judge = 'Nobody knew what the explosion had done to the service engine, and we bet three lives on it.';
        return out;
      }
      out.lines.push(['kessler', 'Flight, the service engine burned. They\'re turned round and coming home.', 'warn']);
      out.endAt = 80; out.hurt = 0.2;
      out.verdict = 'fair'; out.judge = 'The direct abort worked. Nobody knew whether the service engine would, and we bet on it.';
      return out;
    }
    out.lines.push(['pilot', 'Powering down the command module. We\'re moving into the lander. It\'s going to be cold.', 'warn']);
    out.lines.push(['kessler', 'Flight, the lander\'s carbon dioxide filters won\'t last three men four days. We\'ll need to make the command module\'s fit.', 'warn']);
    out.hurt = 0.15;
    out.verdict = 'good'; out.judge = 'The lander was the lifeboat. You brought them round the Moon and home on it.';
    out.note = 'The crew lived in the lander for four days on the way home, cold and short of water, with a carbon dioxide filter built from the command module\'s, tape and a plastic bag.';
    return out;
  },
  lowpass(choice, { f, d, out }) {
    if (choice === 'skip') { out.lines.push(['dorsey', 'No low pass. Keep the lander docked.', '']); out.verdict = f.alarm ? 'fair' : 'bad'; out.judge = f.alarm ? 'The computer was restarting and you kept the lander docked. Cautious, and the next crew lands without the rehearsal.' : 'There was nothing wrong with that lander. We came home without the rehearsal.'; out.set.short = true; return out; }
    if (f.alarm && d[12] < 0.4) {
      out.lines.push(['crew2', 'She\'s going all over the place! The computer\'s restarted. I\'ve got her, I\'ve got her.', 'bad']);
      out.hurt = 0.05; out.verdict = 'fair'; out.judge = 'The computer restarted at fifteen kilometres. The crew flew her out of it. The rule said no.';
      return out;
    }
    out.lines.push(['crew2', 'Fifteen kilometres. We\'re right over the landing site. It\'s smoother than it looks from up there.', 'go']);
    out.verdict = 'good'; out.judge = 'The full rehearsal, down to fifteen kilometres.';
    return out;
  },
  lightning(choice, { d, out }) {
    const pyros = d[7] < ODDS.pyrosDead;
    if (choice === 'stay') {
      out.set.earthOnly = true; out.set.short = true; out.set.earthEntry = true; out.endAt = 10;
      out.lines.push(['dorsey', 'We bring her home from Earth orbit. Recovery, the Pacific.', 'warn']);
      out.verdict = 'fair'; out.judge = pyros ? 'The pyros were damaged. She\'d have come down hard from anywhere; coming home early didn\'t change that.' : 'The pyros were fine. We gave away the Moon to a strike that had done nothing.';
      if (pyros) out.hurt = 0.3;
      return out;
    }
    out.lines.push(['dorsey', 'If the pyros are gone, they are gone whatever we do. Go on.', '']);
    if (pyros) { out.hurt = 0.3; out.verdict = 'fair'; out.judge = 'The strike had damaged the pyros, and nothing we did in orbit would have fixed them. Going on was still right.'; out.note = 'The lightning had damaged a parachute pyrotechnic circuit. Nobody could know it until the parachutes came out.'; }
    else { out.verdict = 'good'; out.judge = 'A strike that did no lasting harm, and you didn\'t let it cost the flight.'; }
    return out;
  },
  smoke(choice, { d, out }) {
    if (choice === 'home') {
      out.set.earthOnly = true; out.set.short = true; out.set.earthEntry = true; out.endAt = 6;
      out.lines.push(['dorsey', 'Home at the next good area. Recovery, tell the ships.', 'warn']);
      out.verdict = 'good'; out.judge = 'A burning smell in an oxygen cabin, after what Apollo 1 nearly did on the pad. Home was right.';
      out.note = 'On the ground the wiring under the couches was found chafed through, scorched along a hand\'s length.';
      return out;
    }
    if (d[3] < ODDS.cabinFire) {
      out.set.fire = true; out.set.earthOnly = true; out.set.short = true; out.endAt = 2;
      out.lines.push(['pilot', 'Fire! We\'ve got a fire in the cabin!', 'bad']);
      out.lines.push(['kessler', 'Flight… we\'ve lost their telemetry.', 'bad']);
      out.verdict = 'bad'; out.judge = 'There was a short in an oxygen cabin, and we pressed on with it.';
      out.note = 'The chafed wiring under the couches arced again in the oxygen. The fire took the cabin in seconds.';
      return out;
    }
    out.lines.push(['pilot', 'Bus is off. The smell\'s fading.', '']);
    out.verdict = 'fair'; out.judge = 'We pressed on with a burning smell in an oxygen cabin. It was the bus, and taking it off line held. It might not have.';
    return out;
  },
  alarm(choice, { d, out }) {
    if (choice === 'abort') {
      out.set.noLanding = true; out.set.short = true;
      out.lines.push(['pilot', 'Abort stage. We\'re climbing.', 'warn']);
      out.verdict = 'bad'; out.judge = 'The alarms were the computer throwing away work it didn\'t need. It was still flying her. It would have landed them.';
      return out;
    }
    out.lines.push(['kessler', 'Flight, Guidance says: we\'re go on that alarm. The computer\'s dropping the radar\'s work and keeping the landing.', 'go']);
    if (d[4] < ODDS.computerQuits) {
      out.set.noLanding = true; out.set.short = true;
      out.lines.push(['pilot', 'She\'s restarting again and again. We\'ve lost the display. Abort stage!', 'bad']);
      out.verdict = 'fair'; out.judge = 'Go on the alarms was right by every test we had. This time the computer gave up anyway, and the crew aborted clean.';
      return out;
    }
    out.verdict = 'good'; out.judge = 'Go on the program alarms. The computer kept flying the landing, the way Guidance said it would.';
    return out;
  },
  lowfuel(choice, { d, out }) {
    if (choice === 'abort') {
      out.set.noLanding = true; out.set.short = true;
      out.lines.push(['pilot', 'Abort. We had it, Houston. We had a place.', 'warn']);
      out.verdict = 'bad'; out.judge = 'He had a place picked out with thirty seconds to spare. We called it off a hundred feet up.';
      return out;
    }
    out.set.landed = true;
    out.lines.push(['kessler', 'Sixty seconds.', 'warn']);
    out.lines.push(['kessler', 'Thirty seconds.', 'bad']);
    if (d[5] < ODDS.hardLanding) {
      out.hurt = 0.25;
      out.lines.push(['pilot', 'Contact… we dropped the last ten feet. A leg\'s bent. We\'re down, and level enough.', 'warn']);
      out.verdict = 'fair'; out.judge = 'The fuel ran out ten feet up. They walked away from it. The rule was there for that.';
      out.note = 'The descent engine ran dry ten feet up and the lander fell the rest. One landing leg was bent.';
      return out;
    }
    out.lines.push(['pilot', 'Contact light. Engine stop. Houston, we\'re down.', 'go']);
    out.verdict = 'good'; out.judge = 'You let him fly it out, and he landed with seconds left. That was the call.';
    return out;
  },
  landpoint(choice, { d, out }) {
    out.set.landed = true;
    if (choice === 'update') {
      out.capability = 'pinpoint';
      out.lines.push(['pilot', 'Houston, we\'re down. And there\'s the Surveyor, right on the edge of the crater. You put us right on it.', 'go']);
      out.verdict = 'good'; out.judge = 'A correction from the ground into the lander\'s computer, and they landed next to the Surveyor.';
      return out;
    }
    out.lines.push(['pilot', 'Houston, we\'re down. The Surveyor\'s a long way over there, past two craters.', '']);
    out.verdict = 'fair'; out.judge = 'We had the correction and didn\'t send it. A long walk to the Surveyor, and Apollo still doesn\'t know if it can land on a point.';
    if (d[5] < ODDS.hardLanding) { out.hurt = 0.2; out.note = 'Flying the last of it by eye, the commander ran low on fuel and landed hard.'; }
    return out;
  },
  rescue(choice, { d, out }) {
    const odds = { csm: 0.85, lmburn: 0.55, wait: 0.35 }[choice];
    if (d[6] < odds) {
      out.lines.push(choice === 'csm' ? ['crew2', 'I\'ve got her in the sextant. Coming down to her… contact. Capture. I\'ve got them, Houston.', 'go'] : ['pilot', choice === 'lmburn' ? 'The thrusters are dry, and we\'re up with him. He\'s got us.' : 'One more orbit and the phase is right. Here he comes.', 'go']);
      out.verdict = choice === 'csm' ? 'good' : 'fair';
      out.judge = choice === 'csm' ? 'The command module went down for them, the way the rescue was planned. It worked.' : choice === 'lmburn' ? 'The lander spent everything she had climbing. It came off, with nothing to spare.' : 'We waited an orbit with a sick lander. It came off.';
      return out;
    }
    out.set.lmLost = true;
    out.lines.push(choice === 'csm' ? ['crew2', 'Houston, I can\'t close. I\'m out of margin. I can\'t reach them.', 'bad'] : ['pilot', choice === 'lmburn' ? 'Thrusters are dry. We\'re short, Houston. We can\'t reach him.' : 'Houston, the orbit\'s lower than you said. We\'re running out of oxygen before he can get here.', 'bad']);
    out.verdict = 'bad';
    out.judge = choice === 'csm' ? 'The rescue was the right plan and it didn\'t work. I don\'t know what else we had.' : 'We had a rescue planned and practised, and we didn\'t fly it.';
    out.note = 'The command module could not reach the lander. Her crew died in lunar orbit.';
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

// The entry angle the trans-Earth burn left her on, in degrees off the middle of the corridor.
export const entryAngleError = t => 2.2 * (t.d[11] - 0.5);
// What the tracking can measure for the board, with its own small error (no draw).
export function measure(round, what) {
  const t = round.flightTruth;
  if (what === 'entryAngle') {
    const seen = LUNAR_ENTRY.gamma + entryAngleError(t) + 0.12 * (t.d[10] - 0.5);
    const inside = seen < LUNAR_ENTRY.corridor[1] && seen > LUNAR_ENTRY.corridor[0];
    return { 'ENTRY ANGLE': [`${seen.toFixed(2)}°`, !inside || Math.abs(seen - LUNAR_ENTRY.gamma) > 0.5], CORRIDOR: [`${LUNAR_ENTRY.corridor[0]}° to ${LUNAR_ENTRY.corridor[1]}°`] };
  }
  return {};
}

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
  if (e.skip || e.peakG > 18 || state.lost || state.stranded) capsule = 'lost';
  else if (e.peakG > 13 || (state.hurt && d[8] < state.hurt)) capsule = 'damaged';
  round.end = { ...(round.end || {}), outcome: 'entry', miss: e.skip ? 0 : e.miss / 1000, entryG: e.peakG, heat: e.heatLoad, blackout: e.blackout, capsule, skip: !!e.skip, lunar: true, lmLost: !!state.lmLost };
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
