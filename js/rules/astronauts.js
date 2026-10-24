// ASTRONAUTS: the candidate pool, what the office believes about each person, selection, training and crew assignment. No DOM.
// Skills run 0 to 100. The player sees an estimate with a range; the range narrows as training reveals the person.
//
// An astronaut (saved in S.p2.pool, then S.p2.astros):
//   id, name, svc (service), hrs (jet hours), tps (test pilot school), deg (degree), age
//   t      true skills { pil, sys, end, com }      bias   how far off the office's first impression is, per skill
//   med    a hidden heart condition                kn     days of pre-selection testing (they reveal the person like training)
//   dq     medically disqualified in testing       st     pool | active | grounded | medical | lost
//   tday   training days                           reh    simulator rehearsals done, { emergency: 1 }
//   focus  a TRAINING_FOCUS key                    gd     days left grounded
//   fat    fatigue, 0 to 100                       flights
//   asg    the mission assigned ('mr', 'mo', or a Gemini seat: 'gt' command pilot, 'gtp' pilot), or null
//   mt     mission training, 0 to 1                cap  capsule name, once flown
//   bk     the mission they back up, or null: a backup trains alongside the pilot and takes over the next flight
import { gaussian } from '../core/util.js';
import { FIRST_NAMES, LAST_NAMES, SERVICES, DEGREES, SKILLS, TRAINING_FOCUS, QUALIFICATION_DAYS, REHEARSALS, REHEARSAL_KEYS } from '../data/astronauts.js';
import { MISSION_TYPES, GEMINI_SEATS, SECOND_GROUP_SIZE } from '../data/mercury.js';
import { S, log, addHistory } from '../core/state.js';
import { scheduleOffice } from './astronaut-office.js';

const pick = list => list[Math.floor(Math.random() * list.length)];
const skillRange = value => Math.max(15, Math.min(92, Math.round(value)));

// A candidate's skills follow their record: flying hours and test pilot school for piloting, an engineering or science degree
// for systems, youth for endurance.
function makeCandidate(id) {
  const service = pick(SERVICES), hours = Math.round(1200 + Math.random() * 2400), testPilot = Math.random() < .7, degree = pick(DEGREES), age = 32 + Math.floor(Math.random() * 8);
  const skills = {
    pil: skillRange(42 + (hours - 1500) / 70 + (testPilot ? 7 : 0) + gaussian() * 9),
    sys: skillRange(46 + (/Engineering|Physics|Math/.test(degree) ? 9 : 0) + gaussian() * 11),
    end: skillRange(52 + (39 - age) * .8 + gaussian() * 11),
    com: skillRange(52 + gaussian() * 12),
  };
  const bias = Object.fromEntries(Object.keys(SKILLS).map(skill => [skill, gaussian()]));
  return {
    id, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, svc: service, hrs: hours, tps: testPilot, deg: degree, age, t: skills, bias,
    med: Math.random() < .15 ? 1 : 0, kn: 0, tday: 0, reh: {}, focus: 'bal', st: 'pool', gd: 0, fat: 0, flights: 0, mt: 0, asg: null,
  };
}
// The finalists, no two sharing a surname.
export function makePool(size = 16) {
  const surnames = new Set(), pool = [];
  let id = 1;
  while (pool.length < size) {
    const candidate = makeCandidate(id), surname = candidate.name.split(' ')[1];
    if (surnames.has(surname)) continue;
    surnames.add(surname);
    pool.push(candidate);
    id++;
  }
  return pool;
}

// THE SECOND GROUP (Gemini): nine more astronauts join without a selection of your own, surnames not already in the office, and
// start general training. As in 1962, NASA picked them from test pilots and the engineers' own candidates.
export function joinSecondGroup() {
  const astronauts = S.p2.astros, surnames = new Set(astronauts.map(astronaut => astronaut.name.split(' ')[1])), joined = [];
  let id = Math.max(0, ...astronauts.map(astronaut => astronaut.id)) + 1;
  while (joined.length < SECOND_GROUP_SIZE) {
    const candidate = makeCandidate(id), surname = candidate.name.split(' ')[1];
    if (surnames.has(surname)) continue;
    surnames.add(surname);
    candidate.st = 'active';
    joined.push(candidate);
    id++;
  }
  astronauts.push(...joined);
  addHistory(`Second astronaut group selected (${joined.length})`);
  log(`[ASTRONAUT OFFICE] The second astronaut group reports for training: ${joined.map(astronaut => astronaut.name).join(', ')}.`, 'hd');
}

// WHAT THE OFFICE BELIEVES: the estimate drifts toward the truth and the range shrinks with training days and testing.
export const estimateWidth = astronaut => Math.round(24 / (1 + (astronaut.tday + (astronaut.kn || 0)) / 150));
export const skillEstimate = (astronaut, skill) => {
  const width = estimateWidth(astronaut);
  return { value: Math.max(0, Math.min(100, Math.round(astronaut.t[skill] + astronaut.bias[skill] * width * .5))), width };
};
export const activeAstronauts = () => (S.p2 && S.p2.astros || []).filter(astronaut => astronaut.st == 'active' || astronaut.st == 'grounded');
export const astronautById = id => (S.p2.astros || []).find(astronaut => astronaut.id == id);
export const isQualified = astronaut => astronaut.st == 'active' && astronaut.tday >= QUALIFICATION_DAYS;

// SELECTION: three to seven finalists, none medically disqualified.
export function selectCrew(ids) {
  const phaseTwo = S.p2;
  if (phaseTwo.selDone || (phaseTwo.sel && phaseTwo.sel.st != 3) || ids.length < 3 || ids.length > 7) return false;
  if (phaseTwo.pool.some(candidate => ids.includes(candidate.id) && candidate.dq)) return false;
  for (const candidate of phaseTwo.pool) if (ids.includes(candidate.id)) {
    candidate.st = 'active';
    phaseTwo.astros.push(candidate);
  }
  phaseTwo.pool = [];
  phaseTwo.selDone = 1;
  if (phaseTwo.sel) phaseTwo.sel.st = 4;
  addHistory(`Astronaut group selected (${ids.length})`);
  log(`[ASTRONAUT OFFICE] ${ids.length} astronauts selected: ${phaseTwo.astros.map(astronaut => astronaut.name).join(', ')}. Training begins.`, 'hd');
  S.rep = Math.min(100, S.rep + 4);
  log('[PRESS] NASA introduces its astronauts at a crowded press conference in Washington. Overnight they are famous.', 'ok');
  scheduleOffice();
  return true;
}

// TRAINING for some days. Rates scale with the facilities; simulator fidelity decides how much a session is worth.
// Each skill grows more slowly as it nears 100, and at half rate when the astronaut is exhausted (fatigue over 60).
export const simulatorTier = () => S.fac.msim ? 2 : S.fac.ptrain ? 1 : 0;
export function trainingTick(days) {
  const phaseTwo = S.p2;
  if (!phaseTwo || !phaseTwo.selDone) return;
  const simulator = [.35, .7, 1][simulatorTier()], centrifuge = S.fac.centrifuge ? 1 : .4, zeroG = S.fac.zerog ? 1 : .4, egressTank = S.fac.egress ? 1 : .35;
  for (const astronaut of phaseTwo.astros) {
    if (astronaut.st == 'grounded') {
      astronaut.gd -= days;
      astronaut.fat = Math.max(0, astronaut.fat - days * .4);
      if (astronaut.gd <= 0) {
        astronaut.st = 'active';
        log(`[FLIGHT SURGEON] ${astronaut.name} is returned to flight status.`, 'ok');
      }
      continue;
    }
    if (astronaut.st != 'active') continue;
    const focus = astronaut.focus;
    const improve = (skill, rate) => {
      astronaut.t[skill] = Math.min(95, astronaut.t[skill] + rate * days * (1 - astronaut.t[skill] / 100) * (astronaut.fat > 60 ? .5 : 1));
    };
    if (focus == 'rest') {
      astronaut.fat = Math.max(0, astronaut.fat - days * .6);
      astronaut.tday += days * .2;
      continue;
    }
    astronaut.tday += days;
    astronaut.fat = Math.min(100, astronaut.fat + days * .05);
    const weight = focus == 'bal' ? .5 : 1;
    if (focus == 'phys' || focus == 'bal') {
      improve('end', .05 * centrifuge * weight);
      improve('com', .02 * zeroG * weight);
    }
    if (focus == 'sim' || focus == 'bal') {
      improve('sys', .045 * simulator * weight);
      improve('pil', .04 * simulator * weight);
      improve('com', .015 * simulator * weight);
      if (Math.random() < .006 * days * simulatorTier() * weight) {
        const emergency = pick(REHEARSAL_KEYS);
        if (!astronaut.reh[emergency]) {
          astronaut.reh[emergency] = 1;
          log(`[SIMULATOR] ${astronaut.name} has rehearsed a ${REHEARSALS[emergency].long}.`, 'cyan');
        }
      }
    }
    if (focus == 'egr') {
      improve('end', .02 * egressTank);
      astronaut.reh.hatch = astronaut.reh.hatch || (Math.random() < .01 * days * egressTank ? 1 : 0);
    }
    // Gemini crews train at half rate until the Gemini mission simulator is built.
    if (focus == 'msn' && (astronaut.asg || astronaut.bk)) {
      const geminiWithoutSimulator = GEMINI_SEATS.includes(astronaut.asg || astronaut.bk) && !S.fac.gsim ? .5 : 1;
      astronaut.mt = Math.min(1, astronaut.mt + days / 110 * (.5 + .5 * simulator) * geminiWithoutSimulator);
      improve('sys', .02 * simulator);
      improve('pil', .02 * simulator);
    }
    // A heart condition missed in selection may surface; anyone may be grounded for a while, more likely when tired.
    if (astronaut.med && Math.random() < .0025 * days) {
      astronaut.st = 'medical';
      astronaut.asg = astronaut.bk = null;
      astronaut.mt = 0;
      log(`[FLIGHT SURGEON] A heart irregularity missed in selection has been found in ${astronaut.name}. Permanently grounded from flight; ${astronaut.name.split(' ')[0]} stays on in the Astronaut Office.`, 'bad');
      continue;
    }
    if (Math.random() < .00012 * days * (1 + astronaut.fat / 50)) {
      astronaut.st = 'grounded';
      astronaut.gd = 60 + Math.random() * 180;
      log(`[FLIGHT SURGEON] ${astronaut.name} is grounded for about ${Math.round(astronaut.gd / 30)} months after a medical finding.`, 'wn');
      if (astronaut.asg || astronaut.bk) {
        astronaut.asg = astronaut.bk = null;
        astronaut.mt = 0;
      }
    }
  }
}
export function setTrainingFocus(id, focus) {
  const astronaut = astronautById(id);
  if (astronaut && TRAINING_FOCUS[focus]) astronaut.focus = focus;
}
// Assign a qualified astronaut as pilot of the next flight of a mission type (only one pilot per mission type).
export function assignPilot(id, missionType) {
  const astronaut = astronautById(id);
  if (!astronaut || !isQualified(astronaut)) return;
  for (const other of S.p2.astros) if (other.asg == missionType) {
    other.asg = null;
    other.mt = 0;
  }
  // The backup keeps the mission training done so far.
  if (astronaut.bk != missionType) astronaut.mt = 0;
  astronaut.asg = missionType;
  astronaut.bk = null;
  astronaut.focus = 'msn';
  log(`[ASTRONAUT OFFICE] ${astronaut.name} is assigned as pilot for the next ${flightName(missionType)} flight. Mission training begins.`, 'ok');
}
// Assign a qualified astronaut as backup pilot: they train for the same flight and take over the one after it.
export function assignBackup(id, missionType) {
  const astronaut = astronautById(id);
  if (!astronaut || !isQualified(astronaut) || astronaut.asg) return;
  for (const other of S.p2.astros) if (other.bk == missionType) {
    other.bk = null;
    other.mt = 0;
  }
  astronaut.bk = missionType;
  astronaut.mt = 0;
  astronaut.focus = 'msn';
  log(`[ASTRONAUT OFFICE] ${astronaut.name} is backup pilot for the next ${flightName(missionType)} flight and will fly the one after it.`, 'ok');
}
// After a flight the backup becomes the pilot, with the mission training already done.
export function promoteBackup(missionType) {
  const backup = backupPilot(missionType);
  if (!backup) return;
  backup.asg = missionType;
  backup.bk = null;
  log(`[ASTRONAUT OFFICE] ${backup.name} moves up from backup to pilot for the next ${flightName(missionType)} flight (${Math.round(backup.mt * 100)}% through mission training).`, 'ok');
}
const flightName = missionType => missionType == 'mr' ? 'Mercury-Redstone' : missionType == 'mo' ? 'orbital Mercury' : missionType == 'gt' ? 'Gemini (command pilot)' : missionType == 'gtp' ? 'Gemini (pilot)' : missionType;
// What an assignment key is called on an astronaut's card.
export const assignmentName = missionType => missionType == 'gt' ? 'Gemini flight, command pilot' : missionType == 'gtp' ? 'Gemini flight, pilot' : MISSION_TYPES[missionType].fullName;
export const assignedPilot = missionType => (S.p2.astros || []).find(astronaut => astronaut.asg == missionType && astronaut.st == 'active');
export const backupPilot = missionType => (S.p2.astros || []).find(astronaut => astronaut.bk == missionType && astronaut.st == 'active');
