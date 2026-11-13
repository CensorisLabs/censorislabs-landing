const { app, BrowserWindow } = require('electron')
const path = require('node:path')
function createWindow() { const win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1024, minHeight: 720, backgroundColor: '#f5f7f2', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true } }); win.loadFile(path.join(__dirname, '..', 'dist', 'index.html')) }
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
