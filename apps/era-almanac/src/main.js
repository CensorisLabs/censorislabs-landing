import '../../shared/base.css'
import './era.css'
import { mountApp } from '../../shared/shell.js'
import { APP_VERSION } from './version.js'
import { ERAS, ALL_FACTS } from './facts.js'

const SAVED_KEY = 'era-almanac-saved'
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
// A corrupt saved list must never blank the app, and an unknown id from an
// older version is dropped rather than rendered as an empty card.
const readSaved = () => {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    if (!Array.isArray(value)) return []
    const known = new Set(ALL_FACTS.map((fact) => fact.id))
    return [...new Set(value.filter((id) => typeof id === 'string' && known.has(id)))].slice(0, 200)
  } catch { return [] }
}
let saved = readSaved()
let activeEra = 'all'
let current = null

const factById = (id) => ALL_FACTS.find((fact) => fact.id === id) || null
const poolFor = (eraId) => (eraId === 'all' ? ALL_FACTS : ALL_FACTS.filter((fact) => fact.eraId === eraId))
function randomFact(eraId) {
  const pool = poolFor(eraId)
  const alternatives = pool.filter((fact) => fact.id !== current?.id)
  const choices = alternatives.length ? alternatives : pool
  return choices[Math.floor(Math.random() * choices.length)] || null
}

mountApp({
  appId: 'era-almanac',
  version: APP_VERSION,
  eyebrow: 'HISTORY · LOCAL-FIRST ALMANAC',
  title: 'Pick an era. Leave with something odd.',
  description: `${ALL_FACTS.length} hand-checked facts across ${ERAS.length} eras of history. They ship with the app, so the almanac works offline and nothing you save leaves this device.`,
  content: `<section class="panel"><div class="section-heading"><div><p class="eyebrow">CHOOSE YOUR CENTURY</p><h2>Where should we start?</h2></div><span class="pill" id="era-count">${ERAS.length} eras</span></div><div class="era-grid" id="era-grid"></div><div class="actions" style="margin-top:16px"><button class="btn btn--quiet" id="any-era">Any era · surprise me</button></div></section><section class="panel era-deck" style="margin-top:18px"><div class="section-heading"><p class="eyebrow" id="fact-era">READY WHEN YOU ARE</p><span class="pill" id="fact-index"></span></div><blockquote class="fact-text" id="fact-text">Pick an era above, then draw a fact.</blockquote><div class="actions"><button class="btn" id="draw">Draw a fact</button><button class="btn btn--outline" id="save-fact" disabled>☆ Save fact</button><button class="btn btn--quiet" id="copy-fact" disabled>Copy fact</button></div><p class="status" id="deck-status" aria-live="polite"></p></section><section class="panel" id="saved-panel" style="margin-top:18px" hidden><div class="section-heading"><div><p class="eyebrow">KEPT ON THIS DEVICE</p><h2>Saved facts</h2></div><button class="btn btn--quiet" id="clear-saved">Clear all</button></div><div id="saved-list" class="saved-list"></div></section>`,
})

const $ = (id) => document.getElementById(id)

function renderEras() {
  $('era-grid').innerHTML = ERAS.map((era) => `<button type="button" class="era-card" data-era="${era.id}" aria-pressed="${era.id === activeEra}"><span class="era-name">${escape(era.name)}</span><span class="era-span">${escape(era.span)}</span><p>${escape(era.hook)}</p><small>${era.facts.length} facts</small></button>`).join('')
  $('era-grid').querySelectorAll('[data-era]').forEach((button) => button.addEventListener('click', () => {
    activeEra = button.dataset.era
    const era = ERAS.find((entry) => entry.id === activeEra)
    setFact(randomFact(activeEra))
    $('deck-status').textContent = `Drawing from ${era?.name || 'every era'}.`
    renderEras()
  }))
}

function renderFact() {
  const era = ERAS.find((entry) => entry.id === current?.eraId)
  $('fact-era').textContent = current ? `${current.eraName.toUpperCase()} · ${current.span}` : 'READY WHEN YOU ARE'
  $('fact-text').textContent = current ? current.text : 'Pick an era above, then draw a fact.'
  const pool = poolFor(activeEra)
  $('fact-index').textContent = current ? `${pool.indexOf(current) + 1} / ${pool.length} in ${activeEra === 'all' ? 'all eras' : era?.name || 'this era'}` : ''
  const isSaved = Boolean(current && saved.includes(current.id))
  $('save-fact').disabled = !current
  $('save-fact').textContent = isSaved ? '★ Saved' : '☆ Save fact'
  $('save-fact').setAttribute('aria-pressed', String(isSaved))
  $('copy-fact').disabled = !current
}

function renderSaved() {
  $('saved-panel').hidden = saved.length === 0
  $('saved-list').innerHTML = saved.map((id) => factById(id)).filter(Boolean).map((fact) => `<article class="saved-fact"><p class="eyebrow">${escape(fact.eraName)} · ${escape(fact.span)}</p><p>${escape(fact.text)}</p><button type="button" class="btn btn--quiet" data-remove="${fact.id}">Remove</button></article>`).join('')
  $('saved-list').querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    saved = saved.filter((id) => id !== button.dataset.remove)
    persistSaved()
    renderSaved()
    renderFact()
    $('deck-status').textContent = 'Removed from your saved facts.'
  }))
}

function persistSaved() { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)) } catch { /* storage can be full */ } }

function setFact(fact) {
  current = fact
  renderFact()
}

$('draw').addEventListener('click', () => {
  setFact(randomFact(activeEra))
  $('deck-status').textContent = activeEra === 'all' ? 'Drew a fact from any era.' : 'Drew another fact from this era.'
})

$('any-era').addEventListener('click', () => {
  activeEra = 'all'
  renderEras()
  setFact(randomFact('all'))
  $('deck-status').textContent = 'Drew a fact from any era.'
})

$('save-fact').addEventListener('click', () => {
  if (!current) return
  if (saved.includes(current.id)) {
    saved = saved.filter((id) => id !== current.id)
    $('deck-status').textContent = 'Removed from your saved facts.'
  } else {
    saved = [current.id, ...saved].slice(0, 200)
    $('deck-status').textContent = 'Saved on this device.'
  }
  persistSaved()
  renderSaved()
  renderFact()
})

$('copy-fact').addEventListener('click', async () => {
  if (!current) return
  const text = `${current.text} (${current.eraName}, ${current.span})`
  try {
    await navigator.clipboard.writeText(text)
    $('deck-status').textContent = 'Fact copied to the clipboard.'
  } catch {
    $('deck-status').textContent = text
  }
})

$('clear-saved').addEventListener('click', () => {
  if (!saved.length || !window.confirm('Remove every saved fact from this device?')) return
  saved = []
  persistSaved()
  renderSaved()
  renderFact()
  $('deck-status').textContent = 'Cleared your saved facts.'
})

setFact(randomFact('all'))
renderEras()
renderSaved()
