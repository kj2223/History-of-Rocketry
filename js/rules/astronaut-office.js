// THE ASTRONAUT OFFICE CALENDAR: selection and testing, office decisions, the chimpanzee colony, Washington, and the daily tick. No DOM.
// Selection runs: records screening, then a testing programme you choose, then the pick (rules/astronauts.js selectCrew).
import { formatMoney } from '../core/util.js';
import { MERCURY_DIRECTIVES, ELECTION_DAY, INAUGURATION_DAY, TESTING_REGIMES, OFFICE_DECISIONS, CHIMP_TRAINING_COST, CHIMP_TRAINING_DAYS } from '../data/mercury.js';
import { S, log, formatDate } from '../core/state.js';
import { phaseTwo, newPhaseTwo, directiveKey, fulfilDirective } from './mercury.js';
import { makePool } from './astronauts.js';
import { anyCertified, checkCertification } from './manrate.js';

// TESTING the finalists: a regime you pay for reveals more of each person and catches some or all hidden medical problems.
export function chooseTestingRegime(regimeKey) {
  const state = phaseTwo(), regime = TESTING_REGIMES[regimeKey];
  if (!regime || state.sel.st != 1 || S.b < regime.cost) return;
  S.b -= regime.cost;
  state.sel = { st: 2, at: Math.round(S.day + regime.days), reg: regimeKey };
  log(`[ASTRONAUT OFFICE] ${regime.name} begin for the ${state.pool.length} finalists (${formatMoney(regime.cost)}). Results around ${formatDate(state.sel.at)}.`, 'wn');
}
function finishTesting() {
  const state = phaseTwo(), regime = TESTING_REGIMES[state.sel.reg];
  let disqualified = 0;
  for (const candidate of state.pool) {
    candidate.kn = (candidate.kn || 0) + regime.insight;
    if (candidate.med && Math.random() < regime.findChance) {
      candidate.dq = 1;
      disqualified++;
    }
  }
  state.sel.st = 3;
  log(`[ASTRONAUT OFFICE] Testing is complete. ${disqualified ? `${disqualified} finalist${disqualified > 1 ? 's are' : ' is'} medically disqualified. ` : ''}Choose your astronauts.`, 'hd');
}

// OFFICE DECISIONS: four offers and demands land on the calendar after selection. Their texts are in data/mercury.js; their effects here.
export function answerOfficeDecision(yes) {
  const state = phaseTwo(), key = state.od, decision = OFFICE_DECISIONS[key];
  if (!decision) return;
  if (yes && decision.cost && S.b < decision.cost) return;
  state.od = null;
  const crew = state.astros.filter(astronaut => astronaut.st == 'active' || astronaut.st == 'grounded');
  const shiftSkill = (skill, amount) => crew.forEach(astronaut => {
    astronaut.t[skill] = Math.max(10, Math.min(95, astronaut.t[skill] + amount));
  });
  if (yes) {
    if (decision.cost) S.b -= decision.cost;
    state.fl[key] = 1;
    if (key == 'life') {
      S.rep = Math.min(100, S.rep + 5);
      state.gmul += .05;
      crew.forEach(astronaut => astronaut.fat = Math.min(100, astronaut.fat + 6));
    } else if (key == 'cock') {
      shiftSkill('sys', 4);
      crew.forEach(astronaut => astronaut.tday = Math.max(0, astronaut.tday - 15));
    }
  } else {
    if (key == 'win' || key == 'ovr') {
      shiftSkill('com', -3);
      crew.forEach(astronaut => astronaut.fat = Math.min(100, astronaut.fat + 6));
    } else if (key == 'cock') shiftSkill('com', -2);
    else if (key == 'life') S.rep = Math.max(0, S.rep - 1);
  }
  log(`[${decision.who}] ${yes ? decision.yes : decision.no}`, yes ? 'ok' : 'wn');
}
// The decisions arrive about 25, 110, 230 and 340 days after selection, each up to 60 days later at random.
export function scheduleOffice() {
  const state = phaseTwo(), day = S.day, around = offset => Math.round(day + offset + Math.random() * 60);
  state.oq = [{ k: 'life', at: around(25) }, { k: 'win', at: around(110) }, { k: 'ovr', at: around(230) }, { k: 'cock', at: around(340) }];
}

// THE CHIMPANZEE COLONY at Holloman Air Force Base: months of lever training before an animal can fly.
export function startChimpTraining() {
  const state = phaseTwo();
  if (state.ch.on || S.b < CHIMP_TRAINING_COST) return;
  S.b -= CHIMP_TRAINING_COST;
  state.ch.on = 1;
  log(`[HOLLOMAN] Six chimpanzees begin training at Holloman Air Force Base (${formatMoney(CHIMP_TRAINING_COST)}): couches, pressure suits and lever tasks on cue.`, 'wn');
}

// The office's day: the man-rating directive, selection steps, chimpanzee training, office decisions and the election.
// Returns true if anything happened.
export function officeTick(days) {
  const state = phaseTwo();
  if (!state) return false;
  let changed = false;
  if (directiveKey() == 'rate' && (anyCertified() || checkCertification())) {
    fulfilDirective(MERCURY_DIRECTIVES[state.dir]);
    changed = true;
  }
  if (state.sel.st == 0 && S.day >= state.sel.at) {
    state.pool = makePool(16);
    state.sel.st = 1;
    log('[ASTRONAUT OFFICE] Interviews and written tests have narrowed 110 test pilots to 16 finalists. Choose how thoroughly to test them.', 'hd');
    changed = true;
  }
  if (state.sel.st == 2 && S.day >= state.sel.at) {
    finishTesting();
    changed = true;
  }
  if (state.ch.on && state.ch.t < 1) {
    state.ch.t = Math.min(1, state.ch.t + days / CHIMP_TRAINING_DAYS);
    if (state.ch.t >= 1) {
      log('[HOLLOMAN] The chimpanzees are trained and ready to fly.', 'ok');
      changed = true;
    }
  }
  if (!state.od && state.oq.length && S.day >= state.oq[0].at) {
    state.od = state.oq.shift().k;
    log(`[${OFFICE_DECISIONS[state.od].who}] ${OFFICE_DECISIONS[state.od].question} (Astronaut Office)`, 'hd');
    changed = true;
  }
  if (state.elec == 0 && S.day >= ELECTION_DAY) {
    state.elec = 1;
    log('[WASHINGTON] A new President is elected. His science advisers will review whether Mercury is worth the risk before the inauguration.', 'hd');
    changed = true;
  }
  if (state.elec == 1 && S.day >= INAUGURATION_DAY) {
    state.elec = 2;
    if (state.dir >= 3) {
      state.gmul += .1;
      log('[WASHINGTON] The new administration\'s review backs Mercury. Appropriations +10%.', 'hd');
    } else {
      state.gmul = Math.max(.6, state.gmul - .1);
      log('[WASHINGTON] The new administration\'s review questions whether Mercury is ready. Appropriations cut by 10%.', 'bad');
    }
    changed = true;
  }
  return changed;
}

// Phase Two state appears the first tick after NASA is established. Older saves are brought up to date here:
// version 2 had a skippable man-rating directive; version 1 had no selection steps, Little Joe record or chimpanzee colony.
export function ensurePhaseTwo() {
  if (!S.p2) {
    S.p2 = newPhaseTwo();
    log('[ASTRONAUT OFFICE] NASA begins screening 508 military service records: jet pilots under 40 and under 5 ft 11 in, with 1,500 flying hours and test pilot school.', 'hd');
    return;
  }
  const state = S.p2;
  if (state.v == 2) {
    state.v = 3;
    if (state.bd == 'skip' && state.dir == 5 && !anyCertified()) state.dir = 4;
    delete state.bd;
    return;
  }
  if (state.v >= 3) return;
  const oldDirective = state.dir;
  S.p2 = Object.assign(newPhaseTwo(), state, { v: 3 });
  const upgraded = S.p2;
  upgraded.sel = { st: upgraded.selDone ? 4 : upgraded.pool.length ? 3 : 0, at: Math.round(S.day + 20), reg: 'std' };
  if (oldDirective >= 2) upgraded.lj = { ok: 3, mk: 1 };
  if (oldDirective >= 4) upgraded.dir = oldDirective == 4 ? 4 : 6;
  if (oldDirective >= 3) upgraded.ch = { on: 1, t: 1 };
  if (upgraded.selDone) scheduleOffice();
}
