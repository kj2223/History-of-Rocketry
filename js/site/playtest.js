// The playtest log's wiring in the page: catches errors, clicks and keys, watches the game a few times a second, and
// keeps the log. In the desktop app the log and a copy of the current save are written as plain files to the
// playtest folder beside the saves (%APPDATA%\Ad Astra\playtest); in a browser the log lives in localStorage.
// F8 (or Playtest > Mark a problem) marks the moment: a screenshot and a copy of the save go with it.
// The log is on unless switched off from the Playtest menu. Seeded replays (?seed=) are not logged.
import {
  LOG_KEY,
  createLog,
  parseLog,
  serializeLog,
  startSession,
  record,
  recordError,
  recordMark,
  observe,
  clocks,
  issueReport,
} from '../core/telemetry.js';

const desktop = typeof window !== 'undefined' ? window.adAstraDesktop?.playtest : undefined;
let log = null,
  game = () => null,
  scene = () => '',
  saveText = () => null,
  storage = null,
  enabled = false,
  dirty = false,
  last = null,
  lastLook = 0,
  lastFlush = 0,
  slowAt = 0,
  errorFlush = 0;

const describe = el => {
  if (!el || el === document) return '';
  const id = el.id ? `#${el.id}` : '';
  const data = Object.entries(el.dataset ?? {})
    .map(([k, v]) => `[${k}=${v}]`)
    .join('');
  return `${el.tagName.toLowerCase()}${id}${data}`;
};

// Starts the log. Returns false (and logs nothing) for a seeded replay or when the player has switched it off.
export function startPlaytest(opts) {
  ({ game, scene, saveText, storage } = opts);
  if (opts.seed) return false;
  enabled = desktop ? desktop.enabled() : storage.getItem(`${LOG_KEY}-off`) === null;
  desktop?.onToggle(on => setEnabled(on));
  desktop?.onMark(() => mark());
  load();
  document.getElementById('bug')?.addEventListener('click', () => mark());
  showButton();
  if (!enabled) return false;
  begin();
  return true;
}

// The header's "Report a bug (F8)" button shows while the log is on, so every tester knows the key.
const showButton = () => {
  const b = document.getElementById('bug');
  if (b) b.hidden = !enabled;
};
let noteTimer = 0;
// The note under the bar. With a mark, it offers to file it on GitHub, and stays up long enough to choose.
function tell(text, entry = null) {
  const el = document.getElementById('bug-note');
  if (!el) return;
  el.textContent = text;
  if (entry) {
    const b = document.createElement('button');
    b.textContent = 'File it on GitHub';
    b.title = 'Opens a GitHub issue filled in with this report, for you to read, describe and submit';
    b.addEventListener('click', () => {
      fileIssue(entry);
      el.hidden = true;
    });
    el.append(' ', b);
  }
  // Beside the room panel when one is open, so it never covers the panel's title or its close button.
  const room = document.getElementById('room');
  const edge = room && !room.hidden ? room.getBoundingClientRect().left : 0;
  Object.assign(
    el.style,
    edge
      ? { left: 'auto', right: `${innerWidth - edge + 12}px`, transform: 'none' }
      : { left: '', right: '', transform: '' },
  );
  el.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (el.hidden = true), entry ? 15000 : 5000);
}

// Opens the filled-in issue page in the browser, and the marks folder so the screenshot can be dragged in.
function fileIssue(entry) {
  const { url } = issueReport(log, entry);
  record(log, game(), 'file-issue', { n: entry.n });
  dirty = true;
  if (desktop) desktop.fileIssue(url, entry.n);
  else window.open(url, '_blank', 'noopener');
}

function load() {
  const text = desktop ? desktop.read() : storage.getItem(LOG_KEY);
  log = text ? parseLog(text) : createLog();
}

function begin() {
  const build = window.adAstraDesktop?.build ?? { version: 'browser' };
  startSession(log, {
    build,
    screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio },
    window: { w: innerWidth, h: innerHeight },
    ua: navigator.userAgent,
    url: location.search,
  });
  record(log, null, 'start', { build });
  dirty = true;
}

function setEnabled(on) {
  if (on === enabled) return;
  if (on) {
    enabled = true;
    begin();
    record(log, game(), 'toggle', { on: true });
  } else {
    record(log, game(), 'toggle', { on: false });
    flush(true);
    enabled = false;
  }
  showButton();
  if (!desktop) on ? storage.removeItem(`${LOG_KEY}-off`) : storage.setItem(`${LOG_KEY}-off`, '1');
}

// For the frame loop's own reports (a skipped frame, a refused save).
export function trace(kind, data) {
  if (!enabled) return;
  record(log, game(), kind, data);
  dirty = true;
}
export function traceError(kind, error) {
  if (!enabled) return;
  recordError(log, game(), kind, error?.message ?? String(error), error?.stack ?? '');
  dirty = true;
  if (!errorFlush) errorFlush = setTimeout(() => ((errorFlush = 0), flush()), 1000);
}

// Called once a frame with the frame's length in milliseconds.
let frames = 0,
  fpsAt = 0;
export function playtestFrame(ms) {
  if (!enabled) return;
  const now = performance.now();
  // The frame rate, noted when it is low (v0.8: the PixiJS scenes draw more), at most once every ten seconds.
  frames++;
  if (now - fpsAt > 10000) {
    const fps = (frames * 1000) / (now - fpsAt);
    if (fpsAt > 0 && fps < 40) trace('fps-low', { fps: Math.round(fps), scene: scene() });
    fpsAt = now;
    frames = 0;
  }
  if (ms > 250 && now - slowAt > 10000) {
    slowAt = now;
    trace('slow', { ms: Math.round(ms), scene: scene() });
  }
  if (now - lastLook > 250) {
    lastLook = now;
    const before = last;
    last = observe(log, game(), last, scene());
    if (last !== before) dirty = true;
    if (before && last.saved !== before.saved) flush(true);
  }
  if (now - lastFlush > 15000) flush();
}

// Writes the log out if anything changed. With the save: on a new checkpoint, a mark, or leaving.
function flush(withSave = false) {
  if (!log || (!dirty && !withSave)) return;
  lastFlush = performance.now();
  dirty = false;
  const text = serializeLog(log);
  try {
    if (desktop) desktop.write(text, withSave ? saveText() : null);
    else storage.setItem(LOG_KEY, text);
  } catch {
    // Browser storage full: keep the newer half of the timeline rather than lose the saves' room.
    log.events.splice(0, log.events.length >> 1);
    log.calls.splice(0, log.calls.length >> 1);
  }
}

// The player's "something is wrong here": everything about the moment, a screenshot and the save beside it.
export function mark() {
  if (!enabled) return;
  const g = game();
  const entry = recordMark(log, g, {
    scene: scene(),
    clocks: clocks(g),
    objective: g?.objective,
    window: { w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio },
  });
  record(log, g, 'mark', { n: entry.n });
  dirty = true;
  flush(true);
  const thanks = `Bug ${entry.n} noted: what led up to it, a copy of the save${desktop ? ' and a screenshot' : ''} are kept. Carry on playing, or file it now.`;
  // The note shows after the screenshot is taken, so it is not in the picture.
  if (!desktop) return tell(thanks, entry);
  desktop
    .mark(entry.n, saveText())
    .then(files => {
      entry.files = files;
      dirty = true;
      flush();
      tell(thanks, entry);
    })
    .catch(e => {
      traceError('mark', e);
      tell(`Bug ${entry.n} noted in the log (the screenshot failed).`);
    });
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', e =>
    traceError('error', e.error ?? { message: e.message, stack: `@ ${e.filename}:${e.lineno}` }),
  );
  window.addEventListener('unhandledrejection', e => traceError('rejection', e.reason));
  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      const err = args.find(a => a instanceof Error);
      const text = args
        .map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      traceError(`console.${level}`, { message: text, stack: err?.stack ?? '' });
    };
  }
  document.addEventListener(
    'click',
    e => {
      if (!enabled) return;
      const el = e.target.closest?.('button, a, [data-act], input, select, label, canvas') ?? e.target;
      trace('click', {
        on: describe(el),
        text: el.tagName === 'CANVAS' ? undefined : (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
      });
    },
    true,
  );
  window.addEventListener(
    'keydown',
    e => {
      if (e.key === 'F8' && !desktop) {
        e.preventDefault();
        return mark();
      }
      if (!enabled || e.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      trace('key', { key: e.key });
    },
    true,
  );
  let resized = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resized);
    resized = setTimeout(() => trace('resize', { w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio }), 500);
  });
  window.addEventListener('pagehide', () => flush(true));
}
