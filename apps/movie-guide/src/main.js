import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'movie-guide', eyebrow: 'FILM & SERIES DISCOVERY', title: 'Find where the story is streaming.',
  description: 'Search titles and check reported streaming, rental, or purchase options by country. Availability changes by region and over time.',
  content: `<section class="panel"><p class="eyebrow">SEARCH TITLES</p><h2>What do you want to watch?</h2><form class="search-row" id="search-form"><input id="query" required placeholder="Movie or show title" aria-label="Search title"><select id="region" aria-label="Country"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="DE">Germany</option></select><button class="btn">Search</button></form><details style="margin-top:16px"><summary class="field-label">Set a TMDB API key for provider availability</summary><div class="field" style="margin-top:10px"><label for="api-key">TMDB API key · kept in memory only</label><input id="api-key" type="password" autocomplete="off" placeholder="Paste your API key"></div><p class="source-credit">Provider API support is disabled until CensorisLabs has the commercial TMDB license configured. Until then, open a direct JustWatch search. A client-side key is visible to users and must not be treated as a secret.</p></details><div class="actions"><button class="btn btn--quiet" id="pro">Watchlist and alerts · Pro</button><span class="status" id="status" aria-live="polite">Provider data is country-specific.</span></div></section><section class="panel" style="margin-top:18px"><div class="section-heading"><div><p class="eyebrow">SEARCH RESULTS</p><h2>Choose a title</h2></div><span class="pill" id="region-label">India</span></div><div id="results" class="result-grid" aria-live="polite"><div class="empty" style="grid-column:1/-1">Search for a movie or series to see options.</div></div></section><section class="panel" style="margin-top:18px" id="availability" hidden><p class="eyebrow">AVAILABILITY</p><h2 id="selected-title"></h2><div id="providers"></div><p class="source-credit">Streaming availability data powered by TMDB and JustWatch. The listed services may be incomplete and links can lead to a regional search page instead of the exact title.</p></section><details class="panel" style="margin-top:18px"><summary class="field-label">Data sources and credits</summary><div class="source-credit" style="margin-top:14px"><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" width="48" height="48" loading="lazy"></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p>Streaming availability data is provided via TMDB's JustWatch partnership. This commercial app needs an approved commercial TMDB license before provider API mode can be enabled.</p><a href="https://www.themoviedb.org/about/logos-attribution" target="_blank" rel="noopener noreferrer">TMDB logos and attribution ↗</a></div></details>`
})

const $ = (id) => document.getElementById(id)
let apiKey = import.meta.env.VITE_TMDB_API_KEY || ''
const commercialLicenseCleared = import.meta.env.VITE_TMDB_COMMERCIAL_LICENSE === 'true'
const escape = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const titleOf = item => item.title || item.name || 'Untitled'
function keyNow() { return $('api-key').value.trim() || apiKey }
function justwatchLink(title, region) { return `https://www.justwatch.com/${region.toLowerCase()}/search?q=${encodeURIComponent(title)}` }
function renderItems(items) {
  $('results').innerHTML = items.length ? items.map((item) => {
    const type = item.media_type || (item.title ? 'movie' : 'tv')
    const image = item.poster_path ? `https://image.tmdb.org/t/p/w185${encodeURIComponent(item.poster_path).replace('%2F','/')}` : ''
    return `<article class="result-item"><div style="display:flex;gap:12px">${image ? `<img src="${image}" alt="" loading="lazy" style="width:68px;height:100px;object-fit:cover;border-radius:6px">` : ''}<div><span class="eyebrow">${escape(type)} · ${escape((item.release_date || item.first_air_date || '').slice(0,4))}</span><h3>${escape(titleOf(item))}</h3><p>${escape(item.overview || 'No synopsis available.')}</p></div></div><div class="actions"><button class="btn btn--outline" data-id="${escape(item.id)}" data-type="${escape(type)}" data-title="${escape(titleOf(item))}">Check where to watch</button><a class="btn btn--quiet" href="${justwatchLink(titleOf(item), $('region').value)}" target="_blank" rel="noopener noreferrer">Search JustWatch ↗</a></div></article>`
  }).join('') : '<div class="empty" style="grid-column:1/-1">No movie or series titles found.</div>'
  $('results').querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => { void loadProviders(button.dataset.id, button.dataset.type, button.dataset.title) }))
}
async function search() {
  const query = $('query').value.trim(); const key = keyNow()
  $('status').textContent = 'Searching titles…'
  if (!commercialLicenseCleared) { $('results').innerHTML = `<div class="empty" style="grid-column:1/-1">TMDB provider search will turn on after commercial API licensing is configured. <p><a href="${justwatchLink(query, $('region').value)}" target="_blank" rel="noopener noreferrer">Search JustWatch for “${escape(query)}” ↗</a></p></div>`; $('status').textContent = 'Provider API mode is not enabled.'; return }
  if (!key) { $('results').innerHTML = `<div class="empty" style="grid-column:1/-1">Add a TMDB API key to browse results, or open a JustWatch search for “${escape(query)}”. <p><a href="${justwatchLink(query, $('region').value)}" target="_blank" rel="noopener noreferrer">Search JustWatch ↗</a></p></div>`; $('status').textContent = 'No TMDB key set.'; return }
  try {
    const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', api_key: key })
    const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`)
    if (!response.ok) throw new Error(`TMDB search returned ${response.status}.`)
    const data = await response.json(); const items = (data.results || []).filter(item => ['movie','tv'].includes(item.media_type)); renderItems(items); $('status').textContent = `${items.length} titles found.`
  } catch (error) { $('results').innerHTML = `<div class="empty error" style="grid-column:1/-1">${escape(error.message || 'Could not search TMDB. Check the key and connection.')}</div>`; $('status').textContent = 'Search unavailable.' }
}
async function loadProviders(id, type, title) {
  const key = keyNow(); const region = $('region').value; $('availability').hidden = false; $('selected-title').textContent = title; $('providers').innerHTML = '<div class="empty">Loading current availability…</div>'
  try {
    const response = await fetch(`https://api.themoviedb.org/3/${type}/${encodeURIComponent(id)}/watch/providers?${new URLSearchParams({ api_key: key })}`)
    if (!response.ok) throw new Error(`Provider lookup returned ${response.status}.`)
    const data = await response.json(); const country = data.results?.[region]
    if (!country) { $('providers').innerHTML = `<div class="empty">No provider list is currently available for ${escape(region)}. <p><a href="${justwatchLink(title, region)}" target="_blank" rel="noopener noreferrer">Search on JustWatch ↗</a></p></div>`; return }
    const groups = [['Stream', country.flatrate], ['Free / with ads', country.free], ['Rent', country.rent], ['Buy', country.buy]].filter(([, list]) => list?.length)
    $('providers').innerHTML = `${groups.map(([label, list]) => `<div class="source-row"><span><b>${label}</b></span><div class="provider-list">${list.map(provider => `<a class="provider-pill" href="${escape(country.link || justwatchLink(title, region))}" target="_blank" rel="noopener noreferrer">${provider.logo_path ? `<img src="https://image.tmdb.org/t/p/w92${provider.logo_path}" alt="">` : ''}<span>${escape(provider.provider_name)}</span></a>`).join('')}</div></div>`).join('')}<p><a href="${escape(country.link || justwatchLink(title, region))}" target="_blank" rel="noopener noreferrer">See source availability ↗</a></p>`
  } catch (error) { $('providers').innerHTML = `<div class="empty error">${escape(error.message || 'Could not load provider data.') } <p><a href="${justwatchLink(title, region)}" target="_blank" rel="noopener noreferrer">Search JustWatch ↗</a></p></div>` }
}
$('api-key').value = apiKey
$('api-key').addEventListener('input', () => { apiKey = $('api-key').value.trim() })
$('region').addEventListener('change', () => { $('region-label').textContent = $('region').selectedOptions[0].textContent })
$('search-form').addEventListener('submit', event => { event.preventDefault(); void search() })
$('pro').addEventListener('click', () => showPaywall('watchlists and alerts'))
window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
