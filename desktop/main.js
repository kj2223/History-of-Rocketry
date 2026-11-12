// THE DESKTOP SHELL: opens the game in its own Electron window instead of a browser tab.
// The game itself is unchanged. This file only makes the window and serves the game's files to it.
// Files are served under app://game/ rather than file:// so ES modules load and the saves (localStorage) have a fixed home.
import { app, BrowserWindow, Menu, dialog, protocol, net, session, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const GAME_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'app://game';
const START = `${ORIGIN}/index.html`;

// Only the game's own files may load. Inline style attributes are allowed (the progress bars use them); no inline script runs.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// app://game/js/game.js -> <game folder>/js/game.js. Anything outside the folder (including look-alike sibling folders) is refused.
function resolveGameFile(url) {
  const { host, pathname } = new URL(url);
  if (host !== 'game') return null;
  const filePath = path.join(GAME_FOLDER, decodeURIComponent(pathname));
  const relative = path.relative(GAME_FOLDER, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return filePath;
}

async function serve(request) {
  const filePath = resolveGameFile(request.url);
  if (!filePath) return new Response('Not found', { status: 404 });
  const response = await net.fetch(pathToFileURL(filePath).toString());
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  return new Response(response.body, { status: response.status, headers });
}

function openWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#000000',
    title: `Ad Astra v${app.getVersion()}`,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(GAME_FOLDER, 'desktop', 'preload.cjs'),
    },
  });
  // Keep the version in the title bar (the page's own <title> would replace it), so testers can say which build they played.
  window.on('page-title-updated', event => event.preventDefault());
  // The game is laid out for a screen about 1200 pixels high. On a bigger one at 100% Windows scaling (a 4K monitor),
  // zoom the page so the bar, the panels and the loop grow with the window instead of shrinking to a corner. The site
  // and the rooms are drawn at the screen's full resolution whatever the zoom.
  const fit = () => {
    const { height } = window.getContentBounds();
    window.webContents.setZoomFactor(Math.max(1, Math.min(2.5, height / 1200)));
  };
  window.on('resize', fit);
  // F8 marks a problem for the playtest log, wherever the player is.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F8' && !input.isAutoRepeat) {
      event.preventDefault();
      window.webContents.send('playtest:mark-request');
    }
  });
  window.webContents.on('did-finish-load', fit);
  window.loadURL(START);
}

// ---- The playtest log ----
// The game keeps a log of each session (js/core/telemetry.js) and sends it here; it is written, with a copy of the current
// save, to the playtest folder beside the saves: %APPDATA%\Ad Astra\playtest on Windows. F8 marks a problem: a
// screenshot and the save at that moment go in playtest\marks. Nothing is sent anywhere. Read it back with
// tools/playtest-report.mjs.
const PLAYTEST_ON_BY_DEFAULT = true;
const MAX_MARKS = 40;
const playtestDir = () => path.join(app.getPath('userData'), 'playtest');
const playtestFile = name => path.join(playtestDir(), name);
const settingsFile = () => playtestFile('settings.json');
function playtestOn() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')).enabled !== false;
  } catch {
    return PLAYTEST_ON_BY_DEFAULT;
  }
}
// Written to a temporary file first, so a crash mid-write never leaves half a log.
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
}
const LIMIT = 8 * 1024 * 1024; // refuse anything bigger: the log is bounded well under this
function buildInfo() {
  let stamp = {};
  try {
    stamp = JSON.parse(fs.readFileSync(path.join(GAME_FOLDER, 'desktop', 'build-info.json'), 'utf8'));
  } catch {
    // npm start from the working folder: read the commit straight from git's files
    try {
      const head = fs.readFileSync(path.join(GAME_FOLDER, '.git', 'HEAD'), 'utf8').trim();
      const ref = head.startsWith('ref: ') ? head.slice(5) : null;
      const commit = ref ? fs.readFileSync(path.join(GAME_FOLDER, '.git', ref), 'utf8').trim() : head;
      stamp = { commit: commit.slice(0, 7), branch: ref?.replace('refs/heads/', '') ?? null, fromGitFolder: true };
    } catch {
      /* no stamp and no git: the version alone */
    }
  }
  return {
    version: app.getVersion(),
    ...stamp,
    packaged: app.isPackaged,
    electron: process.versions.electron,
    os: `${process.platform} ${os.release()}`,
  };
}
// Only the game's own page may use these calls (Electron's advice: check who is asking). Nothing else can load in the
// window today, so this guards against a future mistake, not a present hole.
const fromGame = event => event.senderFrame?.url?.startsWith(`${ORIGIN}/`) === true;
// A mark's number names its files, so it must be a plain number: never a path.
const markNumber = n => (Number.isInteger(n) && n > 0 && n < 100000 ? String(n).padStart(3, '0') : null);
ipcMain.on('playtest:build', event => (event.returnValue = fromGame(event) ? buildInfo() : null));
ipcMain.on('playtest:enabled', event => (event.returnValue = fromGame(event) && playtestOn()));
ipcMain.on('playtest:read', event => {
  if (!fromGame(event)) return (event.returnValue = null);
  try {
    event.returnValue = fs.readFileSync(playtestFile('log.json'), 'utf8');
  } catch {
    event.returnValue = null;
  }
});
ipcMain.on('playtest:write', (event, log, save) => {
  if (!fromGame(event)) return;
  try {
    if (typeof log === 'string' && log.length < LIMIT) writeAtomic(playtestFile('log.json'), log);
    if (typeof save === 'string' && save.length < LIMIT) writeAtomic(playtestFile('save.json'), save);
  } catch {
    /* a full disk must not stop the game */
  }
});
ipcMain.handle('playtest:mark', async (event, n, save) => {
  const number = markNumber(n);
  if (!fromGame(event) || !number) throw new Error('Refused: not a mark from the game');
  const marks = playtestFile('marks');
  fs.mkdirSync(marks, { recursive: true });
  const base = `mark-${number}`;
  const files = [];
  const image = await event.sender.capturePage();
  fs.writeFileSync(path.join(marks, `${base}.png`), image.toPNG());
  files.push(`marks/${base}.png`);
  if (typeof save === 'string' && save.length < LIMIT) {
    fs.writeFileSync(path.join(marks, `${base}-save.json`), save);
    files.push(`marks/${base}-save.json`);
  }
  // Keep the newest marks only.
  const all = [
    ...new Set(
      fs
        .readdirSync(marks)
        .map(f => f.match(/^mark-(\d+)/)?.[1])
        .filter(Boolean),
    ),
  ].sort();
  for (const old of all.slice(0, Math.max(0, all.length - MAX_MARKS)))
    for (const f of fs.readdirSync(marks)) if (f.startsWith(`mark-${old}`)) fs.rmSync(path.join(marks, f));
  return files;
});
// Filing a mark: only the repository's new-issue page may open, in the player's own browser. The marks folder opens
// beside it with the screenshot selected, to drag into the issue.
const ISSUE_PAGE = 'https://github.com/kj2223/History-of-Rocketry/issues/new?';
ipcMain.on('playtest:file-issue', (event, url, n) => {
  if (!fromGame(event) || typeof url !== 'string' || !url.startsWith(ISSUE_PAGE) || url.length > 8192) return;
  shell.openExternal(url);
  const number = markNumber(n);
  const shot = number && playtestFile(path.join('marks', `mark-${number}.png`));
  if (shot && fs.existsSync(shot)) shell.showItemInFolder(shot);
});
const focused = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
// A new log: the old one is kept as log-previous.json, and the marks move to marks-previous.
function freshLog() {
  for (const [from, to] of [
    ['log.json', 'log-previous.json'],
    ['marks', 'marks-previous'],
  ]) {
    const a = playtestFile(from),
      b = playtestFile(to);
    if (!fs.existsSync(a)) continue;
    fs.rmSync(b, { recursive: true, force: true });
    fs.renameSync(a, b);
  }
  focused()?.reload();
}

const menu = Menu.buildFromTemplate([
  { label: 'Game', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'quit' }] },
  {
    label: 'Playtest',
    submenu: [
      {
        label: 'Mark a problem here',
        accelerator: 'F8',
        registerAccelerator: false, // the window catches F8 itself (below), menu bar shown or not
        click: () => focused()?.webContents.send('playtest:mark-request'),
      },
      { label: 'Open the playtest folder', click: () => shell.openPath(playtestDir()) },
      { type: 'separator' },
      {
        label: 'Keep a playtest log',
        type: 'checkbox',
        checked: playtestOn(),
        click: item => {
          writeAtomic(settingsFile(), JSON.stringify({ enabled: item.checked }));
          focused()?.webContents.send('playtest:toggle', item.checked);
        },
      },
      { label: 'Start a fresh log', click: freshLog },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { role: 'togglefullscreen' },
      { role: 'toggleDevTools' },
    ],
  },
]);

// No page may leave the game, open new windows, or ask for device permissions.
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', event => event.preventDefault());
});

// Builds up to v0.5.2 were called Project Vanguard, and Electron keeps each app's saves in a folder named after it. On the
// first run under the new name, bring the old folder's saves across so a game in progress carries on. The old folder is
// left as it was.
function carryOverSaves() {
  const here = path.join(app.getPath('userData'), 'Local Storage');
  const before = path.join(app.getPath('appData'), 'Project Vanguard', 'Local Storage');
  if (fs.existsSync(here) || !fs.existsSync(before)) return;
  fs.mkdirSync(path.dirname(here), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(here), '.save-migration-'));
  try {
    const copy = path.join(staging, 'Local Storage');
    fs.cpSync(before, copy, { recursive: true });
    fs.renameSync(copy, here);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
// A failed copy must not stop the game opening (if it quit, the same failure would stop it on every launch): the game
// starts without the old saves, which stay in their folder, and the player is told where they are.
let carryOverError = null;
try {
  carryOverSaves();
} catch (error) {
  carryOverError = error;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_, __, allow) => allow(false));
  protocol.handle('app', serve);
  Menu.setApplicationMenu(menu);
  openWindow();
  if (carryOverError)
    dialog.showErrorBox(
      'Could not copy the old saves',
      `Ad Astra has started without your Project Vanguard saves. They are still in ${path.join(app.getPath('appData'), 'Project Vanguard')}.\n\n${carryOverError.message}`,
    );
});

app.on('window-all-closed', () => app.quit());
