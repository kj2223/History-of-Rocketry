// THE DEV MENU: start a playtest at any round on either route, with the bot having
// played every round before it. For testing only. The game you were playing is kept as the backup the first time, so
// Game > "Go back to your backup" brings it back; a game the menu made is not kept as the backup over it.
import { g, dateText, newGame } from '../game.js';
import { SEASON } from '../data/campaign.js';
import { stagesFor, skipWithRetries, STOPS } from '../dev/skip.js';
import { startOver, readSave } from '../core/save.js';
import { trace, traceError } from './playtest.js';
import { RENDERER_KEY, pixiWanted } from '../stage/index.js';
import { FILM_KEY, filmWanted } from '../stage/fx/film.js';
import { CALM_KEY, calm } from '../stage/fx/calm.js';

// The menu is hidden from players. Ctrl+Shift+F9 switches it on or off on this computer (kept in localStorage); while it
// is on, F9 and the Jump button in the bar open it.
const DEV_ON = 'pa-dev-menu-on';
const unlocked = () => storage?.getItem(DEV_ON) !== null;

// Marks the current save as one the menu made, so the next jump does not push the real game out of the backup.
const DEV_FLAG = 'pa-dev-jumped';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cap = s => s[0].toUpperCase() + s.slice(1);

// The eras the rounds are listed under.
function eraOf(r) {
  if (r.path === 'jpl') return 'JPL, the robotic missions';
  if (!r.crewed) return r.site ? 'The Cape, 1955 to 1959' : 'White Sands, 1945 to 1952';
  if (/^skylab|^astp/.test(r.id)) return 'Skylab and Apollo-Soyuz';
  if (/^artemis/.test(r.id)) return 'Artemis';
  return {
    mercury: 'Mercury',
    gemini: 'Gemini',
    apollo: 'Apollo',
    shuttle: 'The Shuttle',
    dragon: 'Commercial crew',
  }[r.crewed];
}

let state = { route: 'nasa', stop: 'morning', seed: '', busy: false, message: '' },
  storage = null,
  check = null,
  afterJump = () => {};

// opts: storage (where saves live), check (the checkpoint check), fresh (what the page does after a new game).
export function startDevMenu(opts) {
  ({ storage, check } = opts);
  afterJump = opts.fresh;
  const panel = $('dev');
  panel.addEventListener('click', onClick);
  panel.addEventListener('change', onChange);
  window.addEventListener('keydown', e => {
    if (e.key === 'F9' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      if (unlocked()) {
        storage.removeItem(DEV_ON);
        closeDevMenu();
      } else storage.setItem(DEV_ON, '1');
      showButton();
      trace('dev-menu', { on: unlocked() });
    } else if (e.key === 'F9' && unlocked()) {
      e.preventDefault();
      toggleDevMenu();
    } else if (e.key === 'Escape' && !panel.hidden) closeDevMenu();
  });
  $('dev-open')?.addEventListener('click', () => toggleDevMenu());
  showButton();
}
const showButton = () => {
  const b = $('dev-open');
  if (b) b.hidden = !unlocked();
};
// A new game or a restore from the game menu is a real game again: the next jump keeps it as the backup.
export const clearDevFlag = () => storage?.removeItem(DEV_FLAG);

export function toggleDevMenu() {
  const panel = $('dev');
  if (panel.hidden) {
    render();
    panel.hidden = false;
  } else closeDevMenu();
}
const closeDevMenu = () => ($('dev').hidden = true);

function render() {
  const here = SEASON[g.roundIndex];
  const groups = [];
  for (const r of stagesFor(state.route)) {
    const era = eraOf(r);
    if (groups.at(-1)?.era !== era) groups.push({ era, rounds: [] });
    groups.at(-1).rounds.push(r);
  }
  const year = r => dateText(r.start).match(/\d{4}$/)?.[0] ?? '';
  $('dev').innerHTML = `
    <button class="close" data-dev="close" title="Close (F9 or Esc)">×</button>
    <h2>Jump to a stage</h2>
    <p class="muted">For testing. The bot plays every round before the one you pick, taking the offers on the NASA route and turning them down on the JPL route, then hands over to you. It takes a second or two.</p>
    <div class="dev-opts">
      <label><input type="radio" name="dev-route" value="nasa" ${state.route === 'nasa' ? 'checked' : ''}> NASA route</label>
      <label><input type="radio" name="dev-route" value="jpl" ${state.route === 'jpl' ? 'checked' : ''}> Stay at JPL</label>
    </div>
    <div class="dev-opts">
      ${Object.entries(STOPS)
        .map(
          ([k, text]) =>
            `<label><input type="radio" name="dev-stop" value="${k}" ${state.stop === k ? 'checked' : ''}> ${text}</label>`,
        )
        .join('')}
    </div>
    <label><input type="checkbox" id="dev-canvas" ${pixiWanted() ? '' : 'checked'}> Old drawing: show the rooms rebuilt in PixiJS with the old canvas code, to compare</label>
    <label><input type="checkbox" id="dev-calm" ${calm() ? 'checked' : ''}> Calm effects: no screen shake, no flash of light at ignition or explosions, no film grain (also on when Windows asks for reduced motion)</label>
    <label><input type="checkbox" id="dev-film" ${filmWanted() ? '' : 'checked'}> No film look: switch off the era's film grade (grain, colour, vignette) over the scenes</label>
    <label>Seed <input id="dev-seed" type="text" inputmode="numeric" size="9" value="${esc(state.seed)}" placeholder="random"> <span class="muted">Blank for a new one each time. A seed gives the same game again.</span></label>
    <p class="dev-status ${state.message.startsWith('Could not') ? 'bad' : ''}" role="status">${esc(state.message)}</p>
    ${groups
      .map(
        ({ era, rounds }) =>
          `<h3>${esc(era)}</h3><div class="dev-rounds">${rounds
            .map(
              r =>
                `<button data-dev="jump" data-id="${r.id}" ${state.busy ? 'disabled' : ''} class="${r.id === here.id ? 'here' : ''}" title="${esc(cap(r.name))}">${esc(shortName(r))} <span>${year(r)}</span></button>`,
            )
            .join('')}</div>`,
      )
      .join('')}
    <p class="muted">Ctrl+Shift+F9 hides this menu and its button again. Your game before the first jump is kept as the backup: Game, then "Go back to your backup". Launch morning does not apply to the robotic missions, which start in the office.</p>`;
}

// The round's name up to its first comma, as in the record: "Apollo 11", "Viking 7", "STS-51-L".
const shortName = r => cap(r.name.split(',')[0].replace(/^(a|an|the) /, ''));

function onChange(e) {
  if (e.target.name === 'dev-route') state.route = e.target.value;
  else if (e.target.name === 'dev-stop') state.stop = e.target.value;
  else if (e.target.id === 'dev-seed') state.seed = e.target.value.trim();
  else if (e.target.id === 'dev-canvas') {
    if (e.target.checked) localStorage.setItem(RENDERER_KEY, 'canvas');
    else localStorage.removeItem(RENDERER_KEY);
    trace('dev-renderer', { canvas: e.target.checked });
  } else if (e.target.id === 'dev-calm') {
    if (e.target.checked) localStorage.setItem(CALM_KEY, 'on');
    else localStorage.removeItem(CALM_KEY);
    trace('dev-calm', { on: e.target.checked });
  } else if (e.target.id === 'dev-film') {
    if (e.target.checked) localStorage.setItem(FILM_KEY, 'off');
    else localStorage.removeItem(FILM_KEY);
    trace('dev-film', { off: e.target.checked });
  } else return;
  render();
}

function onClick(e) {
  const b = e.target.closest('[data-dev]');
  if (!b || state.busy) return;
  if (b.dataset.dev === 'close') return closeDevMenu();
  if (b.dataset.dev === 'jump') jump(b.dataset.id);
}

function jump(id) {
  state.seed = $('dev-seed').value.trim();
  const seed = state.seed === '' ? undefined : Number(state.seed);
  if (seed !== undefined && !(Number.isInteger(seed) && seed > 0)) {
    state.message = 'Could not jump: the seed must be a whole number above 0, or blank.';
    return render();
  }
  const name = shortName(SEASON.find(r => r.id === id));
  state.busy = true;
  state.message = `The bot is playing up to ${name}…`;
  render();
  // Give the page a frame to show the message before the bot holds it for a second or two.
  setTimeout(() => {
    try {
      const opts = { route: state.route, stop: state.stop, seed };
      const { seed: used, tries } = skipWithRetries(id, opts);
      // The saves are only touched once the jump has worked. The real game goes to the backup; a game this menu made
      // does not push it out.
      if (storage.getItem(DEV_FLAG) === null) startOver(storage, check);
      storage.setItem(DEV_FLAG, '1');
      afterJump();
      trace('dev-jump', { id, route: state.route, stop: state.stop, seed: used, tries });
      state.message = `Last jump: ${name}, seed ${used}.`;
      closeDevMenu();
    } catch (e) {
      traceError('dev-jump-failed', e);
      // The bot's half-played game is dropped: back to the game that was saved.
      const saved = readSave(storage, check);
      if (saved) newGame(saved.seed, saved);
      else newGame();
      afterJump();
      state.message = `Could not jump to ${name}: ${e.message}. Try again, or another seed.`;
    } finally {
      state.busy = false;
      if (!$('dev').hidden) render();
    }
  }, 30);
}
