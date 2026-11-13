// THE MORNING PAPER (v0.8 visual pass): each round's write-up comes with the next morning's front page, set in the
// type of its decade: the masthead, the date and the price, the headline, the round's photograph if one was taken,
// and the story as the range told it. The paper is invented (no real newspaper's name or look), and it only says
// what the record says: a lost flight is reported lost, a crew lost is reported so, and nothing more is claimed.
// Plain HTML and CSS: nothing moves, nothing flashes.
import { dateOf } from '../core/calendar.js';
import { photoOf, goodFlight, MILESTONES } from './album.js';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The paper's look by decade: 'old' (to 1969, heavy serif and rules), 'mid' (1970–1999), 'new' (2000 on, sans).
export const paperEra = year => (year < 1970 ? 'old' : year < 2000 ? 'mid' : 'new');
export const MASTHEAD = { old: 'The Evening Courier', mid: 'The Daily Courier', new: 'COURIER' };
// The cover price, roughly as American dailies charged.
export const priceOf = year =>
  year < 1950
    ? '3 cents'
    : year < 1960
      ? '5 cents'
      : year < 1975
        ? '10 cents'
        : year < 1990
          ? '25 cents'
          : year < 2010
            ? '50 cents'
            : '$2.00';

// The headline, the deck under it and the kicker over it, from the record alone.
export function headlineOf(r, record, crewed) {
  const short = String(r.name || r.id).split(',')[0];
  const plan = String(r.name || '')
    .split(',')
    .slice(1)
    .join(',')
    .trim();
  const crewLost = (record.losses || []).some(l => l.round === r.id);
  const lost = /^Lost/.test(r.flight || '');
  if (crewLost) return { kicker: 'TRAGEDY', head: `${short}: crew lost`, deck: r.flight, tone: 'grave' };
  if (lost) return { kicker: plan ? `Meant as ${plan}` : '', head: `${short} lost`, deck: r.flight, tone: 'bad' };
  const good = goodFlight(record, r);
  const head = crewed ? `${short} crew home safe` : `${short} flies`;
  return {
    kicker: plan ? plan[0].toUpperCase() + plan.slice(1) : '',
    head,
    deck: good && MILESTONES[r.id] ? MILESTONES[r.id] : r.flight,
    tone: MILESTONES[r.id] && good ? 'banner' : 'plain',
  };
}

// The front page, for the round's write-up. crewed: whether a crew flew.
export function paperHTML(g, r, crewed) {
  if (!r) return '';
  const day = (r.day ?? g.day) + 1,
    { year, month, date } = dateOf(day),
    era = paperEra(year);
  const h = headlineOf(r, g.record, crewed);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  const p = goodFlight(g.record, r) ? photoOf(g.seed, r.id) : null;
  const story = [r.flight, r.fix ? `On the range afterwards: ${r.fix}` : '', 'Story continues on page 4.']
    .filter(Boolean)
    .map(t => `<p>${esc(t)}</p>`)
    .join('');
  return `<article class="paper paper-${era} paper-${h.tone}" aria-label="The next morning's front page">
    <div class="paper-head"><div class="mast">${esc(MASTHEAD[era])}</div>
      <div class="dateline"><span>${esc(`${weekday}, ${MONTHS[month - 1]} ${date}, ${year}`)}</span><span>${esc(priceOf(year))}</span></div></div>
    ${h.kicker ? `<div class="kicker">${esc(h.kicker)}</div>` : ''}
    <h3>${esc(h.head)}</h3>
    ${h.deck && h.deck !== r.flight ? `<div class="deck">${esc(h.deck)}</div>` : ''}
    <div class="cols">${p ? `<img src="${esc(p.url)}" alt="">` : ''}<div class="story">${story}</div></div>
  </article>`;
}
