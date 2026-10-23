// THE PLOTTING BOARD: the big plot in the middle of the control room. It shows the flight in progress (or the last one) as the
// radar tracked it, against the directive's altitude: altitude over distance downrange, both to the same scale, so the track
// has the shape of the real flight path. A Mercury mission (no downrange track) is plotted against time instead.
// Under the track, FIDO's predicted arc (ui/trajectory.js) is drawn dashed in a band for its uncertainty: the next flight's plan
// on the ground, the flight's own prediction in the air. The flight's milestones (max Q, staging, cutoff, apogee) are marked on its track.
// Before the room has a plotting board, the radar calls are only marked as dots, as an engineer would pencil them onto graph paper.
import { DIRECTIVES } from '../data/history.js';
import { S } from '../core/state.js';
import { roomLevel } from '../rules/launch-site.js';
import { airborne, formatAltitude } from '../rules/flight.js';
import { launchView } from './launch-view.js';
import { planUnlocked, plannedFlight, trajectoryPanel } from './trajectory.js';
import { $, setHTML } from './dom.js';

const FULL_WIDTH = 900, BESIDE_PANEL_WIDTH = 600, HEIGHT = 300, LEFT = 56, RIGHT = 16, TOP = 14, BOTTOM = 26;
const PLOT_FROM_LEVEL = 2; // the Plotting Board facility

// A tidy top for the altitude scale: 1, 2 or 5 times a power of ten, in metres.
function niceCeiling(value) {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
}
const kmLabel = metres => metres >= 1e4 ? Math.round(metres / 1000) + ' km' : (metres / 1000).toFixed(1) + ' km';

// Every nth point of a path, and its last, so a long flight does not draw thousands of points.
const thinned = (points, most = 300) => points.filter((point, index) => index % Math.ceil(points.length / most) == 0 || index == points.length - 1);

export function renderPlot() {
  const flight = airborne.flight, mission = airborne.mission, live = !!(flight || mission);
  const prediction = flight ? launchView.planned : mission || !planUnlocked() ? null : plannedFlight();
  const planned = prediction && prediction.path, spread = prediction ? prediction.uncertainty : 0;
  let trace = flight ? flight.trace : mission ? mission.trace : launchView.lastTrace;
  const directive = DIRECTIVES[S.dir], target = directive ? directive.altitudeKm * 1000 : 0;
  const plotted = roomLevel() >= PLOT_FROM_LEVEL;
  const WIDTH = trajectoryPanel.open && planUnlocked() ? BESIDE_PANEL_WIDTH : FULL_WIDTH; // narrower beside the trajectory panel, at the same height
  $('#boardt').textContent = plotted ? `PLOTTING BOARD${live ? ' · ' + (flight ? flight.label : 'MERCURY') : trace.length ? ' · LAST FLIGHT' : ''}` : 'RADAR CALLS · NO PLOTTING BOARD';

  const range = flight ? flight.rangeTrace : mission ? null : launchView.lastRangeTrace || (planned && []);
  if (range && !range.length) trace = []; // a Mercury mission's track has no downrange: the next flight's plan clears it from the board
  // Metres per pixel: the same both ways when plotting downrange, so a climb looks like a climb.
  const plotWidth = WIDTH - LEFT - RIGHT, plotHeight = HEIGHT - TOP - BOTTOM, highest = Math.max(1000, ...trace, target, planned ? Math.max(...planned.altitude) * (1 + spread) : 0) * 1.1;
  const across = range ? Math.max(1000, ...range, planned ? Math.max(...planned.downrange) * (1 + spread) : 0) * 1.1 : Math.max(60, trace.length * 1.15);
  const metresPerPixel = range ? Math.max(highest / plotHeight, across / plotWidth) : highest / plotHeight;
  const top = metresPerPixel * plotHeight, span = range ? metresPerPixel * plotWidth : across;
  const xOf = index => LEFT + (range ? range[index] : index) / span * plotWidth, y = metres => HEIGHT - BOTTOM - metres / top * plotHeight;
  let svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="plot" role="img" aria-label="${range ? 'Altitude against distance downrange' : 'Altitude against time'}">`;
  // The grid: square when plotting downrange, labelled in km (or seconds for a mission).
  const step = niceCeiling(top / 5);
  for (let metres = 0; metres <= top; metres += step) svg += `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y(metres)}" y2="${y(metres)}" class="grid"/><text x="${LEFT - 6}" y="${y(metres) + 3}" text-anchor="end" class="axis">${kmLabel(metres)}</text>`;
  const every = range ? step : niceCeiling(span / 8);
  for (let mark = 0; mark <= span; mark += every) {
    const x = LEFT + mark / span * plotWidth;
    svg += `<line x1="${x}" x2="${x}" y1="${TOP}" y2="${HEIGHT - BOTTOM}" class="grid"/><text x="${x}" y="${HEIGHT - 8}" text-anchor="middle" class="axis">${range ? kmLabel(mark) : `T+${mark}s`}</text>`;
  }
  if (target) svg += `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y(target)}" y2="${y(target)}" class="goal"/><text x="${WIDTH - RIGHT - 4}" y="${y(target) - 5}" text-anchor="end" class="goal-t">DIRECTIVE ${directive.altitudeKm} km</text>`;
  if (planned) {
    const points = thinned(planned.altitude.map((metres, index) => [planned.downrange[index], metres]));
    const at = scale => points.map(([downrange, metres]) => `${(LEFT + downrange * scale / span * plotWidth).toFixed(1)},${y(metres * scale).toFixed(1)}`);
    svg += `<polygon points="${[...at(1 + spread), ...at(1 - spread).reverse()].join(' ')}" class="band"/><polyline points="${at(1).join(' ')}" class="plan"/>`;
  }
  if (plotted && trace.length) svg += `<polyline points="${trace.map((metres, index) => `${xOf(index).toFixed(1)},${y(metres).toFixed(1)}`).join(' ')}" class="trace${live ? '' : ' old'}"/>`;
  if (!plotted) svg += trace.map((metres, index) => index % 4 ? '' : `<circle cx="${xOf(index)}" cy="${y(metres)}" r="3" class="dot"/>`).join('');
  // The flight's milestones, marked on the track where they happened (liftoff is left off: it is the origin).
  const events = range ? (flight ? flight.events : launchView.lastEvents || []) : [];
  if (plotted && trace.length) svg += events.filter(event => event.key != 'liftoff').map(event => {
    const x = LEFT + event.downrange / span * plotWidth, height = y(event.altitude);
    return `<circle cx="${x.toFixed(1)}" cy="${height.toFixed(1)}" r="3" class="mark"/><text x="${(x + 6).toFixed(1)}" y="${(height + 12).toFixed(1)}" class="mark-t">${event.label}</text>`;
  }).join('');
  if (trace.length) {
    const last = trace.length - 1, metres = trace[last], reading = flight && flight.lastReadings.alt;
    svg += `<circle cx="${xOf(last)}" cy="${y(metres)}" r="${live ? 5 : 4}" class="now${live ? ' bl' : ''}"/><text x="${xOf(last) + 9}" y="${y(metres) - 6}" class="now-t">${reading ? formatAltitude(reading.value, reading.quality) : kmLabel(metres)}</text>`;
  } else if (!planned) svg += `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" text-anchor="middle" class="axis">${plotted ? 'The board is clear. The next flight will be plotted here.' : 'Radar calls are marked here by hand. A Plotting Board (Base desk) draws the whole track.'}</text>`;
  setHTML($('#plot'), svg + '</svg>');
}
