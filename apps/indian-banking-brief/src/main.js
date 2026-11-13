import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { APP_VERSION } from './version.js'

const twoHours = 2 * 60 * 60 * 1000
const defaultSources = [
  { id: 'rbi-releases', name: 'RBI · Press releases', url: 'https://rbi.org.in/pressreleases_rss.xml', category: 'Official regulator' },
  { id: 'rbi-notifications', name: 'RBI · Notifications', url: 'https://rbi.org.in/notifications_rss.xml', category: 'Official regulator' },
  { id: 'sebi', name: 'SEBI · Releases, circulars & orders', url: 'https://www.sebi.gov.in/sebirss.xml', category: 'Official regulator' },
]
const newsroomLinks = [
  ['Business Standard · Banking', 'https://www.business-standard.com/industry/banking'],
  ['Financial Express · Banking & Finance', 'https://www.financialexpress.com/banking-finance/'],
  ['Mint · Industry & Banking', 'https://www.livemint.com/industry/banking'],
  ['ET BFSI', 'https://bfsi.economictimes.indiatimes.com/'],
  ['Moneycontrol · Banks', 'https://www.moneycontrol.com/news/business/banks/'],
  ['The Hindu BusinessLine · Money & Banking', 'https://www.thehindubusinessline.com/money-and-banking/'],
]
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
const storedSources = readJson('censoris-bank-sources', null)
const usableSources = Array.isArray(storedSources) ? storedSources.filter(source => source && typeof source.url === 'string' && source.url.trim()) : []
const customSources = usableSources.filter(source => !defaultSources.some(base => base.url === source.url))
let sources = [...defaultSources, ...customSources]
const storedArticles = readJson('censoris-bank-headlines', [])
let articles = Array.isArray(storedArticles) ? storedArticles.filter(article => article && typeof article === 'object' && article.title) : []
let lastRefresh = Number(localStorage.getItem('censoris-bank-last-refresh') || 0)
const storedSaved = readJson('censoris-bank-saved', [])
let savedIds = new Set(Array.isArray(storedSaved) ? storedSaved.filter(id => typeof id === 'string') : [])
let savedOnly = false
let filterText = ''
let sourceFilter = 'all'
let isRefreshing = false

mountApp({
  appId: 'indian-banking-brief',
  version: APP_VERSION,
  eyebrow: 'INDIA · BANKING BRIEF',
  title: 'The banking signal, gathered.',
  description: 'Official Reserve Bank of India and SEBI updates, gathered locally and refreshed every two hours while the app is open. Headlines link to their original sources.',
  content: `<div class="content-grid"><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><p class="eyebrow">LATEST UPDATES</p><h2>Source-linked headlines</h2></div><button class="btn btn--outline" id="refresh">↻ Refresh now</button></div><p class="muted-copy" id="refresh-state" aria-live="polite">Loading local feed cache…</p><div class="actions"><input id="filter" type="search" placeholder="Filter headlines" aria-label="Filter headlines" style="flex:1"><select id="source-filter" aria-label="Filter by source"><option value="all">All sources</option></select><button class="btn btn--quiet" id="show-saved">Saved only</button></div><div class="news-list" id="headlines"></div></section><aside class="result-card"><p class="eyebrow">CONNECTED SOURCES</p><h2>Primary feeds</h2><div id="source-list"></div><form id="feed-form" class="field" style="margin-top:14px"><label for="feed-url">Add a publisher RSS/Atom feed</label><div class="actions" style="margin-top:6px"><input id="feed-url" type="url" placeholder="https://example.com/feed.xml" style="flex:1"><button class="btn btn--outline">Add feed</button></div></form><div id="custom-feeds"></div><p class="notice">Automatic checks run every two hours while this app is open, and resume when it is reopened. The last headlines remain available offline. A complete “all sources” feed does not exist. Add any RSS or Atom feed you are entitled to use; it stays in this browser.</p></aside></div><section class="panel" style="margin-top:18px"><p class="eyebrow">MORE NEWSROOMS</p><h2>Open a publisher directly</h2><p class="muted-copy">These links open each newsroom’s latest banking coverage. The app does not republish publisher RSS content.</p><div id="newsroom-links"></div></section>`,
})

const $ = (id) => document.getElementById(id)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '' } catch { return '' } }

function renderSources() {
  const sourceNames = [...new Set(articles.map(article => article.source).filter(Boolean))].sort()
  if (sourceFilter !== 'all' && !sourceNames.includes(sourceFilter)) sourceFilter = 'all'
  $('source-filter').innerHTML = '<option value="all">All sources</option>' + sourceNames.map(name => `<option value="${escapeHtml(name)}"${name === sourceFilter ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')
  $('source-list').innerHTML = sources.map(source => `<div class="source-row"><span><b>${escapeHtml(source.name)}</b><small>${escapeHtml(source.category || 'Custom feed')}</small></span>${source.category === 'Custom feed' ? `<button class="btn btn--quiet" data-remove-feed="${escapeHtml(source.id)}" aria-label="Remove ${escapeHtml(source.name)}">Remove</button>` : '<span class="pill">RSS</span>'}</div>`).join('')
  $('source-list').querySelectorAll('[data-remove-feed]').forEach(button => button.addEventListener('click', () => {
    sources = sources.filter(source => source.id !== button.dataset.removeFeed)
    writeCache('censoris-bank-sources', JSON.stringify(sources.filter(source => source.category === 'Custom feed')))
    renderSources()
  }))
}

function renderHeadlines() {
  const query = filterText.toLowerCase()
  const visible = articles.filter(article => (!savedOnly || savedIds.has(article.id)) && (sourceFilter === 'all' || article.source === sourceFilter) && (!query || `${article.title} ${article.source}`.toLowerCase().includes(query)))
  $('headlines').innerHTML = visible.length ? visible.map(article => {
    const link = safeUrl(article.link)
    return `<article class="news-item"><a href="${escapeHtml(link || '#')}" target="_blank" rel="noreferrer noopener">${escapeHtml(article.title)}</a><div class="news-meta"><span>${escapeHtml(article.source)}</span><time>${escapeHtml(article.date || 'Recently published')}</time><button class="btn btn--quiet" data-save="${escapeHtml(article.id)}" aria-label="${savedIds.has(article.id) ? 'Remove from saved' : 'Save headline'}">${savedIds.has(article.id) ? '★' : '☆'}</button></div></article>`
  }).join('') : `<div class="empty">${savedOnly ? 'No saved headlines yet. Tap ☆ on a headline to keep it.' : query || sourceFilter !== 'all' ? 'No headlines match these filters.' : 'No cached headlines yet. Connect to the internet and refresh the official feeds.'}</div>`
  $('headlines').querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.save
    if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id)
    writeCache('censoris-bank-saved', JSON.stringify([...savedIds]))
    renderHeadlines()
  }))
}

function parseFeed(xml, source) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('The source did not return valid RSS or Atom.')
  return [...doc.querySelectorAll('item, entry')].map(item => {
    const title = item.querySelector('title')?.textContent?.trim() || ''
    const linkNode = item.querySelector('link')
    const link = linkNode?.getAttribute('href') || linkNode?.textContent?.trim() || ''
    const date = item.querySelector('pubDate, published, updated, dc\\:date')?.textContent?.trim() || ''
    const timestamp = Date.parse(date)
    return { id: safeUrl(link) || `${source.id}:${title}`, title, link, date: Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : date, timestamp: Number.isFinite(timestamp) ? timestamp : 0, source: source.name }
  }).filter(item => item.title && safeUrl(item.link))
}

async function getFeed(url) {
  if (window.newsBridge?.fetchFeed) return await window.newsBridge.fetchFeed(url)
  // CapacitorHttp patches fetch in the Android web view via capacitor.config.ts.
  const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return await response.text()
}

// Cache writes are best effort: a full or blocked storage area must not leave the
// brief stuck on "Checking sources…" with refresh permanently disabled.
function writeCache(key, value) { try { localStorage.setItem(key, value); return true } catch { return false } }

async function refresh() {
  if (isRefreshing) return
  isRefreshing = true
  try {
    $('refresh-state').textContent = `Checking ${sources.length} source${sources.length === 1 ? '' : 's'}…`
    const results = await Promise.allSettled(sources.map(async source => parseFeed(await getFeed(source.url), source)))
    const updated = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value)
    const errors = results.filter(result => result.status === 'rejected').length
    if (updated.length) {
      const byId = new Map([...updated, ...articles].map(item => [item.id, item]))
      articles = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 180)
      writeCache('censoris-bank-headlines', JSON.stringify(articles))
      renderHeadlines()
    }
    if (!updated.length && errors === sources.length) throw new Error('No source could be reached')
    lastRefresh = Date.now()
    writeCache('censoris-bank-last-refresh', String(lastRefresh))
    $('refresh-state').textContent = errors ? `${updated.length} new or recent headlines · ${errors} source${errors === 1 ? '' : 's'} unavailable · checked ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : `${updated.length} headlines available · refreshed ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    $('refresh-state').textContent = 'Could not refresh any feed. Check your connection and try again. Browser builds can be blocked by publisher cross-origin policies; the desktop and mobile builds fetch the feeds directly.'
  } finally {
    isRefreshing = false
  }
}

$('feed-form').addEventListener('submit', event => {
  event.preventDefault()
  const value = $('feed-url').value.trim()
  let url
  try { url = new URL(value) } catch { $('refresh-state').textContent = 'Enter a full https:// feed URL.'; return }
  if (url.protocol !== 'https:') { $('refresh-state').textContent = 'Only https:// feeds can be added.'; return }
  if (sources.some(source => source.url === url.href)) { $('refresh-state').textContent = 'That feed is already in the list.'; return }
  sources = [...sources, { id: `custom-${Date.now()}`, name: url.hostname, url: url.href, category: 'Custom feed' }]
  writeCache('censoris-bank-sources', JSON.stringify(sources.filter(source => source.category === 'Custom feed')))
  $('feed-url').value = ''
  renderSources()
  void refresh()
})
$('filter').addEventListener('input', event => { filterText = event.currentTarget.value.trim(); renderHeadlines() })
$('source-filter').addEventListener('change', event => { sourceFilter = event.currentTarget.value; renderHeadlines() })
$('show-saved').addEventListener('click', event => { savedOnly = !savedOnly; event.currentTarget.textContent = savedOnly ? 'Show all' : 'Saved only'; renderHeadlines() })
renderSources(); renderHeadlines()
$('newsroom-links').innerHTML = newsroomLinks.map(([label, url]) => `<div class="source-row"><span>${escapeHtml(label)}</span><a class="btn btn--quiet" href="${url}" target="_blank" rel="noreferrer noopener">Open ↗</a></div>`).join('')
$('refresh').addEventListener('click', () => { void refresh() })
const cacheIsFresh = Boolean(lastRefresh) && Date.now() - lastRefresh < twoHours
if (cacheIsFresh) {
  $('refresh-state').textContent = articles.length
    ? `${articles.length} cached headlines · last checked ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    : 'No cached headlines yet. Refresh to check the sources.'
}
if (!cacheIsFresh) void refresh()
window.setInterval(() => { if (Date.now() - lastRefresh >= twoHours) void refresh() }, 60_000)
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRefresh >= twoHours) void refresh() })
