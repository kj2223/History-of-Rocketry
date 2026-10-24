// THE BASE desk: a drawn plan of the launch site with a plot for every building, the selected plot's card, the construction
// line and the buildings ready to order. Clicking a plot selects it (siteView.selected); one click on a BUILD button orders.
import { formatMoney } from '../core/util.js';
import { FACILITIES, CONTROL_ROOM_FACILITIES, ROOMS, SITE } from '../data/launch-site.js';
import { S, formatDate } from '../core/state.js';
import { facilityLock, roomLevel } from '../rules/launch-site.js';
import { siteStatus, buildDaysOf, crewsBusy, waitingOrders, upkeep, upkeepOf, mothballLock, padBusyUntil } from '../rules/site.js';
import { $, setHTML } from './dom.js';

export const siteView = { selected: 'ctrl' };

// THE PLOTS on the plan (a 640 by 360 drawing, the Atlantic to the east): x, y, width, height and a short label.
// 'ctrl' is the control centre, one building that grows through the control-room upgrades.
const PLOTS = {
  ctrl: [286, 150, 116, 46, 'CONTROL CENTRE'],
  trknet: [70, 16, 100, 26, 'WORLD NETWORK'],
  wx: [300, 64, 44, 24, 'WX'], radar: [356, 56, 54, 28, 'RADAR'], recov: [410, 300, 50, 24, 'HELO PAD'], ship: [566, 292, 54, 22, 'SHIP'],
  jigs: [96, 118, 64, 30, 'JIGS'], nc: [96, 160, 64, 30, 'NC SHOP'], clean: [172, 118, 72, 30, 'CLEAN ROOM'], stand: [172, 160, 72, 30, 'TEST STAND'],
  centrifuge: [96, 238, 70, 28, 'CENTRIFUGE'], ptrain: [174, 238, 70, 28, 'TRAINER'], msim: [252, 238, 70, 28, 'SIMULATOR'], egress: [252, 280, 70, 26, 'EGRESS TANK'],
  zerog: [96, 318, 226, 16, 'ZERO-G AIRCRAFT · SKID STRIP'],
  lc12: [478, 96, 52, 28, 'LC-12'], lc14: [500, 150, 52, 28, 'LC-14'],
};
// Areas of the plan, drawn as labels: [x, y, text].
const AREAS = [[96, 108, 'INDUSTRIAL AREA'], [96, 228, 'TRAINING'], [286, 140, 'OPERATIONS'], [300, 52, 'RANGE'], [470, 84, 'MISSILE ROW']];
// The range's own pads, there from the start (rockets without a launch complex of their own fly from them).
const RANGE_PADS = [[468, 214, 'LC-5/6'], [446, 258, 'LC-26']];

// A plot's look: built, building, waiting, mothballed, open (can be ordered now) or locked.
function plotState(id) {
  if (id == 'ctrl') return roomLevel() ? 'built' : 'open';
  const status = siteStatus(id);
  if (status != 'none') return status;
  return facilityLock(id) && !/^Need \$/.test(facilityLock(id)) ? 'locked' : 'open';
}
const STATE_NAMES = { built: 'In service', building: 'Under construction', waiting: 'Waiting for a crew', mothballed: 'Mothballed', open: 'Can be ordered', locked: 'Locked' };

function planSVG() {
  const plots = Object.entries(PLOTS).map(([id, [x, y, width, height, label]]) => {
    const state = plotState(id), pips = id == 'ctrl' ? CONTROL_ROOM_FACILITIES.map((each, index) => `<rect x="${x + 18 + index * 16}" y="${y + height - 12}" width="12" height="5" class="pip${S.fac[each] ? ' on' : ''}"/>`).join('') : '';
    const busy = FACILITIES[id] && FACILITIES[id].pad && padBusyUntil(id) ? ' busy' : '';
    return `<g class="plot-${state}${busy}${siteView.selected == id ? ' sel' : ''}" data-plot="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/><text x="${x + width / 2}" y="${y + (id == 'ctrl' ? 18 : height / 2 + 4)}">${label}</text>${pips}</g>`;
  }).join('');
  const rangePads = RANGE_PADS.map(([x, y, label]) => `<g class="plot-built"><circle cx="${x}" cy="${y}" r="9"/><text x="${x}" y="${y - 13}">${label}</text></g>`).join('');
  const areas = AREAS.map(([x, y, text]) => `<text x="${x}" y="${y}" class="area">${text}</text>`).join('');
  return `<svg class="site" viewBox="0 0 640 360" role="img" aria-label="Site plan">
<path class="sea" d="M470,0 C520,60 560,110 604,176 C572,226 528,284 506,360 L640,360 L640,0 Z"/>
<path class="sea" d="M0,0 L48,0 C66,120 56,240 74,360 L0,360 Z"/>
<text x="560" y="40" class="area">ATLANTIC</text><text x="10" y="200" class="area" transform="rotate(-90 22 200)">BANANA RIVER</text>
<path class="road" d="M84,214 L446,214 C474,184 494,150 514,126"/>
${areas}${rangePads}${plots}</svg>`;
}

// One building's card: what it does, its state, and what can be done with it now.
function facilityCard(id) {
  const facility = FACILITIES[id], lock = facilityLock(id), status = siteStatus(id), days = S.nasa ? buildDaysOf(id) : 0;
  const order = `${formatMoney(facility.cost)}${days ? `, ${days} days` : ''}`;
  const action = status == 'built' ? (S.nasa && !mothballLock(id) ? `<button data-a="mothball" data-id="${id}">MOTHBALL (saves ${formatMoney(upkeepOf(id))} a cycle)</button>` : '')
    : status == 'building' ? `<div class="m">In service around ${formatDate(S.fb[id])}.</div>`
    : status == 'waiting' ? `<div class="m">Paid for: construction starts when a contractor crew is free.</div>`
    : status == 'mothballed' ? `<button data-a="reopen" data-id="${id}">REOPEN (${SITE.reopenDays} days)</button>`
    : `<button data-a="fac" data-id="${id}"${lock ? ' disabled' : ''}>BUILD (${order})</button>${lock ? `<div class="m">${lock}</div>` : ''}`;
  const pad = facility.pad && padBusyUntil(id) ? ` <span class="wn">Being readied until ${formatDate(padBusyUntil(id))}.</span>` : '';
  const running = S.nasa && status == 'built' ? ` Upkeep ${formatMoney(upkeepOf(id))} a cycle.` : '';
  return `<div class="c"><div class="r"><b>${facility.name}</b><span class="${status == 'built' ? 'ok' : status == 'none' ? 'd' : 'wn'}">${STATE_NAMES[plotState(id)]}</span></div><div class="m">${facility.description}${facility.consoles ? ` +${facility.consoles} console${facility.consoles > 1 ? 's' : ''}.` : ''}${running}${pad}</div>${action}</div>`;
}
const selectedHTML = () => {
  const id = siteView.selected;
  if (id == 'ctrl') return `<div class="t">${ROOMS[roomLevel()].name.toUpperCase()}</div><div class="m">${ROOMS[roomLevel()].description} Each upgrade adds consoles for the launch crew.</div>` + CONTROL_ROOM_FACILITIES.map(facilityCard).join('');
  if (FACILITIES[id]) return facilityCard(id);
  return '<div class="m">Click a plot on the plan to see the building.</div>';
};
// The contractor crews' work and the site's running cost (NASA only), then the buildings that can be ordered now.
function constructionHTML() {
  const building = Object.keys(S.fb || {}), waiting = waitingOrders();
  const line = S.nasa ? `<div class="c"><div class="r"><b>CONSTRUCTION</b><span class="d">${crewsBusy()} / ${SITE.contractorCrews} contractor crews at work</span></div>`
    + building.map(id => `<div class="r"><span>${FACILITIES[id].name}</span><span class="wn">in service ${formatDate(S.fb[id])}</span></div>`).join('')
    + waiting.map((id, index) => `<div class="r"><span class="d">${index + 1}. ${FACILITIES[id].name}</span><span class="d">waiting</span></div>`).join('')
    + `<div class="r"><span class="d">Site upkeep</span><b>${formatMoney(upkeep())} a cycle</b></div><div class="m">From NASA's founding every building takes time to put up and costs upkeep. Mothball one to stop its upkeep (and its effect).</div></div>` : '';
  const ready = Object.keys(FACILITIES).filter(id => plotState(id) == 'open');
  return line + (ready.length ? `<div class="t" style="margin-top:8px">READY TO ORDER</div><div class="areas">${ready.map(facilityCard).join('')}</div>` : '');
}
export function renderFacilities() {
  setHTML($('#fc'), `<div class="t">${S.nasa ? 'CAPE CANAVERAL' : 'THE RANGE'}</div><div class="site-grid"><div>${planSVG()}<div class="site-key">${Object.entries(STATE_NAMES).map(([state, name]) => `<span class="plot-${state}"><i></i>${name}</span>`).join('')}</div></div><div>${selectedHTML()}</div></div>${constructionHTML()}`);
}
