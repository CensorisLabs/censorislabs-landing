const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

ipcMain.handle('news:fetch-feed', async (_event, url) => {
  const parsed = new URL(String(url))
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS news feeds are allowed.')
  const response = await fetch(parsed.href, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`)
  return response.text()
})

function createWindow() {
  const window = new BrowserWindow({ width: 1200, height: 900, minWidth: 360, minHeight: 600, backgroundColor: '#16181c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true } })
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
