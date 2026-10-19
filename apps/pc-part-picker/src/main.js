import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

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
const saved = JSON.parse(localStorage.getItem('censoris-pc-build') || 'null')
const state = Object.fromEntries(categories.map(([key]) => [key, saved?.[key] ?? 0]))
const priceState = Object.fromEntries(categories.map(([key]) => [key, saved?.prices?.[key] ?? '']))

mountApp({
  appId: 'pc-part-picker',
  eyebrow: 'PC HARDWARE · COMPATIBILITY',
  title: 'Plan a build with confidence.',
  description: 'Choose parts, enter prices from your preferred shops, and catch common socket, memory, clearance, and power mismatches before you buy.',
  content: `<div class="content-grid"><section class="panel"><p class="eyebrow">YOUR BUILD</p><h2>Choose components</h2><div id="part-list"></div><div class="actions"><button class="btn" id="save-build">Save this build</button><button class="btn btn--quiet" id="reset">Clear build</button></div><p class="status" id="save-status" aria-live="polite"></p></section><aside class="result-card"><span class="metric-label">ESTIMATED BUILD TOTAL</span><div class="metric" id="total">₹0</div><div class="metric-list"><div class="metric-row"><span>Estimated component draw</span><strong id="draw">—</strong></div><div class="metric-row"><span>Suggested PSU headroom</span><strong id="headroom">—</strong></div></div><p class="notice" id="compatibility" aria-live="polite">Choose components to check the selected combination.</p></aside></div><section class="panel" style="margin-top:18px"><p class="eyebrow">CENSORISLABS PRO</p><h2>Keep more than one build.</h2><p>Compare saved configurations, track your own shop prices, and export a clean parts list for your next upgrade.</p><div class="feature-lock"><span><b>Build library & price comparison</b><small>Multiple local builds · no account required</small></span><button class="btn btn--outline" id="pro">Explore Pro</button></div><p class="muted-copy" style="margin:14px 0 0">Compatibility checks cover the fields shown here. Check exact board BIOS support, cooler fit, power connectors, and vendor specifications before purchase.</p></section>`,
})

const $ = (id) => document.getElementById(id)
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
  document.querySelectorAll('.part-select').forEach(select => select.addEventListener('change', event => { const key = event.currentTarget.dataset.key; state[key] = key === 'storage' ? event.currentTarget.selectedIndex - 1 : Number(event.currentTarget.value); update() }))
  document.querySelectorAll('.part-price').forEach(input => input.addEventListener('input', event => { priceState[event.currentTarget.dataset.key] = event.currentTarget.value; update() }))
  if (saved?.storageText) document.querySelector('[data-key="storage"]').selectedIndex = [...document.querySelector('[data-key="storage"]').options].findIndex(option => option.text === saved.storageText)
}
function update() {
  const total = Object.values(priceState).reduce((sum, price) => sum + (Number(price) || 0), 0)
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
  $('compatibility').textContent = issues.length ? `Review: ${issues.join(' ')}` : cpu || board || memory || gpu || psu || casing ? 'No mismatch found in the selected compatibility fields.' : 'Choose components to check the selected combination.'
  $('compatibility').className = issues.length ? 'notice error' : 'notice'
  localStorage.setItem('censoris-pc-build', JSON.stringify({ ...state, prices: priceState, storageText: document.querySelector('[data-key="storage"]')?.selectedOptions[0]?.text || '' }))
}
renderList(); update()
$('save-build').addEventListener('click', () => { $('save-status').textContent = 'Build saved locally on this device.' })
$('reset').addEventListener('click', () => { localStorage.removeItem('censoris-pc-build'); location.reload() })
$('pro').addEventListener('click', () => showPaywall('build library and price comparison'))
