// MANAGEMENT MODE: the base view. The Cape in isometric pixel art, scaled by a whole number, with soft light and the
// period's film grade over the pixels; the date, speed, the manifest, reports and names stay as full-resolution type
// over it (DESIGN.md §1, §2). The clock always runs (pause stops it) and each new day is saved. Flights stand on their
// pads in the weeks before they fly and lift off at noon on the day; the clock drops to normal speed for a launch day
// so it is never missed. The day after, the flight's report comes in and goes on the record.
import { paintBase, paintRockets, tileAt, ART } from './paint.js';
import { CAPE_1958_BASE, CAPE_1958_ROADS, PREFABS, buildingAt } from './base.js';
import { CAPE_1958, PAD_KINDS, VEHICLE_NAMES } from './manifest.js';
import { gameSchedule } from './schedule.js';
import { flightOutcome, report } from './outcome.js';
import { SECONDS_PER_DAY, SPEEDS, START_DAY, managementWhere } from './state.js';
import { TW, TH } from './iso.js';
import { dateLabel } from '../core/calendar.js';
import { appropriation, lines, resplit, money, DEFAULT_SPLIT } from './budget.js';
import { staffing, candidate } from './people.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const art = () => {
  const cv = document.createElement('canvas');
  cv.width = ART.w;
  cv.height = ART.h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
};
const calm = () => {
  try {
    return localStorage.getItem('pa-calm') === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// What players read for the things on the base.
const SLOT_NAMES = {
  tower: 'a taller service tower',
  deflector: 'a flame deflector',
  umbilical: 'an umbilical mast',
  periscope: 'periscopes',
  consoles: 'more consoles',
  bay: 'a second bay',
  crane: 'a bigger crane',
  'clean-room': 'a clean room',
  plotboard: 'plotting boards',
  wing: 'a new wing',
  dish: 'a tracking dish',
};
const list = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
const vehicles = kind => list(PAD_KINDS[kind].vehicles.map(v => VEHICLE_NAMES[v] ?? v));
const spentText = m => (m < 0.05 ? 'nothing spent yet' : `${money(m)} spent`);
const days = n => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

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

// The day's flying: flights due before `day` that are not on the record yet fly, and go on it. Returns the reports.
// (A game saved before reports came in catches up here on loading.)
export function flyDue(game, sched, day) {
  const out = [];
  for (const f of sched.flights.filter(f => f.launch < day)) {
    const o = flightOutcome(game.seed, f);
    game.flown = [...(game.flown ?? []), { id: f.id, day: f.launch, result: o.result, cause: o.cause }];
    out.push(report(f, o));
  }
  return out;
}

export const recordLine = flown => {
  if (!flown.length) return '';
  const good = flown.filter(f => f.result === 'good').length,
    short = flown.filter(f => f.result === 'short').length,
    lost = flown.length - good - short,
    parts = [`${good} good`, short && `${short} partly done`, lost && `${lost} lost`].filter(Boolean);
  return `${flown.length === 1 ? 'One flight' : `${flown.length} flights`} since NASA began: ${parts.join(', ')}.`;
};

export function startBaseView(el, game, { save, back }) {
  const base = CAPE_1958_BASE,
    still = art(),
    live = art();
  let sched = gameSchedule(game, CAPE_1958, START_DAY);
  paintBase(still.ctx, base, CAPE_1958_ROADS);
  el.innerHTML = `<div class="mg-bar">
      <strong class="mg-date" data-live="date"></strong>
      <span class="mg-speed">
        <button data-act="pause" title="Pause (Space)">❚❚</button>
        ${SPEEDS.map((s, i) => `<button data-speed="${s}" title="Speed (${i + 1})">${s}×</button>`).join('')}
      </span>
      <span data-live="next" class="mg-next"></span>
      <button data-act="budget" title="The year's money (B)">Budget</button>
      <button data-act="people" title="Your heads (P)">People</button>
      <button data-act="reports" title="Every flight's report (R)">Reports</button>
      <button data-act="title">Title screen</button>
    </div>
    <canvas class="mg-view" aria-label="The Cape from above"></canvas>
    <canvas class="mg-type" aria-hidden="true"></canvas>
    <aside class="mg-panel" data-live="panel"></aside>
    <div class="mg-tip" hidden></div>
    <div class="mg-log" data-live="log" aria-live="polite"></div>`;
  el.hidden = false;
  const canvas = el.querySelector('.mg-view'),
    ctx = canvas.getContext('2d'),
    type = el.querySelector('.mg-type'),
    tctx = type.getContext('2d'),
    $ = s => el.querySelector(s);
  let speed = 1,
    paused = false,
    part = 0, // how far through the day
    zoom = 0,
    cam = null,
    selected = null,
    showing = null, // the panel: null (the manifest), 'reports', 'budget' or 'people'
    drag = null,
    running = true,
    log = [],
    lastDrawnDay = null;

  const dpr = () => devicePixelRatio || 1;
  const scale = () => Math.max(2, Math.floor((innerHeight * dpr()) / 360) + zoom); // 3x at 1080p; the wheel zooms
  // The map's middle sits in the space the panel leaves.
  const view = () => {
    const panel = $('.mg-panel').getBoundingClientRect();
    return { cx: (innerWidth - panel.width - 24) / 2, cy: (innerHeight + 40) / 2 };
  };
  const toArt = e => {
    const s = scale() / dpr(),
      v = view();
    return { x: (e.clientX - v.cx) / s + cam.x, y: (e.clientY - v.cy) / s + cam.y };
  };
  const toScreen = (x, y) => {
    const s = scale() / dpr(),
      v = view();
    return { x: (x - cam.x) * s + v.cx, y: (y - cam.y) * s + v.cy };
  };
  const clampCam = () => {
    cam.x = Math.round(Math.max(0, Math.min(ART.w, cam.x)));
    cam.y = Math.round(Math.max(0, Math.min(ART.h, cam.y)));
  };
  const at = (tx, ty, z = 0) => ({ x: ART.ox + (tx - ty) * (TW / 2), y: ART.oy + (tx + ty) * (TH / 2) - z });
  const padName = id => base.find(b => b.id === id)?.name ?? id;

  // The year's money, set when the game begins and at the start of each fiscal year.
  function ensureBudget() {
    game.split ??= { ...DEFAULT_SPLIT };
    game.heads ??= {};
    if (!game.budget || game.day > game.budget.end) {
      game.budget = appropriation(game.day, START_DAY, game.flown);
      return true;
    }
    return false;
  }
  const fyName = fy => (fy === 'TQ' ? 'the transition quarter, 1976' : `fiscal ${fy}`);

  function budgetPanel() {
    const b = game.budget;
    return `<h3>Budget</h3><p>${esc(money(b.total))} for ${esc(fyName(b.fy))}${b.start < START_DAY ? ' (from 1 October: NASA began a quarter into the year)' : ''}, to ${esc(dateLabel(b.end))}.</p>
      <div class="mg-lines">${lines(b, game.split, game.day, START_DAY)
        .map(
          l => `<label>${esc(l.name)} <b>${l.share}%</b> <span class="muted">${esc(money(l.amount))}, ${esc(spentText(l.spent))}</span>
          <input type="range" min="0" max="100" step="5" value="${l.share}" data-line="${l.id}" aria-label="${esc(l.name)}: share of the budget"></label>`,
        )
        .join('')}</div>
      <p class="muted">Move money between the lines at any time. Your record with Congress sets next year’s figure.</p>`;
  }

  function peoplePanel() {
    return `<h3>People</h3>${staffing(
      game.heads,
      game.day,
      gameSchedule({ ...game, flown: [] }, CAPE_1958, START_DAY).flights,
    )
      .map(p => {
        if (!p.open)
          return `<div class="mg-post"><b>${esc(p.name)}</b><p class="muted">Opens when Mercury flights begin.</p></div>`;
        if (p.head)
          return `<div class="mg-post"><b>${esc(p.name)}</b>: ${esc(p.head.name)}<p class="muted">${esc(p.head.text)}</p>
            <button data-act="vacate" data-post="${p.id}">Choose someone else</button></div>`;
        return `<div class="mg-post"><b>${esc(p.name)}</b> <span class="mg-warn">nobody yet</span><p class="muted">${esc(p.text)}</p>
          ${p.candidates.map(c => `<p>${esc(c.name)}: ${esc(c.text)} <button data-act="appoint" data-post="${p.id}" data-who="${c.id}">Appoint</button></p>`).join('')}</div>`;
      })
      .join('')}`;
  }

  function panel() {
    const b = selected;
    if (showing === 'budget') return budgetPanel();
    if (showing === 'people') return peoplePanel();
    if (showing === 'reports') {
      const flown = [...(game.flown ?? [])].reverse(),
        all = gameSchedule({ ...game, flown: [] }, CAPE_1958, START_DAY).flights;
      return `<h3>Reports</h3>${
        flown.length
          ? `<p>${esc(recordLine(game.flown))}</p><ul class="mg-reports">${flown
              .map(r => {
                const f = all.find(x => x.id === r.id);
                return f
                  ? `<li><span class="muted">${esc(dateLabel(r.day))}</span><br>${esc(report(f, flightOutcome(game.seed, f)))}</li>`
                  : '';
              })
              .join('')}</ul>`
          : '<p class="muted">No flights yet. Each flight’s report comes in the day after it flies.</p>'
      }<p><button data-act="reports">Close</button></p>`;
    }
    if (b) {
      const flights = sched.flights.filter(f => f.pad === b.id);
      return `<h3>${esc(b.name)}</h3><p class="muted">${esc(PREFABS[b.kind].name)}${b.padKind ? ` for the ${esc(vehicles(b.padKind))}` : ''}</p>
        ${
          b.kind === 'pad'
            ? `<p>${flights.map(f => `${esc(f.name)}: ${esc(dateLabel(f.launch))}`).join('<br>') || 'Nothing on the manifest for this pad.'}</p>`
            : ''
        }
        <p class="muted">Later it can be fitted with ${esc(list(PREFABS[b.kind].slots.map(s => SLOT_NAMES[s] ?? s)))}.</p>
        <p><button data-act="deselect">Back to the manifest</button></p>`;
    }
    return `<h3>The manifest</h3><ol>${sched.flights
      .slice(0, 6)
      .map(f => `<li>${esc(f.name)} <span class="muted">${esc(dateLabel(f.launch))}</span></li>`)
      .join('')}</ol>${
      sched.unplaced.length
        ? `<p class="mg-warn">Cannot fly as planned:</p><ul>${sched.unplaced.map(f => `<li>${esc(f.name)}: ${esc(f.why)}.</li>`).join('')}</ul>`
        : ''
    }${game.flown?.length ? `<p>${esc(recordLine(game.flown))}</p>` : ''}<p class="muted">Click a building to look at it.</p>`;
  }

  function info() {
    $('[data-live=date]').textContent = dateLabel(game.day);
    const next = sched.flights[0];
    $('[data-live=next]').textContent = next
      ? `${next.launch === game.day ? 'Today' : 'Next'}: ${next.name} from ${padName(next.pad)}, ${next.launch === game.day ? 'lifting off at noon' : `${dateLabel(next.launch)} (${days(next.launch - game.day)})`}`
      : 'No flights on the manifest';
    el.querySelectorAll('[data-speed]').forEach(b =>
      b.classList.toggle('on', !paused && Number(b.dataset.speed) === speed),
    );
    $('[data-act=pause]').classList.toggle('on', paused);
    const n = game.flown?.length ?? 0;
    $('.mg-bar [data-act=reports]').textContent = n ? `Reports (${n})` : 'Reports';
    for (const k of ['reports', 'budget', 'people']) $(`.mg-bar [data-act=${k}]`).classList.toggle('on', showing === k);
    const empty = staffing(game.heads, game.day, sched.flights).filter(p => p.open && !p.head).length;
    $('.mg-bar [data-act=people]').textContent = empty ? `People (${empty} to choose)` : 'People';
    // Not while a slider in the panel is held, so moving money is never cut off by the clock.
    if (!$('[data-live=panel]').contains(document.activeElement) || document.activeElement.type !== 'range')
      $('[data-live=panel]').innerHTML = panel();
    $('[data-live=log]').innerHTML = log
      .slice(-3)
      .map(l => `<div>${esc(l)}</div>`)
      .join('');
  }

  function newDay() {
    game.day += 1;
    const reports = flyDue(game, sched, game.day);
    if (reports.length) {
      log.push(...reports);
      sched = gameSchedule(game, CAPE_1958, START_DAY);
    }
    // A launch day plays at normal speed, so the liftoff is never skipped past.
    const launch = sched.flights.find(f => f.launch === game.day);
    if (launch && speed > 1) {
      speed = 1;
      log.push(`Slowed to 1× for ${launch.name}’s launch today.`);
    }
    if (ensureBudget())
      log.push(
        `${fyName(game.budget.fy)[0].toUpperCase()}${fyName(game.budget.fy).slice(1)} begins: Congress gives the centre ${money(game.budget.total)}.`,
      );
    save(game);
    info();
  }

  function drawLight(w, h) {
    // 2D-HD light over the pixels (DESIGN.md §1): late-afternoon sun from the west, the far corners falling away. Soft
    // light only; the pixels and the type stay crisp.
    const shadeMap = ctx.createRadialGradient(w * 0.42, h * 0.45, h * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    shadeMap.addColorStop(0, 'rgba(255,244,220,0)');
    shadeMap.addColorStop(1, 'rgba(20,24,40,0.38)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = shadeMap;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    const sun = ctx.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, h * 0.9);
    sun.addColorStop(0, 'rgba(255,214,150,0.22)');
    sun.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    // A glow round a flame on launch day.
    for (const s of calm() ? [] : standsOn(sched, base, game.day, part).filter(s => s.rise > 0)) {
      const p = toScreen(
          at(s.pad.tx + 2.5, s.pad.ty + 2.5, 2 + s.rise).x,
          at(s.pad.tx + 2.5, s.pad.ty + 2.5, 2 + s.rise).y,
        ),
        r = (scale() * 18) / 1,
        g = ctx.createRadialGradient(p.x * dpr(), p.y * dpr(), 0, p.x * dpr(), p.y * dpr(), r);
      g.addColorStop(0, 'rgba(255,190,90,0.55)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Names on the map, at full resolution: each pad, the next launch, and an outline round what you picked.
  function drawType() {
    const w = Math.round(innerWidth * dpr()),
      h = Math.round(innerHeight * dpr());
    if (type.width !== w || type.height !== h) {
      type.width = w;
      type.height = h;
    }
    tctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    tctx.clearRect(0, 0, innerWidth, innerHeight);
    const big = scale() / dpr() >= 3;
    if (selected) {
      const p = PREFABS[selected.kind],
        pts = [
          at(selected.tx, selected.ty),
          at(selected.tx + p.w, selected.ty),
          at(selected.tx + p.w, selected.ty + p.d),
          at(selected.tx, selected.ty + p.d),
        ].map(q => toScreen(q.x, q.y));
      tctx.beginPath();
      pts.forEach((q, i) => (i ? tctx.lineTo(q.x, q.y) : tctx.moveTo(q.x, q.y)));
      tctx.closePath();
      tctx.lineWidth = 2;
      tctx.strokeStyle = '#ffb648';
      tctx.stroke();
    }
    tctx.font = `${big ? 13 : 11}px "Segoe UI", system-ui, sans-serif`;
    tctx.textAlign = 'center';
    const next = sched.flights[0];
    for (const b of base.filter(b => b.kind === 'pad')) {
      const q = at(b.tx + 2.5, b.ty + 5),
        s = toScreen(q.x, q.y),
        label = b.name.replace('Launch Complex ', 'LC-');
      tag(label, s.x, s.y + 14, '#e9ece4', 'rgba(17,20,18,.78)');
      if (next && next.pad === b.id) {
        const top = toScreen(at(b.tx + 2.5, b.ty + 2.5, 46).x, at(b.tx + 2.5, b.ty + 2.5, 46).y);
        tag(
          `${next.name}: ${next.launch === game.day ? 'launch today' : days(next.launch - game.day)}`,
          top.x,
          top.y,
          '#2b1a00',
          '#ffb648',
        );
      }
    }
  }
  function tag(text, x, y, ink, bg) {
    const w = tctx.measureText(text).width + 10;
    tctx.fillStyle = bg;
    tctx.fillRect(Math.round(x - w / 2), Math.round(y - 12), Math.round(w), 17);
    tctx.fillStyle = ink;
    tctx.fillText(text, Math.round(x), Math.round(y));
  }

  function draw() {
    const w = Math.round(canvas.clientWidth * dpr()),
      h = Math.round(canvas.clientHeight * dpr());
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!cam) cam = { x: ART.ox + 40, y: ART.oy + 175 };
    const s = scale(),
      v = view();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1f5577'; // the deep sea, as painted at the map's edge
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, Math.round(v.cx * dpr() - cam.x * s), Math.round(v.cy * dpr() - cam.y * s));
    ctx.drawImage(still.cv, 0, 0);
    const launching = sched.flights.some(f => f.launch === game.day);
    if (launching || lastDrawnDay !== game.day) {
      paintRockets(live.ctx, standsOn(sched, base, game.day, part));
      lastDrawnDay = game.day;
    }
    ctx.drawImage(live.cv, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLight(w, h);
    drawType();
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
    for (const k of ['reports', 'budget', 'people'])
      if (b.dataset.act === k) {
        showing = showing === k ? null : k;
        selected = null;
      }
    if (b.dataset.act === 'deselect') selected = null;
    if (b.dataset.act === 'appoint') {
      game.heads = { ...game.heads, [b.dataset.post]: b.dataset.who };
      log.push(`${candidate(b.dataset.post, b.dataset.who).name} takes up the post.`);
      save(game);
    }
    if (b.dataset.act === 'vacate') {
      const { [b.dataset.post]: gone, ...rest } = game.heads;
      game.heads = rest;
      save(game);
    }
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
      const s = scale() / dpr(),
        dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      cam = { x: drag.cam.x - dx / s, y: drag.cam.y - dy / s };
      clampCam();
      tip.hidden = true;
      return;
    }
    const a = toArt(e),
      t = tileAt(a.x, a.y),
      b = buildingAt(base, t.tx, t.ty);
    tip.hidden = !b;
    canvas.style.cursor = b ? 'pointer' : 'grab';
    if (b) {
      tip.textContent = b.name;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY + 10}px`;
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const a = toArt(e),
        t = tileAt(a.x, a.y);
      selected = buildingAt(base, t.tx, t.ty);
      if (selected) showing = null;
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
    } else if ('rbp'.includes(e.key.toLowerCase()) && e.key.length === 1) {
      const k = { r: 'reports', b: 'budget', p: 'people' }[e.key.toLowerCase()];
      showing = showing === k ? null : k;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') cam.x -= step;
    else if (e.key === 'ArrowRight' || e.key === 'd') cam.x += step;
    else if (e.key === 'ArrowUp' || e.key === 'w') cam.y -= step;
    else if (e.key === 'ArrowDown' || e.key === 's') cam.y += step;
    else if (e.key === 'Escape') {
      selected = null;
      showing = null;
    } else return;
    clampCam();
    info();
  };
  window.addEventListener('keydown', onKey);
  // Moving money between the lines.
  el.addEventListener('input', e => {
    const id = e.target.dataset?.line;
    if (!id) return;
    game.split = resplit(game.split, id, Number(e.target.value));
    save(game);
    el.querySelectorAll('[data-line]').forEach(r => {
      if (r !== e.target) r.value = game.split[r.dataset.line];
    });
    const rows = lines(game.budget, game.split, game.day, START_DAY);
    el.querySelectorAll('.mg-lines label').forEach((lab, i) => {
      lab.querySelector('b').textContent = `${rows[i].share}%`;
      lab.querySelector('span').textContent = `${money(rows[i].amount)}, ${spentText(rows[i].spent)}`;
    });
  });
  ensureBudget();
  // A game saved before reports came in catches up its flights now.
  const caught = flyDue(game, sched, game.day);
  if (caught.length) {
    log.push(...caught);
    sched = gameSchedule(game, CAPE_1958, START_DAY);
    save(game);
  }
  info();
  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      window.removeEventListener('keydown', onKey);
    },
    // For tests and screenshots.
    get state() {
      return { day: game.day, part, speed, paused, cam, where: managementWhere(game), flown: game.flown ?? [] };
    },
    jump(n) {
      for (let i = 0; i < n; i++) newDay();
    },
    set part(v) {
      part = v;
      lastDrawnDay = null;
    },
    set speed(v) {
      speed = v;
      info();
    },
  };
}
