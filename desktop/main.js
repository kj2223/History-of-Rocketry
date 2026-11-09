// THE DESKTOP SHELL: opens the game in its own Electron window instead of a browser tab.
// The game itself is unchanged. This file only makes the window and serves the game's files to it.
// Files are served under app://game/ rather than file:// so ES modules load and the saves (localStorage) have a fixed home.
import { app, BrowserWindow, Menu, protocol, net, session } from 'electron';
import fs from 'node:fs';
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
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // Keep the version in the title bar (the page's own <title> would replace it), so testers can say which build they played.
  window.on('page-title-updated', event => event.preventDefault());
  window.loadURL(START);
}

const menu = Menu.buildFromTemplate([
  { label: 'Game', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'quit' }] },
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
  try {
    if (!fs.existsSync(here) && fs.existsSync(before)) fs.cpSync(before, here, { recursive: true });
  } catch {
    // Nothing to carry over, or the copy failed: the game starts fresh, as it would have anyway.
  }
}
carryOverSaves();

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_, __, allow) => allow(false));
  protocol.handle('app', serve);
  Menu.setApplicationMenu(menu);
  openWindow();
});

app.on('window-all-closed', () => app.quit());
