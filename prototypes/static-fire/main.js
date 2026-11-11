// PROTOTYPE LAUNCHER: opens the static-fire test scene in its own Electron window. Not part of the game build.
// Serves the repository under proto://game/ so the scene can import the real game rules from js/ as ES modules.
// It uses its own app name, so it never touches the game's saves.
import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
app.setName('Ad Astra Prototype');
protocol.registerSchemesAsPrivileged([
  { scheme: 'proto', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function serve(request) {
  const { host, pathname } = new URL(request.url);
  const file = path.join(ROOT, decodeURIComponent(pathname));
  const rel = path.relative(ROOT, file);
  if (host !== 'game' || !rel || rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

app.whenReady().then(() => {
  protocol.handle('proto', serve);
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#000000',
    title: 'Ad Astra prototype: WAC static fire',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.loadURL('proto://game/prototypes/static-fire/index.html');
});
app.on('window-all-closed', () => app.quit());
