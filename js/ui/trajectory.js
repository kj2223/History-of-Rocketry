// THE TRAJECTORY PANEL: pops out from the plotting board. FIDO's plan for the next flight: the launcher's elevation and the
// pitch program, with the predicted apogee, impact distance and loads. The board draws the predicted arc (ui/plot.js).
// It opens once the room has a Plotting Board; pitch programs need a Flight Dynamics Officer. Without a plan
// (launchForm.plan null) the rocket flies the default, as it always has. On a staged rocket FIDO can also aim the upper stage.
// Trajectory analysts (Crew desk) search the candidate plans day by day and propose the best one found for a goal (rules/trajectory.js).
import { PITCH_PROGRAMS, ELEVATION_RANGE, AIM_RANGE, PAYLOADS } from '../data/launch.js';
import { S } from '../core/state.js';
import { roomLevel } from '../rules/launch-site.js';
import { airborne, previewFlight } from '../rules/flight.js';
import { analysts, TRAJECTORY_GOALS, newSearch, workSearch } from '../rules/trajectory.js';
import { launchForm } from './launch-panel.js';
import { $, setHTML } from './dom.js';

// open: the panel is out; goal: the team's goal picked on the panel (a TRAJECTORY_GOALS key), or null for the launch's own;
// search: the team's search for the rocket on the launch form (rules/trajectory.js), or null.
export const trajectoryPanel = { open: false, goal: null, search: null };
const PLAN_FROM_LEVEL = 2; // the Plotting Board facility
const DEFAULT_ELEVATION = 81; // the default rail lean (0.15 radians), to the nearest degree
export const planUnlocked = () => roomLevel() >= PLAN_FROM_LEVEL;
// The plan the panel's controls start from: the one set, or the default written out.
export const currentPlan = () => launchForm.plan || { elevation: DEFAULT_ELEVATION, program: 'standard' };

const readyAirframe = () => S.air.find(candidate => candidate.id == launchForm.af && candidate.st == 'r');
// The flight the launch form would make with a plan (the form's own by default), as the engineers predict it
// (rules/flight.js previewFlight), or null with no rocket ready.
export function plannedFlight(plan = launchForm.plan) {
  const airframe = readyAirframe();
  return airframe ? previewFlight(airframe, launchForm.fuel, launchForm.pay, launchForm.st, launchForm.load / 100, 0, plan) : null;
}

// The goal the team works to: the one picked on the panel, or the launch's own (orbit for a satellite on a full stack, else height).
const canTryOrbit = () => PAYLOADS[launchForm.pay].satellite && launchForm.st;
const teamGoal = () => trajectoryPanel.goal == 'orbit' && !canTryOrbit() ? 'height' : trajectoryPanel.goal || (canTryOrbit() ? 'orbit' : 'height');
// THE TEAM AT WORK, called by the game clock with the game days that passed. A new rocket, load or goal starts a new search.
// Returns true if the team found a better plan (the screen needs redrawing).
export function workTrajectoryTeam(days) {
  const airframe = readyAirframe();
  if (!analysts() || !airframe || airborne.flight || airborne.mission) return false;
  const goal = teamGoal(), key = [airframe.id, launchForm.fuel, launchForm.pay, launchForm.st, launchForm.load, goal].join('|');
  if (!trajectoryPanel.search || trajectoryPanel.search.key != key) trajectoryPanel.search = newSearch(key, plannedFlight(null).flattestAim);
  const search = trajectoryPanel.search, untriedBefore = search.untried.length, improved = workSearch(search, days, goal, plannedFlight);
  const counter = $('#tjworked');
  if (counter) counter.textContent = search.worked;
  return improved || (untriedBefore > 0 && !search.untried.length);
}
const samePlan = (first, second) => !!first && !!second && first.elevation == second.elevation && first.program == second.program && (first.aim ?? null) == (second.aim ?? null);
const planWords = plan => `${plan.elevation}°, ${PITCH_PROGRAMS[plan.program].name.toLowerCase()} turn${plan.aim != null ? `, upper stage ${plan.aim}° up` : ''}`;

const row = (label, value, level = '') => `<div class="r"><span class="d">${label}</span><b class="${level}">${value}</b></div>`;
const loadLevel = share => share > .85 ? 'bad' : share > .6 ? 'wn' : 'ok';
const km = metres => (metres / 1000).toFixed(metres < 1e5 ? 1 : 0) + ' km';

export function renderTrajectory() {
  const unlocked = planUnlocked(), button = $('#trajbtn'), panel = $('#traj');
  button.hidden = !unlocked;
  button.classList.toggle('on', trajectoryPanel.open);
  panel.hidden = !unlocked || !trajectoryPanel.open;
  if (panel.hidden) return;
  const plan = launchForm.plan, shown = currentPlan(), fido = !!S.crew.fido;
  const profile = launchForm.st ? 'staged ascent' : 'sounding profile';
  let html = `<div class="ct">FLIGHT PLAN <span class="d">· FIDO</span></div>`;
  if (airborne.flight || airborne.mission) return setHTML(panel, html + '<div class="m">The plan is flying. The predicted arc stays on the board under the track.</div>');
  html += `<div class="m">${plan ? `Planned: ${PITCH_PROGRAMS[plan.program].name.toLowerCase()} turn, rail at ${plan.elevation}°.` : `Default ${profile}: rail leans to about ${DEFAULT_ELEVATION}°, standard turn.`}</div>`;
  html += `<div class="r"><span class="d">Launcher elevation</span><b id="tj-elevation">${shown.elevation}°</b></div>`
    + `<input type="range" data-tj="elevation" min="${ELEVATION_RANGE.min}" max="${ELEVATION_RANGE.max}" step="1" value="${shown.elevation}" style="width:100%">`;
  html += `<div class="tjprog">${Object.keys(PITCH_PROGRAMS).map(key => `<button data-a="tjprog" data-id="${key}" class="${plan && plan.program == key ? 'on' : ''}" title="${PITCH_PROGRAMS[key].description}"${fido ? '' : ' disabled'}>${PITCH_PROGRAMS[key].name.toUpperCase()}</button>`).join('')}</div>`;
  html += `<div class="m">${fido ? PITCH_PROGRAMS[shown.program].description : 'Pitch programs need a Flight Dynamics Officer (Crew desk).'}</div>`;
  const preview = plannedFlight();
  if (preview && preview.flattestAim != null && fido) {
    const aim = shown.aim ?? preview.flattestAim;
    html += `<div class="r"><span class="d">Upper stage aim, above the horizon</span><b id="tj-aim">${aim}°</b></div>`
      + `<input type="range" data-tj="aim" min="${preview.flattestAim}" max="${AIM_RANGE.max}" step="1" value="${aim}" style="width:100%">`
      + `<div class="m">The guidance can hold ${preview.flattestAim}° at the flattest. Steeper climbs higher; flatter builds speed for orbit.</div>`;
  }
  if (preview) {
    const spread = preview.uncertainty;
    html += `<div class="ct">PREDICTION <span class="d">· ±${Math.round(spread * 100)}%</span></div>`
      + row('Apogee', km(preview.peakAltitude))
      + row(preview.orbit ? 'Orbit' : 'Impact', preview.orbit ? 'reached' : `${km(preview.downrange)} downrange`)
      + row('Peak aero load', `${Math.round(preview.maxQ * 100)}% of limit`, loadLevel(preview.maxQ))
      + row('Peak heating', `${Math.round(preview.maxHeat * 100)}% of limit`, loadLevel(preview.maxHeat));
  } else html += '<div class="m">No rocket ready in the hangar to plan for.</div>';
  if (plan) html += '<button data-a="tjreset">FLY THE DEFAULT</button>';
  if (preview) html += teamHTML(plan);
  setHTML(panel, html);
}

// The team's section: the goal, the search's progress and the best plan found, with a button to fly it.
function teamHTML(plan) {
  if (!analysts()) return S.fac.comp ? '<div class="m">Trajectory analysts (Crew desk) can work through every candidate plan and propose the best.</div>' : '';
  const goal = teamGoal(), search = trajectoryPanel.search;
  let html = `<div class="ct">TRAJECTORY TEAM <span class="d">· ${analysts()} analyst${analysts() == 1 ? '' : 's'}</span></div>`;
  html += `<div class="tjprog">${Object.keys(TRAJECTORY_GOALS).filter(key => key != 'orbit' || canTryOrbit()).map(key => `<button data-a="tjgoal" data-id="${key}" class="${goal == key ? 'on' : ''}">${TRAJECTORY_GOALS[key].name.toUpperCase()}</button>`).join('')}</div>`;
  if (!S.crew.fido) return html + '<div class="m">The analysts work for FIDO: put a Flight Dynamics Officer back on console.</div>';
  html += `<div class="m">Searching for ${TRAJECTORY_GOALS[goal].describe}: <b id="tjworked">${search ? search.worked : 0}</b> of ${search ? search.total : '…'} candidate plans worked.</div>`;
  const best = search && search.best;
  if (!best) return html;
  const preview = best.preview;
  html += row('Best found', planWords(best.plan))
    + row('Apogee', km(preview.peakAltitude))
    + row(preview.orbit ? 'Orbit' : 'Impact', preview.orbit ? 'reached' : `${km(preview.downrange)} downrange`)
    + row('Peak loads', `${Math.round(Math.max(preview.maxQ, preview.maxHeat) * 100)}% of limit`, loadLevel(Math.max(preview.maxQ, preview.maxHeat)));
  if (best.score < 0) html += '<div class="m bad">Every plan worked so far pushes the airframe past 85% of a limit; this is the gentlest.</div>';
  return html + (samePlan(plan, best.plan) ? '<div class="ok">Flying the team\'s plan.</div>' : '<button data-a="tjbest">FLY THE TEAM\'S PLAN</button>');
}
