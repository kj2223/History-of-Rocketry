// THE PLOTTING BOARD: the big altitude plot in the middle of the control room. It shows the flight in progress (or the last one)
// as the radar tracked it, against the directive's altitude. Before the room has a plotting board, the radar calls are only
// marked as dots, as an engineer would pencil them onto graph paper.
import { DIRECTIVES } from '../data/history.js';
import { S } from '../core/state.js';
import { roomLevel } from '../rules/launch-site.js';
import { airborne, formatAltitude } from '../rules/flight.js';
import { launchView } from './launch-view.js';
import { $, setHTML } from './dom.js';

const WIDTH = 900, HEIGHT = 300, LEFT = 56, RIGHT = 16, TOP = 14, BOTTOM = 26;
const PLOT_FROM_LEVEL = 2; // the Plotting Board facility

// A tidy top for the altitude scale: 1, 2 or 5 times a power of ten, in metres.
function niceCeiling(value) {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
}
const kmLabel = metres => metres >= 1e4 ? Math.round(metres / 1000) + ' km' : (metres / 1000).toFixed(1) + ' km';

export function renderPlot() {
  const flight = airborne.flight, mission = airborne.mission, live = !!(flight || mission);
  const trace = flight ? flight.trace : mission ? mission.trace : launchView.lastTrace;
  const directive = DIRECTIVES[S.dir], target = directive ? directive.altitudeKm * 1000 : 0;
  const plotted = roomLevel() >= PLOT_FROM_LEVEL;
  $('#boardt').textContent = plotted ? `PLOTTING BOARD${live ? ' · ' + (flight ? flight.label : 'MERCURY') : trace.length ? ' · LAST FLIGHT' : ''}` : 'RADAR CALLS · NO PLOTTING BOARD';

  const highest = Math.max(1000, ...trace, target), top = niceCeiling(highest * 1.1), span = Math.max(60, trace.length * 1.15);
  const x = second => LEFT + second / span * (WIDTH - LEFT - RIGHT), y = metres => HEIGHT - BOTTOM - metres / top * (HEIGHT - TOP - BOTTOM);
  let svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="plot" role="img" aria-label="Altitude plot">`;
  // The grid: five altitude lines and a time line every so many seconds.
  for (let i = 0; i <= 5; i++) {
    const metres = top * i / 5;
    svg += `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y(metres)}" y2="${y(metres)}" class="grid"/><text x="${LEFT - 6}" y="${y(metres) + 3}" text-anchor="end" class="axis">${kmLabel(metres)}</text>`;
  }
  const every = niceCeiling(span / 8);
  for (let second = 0; second <= span; second += every) svg += `<line x1="${x(second)}" x2="${x(second)}" y1="${TOP}" y2="${HEIGHT - BOTTOM}" class="grid"/><text x="${x(second)}" y="${HEIGHT - 8}" text-anchor="middle" class="axis">T+${second}s</text>`;
  if (target) svg += `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y(target)}" y2="${y(target)}" class="goal"/><text x="${WIDTH - RIGHT - 4}" y="${y(target) - 5}" text-anchor="end" class="goal-t">DIRECTIVE ${directive.altitudeKm} km</text>`;
  if (plotted && trace.length) svg += `<polyline points="${trace.map((metres, second) => `${x(second).toFixed(1)},${y(metres).toFixed(1)}`).join(' ')}" class="trace${live ? '' : ' old'}"/>`;
  if (!plotted) svg += trace.map((metres, second) => second % 4 ? '' : `<circle cx="${x(second)}" cy="${y(metres)}" r="3" class="dot"/>`).join('');
  if (trace.length) {
    const last = trace.length - 1, metres = trace[last], reading = flight && flight.lastReadings.alt;
    svg += `<circle cx="${x(last)}" cy="${y(metres)}" r="${live ? 5 : 4}" class="now${live ? ' bl' : ''}"/><text x="${x(last) + 9}" y="${y(metres) - 6}" class="now-t">${reading ? formatAltitude(reading.value, reading.quality) : kmLabel(metres)}</text>`;
  } else svg += `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" text-anchor="middle" class="axis">${plotted ? 'The board is clear. The next flight will be plotted here.' : 'Radar calls are marked here by hand. A Plotting Board (Base desk) draws the whole track.'}</text>`;
  setHTML($('#plot'), svg + '</svg>');
}
