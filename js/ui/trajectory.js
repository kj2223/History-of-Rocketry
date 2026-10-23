// THE TRAJECTORY PANEL: pops out from the plotting board. FIDO's plan for the next flight: the launcher's elevation and the
// pitch program, with the predicted apogee, impact distance and loads. The board draws the predicted arc (ui/plot.js).
// It opens once the room has a Plotting Board; pitch programs need a Flight Dynamics Officer. Without a plan
// (launchForm.plan null) the rocket flies the default, as it always has.
import { PITCH_PROGRAMS, ELEVATION_RANGE } from '../data/launch.js';
import { S } from '../core/state.js';
import { roomLevel } from '../rules/launch-site.js';
import { airborne, previewFlight } from '../rules/flight.js';
import { launchForm } from './launch-panel.js';
import { $, setHTML } from './dom.js';

export const trajectoryPanel = { open: false };
const PLAN_FROM_LEVEL = 2; // the Plotting Board facility
const DEFAULT_ELEVATION = 81; // the default rail lean (0.15 radians), to the nearest degree
export const planUnlocked = () => roomLevel() >= PLAN_FROM_LEVEL;
// The plan the panel's controls start from: the one set, or the default written out.
export const currentPlan = () => launchForm.plan || { elevation: DEFAULT_ELEVATION, program: 'standard' };

// The flight the launch form would make, as the engineers predict it (rules/flight.js previewFlight), or null with no rocket ready.
export function plannedFlight() {
  const airframe = S.air.find(candidate => candidate.id == launchForm.af && candidate.st == 'r');
  return airframe ? previewFlight(airframe, launchForm.fuel, launchForm.pay, launchForm.st, launchForm.load / 100, 0, launchForm.plan) : null;
}

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
  html += `<div class="r"><span class="d">Launcher elevation</span><b id="tjv">${shown.elevation}°</b></div>`
    + `<input type="range" data-tj="elevation" min="${ELEVATION_RANGE.min}" max="${ELEVATION_RANGE.max}" step="1" value="${shown.elevation}" style="width:100%">`;
  html += `<div class="tjprog">${Object.keys(PITCH_PROGRAMS).map(key => `<button data-a="tjprog" data-id="${key}" class="${plan && plan.program == key ? 'on' : ''}" title="${PITCH_PROGRAMS[key].description}"${fido ? '' : ' disabled'}>${PITCH_PROGRAMS[key].name.toUpperCase()}</button>`).join('')}</div>`;
  html += `<div class="m">${fido ? PITCH_PROGRAMS[shown.program].description : 'Pitch programs need a Flight Dynamics Officer (Crew desk).'}</div>`;
  const preview = plannedFlight();
  if (preview) {
    const spread = preview.uncertainty;
    html += `<div class="ct">PREDICTION <span class="d">· ±${Math.round(spread * 100)}%</span></div>`
      + row('Apogee', km(preview.peakAltitude))
      + row(preview.orbit ? 'Orbit' : 'Impact', preview.orbit ? 'reached' : `${km(preview.downrange)} downrange`)
      + row('Peak aero load', `${Math.round(preview.maxQ * 100)}% of limit`, loadLevel(preview.maxQ))
      + row('Peak heating', `${Math.round(preview.maxHeat * 100)}% of limit`, loadLevel(preview.maxHeat));
  } else html += '<div class="m">No rocket ready in the hangar to plan for.</div>';
  if (plan) html += '<button data-a="tjreset">FLY THE DEFAULT</button>';
  setHTML(panel, html);
}
