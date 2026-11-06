// THE ROOMS: what the player sees and does inside a building, as a panel over the site. The site keeps going behind it.
// render() rebuilds a panel when the game says the room changed; live() updates its gauges every frame.
import { g, lookAt, finishInspection, setLoad, finishBoard, standStart, standHold, standLeakCheck, standTank, standDecide,
  countStart, countTank, countAnswer, countHold, countResume, countLeakCheck, NORMAL_TANK, returnFromRecovery, present, debrief, roomFor, dateText, clockText } from './game.js';
import { SPOTS, EXPLANATIONS } from './truth.js';
import { PLACES } from './draw.js';

const panel = () => document.getElementById('room');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let shown = { room: null, version: -1 }, flags = {};

export function openRoom(building) {
  g.room = building === 'truck' && roomFor('truck') !== 'recovery' ? null : roomFor(building) === 'watch' ? `watch:${building}` : roomFor(building);
  if (building === 'blockhouse' && g.room === 'count' && !g.count) countStart();
  if (g.room === 'count' || g.room === 'static') g.speed = 1;
}
export function closeRoom() {
  if (['recovery', 'debrief'].includes(g.room)) return; // these close through their own buttons
  g.room = null;
}

export function render() {
  const el = panel();
  if (!g.room) { el.hidden = true; shown.room = null; return; }
  if (shown.room === g.room && shown.version === g.roomVersion) return;
  shown = { room: g.room, version: g.roomVersion };
  el.hidden = false;
  const [kind, building] = g.room.split(':');
  const body = kind === 'watch' ? watch(building) : ROOMS[kind]();
  const closable = !['recovery', 'debrief'].includes(kind);
  el.innerHTML = `${closable ? '<button class="close" data-act="close" title="Back to the site (Esc)">✕</button>' : ''}${body}`;
}

// Gauges and traces that move every frame.
export function live() {
  if (!g.room) return;
  const set = (sel, v) => { const n = panel().querySelector(sel); if (n) n.textContent = v; };
  if (g.room === 'static' && g.stand) {
    const s = g.stand;
    set('[data-live=standclock]', s.phase === 'count' ? `T-${Math.ceil(s.clock)}` : s.phase === 'firing' ? 'FIRING' : s.phase === 'held' ? 'HOLD' : s.phase === 'leakcheck' ? 'CREW ON STAND' : s.phase === 'ready' ? 'READY' : 'SHUT DOWN');
    const tank = s.phase === 'firing' || s.phase === 'read' ? s.trace[Math.max(0, Math.floor(s.shown) - 1)].tank : standTank();
    gauge('tank', tank, 0, 30, NORMAL_TANK);
    const pc = s.trace && s.shown > 0 ? s.trace[Math.max(0, Math.floor(s.shown) - 1)].pc : 0;
    gauge('pc', pc, 0, 30, [17, 23]);
    if (s.trace) drawTrace(panel().querySelector('canvas'), s.trace, Math.floor(s.shown));
  }
  if (g.room === 'count' && g.count) {
    const c = g.count;
    set('[data-live=countclock]', `T-${fmtCount(c.clock)}`);
    set('[data-live=countstate]', c.checking ? 'HOLD: pad crew checking' : c.poll ? 'Waiting for your call' : c.held ? 'HOLDING' : 'Counting');
    gauge('ctank', countTank(), 0, 30, NORMAL_TANK);
  }
}
const fmtCount = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

function gauge(id, value, min, max, normal) {
  const n = panel().querySelector(`[data-gauge=${id}]`);
  if (!n) return;
  n.querySelector('.needle').style.transform = `rotate(${-120 + 240 * (value - min) / (max - min)}deg)`;
  n.querySelector('.read').textContent = value.toFixed(1);
  const band = n.querySelector('.band');
  if (band && !band.dataset.done) {
    band.dataset.done = 1;
    const a = -120 + 240 * (normal[0] - min) / (max - min), b = -120 + 240 * (normal[1] - min) / (max - min);
    band.style.background = `conic-gradient(from ${a}deg, rgba(110,200,120,.55) 0deg ${b - a}deg, transparent ${b - a}deg)`;
  }
}
const gaugeHTML = (id, label, unit) => `<div class="gauge" data-gauge="${id}"><div class="dial"><div class="band"></div><div class="needle"></div></div><div class="read">0.0</div><div class="lab">${label} (${unit})</div></div>`;

function drawTrace(canvas, trace, upto) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, y = v => h - 8 - (v / 30) * (h - 16), x = t => 8 + (t / 8) * (w - 16);
  ctx.fillStyle = '#f6f1e2'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d6cdb5'; ctx.lineWidth = 1;
  for (let v = 0; v <= 30; v += 5) { ctx.beginPath(); ctx.moveTo(8, y(v)); ctx.lineTo(w - 8, y(v)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(110,200,120,.18)'; ctx.fillRect(8, y(23), w - 16, y(17) - y(23));
  const line = (key, color) => { ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); trace.slice(0, upto).forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p[key])) : ctx.moveTo(x(p.t), y(p[key])))); ctx.stroke(); };
  line('tank', '#4b6a8a'); line('pc', '#a3321f');
  ctx.fillStyle = '#5b5345'; ctx.font = '11px Georgia, serif'; ctx.fillText('red: chamber pressure · blue: tank pressure · green band: chamber normal', 10, 14);
}

function watch(building) {
  const place = PLACES[building];
  const here = Object.values(g.people).filter(p => !p.hidden && Math.abs(p.x - place.door) < place.w / 2 + 40 && p.id !== 'you');
  const busy = g.jobs.filter(j => Math.abs(j.at - place.door) < place.w / 2 + 60).map(j => j.label);
  return `<h2>${esc(place.name)}</h2><p class="muted">Nothing here needs you right now. You can watch.</p>
    ${busy.length ? `<p>Going on here: ${busy.map(esc).join(', ')}.</p>` : ''}
    ${here.length ? `<p>Here: ${here.map(p => `${esc(p.name)} (${esc(p.role)})`).join(', ')}.</p>` : '<p>Nobody is here.</p>'}
    <p class="muted">What you need to do next: ${esc(g.objective)}</p>`;
}

const ROOMS = {
  inspect() {
    const rows = Object.entries(SPOTS).map(([id, s]) => {
      const seen = g.looked[id];
      return `<li><div><strong>${esc(s.name)}</strong><br><span class="${seen == null ? 'muted' : ''}">${seen == null ? 'Not looked at yet.' : esc(seen ? s.cue : s.sound)}</span></div>
        <div class="row">${seen == null ? `<button data-act="look" data-id="${id}">Look closely (15 min)</button>` : ''}
        <label><input type="checkbox" data-flag="${id}" ${flags[id] ? 'checked' : ''}> Flag it</label></div></li>`;
    }).join('');
    return `<h2>Hangar: the WAC upper stage</h2>
      <p>The stage lies on its cradle with the panels off. Kowalski hands you a torch. Look over whatever you think matters,
      and flag anything you want the crew to open up. A real fault costs the crew ${2} hours to fix; a false alarm costs ${3} hours
      of taking things apart for nothing. Anything you miss is still there.</p>
      <ul class="spots">${rows}</ul>
      <button class="primary" data-act="inspect-done">Hand your list to Kowalski</button>`;
  },
  board() {
    const load = g.round.propellantLoad, e = g.round.estimate;
    return `<h2>Drawing board: propellant load</h2>
      <p>The range wants a figure for the flight. A fuller tank flies higher, but lands further out, and the range has to clear
      more ground. The drawing office's estimate has a wide spread: nobody has flown this round before.</p>
      <label class="slider">Propellant load: <strong data-live="load">${Math.round(load * 100)}%</strong>
      <input type="range" min="85" max="100" step="1" value="${Math.round(load * 100)}" data-act="load"></label>
      <p>Estimated peak: <strong data-live="estimate">${e.low}–${e.high} km</strong>.</p>
      <button class="primary" data-act="board-done">Sign the figure and send it to the range</button>`;
  },
  static() {
    const s = g.stand, p = s.phase;
    const buttons = {
      ready: `<button class="primary" data-act="stand-start">Start the firing count</button><button data-act="stand-leak">Send the crew to leak-check first (2 h)</button>`,
      count: `<button class="danger" data-act="stand-hold">HOLD</button>`,
      held: `<button class="primary" data-act="stand-start">Resume the count</button><button data-act="stand-leak">Send the crew to leak-check (2 h)</button>`,
      leakcheck: '<p class="muted">The crew is on the stand checking every line. Watch them through the slit, or wait.</p>',
      firing: '<p class="muted">Firing…</p>',
      read: `<p>Read the trace. What do you want done before this stage flies?</p>
        <label><input type="checkbox" data-choice="rework"> Rework the igniter (8 hours: the launch slips a day)</label>
        <label><input type="checkbox" data-choice="leak"> Leak-check the feed system (2 hours)</label>
        <button class="primary" data-act="stand-decide">Give your decision to Ellis</button>`,
      decided: '<p class="muted">Done. The crew is taking the stage back to the hangar.</p>',
    }[p];
    return `<h2>Test stand dugout</h2>
      <p>Through the slit you can see the stage in the stand. You're running this one. Watch the tank pressure while the stage is
      pressurised, hold if it looks wrong, then fire, and read the trace afterwards.</p>
      <div class="clock" data-live="standclock">—</div>
      <div class="gauges">${gaugeHTML('tank', 'Tank pressure', 'bar')}${gaugeHTML('pc', 'Chamber pressure', 'bar')}</div>
      <p class="muted">Tank pressure normal: ${NORMAL_TANK[0]}–${NORMAL_TANK[1]} bar. Chamber pressure normal: 17–23 bar.</p>
      ${s.trace ? '<canvas width="400" height="150"></canvas>' : ''}
      <div class="actions">${buttons}</div>`;
  },
  count() {
    const c = g.count;
    if (!c) return '<h2>Blockhouse</h2><p class="muted">The count is over.</p>';
    const pollButtons = c.poll ? `<div class="poll"><p><strong>${c.poll === 'final' ? 'Final poll.' : 'Poll.'}</strong> Ellis wants your tank pressure. Read the gauge, then make your call.</p>
      <button class="go" data-act="go">GO</button><button class="danger" data-act="nogo">NO-GO: hold</button></div>` : '';
    const holdButtons = c.checking ? '<p class="muted">The pad crew is out at the tower. The count recycles when they are back inside.</p>'
      : c.held && !c.poll ? `<button class="primary" data-act="resume">Resume the count</button><button data-act="count-leak">Send the pad crew to look for a leak</button>`
      : !c.poll ? '<button class="danger" data-act="hold">HOLD</button>' : '';
    return `<h2>Blockhouse: the count</h2>
      <p>You're on the pressurisation panel (PRESS). Ellis runs the count; Vega has the firing switch.
      You can call a hold at any time.</p>
      <div class="clock" data-live="countclock">T-10:00</div><p class="center" data-live="countstate"></p>
      <div class="gauges">${gaugeHTML('ctank', 'Tank pressure', 'bar')}<div class="lamp on">IGNITER CIRCUIT<br>CONTINUITY</div></div>
      <p class="muted">Normal tank pressure: ${NORMAL_TANK[0]}–${NORMAL_TANK[1]} bar.</p>
      ${pollButtons}<div class="actions">${holdButtons}</div>`;
  },
  recovery() {
    return `<h2>The impact area</h2><p>${dateText()}, ${clockText()}. The truck pulls up in the scrub. You walk over with Morgan and Kowalski.</p>
      <ul>${g.recovery.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="muted">All of this is in your notebook.</p>
      <button class="primary" data-act="back">Drive back to the site</button>`;
  },
  review() {
    return `<h2>Review with Ellis</h2>
      <p>Ellis and Morgan are at the table with the range plot pinned up. "Well? What happened to her?"</p>
      <p class="muted">Your notebook has everything you saw. Open it with N or the button at the top.</p>
      <div class="choices">${Object.entries(EXPLANATIONS).map(([k, t]) => `<button data-act="present" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
  },
  debrief() {
    const d = debrief();
    return `<h2>Prototype debrief</h2>
      <p class="muted">This page is for testing the prototype. It shows the hidden truth the game would never show you.</p>
      <p><strong>The flight:</strong> ${esc(d.outcome)} ${esc(d.dates)}</p>
      <p><strong>What was really wrong with this round at the start:</strong></p><ul>${d.faults.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <p><strong>What you and the crew did about it:</strong></p><ul>${d.caught.length ? d.caught.map(f => `<li>${esc(f)}</li>`).join('') : '<li>Nothing was changed.</li>'}</ul>
      ${d.stillThere.length ? `<p><strong>Still on the round when it flew:</strong> ${esc(d.stillThere.join(', '))}.</p>` : '<p>The round flew with nothing left wrong on it.</p>'}
      <p><strong>At the review</strong> Ellis ${d.review.agree ? 'agreed with you' : 'overruled you'}.</p>
      <p>Did it click? Was it clear what to do, and did your calls feel like they mattered? Tell Claude in the project.</p>
      <button class="primary" data-act="again">Play another round</button>`;
  },
};

// Clicks and changes inside the panel.
export function bindRoom(handlers) {
  const el = panel();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    ({
      close: () => closeRoom(),
      look: () => lookAt(id),
      'inspect-done': () => { finishInspection(flags); flags = {}; g.room = null; },
      'board-done': () => { finishBoard(); g.room = null; },
      'stand-start': standStart, 'stand-hold': standHold, 'stand-leak': standLeakCheck,
      'stand-decide': () => { const c = {}; el.querySelectorAll('[data-choice]').forEach(n => { c[n.dataset.choice] = n.checked; }); standDecide(c); },
      go: () => countAnswer(true), nogo: () => countAnswer(false), hold: countHold, resume: countResume, 'count-leak': countLeakCheck,
      back: () => returnFromRecovery(),
      present: () => present(id),
      again: () => handlers.again(),
    })[act]?.();
  });
  el.addEventListener('change', e => {
    if (e.target.dataset.flag) flags[e.target.dataset.flag] = e.target.checked;
  });
  el.addEventListener('input', e => {
    if (e.target.dataset.act !== 'load') return;
    setLoad(Number(e.target.value) / 100);
    el.querySelector('[data-live=load]').textContent = `${e.target.value}%`;
    el.querySelector('[data-live=estimate]').textContent = `${g.round.estimate.low}–${g.round.estimate.high} km`;
  });
}
