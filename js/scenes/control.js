// MERCURY CONTROL'S ROOMS: the Retrofire officer's console for the count and the flight, the simulator, the pad after a
// shutdown, Recovery's board and the review. Panels over the site, like the rooms at White Sands. They read only what
// Mercury Control could see: g.console and g.mission, which the game fills from the telemetry and the radars.
import { g, dateText, clockText, placeName } from '../game.js';
import { consoleStart, consolePoll, consoleAbort, consoleAim, padChoose, missionPresent, evidence, simStart, simClose, simOpen, toReview, board,
  consoleInsertion, consolePack, consoleRetro, consoleDecide, shutdownChoose, SHUTDOWN_OPTIONS, lookSpot, flagSpot, runQual, capsuleSpots, qualTests, programOf, routeArgue, routeDone, orbitMisses, plannedAngleFor, planFor, ABORT_LIMIT, SEA_LIMIT, PAD_OPTIONS, PACK_OPTIONS, RETRO_OPTIONS, SIM_MINUTES } from '../mercury.js';
import { KITS } from '../data/kits.js';
import { ROUTE_MODES } from '../data/route.js';
import { SEASON } from '../data/campaign.js';

const panel = () => document.getElementById('room');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const CONTROL_ROOMS = {
  console() {
    const c = g.console;
    if (!c || c.kind !== 'flight') return `<h2>${esc(placeName('office'))}</h2><p class="muted">Your console is quiet.</p>`;
    if (programOf() !== 'mercury') return houstonIntro(c) + consoleBody(c, !!c.auto);
    if (c.auto) return `<h2>Mercury Control: the back room</h2>
      <p>You are behind the glass with the capsule drawings and a headset on Hollis's loop. Tate has the Retrofire console; he makes the calls on the
      count, the climb and the splashdown point. When the hardware does something odd, Hollis asks you.</p>${consoleBody(c, true)}`;
    return `<h2>Mercury Control: the Retrofire officer's console</h2>
      <p>Hollis is in the middle of the row with his headset on. Albrecht has the booster, Morgan the network, Reyes the recovery forces. Your
      console has the trajectory plot and the impact computers, and the recovery board is on the wall.</p>${consoleBody(c)}`;
  },
  sim() {
    const c = g.console && g.console.kind === 'sim' ? g.console : null;
    const sims = g.record.sims || [];
    if (!c) return `<h2>The simulator</h2>
      <p>A copy of your console, wired to the sim supervisor's desk. He can give you any flight he likes: a clean one, a booster going off her line,
      an engine stopping early, a radar losing its track, a rough sea or a ship off station${g.mission && SEASON[g.roundIndex].orbital ? ', and in orbit a warning light, a bad horizon scanner or a short orbit' : ''}. Nobody can get hurt in here. Each sim takes about ${SIM_MINUTES} minutes.</p>
      ${sims.length ? `<p>Your sims so far: ${sims.length}, with ${sims.reduce((a, s) => a + s.right, 0)} of ${sims.reduce((a, s) => a + s.of, 0)} calls right.</p>` : '<p class="muted">You have not run a sim yet.</p>'}
      ${simOpen() ? '<button class="primary" data-act="sim-start">Run a launch sim</button>' : '<p class="muted">Not now: the real flight has the consoles.</p>'}`;
    if (c.phase === 'debrief') {
      const d = c.debrief;
      return `<h2>Sim debrief</h2><p><strong>What the sim supervisor gave you:</strong> ${esc(d.scenario)}</p>
        ${d.lines && d.lines.length ? `<ul>${d.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        <ul>${d.graded.map(x => `<li>${esc(x.what)}: <strong class="${x.right ? 'go-text' : 'danger-text'}">${x.right ? 'right' : 'wrong'}</strong></li>`).join('')}</ul>
        <p>${d.right} of ${d.of} right.</p>
        <button class="primary" data-act="sim-close">Done</button>`;
    }
    return `<h2>The simulator <span class="muted">(a sim: nobody is flying)</span></h2>
      <div class="loop-in-room">${c.chatter.map(l => `<div class="${l.tone}"><b>${esc(l.who)}:</b> ${esc(l.text)}</div>`).join('')}</div>${consoleBody(c)}`;
  },
  splash() {
    const c = g.console;
    const lines = c ? c.lines : (g.mission && g.mission.lines) || [];
    return `<h2>Recovery</h2><p>${dateText()}, ${clockText()}. Reyes reads the reports off the board as they come in from the ships.</p>
      <ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="muted">All of this is in your notebook.</p>
      <button class="primary" data-act="to-review">On to the review</button>`;
  },
  route() {
    const done = g.mission && g.mission.route, misses = orbitMisses();
    return `<h2>The route to the Moon, ${dateText()}</h2>
      <p>Headquarters, Langley, Marshall and Houston round one table in Mercury Control's conference room. The question is how Apollo goes to the Moon,
      and they want the Mercury controllers' view: none of the modes works unless Mission Control can find a ship and bring a crew down where it means to.</p>
      <ul>${Object.values(ROUTE_MODES).map(m => `<li><strong>${esc(m.name)}.</strong> ${esc(m.plan)} ${esc(m.case)} <span class="muted">${esc(m.who)}</span></li>`).join('')}</ul>
      <p><strong>What your flights showed:</strong> ${misses.length ? misses.map(x => `${Math.round(Math.abs(x))} km ${x >= 0 ? 'long' : 'short'}`).join(', ') + ' from the planned point.' : 'no orbital flight of yours came home on a computed point.'} Nobody has yet tried a rendezvous anywhere.</p>
      ${done ? `<p>${esc(done.reply)}</p><p class="muted">The decision is NASA's. It is in your notebook.</p><button class="primary" data-act="route-done">Leave the meeting</button>`
        : `<div class="choices">${Object.entries(ROUTE_MODES).map(([k, m]) => `<button data-act="route" data-id="${k}">Argue for ${esc(m.name.toLowerCase())}</button>`).join('')}</div>`}`;
  },
  // The project engineer's day: the capsule's spots in Hangar S, and the qualification tests.
  checkout() {
    const m = g.mission || {}, k = KITS[g.vehicle];
    return `<h2>${esc(placeName('hangar'))}: the spacecraft on its stand</h2>
      <p>McDonnell's crew has her opened up for you. Each look takes about forty minutes. Flag what you don't like: Hangar S reworks it overnight,
      and any flag slips the launch a day.</p>
      <ul class="reports">${capsuleSpots().map(id => { const seen = m.checkout?.[id], flagged = m.flags?.[id];
        return `<li><strong>${esc(k.spots[id].name)}</strong>${seen ? `: ${esc(seen.text)}` : ''}<br>
          ${seen ? '' : `<button data-act="eng-look" data-id="${id}">Look it over</button>`}
          <button class="${flagged ? 'danger' : ''}" data-act="eng-flag" data-id="${id}">${flagged ? 'Flagged for rework (unflag)' : 'Flag for rework'}</button></li>`; }).join('')}</ul>
      <p class="muted">${esc(k.maker || 'The Atlas is Convair\'s. Your job is the capsule.')}</p>`;
  },
  qual() {
    const m = g.mission || {};
    return `<h2>The test rooms</h2>
      <p>The qualification rigs for the capsule. Each test takes a few hours; the trace tells you whether the hardware stayed in its band.</p>
      <ul class="reports">${Object.entries(qualTests()).map(([id, t]) => { const r = m.quals?.[id];
        return `<li><strong>${esc(t.name)}.</strong> ${esc(t.what)} <span class="muted">About ${Math.round(t.minutes / 60)} hours.</span><br>
          ${r ? `<strong class="${r.bad ? 'danger-text' : 'go-text'}">${esc(r.text)}</strong>` : `<button data-act="eng-qual" data-id="${id}">Run it</button>`}</li>`; }).join('')}</ul>
      <p class="muted">Flag the capsule's parts in Hangar S if a trace worries you.</p>`;
  },
  mreview() {
    const k = KITS[g.vehicle] || KITS.redstone;
    return `<h2>The review, in ${esc(placeName('office'))}</h2>
      <p>Hollis has the tapes spread on the console. Albrecht is on the line from Huntsville. "Well, Retro. What happened to her?"</p>
      <ul>${evidence().map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="muted">Your notebook has everything you saw on the plot.</p>
      <div class="choices">${Object.entries(k.explanations).map(([key, t]) => `<button data-act="m-present" data-id="${key}">${esc(t)}</button>`).join('')}</div>`;
  },
};

// The console itself, at whatever point the count or the flight has reached.
function consoleBody(c, backRoom = false) {
  const html = consoleView(c);
  // In the back room the Retrofire officer's calls are Tate's: you see them, but they are not your buttons.
  return backRoom ? html.replace(/<button[^>]*data-act="m-(go|nogo|abort|insert|aim)"[^>]*>.*?<\/button>/g, '') : html;
}
function consoleView(c) {
  const head = `<div class="clock" data-live="mclock">—</div><p class="center" data-live="mstate"></p>`;
  if (c.phase === 'shutdown') return `${head}<div class="poll"><p><strong>The Titan lit and shut down on the pad. The crew sat tight.</strong> The spacecraft and the booster are being safed. How hard do we look before we try again? Gemini 7 is waiting in orbit.</p>
    ${Object.entries(SHUTDOWN_OPTIONS).map(([k, t]) => `<button data-act="m-shutdown" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
  if (c.phase === 'pad') return `${head}<div class="poll"><p><strong>The capsule is sitting on the pad on a fuelled booster, its parachutes draped over the side.</strong>
    The batteries are live and the pyrotechnics armed. Hollis turns round: "Retro, ideas?"</p>
    ${Object.entries(PAD_OPTIONS).map(([k, t]) => `<button data-act="pad" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
  if (c.poll || c.phase === 'poll') {
    const b = board(c);
    return `${head}<div class="poll"><p><strong>${c.poll === 'final' ? 'Final status check.' : 'Recovery poll.'}</strong> Hollis wants your status on the recovery area. The mission rule: no launch with the sea above state ${SEA_LIMIT}.</p>
      <ul class="reports"><li>Sea state in the recovery area: <strong>${b.sea}</strong></li>${b.units.map(u => `<li>${esc(u.text)}: <strong class="${u.on ? '' : 'danger-text'}">${u.on ? 'on station' : 'NOT on station'}</strong></li>`).join('')}</ul>
      <button class="go" data-act="m-go">GO</button><button class="danger" data-act="m-nogo">NO-GO</button></div>`;
  }
  if (c.phase === 'hold') return `${head}<p class="muted">Holding.</p>`;
  if (c.phase === 'count') return `${head}<p class="muted">The count runs. Watch for Hollis's polls.</p>`;
  const P = planFor(c);
  if (c.phase === 'ascent') return `${head}${readouts()}<canvas data-plot width="440" height="170"></canvas>
    <p class="muted">The plot: the flight-path angle against the planned line. Mission rule: abort if she is more than ${ABORT_LIMIT} degrees off it.
    Planned at cutoff: ${P.v} km/s at ${P.gamma} degrees, at about ${P.burn} seconds.</p>
    <div class="actions">${c.abortAt == null ? '<button class="danger" data-act="m-abort">ABORT</button>' : ''}</div>`;
  if (c.phase === 'insertion') return `${head}${readouts()}<canvas data-plot width="440" height="170"></canvas><div class="poll">
    <p><strong>Go or no-go for orbit?</strong> A no-go now fires the retros at once and brings her down in the abort area, where the ships are. A go on an orbit that will not hold leaves her where no ship can reach.</p>
    <ul class="reports"><li>Velocity at cutoff on telemetry: <strong>${c.goddard.v.toFixed(3)} km/s</strong> (orbit needs about ${P.need} km/s, level)</li>
    <li>Flight-path angle: <strong>${c.goddard.gammaOff.toFixed(1)}°</strong> off level (every degree costs about 0.04 km/s)</li>
    <li>Goddard's computers: <strong class="${c.goddard.go ? 'go-text' : 'danger-text'}">${c.goddard.go ? 'GO' : 'NO-GO'}</strong></li></ul>
    <button class="go" data-act="m-insert" data-id="go">GO for orbit</button><button class="danger" data-act="m-insert" data-id="nogo">NO-GO</button></div>`;
  if (c.flight && ['mission', 'entry', 'ip', 'coast'].includes(c.phase)) return `${head}${flightBoard(c)}${c.phase === 'mission' ? flightCall(c) : c.phase === 'entry' ? '<p class="center"><strong>Blackout.</strong> Nothing to do but wait.</p>' : c.phase === 'ip' ? aimCall(c) : '<p class="muted">Recovery is on its way.</p>'}`;
  if (['orbit', 'pack', 'retro', 'entry'].includes(c.phase)) return `${head}${orbitBoard(c)}${orbitCall(c)}`;
  if (c.phase === 'ip' && c.orbital) return `${head}${orbitBoard(c)}<div class="poll">
    <p><strong>Where does Recovery send the helicopters?</strong> The carrier is on the planned point, with destroyers 300 km up and down the track.</p>
    <ul class="reports"><li>From the retrofire telemetry: <strong>${kmText(c.ip.retro)}</strong> of the planned point (uses the attitude the scanners reported)</li>
    <li>Grand Turk's radar: a fix after the blackout, good to about 15 km, but the helicopters wait about twenty minutes for it</li></ul>
    <button data-act="m-aim" data-id="retro">The retrofire prediction</button><button data-act="m-aim" data-id="radar">Wait for the radar</button><button data-act="m-aim" data-id="planned">The planned point</button></div>`;
  if (c.phase === 'ip') return `${head}${readouts()}<canvas data-plot width="440" height="170"></canvas><div class="poll">
    <p><strong>Where does Recovery send the helicopters?</strong> The planned point is ${P.range} km downrange.</p>
    <ul class="reports"><li>Radar impact point: <strong>${Math.round(c.ip.radar)} km</strong> ${c.ip.intermittent ? '<span class="danger-text">(track intermittent: dropouts on the plot)</span>' : '(solid track)'}</li>
    <li>Computer, from the cutoff velocity and angle on telemetry: <strong>${Math.round(c.ip.telemetry)} km</strong> (good to about 25 km)</li></ul>
    <button data-act="m-aim" data-id="radar">The radar's point</button><button data-act="m-aim" data-id="telemetry">The computer's point</button><button data-act="m-aim" data-id="planned">The planned point</button></div>`;
  if (c.phase === 'coast') return `${head}${readouts()}<p class="muted">The capsule is coasting. Recovery is on its way.</p>`;
  return `${head}<p class="muted">Done.</p>`;
}
// Mission Control, Houston: the room, your seat in it, and the shift.
function houstonIntro(c) {
  const seat = g.record.seat;
  const where = seat === 'flight' ? 'You have the flight director\'s console in the middle row, and the room is yours on your shift. Every call on it is yours: the polls, the climb, and whatever the spacecraft throws at you.'
    : seat === 'retro' ? 'You have the Retrofire console in the front row, the trench. Dorsey is flight director; the calls on the climb, the splashdown point and the retrofire numbers are yours.'
    : 'You are in the back room with the spacecraft drawings and a headset on the loop. Tate has Retro and Dorsey is flight director. When the spacecraft does something odd, the call on the hardware is yours.';
  return `<h2>Mission Control, Houston</h2><p>${where}</p>`;
}
// The flight's board: the phase, the elapsed time and the lamps the flight plan has lit.
function flightBoard(c) {
  const f = c.flight;
  return `<div class="gauges"><div class="lamp on">${esc(f.craft.toUpperCase())}<br><b>${esc(f.phase)}</b></div><div class="lamp on">ELAPSED<br><b>${Math.floor(f.at)}</b> h</div>
    ${Object.entries(f.status).map(([k, [v, warn]]) => `<div class="lamp ${warn ? 'warn' : 'on'}">${esc(k)}<br><b>${esc(v)}</b></div>`).join('')}</div>`;
}
function flightCall(c) {
  const d = c.flight.decision;
  if (!d) return '<p class="muted">The flight runs. The calendar jumps between the moments your shift is on.</p>';
  if (!d.mine) return `<p class="muted">${esc(d.q)} ${d.who === 'hollis' ? 'The programme\'s call.' : 'Dorsey\'s call.'}</p>`;
  return `<div class="poll"><p><strong>${esc(d.q)}</strong></p>${d.rule ? `<p class="muted">Mission rule: ${esc(d.rule)}</p>` : ''}
    ${Object.entries(d.options).map(([k, t]) => `<button data-act="m-decide" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
}
function aimCall(c) {
  return `<div class="poll"><p><strong>Where does Recovery send the helicopters?</strong> The carrier is on the planned point.</p>
    <ul class="reports"><li>The spacecraft's computer: <strong>${kmText(c.ip.retro)}</strong> of the planned point (it steered for the point the ground gave it)</li>
    <li>The tracking ship's radar: a fix after the blackout, good to about 15 km, but the helicopters wait about twenty minutes for it</li></ul>
    ${c.auto && g.record.seat !== 'flight' ? '' : '<button data-act="m-aim" data-id="retro">The computer\'s point</button><button data-act="m-aim" data-id="radar">Wait for the radar</button><button data-act="m-aim" data-id="planned">The planned point</button>'}</div>`;
}
const kmText = x => `${Math.round(Math.abs(x))} km ${x >= 0 ? 'long' : 'short'}`;
// The orbital board: where she is, the fuel, the attitude, the window and the warning lights.
function orbitBoard(c) {
  const s = c.status || {};
  return `<div class="gauges"><div class="lamp on">ORBIT<br><b>${s.orbit ?? '—'}</b> of 3</div><div class="lamp on">OVER<br><b>${esc(s.station || '—')}</b></div>
    <div class="lamp ${s.fuel < 0.4 ? 'warn' : 'on'}">FUEL<br><b>${Math.round((s.fuel ?? 1) * 100)}</b>%</div><div class="lamp on">ATTITUDE (SCANNERS)<br><b>normal</b></div>
    <div class="lamp ${s.seg51 && s.seg51 !== 'off' ? 'warn' : 'on'}">SEGMENT 51<br><b>${s.seg51 && s.seg51 !== 'off' ? s.seg51 : 'off'}</b></div></div>
    ${s.window ? `<p class="muted">The pilot over Muchea: "${esc(s.window)}"</p>` : ''}`;
}
function orbitCall(c) {
  if (c.phase === 'pack') return `<div class="poll"><p><strong>Segment 51 says the landing bag is down, which would mean the heat shield is loose.</strong> What does he do with the retro pack after retrofire?</p>
    ${Object.entries(PACK_OPTIONS).map(([k, t]) => `<button data-act="m-pack" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
  if (c.phase === 'retro') return `<div class="poll"><p><strong>Retrofire over California.</strong> Where she lands depends on the attitude when the retros fire. Fuel left: ${Math.round(c.status.fuel * 100)}%.</p>
    ${Object.entries(RETRO_OPTIONS).map(([k, t]) => `<button data-act="m-retro" data-id="${k}">${esc(t)}</button>`).join('')}</div>`;
  if (c.phase === 'entry') return '<p class="center"><strong>Blackout.</strong> Nothing to do but wait.</p>';
  return '<p class="muted">She is in orbit. The stations report as she passes over them.</p>';
}
function readouts() {
  return `<div class="gauges"><div class="lamp on">VELOCITY<br><b data-live="mv">0.00</b> km/s</div><div class="lamp on">FLIGHT-PATH ANGLE<br><b data-live="mg">90.0</b>°</div>
    <div class="lamp on">OFF THE LINE<br><b data-live="moff">0.0</b>°</div><div class="lamp on">ACCELERATION<br><b data-live="ma">0.0</b> g</div></div>`;
}

// Clocks, readouts and the plot, every frame.
export function controlLive() {
  const c = g.console;
  if (!c || !['console', 'sim'].includes(g.room)) return;
  const set = (sel, v) => { const n = panel().querySelector(sel); if (n) n.textContent = v; };
  const orbitClock = m => `T+${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}:00`;
  if (c.flight && ['mission', 'entry', 'ip', 'coast'].includes(c.phase)) { set('[data-live=mclock]', `GET ${Math.floor(c.flight.at)}:${String(Math.floor((c.flight.at % 1) * 60)).padStart(2, '0')}`); set('[data-live=mstate]', c.flight.decision ? 'Waiting on a call' : c.phase === 'mission' ? c.flight.phase : 'Entry and recovery'); return; }
  if (c.orbitT != null && ['orbit', 'pack', 'retro', 'entry', 'ip'].includes(c.phase)) { set('[data-live=mclock]', orbitClock(c.orbitT)); set('[data-live=mstate]', { orbit: 'In orbit', pack: 'Coming up on retrofire', retro: 'Retrofire', entry: 'Blackout', ip: 'Give Recovery a splashdown point' }[c.phase]); return; }
  set('[data-live=mclock]', c.phase === 'count' || c.phase === 'hold' || c.poll || c.phase === 'poll' ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}` : c.phase === 'pad' ? 'SHUTDOWN' : `T+${Math.floor(c.t)} s`);
  set('[data-live=mstate]', c.phase === 'hold' ? 'HOLDING' : c.poll || c.phase === 'poll' ? 'Waiting for your status' : c.phase === 'ascent' ? (c.abortAt != null ? 'ABORT' : 'Powered flight') : c.phase === 'insertion' ? 'Sustainer cutoff: go or no-go for orbit' : c.phase === 'ip' ? 'Cutoff: give Recovery a splashdown point' : c.phase === 'coast' ? 'Coasting' : 'Counting');
  const last = c.trace[c.trace.length - 1];
  if (last) { set('[data-live=mv]', last.v.toFixed(2)); set('[data-live=mg]', last.gamma.toFixed(1)); set('[data-live=moff]', (last.gamma - plannedAngleFor(c, last.t)).toFixed(1)); set('[data-live=ma]', last.acc.toFixed(1)); }
  const canvas = panel().querySelector('[data-plot]');
  if (canvas) plot(canvas, c);
}
function plot(canvas, c) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, span = planFor(c).burn + 8, max = 20;
  const x = t => 30 + (t / span) * (w - 40), y = d => h / 2 - (d / max) * (h / 2 - 12);
  ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(110,200,120,.12)'; ctx.fillRect(30, y(ABORT_LIMIT), w - 40, y(-ABORT_LIMIT) - y(ABORT_LIMIT));
  ctx.strokeStyle = '#c94'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  for (const d of [ABORT_LIMIT, -ABORT_LIMIT]) { ctx.beginPath(); ctx.moveTo(30, y(d)); ctx.lineTo(w - 10, y(d)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = '#6c8'; ctx.beginPath(); ctx.moveTo(30, y(0)); ctx.lineTo(w - 10, y(0)); ctx.stroke();
  ctx.strokeStyle = '#f2e3a0'; ctx.lineWidth = 1.6; ctx.beginPath();
  c.trace.forEach((p, i) => { const d = Math.max(-max, Math.min(max, p.gamma - plannedAngleFor(c, p.t))); if (i) ctx.lineTo(x(p.t), y(d)); else ctx.moveTo(x(p.t), y(d)); });
  ctx.stroke();
  ctx.fillStyle = '#9aa'; ctx.font = '10px monospace';
  ctx.fillText(`+${ABORT_LIMIT}°`, 2, y(ABORT_LIMIT) + 3); ctx.fillText(`-${ABORT_LIMIT}°`, 2, y(-ABORT_LIMIT) + 3); ctx.fillText('0', 14, y(0) + 3);
  ctx.fillText('degrees off the planned flight-path angle · seconds after liftoff', 34, 12);
}

// Clicks in Mercury Control's panels.
export const CONTROL_ACTS = {
  'm-go': () => !g.console?.auto && consolePoll(true), 'm-nogo': () => !g.console?.auto && consolePoll(false), 'm-abort': () => !g.console?.auto && consoleAbort(),
  'm-aim': id => !g.console?.auto && consoleAim(id), 'm-decide': id => consoleDecide(id), 'm-shutdown': id => shutdownChoose(id), 'm-insert': id => !g.console?.auto && consoleInsertion(id === 'go'), 'm-pack': id => consolePack(id), 'm-retro': id => consoleRetro(id), pad: id => padChoose(id), 'm-present': id => missionPresent(id),
  'sim-start': simStart, 'eng-look': id => lookSpot(id), 'eng-flag': id => flagSpot(id), 'eng-qual': id => runQual(id), route: id => routeArgue(id), 'route-done': routeDone, 'sim-close': simClose, 'to-review': toReview,
};
export const openConsole = () => consoleStart();
