import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

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
let sources = readJson('censoris-bank-sources', defaultSources)
let articles = readJson('censoris-bank-headlines', [])
let lastRefresh = Number(localStorage.getItem('censoris-bank-last-refresh') || 0)
let isRefreshing = false

mountApp({
  appId: 'indian-banking-brief',
  eyebrow: 'INDIA · BANKING BRIEF',
  title: 'The banking signal, gathered.',
  description: 'Official Reserve Bank of India and SEBI updates, gathered locally and refreshed every two hours while the app is open. Headlines link to their original sources.',
  content: `<div class="content-grid"><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><p class="eyebrow">LATEST UPDATES</p><h2>Source-linked headlines</h2></div><button class="btn btn--outline" id="refresh">↻ Refresh now</button></div><p class="muted-copy" id="refresh-state" aria-live="polite">Loading local feed cache…</p><div class="news-list" id="headlines"></div></section><aside class="result-card"><p class="eyebrow">CONNECTED SOURCES</p><h2>Primary feeds</h2><div id="source-list"></div><div class="feature-lock"><span><b>Add publisher feeds & topic alerts</b><small>Custom RSS sources · private watch filters</small></span><button class="btn btn--outline" id="pro-sources">Pro</button></div><p class="notice">Automatic checks run every two hours while this app is open, and resume when it is reopened. The last headlines remain available offline. A complete “all sources” feed does not exist, so you can add feeds you are entitled to use with Pro.</p></aside></div><section class="panel" style="margin-top:18px"><p class="eyebrow">MORE NEWSROOMS</p><h2>Open a publisher directly</h2><p class="muted-copy">These links open each newsroom’s latest banking coverage. The app does not republish publisher RSS content.</p><div id="newsroom-links"></div></section>`,
})

const $ = (id) => document.getElementById(id)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '' } catch { return '' } }

function renderSources() {
  $('source-list').innerHTML = sources.map(source => `<div class="source-row"><span><b>${escapeHtml(source.name)}</b><small>${escapeHtml(source.category || 'Custom feed')}</small></span><span class="pill">RSS</span></div>`).join('')
}

function renderHeadlines() {
  $('headlines').innerHTML = articles.length ? articles.map(article => {
    const link = safeUrl(article.link)
    return `<article class="news-item"><a href="${escapeHtml(link || '#')}" target="_blank" rel="noreferrer noopener">${escapeHtml(article.title)}</a><div class="news-meta"><span>${escapeHtml(article.source)}</span><time>${escapeHtml(article.date || 'Recently published')}</time></div></article>`
  }).join('') : '<div class="empty">No cached headlines yet. Connect to the internet and refresh the official feeds.</div>'
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

async function refresh() {
  if (isRefreshing) return
  isRefreshing = true
  $('refresh-state').textContent = `Checking ${sources.length} source${sources.length === 1 ? '' : 's'}…`
  const results = await Promise.allSettled(sources.map(async source => parseFeed(await getFeed(source.url), source)))
  const updated = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value)
  const errors = results.filter(result => result.status === 'rejected').length
  if (updated.length) {
    const byId = new Map([...updated, ...articles].map(item => [item.id, item]))
    articles = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 180)
    localStorage.setItem('censoris-bank-headlines', JSON.stringify(articles))
    renderHeadlines()
  }
  lastRefresh = Date.now()
  localStorage.setItem('censoris-bank-last-refresh', String(lastRefresh))
  $('refresh-state').textContent = errors ? `${updated.length} new or recent headlines · ${errors} source${errors === 1 ? '' : 's'} unavailable · checked ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : `${updated.length} headlines available · refreshed ${new Date(lastRefresh).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  isRefreshing = false
}

renderSources(); renderHeadlines()
$('newsroom-links').innerHTML = newsroomLinks.map(([label, url]) => `<div class="source-row"><span>${escapeHtml(label)}</span><a class="btn btn--quiet" href="${url}" target="_blank" rel="noreferrer noopener">Open ↗</a></div>`).join('')
$('refresh').addEventListener('click', () => { void refresh() })
$('pro-sources').addEventListener('click', () => showPaywall('publisher feeds and topic alerts'))
if (!lastRefresh || Date.now() - lastRefresh >= twoHours) void refresh()
window.setInterval(() => { if (Date.now() - lastRefresh >= twoHours) void refresh() }, 60_000)
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRefresh >= twoHours) void refresh() })
