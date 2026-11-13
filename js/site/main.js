// THE SITE PROTOTYPE: the frame loop, the mouse and keys, and the bar along the top.
// Click the ground to walk, a building to go in, a person to talk to. A/D or the arrow keys walk; the wheel, dragging the
// site, or Shift with A/D or the arrow keys looks along it.
import { drawSite, drawTracking, drawControlRoom, uiEra, PLACES, VIEW_H, GROUND } from './draw.js';
import { consoleHud, bindConsoleHud, consoleKey } from './console-hud.js';
import { startStage, stageFrame } from '../stage/index.js';
import { deepMode } from '../stage/deep.js';
import { soundFrame, cycleSound, soundSetting } from '../stage/fx/sound.js';

// A flight followed from a room of its own on the scene layer, or null.
const flightViewOf = g => (deepMode(g) ? 'deep' : g.room === 'splash' ? 'recovery' : null);
import { footprint, atPlace } from '../data/white-sands.js';
import {
  g,
  newGame,
  roundIndexOf,
  tick,
  updateCamera,
  you,
  walk,
  say,
  endDay,
  rideOut,
  dateText,
  clockText,
  checkpoint,
  checkCheckpoint,
  clearNotes,
  placeName,
} from '../game.js';
import { consoleLocked } from '../mercury.js';
import { CONTROL_ACTS } from '../scenes/control.js';
import { talk } from '../data/talk.js';
import { SEASON } from '../data/campaign.js';
import {
  writeSave,
  readSave,
  parseSave,
  exportSave,
  startOver,
  readBackup,
  swapBackup,
  memoryStorage,
  KEYS,
} from '../core/save.js';
import { startPlaytest, playtestFrame, trace, traceError } from './playtest.js';
import { startDevMenu, clearDevFlag } from './dev-menu.js';
import { drawInterior, interiorOf, interiorButtonAt, doorRight } from './interiors.js';
import { lookAt } from '../game.js';
import { frameSteps, MAX_STEP } from '../core/frame-steps.js';
import { albumFrame, useAlbumStorage, albumHTML } from './album.js';
import {
  render as renderRoom,
  live as liveRoom,
  openRoom,
  closeRoom,
  bindRoom,
  openWhenReady,
  openGameRoom,
} from '../scenes/rooms.js';

const canvas = document.getElementById('site'),
  ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
let view = { w: 0, h: 0 },
  keys = {};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  view = { w: canvas.clientWidth * ratio, h: canvas.clientHeight * ratio };
  canvas.width = view.w;
  canvas.height = view.h;
}
window.addEventListener('resize', resize);

const scale = () => view.h / VIEW_H;
const toWorld = e => {
  const ratio = window.devicePixelRatio || 1,
    r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * ratio) / scale() + g.cam.x, y: ((e.clientY - r.top) * ratio) / scale() };
};
const personAt = ({ x, y }) =>
  Object.values(g.people).find(
    p => !p.hidden && p.id !== 'you' && Math.abs(p.x - x) < 9 && y > GROUND - 40 && y < GROUND + 4,
  );
// The building under the pointer, by where it stands today (the new blockhouse is wider than the old one), as
// [id, footprint].
const placeAt = ({ x, y }) =>
  Object.keys(PLACES)
    .map(id => [id, footprint(id, g)])
    .find(([, p]) => x >= p.x && x <= p.x + p.w && y >= GROUND - p.h - 20 && y <= GROUND + 34);
const flying = () => g.flight && (g.flight.view === 'site' || g.flight.view === 'board');
const locked = () =>
  flying() || g.truck.follow || g.fading || g.count || g.room === 'recovery' || g.room === 'splash' || consoleLocked();

function goTo(x, then) {
  if (locked()) return;
  g.room = null;
  walk('you', x);
  g.marker = x;
  g.pending = then || null;
  g.cam.freeUntil = 0;
}

canvas.addEventListener('click', e => {
  if (drag?.moved) {
    drag = null;
    canvas.style.cursor = 'default';
    return;
  } // the end of a drag, not a click
  drag = null;
  // A console room with no console left in it (an old save, or a flight that ended some way we missed) is the site again.
  if (g.room === 'console' && !g.console) closeRoom();
  // In launch control your calls are on the HTML panel (#mc-panel, console-hud.js); the room itself is only scenery.
  if (g.room === 'console') return;
  // Inside a walk-in room the scene's own parts are what can be clicked: the spots on the round, the way out.
  if (interiorOf(g)) {
    const ratio = window.devicePixelRatio || 1,
      hit = interiorButtonAt(g, e.offsetX * ratio, e.offsetY * ratio);
    trace('hit', { act: hit?.act ?? null, id: hit?.id ?? null });
    if (hit) ({ leave: () => closeRoom(), look: () => lookAt(hit.id) })[hit.act]?.() ?? CONTROL_ACTS[hit.act]?.(hit.id);
    return;
  }
  if (locked()) return trace('hit', { locked: true });
  const w = toWorld(e),
    p = personAt(w),
    pl = placeAt(w);
  trace('hit', { x: Math.round(w.x), person: p?.id ?? null, place: pl?.[0] ?? null });
  if (p)
    return goTo(p.x + (you().x < p.x ? -14 : 14), () => {
      say(p.id, talk(p.id, g.beat));
    });
  if (pl) {
    let [id, place] = pl;
    // At the Cape in the Mercury years the old stand and dugout are the training building, with the simulator in it.
    if (g.crewed && id === 'stand') [id, place] = ['dugout', footprint('dugout', g)];
    if (g.crewed && id === 'truck')
      return goTo(g.truck.x + 45, () => say('you', 'Recovery reports come into Mercury Control.'));
    if (id === 'truck')
      return goTo(g.truck.x + 45, () => {
        g.beat === 'recovery' ? rideOut() : say('you', 'The recovery truck. Not needed yet.');
      });
    if (!place.room)
      return goTo(place.door, () =>
        say('you', id === 'tower' ? 'The launch tower. The pad crew works here.' : 'The test stand.'),
      );
    return goTo(place.door, () => openRoom(id));
  }
  goTo(Math.max(20, Math.min(2960, w.x)));
});
canvas.addEventListener('mousemove', e => {
  // In launch control the room is scenery: the calls are on the HTML panel.
  if (g.room === 'console' && g.console) {
    canvas.style.cursor = 'default';
    g.hover = null;
    canvas.title = '';
    return;
  }
  if (interiorOf(g)) {
    const ratio = window.devicePixelRatio || 1;
    canvas.style.cursor = interiorButtonAt(g, e.offsetX * ratio, e.offsetY * ratio) ? 'pointer' : 'default';
    g.hover = null;
    canvas.title = '';
    return;
  }
  const w = toWorld(e),
    p = personAt(w),
    pl = placeAt(w);
  g.hover = !p && pl ? { ...pl[1], name: placeName(pl[0]) } : null;
  canvas.title = p ? `${p.name}, ${p.role}` : '';
  canvas.style.cursor = p || pl ? 'pointer' : 'default';
});
// Looking along the site without walking: the wheel, dragging the site, or Shift with A/D or the arrow keys.
const look = dx => {
  g.cam.x = Math.max(0, Math.min(3000 - view.w / scale(), g.cam.x + dx));
  g.cam.freeUntil = g.time + 4;
};
canvas.addEventListener(
  'wheel',
  e => {
    look((e.deltaY + e.deltaX) * 0.8);
    e.preventDefault();
  },
  { passive: false },
);
// A drag pans the site; a press that hardly moves is still a click.
let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (e.button === 0) drag = { x: e.clientX, moved: false };
});
window.addEventListener('pointermove', e => {
  if (!drag || !(e.buttons & 1)) {
    drag = drag && { ...drag, x: e.clientX };
    return;
  }
  const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < 6) return;
  drag.moved = true;
  drag.x = e.clientX;
  look(-dx / scale());
  canvas.style.cursor = 'grabbing';
});
window.addEventListener('pointerup', () => {
  if (drag && !drag.moved) drag = null;
});

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (consoleKey(e)) return;
  keys[e.key] = true;
  if (e.key === 'Escape') {
    if (!$('notebook').hidden) $('notebook').hidden = true;
    else closeRoom();
  }
  if (e.key === ' ') {
    g.paused = !g.paused;
    e.preventDefault();
  }
  if (e.key === '1') g.speed = 1;
  if (e.key === '2') g.speed = 4;
  if (e.key === '3') g.speed = 16;
  if (e.key === 'n' || e.key === 'N') toggleNotebook();
  if (e.key === 'm' || e.key === 'M') showSound(cycleSound());
  if (e.key === 'e' || e.key === 'E') {
    // Anywhere in front of a building with a room in it, over its whole width as it stands today.
    if (g.crewed && atPlace('dugout', g, you().x) && !locked()) return openRoom('dugout');
    const pl = Object.entries(PLACES).find(
      ([id, p]) => p.room && (Math.abs(p.door - you().x) < 40 || atPlace(id, g, you().x, 0)),
    );
    if (pl && !locked()) openRoom(pl[0]);
  }
});
window.addEventListener('keyup', e => {
  keys[e.key] = keys[e.key.toLowerCase()] = keys[e.key.toUpperCase()] = false;
});

function keyWalk() {
  if (locked()) return;
  const left = keys.a || keys.A || keys.ArrowLeft,
    right = keys.d || keys.D || keys.ArrowRight;
  if ((left || right) && keys.Shift) return look(right ? 14 : -14);
  if (left || right) {
    g.room = null;
    g.pending = null;
    g.marker = null;
    walk('you', Math.max(20, Math.min(2960, you().x + (right ? 40 : -40))));
  }
}

// The Sound button says where it is set: full, low or off.
const SOUND_WORDS = { full: 'Sound', low: 'Sound: low', off: 'Sound: off' };
function showSound(level) {
  $('sound').textContent = SOUND_WORDS[level];
  $('sound').classList.toggle('muted', level === 'off');
}
showSound(soundSetting());

// The bar along the top.
document.querySelector('header').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.speed) {
    g.speed = Number(b.dataset.speed);
    g.paused = false;
  }
  if (b.id === 'pause') g.paused = !g.paused;
  if (b.id === 'endday') endDay();
  if (b.id === 'notes') toggleNotebook();
  if (b.id === 'sound') showSound(cycleSound());
  if (b.id === 'waiting' && awayFrom()) openRoom(awayFrom().place);
  if (b.id === 'game') openGameMenu();
});
function openGameMenu() {
  if (g.room === 'game') {
    g.room = null;
    return;
  }
  openGameRoom();
}
function toggleNotebook() {
  const nb = $('notebook');
  nb.hidden = !nb.hidden;
  if (!nb.hidden) {
    lastRead = g.notes[g.notes.length - 1] || null;
    showNotebook();
  }
}
// The button counts the notes written since you last had the notebook open, not every note ever. This is the screen's
// own memory: it is not saved. Notes written while it is open count as new, since the open page does not show them.
// After a load or a new game, when the last note you read is gone, this round's notes count as new.
let lastRead = null;
function unreadNotes() {
  const at = lastRead ? g.notes.indexOf(lastRead) : -1;
  return at >= 0 ? g.notes.length - 1 - at : g.notes.filter(n => n.round === g.roundIndex).length;
}
// This round's notes, with the earlier rounds' folded away behind a count and a button to clear them.
function showNotebook() {
  const nb = $('notebook'),
    esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const now = g.notes.filter(n => n.round === g.roundIndex),
    earlier = g.notes.length - now.length,
    photos = albumHTML(g, dateText);
  const list = notes => `<ol>${notes.map(n => `<li><span>${n.at}</span> ${esc(n.text)}</li>`).join('')}</ol>`;
  nb.innerHTML = `<h2>Your notebook</h2>
    ${
      earlier
        ? `<p><button data-nb="clear">Clear earlier rounds' notes</button> <span class="muted">This round's notes stay. Your record in the office keeps how each round went.</span></p>
      <details><summary>${earlier} note${earlier === 1 ? '' : 's'} from earlier rounds</summary>${list(g.notes.filter(n => n.round !== g.roundIndex))}</details>`
        : ''
    }
    ${now.length ? list(now) : '<p class="muted">Nothing written this round yet.</p>'}
    ${photos ? `<details class="album"><summary>Photographs</summary><div class="prints">${photos}</div></details>` : ''}
    <p class="muted">N or Esc to close.</p>`;
}
$('notebook').addEventListener('click', e => {
  if (e.target.dataset.nb === 'clear') {
    clearNotes();
    showNotebook();
  }
});
// While a count or a flight runs without you in its room (you closed it to look at the site), the bar says where it is
// and takes you back; when a call there is yours to make, it lights up. Before this, a question asked while you were on
// the site was only a speech bubble, and the site cannot be walked during a flight.
function awayFrom() {
  const c = g.console;
  if (g.crewed && c && c.kind === 'flight' && c.live && g.room !== 'console') {
    const mine =
      !!c.flight?.decision?.mine ||
      (c.auto
        ? ['pack', 'retro'].includes(c.phase)
        : !!c.poll || ['poll', 'ip', 'pad', 'shutdown', 'insertion', 'pack', 'retro'].includes(c.phase));
    return { place: 'office', mine };
  }
  if (!g.crewed && g.count && g.room !== 'count') return { place: 'blockhouse', mine: !!g.count.poll };
  if (!g.crewed && g.lunar?.poll && !['cruise', 'encounter'].includes(g.room)) return { place: 'office', mine: true };
  return null;
}
// The looks in the order the years bring them, and the card each new one gets (style.css, era interface).
const ERA_ORDER = ['field', 'steel', 'amber', 'desktop', 'glass'];
const ERA_CARDS = {
  steel: [
    'New consoles',
    'Painted steel, engraved plates, lamp push-buttons and Nixie clocks: the control rooms of the space age.',
  ],
  amber: [
    'New terminals',
    'The consoles now show their words on amber screens, and the choices come up on the function keys.',
  ],
  desktop: [
    'Computers on every desk',
    'The terminals have given way to desktop computers, with their grey windows and buttons.',
  ],
  glass: ['Flat screens', "Today's operations software: flat screens, dark rooms and one accent colour."],
};
let eraTimer = 0,
  eraGame = null; // the game the look was last set for: a load or a jump makes a new one, and gets no card
function eraCard(era) {
  const el = $('era-card'),
    [head, text] = ERA_CARDS[era];
  el.innerHTML = `<b>${head}</b>${text}`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(eraTimer);
  eraTimer = setTimeout(() => el.classList.remove('show'), 7000);
}
function hud() {
  // The interface era: style.css dresses the panels, clocks and buttons by it (v0.8 era interface).
  const era = uiEra(g);
  if (document.body.dataset.era !== era) {
    const was = document.body.dataset.era;
    document.body.dataset.era = era;
    // A change of look in play (not on loading a game or jumping) gets a short card saying what changed.
    if (was && eraGame === g && ERA_ORDER.indexOf(era) === ERA_ORDER.indexOf(was) + 1) eraCard(era);
  }
  eraGame = g;
  consoleHud(g, g.room === 'console' && !!g.console && !(g.flight && g.flight.view === 'board'));
  $('date').textContent = `${dateText()} · ${clockText()}`;
  $('objective').textContent = g.objective;
  $('endday').hidden = !g.dayDone;
  const away = awayFrom();
  $('waiting').hidden = !away;
  if (away) {
    const where = placeName(away.place);
    $('waiting').textContent = away.mine ? `Your call is waiting in ${where}` : `Back to ${where}`;
    $('waiting').classList.toggle('call', away.mine);
  }
  $('pause').textContent = g.paused ? '▶' : '❚❚';
  document
    .querySelectorAll('[data-speed]')
    .forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === g.speed && !g.paused));
  const fresh = unreadNotes();
  $('notes').textContent = fresh ? `Notebook (${fresh} new)` : 'Notebook';
  $('notes').classList.toggle('fresh', fresh > 0);
  $('loop').hidden = g.flight?.view === 'board'; // the range plot shows the calls itself
  $('loop').classList.toggle('in-interior', !!interiorOf(g));
  // In a walk-in room the loop sits to the right of the way-out button, whatever the button's size, so it never covers it.
  $('loop').style.left = interiorOf(g)
    ? `${inScene ? 206 : Math.round(doorRight / (window.devicePixelRatio || 1)) + 16}px`
    : '';
  // The walking hints are for the site; in launch control and the walk-in rooms they only cover the scene.
  $('help').hidden = g.room === 'console' || !!interiorOf(g) || !!g.flight;
  $('loop').classList.toggle(
    'in-room',
    g.room === 'console' && !!g.console && !(g.flight && g.flight.view === 'board'),
  ); // on the wall's loop board, clear of the map
  // On the site, only today's calls: yesterday's (or the last round's) lines from the loop do not hang over a new morning.
  // In launch control and in flight the loop runs on through the night.
  const today = g.room === 'console' || g.flight ? g.loop : g.loop.filter(l => l.day == null || l.day === g.day);
  const loop = today.slice(-4);
  $('loop').innerHTML = loop
    .map(l => `<div class="${l.tone}"><span>${l.at}</span> <b>${l.who}:</b> ${l.text.replace(/[&<>]/g, '')}</div>`)
    .join('');
}

// Seeded replays keep their checkpoints and backups separate from the active campaign.
const seed = Number(new URLSearchParams(location.search).get('seed')) || undefined;
const storage = seed ? memoryStorage() : localStorage;
useAlbumStorage(storage);

// The game menu: start again from 1945, keeping the game you were playing as the backup, or go back to the backup.
const where = c => `${cap(SEASON[roundIndexOf(c)].name)}, ${dateText(c.day)}`;
const cap = s => s[0].toUpperCase() + s.slice(1);
const fresh = () => {
  $('notebook').hidden = true;
  savedVersion = -1;
};
bindRoom({
  again: () => {
    startOver(storage, checkCheckpoint);
    clearDevFlag();
    newGame();
    fresh();
  },
  backup: () => {
    const c = readBackup(storage, checkCheckpoint);
    return c ? where(c) : null;
  },
  restore: () => {
    if (!swapBackup(storage, checkCheckpoint)) return;
    clearDevFlag();
    const c = readSave(storage, checkCheckpoint);
    if (c) newGame(c.seed, c);
    else newGame();
    fresh();
  },
});

// Save each checkpoint as it is made: every work morning, and each round's outcome.
let savedVersion = -1;
function autosave() {
  if (g.savedVersion === savedVersion) return;
  savedVersion = g.savedVersion;
  try {
    writeSave(storage, checkpoint());
  } catch (e) {
    /* storage full or blocked: play on unsaved */
    traceError('save-failed', e);
  }
}

// The canvas pixels the room's panel covers on the right, so a walk-in scene keeps its middle clear of it.
function panelReserve() {
  const el = $('room');
  // A call strip sits along the bottom of the scene, so the scene keeps its whole width.
  if (el.classList.contains('strip') && document.body.classList.contains('in-scene')) return 0;
  return el.hidden ? 0 : (el.offsetWidth + 24) * (window.devicePixelRatio || 1);
}

// The round's photograph, taken from the scene layer straight after it drew (js/site/album.js).
// On the site the print is framed on the pad; from the console it takes the whole room.
const snap = scene =>
  albumFrame(
    g,
    scene,
    $('stage').querySelector('canvas'),
    scene === 'site' ? ((PLACES.tower.x + 25 - g.cam.x) * scale()) / view.w : null,
  );

let last = performance.now(),
  inScene = false,
  staged = false;
function frame(now) {
  const steps = frameSteps((now - last) / 1000),
    dt = Math.min(MAX_STEP, (now - last) / 1000);
  playtestFrame(now - last);
  last = now;
  // One bad frame must not kill the loop (a shape-valid save could throw in a room render); report and carry on.
  try {
    keyWalk();
    // Every real second is played, in small steps, however slowly the frame drew (js/core/frame-steps.js).
    for (const step of steps) tick(step);
    openWhenReady(!!locked());
    updateCamera(view.w / scale(), dt);
    if (g.flight && g.flight.view === 'board') {
      staged = stageFrame('tracking', dt, 0);
      if (!staged) drawTracking(ctx, g, view);
    } else if (g.room === 'console' && g.console) {
      staged = stageFrame('control', dt, 0);
      if (staged) snap('control');
      else drawControlRoom(ctx, g, view);
    } else if (flightViewOf(g)) {
      // The deep-space flights, followed from JPL's tracking (js/stage/deep.js), and the recovery (recovery.js); the old
      // drawing shows the site.
      staged = stageFrame(flightViewOf(g), dt, panelReserve() / (window.devicePixelRatio || 1));
      if (!staged) drawSite(ctx, g, view);
    } else if (interiorOf(g)) {
      // A room rebuilt in PixiJS draws on the scene layer; the rest still draw on this canvas.
      staged = stageFrame(interiorOf(g), dt, panelReserve() / (window.devicePixelRatio || 1));
      if (!staged) drawInterior(ctx, g, view, panelReserve());
    } else {
      staged = stageFrame('site', dt, 0);
      if (staged) snap('site');
      else drawSite(ctx, g, view);
    }
    // in-scene: a walk-in room is drawn on the scene layer, so its panel keeps only the decision.
    inScene = staged && (!!interiorOf(g) || !!flightViewOf(g));
    document.body.classList.toggle('in-scene', inScene);
    renderRoom();
    liveRoom();
    hud();
    soundFrame(g, sceneOf());
    autosave();
  } catch (e) {
    console.error('Frame skipped:', e);
  }
  requestAnimationFrame(frame);
}

// What is on screen, for the playtest log.
const sceneOf = () => {
  if (g.flight?.view === 'board') return 'tracking';
  if (g.room === 'console' && g.console) return 'control-room';
  if (flightViewOf(g)) return `flight:${flightViewOf(g)}`;
  const inside = interiorOf(g);
  if (inside) return `interior:${inside}`;
  if (g.away) return 'away';
  return g.room ? `site, panel ${g.room}` : 'site';
};
startPlaytest({
  seed,
  storage,
  game: () => g,
  scene: sceneOf,
  saveText: () => (g?.saved ? exportSave(g.saved) : null),
});

// ?seed=123 replays the same round, for comparing notes. Otherwise carry on from the saved morning, if there is one.
// A save that cannot be read is noted in the playtest log with the reason, before falling back to the last good one.
const savedText = storage.getItem(KEYS.current);
if (savedText !== null)
  try {
    parseSave(savedText, checkCheckpoint);
  } catch (e) {
    traceError('save-rejected', e);
  }
const saved = readSave(storage, checkCheckpoint);
trace('load', { found: !!saved, beat: saved?.beat ?? null, day: saved?.day ?? null, round: saved?.roundId ?? null });
if (saved) newGame(saved.seed, saved);
else newGame(seed);
startDevMenu({ storage, check: checkCheckpoint, fresh });
bindConsoleHud();
startStage($('stage'), {
  leave: () => closeRoom(),
  look: id => lookAt(id),
  engLook: id => CONTROL_ACTS['eng-look'](id),
});
resize();
// A test hook: lets an automated check read and drive the prototype. Harmless in play.
window.__site = {
  get g() {
    return g;
  },
};
requestAnimationFrame(frame);
