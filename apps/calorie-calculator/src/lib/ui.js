const ICONS = {
  leaf: '<path d="M20.5 3.5c-7.5 0-13 4.2-13 10.2 0 2.1.7 4 1.9 5.5C12 15.2 16 12 21 10c-3.7 2.6-6.4 6-7.8 10.4 4.6-.2 7.3-3.6 7.3-8.9 0-1.7-.2-3.4-.2-5.1-.1-1.3.1-2 .2-2.9z"/>',
  home: '<path d="M3 10.8 12 3l9 7.8V21H14v-7h-4v7H3z"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 3v18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  water: '<path d="M12 2.5s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.5 12 2.5 12 2.5z"/>',
  flame: '<path d="M12 22c4.2 0 7-2.8 7-6.6 0-2.8-1.9-5.2-3.9-7.5C13.5 5.9 12 3.7 12 1.5c-3 3-7 6.6-7 11.2C5 18.7 8 22 12 22z"/><path d="M9.5 16.5c0 1.6 1.1 2.7 2.5 2.7s2.5-1.1 2.5-2.7c0-1.4-1.2-2.5-2.5-4-1.3 1.5-2.5 2.6-2.5 4z"/>',
  dumbbell: '<path d="M6.5 7.5 4 10v4l2.5 2.5M17.5 7.5 20 10v4l-2.5 2.5M8 5v14M16 5v14M8 12h8"/>',
  scale: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M8 13a4 4 0 0 1 8 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4.5 4.5L19 6.5"/>',
  left: '<path d="m14.5 5-7 7 7 7"/>',
  right: '<path d="m9.5 5 7 7-7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2 2-2 5-2 7h4c0-2 0-5-2-7zM17 10v11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise: '<path d="M4 18h16M12 3v4M5.6 10.6 7 12M18.4 10.6 17 12M8 18a4 4 0 0 1 8 0"/><path d="M2 21h20"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 22l5-2.5L17 22l-1.5-9"/>',
  crown: '<path d="m3 7 4.5 4L12 4l4.5 7L21 7l-1.6 11H4.6z"/><path d="M5 21h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 21a6 6 0 0 0-2-5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2z"/><path d="M3 7h15M16 12h5v4h-5a2 2 0 0 1 0-4z"/>',
  activity: '<path d="M2 12h4l2.5-7 4 14 3-9 2 2H22"/>',
  footsteps: '<path d="M8 4c1.7 0 2.5 1.6 2.5 4S9.7 13 8 13s-2.5-1.6-2.5-4S6.3 4 8 4zM7 15c1.5 0 2.4 1.3 2.4 3S8.5 22 7 22s-2.4-1.3-2.4-3S5.5 15 7 15zM17 8c1.7 0 2.5 1.6 2.5 4s-.8 5-2.5 5-2.5-1.6-2.5-4 .8-5 2.5-5zM16 17c1.5 0 2.4 1.3 2.4 3S17.5 24 16 24s-2.4-1.3-2.4-3 .9-4 2.4-4z"/>',
  mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
  barcode: '<path d="M4 5v14M7 5v14M10 5v10M13 5v14M16 5v10M19 5v14M21 5v14"/>',
  print: '<path d="M7 8V3h10v5M7 17H4V9h16v8h-3"/><rect x="7" y="14" width="10" height="7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  offline: '<path d="M2 2l20 20"/><path d="M8.5 8.6A10 10 0 0 1 22 10M2 10a10 10 0 0 1 4-2M6 14a7 7 0 0 1 9 0M9 18a3 3 0 0 1 4 0M12 22h.01"/>',
  install: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M12 7v7M9 11l3 3 3-3M9 17h6"/>',
  undo: '<path d="M4 9h10a6 6 0 0 1 0 12H9"/><path d="m4 5v4h4"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  sort: '<path d="M4 7h12M4 12h8M4 17h4M18 5v14M15 16l3 3 3-3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  heart: '<path d="M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.2a5 5 0 0 0 0-7.1z"/>',
  flask: '<path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3"/><path d="M7 15h10"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6v4H9z"/>',
  arrowUp: '<path d="M12 20V4M5 11l7-7 7 7"/>',
  arrowDown: '<path d="M12 4v16M5 13l7 7 7-7"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export function icon(name, className = '') {
  return `<svg class="kc-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.circle}</svg>`
}

export function fmt(value, decimals = 0) {
  const number = Number(value) || 0
  return number.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function ring(pct, inner = '', { size = 196, thickness = 14, tone = 'accent', className = '' } = {}) {
  const value = clamp(Number(pct) || 0, 0, 100)
  return `<div class="kc-ring ${className}" style="--size:${size}px;--thick:${thickness}px;--pct:${value};--tone:var(--${tone})"><div class="kc-ring__inner">${inner}</div></div>`
}

export function miniRing(pct, label, tone = 'accent') {
  return `<div class="kc-mini-ring" style="--pct:${clamp(Number(pct) || 0, 0, 100)};--tone:var(--${tone})" role="img" aria-label="${esc(label)}"><span>${Math.round(pct || 0)}%</span></div>`
}

export function bar(value, max, tone = 'accent', className = '') {
  const pct = max > 0 ? clamp(value / max * 100, 0, 100) : 0
  return `<div class="kc-progress ${className}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%;--tone:var(--${tone})"></span></div>`
}

export function macroBar(value, max, tone, label) {
  return `<div class="kc-macro-bar"><div class="kc-macro-bar__head"><span>${esc(label)}</span><b>${fmt(value, 0)}<small> / ${fmt(max, 0)} g</small></b></div>${bar(value, max, tone)}</div>`
}

export function emptyState(iconName, title, body, action = '') {
  return `<div class="kc-empty">${icon(iconName)}<h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`
}

export function lineChart(points, { height = 190, width = 640, tone = 'accent', target = null, area = true } = {}) {
  if (!points.length) return '<div class="kc-chart-empty">No data yet.</div>'
  const padding = { top: 16, right: 12, bottom: 24, left: 12 }
  const values = points.map(point => Number(point.value) || 0)
  const minValue = Math.min(...values, target || Infinity)
  const maxValue = Math.max(...values, target || -Infinity)
  const spread = Math.max(1, maxValue - minValue)
  const min = minValue - spread * 0.15
  const max = maxValue + spread * 0.15
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const coords = points.map((point, index) => {
    const x = padding.left + (points.length === 1 ? innerWidth / 2 : index / (points.length - 1) * innerWidth)
    const y = padding.top + innerHeight - (Number(point.value) - min) / (max - min) * innerHeight
    return { x, y, label: point.label, value: Number(point.value) }
  })
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L${coords.at(-1).x.toFixed(1)},${(height - padding.bottom).toFixed(1)} L${coords[0].x.toFixed(1)},${(height - padding.bottom).toFixed(1)} Z`
  const targetY = target != null ? padding.top + innerHeight - (target - min) / (max - min) * innerHeight : null
  const guides = [0, 0.5, 1].map(fraction => padding.top + innerHeight * fraction)
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  return `<svg class="kc-line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Trend chart">
    <defs><linearGradient id="kc-area-${tone}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--${tone})" stop-opacity=".28"/><stop offset="100%" stop-color="var(--${tone})" stop-opacity="0"/></linearGradient></defs>
    ${guides.map(y => `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" class="kc-chart-guide"/>`).join('')}
    ${targetY != null ? `<line x1="${padding.left}" x2="${width - padding.right}" y1="${targetY}" y2="${targetY}" class="kc-chart-target"/>` : ''}
    ${area ? `<path d="${areaPath}" fill="url(#kc-area-${tone})"/>` : ''}
    <path d="${path}" class="kc-chart-line" style="stroke:var(--${tone})"/>
    ${coords.length <= 40 ? coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="2.6" class="kc-chart-dot" style="fill:var(--${tone})"/>`).join('') : ''}
    ${labelIndexes.map(index => `<text x="${coords[index].x}" y="${height - 6}" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}" class="kc-chart-label">${esc(points[index].label || '')}</text>`).join('')}
  </svg>`
}

export function barChart(items, { target = null, height = 150 } = {}) {
  const max = Math.max(...items.map(item => Number(item.value) || 0), target || 0, 1)
  return `<div class="kc-bars" style="--bar-h:${height}px">${items.map(item => {
    const value = Number(item.value) || 0
    const pct = value / max * 100
    return `<div class="kc-bar ${item.accent ? 'is-accent' : ''}" title="${esc(item.label)}: ${fmt(value)}${item.unit || ''}">
      <div class="kc-bar__track"><span style="height:${clamp(pct, 2, 100)}%"></span>${target != null ? `<i style="bottom:${clamp(target / max * 100, 0, 100)}%"></i>` : ''}</div>
      <small>${esc(item.short ?? item.label)}</small>
    </div>`
  }).join('')}</div>`
}

export function heatmap(cells, { weeks = 16 } = {}) {
  return `<div class="kc-heatmap" style="--weeks:${weeks}" role="img" aria-label="Logging heatmap">${cells.map(cell => `<span class="kc-heat kc-heat--${cell.level || 0}" title="${esc(cell.label)}"></span>`).join('')}</div>`
}

export function statBlock(label, value, note = '', tone = '') {
  return `<div class="kc-stat ${tone ? `kc-stat--${tone}` : ''}"><span>${esc(label)}</span><b>${value}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`
}

let toastTimer = 0

export function toast(message, type = 'ok') {
  let stack = document.getElementById('kc-toasts')
  if (!stack) {
    stack = document.createElement('div')
    stack.id = 'kc-toasts'
    stack.className = 'kc-toasts'
    stack.setAttribute('aria-live', 'polite')
    document.body.append(stack)
  }
  const node = document.createElement('div')
  node.className = `kc-toast kc-toast--${type}`
  node.innerHTML = `${icon(type === 'error' ? 'info' : type === 'undo' ? 'undo' : 'check')}<span>${esc(message)}</span>`
  stack.append(node)
  while (stack.children.length > 3) stack.firstElementChild.remove()
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => node.classList.add('is-out'), 2600)
  window.setTimeout(() => node.remove(), 3200)
}

let previousFocus = null
let modalKeyHandler = null

export function openModal({ title = '', eyebrow = '', subtitle = '', body = '', footer = '', size = 'md', onMount = null, dismissible = true, className = '' }) {
  closeModal()
  previousFocus = document.activeElement
  const backdrop = document.createElement('div')
  backdrop.className = 'kc-modal-backdrop'
  backdrop.innerHTML = `<section class="kc-modal kc-modal--${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="kc-modal-title">
    <header class="kc-modal__head">
      <div>${eyebrow ? `<p class="kc-eyebrow">${esc(eyebrow)}</p>` : ''}<h2 id="kc-modal-title">${esc(title)}</h2>${subtitle ? `<p class="kc-modal__sub">${esc(subtitle)}</p>` : ''}</div>
      ${dismissible ? '<button class="kc-icon-btn kc-modal__close" type="button" aria-label="Close dialog" data-close-modal>×</button>' : '<span class="kc-modal__lock" aria-hidden="true"></span>'}
    </header>
    <div class="kc-modal__body">${body}</div>
    ${footer ? `<footer class="kc-modal__foot">${footer}</footer>` : ''}
  </section>`
  document.body.append(backdrop)
  document.body.classList.add('kc-modal-open')
  const modal = backdrop.querySelector('.kc-modal')
  const focusable = () => [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null)
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop && dismissible) closeModal()
    if (event.target.closest('[data-close-modal]') && dismissible) closeModal()
  })
  modalKeyHandler = event => {
    if (event.key === 'Escape' && dismissible) { event.preventDefault(); closeModal() }
    if (event.key === 'Tab') {
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  document.addEventListener('keydown', modalKeyHandler)
  window.requestAnimationFrame(() => {
    const preferred = modal.querySelector('[data-autofocus]') || focusable().find(element => !element.matches('.kc-modal__close'))
    preferred?.focus({ preventScroll: true })
  })
  if (onMount) onMount(modal, backdrop)
  return modal
}

export function closeModal() {
  const backdrop = document.querySelector('.kc-modal-backdrop')
  if (!backdrop) return
  backdrop.remove()
  document.body.classList.remove('kc-modal-open')
  if (modalKeyHandler) document.removeEventListener('keydown', modalKeyHandler)
  modalKeyHandler = null
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true })
  previousFocus = null
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      closeModal()
      resolve(value)
    }
    openModal({
      title,
      eyebrow: 'Please confirm',
      body: `<p class="kc-copy">${esc(message)}</p>`,
      footer: `<button class="kc-btn kc-btn--ghost" type="button" data-cancel>${esc(cancelLabel)}</button><button class="kc-btn ${danger ? 'kc-btn--danger' : ''}" type="button" data-confirm>${esc(confirmLabel)}</button>`,
      size: 'sm',
      onMount(modal) {
        modal.querySelector('[data-confirm]').addEventListener('click', () => finish(true))
        modal.querySelector('[data-cancel]').addEventListener('click', () => finish(false))
        modal.closest('.kc-modal-backdrop').addEventListener('click', event => {
          if (event.target === event.currentTarget) finish(false)
        })
        modal.querySelector('[data-close-modal]')?.addEventListener('click', () => finish(false))
      },
    })
  })
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    area.remove()
    return ok
  }
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timeLabel(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function sectionHeading(eyebrow, title, action = '') {
  return `<div class="kc-section-head"><div>${eyebrow ? `<p class="kc-eyebrow">${esc(eyebrow)}</p>` : ''}<h2>${esc(title)}</h2></div>${action}</div>`
}

export function pill(text, tone = '') {
  return `<span class="kc-pill ${tone ? `kc-pill--${tone}` : ''}">${esc(text)}</span>`
}
