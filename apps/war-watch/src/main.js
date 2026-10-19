import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'war-watch', eyebrow: 'WORLD NEWS · CONFLICT MONITOR', title: 'The world, with sources attached.',
  description: 'A global conflict-news brief from monitored online reporting. Headlines update every two minutes while this app is open, with links to the original publishers.',
  content: `<section class="panel"><div class="section-heading"><div><p class="eyebrow">LIVE MONITOR</p><h2>Conflict and security headlines</h2></div><span class="live-badge">AUTO-REFRESH · 2 MIN</span></div><div class="actions"><button class="btn" id="refresh">Refresh now</button><select id="topic" class="feed-input" style="max-width:260px"><option value="conflicts">Armed conflicts and ceasefires</option><option value="humanitarian">Conflict and humanitarian response</option><option value="regional">Wars, attacks and military operations</option></select><button class="btn btn--quiet" id="pro">Follow regions · Pro</button></div><p class="status" id="status" aria-live="polite">Waiting for the first refresh.</p><div id="results" class="news-list" aria-live="polite"><div class="empty">Connecting to global news indexes…</div></div><p class="source-credit">Search index: GDELT DOC 2.0. GDELT monitors online sources worldwide, but no news index includes every outlet or guarantees immediate publication. Headlines and reporting belong to their publishers; check multiple sources for developing events.</p></section>`
})

const $ = (id) => document.getElementById(id)
const escape = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const queries = {
  conflicts: '(war OR conflict OR ceasefire OR airstrike OR invasion OR "armed forces" OR "military attack")',
  humanitarian: '(conflict OR war) AND (humanitarian OR displacement OR aid OR civilian OR refugee)',
  regional: '(airstrike OR "drone strike" OR artillery OR missile OR invasion OR hostilities OR battlefield)',
}
let timer = null, controller = null, lastKeys = new Set(), isLoading = false
function seenDate(value) {
  if (!/^\d{14}$/.test(value || '')) return value || 'Date not provided'
  return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:${value.slice(10,12)}:${value.slice(12,14)}Z`).toLocaleString()
}
function render(articles, replace = true) {
  const visible = articles.filter(item => item.url && /^https?:\/\//i.test(item.url))
  const markup = visible.map(item => {
    const title = escape(item.title || 'Open publisher report')
    const domain = escape(item.domain || (() => { try { return new URL(item.url).hostname } catch { return 'Original source' } })())
    const region = escape(item.sourcecountry || 'Worldwide source')
    const date = escape(seenDate(item.seendate))
    const key = item.url
    const fresh = !lastKeys.has(key)
    lastKeys.add(key)
    return `<article class="news-item war-story"><div class="section-heading"><span class="eyebrow">${region}</span>${fresh ? '<span class="pill">NEW</span>' : ''}</div><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${title} ↗</a><div class="news-meta"><span>${domain}</span><span>${date}</span></div></article>`
  }).join('')
  $('results').innerHTML = markup || '<div class="empty">No stories matched this filter in the current index window.</div>'
}
async function refresh() {
  if (isLoading || document.hidden) return
  isLoading = true; controller?.abort(); controller = new AbortController()
  $('status').textContent = 'Checking the global news index…'
  try {
    const params = new URLSearchParams({ query: queries[$('topic').value], mode: 'artlist', format: 'json', maxrecords: '50', timespan: '24h', sort: 'datedesc' })
    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`News index returned ${response.status}.`)
    const payload = await response.json(); const articles = payload.articles || []
    render(articles); $('status').textContent = `${articles.length} stories · last checked ${new Date().toLocaleTimeString()}`
  } catch (error) {
    if (error.name !== 'AbortError') { $('status').textContent = 'Refresh failed · check your connection.'; $('results').innerHTML = `<div class="empty error">${escape(error.message || 'Could not reach the news index. The previous headlines may have been replaced.')}</div>` }
  } finally { isLoading = false }
}
function schedule() { if (timer) clearInterval(timer); timer = setInterval(() => { if (!document.hidden) void refresh() }, 120_000) }
$('refresh').addEventListener('click', refresh)
$('topic').addEventListener('change', () => { lastKeys = new Set(); void refresh() })
$('pro').addEventListener('click', () => showPaywall('region alerts and saved monitors'))
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh() })
window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
schedule(); void refresh()
