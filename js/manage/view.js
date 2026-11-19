// MANAGEMENT MODE: the base view. The Cape in isometric pixel art, scaled by a whole number; the date, speed, the
// flights to come and what you have clicked on stay as full-resolution type over it (DESIGN.md §2). The clock always
// runs (pause stops it); each new day is saved. Flights on the manifest stand on their pads in the weeks before they
// fly and lift off on their day; how a flight went is reported once flight outcomes are built.
import { paintBase, paintRockets, tileAt, ART } from './paint.js';
import { CAPE_1958_BASE, CAPE_1958_ROADS, PREFABS, buildingAt } from './base.js';
import { CAPE_1958, PAD_KINDS } from './manifest.js';
import { schedule } from './schedule.js';
import { SECONDS_PER_DAY, SPEEDS, managementWhere } from './state.js';
import { dateLabel } from '../core/calendar.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const art = () => {
  const cv = document.createElement('canvas');
  cv.width = ART.w;
  cv.height = ART.h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
};

// What stands on the pads on a day (and how far it has risen, on launch day), from the schedule.
export function standsOn(sched, base, day, part = 0) {
  return sched.flights
    .filter(f => {
      const kind = PAD_KINDS[base.find(b => b.id === f.pad)?.padKind];
      return kind && day >= f.launch - kind.before && day <= f.launch;
    })
    .map(f => ({
      pad: base.find(b => b.id === f.pad),
      vehicle: f.vehicle,
      rise: day === f.launch ? Math.max(0, (part - 0.5) * 2) ** 2 * 260 : 0, // lifts off at noon
      flight: f,
    }));
}

export function startBaseView(el, game, { save, back }) {
  const base = CAPE_1958_BASE,
    sched = schedule(CAPE_1958, { from: game.day }),
    still = art(),
    live = art();
  paintBase(still.ctx, base, CAPE_1958_ROADS);
  el.innerHTML = `<div class="mg-bar">
      <strong data-live="date"></strong>
      <span class="mg-speed">
        <button data-act="pause" title="Pause (Space)">❚❚</button>
        ${SPEEDS.map((s, i) => `<button data-speed="${s}" title="Speed (${i + 1})">${s}×</button>`).join('')}
      </span>
      <span data-live="next" class="mg-next"></span>
      <button data-act="title">Title screen</button>
    </div>
    <canvas class="mg-view" aria-label="The Cape from above"></canvas>
    <aside class="mg-panel" data-live="panel"></aside>
    <div class="mg-tip" hidden></div>
    <div class="mg-log" data-live="log"></div>`;
  el.hidden = false;
  const canvas = el.querySelector('canvas'),
    ctx = canvas.getContext('2d'),
    $ = s => el.querySelector(s);
  let speed = 1,
    paused = false,
    part = 0, // how far through the day
    zoom = 0,
    cam = { x: ART.ox, y: ART.oy + 170 },
    selected = null,
    drag = null,
    running = true,
    log = [],
    lastDrawnDay = null;

  const scale = () => Math.max(2, Math.floor(innerHeight / 360) + zoom); // 3x at 1080p to start; the wheel zooms
  const toArt = e => {
    const r = canvas.getBoundingClientRect(),
      s = scale() / (devicePixelRatio || 1);
    return { x: (e.clientX - r.left - r.width / 2) / s + cam.x, y: (e.clientY - r.top - r.height / 2) / s + cam.y };
  };
  const clampCam = () => {
    cam.x = Math.round(Math.max(0, Math.min(ART.w, cam.x)));
    cam.y = Math.round(Math.max(0, Math.min(ART.h, cam.y)));
  };

  function info() {
    const date = dateLabel(game.day);
    $('[data-live=date]').textContent = date;
    const next = sched.flights.find(f => f.launch >= game.day);
    $('[data-live=next]').textContent = next
      ? next.launch === game.day
        ? `${next.name} flies today from ${base.find(b => b.id === next.pad).name}`
        : `Next: ${next.name}, ${dateLabel(next.launch)} (${next.launch - game.day === 1 ? 'tomorrow' : `${next.launch - game.day} days`})`
      : 'No flights on the manifest';
    el.querySelectorAll('[data-speed]').forEach(b =>
      b.classList.toggle('on', !paused && Number(b.dataset.speed) === speed),
    );
    $('[data-act=pause]').classList.toggle('on', paused);
    const b = selected;
    $('[data-live=panel]').innerHTML = b
      ? `<h3>${esc(b.name)}</h3><p class="muted">${esc(PREFABS[b.kind].name)}${b.padKind ? `, for ${esc(PAD_KINDS[b.padKind].vehicles.join(' and '))}` : ''}</p>
        ${
          b.kind === 'pad'
            ? `<p>${
                sched.flights
                  .filter(f => f.pad === b.id && f.launch >= game.day)
                  .map(f => `${esc(f.name)}: ${esc(dateLabel(f.launch))}`)
                  .join('<br>') || 'Nothing on the manifest for this pad.'
              }</p>`
            : ''
        }
        <p class="muted">Upgrade slots: ${esc(PREFABS[b.kind].slots.join(', '))}</p>`
      : `<h3>The manifest</h3><ol>${sched.flights
          .filter(f => f.launch >= game.day)
          .slice(0, 6)
          .map(f => `<li>${esc(f.name)} <span class="muted">${esc(dateLabel(f.launch))}</span></li>`)
          .join('')}</ol><p class="muted">Click a building to look at it.</p>`;
    $('[data-live=log]').innerHTML = log
      .slice(-3)
      .map(l => `<div>${esc(l)}</div>`)
      .join('');
  }

  function newDay() {
    game.day += 1;
    for (const f of sched.flights.filter(f => f.launch === game.day - 1))
      log.push(
        `${dateLabel(f.launch)}: ${f.name} lifted off from ${base.find(b => b.id === f.pad).name}. Its result will be reported here once flights are built.`,
      );
    save(game);
    info();
  }

  function draw() {
    const dpr = devicePixelRatio || 1,
      w = Math.round(canvas.clientWidth * dpr),
      h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const s = scale();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1f5577';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, Math.round(w / 2 - cam.x * s), Math.round(h / 2 - cam.y * s));
    ctx.drawImage(still.cv, 0, 0);
    const launching = sched.flights.some(f => f.launch === game.day);
    if (launching || lastDrawnDay !== game.day) {
      paintRockets(live.ctx, standsOn(sched, base, game.day, part));
      lastDrawnDay = game.day;
    }
    ctx.drawImage(live.cv, 0, 0);
  }

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) {
      part += (dt * speed) / SECONDS_PER_DAY;
      while (part >= 1) {
        part -= 1;
        newDay();
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  el.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'title') return back();
    if (b.dataset.act === 'pause') paused = !paused;
    if (b.dataset.speed) {
      speed = Number(b.dataset.speed);
      paused = false;
    }
    info();
  };
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, cam: { ...cam }, moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    const tip = $('.mg-tip');
    if (drag) {
      const s = scale() / (devicePixelRatio || 1),
        dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      cam = { x: drag.cam.x - dx / s, y: drag.cam.y - dy / s };
      clampCam();
      tip.hidden = true;
      return;
    }
    const t = tileAt(...Object.values(toArt(e))),
      b = buildingAt(base, t.tx, t.ty);
    tip.hidden = !b;
    if (b) {
      tip.textContent = b.name;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY + 10}px`;
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const t = tileAt(...Object.values(toArt(e)));
      selected = buildingAt(base, t.tx, t.ty);
      info();
    }
    drag = null;
  });
  canvas.addEventListener(
    'wheel',
    e => {
      zoom = Math.max(-1, Math.min(5, zoom + (e.deltaY < 0 ? 1 : -1)));
      e.preventDefault();
    },
    { passive: false },
  );
  const onKey = e => {
    if (el.hidden) return;
    const step = 12;
    if (e.key === ' ') {
      paused = !paused;
      e.preventDefault();
    } else if (['1', '2', '3'].includes(e.key)) {
      speed = SPEEDS[Number(e.key) - 1];
      paused = false;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') cam.x -= step;
    else if (e.key === 'ArrowRight' || e.key === 'd') cam.x += step;
    else if (e.key === 'ArrowUp' || e.key === 'w') cam.y -= step;
    else if (e.key === 'ArrowDown' || e.key === 's') cam.y += step;
    else if (e.key === 'Escape') selected = null;
    else return;
    clampCam();
    info();
  };
  window.addEventListener('keydown', onKey);
  info();
  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      window.removeEventListener('keydown', onKey);
    },
    // For tests and screenshots.
    get state() {
      return { day: game.day, part, speed, paused, cam, where: managementWhere(game) };
    },
    jump(days) {
      for (let i = 0; i < days; i++) newDay();
    },
    set part(v) {
      part = v;
      lastDrawnDay = null;
    },
  };
}
