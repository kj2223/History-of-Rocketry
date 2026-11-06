// THE SITE PROTOTYPE: the frame loop, the mouse and keys, and the bar along the top.
// Click the ground to walk, a building to go in, a person to talk to. A/D or the arrow keys walk; the wheel looks along the site.
import { drawSite, drawTracking, PLACES, VIEW_H, GROUND } from './draw.js';
import { g, newGame, tick, updateCamera, you, walk, say, endDay, rideOut, dateText, clockText, checkpoint, checkCheckpoint, clearNotes } from '../game.js';
import { talk } from '../data/talk.js';
import { writeSave, readSave, clearSave } from '../core/save.js';
import { render as renderRoom, live as liveRoom, openRoom, closeRoom, bindRoom } from '../scenes/rooms.js';

const canvas = document.getElementById('site'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
let view = { w: 0, h: 0 }, keys = {};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  view = { w: canvas.clientWidth * ratio, h: canvas.clientHeight * ratio };
  canvas.width = view.w; canvas.height = view.h;
}
window.addEventListener('resize', resize);

const scale = () => view.h / VIEW_H;
const toWorld = e => {
  const ratio = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * ratio) / scale() + g.cam.x, y: ((e.clientY - r.top) * ratio) / scale() };
};
const personAt = ({ x, y }) => Object.values(g.people).find(p => !p.hidden && p.id !== 'you' && Math.abs(p.x - x) < 9 && y > GROUND - 40 && y < GROUND + 4);
const placeAt = ({ x, y }) => Object.entries(PLACES).find(([id, p]) => {
  const left = id === 'truck' ? g.truck.x : p.x;
  return x >= left && x <= left + p.w && y >= GROUND - p.h - 20 && y <= GROUND + 34;
});
const flying = () => g.flight && (g.flight.view === 'site' || g.flight.view === 'board');
const locked = () => flying() || g.truck.follow || g.fading || g.count || g.room === 'recovery';

function goTo(x, then) {
  if (locked()) return;
  g.room = null;
  walk('you', x);
  g.marker = x;
  g.pending = then || null;
  g.cam.freeUntil = 0;
}

canvas.addEventListener('click', e => {
  if (locked()) return;
  const w = toWorld(e), p = personAt(w), pl = placeAt(w);
  if (p) return goTo(p.x + (you().x < p.x ? -14 : 14), () => { say(p.id, talk(p.id, g.beat)); });
  if (pl) {
    const [id, place] = pl;
    if (id === 'truck') return goTo(g.truck.x + 45, () => { g.beat === 'recovery' ? rideOut() : say('you', 'The recovery truck. Not needed yet.'); });
    if (!place.room) return goTo(place.door, () => say('you', id === 'tower' ? 'The launch tower. The pad crew works here.' : 'The test stand.'));
    return goTo(place.door, () => openRoom(id));
  }
  goTo(Math.max(20, Math.min(2960, w.x)));
});
canvas.addEventListener('mousemove', e => {
  const w = toWorld(e), p = personAt(w), pl = placeAt(w);
  g.hover = !p && pl ? { ...pl[1], x: pl[0] === 'truck' ? g.truck.x : pl[1].x } : null;
  canvas.title = p ? `${p.name}, ${p.role}` : '';
  canvas.style.cursor = p || pl ? 'pointer' : 'default';
});
canvas.addEventListener('wheel', e => {
  g.cam.x = Math.max(0, Math.min(3000 - view.w / scale(), g.cam.x + (e.deltaY + e.deltaX) * 0.8));
  g.cam.freeUntil = g.time + 4;
  e.preventDefault();
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.key] = true;
  if (e.key === 'Escape') { if (!$('notebook').hidden) $('notebook').hidden = true; else closeRoom(); }
  if (e.key === ' ') { g.paused = !g.paused; e.preventDefault(); }
  if (e.key === '1') g.speed = 1;
  if (e.key === '2') g.speed = 4;
  if (e.key === '3') g.speed = 16;
  if (e.key === 'n' || e.key === 'N') toggleNotebook();
  if (e.key === 'e' || e.key === 'E') { const pl = Object.entries(PLACES).find(([, p]) => Math.abs(p.door - you().x) < 40 && p.room); if (pl && !locked()) openRoom(pl[0]); }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

function keyWalk() {
  if (locked()) return;
  const left = keys.a || keys.A || keys.ArrowLeft, right = keys.d || keys.D || keys.ArrowRight;
  if (left || right) { g.room = null; g.pending = null; g.marker = null; walk('you', Math.max(20, Math.min(2960, you().x + (right ? 40 : -40)))); }
}

// The bar along the top.
document.querySelector('header').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.speed) { g.speed = Number(b.dataset.speed); g.paused = false; }
  if (b.id === 'pause') g.paused = !g.paused;
  if (b.id === 'endday') endDay();
  if (b.id === 'notes') toggleNotebook();
});
function toggleNotebook() {
  const nb = $('notebook');
  nb.hidden = !nb.hidden;
  if (!nb.hidden) showNotebook();
}
// This round's notes, with the earlier rounds' folded away behind a count and a button to clear them.
function showNotebook() {
  const nb = $('notebook'), esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const now = g.notes.filter(n => n.round === g.roundIndex), earlier = g.notes.length - now.length;
  const list = notes => `<ol>${notes.map(n => `<li><span>${n.at}</span> ${esc(n.text)}</li>`).join('')}</ol>`;
  nb.innerHTML = `<h2>Your notebook</h2>
    ${earlier ? `<p><button data-nb="clear">Clear earlier rounds' notes</button> <span class="muted">This round's notes stay. Your record in the office keeps how each round went.</span></p>
      <details><summary>${earlier} note${earlier === 1 ? '' : 's'} from earlier rounds</summary>${list(g.notes.filter(n => n.round !== g.roundIndex))}</details>` : ''}
    ${now.length ? list(now) : '<p class="muted">Nothing written this round yet.</p>'}
    <p class="muted">N or Esc to close.</p>`;
}
$('notebook').addEventListener('click', e => {
  if (e.target.dataset.nb === 'clear') { clearNotes(); showNotebook(); }
});
function hud() {
  $('date').textContent = `${dateText()} · ${clockText()}`;
  $('objective').textContent = g.objective;
  $('endday').hidden = !g.dayDone;
  $('pause').textContent = g.paused ? '▶' : '❚❚';
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === g.speed && !g.paused));
  $('notes').textContent = `Notebook (${g.notes.length})`;
  $('loop').hidden = g.flight?.view === 'board'; // the range plot shows the calls itself
  const loop = g.loop.slice(-4);
  $('loop').innerHTML = loop.map(l => `<div class="${l.tone}"><span>${l.at}</span> <b>${l.who}:</b> ${l.text.replace(/[&<>]/g, '')}</div>`).join('');
}

bindRoom({ again: () => { clearSave(localStorage); newGame(); $('notebook').hidden = true; } });

// Save each checkpoint as it is made: every work morning, and each round's outcome.
let savedVersion = -1;
function autosave() {
  if (g.savedVersion === savedVersion) return;
  savedVersion = g.savedVersion;
  try { writeSave(localStorage, checkpoint()); } catch { /* storage full or blocked: play on unsaved */ }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  keyWalk();
  tick(dt);
  updateCamera(view.w / scale(), dt);
  if (g.flight && g.flight.view === 'board') drawTracking(ctx, g, view);
  else drawSite(ctx, g, view);
  renderRoom(); liveRoom(); hud(); autosave();
  requestAnimationFrame(frame);
}

// ?seed=123 replays the same round, for comparing notes. Otherwise carry on from the saved morning, if there is one.
const seed = Number(new URLSearchParams(location.search).get('seed')) || undefined;
const saved = seed ? null : readSave(localStorage, checkCheckpoint);
if (saved) newGame(saved.seed, saved); else newGame(seed);
resize();
// A test hook: lets an automated check read and drive the prototype. Harmless in play.
window.__site = { get g() { return g; } };
requestAnimationFrame(frame);
