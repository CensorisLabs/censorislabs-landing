import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'social-feed', eyebrow: 'SOCIAL · FEDIVERSE CLIENT', title: 'Your social web, your pace.',
  description: 'A lightweight client for public Mastodon-compatible timelines. Browse without an account, or connect an instance with a session-only access token to post.',
  content: `<div class="content-grid"><section class="panel"><p class="eyebrow">CONNECT TO AN INSTANCE</p><h2>Choose your social home</h2><div class="field-grid"><div class="field"><label for="instance">Server address</label><input id="instance" value="mastodon.social" autocomplete="url" placeholder="mastodon.social"></div><div class="field"><label for="token">Access token · optional</label><input id="token" type="password" autocomplete="off" placeholder="Used only in this open session"></div></div><div class="actions"><button class="btn" id="refresh">Load public timeline</button><button class="btn btn--outline" id="search-feed">Search posts</button><button class="btn btn--quiet" id="pro">Saved filters · Pro</button></div><div class="field" style="margin-top:14px"><label for="query">Search text</label><input id="query" placeholder="Topics, tags, or phrases"></div><p class="source-credit">Public post search depends on the chosen server’s search setup. The client does not scrape X or bypass sign-in controls. Never paste a token on a shared device.</p></section><aside class="panel"><p class="eyebrow">WRITE A POST</p><h2>Keep it yours.</h2><textarea id="composer" rows="5" maxlength="500" placeholder="Write a short post…" style="width:100%;background:#17191e;border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:12px"></textarea><div class="actions"><button class="btn" id="publish">Publish to instance</button><span class="status" id="status" aria-live="polite">Public preview is ready.</span></div></aside></div><section class="panel" style="margin-top:18px"><div class="section-heading"><div><p class="eyebrow">PUBLIC TIMELINE</p><h2>Across your instance</h2></div><span class="pill" id="feed-source">mastodon.social</span></div><div id="results" class="news-list" aria-live="polite"><div class="empty">Load a public timeline to see posts from the selected instance.</div></div></section>`
})

const $ = (id) => document.getElementById(id)
const safeText = (html) => { const node = new DOMParser().parseFromString(html || '', 'text/html'); return node.body.textContent?.trim() || '' }
const escape = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function instanceBase() {
  let value = $('instance').value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(value)) throw new Error('Enter a valid server host name.')
  return `https://${value}`
}
function headers() { const token = $('token').value.trim(); return token ? { Authorization: `Bearer ${token}` } : {} }
function render(statuses) {
  $('results').innerHTML = statuses.length ? statuses.map((item) => {
    const body = escape(safeText(item.content)).slice(0, 1200)
    const author = escape(item.account?.display_name || item.account?.acct || 'Community member')
    const url = /^https:\/\//.test(item.url || '') ? item.url : '#'
    const date = item.created_at ? new Date(item.created_at).toLocaleString() : ''
    return `<article class="news-item social-card"><div class="social-account"><b>${author}</b><span>${escape(date)}</span></div><div class="social-content">${body || '<i>Post contains media or no text.</i>'}</div><div class="actions"><button class="btn btn--quiet" data-status="${escape(item.id)}" data-action="favourite">♡ Like</button><button class="btn btn--quiet" data-status="${escape(item.id)}" data-action="reblog">↗ Boost</button><a class="btn btn--quiet" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Open on server ↗</a></div></article>`
  }).join('') : '<div class="empty">No public posts found for this request.</div>'
}
async function loadTimeline() {
  $('status').textContent = 'Loading public posts…'
  try {
    const base = instanceBase(); $('feed-source').textContent = new URL(base).host
    let url
    const query = $('query').value.trim()
    if (query) url = `${base}/api/v2/search?${new URLSearchParams({ q: query, type: 'statuses', limit: '20' })}`
    else url = `${base}/api/v1/timelines/public?limit=20`
    const response = await fetch(url, { headers: headers() })
    if (!response.ok) throw new Error(`Server returned ${response.status}. Search may require sign-in or be disabled.`)
    const data = await response.json(); render(Array.isArray(data) ? data : data.statuses || [])
    $('results').querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
      const token = $('token').value.trim(); if (!token) { $('status').textContent = 'Add a session-only token to like or boost.'; return }
      const action = button.dataset.action
      button.disabled = true
      try {
        const response = await fetch(`${base}/api/v1/statuses/${encodeURIComponent(button.dataset.status)}/${action}`, { method: 'POST', headers: headers() })
        if (!response.ok) throw new Error(`Server returned ${response.status}; confirm token permissions.`)
        button.textContent = action === 'favourite' ? '♥ Liked' : '✓ Boosted'; $('status').textContent = `${action === 'favourite' ? 'Liked' : 'Boosted'} on your instance.`
      } catch (error) { button.disabled = false; $('status').textContent = error.message || 'Could not send this action.' }
    }))
    $('status').textContent = `Updated ${new Date().toLocaleTimeString()}`
  } catch (error) { $('results').innerHTML = `<div class="empty error">${escape(error.message || 'Could not load this server. Check connection and CORS support.')}</div>`; $('status').textContent = 'Could not load posts.' }
}
$('refresh').addEventListener('click', loadTimeline)
$('search-feed').addEventListener('click', loadTimeline)
$('instance').addEventListener('change', () => { $('feed-source').textContent = $('instance').value.trim() || 'server' })
$('publish').addEventListener('click', async () => {
  try {
    const token = $('token').value.trim(); if (!token) throw new Error('Add a session-only access token with write:statuses permission to publish.')
    const status = $('composer').value.trim(); if (!status) throw new Error('Write a post first.')
    const response = await fetch(`${instanceBase()}/api/v1/statuses`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status, visibility: 'public' }) })
    if (!response.ok) throw new Error(`Post was not published (${response.status}). Check token permissions.`)
    $('composer').value = ''; $('status').textContent = 'Post published.'; await loadTimeline()
  } catch (error) { $('status').textContent = error.message || 'Could not publish.' }
})
$('pro').addEventListener('click', () => showPaywall('saved filters'))
window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
