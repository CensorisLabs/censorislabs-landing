import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { APP_VERSION } from './version.js'

const parts = {
  cpu: [
    { name: 'AM5 desktop CPU · 65 W class', socket: 'AM5', watts: 65 },
    { name: 'AM5 desktop CPU · 120 W class', socket: 'AM5', watts: 120 },
    { name: 'LGA1700 desktop CPU · 65 W class', socket: 'LGA1700', watts: 65 },
    { name: 'LGA1700 desktop CPU · 125 W class', socket: 'LGA1700', watts: 125 },
    { name: 'LGA1851 desktop CPU · 65 W class', socket: 'LGA1851', watts: 65 },
  ],
  board: [
    { name: 'B650 micro-ATX · AM5 · DDR5', socket: 'AM5', memory: 'DDR5' },
    { name: 'B850 ATX · AM5 · DDR5', socket: 'AM5', memory: 'DDR5' },
    { name: 'B760 micro-ATX · LGA1700 · DDR4', socket: 'LGA1700', memory: 'DDR4' },
    { name: 'B760 ATX · LGA1700 · DDR5', socket: 'LGA1700', memory: 'DDR5' },
    { name: 'B860 micro-ATX · LGA1851 · DDR5', socket: 'LGA1851', memory: 'DDR5' },
  ],
  memory: [{ name: 'DDR4 · 32 GB kit', kind: 'DDR4' }, { name: 'DDR5 · 32 GB kit', kind: 'DDR5' }, { name: 'DDR5 · 64 GB kit', kind: 'DDR5' }],
  gpu: [{ name: 'Compact GPU · 180 W · 250 mm', watts: 180, length: 250 }, { name: 'Mid-range GPU · 250 W · 300 mm', watts: 250, length: 300 }, { name: 'High-power GPU · 350 W · 340 mm', watts: 350, length: 340 }],
  psu: [{ name: '550 W power supply', watts: 550 }, { name: '650 W power supply', watts: 650 }, { name: '750 W power supply', watts: 750 }, { name: '850 W power supply', watts: 850 }],
  case: [{ name: 'Compact case · max GPU 270 mm', maxGpu: 270 }, { name: 'Mid-tower · max GPU 330 mm', maxGpu: 330 }, { name: 'Large tower · max GPU 390 mm', maxGpu: 390 }],
  storage: [{ name: 'NVMe SSD · 1 TB' }, { name: 'NVMe SSD · 2 TB' }, { name: 'SATA SSD · 1 TB' }, { name: 'Hard drive · 2 TB' }],
}
const categories = [['cpu','Processor'],['board','Motherboard'],['memory','Memory'],['gpu','Graphics'],['psu','Power supply'],['case','Case'],['storage','Storage']]
// A corrupt or foreign value in local storage must never blank the app, and a
// stale part index must not point outside the catalog.
const readSavedBuild = () => {
  try {
    const value = JSON.parse(localStorage.getItem('censoris-pc-build') || 'null')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    localStorage.removeItem('censoris-pc-build')
    return {}
  }
}
const saved = readSavedBuild()
const savedIndex = (key) => { const index = Number(saved[key]); return Number.isInteger(index) && index >= 0 && index < parts[key].length ? index : -1 }
const state = Object.fromEntries(categories.map(([key]) => [key, savedIndex(key)]))
const priceState = Object.fromEntries(categories.map(([key]) => [key, typeof saved.prices?.[key] === 'string' || typeof saved.prices?.[key] === 'number' ? saved.prices[key] : '']))
let storageName = typeof saved?.storageText === 'string' ? saved.storageText : ''
let budget = Math.max(0, Number(saved?.budget) || 0)
const priceTotal = () => categories.reduce((sum, [key]) => { const picked = state[key] >= 0 && parts[key]?.[state[key]]; const value = Number(priceState[key]); return sum + (picked && Number.isFinite(value) && value > 0 ? value : 0) }, 0)

mountApp({
  appId: 'pc-part-picker',
  version: APP_VERSION,
  eyebrow: 'PC HARDWARE · COMPATIBILITY',
  title: 'Plan a build with confidence.',
  description: 'Choose parts, enter prices from your preferred shops, and catch common socket, memory, clearance, and power mismatches before you buy.',
  content: `<div class="content-grid"><section class="panel"><p class="eyebrow">YOUR BUILD</p><h2>Choose components</h2><div id="part-list"></div><div class="field"><label for="build-name">Name this build</label><input id="build-name" placeholder="e.g. Studio PC" maxlength="40"></div><div class="actions"><button class="btn" id="save-build">Save this build</button><button class="btn btn--outline" id="export-build">Copy parts list</button><button class="btn btn--quiet" id="reset">Clear build</button></div><p class="status" id="save-status" aria-live="polite"></p><div id="build-library"></div></section><aside class="result-card"><span class="metric-label">ESTIMATED BUILD TOTAL</span><div class="metric" id="total">₹0</div><div class="metric-list"><div class="metric-row"><span>Estimated component draw</span><strong id="draw">—</strong></div><div class="metric-row"><span>Suggested PSU headroom</span><strong id="headroom">—</strong></div><div class="metric-row"><span>Build budget</span><strong id="budget-left">—</strong></div></div><div class="field"><label for="budget">Build budget (₹)</label><input id="budget" type="number" min="0" step="100" value="${budget || ''}" placeholder="Optional"></div><p class="notice" id="compatibility" aria-live="polite">Choose components to check the selected combination.</p></aside></div>`,
})

const $ = (id) => document.getElementById(id)
const LIBRARY_KEY = 'censoris-pc-builds'
function readBuilds() { try { const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'); return Array.isArray(value) ? value.filter(entry => entry && entry.name && entry.state && typeof entry.state === 'object') : [] } catch { return [] } }
let builds = readBuilds()
function writeBuilds() { try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(builds.slice(0, 20))) } catch {} }
function snapshot(name) { return { name, savedAt: Date.now(), state: { ...state }, prices: { ...priceState }, storageText: storageName, budget, total: priceTotal() } }
function renderLibrary() {
  $('build-library').innerHTML = builds.length ? `<p class="eyebrow" style="margin-top:20px">SAVED BUILDS</p>${builds.map((entry, index) => `<div class="source-row"><span><b>${escapeHtml(entry.name)}</b><small>${money(entry.total)} · ${new Date(entry.savedAt).toLocaleDateString('en-IN')}</small></span><span class="actions"><button class="btn btn--quiet" data-load="${index}">Load</button><button class="btn btn--quiet" data-delete="${index}" aria-label="Delete ${escapeHtml(entry.name)}">×</button></span></div>`).join('')}` : ''
  $('build-library').querySelectorAll('[data-load]').forEach(button => button.addEventListener('click', () => {
    const entry = builds[Number(button.dataset.load)]
    if (!entry) return
    for (const [key] of categories) { const index = Number(entry.state[key]); state[key] = Number.isInteger(index) && index >= 0 && index < parts[key].length ? index : -1 }
    for (const [key] of categories) { const value = Number(entry.prices?.[key]); priceState[key] = Number.isFinite(value) && value >= 0 ? String(value) : '' }
    storageName = typeof entry.storageText === 'string' ? entry.storageText : ''
    budget = Math.max(0, Number(entry.budget) || 0)
    $('budget').value = budget ? String(budget) : ''
    $('build-name').value = entry.name
    renderList(); update()
    $('save-status').textContent = `Loaded “${entry.name}”.`
  }))
  $('build-library').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => {
    if (!window.confirm(`Delete “${builds[Number(button.dataset.delete)]?.name || 'this build'}”?`)) return
    builds.splice(Number(button.dataset.delete), 1); writeBuilds(); renderLibrary()
  }))
}
const money = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`
const selection = (key) => parts[key]?.[state[key]]
function options(key) { return parts[key].map((part, index) => `<option value="${index}"${state[key] === index ? ' selected' : ''}>${part.name}</option>`).join('') }
function renderList() {
  $('part-list').innerHTML = categories.map(([key, label]) => {
    const list = parts[key]
    return `<div class="source-row"><div class="field" style="flex:1"><label for="part-${key}">${label}</label><select id="part-${key}" class="part-select" data-key="${key}"><option value="-1">Select ${label.toLowerCase()}</option>${options(key)}</select></div><div class="field" style="width:150px"><label for="price-${key}">Your price (₹)</label><input id="price-${key}" class="part-price" data-key="${key}" type="number" min="0" step="100" placeholder="Optional" value="${priceState[key]}"></div></div>`
  }).join('')
  // Storage is an open text entry because form factor and interface vary by drive.
  document.querySelector('.part-select[data-key="storage"]').innerHTML = `<option value="-1">Select storage</option><option>NVMe SSD · 1 TB</option><option>NVMe SSD · 2 TB</option><option>SATA SSD · 1 TB</option><option>Hard drive · 2 TB</option>`
  document.querySelectorAll('.part-select').forEach(select => select.addEventListener('change', event => {
    const key = event.currentTarget.dataset.key
    state[key] = key === 'storage' ? event.currentTarget.selectedIndex - 1 : Number(event.currentTarget.value)
    if (key === 'storage') storageName = event.currentTarget.selectedOptions[0]?.text || ''
    update()
  }))
  document.querySelectorAll('.part-price').forEach(input => input.addEventListener('input', event => {
    const key = event.currentTarget.dataset.key, raw = event.currentTarget.value, value = Number(raw)
    if (raw !== '' && (!Number.isFinite(value) || value < 0)) { event.currentTarget.value = '0'; priceState[key] = '0' } else priceState[key] = raw
    update()
  }))
  const storageSelect = document.querySelector('[data-key="storage"]')
  const storageIndex = storageName ? [...storageSelect.options].findIndex(option => option.text === storageName) : -1
  if (storageIndex > 0) {
    storageSelect.selectedIndex = storageIndex
    state.storage = storageIndex - 1
  } else if (state.storage >= 0 && state.storage < storageSelect.options.length - 1) {
    storageSelect.selectedIndex = state.storage + 1
    storageName = storageSelect.selectedOptions[0]?.text || ''
  }
}
function update() {
  const total = priceTotal()
  const cpu = selection('cpu'), board = selection('board'), memory = selection('memory'), gpu = selection('gpu'), psu = selection('psu'), casing = selection('case')
  const draw = (cpu?.watts || 0) + (gpu?.watts || 0) + (cpu || gpu ? 100 : 0)
  const recommended = Math.ceil(draw * 1.3 / 50) * 50
  const issues = []
  if (cpu && board && cpu.socket !== board.socket) issues.push(`Processor socket ${cpu.socket} does not match motherboard ${board.socket}.`)
  if (board && memory && board.memory !== memory.kind) issues.push(`${board.memory} motherboard cannot use the selected ${memory.kind} memory.`)
  if (gpu && casing && gpu.length > casing.maxGpu) issues.push(`Graphics card length ${gpu.length} mm exceeds case clearance ${casing.maxGpu} mm.`)
  if (psu && recommended && psu.watts < recommended) issues.push(`Selected ${psu.watts} W power supply is below the estimated ${recommended} W headroom target.`)
  $('total').textContent = money(total)
  $('draw').textContent = draw ? `~${draw} W` : '—'
  $('headroom').textContent = recommended ? `~${recommended} W` : '—'
  const remaining = budget - total
  $('budget-left').textContent = budget > 0 ? (remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over`) : '—'
  $('compatibility').textContent = issues.length ? `Review: ${issues.join(' ')}` : cpu || board || memory || gpu || psu || casing ? 'No mismatch found in the selected compatibility fields.' : 'Choose components to check the selected combination.'
  $('compatibility').className = issues.length ? 'notice error' : 'notice'
  try { localStorage.setItem('censoris-pc-build', JSON.stringify({ ...state, prices: priceState, storageText: storageName, budget })) } catch {}
}
renderList(); update(); renderLibrary()
$('budget').addEventListener('input', event => { budget = Math.max(0, Number(event.currentTarget.value) || 0); update() })
$('save-build').addEventListener('click', () => {
  const name = $('build-name').value.trim() || `Build ${builds.length + 1}`
  const entry = snapshot(name)
  const existing = builds.findIndex(build => build.name.toLowerCase() === name.toLowerCase())
  if (existing >= 0) builds[existing] = entry; else builds.unshift(entry)
  writeBuilds(); renderLibrary()
  $('save-status').textContent = `Saved “${name}” on this device.`
})
$('export-build').addEventListener('click', async () => {
  const lines = categories.map(([key, label]) => `${label}: ${selection(key)?.name || 'not selected'}${selection(key) && Number(priceState[key]) > 0 ? ` — ₹${Number(priceState[key]).toLocaleString('en-IN')}` : ''}`)
  lines.push(`Estimated total: ${money(priceTotal())}`)
  const text = lines.join(String.fromCharCode(10))
  try { await navigator.clipboard.writeText(text); $('save-status').textContent = 'Parts list copied to the clipboard.' }
  catch { $('save-status').textContent = text }
})
$('reset').addEventListener('click', () => { if (!window.confirm('Clear this build from this device?')) return; try { localStorage.removeItem('censoris-pc-build') } catch {}; location.reload() })
