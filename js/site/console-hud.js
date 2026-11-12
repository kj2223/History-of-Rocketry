// MISSION CONTROL'S PANELS AS HTML (v0.8, era interface step 2): your decision panel under the gallery, the clocks strip
// on the front wall and the flight-plan rack down the left wall. They were drawn onto the canvas, out of reach of a
// stylesheet; now style.css dresses them for the era (body[data-era]). The canvas keeps the room, the screens and the
// people. The panel is built from the same model the canvas used (consolePanelModel) and its buttons call the same
// actions (CONTROL_ACTS), so every call is made exactly as before.
import { consolePanelModel, flightSteps, countClock, missionClock, siteClock } from './draw.js';
import { CONTROL_ACTS } from '../scenes/control.js';
import { trace } from './playtest.js';

const $ = id => document.getElementById(id);
const esc = t =>
  String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Each piece is rebuilt only when what it shows changes, so a button keeps its hover and focus between frames.
const shown = { panel: '', clocks: '', steps: '' };
function put(id, html) {
  if (shown[id] === html) return;
  shown[id] = html;
  $(`mc-${id}`).innerHTML = html;
}

function panelHtml(g) {
  const P = consolePanelModel(g.console, g);
  const lines = P.lines
    .slice(0, 9)
    .map(l => `<li>${esc(l)}</li>`)
    .join('');
  const buttons = P.buttons
    .map(
      (b, i) =>
        `<button class="lamp-btn ${b.tone || ''}" data-act="${esc(b.act)}" data-id="${esc(b.id ?? '')}" data-key="${i + 1}">${esc(b.label)}</button>`,
    )
    .join('');
  return `<div class="mc-plate">YOUR CONSOLE</div>
    <div class="mc-clock nixie">${esc(P.clock)}</div>
    ${P.state ? `<div class="mc-state${P.ask ? ' ask' : ''}">${esc(P.state)}</div>` : ''}
    ${P.ask ? `<p class="mc-ask">${esc(P.ask)}</p>` : ''}
    <ul class="mc-lines">${lines}</ul>
    <div class="mc-buttons">${buttons}</div>`;
}

function clocksHtml(g) {
  const c = g.console;
  return [
    ['COUNT', countClock(c) || '—'],
    ['MISSION', missionClock(c)],
    ['SITE', siteClock(g)],
  ]
    .map(([label, text]) => `<div class="mc-dial"><span class="nixie">${esc(text)}</span><b>${label}</b></div>`)
    .join('');
}

function stepsHtml(g) {
  const plan = flightSteps(g.console);
  if (!plan) return '';
  return plan.steps
    .map((st, i) => {
      const now = i === plan.at,
        cls = now ? 'now' : i < plan.at ? 'done' : '';
      const sub = now && plan.sub ? `<small>${esc(plan.sub)}</small>` : '';
      return `<li class="${cls}"><span>${esc(st)}</span>${sub}</li>`;
    })
    .join('');
}

// Called every frame from main.js. on: Mission Control is the scene on screen.
export function consoleHud(g, on) {
  const live = on && !!g.console;
  for (const id of ['panel', 'clocks', 'steps']) $(`mc-${id}`).hidden = !live;
  if (!live) return;
  put('panel', panelHtml(g));
  put('clocks', clocksHtml(g));
  const steps = stepsHtml(g);
  put('steps', steps);
  $('mc-steps').classList.toggle('idle', !steps);
}

// A click on one of your calls, as the canvas click did it: traced for the playtest log, then the room's own action.
export function bindConsoleHud() {
  $('mc-panel').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act,
      id = b.dataset.id === '' ? null : b.dataset.id;
    trace('hit', { act, id, live: !!CONTROL_ACTS[act], from: 'panel' });
    CONTROL_ACTS[act]?.(id);
  });
}

// F1-F4 make your calls, top to bottom: the terminal era prints the keys on its buttons, and they work in every era.
// (1, 2 and 3 stay the game speeds.)
export function consoleKey(e) {
  const m = /^F([1-4])$/.exec(e.key);
  if (!m || document.getElementById('mc-panel').hidden) return false;
  const b = document.querySelector(`#mc-panel button[data-key="${m[1]}"]`);
  e.preventDefault();
  b?.click();
  return true;
}
