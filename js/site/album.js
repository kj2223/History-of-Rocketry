// THE PHOTOGRAPHS (v0.8 visual pass). On the rounds that history remembers, the moment she leaves the pad is taken as
// a photograph: the scene as it stands on screen, in the era's own film look, at the instant the rocket is clear of
// the tower (or, from the console, while Mission Control watches her climb on the television). When the round is
// written up and the flight was a good one, the picture is there on the write-up as a print with its caption, and it
// stays in the notebook's photographs. A lost flight leaves no photograph: it is not the picture anyone kept.
// No flash and no motion: the print simply appears with the write-up (photosensitivity: js/stage/fx/calm.js).
// The prints are kept in their own storage, not in the save, so they cannot swell the save or break it. Only the
// current campaign's prints are kept.
import { SEASON } from '../data/campaign.js';
import { flyingRise } from './draw.js';

export const ALBUM_KEY = 'pa-album';
const WIDTH = 640,
  QUALITY = 0.72;

// The rounds worth a photograph, and what each one was. Worded as what the flight set out to do, so a caption never
// claims more than the game's own flight did.
export const MILESTONES = {
  'wac-1': 'The first WAC Corporal, the first American rocket built to reach the upper air.',
  'bumper-5': 'Bumper 5: a WAC Corporal riding a V-2, sent higher than anything had been sent before.',
  'vanguard-tv4': 'Vanguard TV-4, carrying the little satellite that would become Vanguard 1.',
  'pioneer-4': 'Pioneer 4, sent past the Moon and on into orbit around the Sun.',
  'mr-3': 'Freedom 7: the first American to ride a rocket into space.',
  'ma-6': 'Friendship 7: the first American flight into orbit.',
  'gem-4': 'Gemini 4, the flight that put the first American outside his spacecraft.',
  'gem-6': 'Gemini 6A, sent to meet Gemini 7 in orbit: the first rendezvous in space.',
  'gem-8': 'Gemini 8, sent to dock with an Agena target: the first docking in space.',
  'ranger-7': 'Ranger 7, sent to photograph the Moon close up until the moment it struck.',
  'mariner-2': 'Mariner 2, sent to Venus: the first spacecraft to fly past another planet.',
  'mariner-4': 'Mariner 4, sent to take the first close pictures of Mars.',
  'apollo-8': 'Apollo 8: the first people sent around the Moon.',
  'apollo-11': 'Apollo 11, sent to make the first landing on the Moon.',
  'skylab-2': "Skylab 2: the first crew sent up to Skylab, America's first space station.",
  astp: 'Apollo–Soyuz: sent to meet a Soviet crew in orbit.',
  'sts-1': 'STS-1, Columbia: the first flight of the Space Shuttle, crewed from the start.',
  'sts-26': 'STS-26, Discovery: the Shuttle flying again after Challenger.',
  'sts-31': 'STS-31, Discovery, carrying the Hubble Space Telescope.',
  'sts-88': 'STS-88, Endeavour, carrying Unity: the first American part of the space station.',
  'demo-2': 'Demo-2: the first crew carried to orbit by a company-built spacecraft.',
  'artemis-1': 'Artemis I: the first flight of the Space Launch System, Orion sent around the Moon.',
  'artemis-2': 'Artemis II: the first crew sent to the Moon in more than fifty years.',
  'artemis-4': 'Artemis IV, sent to land on the Moon.',
};
export const isMilestone = id => id in MILESTONES;

// Whether the picture should be taken now, and from where: 'site' as she clears the tower, 'console' while she climbs
// on the television. Pure, for the tests: reads only what is on screen.
export function photoMoment(g, scene) {
  if (!g || g.flight?.blast) return null;
  if (scene === 'site' && g.rocket?.where === 'flying') {
    const rise = flyingRise(g);
    return rise >= 70 && rise <= 150 ? 'site' : null;
  }
  if (scene === 'control') {
    const c = g.console,
      last = c?.trace?.at(-1);
    return c?.phase === 'ascent' && last && last.t >= 25 && last.t <= 60 ? 'console' : null;
  }
  return null;
}

// The album in storage: { seed, photos: { roundId: { url, from, day, year } } }. A new campaign starts a new album.
function read(storage, seed) {
  try {
    const a = JSON.parse(storage.getItem(ALBUM_KEY) || 'null');
    if (a && a.seed === seed && a.photos && typeof a.photos === 'object') return a;
  } catch {
    // An unreadable album is simply started again.
  }
  return { seed, photos: {} };
}
function write(storage, album) {
  // If storage is full, the oldest prints go first, so the newest still keeps.
  for (;;)
    try {
      storage.setItem(ALBUM_KEY, JSON.stringify(album));
      return true;
    } catch {
      const ids = Object.keys(album.photos);
      if (!ids.length) return false;
      delete album.photos[ids.sort((a, b) => album.photos[a].day - album.photos[b].day)[0]];
    }
}

// Where the prints are kept: the game's own storage (main.js sets it; a ?seed= replay keeps them in memory only).
let store = null;
export const useAlbumStorage = s => (store = s);
export function photoOf(seed, id, storage = store) {
  return storage ? read(storage, seed).photos[id] || null : null;
}
export function photosOf(seed, storage = store) {
  return storage ? read(storage, seed).photos : {};
}

// The part of the screen the print takes: a 4:3 frame centred on the focus, kept inside the screen. Pure, for the tests.
export function cropOf(width, height, focus) {
  if (focus == null || !Number.isFinite(focus)) return { sx: 0, sw: width };
  const sw = Math.min(width, Math.round((height * 4) / 3));
  return { sx: Math.round(Math.max(0, Math.min(width - sw, focus * width - sw / 2))), sw };
}

// Called each frame after the scene layer has drawn, while its picture is still on the canvas. Takes the round's
// photograph once, at its moment.
const taken = new Set();
// focus: where across the screen (0..1) the print is centred, or null for the whole screen.
export function albumFrame(g, scene, canvas, focus = null, storage = store) {
  if (!canvas || !g || !storage) return null;
  const plan = SEASON[g.roundIndex];
  if (!plan || !isMilestone(plan.id)) return null;
  const key = `${g.seed}:${plan.id}:${g.launchDay ?? g.day}`;
  if (taken.has(key)) return null;
  const from = photoMoment(g, scene);
  if (!from) return null;
  taken.add(key);
  try {
    const { sx, sw } = cropOf(canvas.width, canvas.height, focus);
    const w = Math.min(WIDTH, sw),
      h = Math.round((w * canvas.height) / sw);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(canvas, sx, 0, sw, canvas.height, 0, 0, w, h);
    const url = c.toDataURL('image/jpeg', QUALITY);
    const album = read(storage, g.seed);
    album.photos[plan.id] = { url, from, day: g.launchDay ?? g.day };
    write(storage, album);
    return plan.id;
  } catch (e) {
    console.warn('The photograph could not be taken.', e);
    return null;
  }
}

// A round's print, for the write-up and the notebook: only for a good flight with nobody lost on it.
export function goodFlight(record, r) {
  return !!r && !/^Lost/.test(r.flight || '') && !(record.losses || []).some(l => l.round === r.id);
}
export function printHTML(p, caption, dated, small = false) {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<figure class="print${small ? ' small' : ''}"><img src="${esc(p.url)}" alt="${esc(caption)}">
    <figcaption>${esc(caption)}<span>${esc(dated)}${p.from === 'console' ? ', from the floor of Mission Control' : ''}</span></figcaption></figure>`;
}

// The print for a round of the record, or '' when there is none to show. dateText words a campaign day.
export function roundPrint(g, r, dateText, small = false) {
  if (!r || !isMilestone(r.id) || !goodFlight(g.record, r)) return '';
  const p = photoOf(g.seed, r.id);
  return p ? printHTML(p, MILESTONES[r.id], dateText(p.day), small) : '';
}
// Every print of the campaign so far, oldest first, for the notebook.
export function albumHTML(g, dateText) {
  const rs = g.record.rounds.filter(r => roundPrint(g, r, dateText, true));
  return rs.map(r => roundPrint(g, r, dateText, true)).join('');
}
