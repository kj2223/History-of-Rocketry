// PERSONNEL tab: payroll, build and engineering teams, the specialists, and the launch crew on console.
import { formatMoney } from '../core/util.js';
import { ROOMS, STATIONS } from '../data/launch-site.js';
import { S } from '../core/state.js';
import { payroll } from '../rules/economy.js';
import { buildTeams, MAX_BUILD_TEAMS, buildTeamCost } from '../rules/factory.js';
import { engineeringTeamCost, MAX_ENGINEERING_TEAMS, SPECIALISTS } from '../rules/game.js';
import { roomLevel, consoleCount, crewOnConsole, stationLock } from '../rules/launch-site.js';
import { $, setHTML } from './dom.js';

const staffCard = (title, description, action) => `<div class="c"><div class="t">${title}</div><div class="m">${description}</div>${action}</div>`;
export function renderStaff() {
  const box = $('#sf');
  if (!box) return;
  const orders = S.auto;
  setHTML(box, `<div class="r"><span class="d">Payroll per 30s funding cycle</span><b>${formatMoney(payroll())}</b></div>`
    + staffCard(`BUILD TEAMS (${buildTeams()}/${MAX_BUILD_TEAMS})`, 'Factory crews. Each one works a different item in the build queue at the same time: airframes, upgrades, capsules. $800 per cycle for each team beyond the first.',
      buildTeams() < MAX_BUILD_TEAMS ? `<button data-a="hire" data-id="bteam"${S.b < buildTeamCost() ? ' disabled' : ''}>HIRE BUILD TEAM (${formatMoney(buildTeamCost())})</button>` : '<div class="ok">Fully staffed.</div>')
    + staffCard(`ENGINEERING TEAMS (${S.teams}/${MAX_ENGINEERING_TEAMS})`, 'Each team works one job at a time: packages, investigations, fixes, retrofits, ground tests. $1,200 per cycle for each team beyond the first two.',
      S.teams < MAX_ENGINEERING_TEAMS ? `<button data-a="hire" data-id="team"${S.b < engineeringTeamCost() ? ' disabled' : ''}>HIRE ENGINEERING TEAM (${formatMoney(engineeringTeamCost())})</button>` : '<div class="ok">Fully staffed.</div>')
    + staffCard('PUBLIC RELATIONS SPECIALIST', 'Halves the reputation lost to failures and slowly rebuilds it. $1,000 per cycle.',
      S.staff.pr ? '<div class="ok">On staff.</div>' : `<button data-a="hire" data-id="pr"${S.b < SPECIALISTS.pr.cost ? ' disabled' : ''}>HIRE PR SPECIALIST (${formatMoney(SPECIALISTS.pr.cost)})</button>`)
    + staffCard('LAUNCH DIRECTOR',
      S.staff.director ? `Flies ready airframes unattended every ~15s when funds allow, runs the poll and scrubs on any NO-GO. Orders: ${orders.fuel}, ${orders.pay}, ${orders.st ? 'booster' : 'single stage'}, ${Math.round(orders.load * 100)}% propellant. Set them from the Launch tab. $2,500 per cycle.` : 'Runs countdowns for you from standing orders. $2,500 per cycle.',
      S.staff.director ? `<button data-a="autoOn">AUTOMATION: ${orders.on ? 'ON (click to stop)' : 'OFF (click to start)'}</button>` : `<button data-a="hire" data-id="director"${S.b < SPECIALISTS.director.cost ? ' disabled' : ''}>HIRE LAUNCH DIRECTOR (${formatMoney(SPECIALISTS.director.cost)})</button>`));
}
// The launch crew: the Test Conductor is always on console; other stations are hired into free consoles.
export function renderLaunchCrew() {
  const box = $('#crew');
  if (!box) return;
  const consoles = consoleCount(), staffed = crewOnConsole().length;
  let html = `<div class="r"><span class="d">Consoles staffed</span><b>${staffed} / ${consoles}</b></div><div class="m">${ROOMS[roomLevel()].name}. Control-room upgrades in Hangar & Base add consoles. Staffed stations can catch hidden faults during the countdown poll.</div>`;
  for (const id in STATIONS) {
    const station = STATIONS[id], lock = stationLock(id), onConsole = id == 'tc' || S.crew[id];
    html += `<div class="c"><div class="r"><b>${station.callSign} — ${station.name}</b><span class="${S.crew[id] || id == 'tc' ? 'ok' : 'd'}">${onConsole ? 'On console' : station.requires && !S.fac[station.requires] ? 'Locked' : 'Vacant'}</span></div><div class="m">${station.description}${station.salary ? ` ${formatMoney(station.salary)} per cycle.` : ''}</div>`
      + (id == 'tc' ? '' : S.crew[id] ? `<button data-a="dismiss" data-id="${id}">RELEASE FROM CONSOLE</button>` : `<button data-a="crew" data-id="${id}"${lock ? ' disabled' : ''}>HIRE (${formatMoney(station.cost)})</button>${lock ? `<div class="m">${lock}</div>` : ''}`)
      + '</div>';
  }
  setHTML(box, html);
}
