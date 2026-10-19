const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
function createWindow() { const win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1024, minHeight: 720, backgroundColor: '#f5f7f2', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true } }); win.webContents.setWindowOpenHandler(({ url }) => { try { const parsed = new URL(url); if (parsed.protocol === 'https:' && (parsed.hostname === 'rzp.io' || parsed.hostname.endsWith('.razorpay.com') || parsed.hostname === 'razorpay.com')) void shell.openExternal(url) } catch { /* Reject malformed external URLs. */ } return { action: 'deny' } }); win.loadFile(path.join(__dirname, '..', 'dist', 'index.html')) }
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
