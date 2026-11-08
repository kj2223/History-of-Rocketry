// THE SITE PROTOTYPE: the frame loop, the mouse and keys, and the bar along the top.
// Click the ground to walk, a building to go in, a person to talk to. A/D or the arrow keys walk; the wheel, dragging the
// site, or Shift with A/D or the arrow keys looks along it.
import { drawSite, drawTracking, drawControlRoom, controlButtonAt, PLACES, VIEW_H, GROUND } from './draw.js';
import { g, newGame, roundIndexOf, tick, updateCamera, you, walk, say, endDay, rideOut, dateText, clockText, checkpoint, checkCheckpoint, clearNotes, placeName } from '../game.js';
import { consoleLocked } from '../mercury.js';
import { CONTROL_ACTS } from '../scenes/control.js';
import { talk } from '../data/talk.js';
import { SEASON } from '../data/campaign.js';
import { writeSave, readSave, startOver, readBackup, swapBackup } from '../core/save.js';
import { render as renderRoom, live as liveRoom, openRoom, closeRoom, bindRoom, openWhenReady, openGameRoom } from '../scenes/rooms.js';

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
const locked = () => flying() || g.truck.follow || g.fading || g.count || g.room === 'recovery' || g.room === 'splash' || consoleLocked();

function goTo(x, then) {
  if (locked()) return;
  g.room = null;
  walk('you', x);
  g.marker = x;
  g.pending = then || null;
  g.cam.freeUntil = 0;
}

canvas.addEventListener('click', e => {
  if (drag?.moved) { drag = null; canvas.style.cursor = 'default'; return; } // the end of a drag, not a click
  drag = null;
  // In launch control the buttons are drawn on the room itself; they are the only things to click. The canvas is
  // device-pixel scaled, so the click is brought into the same coordinates the painter drew with.
  if (g.room === 'console') {
    const ratio = window.devicePixelRatio || 1;
    const hit = controlButtonAt(g, e.offsetX * ratio, e.offsetY * ratio);
    if (hit && CONTROL_ACTS[hit.act]) CONTROL_ACTS[hit.act](hit.id);
    return;
  }
  if (locked()) return;
  const w = toWorld(e), p = personAt(w), pl = placeAt(w);
  if (p) return goTo(p.x + (you().x < p.x ? -14 : 14), () => { say(p.id, talk(p.id, g.beat)); });
  if (pl) {
    let [id, place] = pl;
    // At the Cape in the Mercury years the old stand and dugout are the training building, with the simulator in it.
    if (g.crewed && id === 'stand') [id, place] = ['dugout', PLACES.dugout];
    if (g.crewed && id === 'truck') return goTo(g.truck.x + 45, () => say('you', 'Recovery reports come into Mercury Control.'));
    if (id === 'truck') return goTo(g.truck.x + 45, () => { g.beat === 'recovery' ? rideOut() : say('you', 'The recovery truck. Not needed yet.'); });
    if (!place.room) return goTo(place.door, () => say('you', id === 'tower' ? 'The launch tower. The pad crew works here.' : 'The test stand.'));
    return goTo(place.door, () => openRoom(id));
  }
  goTo(Math.max(20, Math.min(2960, w.x)));
});
canvas.addEventListener('mousemove', e => {
  // In launch control the cursor answers to the drawn buttons, not the site.
  if (g.room === 'console') {
    const ratio = window.devicePixelRatio || 1;
    canvas.style.cursor = controlButtonAt(g, e.offsetX * ratio, e.offsetY * ratio) ? 'pointer' : 'default';
    g.hover = null; canvas.title = '';
    return;
  }
  const w = toWorld(e), p = personAt(w), pl = placeAt(w);
  g.hover = !p && pl ? { ...pl[1], name: placeName(pl[0]), x: pl[0] === 'truck' ? g.truck.x : pl[1].x } : null;
  canvas.title = p ? `${p.name}, ${p.role}` : '';
  canvas.style.cursor = p || pl ? 'pointer' : 'default';
});
// Looking along the site without walking: the wheel, dragging the site, or Shift with A/D or the arrow keys.
const look = dx => { g.cam.x = Math.max(0, Math.min(3000 - view.w / scale(), g.cam.x + dx)); g.cam.freeUntil = g.time + 4; };
canvas.addEventListener('wheel', e => { look((e.deltaY + e.deltaX) * 0.8); e.preventDefault(); }, { passive: false });
// A drag pans the site; a press that hardly moves is still a click.
let drag = null;
canvas.addEventListener('pointerdown', e => { if (e.button === 0) drag = { x: e.clientX, moved: false }; });
window.addEventListener('pointermove', e => {
  if (!drag || !(e.buttons & 1)) { drag = drag && { ...drag, x: e.clientX }; return; }
  const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < 6) return;
  drag.moved = true; drag.x = e.clientX;
  look(-dx / scale());
  canvas.style.cursor = 'grabbing';
});
window.addEventListener('pointerup', () => { if (drag && !drag.moved) drag = null; });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.key] = true;
  if (e.key === 'Escape') { if (!$('notebook').hidden) $('notebook').hidden = true; else closeRoom(); }
  if (e.key === ' ') { g.paused = !g.paused; e.preventDefault(); }
  if (e.key === '1') g.speed = 1;
  if (e.key === '2') g.speed = 4;
  if (e.key === '3') g.speed = 16;
  if (e.key === 'n' || e.key === 'N') toggleNotebook();
  if (e.key === 'e' || e.key === 'E') {
    if (g.crewed && Math.abs(PLACES.stand.door - you().x) < 60 && !locked()) return openRoom('dugout'); const pl = Object.entries(PLACES).find(([, p]) => Math.abs(p.door - you().x) < 40 && p.room); if (pl && !locked()) openRoom(pl[0]); }
});
window.addEventListener('keyup', e => { keys[e.key] = keys[e.key.toLowerCase()] = keys[e.key.toUpperCase()] = false; });

function keyWalk() {
  if (locked()) return;
  const left = keys.a || keys.A || keys.ArrowLeft, right = keys.d || keys.D || keys.ArrowRight;
  if ((left || right) && keys.Shift) return look(right ? 14 : -14);
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
  if (b.id === 'game') openGameMenu();
});
function openGameMenu() { if (g.room === 'game') { g.room = null; return; } openGameRoom(); }
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
  $('loop').classList.toggle('in-room', g.room === 'console' && !!g.console && !(g.flight && g.flight.view === 'board')); // on the wall's loop board, clear of the map
  const loop = g.loop.slice(-4);
  $('loop').innerHTML = loop.map(l => `<div class="${l.tone}"><span>${l.at}</span> <b>${l.who}:</b> ${l.text.replace(/[&<>]/g, '')}</div>`).join('');
}

// The game menu: start again from 1945, keeping the game you were playing as the backup, or go back to the backup.
const where = c => `${cap(SEASON[roundIndexOf(c)].name)}, ${dateText(c.day)}`;
const cap = s => s[0].toUpperCase() + s.slice(1);
const fresh = () => { $('notebook').hidden = true; savedVersion = -1; };
bindRoom({
  again: () => { startOver(localStorage); newGame(); fresh(); },
  backup: () => { const c = readBackup(localStorage, checkCheckpoint); return c ? where(c) : null; },
  restore: () => { if (!swapBackup(localStorage)) return; const c = readSave(localStorage, checkCheckpoint); if (c) newGame(c.seed, c); else newGame(); fresh(); },
});

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
  // One bad frame must not kill the loop (a shape-valid save could throw in a room render); report and carry on.
  try {
    keyWalk();
    tick(dt);
    openWhenReady(!!locked());
    updateCamera(view.w / scale(), dt);
    if (g.flight && g.flight.view === 'board') drawTracking(ctx, g, view);
    else if (g.room === 'console' && g.console) drawControlRoom(ctx, g, view);
    else drawSite(ctx, g, view);
    renderRoom(); liveRoom(); hud(); autosave();
  } catch (e) { console.error('Frame skipped:', e); }
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
