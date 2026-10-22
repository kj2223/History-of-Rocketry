// THE CONTROL-ROOM PICTURE on the Launch tab and in the launch view, drawn as SVG from the room level, the staffed stations and the
// console count; and the flight instruments, drawn in that room's own hardware.
import { ROOMS, STATIONS } from '../data/launch-site.js';

const fill = (colour, extra = '') => `style="fill:${colour};${extra}"`;
const FONT = 'font-family:inherit';
// A seated figure whose shoulders sit on top edge y.
const person = (x, y) => `<circle cx="${x}" cy="${y - 17}" r="4.5" ${fill('var(--dim)')}/><rect x="${x - 7}" y="${y - 12}" width="14" height="13" rx="4" ${fill('var(--dim)')}/>`;
// A console desk with its station's call sign and, when staffed, three lamps (blinking in flight).
function consoleDesk(x, y, callSign, staffed, flying) {
  let svg = `<rect x="${x - 28}" y="${y}" width="56" height="14" rx="2" ${fill('var(--ln)')}/>`;
  if (callSign) svg += `<text x="${x - 25}" y="${y + 10}" ${fill('var(--bg)', `font-size:7.5px;font-weight:bold;${FONT}`)}>${callSign}</text>`;
  if (staffed) for (let i = 0; i < 3; i++) svg += `<circle class="lt${flying ? ' bl' : ''}" cx="${x + 12 + i * 6}" cy="${y + 7}" r="1.8" ${fill(i == 2 ? 'var(--wn)' : 'var(--ac)', `animation-delay:${i * .19}s`)}/>`;
  return svg;
}

// Where the seats are, by room level: [y, [x positions]] per row, back row first.
const SEAT_ROWS = level => level < 2 ? [[118, [210, 255, 300, 345, 390]]]
  : level < 4 ? [[128, [60, 130, 200, 270, 340, 410, 480, 550]]]
  : level < 5 ? [[118, [110, 180, 250, 320, 390, 460]], [156, [75, 145, 215, 285, 355, 425, 495]]]
  : [[118, [120, 190, 260, 330, 400, 470]], [154, [90, 160, 230, 300, 370, 440, 510]], [190, [60, 130, 200, 270, 340, 410, 480, 550]]];

// The room. level: 0 to 5. crew: station ids on the net. consoles: how many seats have desks. flying: lamps blink.
// bubbles: { station id: { t: text, c: 'go' | 'no' | other } } speech bubbles over the stations.
export function roomSVG(level, crew, consoles, flying, bubbles = {}) {
  const height = level >= 5 ? 212 : level == 4 ? 182 : 175;
  let svg = `<svg viewBox="0 0 600 ${height}" class="room" role="img" aria-label="${ROOMS[level].name}"><rect width="600" height="100" ${fill('var(--pn)')}/><rect y="100" width="600" height="${height - 100}" ${fill('var(--bg)')}/><line x1="0" y1="100" x2="600" y2="100" style="stroke:var(--ln)"/>`;
  if (level < 2) svg += blockhouseWall(level);
  svg += boards(level);
  // Seats fill from the front row; back rows are drawn first so the front overlaps them.
  const seats = [];
  for (const [y, xs] of SEAT_ROWS(level).slice().reverse()) for (const x of xs) seats.push([x, y]);
  const drawn = seats.slice(0, Math.min(seats.length, consoles)).map((seat, index) => [...seat, crew[index]]).sort((first, second) => first[1] - second[1]);
  const speech = [];
  for (const [x, y, id] of drawn) {
    if (id && bubbles[id]) speech.push([x, y, bubbles[id]]);
    if (id) svg += person(x, y);
    if (level >= 2) svg += consoleDesk(x, y, id ? STATIONS[id].callSign : '', !!id, flying);
    else if (id) svg += `<text x="${x}" y="${y + 22}" text-anchor="middle" ${fill('var(--ink)', `font-size:8px;${FONT}`)}>${STATIONS[id].callSign}</text>`;
  }
  if (level < 2) svg += `<rect x="185" y="118" width="230" height="8" ${fill('var(--ln)')}/>`;
  for (const [x, y, bubble] of speech) {
    const width = Math.max(30, bubble.t.length * 6.2 + 12), colour = bubble.c == 'go' ? 'var(--ac)' : bubble.c == 'no' ? 'var(--bd)' : 'var(--wn)';
    svg += `<g class="bub"><rect x="${x - width / 2}" y="${y - 44}" width="${width}" height="15" rx="4" ${fill(colour)}/><path d="M${x - 4} ${y - 29.5} l4 5 l4 -5 z" ${fill(colour)}/><text x="${x}" y="${y - 33}" text-anchor="middle" ${fill('var(--bg)', `font-size:9px;font-weight:bold;${FONT}`)}>${bubble.t}</text></g>`;
  }
  return svg + '</svg>';
}
// The concrete blockhouse: block courses, slit windows onto the pad, a periscope; a teleprinter from level 1.
function blockhouseWall(level) {
  let svg = '';
  for (let y = 14; y < 100; y += 14) {
    svg += `<line x1="0" y1="${y}" x2="600" y2="${y}" style="stroke:var(--ln);opacity:.35"/>`;
    for (let x = (y / 14 % 2) * 30; x < 600; x += 60) svg += `<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y}" style="stroke:var(--ln);opacity:.35"/>`;
  }
  for (const windowX of [110, 410]) svg += `<rect x="${windowX}" y="34" width="80" height="18" ${fill('var(--bg)', 'stroke:var(--ln);stroke-width:4')}/><line x1="${windowX + 4}" y1="48" x2="${windowX + 76}" y2="48" style="stroke:var(--dim)"/><path d="M${windowX + 40} 36 l3 6 v6 h-6 v-6 z" ${fill('var(--ink)')}/>`;
  svg += `<rect x="296" y="0" width="8" height="58" ${fill('var(--ln)')}/><rect x="284" y="58" width="32" height="9" rx="2" ${fill('var(--ln)')}/>`;
  if (level >= 1) svg += `<rect x="500" y="80" width="60" height="38" ${fill('var(--ln)')}/><rect x="510" y="62" width="40" height="20" ${fill('var(--ink)', 'opacity:.6')}/><text x="530" y="112" text-anchor="middle" ${fill('var(--bg)', `font-size:7px;${FONT}`)}>TTY</text>`;
  return svg;
}
// The wall: a plotting board (level 2 up, where the flight's trace is drawn), strip-chart recorders (3 and 4),
// a world map with a ground track (4 up) and a status display (5).
function boards(level) {
  let svg = '';
  const plot = level >= 2 ? (level >= 5 ? [20, 10, 170, 80] : level >= 4 ? [20, 12, 220, 76] : [30, 12, 250, 76]) : null;
  if (plot) {
    const [x, y, width, height] = plot;
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${fill('var(--bg)', 'stroke:var(--ln);stroke-width:2')}/>`;
    for (let i = 1; i < 6; i++) svg += `<line x1="${x + width * i / 6}" y1="${y}" x2="${x + width * i / 6}" y2="${y + height}" style="stroke:var(--ln);opacity:.5"/>`;
    for (let i = 1; i < 4; i++) svg += `<line x1="${x}" y1="${y + height * i / 4}" x2="${x + width}" y2="${y + height * i / 4}" style="stroke:var(--ln);opacity:.5"/>`;
    svg += `<polyline class="cr-trace" data-b="${plot.join(',')}" points="" style="fill:none;stroke:var(--wn);stroke-width:2"/>`;
  }
  if (level == 3 || level == 4) for (let i = 0; i < 3; i++) {
    const x = 450 + i * 45;
    svg += `<rect x="${x}" y="20" width="38" height="78" ${fill('var(--ln)')}/><circle cx="${x + 11}" cy="40" r="7" ${fill('var(--bg)')}/><circle cx="${x + 27}" cy="40" r="7" ${fill('var(--bg)')}/><rect x="${x + 6}" y="62" width="26" height="4" ${fill('var(--bg)')}/>`;
  }
  if (level >= 4) {
    const x = level >= 5 ? 210 : 255, width = 180;
    svg += `<rect x="${x}" y="12" width="${width}" height="76" ${fill('var(--bg)', 'stroke:var(--ln);stroke-width:2')}/><ellipse cx="${x + width * .28}" cy="42" rx="${width * .12}" ry="16" ${fill('var(--ln)', 'opacity:.6')}/><ellipse cx="${x + width * .62}" cy="38" rx="${width * .16}" ry="13" ${fill('var(--ln)', 'opacity:.6')}/><ellipse cx="${x + width * .55}" cy="66" rx="${width * .07}" ry="10" ${fill('var(--ln)', 'opacity:.6')}/><path d="M${x} 50 ${Array.from({ length: 13 }, (_, i) => `L${x + i * width / 12} ${50 + Math.sin(i / 12 * 6.28) * 18}`).join(' ')}" style="fill:none;stroke:var(--ac);stroke-width:1.5"/>`;
  }
  if (level >= 5) {
    svg += `<rect x="410" y="10" width="170" height="80" ${fill('var(--bg)', 'stroke:var(--ln);stroke-width:2')}/>`;
    for (let i = 0; i < 6; i++) svg += `<rect x="420" y="${20 + i * 11}" width="${60 + ((i * 37) % 90)}" height="4" ${fill('var(--ac)', 'opacity:.55')}/>`;
  }
  return svg;
}

// Draw the flight's altitude trace on the plotting board, if the room has one.
export function updateTrace(trace) {
  for (const line of document.querySelectorAll('.cr-trace')) drawTrace(line, trace);
}
function drawTrace(line, trace) {
  if (!trace.length) {
    line.setAttribute('points', '');
    return;
  }
  const [x, y, width, height] = line.dataset.b.split(',').map(Number), highest = Math.max(1, ...trace), span = Math.max(40, trace.length);
  line.setAttribute('points', trace.map((value, index) => `${(x + 4 + index / span * (width - 8)).toFixed(1)},${(y + height - 4 - value / highest * (height - 10)).toFixed(1)}`).join(' '));
}

// FLIGHT INSTRUMENTS. Each channel: { label, value, max, text, lost (no track), none (not fitted), jitter (needle wobble, degrees) }.
// Blockhouse: rugged dials. Range control: a row of dials with scales. Mercury and later: digital readouts with status lamps.
const tickLabel = value => value >= 1e6 ? (value / 1e6).toFixed(0) + 'M' : value >= 1000 ? (value / 1000).toFixed(value >= 1e4 ? 0 : 1) + 'k' : String(Math.round(value));
const LABEL_STYLE = `font-size:9px;${FONT};letter-spacing:.08em`;
function dial(x, channel, level, flying) {
  const radius = level < 2 ? 46 : 52, cy = 70, startAngle = -135, endAngle = 135;
  const share = channel.value == null ? 0 : Math.max(0, Math.min(1.04, channel.value / channel.max)), jitter = channel.jitter || 0;
  const angle = (startAngle + (endAngle - startAngle) * share + jitter) * Math.PI / 180;
  let svg = `<circle cx="${x}" cy="${cy}" r="${radius + 6}" ${fill('var(--ln)')}/><circle cx="${x}" cy="${cy}" r="${radius}" ${fill('var(--bg)', level < 2 ? 'stroke:var(--ink);stroke-width:1;opacity:.95' : '')}/>`;
  for (let i = 0; i <= 10; i++) {
    const tick = (startAngle + (endAngle - startAngle) * i / 10) * Math.PI / 180, length = i % 5 ? 6 : 11;
    svg += `<line x1="${x + Math.sin(tick) * (radius - 2)}" y1="${cy - Math.cos(tick) * (radius - 2)}" x2="${x + Math.sin(tick) * (radius - 2 - length)}" y2="${cy - Math.cos(tick) * (radius - 2 - length)}" style="stroke:var(--ink);stroke-width:${i % 5 ? 1 : 2}"/>`;
    if (i % 5 == 0 && level >= 2) svg += `<text x="${x + Math.sin(tick) * (radius - 22)}" y="${cy - Math.cos(tick) * (radius - 22) + 3}" text-anchor="middle" ${fill('var(--dim)', `font-size:8px;${FONT}`)}>${tickLabel(channel.max * i / 10)}</text>`;
  }
  if (channel.none) return svg + `<rect x="${x - 34}" y="${cy - 9}" width="68" height="16" ${fill('var(--pn)', 'stroke:var(--ln)')}/><text x="${x}" y="${cy + 3}" text-anchor="middle" ${fill('var(--dim)', `font-size:8px;${FONT}`)}>NO CHANNEL</text><text x="${x}" y="${cy + radius + 20}" text-anchor="middle" ${fill('var(--dim)', LABEL_STYLE)}>${channel.label}</text>`;
  svg += `<line x1="${x}" y1="${cy}" x2="${x + Math.sin(angle) * (radius - 8)}" y2="${cy - Math.cos(angle) * (radius - 8)}" style="stroke:var(--wn);stroke-width:2.5;stroke-linecap:round"/><circle cx="${x}" cy="${cy}" r="4" ${fill('var(--ink)')}/>`;
  if (channel.lost) svg += `<rect x="${x - 30}" y="${cy + 12}" width="60" height="13" ${fill('var(--bd)')} class="${flying ? 'bl' : ''}"/><text x="${x}" y="${cy + 22}" text-anchor="middle" ${fill('var(--bg)', `font-size:8px;font-weight:bold;${FONT}`)}>NO TRACK</text>`;
  return svg + `<text x="${x}" y="${cy + radius + 20}" text-anchor="middle" ${fill('var(--dim)', LABEL_STYLE)}>${channel.label}</text><text x="${x}" y="${cy + radius + 33}" text-anchor="middle" ${fill('var(--ink)', `font-size:11px;font-weight:bold;${FONT}`)}>${channel.text}</text>`;
}
function readout(x, channel, flying) {
  const width = 134;
  let svg = `<rect x="${x - width / 2}" y="10" width="${width}" height="74" rx="3" ${fill('var(--ln)')}/><rect x="${x - width / 2 + 6}" y="26" width="${width - 12}" height="34" ${fill('var(--bg)')}/><text x="${x}" y="21" text-anchor="middle" ${fill('var(--pn)', `font-size:8px;font-weight:bold;letter-spacing:.12em;${FONT}`)}>${channel.label}</text>`;
  const shown = channel.none ? 'N/A' : channel.lost ? '----' : channel.text;
  svg += `<text x="${x + width / 2 - 12}" y="51" text-anchor="end" ${fill(channel.none ? 'var(--dim)' : channel.lost ? 'var(--bd)' : 'var(--ac)', "font-size:17px;font-family:'Courier New',monospace;font-weight:bold")} class="${channel.lost && flying ? 'bl' : ''}">${shown}</text>`;
  svg += `<circle cx="${x - width / 2 + 12}" cy="73" r="3.5" ${fill(channel.none ? 'var(--pn)' : channel.lost ? 'var(--bd)' : 'var(--ac)')}/><text x="${x - width / 2 + 20}" y="76" ${fill('var(--pn)', `font-size:7px;${FONT}`)}>${channel.none ? 'NOT FITTED' : channel.lost ? 'SIGNAL LOST' : 'SIGNAL'}</text>`;
  return svg;
}
export function gaugesSVG(level, channels, flying) {
  if (level < 2) channels = channels.filter(channel => !channel.none);
  const count = channels.length, width = 600, digital = level >= 4, height = digital ? 94 : 170, xs = channels.map((_, index) => width * (index + .5) / count);
  let svg = `<svg viewBox="0 0 ${width} ${height}" class="room gauges" role="img" aria-label="Flight instruments"><rect width="${width}" height="${height}" ${fill(digital ? 'var(--pn)' : 'var(--bg)')}/>`;
  if (level < 2) svg += `<rect x="20" y="8" width="${width - 40}" height="${height - 16}" rx="2" ${fill('var(--pn)', 'stroke:var(--ln);stroke-width:4')}/>`;
  channels.forEach((channel, index) => svg += digital ? readout(xs[index], channel, flying) : dial(xs[index], channel, level, flying));
  return svg + '</svg>';
}
