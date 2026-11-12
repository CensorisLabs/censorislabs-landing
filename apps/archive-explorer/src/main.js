import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { APP_VERSION } from './version.js'

mountApp({
  appId: 'archive-explorer', eyebrow: 'PUBLIC DIGITAL COLLECTIONS', title: 'Find something worth keeping.',
  version: APP_VERSION,
  description: 'Search public Internet Archive item metadata and open the original collection page. Access and reuse rights vary by item; check its rights statement before using it.',
  content: `<section class="panel"><p class="eyebrow">INTERNET ARCHIVE SEARCH</p><h2>Explore the catalog</h2><form id="search-form" class="search-row"><input id="query" required placeholder="Title, creator, topic, or phrase" aria-label="Search the Internet Archive"><select id="media"><option value="">All formats</option><option value="texts">Texts</option><option value="movies">Movies</option><option value="audio">Audio</option><option value="software">Software</option><option value="image">Images</option></select><button class="btn">Search</button></form><div class="actions"><span class="status" id="status" aria-live="polite">Searches are sent to archive.org.</span><button class="btn btn--quiet" id="saved-only">Saved only</button><button class="btn btn--quiet" id="export-saved" hidden>Copy saved</button></div><div class="actions" id="recent" aria-label="Recent searches"></div></section><section class="panel" style="margin-top:18px"><div class="section-heading"><div><p class="eyebrow">CATALOG RESULTS</p><h2 id="heading">Recent finds</h2></div><a class="btn btn--outline" href="https://archive.org" target="_blank" rel="noopener noreferrer">Visit Archive.org ↗</a></div><div id="results" class="result-grid" aria-live="polite"><div class="empty" style="grid-column:1/-1">Search for a title or subject to explore items.</div></div><div class="actions"><button class="btn btn--quiet" id="more" hidden>Load more</button></div><p class="source-credit">Search metadata provided by the Internet Archive Advanced Search API. Item availability, rights, and download options are determined by the item page.</p></section>`
})

const $ = (id) => document.getElementById(id)
const escape = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
let page = 1, currentQuery = '', busy = false, savedOnly = false
const SAVED_KEY = 'censoris-archive-saved'
const RECENT_KEY = 'censoris-archive-recent'
const readStore = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback } catch { return fallback } }
let saved = readStore(SAVED_KEY, [])
let recent = readStore(RECENT_KEY, [])
const saveStores = () => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch {} }
function renderRecent() {
  $('recent').innerHTML = recent.length ? `<span class="eyebrow">RECENT</span>${recent.map(query => `<button class="btn btn--quiet" data-recent="${escape(query)}">${escape(query)}</button>`).join('')}` : ''
  $('recent').querySelectorAll('[data-recent]').forEach(button => button.addEventListener('click', () => { $('query').value = button.dataset.recent; void search() }))
}
function render(rows, append = false) {
  const html = rows.map((item) => {
    const id = String(item.identifier || '')
    const url = `https://archive.org/details/${encodeURIComponent(id)}`
    const creator = Array.isArray(item.creator) ? item.creator.join(', ') : item.creator
    const isSaved = saved.some(entry => entry.id === id)
    return `<article class="result-item"><span class="eyebrow">${escape(item.mediatype || 'ARCHIVE ITEM')}</span><h3><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(item.title || id)}</a></h3><p>${escape(creator || item.year || 'Open item details for metadata, availability and rights information.')}</p><div class="result-meta"><span>${escape(item.year || 'Date not listed')}</span><button class="btn btn--quiet" data-save="${escape(id)}" data-title="${escape(item.title || id)}" data-url="${url}" data-type="${escape(item.mediatype || '')}">${isSaved ? '★ Saved' : '☆ Save'}</button></div></article>`
  }).join('')
  $('results').innerHTML = append ? $('results').innerHTML + html : html || `<div class="empty" style="grid-column:1/-1">${savedOnly ? 'Nothing saved yet. Tap ☆ Save on a result.' : 'No items matched. Try a shorter search.'}</div>`
  $('results').querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    const entry = { id: button.dataset.save, title: button.dataset.title, url: button.dataset.url, type: button.dataset.type }
    if (saved.some(item => item.id === entry.id)) saved = saved.filter(item => item.id !== entry.id)
    else saved = [entry, ...saved].slice(0, 200)
    saveStores(); button.textContent = saved.some(item => item.id === entry.id) ? '★ Saved' : '☆ Save'
    if (savedOnly) showSaved()
  }))
}
function showSaved() {
  savedOnly = true
  $('saved-only').textContent = 'Show search'
  $('heading').textContent = 'Saved items'
  $('more').hidden = true
  $('status').textContent = `${saved.length} saved item${saved.length === 1 ? '' : 's'} on this device`
  $('results').innerHTML = saved.length ? saved.map(item => `<article class="result-item"><span class="eyebrow">${escape(item.type || 'ARCHIVE ITEM')}</span><h3><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.title)}</a></h3><div class="result-meta"><span>${escape(item.id)}</span><button class="btn btn--quiet" data-save="${escape(item.id)}" data-title="${escape(item.title)}" data-url="${escape(item.url)}" data-type="${escape(item.type)}">★ Saved</button></div></article>`).join('') : '<div class="empty" style="grid-column:1/-1">Nothing saved yet. Search and tap ☆ Save on a result.</div>'
  $('results').querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    saved = saved.filter(item => item.id !== button.dataset.save); saveStores(); showSaved()
  }))
  $('export-saved').hidden = !saved.length
}
async function search(append = false) {
  if (busy) return; busy = true
  if (!append) { savedOnly = false; $('saved-only').textContent = 'Saved only' }
  if (!append) { page = 1; currentQuery = $('query').value.trim(); recent = [currentQuery, ...recent.filter(item => item !== currentQuery)].slice(0, 6); saveStores(); renderRecent(); $('results').innerHTML = '<div class="skeleton" style="grid-column:1/-1"></div>'; $('heading').textContent = `Results for “${currentQuery}”` }
  $('status').textContent = 'Searching the catalog…'
  try {
    const params = new URLSearchParams({ q: currentQuery, 'fl[]': 'identifier,title,creator,year,mediatype', rows: '24', page: String(page), output: 'json' })
    const type = $('media').value
    if (type) params.set('q', `(${currentQuery}) AND mediatype:${type}`)
    const response = await fetch(`https://archive.org/advancedsearch.php?${params}`)
    if (!response.ok) throw new Error(`Archive search returned ${response.status}.`)
    const data = await response.json(); const docs = data.response?.docs || []
    render(docs, append); $('more').hidden = !docs.length || docs.length < 24
    $('status').textContent = `${data.response?.numFound?.toLocaleString() || 0} matching catalog records`
  } catch (error) { if (!append) $('results').innerHTML = `<div class="empty error" style="grid-column:1/-1">${escape(error.message || 'Could not reach the Archive. Check your connection.')}</div>`; $('status').textContent = 'Search unavailable.' }
  finally { busy = false }
}
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); void search() })
$('more').addEventListener('click', () => { page += 1; void search(true) })
$('export-saved').addEventListener('click', async () => {
  const text = saved.map(item => `${item.title} — ${item.url}`).join(String.fromCharCode(10))
  try { await navigator.clipboard.writeText(text); $('status').textContent = 'Saved list copied to the clipboard.' }
  catch { $('status').textContent = text.slice(0, 300) }
})
$('saved-only').addEventListener('click', () => { if (savedOnly) { savedOnly = false; $('export-saved').hidden = true; $('saved-only').textContent = 'Saved only'; render([]); $('heading').textContent = 'Recent finds'; $('status').textContent = 'Searches are sent to archive.org.' } else showSaved() })
renderRecent()
