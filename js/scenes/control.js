// MERCURY CONTROL'S ROOMS: the Retrofire officer's console for the count and the flight, the simulator, the pad after a
// shutdown, Recovery's board and the review. Panels over the site, like the rooms at White Sands. They read only what
// Mercury Control could see: g.console and g.mission, which the game fills from the telemetry and the radars.
import { g, dateText, clockText } from '../game.js';
import { consoleStart, consolePoll, consoleAbort, consoleAim, padChoose, missionPresent, evidence, simStart, simClose, simOpen, toReview, board,
  plannedAngle, ABORT_LIMIT, PLAN, SEA_LIMIT, PAD_OPTIONS, SIM_MINUTES } from '../mercury.js';
import { KITS } from '../data/kits.js';

const panel = () => document.getElementById('room');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const CONTROL_ROOMS = {
  console() {
    const c = g.console;
    if (!c || c.kind !== 'flight') return '<h2>Mercury Control</h2><p class="muted">Your console is quiet.</p>';
    return `<h2>Mercury Control: the Retrofire officer's console</h2>
      <p>Hollis is in the middle of the row with his headset on. Albrecht has the booster, Morgan the network, Reyes the recovery forces. Your
      console has the trajectory plot and the impact computers, and the recovery board is on the wall.</p>${consoleBody(c)}`;
  },
  sim() {
    const c = g.console && g.console.kind === 'sim' ? g.console : null;
    const sims = g.record.sims || [];
    if (!c) return `<h2>The simulator</h2>
      <p>A copy of your console, wired to the sim supervisor's desk. He can give you any flight he likes: a clean one, a booster going off her line,
      an engine stopping early, a radar losing its track, a rough sea or a ship off station. Nobody can get hurt in here. Each sim takes about ${SIM_MINUTES} minutes.</p>
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
  mreview() {
    const k = KITS.redstone;
    return `<h2>The review, in Mercury Control</h2>
      <p>Hollis has the tapes spread on the console. Albrecht is on the line from Huntsville. "Well, Retro. What happened to her?"</p>
      <ul>${evidence().map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="muted">Your notebook has everything you saw on the plot.</p>
      <div class="choices">${Object.entries(k.explanations).map(([key, t]) => `<button data-act="m-present" data-id="${key}">${esc(t)}</button>`).join('')}</div>`;
  },
};

// The console itself, at whatever point the count or the flight has reached.
function consoleBody(c) {
  const head = `<div class="clock" data-live="mclock">—</div><p class="center" data-live="mstate"></p>`;
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
  if (c.phase === 'ascent') return `${head}${readouts()}<canvas data-plot width="440" height="170"></canvas>
    <p class="muted">The plot: the flight-path angle against the planned line. Mission rule: abort if she is more than ${ABORT_LIMIT} degrees off it.
    Planned at cutoff: ${PLAN.v} km/s at ${PLAN.gamma} degrees, at about ${PLAN.burn} seconds.</p>
    <div class="actions">${c.abortAt == null ? '<button class="danger" data-act="m-abort">ABORT</button>' : ''}</div>`;
  if (c.phase === 'ip') return `${head}${readouts()}<canvas data-plot width="440" height="170"></canvas><div class="poll">
    <p><strong>Where does Recovery send the helicopters?</strong> The planned point is ${PLAN.range} km downrange.</p>
    <ul class="reports"><li>Radar impact point: <strong>${Math.round(c.ip.radar)} km</strong> ${c.ip.intermittent ? '<span class="danger-text">(track intermittent: dropouts on the plot)</span>' : '(solid track)'}</li>
    <li>Computer, from the cutoff velocity and angle on telemetry: <strong>${Math.round(c.ip.telemetry)} km</strong> (good to about 25 km)</li></ul>
    <button data-act="m-aim" data-id="radar">The radar's point</button><button data-act="m-aim" data-id="telemetry">The computer's point</button><button data-act="m-aim" data-id="planned">The planned point</button></div>`;
  if (c.phase === 'coast') return `${head}${readouts()}<p class="muted">The capsule is coasting. Recovery is on its way.</p>`;
  return `${head}<p class="muted">Done.</p>`;
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
  set('[data-live=mclock]', c.phase === 'count' || c.phase === 'hold' || c.poll || c.phase === 'poll' ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}` : c.phase === 'pad' ? 'SHUTDOWN' : `T+${Math.floor(c.t)} s`);
  set('[data-live=mstate]', c.phase === 'hold' ? 'HOLDING' : c.poll || c.phase === 'poll' ? 'Waiting for your status' : c.phase === 'ascent' ? (c.abortAt != null ? 'ABORT' : 'Powered flight') : c.phase === 'ip' ? 'Cutoff: give Recovery a splashdown point' : c.phase === 'coast' ? 'Coasting' : 'Counting');
  const last = c.trace[c.trace.length - 1];
  if (last) { set('[data-live=mv]', last.v.toFixed(2)); set('[data-live=mg]', last.gamma.toFixed(1)); set('[data-live=moff]', (last.gamma - plannedAngle(last.t)).toFixed(1)); set('[data-live=ma]', last.acc.toFixed(1)); }
  const canvas = panel().querySelector('[data-plot]');
  if (canvas) plot(canvas, c);
}
function plot(canvas, c) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, span = 150, max = 20;
  const x = t => 30 + (t / span) * (w - 40), y = d => h / 2 - (d / max) * (h / 2 - 12);
  ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(110,200,120,.12)'; ctx.fillRect(30, y(ABORT_LIMIT), w - 40, y(-ABORT_LIMIT) - y(ABORT_LIMIT));
  ctx.strokeStyle = '#c94'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  for (const d of [ABORT_LIMIT, -ABORT_LIMIT]) { ctx.beginPath(); ctx.moveTo(30, y(d)); ctx.lineTo(w - 10, y(d)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = '#6c8'; ctx.beginPath(); ctx.moveTo(30, y(0)); ctx.lineTo(w - 10, y(0)); ctx.stroke();
  ctx.strokeStyle = '#f2e3a0'; ctx.lineWidth = 1.6; ctx.beginPath();
  c.trace.forEach((p, i) => { const d = Math.max(-max, Math.min(max, p.gamma - plannedAngle(p.t))); if (i) ctx.lineTo(x(p.t), y(d)); else ctx.moveTo(x(p.t), y(d)); });
  ctx.stroke();
  ctx.fillStyle = '#9aa'; ctx.font = '10px monospace';
  ctx.fillText(`+${ABORT_LIMIT}°`, 2, y(ABORT_LIMIT) + 3); ctx.fillText(`-${ABORT_LIMIT}°`, 2, y(-ABORT_LIMIT) + 3); ctx.fillText('0', 14, y(0) + 3);
  ctx.fillText('degrees off the planned flight-path angle · seconds after liftoff', 34, 12);
}

// Clicks in Mercury Control's panels.
export const CONTROL_ACTS = {
  'm-go': () => consolePoll(true), 'm-nogo': () => consolePoll(false), 'm-abort': consoleAbort,
  'm-aim': id => consoleAim(id), pad: id => padChoose(id), 'm-present': id => missionPresent(id),
  'sim-start': simStart, 'sim-close': simClose, 'to-review': toReview,
};
export const openConsole = () => consoleStart();
