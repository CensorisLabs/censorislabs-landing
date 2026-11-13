import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { APP_VERSION } from './version.js'

// A small, hand-checked starting catalogue. No API key, account or licence is
// required: search happens on this device and every title links to JustWatch,
// which owns the current regional availability data.
const CATALOG = [
  { title: 'Dangal', year: 2016, type: 'movie', genres: ['Drama', 'Sport'], note: 'A former wrestler trains his daughters for the international stage.' },
  { title: 'Gully Boy', year: 2019, type: 'movie', genres: ['Drama', 'Music'], note: 'A Mumbai street rapper finds his voice in the underground scene.' },
  { title: 'Andhadhun', year: 2018, type: 'movie', genres: ['Thriller', 'Comedy'], note: 'A blind pianist becomes entangled in a murder he was not meant to witness.' },
  { title: 'Tumbbad', year: 2018, type: 'movie', genres: ['Horror', 'Fantasy'], note: 'A family guards a cursed treasure across generations.' },
  { title: '3 Idiots', year: 2009, type: 'movie', genres: ['Comedy', 'Drama'], note: 'Three engineering students push back against a rigid education system.' },
  { title: 'Lagaan', year: 2001, type: 'movie', genres: ['Drama', 'Sport'], note: 'Villagers wager their land tax on a cricket match against colonial officers.' },
  { title: 'RRR', year: 2022, type: 'movie', genres: ['Action', 'Drama'], note: 'Two revolutionaries collide in a maximalist period action epic.' },
  { title: 'Kumbalangi Nights', year: 2019, type: 'movie', genres: ['Drama', 'Family'], note: 'Four brothers rebuild a home and themselves in a Kerala fishing village.' },
  { title: 'Super Deluxe', year: 2019, type: 'movie', genres: ['Drama', 'Thriller'], note: 'Interlocking stories test a group of strangers over one difficult day.' },
  { title: 'Vikram Vedha', year: 2017, type: 'movie', genres: ['Action', 'Thriller'], note: 'A cop and a criminal trade stories that blur the line between them.' },
  { title: 'The Lunchbox', year: 2013, type: 'movie', genres: ['Romance', 'Drama'], note: 'A misdelivered lunchbox starts an unlikely correspondence in Mumbai.' },
  { title: 'Queen', year: 2014, type: 'movie', genres: ['Comedy', 'Drama'], note: 'A cancelled wedding becomes the start of a solo European trip.' },
  { title: 'Parasite', year: 2019, type: 'movie', genres: ['Thriller', 'Drama'], note: 'A struggling family slowly moves into the lives of a wealthy household.' },
  { title: 'Everything Everywhere All at Once', year: 2022, type: 'movie', genres: ['Sci-Fi', 'Comedy'], note: 'A laundromat owner discovers the multiverse and her own family.' },
  { title: 'Arrival', year: 2016, type: 'movie', genres: ['Sci-Fi', 'Drama'], note: 'A linguist tries to communicate with visitors whose language bends time.' },
  { title: 'Mad Max: Fury Road', year: 2015, type: 'movie', genres: ['Action', 'Adventure'], note: 'A chase across a desert wasteland becomes a fight for freedom.' },
  { title: 'Spirited Away', year: 2001, type: 'movie', genres: ['Animation', 'Fantasy'], note: 'A child works in a spirit bathhouse to bring her parents back.' },
  { title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', genres: ['Comedy', 'Drama'], note: 'A concierge and lobby boy chase a disputed inheritance across Europe.' },
  { title: 'Whiplash', year: 2014, type: 'movie', genres: ['Drama', 'Music'], note: 'A drummer and a ruthless teacher push each other toward perfection.' },
  { title: 'Knives Out', year: 2019, type: 'movie', genres: ['Mystery', 'Comedy'], note: 'A detective unpicks a wealthy family after the patriarch dies.' },
  { title: 'The Social Network', year: 2010, type: 'movie', genres: ['Drama', 'History'], note: 'The founding of a social network, told through competing claims.' },
  { title: 'Chernobyl', year: 2019, type: 'series', genres: ['Drama', 'History'], note: 'The reactor disaster and the cost of official denial.' },
  { title: 'The Last of Us', year: 2023, type: 'series', genres: ['Drama', 'Adventure'], note: 'A smuggler escorts a teenager across a broken country.' },
  { title: 'Severance', year: 2022, type: 'series', genres: ['Sci-Fi', 'Thriller'], note: 'Office workers separate their work memories from their home lives.' },
  { title: 'Dark', year: 2017, type: 'series', genres: ['Sci-Fi', 'Mystery'], note: 'A missing child exposes tangled timelines in a small German town.' },
  { title: 'Fleabag', year: 2016, type: 'series', genres: ['Comedy', 'Drama'], note: 'A sharp, grieving woman narrates her own messy life.' },
  { title: 'The Wire', year: 2002, type: 'series', genres: ['Crime', 'Drama'], note: 'Baltimore institutions, seen through the people inside them.' },
  { title: 'Panchayat', year: 2020, type: 'series', genres: ['Comedy', 'Drama'], note: 'A reluctant village clerk learns the rhythms of rural office life.' },
  { title: 'Sacred Games', year: 2018, type: 'series', genres: ['Crime', 'Thriller'], note: 'A Mumbai cop follows a gangster’s countdown across the city.' },
  { title: 'The Family Man', year: 2019, type: 'series', genres: ['Action', 'Drama'], note: 'A middle-class intelligence officer balances a desk job and a family.' },
  { title: 'Delhi Crime', year: 2019, type: 'series', genres: ['Crime', 'Drama'], note: 'Investigators work a case that became a national reckoning.' },
  { title: 'Better Call Saul', year: 2015, type: 'series', genres: ['Crime', 'Drama'], note: 'A small-time lawyer talks himself toward a larger, worse life.' },
]
const STORE = 'censoris-watchlist'
const WATCHED = 'censoris-watched'
const readList = () => { try { const value = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.title === 'string' && Number.isFinite(Number(item.year)) && (item.type === 'movie' || item.type === 'series')).slice(0, 200) : [] } catch { return [] } }
let watchlist = readList()
let watched = (() => { try { const value = JSON.parse(localStorage.getItem(WATCHED) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.title === 'string' && Number.isFinite(Number(item.year))).slice(0, 300) : [] } catch { return [] } })()
let filterType = 'all'
let filterGenre = 'all'
let filterStatus = 'all'

mountApp({
  appId: 'movie-guide',
  eyebrow: 'FILM & SERIES DISCOVERY',
  title: 'Find where the story is streaming.',
  version: APP_VERSION,
  description: 'Search a curated catalogue on this device, keep a watchlist, and open a country-specific JustWatch search for current streaming, rent or buy options. No account or API key needed.',
  content: `<section class="panel"><p class="eyebrow">SEARCH TITLES</p><h2>What do you want to watch?</h2><form class="search-row" id="search-form"><input id="query" type="search" placeholder="Movie, show, genre or mood" aria-label="Search the catalogue"><select id="type" aria-label="Type"><option value="all">Films and series</option><option value="movie">Films</option><option value="series">Series</option></select><select id="genre" aria-label="Genre"><option value="all">Any genre</option></select><select id="status-filter" aria-label="Watch status"><option value="all">Any status</option><option value="watchlist">On watchlist</option><option value="watched">Watched</option><option value="unwatched">Not watched</option></select><button class="btn">Search</button></form><div class="actions"><button class="btn btn--quiet" id="surprise">Surprise me</button><select id="region" aria-label="Country for availability links"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="DE">Germany</option></select><span class="status" id="status" aria-live="polite">Search runs on this device.</span></div><p class="source-credit">Availability is not stored here. Every “Where to watch” link opens JustWatch for the selected country, where the current provider list lives.</p></section><section class="panel" style="margin-top:18px"><div class="section-heading"><div><p class="eyebrow">CATALOGUE</p><h2 id="heading">All titles</h2></div><span class="pill" id="count">0 titles</span></div><div id="results" class="result-grid" aria-live="polite"></div></section><section class="panel" style="margin-top:18px" id="watchlist-panel" hidden><div class="section-heading"><div><p class="eyebrow">YOUR LIST</p><h2>Watchlist</h2></div><button class="btn btn--quiet" id="clear-list">Clear list</button></div><div id="watchlist" class="news-list"></div></section>`
})

const $ = id => document.getElementById(id)
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const keyOf = item => `${item.title}:${item.year}`
const justwatch = (title, region) => `https://www.justwatch.com/${region.toLowerCase()}/search?q=${encodeURIComponent(title)}`

function genreOptions() {
  const genres = [...new Set(CATALOG.flatMap(item => item.genres))].sort()
  $('genre').innerHTML = '<option value="all">Any genre</option>' + genres.map(genre => `<option>${escape(genre)}</option>`).join('')
}

function saveWatchlist() {
  try { localStorage.setItem(STORE, JSON.stringify(watchlist)) } catch { /* storage can be full */ }
  renderWatchlist()
}

function renderWatchlist() {
  $('watchlist-panel').hidden = watchlist.length === 0
  $('watchlist').innerHTML = watchlist.map(item => `<article class="news-item"><a href="${justwatch(item.title, $('region').value)}" target="_blank" rel="noopener noreferrer">${escape(item.title)} (${item.year}) ↗</a><div class="news-meta"><span>${escape(item.type)}</span><button class="btn btn--quiet" data-remove="${escape(keyOf(item))}">Remove</button></div></article>`).join('')
  $('watchlist').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    watchlist = watchlist.filter(item => keyOf(item) !== button.dataset.remove)
    saveWatchlist()
    renderResults()
  }))
}

function saveWatched() { try { localStorage.setItem(WATCHED, JSON.stringify(watched.slice(0, 300))) } catch {} }
function card(item, region) {
  const saved = watchlist.some(entry => keyOf(entry) === keyOf(item))
  const seen = watched.some(entry => keyOf(entry) === keyOf(item))
  return `<article class="result-item"><span class="eyebrow">${escape(item.type)} · ${item.year} · ${escape(item.genres.join(' / '))}</span><h3>${escape(item.title)}</h3><p>${escape(item.note)}</p><div class="actions"><a class="btn btn--outline" href="${justwatch(item.title, region)}" target="_blank" rel="noopener noreferrer">Where to watch ↗</a><button class="btn btn--quiet" data-save="${escape(keyOf(item))}" aria-label="${saved ? 'Remove from watchlist' : 'Add to watchlist'}">${saved ? '★ Saved' : '☆ Watchlist'}</button><button class="btn btn--quiet" data-watched="${escape(keyOf(item))}" aria-label="${seen ? 'Mark as not watched' : 'Mark as watched'}">${seen ? '✓ Watched' : 'Mark watched'}</button></div></article>`
}

function currentResults() {
  const query = $('query').value.trim().toLowerCase()
  return CATALOG.filter(item => (filterType === 'all' || item.type === filterType) && (filterGenre === 'all' || item.genres.includes(filterGenre)) && (filterStatus === 'all' || (filterStatus === 'watchlist' ? watchlist.some(entry => keyOf(entry) === keyOf(item)) : filterStatus === 'watched' ? watched.some(entry => keyOf(entry) === keyOf(item)) : !watched.some(entry => keyOf(entry) === keyOf(item)))) && (!query || `${item.title} ${item.note} ${item.genres.join(' ')}`.toLowerCase().includes(query)))
}

function renderResults(items = currentResults()) {
  const region = $('region').value
  $('count').textContent = `${items.length} title${items.length === 1 ? '' : 's'}`
  $('heading').textContent = $('query').value.trim() ? `Results for “${$('query').value.trim()}”` : 'All titles'
  $('results').innerHTML = items.length ? items.map(item => card(item, region)).join('') : '<div class="empty" style="grid-column:1/-1">No title matched. Try a shorter search, or switch genre and type.</div>'
  $('results').querySelectorAll('[data-watched]').forEach(button => button.addEventListener('click', () => {
    const item = CATALOG.find(entry => keyOf(entry) === button.dataset.watched)
    if (!item) return
    if (watched.some(entry => keyOf(entry) === keyOf(item))) watched = watched.filter(entry => keyOf(entry) !== keyOf(item))
    else { watched = [item, ...watched]; watchlist = watchlist.filter(entry => keyOf(entry) !== keyOf(item)) }
    saveWatched(); saveWatchlist(); renderResults()
    $('status').textContent = watched.some(entry => keyOf(entry) === keyOf(item)) ? `${item.title} marked watched.` : `${item.title} no longer marked watched.`
  }))
  $('results').querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    const item = CATALOG.find(entry => keyOf(entry) === button.dataset.save)
    if (!item) return
    if (watchlist.some(entry => keyOf(entry) === keyOf(item))) watchlist = watchlist.filter(entry => keyOf(entry) !== keyOf(item))
    else watchlist = [item, ...watchlist]
    saveWatchlist()
    renderResults()
    $('status').textContent = watchlist.some(entry => keyOf(entry) === keyOf(item)) ? `${item.title} added to your watchlist.` : `${item.title} removed from your watchlist.`
  }))
}

genreOptions()
$('search-form').addEventListener('submit', event => { event.preventDefault(); filterType = $('type').value; filterGenre = $('genre').value; renderResults() })
$('type').addEventListener('change', () => { filterType = $('type').value; renderResults() })
$('genre').addEventListener('change', () => { filterGenre = $('genre').value; renderResults() })
$('status-filter').addEventListener('change', () => { filterStatus = $('status-filter').value; renderResults() })
$('query').addEventListener('input', () => renderResults())
$('region').addEventListener('change', () => { renderResults(); renderWatchlist() })
$('surprise').addEventListener('click', () => {
  const pool = currentResults()
  if (!pool.length) { $('status').textContent = 'Nothing to pick from. Clear the search first.'; return }
  const pick = pool[Math.floor(Math.random() * pool.length)]
  $('status').textContent = `Try ${pick.title} (${pick.year}).`
  renderResults([pick])
})
$('clear-list').addEventListener('click', () => { if (!watchlist.length || !window.confirm('Remove every title from your watchlist?')) return; watchlist = []; saveWatchlist(); renderResults() })
renderResults()
renderWatchlist()
