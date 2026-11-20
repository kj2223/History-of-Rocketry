// MANAGEMENT MODE: the base view. The Cape in isometric pixel art, scaled by a whole number, with soft light and the
// period's film grade over the pixels; the date, speed, the manifest, reports and names stay as full-resolution type
// over it (DESIGN.md §1, §2). The clock always runs (pause stops it) and each new day is saved. Flights stand on their
// pads in the weeks before they fly and lift off at noon on the day; the clock drops to normal speed for a launch day
// so it is never missed. The day after, the flight's report comes in and goes on the record.
import { paintBase, paintRockets, tileAt, ART } from './paint.js';
import { CAPE_1958_ROADS, PREFABS, buildingAt } from './base.js';
import { CAPE_1958, PAD_KINDS, VEHICLE_NAMES } from './manifest.js';
import {
  PROGRAMMES,
  programmesOf,
  programmeSchedule,
  allFlights,
  advanceProgrammes,
  commitOpen,
  setProgramme,
  canStop,
  needed,
  funding,
  SQUEEZE_CAP,
} from './programmes.js';
import { flightOutcome, report } from './outcome.js';
import { SECONDS_PER_DAY, SPEEDS, START_DAY, managementWhere } from './state.js';
import { TW, TH } from './iso.js';
import { dateLabel } from '../core/calendar.js';
import { appropriation, lines, resplit, money, DEFAULT_SPLIT } from './budget.js';
import { announce, settle, news, standingText, watched } from './pressure.js';
import { staffing, candidate } from './people.js';
import { baseLife } from './life.js';
import {
  baseOf,
  openPlots,
  BUILDS,
  UPGRADES,
  startBuilding,
  startFitting,
  advanceBuilding,
  buildNeed,
  buildCover,
} from './build.js';
import { drawWorks } from './construction.js';
import {
  INCIDENTS,
  CREWS,
  ORDER,
  emergencyToday,
  startEmergency,
  orderCrew,
  tickEmergency,
  endEmergency,
  onPad,
} from './emergency.js';
import { manageSound } from '../stage/fx/sound.js';

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
      const pad = base.find(b => b.id === f.pad);
      return pad && day >= (f.onPad ?? f.launch - PAD_KINDS[pad.padKind].before) && day <= f.launch;
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
    game.flown = [...(game.flown ?? []), { id: f.id, day: f.launch, pad: f.pad, result: o.result, cause: o.cause }];
    out.push(report(f, o));
    const promise = settle(game, f, o.result); // pressure.js: a public date kept, slipped or lost
    if (promise) out.push(promise);
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
  const still = art(),
    live = art();
  let base = baseOf(game), // the 1958 Cape and everything finished since (build.js)
    sched = programmeSchedule(game, START_DAY);
  paintBase(still.ctx, base, CAPE_1958_ROADS);
  let life = baseLife(base, CAPE_1958_ROADS); // the day turning, people and trucks, smoke (life.js)
  el.innerHTML = `<div class="mg-bar">
      <strong class="mg-date" data-live="date"></strong>
      <span class="mg-speed">
        <button data-act="pause" title="Pause (Space)">❚❚</button>
        ${SPEEDS.map((s, i) => `<button data-speed="${s}" title="Speed (${i + 1})">${s}×</button>`).join('')}
      </span>
      <span data-live="next" class="mg-next"></span>
      <button data-act="programmes" title="Start, slow or stop programmes (G)">Programmes</button>
      <button data-act="build" title="New pads, buildings and upgrades (C)">Build</button>
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
    showing = null, // the panel: null (the manifest), 'reports', 'budget', 'people', 'programmes' or 'build'
    pick = null, // the crew picked on the map in a pad emergency: click it, then click the pad
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
      game.budget = appropriation(game.day, START_DAY, game.flown, game.pressure?.standing);
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
      ${programmesNeed()}
      <p class="muted">Move money between the lines at any time. Your record and your standing with Congress set next year’s figure.</p>
      <p><b>Standing:</b> ${esc(standingText(game.pressure?.standing))}${watched(game.day) ? ' <span class="mg-warn">Moscow is in the news: every promised date is watched.</span>' : ''}</p>`;
  }

  // What the programmes need from the Programmes line this year, and whether it covers them.
  function programmesNeed() {
    const need = needed(game, game.budget, START_DAY),
      cover = funding(game, game.budget, START_DAY);
    return `<p>The programmes need ${esc(money(need))} this year.${
      cover < 1
        ? ` <span class="mg-warn">The Programmes line covers ${Math.floor(cover * 100)}% of it: dates are slipping (at most ${SQUEEZE_CAP} days a year).</span>`
        : ' The Programmes line covers it.'
    }</p>`;
  }

  const behind = s => {
    const n = Math.floor(s?.lag ?? 0);
    return n <= 0 ? '' : n === 1 ? ' A day behind its plan.' : ` ${n} days behind its plan.`;
  };

  function programmesPanel() {
    const ps = programmesOf(game),
      upcoming = id => sched.flights.filter(f => f.programme === id);
    const row = (id, p) => {
      const s = ps[id],
        next = s ? upcoming(id)[0] : null,
        status = s ? { running: 'running', slowed: 'slowed', stopped: 'stopped' }[s.status] : 'not started',
        cost = s ? money(p.cost * { running: 1, slowed: 0.5, stopped: 0 }[s.status]) : money(p.cost);
      const btn = (to, label, title, off = false) =>
        `<button data-act="programme" data-id="${id}" data-to="${to}" title="${esc(title)}"${off ? ' disabled' : ''}>${label}</button>`;
      const buttons = !s
        ? btn('running', 'Start', `Start ${p.name}: ${money(p.cost)} a year`)
        : [
            s.status !== 'running' &&
              btn('running', s.status === 'stopped' ? 'Start again' : 'Full pace', 'Full money, dates hold'),
            s.status === 'running' && btn('slowed', 'Slow', 'Half the money; its dates fall back half a day each day'),
            s.status !== 'stopped' &&
              btn(
                'stopped',
                'Stop',
                canStop(game, id) ? 'No money; its flights leave the manifest' : 'Not before Explorer 6 has flown',
                !canStop(game, id),
              ),
          ]
            .filter(Boolean)
            .join(' ');
      return `<div class="mg-post"><b>${esc(p.name)}</b> <span class="${s?.status === 'running' ? 'muted' : 'mg-warn'}">${esc(status)}</span>, ${esc(cost)} a year
        <p class="muted">${esc(p.text)}${next ? ` Next: ${esc(next.name)}, ${esc(dateLabel(next.launch))}.` : ''}${behind(s)}</p>${buttons}</div>`;
    };
    return `<h3>Programmes</h3>${programmesNeed()}${Object.entries(PROGRAMMES)
      .map(([id, p]) => row(id, p))
      .join('')}<p><button data-act="programmes">Close</button></p>`;
  }

  // What the works under way need from the Building line this year, and whether it covers them.
  function buildNeedText() {
    const need = buildNeed(game, game.budget, START_DAY),
      cover = buildCover(game, game.budget, START_DAY);
    if (!need) return '<p class="muted">Nothing is being built.</p>';
    return `<p>The works under way need ${esc(money(need))} this year.${
      cover < 1
        ? ` <span class="mg-warn">The Building line covers ${Math.floor(cover * 100)}% of it, so the work goes slower.</span>`
        : ' The Building line covers it.'
    }</p>`;
  }
  const pct = p => `${Math.floor(p * 100)}%`;
  const months = d => `about ${Math.round(d / 30)} months`;
  const cap = t => t[0].toUpperCase() + t.slice(1);

  // A pad's upgrades: fitted, being fitted, or a button to fit.
  function upgradesOf(pad) {
    const fitted = game.fitted?.[pad.id] ?? [],
      fitting = (game.fitting ?? []).filter(f => f.pad === pad.id);
    return `<p class="muted">Turnaround: ${pad.before} days on the pad before a launch, ${pad.after} after.</p><ul class="mg-upgrades">${Object.entries(
      UPGRADES,
    )
      .map(([slot, u]) => {
        const doing = fitting.find(f => f.slot === slot);
        return `<li>${esc(cap(u.name))}: ${
          fitted.includes(slot)
            ? 'fitted'
            : doing
              ? `being fitted, ${pct(doing.progress)}`
              : `${esc(u.text)}. <button data-act="fit" data-pad="${esc(pad.id)}" data-slot="${slot}" title="${esc(money(u.cost))}, ${months(u.days)}">Fit, ${esc(money(u.cost))}</button>`
        }</li>`;
      })
      .join('')}</ul>`;
  }

  function buildPanel() {
    const going = (game.works ?? [])
      .map(w => `<li>${esc(w.name)}: ${esc(BUILDS[w.padKind ?? w.kind].name)}, ${pct(w.progress)} done</li>`)
      .join('');
    const plots = openPlots(game)
      .map(
        p =>
          `<div class="mg-post"><b>${esc(p.name)}</b> <span class="muted">open ground</span><p>${p.kinds
            .map(k => {
              const b = BUILDS[k];
              return `<button data-act="build-on" data-plot="${p.id}" data-what="${k}" title="${esc(b.text ?? `${months(b.days)} with the money there`)}">${esc(cap(b.name))}, ${esc(money(b.cost))}</button>`;
            })
            .join(' ')}</p></div>`,
      )
      .join('');
    return `<h3>Build</h3>${buildNeedText()}${going ? `<p><b>Going up</b></p><ul>${going}</ul>` : ''}${
      plots || '<p class="muted">Every plot is taken.</p>'
    }<p class="muted">Click a pad on the map to fit it with upgrades.</p><p><button data-act="build">Close</button></p>`;
  }

  function peoplePanel() {
    return `<h3>People</h3>${staffing(game.heads, game.day, [...sched.flown, ...sched.flights])
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

  // A pad emergency: its clock, the pad, the three crews and what each is doing. It holds the panel until it is over.
  function emergencyPanel() {
    const e = game.emergency,
      pad = base.find(b => b.id === e.pad),
      f = sched.flights.find(x => x.id === e.flight);
    // The clock and the gauge are filled in by info() each frame, so the buttons are not redrawn under the pointer.
    const heat =
      e.stage === 'fire'
        ? `<span class="mg-warn">FIRE${e.lost ? ', the rocket is gone' : ''}</span> <meter data-em="heat" min="0" max="1.5" title="How big the fire is"></meter>`
        : `Spill building <meter data-em="heat" min="0" max="1" title="How near the spill is to lighting"></meter>`;
    const crewRow = id => {
      const c = e.crews[id],
        k = CREWS[id],
        there = onPad(e, base, id);
      const doing = !c.to
        ? 'waiting for your order'
        : c.to === 'home'
          ? 'going back'
          : !there
            ? 'on the way'
            : k.job === 'clear'
              ? e.cleared
                ? 'pad clear'
                : 'clearing the tower'
              : k.job === 'valves'
                ? e.valves === 'closed'
                  ? 'valves closed'
                  : e.stage === 'fire' && e.heat >= 0.6
                    ? 'waiting: too hot to reach the valves'
                    : 'closing the valves'
                : e.stage === 'fire'
                  ? 'on the fire'
                  : 'standing by';
      return `<div class="mg-post mg-crew${pick === id ? ' on' : ''}"><i style="background:${k.colour}"></i><b>${esc(k.name)}</b> <span class="muted">${esc(doing)}</span>
        <p>${c.to === 'pad' ? `<button data-act="crew" data-crew="${id}" data-to="home">Call back</button>` : `<button data-act="crew" data-crew="${id}" data-to="pad">Send to ${esc(pad.name.replace('Launch Complex ', 'LC-'))}</button>`}</p></div>`;
    };
    return `<h3 class="mg-warn">${esc(INCIDENTS[e.kind].name)}: ${esc(pad.name)}</h3>
      <p><b data-em="clock"></b> ${heat}</p>
      <p class="muted">${esc(INCIDENTS[e.kind].text)}${f ? ` ${esc(f.name)} is on the stand.` : ''}</p>
      <p>Tower: ${e.cleared ? 'clear' : `<span class="mg-warn">people on it</span>`} · Valves: ${e.valves === 'closed' ? 'closed' : '<span class="mg-warn">open</span>'}</p>
      ${ORDER.map(crewRow).join('')}
      <p class="muted">Click a crew on the map, then the pad. The base clock waits; this one does not.</p>`;
  }

  function panel() {
    const b = selected;
    if (game.emergency) return emergencyPanel();
    if (showing === 'budget') return budgetPanel();
    if (showing === 'people') return peoplePanel();
    if (showing === 'programmes') return programmesPanel();
    if (showing === 'build') return buildPanel();
    if (showing === 'reports') {
      const flown = [...(game.flown ?? [])].reverse(),
        all = allFlights(game);
      return `<h3>Reports</h3>${
        flown.length
          ? `<p>${esc(recordLine(game.flown))}</p><ul class="mg-reports">${flown
              .map(r => {
                const f = all.find(x => x.id === r.id);
                const text =
                  r.cause === 'pad'
                    ? `${f?.name}: lost on the pad in a fire, before it could fly.`
                    : f && report(f, flightOutcome(game.seed, f));
                return f ? `<li><span class="muted">${esc(dateLabel(r.day))}</span><br>${esc(text)}</li>` : '';
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
        ${
          b.kind === 'pad'
            ? upgradesOf(b)
            : `<p class="muted">Later it can be fitted with ${esc(list(PREFABS[b.kind].slots.map(s => SLOT_NAMES[s] ?? s)))}.</p>`
        }
        <p><button data-act="deselect">Back to the manifest</button></p>`;
    }
    return `<h3>The manifest</h3><ol>${sched.flights
      .slice(0, 6)
      .map(f => {
        const promised = game.pressure?.announced?.[f.id];
        return `<li>${esc(f.name)} <span class="muted">${esc(dateLabel(f.launch))}</span>${
          promised != null
            ? ` <span class="${f.launch > promised ? 'mg-warn' : 'muted'}">(announced for ${esc(dateLabel(promised))})</span>`
            : f.launch > game.day
              ? ` <button data-act="announce" data-id="${esc(f.id)}" title="Tell the press the date: kept, it earns standing with Congress; slipped or lost, it costs">Announce</button>`
              : ''
        }</li>`;
      })
      .join('')}</ol>${
      sched.unplaced.length
        ? `<p class="mg-warn">Cannot fly as planned:</p><ul>${sched.unplaced.map(f => `<li>${esc(f.name)}: ${esc(f.why)}.</li>`).join('')}</ul>`
        : ''
    }${game.flown?.length ? `<p>${esc(recordLine(game.flown))}</p>` : ''}<p class="muted">Click a building to look at it.</p>`;
  }

  function info() {
    $('[data-live=date]').textContent = dateLabel(game.day);
    const next = sched.flights[0];
    const nextLine = $('[data-live=next]');
    nextLine.textContent = next
      ? `${next.launch === game.day ? 'Today' : 'Next'}: ${next.name} from ${padName(next.pad)}, ${next.launch === game.day ? 'lifting off at noon' : `${dateLabel(next.launch)} (${days(next.launch - game.day)})`}`
      : 'No flights on the manifest';
    nextLine.title = nextLine.textContent; // the whole line on hover, should a narrow window still shorten it
    el.querySelectorAll('[data-speed]').forEach(b =>
      b.classList.toggle('on', !paused && Number(b.dataset.speed) === speed),
    );
    $('[data-act=pause]').classList.toggle('on', paused);
    const n = game.flown?.length ?? 0;
    $('.mg-bar [data-act=reports]').textContent = n ? `Reports (${n})` : 'Reports';
    for (const k of ['reports', 'budget', 'people', 'programmes', 'build'])
      $(`.mg-bar [data-act=${k}]`).classList.toggle('on', showing === k);
    const empty = staffing(game.heads, game.day, [...sched.flown, ...sched.flights]).filter(
      p => p.open && !p.head,
    ).length;
    $('.mg-bar [data-act=people]').textContent = empty ? `People (${empty} to choose)` : 'People';
    // Not while a slider in the panel is held, so moving money is never cut off by the clock.
    const box = $('[data-live=panel]');
    if (game.emergency) {
      const html = panel();
      if (box.dataset.em !== html) {
        box.innerHTML = html;
        box.dataset.em = html;
      }
      box.querySelector('[data-em=clock]').textContent = `T+${Math.floor(game.emergency.t)} min`;
      box.querySelector('[data-em=heat]').value = game.emergency.heat;
    } else if (!box.contains(document.activeElement) || document.activeElement.type !== 'range') {
      box.innerHTML = panel();
      delete box.dataset.em;
    }
    $('[data-live=log]').innerHTML = log
      .slice(-3)
      .map(l => `<div>${esc(l)}</div>`)
      .join('');
  }

  function newDay() {
    game.day += 1;
    log.push(...news(game)); // pressure.js: Soviet firsts as they break
    log.push(...flyDue(game, sched, game.day));
    const year = ensureBudget();
    // The programmes' day: slowed, stopped or short of money, their dates fall back. Then the dates are worked out again.
    log.push(...advanceProgrammes(game, game.budget, START_DAY));
    // The day's building. Anything finished joins the base, is painted in and can be scheduled from today.
    const finished = advanceBuilding(game, game.budget, START_DAY);
    if (finished.length) {
      log.push(...finished);
      base = baseOf(game);
      paintBase(still.ctx, base, CAPE_1958_ROADS);
      life = baseLife(base, CAPE_1958_ROADS);
      lastDrawnDay = null;
      if (selected) selected = base.find(b => b.id === selected.id) ?? null;
    }
    sched = programmeSchedule(game, START_DAY);
    commitOpen(game, sched);
    // Now and then something goes wrong on a pad with a rocket on it (emergency.js).
    const incident = emergencyToday(game, standsOn(sched, base, game.day));
    if (incident) {
      log.push(startEmergency(game, base, incident));
      speed = 1;
      pick = null;
    }
    // A launch day plays at normal speed, so the liftoff is never skipped past.
    const launch = sched.flights.find(f => f.launch === game.day);
    if (launch && speed > 1) {
      speed = 1;
      log.push(`Slowed to 1× for ${launch.name}’s launch today.`);
    }
    if (year)
      log.push(
        `${fyName(game.budget.fy)[0].toUpperCase()}${fyName(game.budget.fy).slice(1)} begins: Congress gives the centre ${money(game.budget.total)}.`,
      );
    save(game);
    info();
  }

  // The emergency on the map, in art pixels: the spill or the fire at the foot of the stand, and the crews' trucks.
  function drawEmergency(t) {
    const e = game.emergency,
      pad = base.find(b => b.id === e.pad),
      foot = at(pad.tx + 2.5, pad.ty + 2.5);
    const px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    if (e.stage === 'leak') {
      const r = 3 + e.heat * 9;
      ctx.fillStyle = 'rgba(40,34,26,0.75)';
      ctx.beginPath();
      ctx.ellipse(Math.round(foot.x), Math.round(foot.y), Math.round(r), Math.round(r / 2), 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const n = Math.round(6 + e.heat * 18);
      for (let i = 0; i < n; i++) {
        const a = Math.sin(i * 12.9898 + Math.floor(t * 8) * 0.37) * 43758.5453,
          u = a - Math.floor(a),
          h = (u * 10 + 4) * (0.6 + e.heat);
        px(foot.x - n / 2 + i, foot.y - h, 1, h, i % 3 ? '#ffb648' : '#d8442b');
      }
      ctx.fillStyle = 'rgba(60,60,60,0.45)';
      for (let i = 0; i < 4; i++)
        ctx.fillRect(
          Math.round(foot.x - 4 + i * 3 + ((t * 6) % 6)),
          Math.round(foot.y - 30 - i * 8 - e.heat * 10),
          6,
          5,
        );
    }
    for (const id of ORDER) {
      const c = e.crews[id],
        q = at(c.x, c.y);
      px(q.x - 3, q.y - 4, 7, 4, CREWS[id].colour);
      px(q.x - 3, q.y, 7, 1, '#1a1a1a');
      if (pick === id) px(q.x - 4, q.y - 6, 9, 1, '#ffb648');
    }
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
    sun.addColorStop(0, `rgba(255,214,150,${(0.22 * (1 - life.night())).toFixed(3)})`);
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
    if (game.emergency)
      for (const id of ORDER) {
        const c = game.emergency.crews[id],
          q = at(c.x, c.y),
          s = toScreen(q.x, q.y);
        tag(
          CREWS[id].name,
          s.x,
          s.y - 26,
          pick === id ? '#2b1a00' : '#e9ece4',
          pick === id ? '#ffb648' : 'rgba(17,20,18,.78)',
        );
      }
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
    drawWorks(ctx, game.works ?? [], performance.now() / 1000); // buildings going up (construction.js)
    const launching = sched.flights.some(f => f.launch === game.day);
    if (launching || lastDrawnDay !== game.day) {
      paintRockets(live.ctx, standsOn(sched, base, game.day, part));
      lastDrawnDay = game.day;
    }
    ctx.drawImage(live.cv, 0, 0);
    life.art(ctx);
    if (game.emergency) drawEmergency(performance.now() / 1000);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    life.light(ctx, w, h, () => [
      s,
      0,
      0,
      s,
      Math.round(v.cx * dpr() - cam.x * s),
      Math.round(v.cy * dpr() - cam.y * s),
    ]);
    drawLight(w, h);
    drawType();
  }

  // Let minutes of a pad emergency pass; when it is over, the record and the manifest take what it cost.
  function runEmergency(minutes) {
    if (!game.emergency) return;
    const before = game.emergency.t;
    log.push(...tickEmergency(game, base, minutes));
    if (game.emergency.done) {
      log.push(...endEmergency(game, base, sched.flights));
      sched = programmeSchedule(game, START_DAY);
      lastDrawnDay = null;
      pick = null;
      save(game);
    } else if (Math.floor(game.emergency.t / 5) > Math.floor(before / 5)) save(game);
    info();
  }

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused && game.emergency)
      runEmergency(dt); // a minute of the emergency a second; the days wait
    else if (!paused) {
      part += (dt * speed) / SECONDS_PER_DAY;
      while (part >= 1) {
        part -= 1;
        newDay();
      }
    }
    life.update(dt, {
      part,
      speed,
      paused,
      stands: standsOn(sched, base, game.day, part),
      still: calm(),
      flights: sched.flights,
      day: game.day,
    });
    draw();
    manageSound({
      part,
      speed: paused ? 0 : speed,
      night: life.night(),
      works: (game.works ?? []).length,
      stands: standsOn(sched, base, game.day, part),
    });
    requestAnimationFrame(frame);
  }

  el.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'title') return back();
    if (b.dataset.act === 'pause') paused = !paused;
    for (const k of ['reports', 'budget', 'people', 'programmes', 'build'])
      if (b.dataset.act === k) {
        showing = showing === k ? null : k;
        selected = null;
      }
    if (b.dataset.act === 'deselect') selected = null;
    if (b.dataset.act === 'crew') {
      orderCrew(game, base, b.dataset.crew, b.dataset.to);
      pick = null;
    }
    if (b.dataset.act === 'build-on' || b.dataset.act === 'fit') {
      const line =
        b.dataset.act === 'fit'
          ? startFitting(game, b.dataset.pad, b.dataset.slot)
          : startBuilding(game, b.dataset.plot, b.dataset.what);
      if (line) {
        log.push(line);
        save(game);
      }
    }
    if (b.dataset.act === 'programme') {
      const line = setProgramme(game, b.dataset.id, b.dataset.to);
      if (line) {
        log.push(line);
        sched = programmeSchedule(game, START_DAY);
        save(game);
      }
    }
    if (b.dataset.act === 'appoint') {
      game.heads = { ...game.heads, [b.dataset.post]: b.dataset.who };
      log.push(`${candidate(b.dataset.post, b.dataset.who).name} takes up the post.`);
      save(game);
    }
    if (b.dataset.act === 'announce') {
      const f = sched.flights.find(x => x.id === b.dataset.id),
        line = f && announce(game, f);
      if (line) {
        log.push(line);
        save(game);
      }
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
    if (drag && !drag.moved && game.emergency) {
      // In an emergency the map is for the crews: pick one up, then put it on the pad (or anywhere else, to call it back).
      const a = toArt(e),
        t = tileAt(a.x, a.y),
        near = ORDER.find(id => {
          const c = game.emergency.crews[id];
          return Math.hypot(c.x - (t.tx + 0.5), c.y - (t.ty + 0.5)) < 1.6;
        });
      if (near && near !== pick) pick = near;
      else if (pick) {
        const hit = buildingAt(base, t.tx, t.ty);
        orderCrew(game, base, pick, hit?.id === game.emergency.pad ? 'pad' : 'home');
        pick = null;
      }
      info();
      drag = null;
      return;
    }
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
    } else if ('rbpgc'.includes(e.key.toLowerCase()) && e.key.length === 1) {
      const k = { r: 'reports', b: 'budget', p: 'people', g: 'programmes', c: 'build' }[e.key.toLowerCase()];
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
    sched = programmeSchedule(game, START_DAY);
    save(game);
  }
  commitOpen(game, sched);
  info();
  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      window.removeEventListener('keydown', onKey);
    },
    // For tests and screenshots.
    get state() {
      return {
        day: game.day,
        part,
        speed,
        paused,
        cam,
        where: managementWhere(game),
        flown: game.flown ?? [],
        emergency: game.emergency ? { ...game.emergency } : null,
        emergencies: game.emergencies ?? [],
      };
    },
    // A day at a time. A pad emergency in the way is left to the head of launch operations (no orders from you).
    jump(n) {
      for (let i = 0; i < n; i++) {
        let guard = 0;
        while (game.emergency && guard++ < 600) runEmergency(1);
        newDay();
      }
    },
    // Pad emergencies, for tests and the automated playtest: start one on the first pad with a rocket standing on it,
    // send a crew, and let minutes pass.
    emergency(kind = 'leak') {
      const s = standsOn(sched, base, game.day).find(x => x.flight.launch !== game.day);
      if (!s || game.emergency) return false;
      log.push(startEmergency(game, base, { kind, pad: s.pad.id, flight: s.flight.id }));
      speed = 1;
      info();
      return true;
    },
    order(crew, to = 'pad') {
      const ok = orderCrew(game, base, crew, to);
      info();
      return ok;
    },
    runEmergency(minutes) {
      runEmergency(minutes);
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
