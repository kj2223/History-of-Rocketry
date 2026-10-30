// PERSONNEL tab: NASA's budget, the core team, payroll, build and engineering teams, the press office, and the launch crew on console.
// The launch director is hired and managed on the Launch tab (ui/launch-panel.js).
import { formatMoney } from '../core/util.js';
import { ROOMS, STATIONS, TRAJECTORY_ANALYSTS } from '../data/launch-site.js';
import { CORE_TEAM } from '../data/team.js';
import { S, formatDate } from '../core/state.js';
import { payroll } from '../rules/economy.js';
import { instalment, spentThisYear, budgetUsed, request, automaticRequest, congressShare, nextBudget, operationsPerYear, CARRY_OVER, QUIET_DAYS, REQUEST_RANGE, EARLY_DAYS } from '../rules/budget.js';
import { buildTeams, MAX_BUILD_TEAMS, buildTeamCost } from '../rules/factory.js';
import { engineeringTeamCost, MAX_ENGINEERING_TEAMS, SPECIALISTS } from '../rules/game.js';
import { roomLevel, consoleCount, crewOnConsole, stationLock, coveringMember } from '../rules/launch-site.js';
import { analysts, analystLock } from '../rules/trajectory.js';
import { memberName, memberRole, memberRecord, joinedMembers } from '../rules/team.js';
import { $, setHTML } from './dom.js';

const staffCard = (title, description, action) => `<div class="c"><div class="t">${title}</div><div class="m">${description}</div>${action}</div>`;
export function renderStaff() {
  const box = $('#sf');
  if (!box) return;
  setHTML(box, budgetHTML() + coreTeamHTML() + `<div class="r"><span class="d">Payroll per 30s funding cycle</span><b>${formatMoney(payroll())}</b></div>`
    + staffCard(`BUILD TEAMS (${buildTeams()}/${MAX_BUILD_TEAMS})`, 'Factory crews. Each one works a different item in the build queue at the same time: airframes, upgrades, capsules. $800 per cycle for each team beyond the first.',
      buildTeams() < MAX_BUILD_TEAMS ? `<button data-a="hire" data-id="bteam"${S.b < buildTeamCost() ? ' disabled' : ''}>HIRE BUILD TEAM (${formatMoney(buildTeamCost())})</button>` : '<div class="ok">Fully staffed.</div>')
    + staffCard(`ENGINEERING TEAMS (${S.teams}/${MAX_ENGINEERING_TEAMS})`, 'Each team works one job at a time: packages, investigations, fixes, retrofits, ground tests. $1,200 per cycle for each team beyond the first two.',
      S.teams < MAX_ENGINEERING_TEAMS ? `<button data-a="hire" data-id="team"${S.b < engineeringTeamCost() ? ' disabled' : ''}>HIRE ENGINEERING TEAM (${formatMoney(engineeringTeamCost())})</button>` : '<div class="ok">Fully staffed.</div>')
    + staffCard('PUBLIC RELATIONS SPECIALIST', 'Halves the reputation lost to failures and slowly rebuilds it. $1,000 per cycle.',
      S.staff.pr ? '<div class="ok">On staff.</div>' : `<button data-a="hire" data-id="pr"${S.b < SPECIALISTS.pr.cost ? ' disabled' : ''}>HIRE PR SPECIALIST (${formatMoney(SPECIALISTS.pr.cost)})</button>`));
}
// THE CORE TEAM: the people who have been with the programme from the start and the leads who joined later, each with their speciality and record.
const coreTeamHTML = () => `<div class="c"><div class="t">CORE TEAM</div>${joinedMembers().map(id => `<div class="r"><b>${memberName(id)}</b><span class="d">${memberRole(id)}</span></div>`
  + `<div class="m">${CORE_TEAM[id].speciality}. ${CORE_TEAM[id].owns} Record: ${memberRecord(id)}.</div>`).join('')}</div>`;
// NASA'S BUDGET: this fiscal year so far, what Congress is likely to grant next, and the request the player can raise.
const REQUEST_STEPS = [1, 1.1, 1.2, 1.3, 1.4, 1.5].filter(step => step >= REQUEST_RANGE[0] && step <= REQUEST_RANGE[1]);
function budgetHTML() {
  const fy = S.fy;
  if (!fy) return '';
  const row = (label, value, cls = '') => `<div class="r"><span class="d">${label}</span><b class="${cls}">${value}</b></div>`, used = budgetUsed(), last = fy.last;
  return `<div class="c"><div class="t">NASA BUDGET: FY${fy.yr} (ENDS JUN ${fy.yr})</div>`
    + row('Appropriation', `${formatMoney(fy.bud)} a year (${formatMoney(instalment())} a cycle)`)
    + row('Spent so far', `${formatMoney(spentThisYear())} (${Math.round(used * 100)}% of the budget to date)`, S.day - fy.st < EARLY_DAYS ? '' : used < .85 ? 'wn' : 'ok')
    + row('Payroll and upkeep for a year', formatMoney(operationsPerYear()))
    + row('Carry-over limit', formatMoney(CARRY_OVER * fy.bud))
    + `<div class="m">Spend the budget and Congress gives more next year; leave it unused and the next one is cut, and cash above the carry-over limit goes back to the Treasury when the year ends.${fy.q ? ` <b class="bad">No Mercury flight since ${formatDate(fy.lm)}: reputation is slipping.</b>` : ` Go ${QUIET_DAYS} days without a Mercury flight and reputation starts to slip.`}</div>`
    + `<select data-rq="1">${REQUEST_STEPS.map(step => `<option value="${step}"${Math.abs(step - fy.rq) < .01 ? ' selected' : ''}>Request ${Math.round(step * 100)}% of the ${formatMoney(automaticRequest())} the year's spending supports</option>`).join('')}</select>`
    + row(`Request for FY${fy.yr + 1}`, formatMoney(request()))
    + row('Congress likely to grant', `${Math.round(congressShare() * 100)}%: ${formatMoney(nextBudget())}`)
    + (last ? `<div class="m">FY${last.yr}: ${formatMoney(last.spent)} spent of ${formatMoney(last.bud)}; Congress granted ${Math.round(last.share * 100)}% of the request${last.lapsed ? `; ${formatMoney(last.lapsed)} went back to the Treasury` : ''}.</div>` : '')
    + '</div>';
}
// The launch crew: the Test Conductor is always on console; other stations are hired into free consoles.
// Then FIDO's trajectory analysts, who need no console.
export function renderLaunchCrew() {
  const box = $('#crew');
  if (!box) return;
  const consoles = consoleCount(), staffed = crewOnConsole().length;
  let html = `<div class="r"><span class="d">Consoles staffed</span><b>${staffed} / ${consoles}</b></div><div class="m">${ROOMS[roomLevel()].name}. Control-room upgrades at the Base desk add consoles. Staffed stations can catch hidden faults during the countdown poll.</div>`;
  for (const id in STATIONS) {
    const station = STATIONS[id], lock = stationLock(id), onConsole = id == 'tc' || S.crew[id], cover = !onConsole && coveringMember(id);
    html += `<div class="c"><div class="r"><b>${station.callSign} — ${station.name}</b><span class="${S.crew[id] || id == 'tc' ? 'ok' : cover ? 'wn' : 'd'}">${onConsole ? 'On console' : cover ? `Covered by ${CORE_TEAM[cover].name}` : station.requires && !S.fac[station.requires] ? 'Locked' : 'Vacant'}</span></div><div class="m">${station.description}${station.salary ? ` ${formatMoney(station.salary)} per cycle.` : ''}</div>`
      + (id == 'tc' ? '' : S.crew[id] ? `<button data-a="dismiss" data-id="${id}">RELEASE FROM CONSOLE</button>` : `<button data-a="crew" data-id="${id}"${lock ? ' disabled' : ''}>HIRE (${formatMoney(station.cost)})</button>${lock ? `<div class="m">${lock}</div>` : ''}`)
      + '</div>';
  }
  const lock = analystLock();
  html += `<div class="c"><div class="r"><b>TRAJECTORY ANALYSTS</b><span class="${analysts() ? 'ok' : 'd'}">${analysts()} / ${TRAJECTORY_ANALYSTS.max}</span></div><div class="m">FIDO's human computers. Each works through candidate flight plans, about one every ${Math.round(1 / TRAJECTORY_ANALYSTS.runsPerDay)} days, and the trajectory panel proposes the best found. No console needed. ${formatMoney(TRAJECTORY_ANALYSTS.salary)} per cycle each.</div>`
    + (analysts() < TRAJECTORY_ANALYSTS.max ? `<button data-a="analyst"${lock ? ' disabled' : ''}>HIRE ANALYST (${formatMoney(TRAJECTORY_ANALYSTS.cost)})</button>${lock ? `<div class="m">${lock}</div>` : ''}` : '')
    + (analysts() ? '<button data-a="unanalyst">RELEASE ONE ANALYST</button>' : '') + '</div>';
  setHTML(box, html);
}
