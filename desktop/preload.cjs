// The one bridge between the game page and the desktop shell: the playtest log's files and the build the game runs on.
// The page gets these few calls and nothing else of Node or Electron (the window stays sandboxed).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adAstraDesktop', {
  build: ipcRenderer.sendSync('playtest:build'),
  playtest: {
    enabled: () => ipcRenderer.sendSync('playtest:enabled'),
    read: () => ipcRenderer.sendSync('playtest:read'),
    write: (log, save) => ipcRenderer.send('playtest:write', log, save),
    mark: (n, save) => ipcRenderer.invoke('playtest:mark', n, save),
    fileIssue: (url, n) => ipcRenderer.send('playtest:file-issue', url, n),
    onMark: fn => ipcRenderer.on('playtest:mark-request', () => fn()),
    onToggle: fn => ipcRenderer.on('playtest:toggle', (_, on) => fn(on)),
  },
  dev: {
    onOpen: fn => ipcRenderer.on('dev:open', () => fn()),
  },
});
