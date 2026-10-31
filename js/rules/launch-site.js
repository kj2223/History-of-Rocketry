// THE LAUNCH SITE: base upgrades, the control room, launch crew, the go/no-go poll, pad troubleshooting and ground tests. No DOM.
import { formatMoney } from '../core/util.js';
import { FACILITIES, STATIONS, CONTROL_ROOM_FACILITIES } from '../data/launch-site.js';
import { FAULT_REPORTS, WIND_NAMES } from '../data/failures.js';
import { CORE_TEAM } from '../data/team.js';
import { BY_ID } from '../data/research.js';
import { S, log, isConfirmed, freeTeams, addHistory, formatDate, withProgramme } from '../core/state.js';
import { rangeFee } from './design.js';
import { knowledgeFraction, systemOf } from './knowledge.js';
import { programmeOf, traitsOf } from './programs.js';
import { traitByKey } from '../data/programmes.js';
import { siteStatus, directiveLock, orderConstruction } from './site.js';
import { notePressure } from './pressure.js';

// The control-room level, 0 to 5: how many of the control-room upgrades are built.
export const roomLevel = () => CONTROL_ROOM_FACILITIES.filter(id => S.fac[id]).length;
// Consoles for the launch crew: three, plus what the facilities add.
export const consoleCount = () => 3 + Object.keys(FACILITIES).reduce((sum, id) => sum + (S.fac[id] ? FACILITIES[id].consoles : 0), 0);
// Who is on the net: the Test Conductor, then every hired station in table order.
export const crewOnConsole = () => ['tc', ...Object.keys(STATIONS).filter(id => id != 'tc' && S.crew[id])];

// THE CORE TEAM AT THE CONSOLES: while a station has no specialist hired, its core-team member covers it (data/team.js console),
// if a console is free and the member has not moved on to a bigger job: Ellis once appointed launch director or while she
// holds an engineering remit (rules/remit.js). Hiring the specialist frees them. A cover catches faults at COVER_SKILL of a
// specialist's rate; the specialist's other effects (RSO destruct, TLM analysis records) need the hire.
export const COVER_SKILL = .6;
const memberMovedOn = member => member == 'ellis' && (!!S.staff.director || !!S.remit);
// The stations covered now, { station: member }.
export function coveredStations() {
  const covered = {};
  let free = consoleCount() - crewOnConsole().length;
  for (const member in CORE_TEAM) {
    const id = CORE_TEAM[member].console, station = STATIONS[id];
    if (!station) continue;
    if (free < 1 || S.crew[id] || memberMovedOn(member) || (station.requires && !S.fac[station.requires])) continue;
    covered[id] = member;
    free--;
  }
  return covered;
}
export const coveringMember = id => coveredStations()[id] || null;
// Everyone on the launch board: the Test Conductor, then every hired or covered station in table order.
export function boardCrew() {
  const covered = coveredStations();
  return ['tc', ...Object.keys(STATIONS).filter(id => id != 'tc' && (S.crew[id] || covered[id]))];
}

// Why a facility cannot be built, or null.
export function facilityLock(id) {
  const facility = FACILITIES[id];
  if (!facility) return 'Unknown.';
  if (S.fac[id]) return 'Built.';
  if (S.fb && S.fb[id]) return `Under construction: in service around ${formatDate(S.fb[id])}.`;
  if (siteStatus(id) == 'waiting') return 'Ordered: waiting for a free contractor crew.';
  if (siteStatus(id) == 'mothballed') return 'Mothballed.';
  if (facility.nasa && !S.nasa) return 'Opens when NASA is established.';
  if (facility.apollo && !(S.p2 && S.p2.ap && S.p2.ap.arch)) return 'Opens once Project Apollo has chosen how to reach the Moon.';
  if (facility.requires && !S.fac[facility.requires]) return `Requires ${FACILITIES[facility.requires].name}.`;
  if (S.dir < facility.fromDirective) return `Available from directive ${facility.fromDirective + 1}.`;
  if (directiveLock(id)) return directiveLock(id);
  if (S.b < facility.cost) return `Need ${formatMoney(facility.cost - S.b)} more.`;
  return null;
}
// Pay for a facility. In Phase One it is in service at once; from NASA on it goes to the contractor crews (rules/site.js).
export function buildFacility(id) {
  if (facilityLock(id)) return;
  const facility = FACILITIES[id];
  S.b -= facility.cost;
  if (S.nasa) return orderConstruction(id);
  S.fac[id] = 1;
  if (facility.controlRoom) addHistory(`Control room: ${facility.name}`);
  log(`[BASE] ${facility.name} operational.`, 'ok');
}

// Why a launch-crew station cannot be hired, or null.
export function stationLock(id) {
  const station = STATIONS[id];
  if (!station || id == 'tc') return 'Always on console.';
  if (S.crew[id]) return 'On console.';
  if (station.nasa && !S.nasa) return 'Opens when NASA is established.';
  if (station.requires && !S.fac[station.requires]) return `Needs ${FACILITIES[station.requires].name}.`;
  if (crewOnConsole().length >= consoleCount()) return 'No free console. Expand the control room.';
  if (S.b < station.cost) return `Need ${formatMoney(station.cost - S.b)} more.`;
  return null;
}
export function hireStation(id) {
  if (stationLock(id)) return;
  const station = STATIONS[id];
  S.b -= station.cost;
  S.crew[id] = 1;
  log(`[LAUNCH CREW] ${station.name} takes the ${station.callSign} console.`, 'ok');
}
export function dismissStation(id) {
  if (S.crew[id]) {
    S.crew[id] = 0;
    log(`[LAUNCH CREW] ${STATIONS[id].name} released from the ${STATIONS[id].callSign} console.`, 'wn');
  }
}

// THE GO/NO-GO POLL. Each countdown may hide one latent fault. Staffed stations whose domain covers it may catch it;
// any station may raise a false alarm. Returns the poll:
//   lines     one per station on the net: { id, go, msg, orig: the first message, issue, real: a true fault, wind: a weather call }
//   fault     the latent failure mode, or null         det    whether anyone found it
//   wind      0 calm, 1 gusty, 2 high                  wk     whether there is a weather forecast
//   nogo      whether any station says NO-GO            af     the airframe id
export const scrubCost = () => Math.round(1500 + rangeFee() * .3);
const sentence = text => text[0].toUpperCase() + text.slice(1) + '.';
export function runPoll(airframe, propellant, stage) {
  return withProgramme(programmeOf(airframe), () => runPollForProgramme(airframe, propellant, stage));
}
function runPollForProgramme(airframe, propellant, stage) {
  // The chance of a latent fault: more for unproven packages, staging and a little-flown propellant; less as the team knows the rocket.
  // Phase Two packages are the capsule's, not the booster's, so they do not count here.
  const unproven = airframe.pk.filter(id => !isConfirmed(id) && !(BY_ID[id] && BY_ID[id].phase == 2)).length;
  const faultChance = Math.min(.55, .12 + .04 * unproven + (stage ? .08 : 0) + ((S.fr[propellant] || 0) < 3 ? .06 : 0)) * (1 - .35 * (knowledgeFraction('p') + knowledgeFraction('s') + knowledgeFraction('a')) / 3);
  // Which fault: each letter is a failure mode; repeats make it likelier. Staging adds separation, uncured traits add their own mode four times.
  const faultPool = 'ccpiivvsshf' + (stage ? 'xx' : '')
    + traitsOf(programmeOf(airframe)).filter(trait => traitByKey(trait.k).mode && !airframe.fix[traitByKey(trait.k).mode]).map(trait => traitByKey(trait.k).mode.repeat(4)).join('');
  const fault = Math.random() < faultChance ? faultPool[Math.floor(Math.random() * faultPool.length)] : null;
  const windRoll = Math.random(), wind = windRoll < .6 ? 0 : windRoll < .9 ? 1 : 2;
  const hasForecast = !!S.fac.wx, flightDirectorBonus = S.crew.fd ? .15 : 0, lines = [];
  let detected = false;
  for (const id of boardCrew()) {
    const station = STATIONS[id], skill = id == 'tc' || S.crew[id] ? 1 : COVER_SKILL;
    let go = true, message = '', real = false, issue = '';
    if (id == 'tc') {
      // The Test Conductor's walkdown: a small chance to find any fault, better with knowledge of that system.
      message = hasForecast ? `Range forecast: ${WIND_NAMES[wind]} winds.` : 'No weather forecast on the range.';
      if (fault && Math.random() < .12 + .15 * knowledgeFraction(systemOf(fault))) {
        go = false; detected = true; real = true; issue = FAULT_REPORTS[fault];
        message = `Walkdown finds a problem: ${issue}.`;
      }
    } else if (fault && !detected && station.catches.includes(fault) && Math.random() < (.5 + flightDirectorBonus + .3 * knowledgeFraction(systemOf(fault))) * skill) {
      go = false; detected = true; real = true; issue = FAULT_REPORTS[fault];
      message = sentence(issue);
    } else if (id == 'rso' && hasForecast && wind == 2) {
      go = false;
      message = 'Winds aloft exceed range limits.';
    } else if (station.catches && Math.random() < (S.crew.fd ? .015 : .03)) {
      // A false alarm.
      go = false;
      issue = FAULT_REPORTS[station.catches[Math.floor(Math.random() * station.catches.length)]];
      message = sentence(issue);
    }
    lines.push({ id, go, msg: message, orig: message, issue, real, wind: id == 'rso' && !go && !real && message.startsWith('Winds') });
  }
  return { lines, fault, det: detected, wind, wk: hasForecast, nogo: lines.some(line => !line.go), af: airframe.id };
}
// Scrubbing costs a turnaround fee and two days.
export function scrub(poll) {
  const cost = Math.min(S.b, scrubCost());
  S.b -= cost;
  S.day += 2;
  const firstNoGo = poll.lines.find(line => !line.go);
  log(`[SCRUB] Launch scrubbed${firstNoGo ? ` (${STATIONS[firstNoGo.id].callSign}: ${firstNoGo.msg})` : ''} Turnaround ${formatMoney(cost)}.`, 'wn');
  notePressure('scrub');
}

// TROUBLESHOOTING ON THE PAD: a team tries to fix the reported problem (it may not work), or the range holds for better weather.
export const PAD_FIX_COST = 800;
export const padFixOdds = poll => Math.max(.3, Math.min(.9, .55 + (S.crew.fd ? .15 : 0) + (S.fac.comp ? .05 : 0) - .1 * ((poll.tries || 0))));
export function troubleshoot(poll) {
  const line = poll.lines.find(candidate => !candidate.go);
  if (!line || S.b < PAD_FIX_COST) return;
  S.b -= PAD_FIX_COST;
  S.day += 1;
  if (line.id == 'rso' && line.wind) {
    const windRoll = Math.random(), wind = windRoll < .6 ? 0 : windRoll < .9 ? 1 : 2;
    poll.wind = wind;
    if (wind < 2) {
      line.go = true;
      line.msg = `Held for weather. Winds now ${WIND_NAMES[wind]}.`;
    } else line.msg = 'Held for weather. Winds still above limits.';
    log(`[RANGE] Weather hold: winds ${WIND_NAMES[wind]}.`, 'wn');
  } else {
    const fixed = Math.random() < padFixOdds(poll);
    poll.tries = (poll.tries || 0) + 1;
    if (fixed) {
      line.go = true;
      line.msg = `Fixed on the pad: ${line.issue}.`;
      if (line.real) poll.fault = null;
      log(`[PAD] ${STATIONS[line.id].callSign} reports the problem fixed.`, 'ok');
    } else {
      line.msg = `${line.orig} Fix attempt failed.`;
      log(`[PAD] ${STATIONS[line.id].callSign}: fix attempt failed.`, 'bad');
    }
  }
  poll.nogo = poll.lines.some(candidate => !candidate.go);
}

// GROUND TESTS confirm a package without flying it: propulsion on the test stand, spacecraft systems by qualification tests
// (drop tests, altitude chambers, sled runs).
export const isQualificationArea = area => area == 'c' || area == 'e';
export const TEST_STAND = { cost: 2000, time: 30 }, QUALIFICATION_TEST = { cost: 4000, time: 110 };
export function groundTestLock(id) {
  const done = S.pk[id], area = BY_ID[id].area, test = isQualificationArea(area) ? QUALIFICATION_TEST : TEST_STAND;
  if (!isQualificationArea(area) && !S.fac.stand) return 'Needs the Static Engine Test Stand.';
  if (!done) return 'Not built yet.';
  if (done.c) return 'Already confirmed.';
  if (area != 'p' && !isQualificationArea(area)) return 'Only propulsion and spacecraft work can be ground tested.';
  if (S.jobs.find(job => job.k == 'gt' && job.id == id)) return 'Test under way.';
  if (S.b < test.cost) return `Need ${formatMoney(test.cost - S.b)} more.`;
  if (freeTeams() < 1) return 'All teams busy.';
  return null;
}
export function groundTest(id) {
  if (groundTestLock(id)) return;
  const qualification = isQualificationArea(BY_ID[id].area), test = qualification ? QUALIFICATION_TEST : TEST_STAND;
  S.b -= test.cost;
  S.jobs.push({ k: 'gt', id, prog: S.cur, t: test.time, tot: test.time });
  log(qualification ? `[QUALIFICATION] Ground tests scheduled for ${BY_ID[id].name} ($4,000).` : `[TEST STAND] Static firing scheduled for ${BY_ID[id].name} ($2,000).`, 'wn');
}
