// THE DESKTOP SHELL: opens the game in its own Electron window instead of a browser tab.
// The game itself is unchanged. This file only makes the window and serves the game's files to it.
// Files are served under app://game/ rather than file:// so ES modules load and the save (localStorage) has a fixed home.
import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const GAME_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function openWindow() {
  const window = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1280, minHeight: 720,
    backgroundColor: '#000000', title: `Project Vanguard v${app.getVersion()}`, autoHideMenuBar: true,
  });
  // Keep the version in the title bar (the page's own <title> would replace it), so testers can say which build they played.
  window.on('page-title-updated', (event) => event.preventDefault());
  window.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  // app://game/js/main.js -> <game folder>/js/main.js. Anything that tries to step outside the folder is refused.
  protocol.handle('app', (request) => {
    const filePath = path.join(GAME_FOLDER, decodeURIComponent(new URL(request.url).pathname));
    if (!filePath.startsWith(GAME_FOLDER)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
  openWindow();
});

app.on('window-all-closed', () => app.quit());
