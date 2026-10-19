import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'archive-explorer', eyebrow: 'PUBLIC DIGITAL COLLECTIONS', title: 'Find something worth keeping.',
  description: 'Search public Internet Archive item metadata and open the original collection page. Access and reuse rights vary by item; check its rights statement before using it.',
  content: `<section class="panel"><p class="eyebrow">INTERNET ARCHIVE SEARCH</p><h2>Explore the catalog</h2><form id="search-form" class="search-row"><input id="query" required placeholder="Title, creator, topic, or phrase" aria-label="Search the Internet Archive"><select id="media"><option value="">All formats</option><option value="texts">Texts</option><option value="movies">Movies</option><option value="audio">Audio</option><option value="software">Software</option><option value="image">Images</option></select><button class="btn">Search</button></form><div class="actions"><button class="btn btn--quiet" id="save-search">Save this search · Pro</button><span class="status" id="status" aria-live="polite">Searches are sent to archive.org.</span></div></section><section class="panel" style="margin-top:18px"><div class="section-heading"><div><p class="eyebrow">CATALOG RESULTS</p><h2 id="heading">Recent finds</h2></div><a class="btn btn--outline" href="https://archive.org" target="_blank" rel="noopener noreferrer">Visit Archive.org ↗</a></div><div id="results" class="result-grid" aria-live="polite"><div class="empty" style="grid-column:1/-1">Search for a title or subject to explore items.</div></div><div class="actions"><button class="btn btn--quiet" id="more" hidden>Load more</button></div><p class="source-credit">Search metadata provided by the Internet Archive Advanced Search API. Item availability, rights, and download options are determined by the item page.</p></section>`
})

const $ = (id) => document.getElementById(id)
const escape = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
let page = 1, currentQuery = '', busy = false
function render(rows, append = false) {
  const html = rows.map((item) => {
    const id = String(item.identifier || '')
    const url = `https://archive.org/details/${encodeURIComponent(id)}`
    const creator = Array.isArray(item.creator) ? item.creator.join(', ') : item.creator
    return `<article class="result-item"><span class="eyebrow">${escape(item.mediatype || 'ARCHIVE ITEM')}</span><h3><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(item.title || id)}</a></h3><p>${escape(creator || item.year || 'Open item details for metadata, availability and rights information.')}</p><div class="result-meta"><span>${escape(item.year || 'Date not listed')}</span><span>${escape(id)}</span></div></article>`
  }).join('')
  $('results').innerHTML = append ? $('results').innerHTML + html : html || '<div class="empty" style="grid-column:1/-1">No items matched. Try a shorter search.</div>'
}
async function search(append = false) {
  if (busy) return; busy = true
  if (!append) { page = 1; currentQuery = $('query').value.trim(); $('results').innerHTML = '<div class="skeleton" style="grid-column:1/-1"></div>'; $('heading').textContent = `Results for “${currentQuery}”` }
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
$('save-search').addEventListener('click', () => showPaywall('saved archive searches'))
window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
