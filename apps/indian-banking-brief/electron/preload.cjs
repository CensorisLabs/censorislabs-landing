const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('newsBridge', { fetchFeed: (url) => ipcRenderer.invoke('news:fetch-feed', url) })
