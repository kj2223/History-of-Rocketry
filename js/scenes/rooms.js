// THE ROOMS: what the player sees and does inside a building, as a panel over the site. The site keeps going behind it.
// render() rebuilds a panel when the game says the room changed; live() updates its gauges every frame.
import {
  g,
  lookAt,
  finishInspection,
  setLoad,
  finishBoard,
  standStart,
  standHold,
  standLeakCheck,
  standTank,
  standDecide,
  countStart,
  countTank,
  countAnswer,
  countHold,
  countResume,
  countLeakCheck,
  NORMAL_TANK,
  returnFromRecovery,
  present,
  roomFor,
  dateText,
  clockText,
  closeAway,
  nextRound,
  advanceProbe,
  probeStep,
  kit,
  answerFirstOffer,
  conducting,
  finishPlan,
  chair,
  INSPECTORS,
  PLANNED_LAUNCH_DAY,
  onBudget,
  budgetLine,
  atSea,
  nextIndex,
  roundStartOf,
  placeName,
} from '../game.js';
import { CONTROL_ROOMS, CONTROL_ACTS, controlLive, openConsole } from './control.js';
import { LUNAR_ROOMS, LUNAR_ACTS, lunarLive } from './lunar.js';
import { COSTS, planCost, dollars } from '../world/budget.js';
import { SEASON, offerFor, offerBySeat, blockhouseState, SITES, LAST_WORD } from '../data/campaign.js';
import { SHORT } from '../data/kits.js';
import { fixesForCard } from '../world/programme.js';
import { SEATS, SEAT_PHRASE, pendingOffer } from '../career/record.js';
import { PLACES, atPlace } from '../data/white-sands.js';

const panel = () => document.getElementById('room');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let shown = { room: null, version: -1 },
  hooks = {},
  confirmNew = false,
  flags = {},
  plan = { inspector: 'you', burn: 'short', leak: false };

// What you have ticked to flag on the inspection list, so the hangar scene can mark it on the round.
export const inspectFlags = () => flags;

export function openRoom(building) {
  g.room =
    building === 'truck' && roomFor('truck') !== 'recovery'
      ? null
      : roomFor(building) === 'watch'
        ? `watch:${building}`
        : roomFor(building);
  if (building === 'blockhouse' && g.room === 'count' && !g.count) countStart();
  if (g.room === 'console' && !g.console) openConsole();
  if (g.room === 'count' || g.room === 'static') g.speed = 1;
}
// When the work at a building becomes ready while you are already there, its room opens on its own: the static fire when
// the stage is on the stand, the count when the round is in the tower. A watch panel open on a building switches over;
// standing at the dugout's or the blockhouse's door does too, once, when the beat changes (so closing the room keeps it
// closed).
let readyBeat = null;
export function openWhenReady(locked) {
  const changed = g.beat !== readyBeat;
  readyBeat = g.beat;
  if (locked) return;
  const [kind, building] = (g.room || '').split(':');
  if (kind === 'watch' && building && building !== 'truck' && roomFor(building) !== 'watch') return openRoom(building);
  if (!changed || g.room) return;
  const you = g.people.you;
  if (Math.abs(you.x - you.target) > 1) return;
  const at = ['dugout', 'blockhouse'].find(id => Math.abs(PLACES[id].door - you.x) < 40 || atPlace(id, g, you.x));
  if (at && !g.crewed && roomFor(at) !== 'watch') openRoom(at);
}
export function closeRoom() {
  if (['recovery', 'splash'].includes(g.room)) return; // these close through their own buttons
  if (g.room === 'away') return closeAway();
  g.room = null;
}

export function render() {
  const el = panel();
  if (!g.room) {
    el.hidden = true;
    shown.room = null;
    return;
  }
  if (shown.room === g.room && shown.version === g.roomVersion) return;
  shown = { room: g.room, version: g.roomVersion };
  el.hidden = false;
  const [kind, building] = g.room.split(':');
  const body = kind === 'watch' ? watch(building) : (ROOMS[kind] || CONTROL_ROOMS[kind] || LUNAR_ROOMS[kind])();
  if (!body) {
    el.hidden = true;
    return;
  } // a room with nothing to show leaves the scene alone
  const closable = !['recovery', 'splash'].includes(kind);
  el.innerHTML = `${closable ? '<button class="close" data-act="close" title="Back to the site (Esc)">✕</button>' : ''}${body}`;
}

// Gauges and traces that move every frame.
export function live() {
  if (!g.room) return;
  controlLive();
  lunarLive();
  const set = (sel, v) => {
    const n = panel().querySelector(sel);
    if (n) n.textContent = v;
  };
  if (g.room === 'static' && g.stand) {
    const s = g.stand;
    set(
      '[data-live=standclock]',
      s.phase === 'count'
        ? `T-${Math.ceil(s.clock)}`
        : s.phase === 'firing'
          ? 'FIRING'
          : s.phase === 'held'
            ? 'HOLD'
            : s.phase === 'leakcheck'
              ? 'CREW ON STAND'
              : s.phase === 'ready'
                ? 'READY'
                : 'SHUT DOWN',
    );
    const tank =
      s.phase === 'firing' || s.phase === 'read' ? s.trace[Math.max(0, Math.floor(s.shown) - 1)].tank : standTank();
    gauge('tank', tank, 0, 30, NORMAL_TANK);
    const pc = s.trace && s.shown > 0 ? s.trace[Math.max(0, Math.floor(s.shown) - 1)].pc : 0;
    gauge('pc', pc, 0, 30, kit().stand.pc);
    if (s.burn === 'long' && kit().stand.wall)
      gauge(
        'wall',
        s.trace && s.shown > 0 ? (s.trace[Math.max(0, Math.floor(s.shown) - 1)].wall ?? 300) : 300,
        0,
        1000,
        kit().stand.wall,
      );
    if (s.trace) drawTrace(panel().querySelector('canvas'), s.trace, Math.floor(s.shown), kit().stand.pc);
  }
  if (g.room === 'count' && g.count) {
    const c = g.count;
    set('[data-live=countclock]', `T-${fmtCount(c.clock)}`);
    set(
      '[data-live=countstate]',
      c.checking ? 'HOLD: pad crew checking' : c.poll ? 'Waiting for your call' : c.held ? 'HOLDING' : 'Counting',
    );
    gauge('ctank', countTank(), 0, 30, NORMAL_TANK);
  }
}
const fmtCount = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

function gauge(id, value, min, max, normal) {
  const n = panel().querySelector(`[data-gauge=${id}]`);
  if (!n) return;
  n.querySelector('.needle').style.transform = `rotate(${-120 + (240 * (value - min)) / (max - min)}deg)`;
  n.querySelector('.read').textContent = value.toFixed(1);
  const band = n.querySelector('.band');
  if (band && !band.dataset.done) {
    band.dataset.done = 1;
    const a = -120 + (240 * (normal[0] - min)) / (max - min),
      b = -120 + (240 * (normal[1] - min)) / (max - min);
    band.style.background = `conic-gradient(from ${a}deg, rgba(110,200,120,.55) 0deg ${b - a}deg, transparent ${b - a}deg)`;
  }
}
const gaugeHTML = (id, label, unit) =>
  `<div class="gauge" data-gauge="${id}"><div class="dial"><div class="band"></div><div class="needle"></div></div><div class="read">0.0</div><div class="lab">${label} (${unit})</div></div>`;

function drawTrace(canvas, trace, upto, band) {
  if (!canvas) return;
  const span = trace[trace.length - 1].t;
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height,
    y = v => h - 8 - (v / 30) * (h - 16),
    x = t => 8 + (t / span) * (w - 16);
  ctx.fillStyle = '#f6f1e2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d6cdb5';
  ctx.lineWidth = 1;
  for (let v = 0; v <= 30; v += 5) {
    ctx.beginPath();
    ctx.moveTo(8, y(v));
    ctx.lineTo(w - 8, y(v));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(110,200,120,.18)';
  ctx.fillRect(8, y(band[1]), w - 16, y(band[0]) - y(band[1]));
  const line = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    trace
      .slice(0, upto)
      .forEach((point, i) => (i ? ctx.lineTo(x(point.t), y(point[key])) : ctx.moveTo(x(point.t), y(point[key]))));
    ctx.stroke();
  };
  line('tank', '#4b6a8a');
  line('pc', '#a3321f');
  // The chamber wall temperature, on a full-duration firing, drawn on the same grid at 1000 K full scale.
  if (trace[0].wall != null) {
    ctx.strokeStyle = '#c98a1c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    trace
      .slice(0, upto)
      .forEach((point, i) =>
        i ? ctx.lineTo(x(point.t), y(point.wall * 0.03)) : ctx.moveTo(x(point.t), y(point.wall * 0.03)),
      );
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(8, y(700 * 0.03));
    ctx.lineTo(w - 8, y(700 * 0.03));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#5b5345';
  ctx.font = '11px Georgia, serif';
  ctx.fillText(
    `red: chamber pressure · blue: tank pressure · green band: chamber normal${trace[0].wall != null ? ' · amber: wall temperature (dashed: 700 K limit)' : ''}`,
    10,
    14,
  );
}

function watch(building) {
  const place = PLACES[building];
  // In or near the building as it stands today (the new blockhouse reaches well left of the old one's door).
  const near = (x, reach) => Math.abs(x - place.door) < place.w / 2 + reach || atPlace(building, g, x, reach - 40);
  const here = Object.values(g.people).filter(person => !person.hidden && near(person.x, 40) && person.id !== 'you');
  const busy = g.jobs.filter(j => near(j.at, 60)).map(j => j.label);
  const name = building === 'truck' && !g.crewed ? SITES[g.site || 'white-sands'].truck : placeName(building);
  return `<h2>${esc(name)}</h2><p class="muted">Nothing here needs you right now. You can watch.</p>
    ${busy.length ? `<p>Going on here: ${busy.map(esc).join(', ')}.</p>` : ''}
    ${here.length ? `<p>Here: ${here.map(p => `${esc(p.name)} (${esc(p.role)})`).join(', ')}.</p>` : '<p>Nobody is here.</p>'}
    <p class="muted">What you need to do next: ${esc(g.objective)}</p>`;
}

// The game menu, from the bar along the top.
export function openGameRoom() {
  confirmNew = false;
  g.room = 'game';
  g.roomVersion++;
}

const ROOMS = {
  probeHandover() {
    const { name, probe } = SEASON[g.roundIndex];
    return `<h2>${esc(name)}</h2><p>${esc(probe.tracking)}</p>
      <button class="primary" data-act="probe-command">${probe.steps ? 'Accept the handover' : 'Accept handover and jump to encounter'}</button>`;
  },
  probeEncounter() {
    const { name, probe } = SEASON[g.roundIndex];
    const step = probeStep();
    if (step)
      return `<h2>${esc(name)}</h2><h3>${esc(step.title)}</h3><p>${esc(step.evidence)}</p>
      ${step.choices.map((c, i) => `<button${i ? '' : ' class="primary"'} data-act="probe-choice" data-id="${i}">${esc(c.label)}</button>`).join('\n      ')}`;
    return `<h2>${esc(name)}</h2><p>${esc(probe.evidence)}</p>
      <button class="primary" data-act="probe-command">${esc(probe.action)}</button>
      <button data-act="probe-wait">${esc(probe.alternate)}</button>`;
  },
  probePlayback() {
    return `<h2>Mariner 4 playback</h2><p>${esc(SEASON[g.roundIndex].probe.received)}</p>
      <button class="primary" data-act="probe-command">Log receipt and close the round</button>`;
  },
  game() {
    const here = `${SEASON[g.roundIndex].name[0].toUpperCase()}${SEASON[g.roundIndex].name.slice(1)}, ${dateText()}`,
      backup = hooks.backup?.();
    if (confirmNew)
      return `<h2>Start again from 1945?</h2>
      <p>You go back to the first WAC Corporal round at White Sands. The game you are playing now (${esc(here)}) is kept as your backup,
      and you can come back to it from this menu${backup ? `. It takes the place of the backup you have now (${esc(backup)})` : ''}.</p>
      <button class="danger" data-act="game-new-go">Start again from 1945</button> <button data-act="game-cancel">Keep playing</button>`;
    return `<h2>Game</h2>
      <p>Playing now: ${esc(here)}. The game saves itself every working morning.</p>
      <p><button data-act="game-new">Start a new game from 1945</button></p>
      ${backup ? `<p>Your backup: ${esc(backup)}.</p><p><button data-act="game-restore">Go back to the backup</button> <span class="muted">The game you are playing now becomes the backup.</span></p>` : '<p class="muted">No backup yet. Starting a new game keeps this one as the backup.</p>'}`;
  },
  inspect() {
    const k = kit();
    const rows = Object.entries(k.spots)
      .map(([id, s]) => {
        const seen = g.looked[id];
        return `<li><div><strong>${esc(s.name)}</strong><br><span class="${seen == null ? 'muted' : ''}">${seen == null ? 'Not looked at yet.' : esc(seen ? s.cue : s.sound)}</span></div>
        <div class="row">${seen == null ? `<button data-act="look" data-id="${id}">Look closely (15 min)</button>` : ''}
        <label><input type="checkbox" data-flag="${id}" ${flags[id] ? 'checked' : ''}> Flag it</label></div></li>`;
      })
      .join('');
    return `<h2>${esc(k.inspect.title)}</h2>
      <p>${esc(k.inspect.intro)} Look over whatever you think matters,
      and flag anything you want the crew to open up. A real fault costs the crew ${2} hours to fix; a false alarm costs ${3} hours
      of taking things apart for nothing. Anything you miss is still there.</p>
      <ul class="spots">${rows}</ul>
      <button class="primary" data-act="inspect-done">Hand your list to Kowalski</button>`;
  },
  board() {
    const load = g.round.propellantLoad,
      e = g.round.estimate;
    const orbital = g.vehicle === 'vanguard';
    if (kit().deep)
      return `<h2>Drawing board: propellant load</h2>
      <p>A shot at the Moon needs every kilogram the stages will hold: anything short of full and she will not reach escape speed.
      The range clears the Atlantic whatever you sign. The figure is 100%.</p>
      <p>Propellant load: <strong>100%</strong></p>
      <button class="primary" data-act="board-done">Sign the figure and send it to the range</button>`;
    return `<h2>Drawing board: propellant load</h2>
      <p>${
        orbital
          ? 'The range wants a figure for the flight. Every kilogram short of a full load comes off the orbit: too low a perigee and the sphere will not stay up long. The range clears the sea whatever you sign.'
          : 'The range wants a figure for the flight. A fuller tank flies higher, but lands further out, and the range has to clear more ground.'
      } ${e.flights ? `The drawing office's estimate is built on ${e.flights === 1 ? 'one good flight' : `${e.flights} good flights`} of this kind so far.` : `The drawing office's estimate has a wide spread: nobody has flown a ${esc(kit().name)} round here before.`}</p>
      <label class="slider">Propellant load: <strong data-live="load">${Math.round(load * 100)}%</strong>
      <input type="range" min="85" max="100" step="1" value="${Math.round(load * 100)}" data-act="load"></label>
      <p>${orbital ? 'Estimated perigee, if all three stages work' : 'Estimated peak'}: <strong data-live="estimate">${e.low}–${e.high} km</strong>.</p>
      <button class="primary" data-act="board-done">Sign the figure and send it to the range</button>`;
  },
  static() {
    const s = g.stand,
      p = s.phase,
      walled = s.burn === 'long' && !!kit().stand.wall;
    const buttons = {
      ready: `<button class="primary" data-act="stand-start">Start the firing count</button><button data-act="stand-leak">Send the crew to leak-check first (2 h)</button>`,
      count: `<button class="danger" data-act="stand-hold">HOLD</button>`,
      held: `<button class="primary" data-act="stand-start">Resume the count</button><button data-act="stand-leak">Send the crew to leak-check (2 h)</button>`,
      leakcheck:
        '<p class="muted">The crew is on the stand checking every line. Watch them through the slit, or wait.</p>',
      firing: '<p class="muted">Firing…</p>',
      read: `<p>Read the trace. What do you want done before this stage flies?</p>
        <label><input type="checkbox" data-choice="rework"> ${esc(kit().stand.rework)} (8 hours: the launch slips a day)</label>
        <label><input type="checkbox" data-choice="leak"> Leak-check the feed system (2 hours)</label>
        <button class="primary" data-act="stand-decide">${conducting() ? 'Make it so' : 'Give your decision to Ellis'}</button>`,
      decided: '<p class="muted">Done. The crew is taking the stage back to the hangar.</p>',
      loose: '<p class="danger-text">She broke loose from the stand.</p>',
    }[p];
    return `<h2>Test stand dugout</h2>
      <p>Through the slit you can see the ${esc(kit().stand.thing)} in the stand. You're running this one. Watch the tank pressure while the stage is
      pressurised, hold if it looks wrong, then fire, and read the trace afterwards.</p>
      <div class="clock" data-live="standclock">—</div>
      <div class="gauges">${gaugeHTML('tank', 'Tank pressure', 'bar')}${gaugeHTML('pc', 'Chamber pressure', 'bar')}${walled ? gaugeHTML('wall', 'Chamber wall', 'K') : ''}</div>
      <p class="muted">Tank pressure normal: ${NORMAL_TANK[0]}–${NORMAL_TANK[1]} bar. Chamber pressure normal: ${kit().stand.pc[0]}–${kit().stand.pc[1]} bar.${walled ? ` Chamber wall: below ${kit().stand.wall[1]} K.` : ''}${s.burn === 'long' ? ' This is a full-duration firing: 30 seconds.' : ''}</p>
      ${s.trace ? '<canvas width="400" height="150"></canvas>' : ''}
      <div class="actions">${buttons}</div>`;
  },
  count() {
    const c = g.count;
    if (!c) return '<h2>Blockhouse</h2><p class="muted">The count is over.</p>';
    const conductor = conducting();
    const reports =
      c.poll && conductor && c.reports
        ? `<ul class="reports">${c.reports.map(r => `<li><strong>${esc(r.station)}</strong> (${esc(g.people[r.who].name)}): ${esc(r.text)}</li>`).join('')}</ul>`
        : '';
    const pollButtons = c.poll
      ? `<div class="poll"><p><strong>${c.poll === 'final' ? 'Final poll.' : 'Poll.'}</strong> ${conductor ? 'Your stations have reported. Check them against your own gauge, then make the call.' : 'Ellis wants your tank pressure. Read the gauge, then make your call.'}</p>
      ${reports}<button class="go" data-act="go">GO</button><button class="danger" data-act="nogo">NO-GO: hold</button></div>`
      : '';
    const holdButtons = c.checking
      ? '<p class="muted">The pad crew is out at the tower. The count recycles when they are back inside.</p>'
      : c.held && !c.poll
        ? `<button class="primary" data-act="resume">Resume the count</button><button data-act="count-leak">Send the pad crew to look for a leak</button>`
        : !c.poll
          ? '<button class="danger" data-act="hold">HOLD</button>'
          : '';
    return `<h2>Blockhouse: the count</h2>
      <p>${
        conductor
          ? 'You are the test conductor: you run the count from the centre console. Delgado has PRESS, Morgan the range, Vega the pad and the firing switch. The tank gauge is repeated on your console.'
          : "You're on the pressurisation panel (PRESS). Ellis runs the count; Vega has the firing switch."
      }
      You can call a hold at any time.</p>${blockhouseState(g.day).built ? '<p class="muted">The new blockhouse: thick walls, periscopes on the pad, and a telemetry rack along the back wall.</p>' : ''}
      <div class="clock" data-live="countclock">T-10:00</div><p class="center" data-live="countstate"></p>
      <div class="gauges">${gaugeHTML('ctank', 'Tank pressure', 'bar')}<div class="lamp on">IGNITER CIRCUIT<br>CONTINUITY</div></div>
      <p class="muted">Normal tank pressure: ${NORMAL_TANK[0]}–${NORMAL_TANK[1]} bar.</p>
      ${pollButtons}<div class="actions">${holdButtons}</div>`;
  },
  // The test conductor's plan for the round: who inspects, which firing, which checks, against the range slot.
  plan() {
    const slot = dateText(g.roundStart + PLANNED_LAUNCH_DAY);
    const opt = (name, value, label) =>
      `<label><input type="radio" name="${name}" value="${value}" ${plan[name] === value ? 'checked' : ''}> ${label}</label>`;
    return `<h2>Planning the round</h2>
      <p>The range has the round down for <strong>${esc(slot)}</strong>. Brandt wants it flown on that day. What you plan here decides what you can learn
      about her before then, and what it costs.</p>
      <h3>Who looks her over in the hangar</h3>
      ${Object.entries(INSPECTORS)
        .map(([id, person]) =>
          opt(
            'inspector',
            id,
            id === 'you' ? 'You, yourself' : `${esc(person.name)} (usually takes about ${person.hours} hours)`,
          ),
        )
        .join('<br>')}
      <h3>The firing on the stand</h3>
      ${opt('burn', 'short', 'A short start-up firing, 8 seconds. Shows a rough start or a leak.')}<br>
      ${opt('burn', 'long', `A full-duration firing, 30 seconds, ${kit().stand.long} The engine must be pulled and checked afterwards: the launch slips a day.`)}
      <h3>Before rollout</h3>
      <label><input type="checkbox" data-plan="leak" ${plan.leak ? 'checked' : ''}> A leak check of the whole feed system (2 hours on rollout day)</label>
      ${onBudget() ? budgetBlock() : ''}
      <p><button class="primary" data-act="plan-done">Put the plan on the board</button></p>`;
  },
  // The review as test conductor: the team's readings, and the call is yours.
  chair() {
    const r = g.readings || {};
    return `<h2>The review: you chair it</h2>
      <p>Kowalski, Morgan and Brandt are at the table, the range plot pinned up. Everyone looks at you.</p>
      <ul><li><strong>Kowalski</strong>, from the wreck: "${esc(kit().explanations[r.kowalski] || '')}"</li>
      <li><strong>Morgan</strong>, from the range data: "${esc(kit().explanations[r.morgan] || '')}"</li>
      <li><strong>Brandt</strong>: "${g.slipDays ? 'We lost range time on this round. Whatever it is, I want it fixed without losing more.' : 'Give me a finding I can take to the Navy.'}"</li></ul>
      <p class="muted">What you conclude becomes the fix for every round after this. Your notebook has everything you saw.</p>
      <div class="choices">${Object.entries(kit().explanations)
        .map(([k, t]) => `<button data-act="chair" data-id="${k}">${esc(t)}</button>`)
        .join('')}</div>`;
  },
  recovery() {
    const track = kit().track;
    const where = track
      ? `<h2>${esc(track.title)}</h2><p>${dateText()}, ${clockText()}. ${esc(track.intro)}</p>`
      : atSea()
        ? `<h2>The telemetry building</h2><p>${dateText()}, ${clockText()}. Morgan spreads the telemetry records and the radar plots on the table. Kowalski reads over your shoulder.</p>`
        : `<h2>The impact area</h2><p>${dateText()}, ${clockText()}. The truck pulls up in the scrub. You walk over with Morgan and Kowalski.</p>`;
    return `${where}
      <ul>${g.recovery.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="muted">All of this is in your notebook.</p>
      <button class="primary" data-act="back">${atSea() ? 'Back to the hangar' : 'Drive back to the site'}</button>`;
  },
  review() {
    return `<h2>Review with Ellis</h2>
      <p>Ellis and Morgan are at the table with the range plot pinned up. "Well? What happened to her?"</p>
      <p class="muted">Your notebook has everything you saw. Open it with N or the button at the top.</p>
      <div class="choices">${Object.entries(kit().explanations)
        .map(([k, t]) => `<button data-act="present" data-id="${k}">${esc(t)}</button>`)
        .join('')}</div>`;
  },
  // The calendar jumped past days that needed nobody in your seat, or the crew worked on overnight.
  away() {
    const a = g.away;
    if (!a) return '';
    return `<h2>While you were away</h2>
      <p class="muted">${esc(a.from)} to ${esc(a.to)}</p>
      <ul>${a.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <button class="primary" data-act="away-done">Carry on</button>`;
  },
  // The round is over: what you said, what Ellis concluded and what changes. Only what you could know.
  roundEnd() {
    const r = g.record.rounds[g.record.rounds.length - 1],
      i = nextIndex(),
      next = i != null ? SEASON[i] : null;
    const o = g.record.offers[g.record.offers.length - 1],
      here = o && o.day >= r.day;
    return `<h2>Written up: ${esc(r.name)}</h2>${recordLine(r)}${carriesForward()}
      ${here ? offerCard(o) : ''}
      ${next && !pendingOffer(g.record) ? `<p>Next: ${esc(next.name)}, from ${esc(dateText(roundStartOf(i)))}.</p><button class="primary" data-act="next-round">Carry on to the next round</button>` : ''}`;
  },
  seasonEnd() {
    const cap = t => t[0].toUpperCase() + t.slice(1);
    const boss = g.record.path === 'nasa' ? 'Your bosses' : g.people.ellis.name.split(' ').pop();
    const backed = n =>
      n === 0
        ? `${boss} never went with your reading.`
        : `${boss} went with your reading ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}.`;
    const rec = g.record,
      rs = rec.rounds,
      good = rs.filter(r => !/^Lost/.test(r.flight)).length;
    const o = rec.offers[rec.offers.length - 1],
      offer = o && o.day >= rs[rs.length - 1].day ? offerCard(o) : '';
    return `<h2>Your years on the range, 1945 to ${new Date(Date.UTC(1945, 0, 1) + rs[rs.length - 1].day * 86400000).getUTCFullYear()}</h2>
      <p>You are now ${esc(SEAT_PHRASE[rec.seat] || SEATS[rec.seat].toLowerCase())}.</p>
      <p>${rs.length} rounds, ${good} of them good flights. ${backed(rs.filter(r => r.agreed && r.yourCall !== 'unknown').length + rs.filter(r => r.wentWithYou).length)}</p>
      <ol>${rs.map(r => `<li><strong>${esc(cap(r.name))}</strong> (${esc(dateText(r.day))}): ${recordLine(r, true)}</li>`).join('')}</ol>
      ${rec.capabilities?.length ? `<p><strong>What your flights showed, as evidence Apollo can cite:</strong></p><ul>${rec.capabilities.map(c => `<li>${esc(c.text)} (${esc(c.flight)})</li>`).join('')}</ul>` : ''}
      ${offer}
      <p class="muted">${esc(LAST_WORD[rs[rs.length - 1].id] || '')}</p>
      <button data-act="game-new">Start again from 1945</button>`;
  },
};

// Your budget line for the Viking firings: what is left this fiscal year, and what the plan will cost.
function budgetBlock() {
  const b = budgetLine(),
    cost = planCost(plan),
    left = b.line - b.spent;
  return `<div class="budget" data-live="budget"><h3>Your budget line, fiscal ${b.fy}</h3>
    <p>${dollars(b.line)} for your Viking firings this year; ${dollars(b.spent)} spent, ${dollars(left)} left. This plan: <strong>${dollars(cost)}</strong>.</p>
    <p class="muted">Crew inspection: Kowalski ${dollars(COSTS.inspect.kowalski)}, Delgado ${dollars(COSTS.inspect.delgado)}. Full-duration firing ${dollars(COSTS.long)}. Leak check ${dollars(COSTS.leak)}.
    A rework on the stand ${dollars(COSTS.rework)}. Each day of range time lost ${dollars(COSTS.slipDay)}. Going over the line is allowed, but it goes on your record.</p></div>`;
}

// A turning point's offer, or the news that you were passed over, with the buttons to answer it. The entry carries its
// own words when it has them (the way back from the uncrewed years speaks from JPL, not Houston); older saves fall back
// to the offer the seat names.
function offerCard(o) {
  const offer = offerBySeat(o.seat),
    from = g.people[o.from || offer.from || 'ellis'].name.split(' ').pop();
  if (!o.made)
    return `<div class="offer"><h3>Passed over, this time</h3><p>${esc(from)}: "${esc(offer.sidelined)}"</p>
    <p class="muted">You stay ${esc(SEATS[g.record.seat].toLowerCase())}, on quieter work for now. A better record brings the offer back.</p></div>`;
  if (!o.answer)
    return `<div class="offer"><h3>An offer: ${esc(o.title)}</h3><p>${esc(from)}: "${esc(o.again ? offer.again : o.text || offer.text)}"</p>
    <p class="muted">${esc(o.takeNote || offer.takeNote)} ${esc(o.declineNote || offer.declineNote)}</p>
    <button class="primary" data-act="offer-take">Take the job</button><button data-act="offer-decline">Turn it down, for now</button></div>`;
  return `<div class="offer"><p>${o.answer === 'taken' ? `You took the job: ${esc(o.title)}.` : o.answer === 'withdrawn' ? `The offer was withdrawn: ${esc(o.title)}. You keep the flight director's shift.` : 'You turned the offer down and kept your seat.'}</p></div>`;
}

// One round of your record, in words: the flight as the range saw it, your call, Ellis's conclusion and the fix.
// What the reviews so far have put into the build, so the next rounds are seen to be built differently: this round's new
// fixes first, then the ones already standing. Only what the team decided, never the hidden cause of a flight.
function carriesForward() {
  const fixes = fixesForCard(g.programme),
    fresh = fixes.filter(f => f.fresh),
    standing = fixes.filter(f => !f.fresh);
  const list = fs => `<ul class="fixes">${fs.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>`;
  return `<div class="carries"><p><strong>What carries into the next build</strong></p>
    ${fresh.length ? list(fresh) : '<p class="muted">No new fix from this round.</p>'}
    ${
      standing.length
        ? `<details><summary>Fixes already standing in the build (${standing.length})</summary>${list(standing)}</details>`
        : ''
    }</div>`;
}
function recordLine(r, inline = false) {
  if (r.yourCall == null) return inline ? esc(r.flight) : `<p>${esc(r.flight)}</p>`;
  const call = SHORT;
  const ellis =
    r.yourCall === 'unknown'
      ? 'Ellis made no call'
      : r.agreed
        ? 'Ellis agreed'
        : r.wentWithYou
          ? `Ellis read ${call[r.ellisView ?? r.ellis]} differently but went with you`
          : `Ellis overruled you: ${call[r.ellis]}`;
  const text = r.chaired
    ? `${r.flight} You chaired the review and ${r.yourCall === 'unknown' ? 'left the cause open' : `concluded ${call[r.yourCall]}`}.${r.slipDays ? ` The launch slipped ${r.slipDays === 1 ? 'a day' : `${r.slipDays} days`}.` : ''}${r.fix ? ` ${r.fix}` : ''}`
    : `${r.flight} You called ${call[r.yourCall]}. ${ellis}.${r.fix ? ` ${r.fix}` : ''}`;
  const money = r.budget
    ? ` Budget, fiscal ${r.budget.fy}: ${dollars(r.budget.spent)} of ${dollars(r.budget.line)}.`
    : '';
  return inline ? esc(text + money) : `<p>${esc(text + money)}</p>`;
}

// Clicks and changes inside the panel.
export function bindRoom(handlers) {
  hooks = handlers;
  const el = panel();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act,
      id = b.dataset.id;
    ({
      close: () => closeRoom(),
      look: () => lookAt(id),
      'inspect-done': () => {
        finishInspection(flags);
        flags = {};
        g.room = null;
      },
      'board-done': () => {
        finishBoard();
        g.room = null;
      },
      'stand-start': standStart,
      'stand-hold': standHold,
      'stand-leak': standLeakCheck,
      'stand-decide': () => {
        const c = {};
        el.querySelectorAll('[data-choice]').forEach(n => {
          c[n.dataset.choice] = n.checked;
        });
        standDecide(c);
      },
      go: () => countAnswer(true),
      nogo: () => countAnswer(false),
      hold: countHold,
      resume: countResume,
      'count-leak': countLeakCheck,
      back: () => returnFromRecovery(),
      'away-done': () => {
        closeAway();
        if (['roundEnd', 'seasonEnd'].includes(g.beat)) g.room = g.beat;
      },
      'next-round': () => nextRound(),
      'probe-command': () => advanceProbe(true),
      'probe-wait': () => advanceProbe(false),
      'probe-choice': () => advanceProbe(Number(id)),
      present: () => present(id),
      'plan-done': () => {
        finishPlan(plan);
        plan = { inspector: 'you', burn: 'short', leak: false };
        g.room = null;
      },
      chair: () => chair(id),
      'offer-take': () => answerFirstOffer(true),
      'offer-decline': () => answerFirstOffer(false),
      'game-new': () => {
        openGameRoom();
        confirmNew = true;
      },
      'game-cancel': () => {
        confirmNew = false;
        g.room = g.beat === 'seasonEnd' ? 'seasonEnd' : null;
      },
      'game-new-go': () => {
        confirmNew = false;
        handlers.again();
      },
      'game-restore': () => handlers.restore(),
    })[act]?.() ?? (CONTROL_ACTS[act] || LUNAR_ACTS[act])?.(id);
  });
  el.addEventListener('change', e => {
    if (e.target.dataset.flag) flags[e.target.dataset.flag] = e.target.checked;
    if (e.target.dataset.plan) plan[e.target.dataset.plan] = e.target.checked;
    if (e.target.type === 'radio' && e.target.name in plan) plan[e.target.name] = e.target.value;
    if ((e.target.dataset.plan || e.target.type === 'radio') && onBudget()) {
      const b = el.querySelector('[data-live=budget]');
      if (b) b.outerHTML = budgetBlock();
    }
  });
  el.addEventListener('input', e => {
    if (e.target.dataset.act !== 'load') return;
    setLoad(Number(e.target.value) / 100);
    el.querySelector('[data-live=load]').textContent = `${e.target.value}%`;
    el.querySelector('[data-live=estimate]').textContent = `${g.round.estimate.low}–${g.round.estimate.high} km`;
  });
}
