// THE LUNAR ROOMS: the technical office with JPL's tracking on the teletype, for the cruise out to the Moon and the
// encounter. They read only g.lunar, which the game fills from what the tracking stations report.
import { g } from '../game.js';
import { lunarMidcourse, lunarLead, CAMERA_LEADS, MOON_KM, MOON_RADIUS, LATE_REACH, SECOND_FIX, FIX_ERROR } from '../lunar.js';

const panel = () => document.getElementById('room');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = n => Math.round(n).toLocaleString('en-US');
const logHTML = L => `<div class="loop-in-room">${L.log.slice().reverse().map(l => `<div class="${l.tone}"><strong>${esc(l.at)}</strong> · ${esc(l.text)}</div>`).join('')}</div>`;
const LEAD_NOTE = { 30: 'The most pictures, but the high-voltage supply runs longest and is likeliest to arc over.', 17: 'What Ranger 7 did: a full set of pictures, and a normal run for the supply.', 10: 'The kindest to the supply, but the fewest pictures, and only the last close ones.' };

export const LUNAR_ROOMS = {
  cruise() {
    const L = g.lunar, ranger = L.vehicle === 'ranger';
    const poll = L.poll === 'midcourse' ? `<div class="poll"><p><strong>The midcourse call is yours.</strong> Burn now and the small motor can take out any error, but only as well as
      this rough fix knows it (give or take ${fmt(FIX_ERROR)} km). Wait for the ${SECOND_FIX}-hour fix and the error is known to about a hundred km, but by then she is
      so far out that the motor can only take out ${fmt(LATE_REACH)} km of it. The Moon is ${fmt(2 * MOON_RADIUS)} km across.</p>
      <button class="primary" data-act="lunar-mid" data-id="now">Burn now, on this fix</button><button data-act="lunar-mid" data-id="wait">Wait for the ${SECOND_FIX}-hour fix</button></div>` : '';
    return `<h2>The technical office: JPL's tracking</h2>
      <p>The teletype from JPL chatters in the corner. Morgan reads off each report and moves a pin on the plot: where she is, and which station has her.
      ${ranger ? 'Early on there is one decision to make: when to fire the midcourse motor.' : 'Pioneer has no motor of her own. All anyone can do now is watch.'}</p>
      <p><strong data-live="lhour">Hour 0</strong> of about ${fmt(L.total)} · <span data-live="lstation"></span> · <span data-live="ldist"></span></p>
      <canvas width="400" height="170" data-lunar="map"></canvas>
      ${poll}${logHTML(L)}`;
  },
  encounter() {
    const L = g.lunar, ranger = L.vehicle === 'ranger';
    const poll = L.poll === 'lead' ? `<div class="poll"><p><strong>When do the cameras go on?</strong> They take pictures from the moment they warm up until she hits.
      Every minute they run is more pictures, and another minute for the high-voltage supply to fail in the vacuum.</p>
      <div class="choices">${CAMERA_LEADS.map(m => `<button data-act="lunar-lead" data-id="${m}">${m} minutes out: ${esc(LEAD_NOTE[m])}</button>`).join('')}</div></div>` : '';
    return `<h2>The technical office: the encounter</h2>
      <p>Goldstone's dish has her coming in. ${ranger ? `The last fix put her about ${L.predicted < 100 ? 'less than 100' : fmt(Math.round(L.predicted / 100) * 100)} km from the aim point; the Moon's edge is ${fmt(MOON_RADIUS)} km from it.` : `The fix says she will pass the Moon at about ${fmt(Math.round(L.predicted / 1000) * 1000)} km.`}</p>
      <p><strong data-live="lmin"></strong>${ranger ? ' · <span data-live="lpics"></span>' : ''}</p>
      <canvas width="400" height="170" data-lunar="moon"></canvas>
      ${poll}${logHTML(L)}`;
  },
};

export const LUNAR_ACTS = {
  'lunar-mid': id => lunarMidcourse(id),
  'lunar-lead': id => lunarLead(Number(id)),
};

// The plot and the read-outs, every frame.
export function lunarLive() {
  const L = g.lunar;
  if (!L || !['cruise', 'encounter'].includes(g.room)) return;
  const el = panel(), set = (k, v) => { const n = el.querySelector(`[data-live=${k}]`); if (n) n.textContent = v; };
  if (g.room === 'cruise') {
    set('lhour', `Hour ${Math.floor(L.h)}`);
    set('lstation', L.station || '');
    set('ldist', `${fmt(Math.round(L.dist / 1000) * 1000)} km from Earth`);
    drawMap(el.querySelector('[data-lunar=map]'), L);
  } else {
    set('lmin', L.minutes > 0 ? `${Math.ceil(L.minutes)} minutes to ${L.vehicle === 'ranger' ? 'impact' : 'closest approach'}` : L.vehicle === 'ranger' ? 'Impact' : 'Closest approach');
    set('lpics', L.video === false ? 'No video' : L.video ? `${fmt(L.pictures)} pictures` : L.lead ? `Cameras on at ${L.lead} minutes` : 'Cameras off');
    drawMoon(el.querySelector('[data-lunar=moon]'), L);
  }
}

// Earth on the left, the Moon on the right, her track between them; a short shot's track turns back.
function drawMap(c, L) {
  if (!c) return;
  const ctx = c.getContext('2d'), w = c.width, h = c.height, x0 = 28, x1 = w - 34, mid = h * 0.62;
  const px = d => x0 + (x1 - x0) * d / MOON_KM, py = d => mid - 46 * Math.sin(Math.PI * Math.min(1, d / MOON_KM));
  ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2d5d8a'; ctx.beginPath(); ctx.arc(x0, mid, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#cfcab8'; ctx.beginPath(); ctx.arc(x1, mid, 8, 0, 7); ctx.fill();
  ctx.setLineDash([3, 4]); ctx.strokeStyle = '#4a5464'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const d = MOON_KM * i / 40; i ? ctx.lineTo(px(d), py(d)) : ctx.moveTo(px(d), py(d)); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#e8c66a'; ctx.lineWidth = 2; ctx.beginPath();
  // A track that turns back is drawn a little below the way out.
  let peak = 0;
  L.trail.forEach((d, i) => { const back = d < peak - 1; peak = Math.max(peak, d); const y = py(d) + (back ? 10 * (1 - d / peak) + 4 : 0); i ? ctx.lineTo(px(d), y) : ctx.moveTo(px(d), y); });
  ctx.stroke();
  const last = L.trail[L.trail.length - 1], back = last < peak - 1;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(L.dist), py(L.dist) + (back ? 10 * (1 - L.dist / peak) + 4 : 0), 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#a9b0bb'; ctx.font = '11px Georgia, serif';
  ctx.fillText('Earth', x0 - 14, mid + 26); ctx.fillText(`Moon, ${fmt(MOON_KM)} km`, x1 - 80, mid + 24);
  for (let k = 100000; k < MOON_KM; k += 100000) { ctx.fillText(`${k / 1000}k`, px(k) - 10, h - 6); }
}

// The Moon as Goldstone's plot shows it coming in: the aim point at the centre, where the fix says she will arrive, and
// the disc growing as she closes.
function drawMoon(c, L) {
  if (!c) return;
  const ctx = c.getContext('2d'), w = c.width, h = c.height, cx = w * 0.42, cy = h / 2;
  const r = Math.min(150, 22 * 60 / (L.minutes + 9));
  ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#cfcab8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(90,85,75,.35)';
  for (const [a, b, s] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.1, 0.35, 0.1], [0.4, -0.35, 0.08]]) { ctx.beginPath(); ctx.arc(cx + a * r, cy + b * r, s * r, 0, 7); ctx.fill(); }
  if (L.vehicle === 'ranger') {
    ctx.strokeStyle = '#6fc88a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
    const off = r * L.predicted / MOON_RADIUS, tx = cx + off * 0.8, ty = cy - off * 0.6;
    ctx.strokeStyle = '#e8c66a'; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, 7); ctx.stroke();
    if (L.video) {
      ctx.fillStyle = '#1d232b'; ctx.fillRect(w - 112, 10, 100, 76);
      ctx.fillStyle = `rgba(200,195,180,${0.35 + 0.4 * Math.random()})`;
      for (let i = 0; i < 18; i++) ctx.fillRect(w - 108 + Math.random() * 90, 14 + Math.random() * 66, 4 + Math.random() * 10, 2);
      ctx.fillStyle = '#a9b0bb'; ctx.font = '10px Georgia, serif'; ctx.fillText('Video', w - 108, 98);
    } else if (L.video === false) { ctx.fillStyle = '#d0634f'; ctx.font = '12px Georgia, serif'; ctx.fillText('NO VIDEO', w - 100, 30); }
  } else {
    const off = Math.min(w * 0.5, r * (1 + L.predicted / MOON_RADIUS / 12));
    ctx.strokeStyle = '#e8c66a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx + off, 0); ctx.lineTo(cx + off, h); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = '#a9b0bb'; ctx.font = '11px Georgia, serif';
  ctx.fillText(L.vehicle === 'ranger' ? 'green: the aim point · amber: where the last fix puts her' : 'amber: her line past the Moon (not to scale)', 8, h - 8);
}
