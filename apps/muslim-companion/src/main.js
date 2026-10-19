import '../../shared/base.css'
import './muslim.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'
import { getLicenseStatus } from '../../shared/license.js'

const sources = [
  { name: 'Qur’an.com', label: 'Full Qur’an reader, translations, recitations and study tools', url: 'https://quran.com/' },
  { name: 'Sunnah.com', label: 'Hadith collections and search', url: 'https://sunnah.com/' },
  { name: 'QuranEnc', label: 'Translations of the meanings of the Qur’an', url: 'https://quranenc.com/' },
  { name: 'AlAdhan', label: 'Prayer times, calendar and Qibla services', url: 'https://aladhan.com/' },
  { name: 'Quran Foundation API', label: 'Official Quran.com developer documentation', url: 'https://api-docs.quran.com/' },
]
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const formatNumber = value => new Intl.NumberFormat('en-IN').format(value)
const coordKey = 'censoris-nur-location'
let location = readJson(coordKey, null)
let chapters = []
let currentChapter = 1
let currentEdition = 'en.sahih'
let proStatus = 'FREE'
let currentQibla = null

mountApp({
  appId: 'nur-companion',
  eyebrow: 'MUSLIM COMPANION · NUR',
  title: 'A quieter space for daily practice.',
  description: 'Read, remember, and find your direction. Your bookmarks, dhikr count, and chosen location stay on this device.',
  content: `<section class="panel quran-panel"><div class="section-heading"><div><p class="eyebrow">QUR’AN READER</p><h2>Continue with a surah</h2></div><a class="btn btn--quiet" href="https://quran.com/" target="_blank" rel="noopener noreferrer">Open Quran.com ↗</a></div><div class="reader-controls"><div class="field"><label for="chapter">Surah</label><select id="chapter"><option value="1">Loading surahs…</option></select></div><div class="field"><label for="translation">Translation</label><select id="translation"><option value="en.sahih">Sahih International</option><option value="en.asad">Muhammad Asad</option><option value="en.pickthall">Marmaduke Pickthall</option></select></div><button class="btn" id="load-chapter">Read surah</button></div><div class="reader-search"><label class="sr-only" for="verse-search">Search Qur’an translation</label><input id="verse-search" type="search" placeholder="Search the English translation"><button class="btn btn--outline" id="search-quran">Search</button></div><div id="search-results" class="search-results" aria-live="polite"></div><p class="muted-copy" id="reader-state" aria-live="polite">Connect to load Qur’an text. Recently opened surahs remain cached on this device.</p><div class="verses" id="verses"></div><div class="reader-footer"><span id="chapter-source">Qur’an text and translation are served by AlQuran Cloud. Translation edition is credited with each verse.</span><div class="actions"><a id="chapter-quran-link" class="btn btn--quiet" href="https://quran.com/1" target="_blank" rel="noopener noreferrer">Open this surah on Quran.com ↗</a><button id="bookmark-chapter" class="btn btn--outline">Save surah</button></div></div></section><div class="content-grid"><section class="panel"><p class="eyebrow">SALAH & DIRECTION</p><h2>Prayer times for your place</h2><p class="muted-copy">Choose a calculation method that matches your local mosque. Times can differ by method and local authority.</p><div class="field-grid three"><div class="field"><label for="latitude">Latitude</label><input id="latitude" type="number" step="any" inputmode="decimal" placeholder="Use location"></div><div class="field"><label for="longitude">Longitude</label><input id="longitude" type="number" step="any" inputmode="decimal" placeholder="Use location"></div><div class="field"><label for="method">Calculation method</label><select id="method"><option value="1">Karachi</option><option value="2">ISNA</option><option value="3" selected>Muslim World League</option><option value="4">Umm Al-Qura</option><option value="5">Egyptian Survey</option><option value="14">Russia</option><option value="99">Local custom</option></select></div></div><div class="field" style="max-width:300px;margin-top:12px"><label for="school">Asr calculation</label><select id="school"><option value="0">Standard / Shafi‘i</option><option value="1">Hanafi</option></select></div><div class="actions"><button class="btn" id="use-location">Use current location</button><button class="btn btn--outline" id="save-location">Save coordinates</button><button class="btn btn--quiet" id="load-prayers">Refresh times</button></div><p class="status" id="prayer-state" aria-live="polite"></p><div class="prayer-grid" id="prayer-times"><div class="empty">Add coordinates or allow location access to see today’s prayer times.</div></div><div class="qibla-card"><div><p class="eyebrow">QIBLA DIRECTION</p><strong id="qibla-bearing">—°</strong><span id="qibla-label">Set a location to calculate the bearing to Makkah.</span></div><div class="qibla-compass"><span class="compass-north">N</span><span class="qibla-arrow" id="qibla-arrow">➤</span><span class="compass-center"></span></div></div></section><aside class="panel"><p class="eyebrow">DHIKR COUNTER</p><h2>A small moment of remembrance</h2><div class="field"><label for="dhikr-type">Phrase</label><select id="dhikr-type"><option value="SubhanAllah">SubhanAllah</option><option value="Alhamdulillah">Alhamdulillah</option><option value="Allahu Akbar">Allahu Akbar</option><option value="Astaghfirullah">Astaghfirullah</option><option value="Salawat">Salawat</option></select></div><div class="dhikr-count" id="dhikr-count">0</div><p class="muted-copy" id="dhikr-label">SubhanAllah · count saved locally</p><div class="actions"><button class="btn dhikr-add" id="dhikr-add">＋ Count</button><button class="btn btn--quiet" id="dhikr-reset">Reset this phrase</button></div><p class="notice">A reset affects only the selected phrase. No account or cloud sync is used.</p><div class="saved-section"><div class="section-heading"><div><p class="eyebrow">YOUR SAVED REFERENCES</p><h2>Bookmarks</h2></div><span class="pill" id="bookmark-total">0 saved</span></div><div id="bookmarks" class="bookmark-list"><div class="empty">Save a surah reference from the reader.</div></div></div></aside></div><section class="panel pro-panel" style="margin-top:18px"><p class="eyebrow">CENSORISLABS PRO</p><h2>Build a private reading rhythm.</h2><p>Keep a seven-day reading log and see your personal recitation patterns. The log is saved on this device and never sent to a server.</p><div class="feature-lock" id="pro-reading"><span><b>Seven-day reading insights</b><small>Record a chapter when you finish · private local history</small></span><button class="btn btn--outline" id="pro-insights">Explore Pro</button></div><div class="pro-insights-content" id="pro-insights-content" hidden></div></section><section class="panel" style="margin-top:18px"><p class="eyebrow">REFERENCE LIBRARY</p><h2>Open trusted source sites</h2><p>These links open the source websites directly. The app does not copy or redistribute their libraries.</p><div class="source-grid">${sources.map(source => `<a class="source-link" href="${source.url}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(source.name)} ↗</b><span>${escapeHtml(source.label)}</span></a>`).join('')}</div><p class="notice">Prayer times are calculated by AlAdhan and may differ from your local mosque. Confirm important timings locally. Qur’an translations are interpretations of meaning; the reader labels the selected translator and links to the source.</p></section>`,
})

const $ = id => document.getElementById(id)
const dateDDMMYYYY = date => `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`

function updateLocationInputs() {
  $('latitude').value = location?.latitude ?? ''
  $('longitude').value = location?.longitude ?? ''
}

function qiblaBearing(latitude, longitude) {
  const radians = number => number * Math.PI / 180
  const lat1 = radians(latitude)
  const lat2 = radians(21.422487)
  const deltaLon = radians(39.826206 - longitude)
  const y = Math.sin(deltaLon)
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(deltaLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function updateQibla() {
  if (!location) return
  currentQibla = qiblaBearing(Number(location.latitude), Number(location.longitude))
  $('qibla-bearing').textContent = `${currentQibla.toFixed(1)}°`
  $('qibla-label').textContent = 'Clockwise from true north · Makkah'
  $('qibla-arrow').style.transform = `translate(-50%, -50%) rotate(${currentQibla}deg)`
}

function saveCoords(latitude = $('latitude').value, longitude = $('longitude').value) {
  const lat = Number(latitude), lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || latitude === '' || longitude === '') {
    $('prayer-state').textContent = 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).'
    return false
  }
  location = { latitude: lat, longitude: lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` }
  writeJson(coordKey, location)
  updateLocationInputs()
  updateQibla()
  return true
}

function renderPrayerTimes(timings, cached = false) {
  const names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  $('prayer-times').innerHTML = names.map(name => `<div class="prayer-time"><span>${name}</span><strong>${escapeHtml(timings[name] || '—')}</strong></div>`).join('')
  $('prayer-state').textContent = `${cached ? 'Showing saved times' : 'Updated'} · ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })} · ${location?.label || ''}`
}

async function loadPrayerTimes() {
  if (!location && !saveCoords()) return
  const dayKey = new Date().toISOString().slice(0, 10)
  const cacheKey = `censoris-nur-prayer-${dayKey}-${location.latitude.toFixed(3)}-${location.longitude.toFixed(3)}-${$('method').value}-${$('school').value}`
  try {
    $('prayer-state').textContent = 'Loading prayer times…'
    const query = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, method: $('method').value, school: $('school').value })
    const response = await fetch(`https://api.aladhan.com/v1/timings/${dateDDMMYYYY(new Date())}?${query}`)
    if (!response.ok) throw new Error(`API responded with ${response.status}`)
    const result = await response.json()
    if (result.code !== 200 || !result.data?.timings) throw new Error('Prayer time data was not available.')
    const record = { savedAt: Date.now(), timings: result.data.timings }
    writeJson(cacheKey, record)
    renderPrayerTimes(record.timings)
  } catch {
    const cached = readJson(cacheKey, null)
    if (cached?.timings) renderPrayerTimes(cached.timings, true)
    else $('prayer-state').textContent = 'Could not refresh. Connect to the internet and try again.'
  }
}

function verseCacheKey(chapter, edition) { return `censoris-nur-verses-${chapter}-${edition}` }

function renderVerses(arabic, translation, edition) {
  const arabicVerses = arabic.ayahs || []
  const translatedVerses = translation.ayahs || []
  const translationName = edition === 'en.asad' ? 'Muhammad Asad' : edition === 'en.pickthall' ? 'Marmaduke Pickthall' : 'Sahih International'
  const translatedByNumber = new Map(translatedVerses.map(item => [item.numberInSurah, item.text]))
  $('verses').innerHTML = arabicVerses.map(ayah => `<article class="verse-card"><div class="verse-topline"><span>${escapeHtml(arabic.englishName)} · ${ayah.numberInSurah}</span><button class="verse-bookmark" data-reference="${arabic.number}:${ayah.numberInSurah}" aria-label="Save ${arabic.number}:${ayah.numberInSurah}">♡</button></div><p class="arabic-text" lang="ar" dir="rtl">${escapeHtml(ayah.text)}</p><p class="translation-text">${escapeHtml(translatedByNumber.get(ayah.numberInSurah) || 'Translation unavailable for this verse.')}</p><div class="verse-credit">Translation: ${escapeHtml(translationName)} · <a href="https://quran.com/${arabic.number}/${ayah.numberInSurah}" target="_blank" rel="noopener noreferrer">Quran.com ${arabic.number}:${ayah.numberInSurah} ↗</a></div></article>`).join('')
  $('chapter-source').textContent = `Arabic text and ${translationName} translation provided by AlQuran Cloud · source linked to Quran.com.`
  $('verses').querySelectorAll('.verse-bookmark').forEach(button => button.addEventListener('click', () => toggleBookmark(button.dataset.reference, button)))
}

function markSession(chapter) {
  const key = 'censoris-nur-pro-reading-history'
  const history = readJson(key, {})
  const day = new Date().toISOString().slice(0, 10)
  history[day] = [...new Set([...(history[day] || []), Number(chapter)])]
  writeJson(key, history)
  renderProInsights()
}

async function loadChapter(chapter = $('chapter').value, edition = $('translation').value) {
  currentChapter = Number(chapter)
  currentEdition = edition
  const chapterInfo = chapters.find(item => item.number === currentChapter)
  $('chapter-quran-link').href = `https://quran.com/${currentChapter}`
  $('verses').innerHTML = ''
  const cacheKey = verseCacheKey(currentChapter, edition)
  let cached = readJson(cacheKey, null)
  if (cached && Date.now() - cached.savedAt >= 7 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem(cacheKey)
    cached = null
  }
  if (cached?.payload) {
    renderVerses(cached.payload[0], cached.payload[1], edition)
    $('reader-state').textContent = `${chapterInfo?.englishName || `Surah ${currentChapter}`} · loaded from this device’s recent cache.`
  } else {
    $('reader-state').textContent = 'Loading Arabic text and translation…'
    try {
      const editionPath = encodeURIComponent(`quran-uthmani,${edition}`)
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${currentChapter}/editions/${editionPath}`)
      if (!response.ok) throw new Error(`API responded with ${response.status}`)
      const result = await response.json()
      if (result.code !== 200 || !Array.isArray(result.data) || result.data.length < 2) throw new Error('Surah data was not returned.')
      writeJson(cacheKey, { savedAt: Date.now(), payload: result.data })
      renderVerses(result.data[0], result.data[1], edition)
      $('reader-state').textContent = `${chapterInfo?.englishName || result.data[0].englishName} · ${result.data[0].numberOfAyahs} verses · cached for up to seven days.`
    } catch {
      if (cached?.payload) {
        renderVerses(cached.payload[0], cached.payload[1], edition)
        $('reader-state').textContent = 'Network unavailable · showing the last saved copy.'
      } else {
        $('reader-state').textContent = 'Could not load the surah. Check your connection or open it directly on Quran.com.'
        $('verses').innerHTML = '<div class="empty">The reader needs a connection for this surah’s first load.</div>'
      }
    }
  }
}

async function searchQuran() {
  const query = $('verse-search').value.trim()
  if (!query) { $('search-results').innerHTML = ''; return }
  $('search-results').innerHTML = '<div class="empty">Searching the selected English translation…</div>'
  try {
    const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/${encodeURIComponent($('translation').value)}`)
    if (!response.ok) throw new Error('Search unavailable')
    const result = await response.json()
    const matches = result.data?.matches || []
    $('search-results').innerHTML = matches.length ? `<p class="eyebrow">${matches.length} MATCHES · ${escapeHtml(result.data.edition?.englishName || 'Selected translation')}</p>${matches.slice(0, 12).map(match => `<article class="search-hit"><div class="verse-topline"><span>${escapeHtml(match.surah?.englishName || `Surah ${match.surah?.number}`)} · ${match.numberInSurah}</span><button class="verse-bookmark" data-reference="${match.surah?.number}:${match.numberInSurah}" aria-label="Save ${match.surah?.number}:${match.numberInSurah}">♡</button></div><p>${escapeHtml(match.text)}</p><a href="https://quran.com/${match.surah?.number}/${match.numberInSurah}" target="_blank" rel="noopener noreferrer">Open verse on Quran.com ↗</a></article>`).join('')}` : '<div class="empty">No matches in this translation.</div>'
    $('search-results').querySelectorAll('.verse-bookmark').forEach(button => button.addEventListener('click', () => toggleBookmark(button.dataset.reference, button)))
  } catch {
    $('search-results').innerHTML = '<div class="empty">Search is unavailable. Try again or search directly on Quran.com.</div>'
  }
}

async function loadChapterList() {
  const key = 'censoris-nur-chapters'
  const cached = readJson(key, null)
  if (cached?.chapters && Date.now() - cached.savedAt < 30 * 24 * 60 * 60 * 1000) chapters = cached.chapters
  else {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah')
      if (!response.ok) throw new Error('Chapter list unavailable')
      const result = await response.json()
      if (result.code !== 200 || !Array.isArray(result.data)) throw new Error('Invalid chapter list')
      chapters = result.data
      writeJson(key, { savedAt: Date.now(), chapters })
    } catch {
      if (cached?.chapters) chapters = cached.chapters
    }
  }
  if (!chapters.length) {
    $('chapter').innerHTML = '<option value="1">Could not load surahs</option>'
    $('reader-state').textContent = 'Connect once to load the surah list, or open Quran.com directly.'
    return
  }
  $('chapter').innerHTML = chapters.map(item => `<option value="${item.number}">${String(item.number).padStart(3, '0')} · ${escapeHtml(item.englishName)} · ${escapeHtml(item.name)}</option>`).join('')
  $('chapter').value = String(currentChapter)
  await loadChapter(currentChapter, currentEdition)
}

function getBookmarks() { return readJson('censoris-nur-bookmarks', []) }

function renderBookmarks() {
  const items = getBookmarks()
  $('bookmark-total').textContent = `${items.length} saved`
  $('bookmarks').innerHTML = items.length ? items.map(item => `<div class="bookmark-item"><a href="https://quran.com/${item.reference.replace(':', '/') }" target="_blank" rel="noopener noreferrer">Surah ${escapeHtml(item.reference)} ↗</a><button class="remove-bookmark" data-reference="${escapeHtml(item.reference)}" aria-label="Remove ${escapeHtml(item.reference)}">×</button></div>`).join('') : '<div class="empty">Save a verse or surah reference from the reader.</div>'
  $('bookmarks').querySelectorAll('.remove-bookmark').forEach(button => button.addEventListener('click', () => {
    writeJson('censoris-nur-bookmarks', getBookmarks().filter(item => item.reference !== button.dataset.reference))
    renderBookmarks()
  }))
}

function toggleBookmark(reference, button) {
  const items = getBookmarks()
  if (items.some(item => item.reference === reference)) {
    writeJson('censoris-nur-bookmarks', items.filter(item => item.reference !== reference))
    button.textContent = '♡'
  } else {
    writeJson('censoris-nur-bookmarks', [{ reference, savedAt: Date.now() }, ...items])
    button.textContent = '♥'
  }
  renderBookmarks()
}

function selectedDhikr() { return $('dhikr-type').value }
function dhikrCounts() { return readJson('censoris-nur-dhikr', {}) }
function renderDhikr() {
  const phrase = selectedDhikr()
  $('dhikr-count').textContent = formatNumber(dhikrCounts()[phrase] || 0)
  $('dhikr-label').textContent = `${phrase} · count saved locally`
}

function renderProInsights() {
  const container = $('pro-insights-content')
  if (!container || proStatus === 'FREE') return
  const history = readJson('censoris-nur-pro-reading-history', {})
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return { label: date.toLocaleDateString('en-IN', { weekday: 'short' }), count: (history[key] || []).length }
  })
  container.hidden = false
  container.innerHTML = `<div class="actions"><button class="btn" id="log-reading">Log this surah as read</button><span class="pill">On this device only</span></div><div class="reading-bars">${days.map(day => `<div class="reading-day"><div class="reading-bar" style="--bar:${day.count ? 100 : 8}%"></div><span>${day.label}</span><small>${day.count} ${day.count === 1 ? 'surah' : 'surahs'}</small></div>`).join('')}</div>`
  $('log-reading').addEventListener('click', () => markSession(currentChapter))
}

async function refreshProState() {
  proStatus = await getLicenseStatus()
  const locked = $('pro-insights')
  if (proStatus !== 'FREE') {
    $('pro-reading').hidden = true
    renderProInsights()
  } else {
    $('pro-reading').hidden = false
    locked.textContent = 'Explore Pro'
  }
}

updateLocationInputs()
updateQibla()
renderBookmarks()
renderDhikr()
void loadChapterList()
void refreshProState()
if (location) void loadPrayerTimes()

$('chapter').addEventListener('change', () => { currentChapter = Number($('chapter').value); $('chapter-quran-link').href = `https://quran.com/${currentChapter}` })
$('translation').addEventListener('change', () => { void loadChapter(currentChapter, $('translation').value) })
$('load-chapter').addEventListener('click', () => { void loadChapter() })
$('search-quran').addEventListener('click', () => { void searchQuran() })
$('verse-search').addEventListener('keydown', event => { if (event.key === 'Enter') void searchQuran() })
$('translation').addEventListener('change', () => { if ($('verse-search').value.trim()) void searchQuran() })
$('bookmark-chapter').addEventListener('click', event => toggleBookmark(String(currentChapter), event.currentTarget))
$('use-location').addEventListener('click', () => {
  if (!navigator.geolocation) { $('prayer-state').textContent = 'Location is not available in this app environment.'; return }
  $('prayer-state').textContent = 'Requesting location permission…'
  navigator.geolocation.getCurrentPosition(position => {
    if (saveCoords(position.coords.latitude, position.coords.longitude)) void loadPrayerTimes()
  }, error => { $('prayer-state').textContent = error.code === 1 ? 'Location access was denied. Enter coordinates manually.' : 'Could not get location. Enter coordinates manually.' }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })
})
$('save-location').addEventListener('click', () => { if (saveCoords()) void loadPrayerTimes() })
$('load-prayers').addEventListener('click', () => { if (location) void loadPrayerTimes(); else if (saveCoords()) void loadPrayerTimes() })
$('method').addEventListener('change', () => { if (location) void loadPrayerTimes() })
$('school').addEventListener('change', () => { if (location) void loadPrayerTimes() })
$('dhikr-type').addEventListener('change', renderDhikr)
$('dhikr-add').addEventListener('click', () => {
  const counts = dhikrCounts()
  counts[selectedDhikr()] = (counts[selectedDhikr()] || 0) + 1
  writeJson('censoris-nur-dhikr', counts)
  renderDhikr()
  navigator.vibrate?.(12)
})
$('dhikr-reset').addEventListener('click', () => {
  const counts = dhikrCounts()
  counts[selectedDhikr()] = 0
  writeJson('censoris-nur-dhikr', counts)
  renderDhikr()
})
$('pro-insights').addEventListener('click', () => showPaywall('private reading insights', status => { proStatus = status; $('pro-reading').hidden = true; renderProInsights() }))
window.addEventListener('censorislabs:license-updated', () => { void refreshProState() })
