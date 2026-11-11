const { contextBridge, ipcRenderer } = require('electron')

// GDELT sends no CORS headers, so the desktop build fetches through the main
// process. The main process validates the URL and host before any request.
contextBridge.exposeInMainWorld('newsBridge', {
  fetchJson: (url) => ipcRenderer.invoke('news:fetch-json', url),
})
