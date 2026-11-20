// THE RED-LINE CARD (hands-on idea 1, Aaron 20 November 2026): the limits for this stage, typed on a card clipped
// beside the panel in the dugout and the blockhouse. The dials and the recorder carry no green bands any more: reading
// the needle against the card is the player's job, as it was the controller's. The card lists the channels the room
// can read, with the band each one is meant to sit in (js/truth/channels.js via game.js).
import { g, kit, stageChannels } from '../game.js';

const ROOMS = { static: null, count: ['press', 'firing'] }; // which stations each room's card lists (null: all)
const fmt = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

// The card's rows: [label, limits] for each banded channel the room reads, the igniter's lamp last.
export function redlineRows(room) {
  const stations = ROOMS[room];
  return stageChannels()
    .filter(c => !stations || stations.includes(c.station))
    .filter(c => c.band || c.show === 'lamp')
    .map(c => [
      c.label,
      c.show === 'lamp' ? 'lit before firing' : `${fmt(c.band[0])} to ${fmt(c.band[1])}${c.unit ? ` ${c.unit}` : ''}`,
    ]);
}

let shownFor = '';
export function updateRedlines() {
  const el = document.getElementById('redlines');
  if (!el) return;
  const room = g.room,
    want = room in ROOMS && document.body.classList.contains('in-scene') && !!g.round;
  el.hidden = !want;
  if (!want) return;
  const key = `${room}|${g.vehicle}|${g.roundIndex}`;
  if (key === shownFor) return;
  shownFor = key;
  el.innerHTML = `<h3>Red lines</h3><p class="sub">${kit().name}</p><table>${redlineRows(room)
    .map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`)
    .join('')}</table>`;
}
