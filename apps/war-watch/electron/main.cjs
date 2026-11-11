const { app, BrowserWindow, ipcMain, shell } = require('electron'); const path = require('node:path')
const NEWS_HOST = 'api.gdeltproject.org'

ipcMain.handle('news:fetch-json', async (_event, url) => {
  const parsed = new URL(String(url))
  if (parsed.protocol !== 'https:' || parsed.hostname !== NEWS_HOST) throw new Error('Only the GDELT news index is allowed.')
  const response = await fetch(parsed.href, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`News index returned HTTP ${response.status}`)
  return response.json()
})

function createWindow() { const window = new BrowserWindow({ width: 1240, height: 900, minWidth: 360, minHeight: 620, backgroundColor: '#16181c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true } }); window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) void shell.openExternal(url); return { action: 'deny' } }); window.loadFile(path.join(__dirname, '..', 'dist', 'index.html')) }
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) }); app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
