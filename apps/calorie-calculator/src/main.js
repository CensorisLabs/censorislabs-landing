import '../../shared/base.css'
import './tracker.css'
import './mfp.css'
import { mountApp } from '../../shared/shell.js'
import { Capacitor } from '@capacitor/core'
import { HealthFitness } from '@capacitor/health-fitness'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  STORAGE_KEY, ACTIVITY_FACTORS, activeProfile, calculateFoodTotals, calculateTargets,
  clamp, computeRecovery, createInitialState, createProfile, dayActivity, estimateActivityCalories,
  heartRateZone, loadState, normalizeState, saveState, sleepDebt, stepSyncDue, todayISO, uid, weeklySeries,
  weightTrend, acuteChronicRatio, bmiCategory, estimateStepCalories, loggingStreak, stepsToDistanceKm, daysAgoISO,
} from './core.js'
import { EXERCISES, FOOD_CATEGORIES, FOODS, searchFoods } from './foods.js'
import { copyableMeals, frequentFoods, previousDay, recentMeals, recentSymptoms, slotBreakdown, weeklyAverages } from './insights.js'
import {
  achievements, formatDistance, formatHeight, formatWater, formatWeight, goalProjection,
  searchFeatures, weeklyGrade, FEATURE_COUNT, mealKcalOf, TIPS,
} from './features.js'
import {
  WALK_PACES, RUN_PACES, PACES_FOR, COMPANIONS, FEELINGS, PLACES, WEATHERS,
  clearWalk, emptyWalk, formatDuration, loadWalk, paceLabel, saveWalk, walkSummary,
} from './walk.js'
import { createGpsFilter, gpsErrorMessage, gpsQuality, routePath } from './gps.js'
import { createStepDetector, defaultStrideM, stepSourceInfo, strideFromCalibration, distanceForSteps } from './steps.js'
import {
  bodyFatChange, bpCategory, cadencePerMinute, caloriePacing, compareToPrevious, dayCompleteness,
  daySummaryText, daysSinceLast, fastingSummary, glucoseStats, labSeries, latestLabName, loggingHeatmap,
  macroRemaining, medicationAdherence, rankFoods, sleepConsistency, stepGoalStreak, storageUsage,
  symptomFrequency, weekOverWeek, weekdayPattern, weeklyActiveMinutes, weightGoalProgress,
} from './health-tools.js'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nfmt = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0)
const dfmt = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const round1 = value => Math.round((Number(value) || 0) * 10) / 10
const scopeRecords = (state, profile) => {
  const copy = { ...state }
  for (const key of ['meals','activities','weights','sleeps','water','vitals','moods','habits','habitLogs','recipes','mealPlans','supplements','medicineLogs','cycleLogs','symptoms','labResults','glucose','fastingSessions','customMetrics','journal','healthImports','measurements','templates','walks']) {
    copy[key] = (state[key] || []).filter(item => !item.profileId || item.profileId === profile.id)
  }
  return copy
}
const calcFood = food => ({ kcal: Number(food.kcal) || 0, p: Number(food.p) || 0, c: Number(food.c) || 0, f: Number(food.f) || 0, fi: Number(food.fi) || 0, su: Number(food.su) || 0, na: Number(food.na) || 0 })

const root = mountApp({
  appId: 'calorie-calculator', freeOnly: true,
  eyebrow: 'HEALTH · PRIVATE TRACKER · FREE FOREVER',
  title: 'AbsoluteCal · your health, on your terms.',
  description: 'Meals, movement, sleep and health notes in one private tracker. Estimates are clearly labeled, and your entries stay on this device.',
  content: `<div class="tracker" id="tracker-app">
    <div class="tracker-top"><div class="tracker-brand"><span class="tracker-brand__mark" aria-hidden="true">A</span><span><b>AbsoluteCal</b><small>HEALTH · STEPS · MEALS</small></span></div><label class="tracker-profile">PROFILE <select id="profile-select" aria-label="Active profile"></select><button class="cc-button" type="button" data-action="profile-new">Add</button></label><label class="tracker-date">DAY <input id="day-select" type="date" aria-label="Selected day"></label><span class="cc-offline-label">LOCAL DATA · NO ACCOUNT</span></div>
    <nav class="tracker-nav" aria-label="Health tracker sections"><button type="button" data-tab="today"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg><span>Home</span></button><button type="button" data-tab="food"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg><span>Diary</span></button><button type="button" data-tab="activity"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6-2-3 1-5 3 3h3"/><path d="M7.5 20 9 16"/></svg><span>Walk</span></button><button type="button" data-tab="health"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg><span>Health</span></button><button type="button" data-tab="trends"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16"/><path d="M7 19v-6M12 19V6M17 19v-9"/></svg><span>Progress</span></button><button type="button" data-tab="more"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>More</span></button></nav>
    <section class="tracker-view" id="tracker-view" aria-live="polite"></section><div id="walk-checkin-host"></div><div id="tracker-toast" aria-live="polite"></div>
  </div>`,
})

const state = loadState()
let tab = 'today', selectedDate = todayISO(), foodQuery = '', foodCategory = '', barcodeStream = null, barcodeFrame = 0
let pendingSlot = 'Snack', foodFilter = 'all', progressRange = 7, featureQuery = '', undoEntry = null
let foodSort = 'protein', walkFilterMode = 'all', copySourceDate = ''
let activeWalk = loadWalk(), walkTimer = 0, walkWatch = null
let walkFilter = null, walkGps = null, gpsError = '', wakeLock = null, walkRoute = []
let motionHandler = null, motionStarted = 0, motionCount = 0, lastStepAt = 0, gpsWatch = null, gpsPoints = [], gpsStarted = 0, restTimer = 0
let stepDetector = null, stepCount = 0, pendingCheckin = null, finishPhoto = '', photoTask = null
let fastingTimer = 0, toastTimer = 0, photoData = '', photoAt = 0, lastReminderDay = '', labOcrWorker = null
// A meal photo is only meant for the entry the user is about to add. Anything
// older than ten minutes is stale and must not attach itself to a later meal.
const PHOTO_TTL_MS = 10 * 60 * 1000
// A walk restored after the app was closed keeps the route it had collected.
if (activeWalk?.route?.length) walkRoute = activeWalk.route

function profile() { return activeProfile(state) }
function scoped() { return scopeRecords(state, profile()) }
function targets() { return calculateTargets(profile()) }
function recordBase(date = selectedDate) { return { id: uid(), date, profileId: profile().id } }
function toast(message) {
  const node = $('#tracker-toast', root)
  if (!node) return
  node.innerHTML = `<div class="cc-toast">${esc(message)}</div>`
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.innerHTML = '' }, 3400)
}
function setTab(next) { tab = next; render() }
function render() {
  const select = $('#profile-select', root)
  if (select) select.innerHTML = state.profiles.map(item => `<option value="${esc(item.id)}" ${item.id === state.activeProfileId ? 'selected' : ''}>${esc(item.name || 'Me')}</option>`).join('')
  const day = $('#day-select', root); if (day) day.value = selectedDate
  $$('.tracker-nav [data-tab]', root).forEach(button => { button.classList.toggle('active', button.dataset.tab === tab); button.setAttribute('aria-current', button.dataset.tab === tab ? 'page' : 'false') })
  const view = $('#tracker-view', root)
  const pages = { today: renderHome, food: renderDiary, activity: renderActivity, health: renderHealth, trends: renderProgress, more: renderMore }
  const extra = tab === 'activity' ? extraActivity() : tab === 'health' ? extraHealth() : tab === 'more' ? settingsCard() + toolsCard() + featureIndexCard() : ''
  if (view) view.innerHTML = (tab === 'activity' ? walkCardHtml() : '') + (pages[tab] || renderHome)() + extra
  const checkinHost = $('#walk-checkin-host', root)
  if (checkinHost) checkinHost.innerHTML = pendingCheckin ? checkinHtml() : ''
  if (tab === 'food') renderFoodResults()
  updateFastingClock()
}
function persist(message) {
  if (!saveState(state)) { toast('Device storage is full. Export your backup and remove large photos.'); return false }
  if (message) toast(message)
  return true
}
function progressBar(value, goal, green = false) {
  const percent = goal > 0 ? clamp((Number(value) || 0) / goal * 100, 0, 100) : 0
  return `<div class="cc-progress ${green ? 'green' : ''}" role="progressbar" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i></div>`
}
function heading(title, sub = '') { return `<div class="tracker-heading"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>` }
function empty(text, action = '') { return `<div class="cc-empty"><p>${esc(text)}</p>${action ? `<div class="cc-actions">${action}</div>` : ''}</div>` }
function gettingStartedCard(t, mealCount) {
  let hidden = false
  try { hidden = localStorage.getItem('cc-onboard-dismissed') === '1' } catch { hidden = false }
  if (hidden) return ''
  const step = (number, done, title, detail, control) => `<li class="cc-onboard__step${done ? ' is-done' : ''}"><span aria-hidden="true">${done ? '✓' : number}</span><div><b>${title}</b><small>${detail}</small></div>${control}</li>`
  return `<article class="cc-card cc-card--wide cc-onboard"><div class="cc-onboard__head"><div><p class="eyebrow">START HERE</p><h3>Three steps and you are set up</h3></div><button class="cc-onboard__close" type="button" data-action="onboard-dismiss" aria-label="Hide getting started guide">×</button></div><ol class="cc-onboard__steps">${step(1, Boolean(t), 'Add your body details', 'Age, height and weight unlock a daily calorie estimate. Everything else works without it.', t ? '<em class="cc-onboard__done">Done</em>' : '<button class="primary" type="button" data-action="go-profile">Set up profile</button>')}${step(2, mealCount > 0, 'Log one meal', 'Search the built-in food list, scan a barcode, or add a custom food.', mealCount > 0 ? '<em class="cc-onboard__done">Done</em>' : '<button type="button" data-tab="food">Open food diary</button>')}${step(3, false, 'Come back tomorrow', 'Trends, 7-day averages and the meal shortcuts fill in as you keep logging.', '<button type="button" data-tab="trends">See trends</button>')}</ol><p class="cc-small">Your entries stay on this device. Hide this guide whenever you like.</p></article>`
}
function dayMeals(s = scoped()) { return s.meals.filter(item => item.date === selectedDate) }
function dayTotal(s = scoped()) { return calculateFoodTotals(s.meals, selectedDate) }
function nutrientLine(label, value, unit = '') {
  // Values arrive as numbers or already-formatted strings ("9.33 km", "0 h 31 min").
  const text = Number.isFinite(Number(value)) ? nfmt(value) : esc(String(value ?? ''))
  return `<div class="cc-row"><span>${label}</span><strong>${text}${unit ? ` ${unit}` : ''}</strong></div>`
}
function calorieCard(s, t, food) {
  if (!t) return `<article class="cc-card cc-card--wide"><h3>Set up your profile</h3><p>Add an adult age, height and weight to calculate a daily estimate. You can still log meals, movement and health notes without it.</p><div class="cc-actions"><button class="primary" data-action="go-profile">Set up profile</button></div><div class="cc-notice">Calorie estimates are for adults and are not a diagnosis or treatment plan. Talk with a qualified clinician about medical or nutrition concerns.</div></article>`
  const remaining = t.calorieTarget - food.kcal
  return `<article class="cc-card cc-card--wide"><div class="cc-row"><div><p class="cc-muted cc-small">FOOD ENERGY · ${esc(profile().goal === 'maintain' ? 'DAILY TARGET' : 'ESTIMATED DAILY TARGET')}</p><div class="cc-stat">${nfmt(food.kcal)} <small>/ ${nfmt(t.calorieTarget)} kcal</small></div></div><span class="cc-chip">${remaining >= 0 ? `${nfmt(remaining)} left` : `${nfmt(Math.abs(remaining))} over`}</span></div>${progressBar(food.kcal,t.calorieTarget)}<p class="cc-small">Food logged is compared with your target. Recorded activity is shown separately and is not automatically added back.</p><div class="cc-macros">${[['Protein',food.protein,t.protein],['Carbs',food.carbs,t.carbs],['Fat',food.fat,t.fat]].map(([label,value,goal])=>`<div class="cc-macro"><b>${round1(value)} <small>g</small></b><span>${label} · target ${nfmt(goal)} g</span>${progressBar(value,goal)}</div>`).join('')}</div></article>`
}
function setupProfileForm() {
  const p = profile()
  return `<form class="cc-form" id="profile-form"><div class="cc-fields three">
    <label class="cc-field"><span>Display name</span><input name="name" maxlength="28" value="${esc(p.name)}" autocomplete="off"></label>
    <label class="cc-field"><span>Age (adult estimate)</span><input name="age" type="number" min="18" max="100" value="${esc(p.age)}" placeholder="18+" inputmode="numeric"></label>
    <label class="cc-field"><span>Equation setting</span><select name="equation"><option value="female" ${p.equation==='female'?'selected':''}>Female coefficient</option><option value="male" ${p.equation==='male'?'selected':''}>Male coefficient</option></select></label>
    <label class="cc-field"><span>Height (cm)</span><input name="heightCm" type="number" min="120" max="230" step="0.1" value="${esc(p.heightCm)}" placeholder="168"></label>
    <label class="cc-field"><span>Current weight (kg)</span><input name="weightKg" type="number" min="35" max="350" step="0.1" value="${esc(p.weightKg)}" placeholder="68"></label>
    <label class="cc-field"><span>Usual activity</span><select name="activity">${ACTIVITY_FACTORS.map(item=>`<option value="${item.value}" ${Number(p.activity)===item.value?'selected':''}>${esc(item.label)}</option>`).join('')}</select></label>
    <label class="cc-field"><span>Goal</span><select name="goal"><option value="lose" ${p.goal==='lose'?'selected':''}>Gradual loss</option><option value="maintain" ${p.goal==='maintain'?'selected':''}>Maintain</option><option value="gain" ${p.goal==='gain'?'selected':''}>Gradual gain</option></select></label>
    <label class="cc-field"><span>Sleep goal (hours)</span><input name="sleepGoalHours" type="number" min="4" max="12" step="0.5" value="${esc(p.sleepGoalHours)}"></label>
    <label class="cc-field"><span>Water goal (ml)</span><input name="waterGoalMl" type="number" min="250" max="10000" step="50" value="${esc(p.waterGoalMl)}"></label>
    <label class="cc-field"><span>Step goal</span><input name="stepGoal" type="number" min="500" max="50000" step="500" value="${esc(p.stepGoal)}"></label>
  </div><div class="cc-actions"><button class="primary" type="submit">Save profile</button></div><p class="cc-small">Mifflin–St Jeor estimates vary by person. No weight-loss target is set below the estimated basal rate.</p></form>`
}
function greetingWord() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}
function unitsPref() { return state.settings.units === 'imperial' ? 'imperial' : 'metric' }
function burnedEstimate(activity, s = scoped()) {
  const workouts = Number(activity.exerciseCalories) || 0
  const device = Number(activity.deviceCalories) || 0
  if (device > 0) {
    // A device total is the whole day including resting metabolism, so only the
    // part above maintenance is extra energy that can be added back to the goal.
    const maintenance = Number(targets()?.maintenance) || 0
    // Never report less than the sessions that were actually logged here.
    return Math.round(Math.max(0, device - maintenance, workouts))
  }
  // Walk sessions already include their step energy in the MET estimate.
  const walkSteps = (s.activities || [])
    .filter(item => item.date === selectedDate && /walk/i.test(String(item.source || '')))
    .reduce((sum, item) => sum + (Number(item.steps) || 0), 0)
  return Math.round(workouts + estimateStepCalories(Math.max(0, activity.steps - walkSteps), profile().weightKg))
}
function calorieRing(percent) {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const filled = clamp(percent, 0, 100) / 100
  return `<svg viewBox="0 0 132 132" aria-hidden="true" focusable="false"><circle class="track" cx="66" cy="66" r="${radius}"/><circle class="value" cx="66" cy="66" r="${radius}" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - filled)).toFixed(1)}"/></svg>`
}
const SLOT_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const SLOT_ICONS = { Breakfast: '🍳', Lunch: '🥗', Dinner: '🍲', Snack: '🍎' }
function weightEntries(s, date = selectedDate) {
  return (s.weights || []).filter(item => Number(item.kg) > 0 && item.date <= date).sort((a, b) => a.date.localeCompare(b.date))
}
function weightChange(s, date = selectedDate) {
  const entries = weightEntries(s, date)
  if (entries.length < 2) return null
  return Math.round((Number(entries[entries.length - 1].kg) - Number(entries[entries.length - 2].kg)) * 10) / 10
}
function miniBars(series, key, max, unit = '') {
  return `<div class="cc-bars">${series.map(item => `<div class="cc-bar" title="${esc(item.date)} · ${nfmt(item[key])}${unit}"><b>${nfmt(item[key]) || '—'}</b><i style="height:${Math.max(2, clamp(item[key] / max * 100, 0, 100))}%"></i><span>${esc(item.label)}</span></div>`).join('')}</div>`
}
function strideOf(p = profile()) {
  return Number(p.strideM) || defaultStrideM(p.heightCm, p.equation)
}
function walkMode() { return state.settings.walkMode === 'run' ? 'run' : 'walk' }
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode failed'))
    image.src = url
  })
}
// Compress a picked photo into a small JPEG data URL. Always settles: a stalled
// decoder must never leave the check-in dialog waiting forever.
async function readPhoto(file, max = 640, quality = 0.55) {
  if (!file || !String(file.type || '').startsWith('image/')) return ''
  if (file.size > 14 * 1024 * 1024) { toast('Choose a photo under 14 MB.'); return '' }
  const shrink = (source, width, height) => {
    const scale = Math.min(1, max / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  }
  try {
    const bitmap = await withTimeout(createImageBitmap(file), 8000)
    const data = shrink(bitmap, bitmap.width, bitmap.height)
    if (bitmap.close) bitmap.close()
    return data
  } catch { /* fall back to an <img> decode below */ }
  const url = URL.createObjectURL(file)
  try {
    const image = await withTimeout(loadImage(url), 8000)
    return shrink(image, image.naturalWidth || image.width, image.naturalHeight || image.height)
  } catch {
    toast('Could not read that photo. Try a different one.')
    return ''
  } finally {
    URL.revokeObjectURL(url)
  }
}
function pruneWalkPhotos(max = 20) {
  const withPhotos = (state.walks || []).filter(item => item.startPhoto || item.endPhoto).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const excess = withPhotos.length - max
  for (let index = 0; index < excess; index += 1) {
    withPhotos[index].startPhoto = ''
    withPhotos[index].endPhoto = ''
  }
}
function walkCardHtml() {
  const p = profile()
  if (activeWalk) {
    const summary = walkSummary(activeWalk, p.weightKg, strideOf(p))
    const paused = Boolean(activeWalk.pauseStartedAt)
    return `<section class="walk-card" id="walk-card"><div class="walk-live">
      <div class="walk-live__head"><span class="walk-dot ${paused ? 'paused' : ''}"></span><span class="walk-live__status">${paused ? 'Paused' : `${summary.mode === 'run' ? 'Run' : 'Walk'} in progress`}</span><span class="cc-chip">${esc(summary.paceLabel)}</span><span class="cc-chip" id="walk-source">${esc(summary.source)}</span><span class="cc-chip walk-move ${activeWalk.moving ? 'on' : ''}" id="walk-move">${activeWalk.moving ? 'Moving' : activeWalk.gps ? 'Standing still' : 'No GPS yet'}</span></div>
      <div class="walk-metrics">
        <div class="walk-metric"><span>Time</span><b id="walk-elapsed">${formatDuration(summary.ms)}</b></div>
        <div class="walk-metric"><span>Distance</span><b id="walk-distance">${formatDistance(summary.distanceKm, unitsPref())}</b></div>
        <div class="walk-metric"><span>Steps</span><b id="walk-steps">${nfmt(summary.steps)}</b></div>
        <div class="walk-metric"><span>Burned</span><b id="walk-kcal">${nfmt(summary.calories)}</b></div>
      </div>
      <div class="walk-extra"><span>Pace <b id="walk-pace-label">${summary.pacePerKm}</b></span><span>Speed <b id="walk-speed">${summary.speed} km/h</b></span><span>Stride <b>${Math.round(strideOf(p) * 100)} cm</b></span><span>Cadence <b>${cadencePerMinute(summary.steps, summary.minutes) ? `${cadencePerMinute(summary.steps, summary.minutes)}/min` : '—'}</b></span></div>
      <div class="walk-gps"><span class="walk-gps__dot ${activeWalk.moving ? 'moving' : activeWalk.gps ? 'still' : 'weak'}" id="walk-gps-dot"></span><span id="walk-gps-text">${esc(gpsLine())}</span></div>
      <div class="walk-map-wrap"><svg class="walk-map" id="walk-map" viewBox="0 0 320 180" role="img" aria-label="Your route so far"><polyline id="walk-map-path" class="walk-map__line" points=""></polyline><circle id="walk-map-start" class="walk-map__start" r="4.5" cx="0" cy="0"></circle><circle id="walk-map-end" class="walk-map__end" r="5.5" cx="0" cy="0"></circle></svg><p class="walk-map__note" id="walk-map-note">Route appears once GPS locks. It is drawn on this device only — no map tiles, nothing uploaded.</p></div>
      <div class="walk-controls"><button class="primary" type="button" data-action="${paused ? 'walk-resume' : 'walk-pause'}">${paused ? '▶ Resume' : '❚❚ Pause'}</button><button class="stop" type="button" data-action="walk-finish">Finish</button><button type="button" data-action="walk-discard">Discard</button><label class="walk-photo-btn">📷 ${activeWalk.startPhoto ? 'Start photo added' : 'Start photo'}<input type="file" id="walk-photo-start" accept="image/*" capture="environment" hidden></label></div>
      ${activeWalk.startPhoto ? `<img class="walk-photo" src="${activeWalk.startPhoto}" alt="Photo taken at the start of this session">` : ''}
      <p class="cc-small cc-muted" id="walk-foot">${activeWalk.gps ? `GPS distance from ${nfmt(activeWalk.points || 0)} accepted fixes; jitter and signal jumps are ignored. Standing still does not add distance. Keep this screen open while you move.` : 'Until GPS locks, distance and steps come from your pace and stride. Keep this screen open while you move.'}</p>
    </div></section>`
  }
  const mode = walkMode()
  const modes = PACES_FOR(mode)
  const chosen = modes.some(item => item.id === state.settings.walkPace) ? state.settings.walkPace : modes[1].id
  return `<section class="walk-card" id="walk-card">
    <div class="walk-card__top"><div><h3>Start a walk or run</h3><p>One tap starts the clock and tracks distance, steps and calories. You can add a photo at the start and at the finish.</p></div><div class="seg walk-mode"><button type="button" data-action="walk-mode" data-mode="walk" class="${mode === 'walk' ? 'on' : ''}">🚶 Walk</button><button type="button" data-action="walk-mode" data-mode="run" class="${mode === 'run' ? 'on' : ''}">🏃 Run</button></div></div>
    <div class="walk-start"><button class="go" type="button" data-action="walk-start">▶ Start ${mode === 'run' ? 'run' : 'walk'}</button>
      <label class="cc-field" style="min-width:230px"><span>Typical pace</span><select id="walk-pace">${modes.map(item => `<option value="${item.id}" ${chosen === item.id ? 'selected' : ''}>${esc(item.label)} · ${esc(item.hint)}</option>`).join('')}</select></label>
    </div>
    <p class="cc-small cc-muted">Estimated from your stride (${Math.round(strideOf(p) * 100)} cm) and the time you move. Photos stay on this device.</p>
  </section>`
}
// A blocked clipboard must not be a dead end: show the same text, selected, so
// it can be copied by hand on any device.
function showCopyFallback(text) {
  const host = $('#walk-checkin-host', root)
  if (!host) return toast('This browser blocked the clipboard.')
  host.innerHTML = `<div class="checkin-backdrop"><section class="checkin-card" role="dialog" aria-modal="true" aria-labelledby="copy-title"><h3 id="copy-title">Copy today’s summary</h3><p class="cc-small">This browser would not fill the clipboard, so the text is selected below. Long-press or press copy.</p><textarea class="cc-copy-area" id="copy-summary-text" readonly rows="8">${esc(text)}</textarea><div class="cc-actions"><button class="primary" type="button" data-action="close-copy">Done</button></div></section></div>`
  const area = $('#copy-summary-text', root)
  if (area) { area.focus(); area.select?.() }
}
function checkinHtml() {
  if (!pendingCheckin) return ''
  const { record, summary } = pendingCheckin
  return `<div class="checkin-backdrop"><section class="checkin-card" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
    <div class="checkin-head"><div><p class="eyebrow">SESSION SAVED</p><h3 id="checkin-title">${summary.mode === 'run' ? 'Run' : 'Walk'} complete · ${nfmt(record.minutes)} min</h3><p class="cc-small">${formatDistance(record.distanceKm, unitsPref())} · ${nfmt(record.steps)} steps · ${nfmt(record.calories)} kcal · ${esc(summary.pacePerKm)}</p></div><span class="checkin-badge">✅</span></div>
    <p class="cc-small">A few optional questions — they make your history worth reading later.</p>
    <form class="cc-form" id="walk-checkin-form">
      <div class="cc-fields">
        <label class="cc-field"><span>Who were you with?</span><select name="with">${COMPANIONS.map(value => `<option>${esc(value)}</option>`).join('')}</select></label>
        <label class="cc-field"><span>How did it feel?</span><select name="feel">${FEELINGS.map(value => `<option>${esc(value)}</option>`).join('')}</select></label>
        <label class="cc-field"><span>Where did you go?</span><select name="place">${PLACES.map(value => `<option>${esc(value)}</option>`).join('')}</select></label>
        <label class="cc-field"><span>Weather (optional)</span><select name="weather"><option value="">Not saying</option>${WEATHERS.map(value => `<option>${esc(value)}</option>`).join('')}</select></label>
      </div>
      <div class="cc-field"><span>Finish photo (optional, stays on this device)</span><label class="walk-photo-btn">📷 ${finishPhoto ? 'Finish photo added' : 'Take finish photo'}<input type="file" id="walk-photo-finish" accept="image/*" capture="environment" hidden></label></div>
      <div id="finish-photo-preview">${finishPhoto ? `<img class="walk-photo" src="${finishPhoto}" alt="Photo taken at the finish">` : ''}</div>
      <label class="cc-field"><span>Note (optional)</span><input name="notes" maxlength="140" placeholder="Felt strong, knee was fine"></label>
      <div class="cc-actions"><button class="primary" type="submit">Save check-in</button><button type="button" data-action="walk-checkin-skip">Skip</button></div>
    </form>
  </section></div>`
}
// Four small answers people actually ask during the day: am I pacing well, what
// is left, did I log everything, and how does today compare with yesterday?
function homeGlanceCard(s, t, food, activity) {
  const p = profile()
  const pacing = t ? caloriePacing({ kcal: food.kcal, target: t.calorieTarget }) : null
  const left = macroRemaining(food, t)
  const complete = dayCompleteness(state, selectedDate, p.id)
  const yesterdayFood = calculateFoodTotals(s.meals, previousDay(selectedDate))
  const compare = yesterdayFood.count ? compareToPrevious(food.kcal, yesterdayFood.kcal) : null
  const moodOf = { onPace: ['ok', 'On pace'], ahead: ['warn', 'Ahead of pace'], behind: ['', 'Behind pace'] }[pacing?.status] || ['', 'No target yet']
  return `<article class="cc-card cc-card--wide glance">
    <div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Today at a glance</h3><small class="cc-muted">${t ? esc(pacing.label) : 'Set up your profile for a calorie target.'}</small></div><span class="cc-chip ${moodOf[0] === 'warn' ? 'warn' : moodOf[0] === 'ok' ? 'good' : ''}">${esc(moodOf[1])}</span></div>
    <div class="cc-fields three" style="margin-top:6px">
      <div><p class="cc-small cc-muted" style="margin:0 0 4px">MACROS LEFT</p><p class="cc-small" style="margin:0">${left ? `P ${nfmt(left.protein)} g · C ${nfmt(left.carbs)} g · F ${nfmt(left.fat)} g` : 'Add a profile to see targets.'}</p></div>
      <div><p class="cc-small cc-muted" style="margin:0 0 4px">TRACKED TODAY · ${complete.done}/${complete.total}</p><p class="cc-small" style="margin:0">${complete.missing.length ? `Still open: ${esc(complete.missing.join(', '))}` : 'Everything is logged today.'}</p></div>
      <div><p class="cc-small cc-muted" style="margin:0 0 4px">VS YESTERDAY</p><p class="cc-small" style="margin:0">${compare ? `${esc(compare.label)} kcal` : 'Nothing logged yesterday to compare.'}</p></div>
    </div>
    <div class="cc-actions"><button type="button" data-action="copy-summary">Copy today’s numbers</button><button type="button" data-action="day-prev">Look at yesterday</button></div>
  </article>`
}
function renderHome() {
  const s = scoped(), p = profile(), t = targets(), food = dayTotal(s), activity = dayActivity(s, selectedDate, p)
  const water = (s.water || []).filter(item => item.date === selectedDate).reduce((sum, item) => sum + (Number(item.ml) || 0), 0)
  const burned = burnedEstimate(activity, s)
  const adjust = state.settings.calorieAdjust !== false
  const goal = t ? t.calorieTarget : 0
  const remaining = goal ? Math.round(goal - food.kcal + (adjust ? burned : 0)) : 0
  const percent = goal ? food.kcal / goal * 100 : 0
  const entries = weightEntries(s, selectedDate)
  const lastWeight = entries.length ? Number(entries[entries.length - 1].kg) : Number(p.weightKg) || 0
  const change = weightChange(s, selectedDate)
  const series = weeklySeries(s, selectedDate, p, 7)
  const meals = dayMeals(s)
  const streak = loggingStreak([...(s.meals || []).map(item => item.date), ...(s.activities || []).map(item => item.date), ...(s.water || []).map(item => item.date)])
  const badges = achievements({
    meals: (s.meals || []).length, steps: activity.steps, streak,
    workouts: (s.activities || []).filter(item => !item.stepsOnly).length,
    waters: (s.water || []).filter(item => item.date === selectedDate).length,
    weights: (s.weights || []).length, sleepNights: (s.sleeps || []).length,
  })
  const tip = TIPS[new Date(`${selectedDate}T12:00:00`).getDate() % TIPS.length]
  const stepPercent = p.stepGoal ? activity.steps / p.stepGoal * 100 : 0
  const waterPercent = p.waterGoalMl ? water / p.waterGoalMl * 100 : 0
  const isToday = selectedDate === todayISO()
  const hero = !t
    ? `<section class="hero-cal"><div class="hero-copy"><p class="hero-label">Get started</p><div class="hero-num">Set up<small>your profile</small></div><p class="hero-sub">Add your age, height and weight to unlock a daily calorie goal. Everything else already works.</p></div><div class="hero-cta"><button type="button" data-action="go-profile">Set up profile</button></div></section>`
    : `<section class="hero-cal">
        <div class="hero-ring">${calorieRing(percent)}<div class="hero-ring__label"><b>${Math.round(clamp(percent, 0, 100))}%</b><span>of goal</span></div></div>
        <div class="hero-copy"><p class="hero-label">Calories remaining</p><div class="hero-num">${nfmt(Math.abs(remaining))}<small>kcal${remaining < 0 ? ' over' : ''}</small></div><p class="hero-sub">${adjust ? 'Exercise is added back to your goal.' : 'Exercise is tracked but not added back.'}</p>
          <div class="hero-parts"><div class="hero-part"><span>Goal</span><b>${nfmt(goal)}</b></div><div class="hero-part"><span>Food</span><b>${nfmt(food.kcal)}</b></div><div class="hero-part"><span>Exercise</span><b>${nfmt(burned)}</b></div></div>
        </div>
        <div class="hero-cta"><button type="button" data-action="add-to-slot" data-slot="Snack">＋ Add food</button><button class="ghost" type="button" data-tab="food">Open diary</button></div>
      </section>`
  return `<div class="home">
    <div class="home-head"><div><h2>${greetingWord()}, ${esc(p.name || 'there')}</h2><p>${esc(dfmt(selectedDate))}${isToday ? ' · today' : ''} · ${streak}-day streak</p></div>
      <div class="home-daynav"><button type="button" data-action="day-prev" aria-label="Previous day">‹</button><span>${isToday ? 'Today' : esc(dfmt(selectedDate).split(',')[0])}</span><button type="button" data-action="day-next" aria-label="Next day">›</button></div></div>
    ${hero}
    ${homeGlanceCard(s, t, food, activity)}
    <div class="stat-tiles">
      <div class="tile tile--good"><div class="tile__top"><span class="tile__label">Steps</span><span class="tile__ico"><svg viewBox="0 0 24 24"><path d="M4 20c2 0 3-1 3-3V8a3 3 0 0 1 6 0v9c0 2 1 3 3 3"/><path d="M4 14h5M15 10h5"/></svg></span></div><div class="tile__num">${nfmt(Math.max(0, activity.steps))}<small>steps</small></div>${progressBar(Math.max(0, activity.steps), p.stepGoal, true)}<div class="tile__foot"><span>${nfmt(Math.max(0, p.stepGoal - activity.steps))} to goal</span><span>${Math.round(clamp(stepPercent, 0, 100))}%</span></div></div>
      <div class="tile"><div class="tile__top"><span class="tile__label">Burned</span><span class="tile__ico"><svg viewBox="0 0 24 24"><path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.7 1.3-3.6"/><path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-6-12-3 6-6 8-6 12a6 6 0 0 0 6 6Z"/></svg></span></div><div class="tile__num">${nfmt(burned)}<small>kcal</small></div><div class="tile__foot"><span>${nfmt(activity.workouts.length)} session${activity.workouts.length === 1 ? '' : 's'}</span><span>${nfmt(activity.trainingLoad)} MET·min</span></div></div>
      <div class="tile"><div class="tile__top"><span class="tile__label">Water</span><span class="tile__ico"><svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/></svg></span></div><div class="tile__num">${formatWater(water, unitsPref())}<small>/ ${formatWater(p.waterGoalMl, unitsPref())}</small></div>${progressBar(water, p.waterGoalMl, true)}<div class="tile__actions">${(state.settings.waterPresets || [250, 500, 750]).slice(0, 2).map(ml => `<button type="button" data-action="water-quick" data-ml="${ml}">＋ ${formatWater(ml, unitsPref())}</button>`).join('')}</div></div>
      <div class="tile ${change === null ? '' : (p.goal === 'gain' ? change >= 0 : change <= 0) ? 'tile--good' : 'tile--warn'}"><div class="tile__top"><span class="tile__label">Weight</span><span class="tile__ico"><svg viewBox="0 0 24 24"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg></span></div><div class="tile__num">${lastWeight ? formatWeight(lastWeight, unitsPref()) : '—'}</div><div class="tile__foot"><span>${change === null ? 'Log a second weigh-in' : `${change > 0 ? '+' : ''}${formatWeight(Math.abs(change), unitsPref())} vs last`}</span></div><div class="tile__actions"><button type="button" data-tab="health">Log weight</button></div></div>
    </div>
    ${walkCardHtml()}
    <section class="cc-card"><h3>Quick log</h3><p>Add the small things without leaving the dashboard.</p>
      <div class="quick-chips">${(state.settings.waterPresets || [250, 500, 750]).map(ml => `<button type="button" data-action="water-quick" data-ml="${ml}">💧 + ${formatWater(ml, unitsPref())}</button>`).join('')}<button type="button" data-action="add-to-slot" data-slot="Snack">🍽️ Add food</button><button type="button" data-tab="activity">🏃 Log workout</button><button type="button" data-action="focus-food-search">🔍 Search foods</button></div>
      <div class="cc-fields three" style="margin-top:14px">
        <form class="cc-form" id="quick-weight-form"><label class="cc-field"><span>Weight (${unitsPref() === 'imperial' ? 'lb' : 'kg'})</span><input name="weight" type="number" min="1" step="0.1" required placeholder="${unitsPref() === 'imperial' ? '150' : '68'}"></label><div class="cc-actions"><button type="submit">Save weight</button></div></form>
        <form class="cc-form" id="quick-steps-form"><label class="cc-field"><span>Add steps</span><input name="steps" type="number" min="1" max="100000" required placeholder="2500"></label><div class="cc-actions"><button type="submit">Save steps</button></div></form>
        <form class="cc-form" id="quick-water-form"><label class="cc-field"><span>Water (${unitsPref() === 'imperial' ? 'oz' : 'ml'})</span><input name="water" type="number" min="1" required value="${unitsPref() === 'imperial' ? '8' : '250'}"></label><div class="cc-actions"><button type="submit">Log drink</button></div></form>
      </div></section>
    <section class="cc-card"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Today’s meals</h3><p class="cc-small" style="margin:2px 0 0">${nfmt(food.kcal)} kcal logged${goal ? ` of ${nfmt(goal)}` : ''}</p></div><button type="button" class="primary" data-tab="food">Open diary</button></div>
      <div class="slot-list">${SLOT_ORDER.map(slot => {
        const items = meals.filter(item => normalizeSlot(item.slot || 'Snack') === slot)
        const kcal = Math.round(items.reduce((sum, item) => sum + mealKcalOf(item), 0))
        const names = items.map(item => item.name).join(', ') || 'Nothing logged yet'
        return `<div class="slot"><span class="slot__ico">${SLOT_ICONS[slot]}</span><div><div class="slot__name">${slot === 'Snack' ? 'Snacks' : slot}</div><div class="slot__items">${esc(names)}</div></div><span class="slot__kcal">${nfmt(kcal)} kcal</span><button type="button" class="slot__add" data-action="add-to-slot" data-slot="${slot}" aria-label="Add food to ${slot}">＋</button></div>`
      }).join('')}</div></section>
    <div class="streak-strip">
      <div class="streak-item"><span>Logging streak</span><b>${streak} day${streak === 1 ? '' : 's'}</b></div>
      <div class="streak-item"><span>Week average</span><b>${nfmt(series.reduce((sum, item) => sum + item.calories, 0) / Math.max(1, series.filter(item => item.calories).length))} kcal</b></div>
      <div class="streak-item"><span>Best step day</span><b>${nfmt(Math.max(0, ...series.map(item => item.steps)))}</b></div>
    </div>
    <section class="cc-card"><h3>This week</h3><p class="cc-small">Calories eaten and steps walked over the last seven days.</p>
      <div class="cc-fields" style="margin-top:10px"><div><p class="cc-small cc-muted" style="margin:0 0 4px">CALORIES</p>${miniBars(series, 'calories', Math.max(1200, ...series.map(item => item.calories)), ' kcal')}</div><div><p class="cc-small cc-muted" style="margin:0 0 4px">STEPS</p>${miniBars(series, 'steps', Math.max(2000, ...series.map(item => item.steps)))}</div></div>
      <div class="cc-actions"><button type="button" data-tab="trends">See full progress</button></div></section>
    <div class="cc-card"><h3>Achievements</h3><div class="badge-row" style="margin-top:10px">${badges.map(item => `<span class="badge ${item.done ? 'on' : ''}">${esc(item.label)}</span>`).join('')}</div></div>
    ${state.settings.tips === false ? '' : `<div class="tip-bar"><span>💡</span><span><b>Tip:</b> ${esc(tip)}</span></div>`}
    ${gettingStartedCard(t, meals.length)}
    ${t ? '' : `<article class="cc-card"><h3>Body details</h3>${setupProfileForm()}</article>`}
  </div>`
}
function allFoods() { return [...FOODS,...(state.customFoods||[])] }
function foodResult(food) {
  const grams = Number(food.serv?.[0]?.[1]) || 100
  const fav = (state.favorites || []).includes(food.id)
  const presets = (food.serv || []).slice(0, 3).map(([label, amount]) => `<button type="button" class="food-preset" data-action="food-preset" data-id="${esc(food.id)}" data-grams="${amount}">${esc(label)}</button>`).join('')
  return `<article class="food-result"><div><h4>${esc(food.name)}</h4><small>${esc(food.cat || 'Custom')} · ${nfmt(food.kcal)} kcal / 100 g · P ${round1(food.p)} · C ${round1(food.c)} · F ${round1(food.f)}</small>${presets ? `<div class="food-presets">${presets}</div>` : ''}</div><div class="food-result__controls"><input aria-label="Grams for ${esc(food.name)}" id="grams-${esc(food.id)}" type="number" min="1" max="5000" value="${grams}" inputmode="decimal"><small>grams</small><button type="button" data-action="meal-add" data-id="${esc(food.id)}">Add</button><button type="button" class="food-star ${fav ? 'on' : ''}" data-action="food-fav" data-id="${esc(food.id)}" aria-label="${fav ? 'Remove from favorites' : 'Save to favorites'}" aria-pressed="${fav}">${fav ? '★' : '☆'}</button></div></article>`
}
// Sorting the shortlist by nutrient density is more useful than alphabetical
// order when the question is "what should I eat to hit protein today?".
function sortFoods(list) {
  if (foodSort === 'name') return list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  if (['protein', 'fiber', 'lowSugar'].includes(foodSort)) return rankFoods(list, foodSort, 60)
  return list
}
function renderFoodResults() {
  const host = $('#food-results', root); if (!host) return
  let pool = allFoods()
  if (foodFilter === 'favorites') pool = pool.filter(item => (state.favorites || []).includes(item.id))
  if (foodCategory) pool = pool.filter(item => item.cat === foodCategory)
  // While searching, relevance beats a ranking the user did not ask for.
  const searching = Boolean(foodQuery.trim())
  const hits = searching ? searchFoods(foodQuery, pool) : sortFoods(pool)
  host.innerHTML = hits.slice(0, searching ? 36 : 18).map(foodResult).join('') || empty(foodFilter === 'favorites' ? 'No favorites yet. Tap the star on any food to save it here.' : 'No food match. Try fewer words or add it as a custom food.')
}
const normalizeSlot = slot => (SLOT_ORDER.includes(slot) ? slot : 'Snack')
function slotItems(meals, slot) { return meals.filter(item => normalizeSlot(item.slot || 'Snack') === slot) }
function slotKcalOf(meals, slot) { return Math.round(slotItems(meals, slot).reduce((sum, item) => sum + mealKcalOf(item), 0)) }
function renderDiary() {
  const s = scoped(), meals = dayMeals(s), total = dayTotal(s), t = targets(), plans = s.mealPlans.filter(item => item.date === selectedDate)
  const goals = { fiber: Number(state.settings.fiberGoal) || 30, sugar: Number(state.settings.sugarGoal) || 50, sodium: Number(state.settings.sodiumGoal) || 2300 }
  const templates = s.templates || []
  const slotBlock = slot => {
    const items = slotItems(meals, slot)
    return `<section class="diary-slot"><div class="diary-slot__head"><div class="diary-slot__title"><span aria-hidden="true">${SLOT_ICONS[slot]}</span>${slot === 'Snack' ? 'Snacks' : slot}</div><div style="display:flex;align-items:center;gap:10px"><span class="diary-slot__kcal">${nfmt(slotKcalOf(meals, slot))} kcal</span><button class="cc-button primary" type="button" data-action="add-to-slot" data-slot="${slot}">＋ Add</button></div></div>
      <div class="diary-slot__body">
        ${items.length ? `<div class="cc-list">${items.map(item => `<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${nfmt(item.grams)} g · ${nfmt(mealKcalOf(item))} kcal${item.note ? ` · ${esc(item.note)}` : ''}${item.source ? ` · ${esc(item.source)}` : ''}</small></span><span style="display:flex;gap:6px;align-items:center"><button type="button" data-action="meal-duplicate" data-id="${esc(item.id)}" aria-label="Log ${esc(item.name)} again">＋</button><button type="button" data-action="remove-record" data-collection="meals" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">×</button></span></div>`).join('')}</div>` : `<p class="cc-small cc-muted" style="margin:12px 0 0">Nothing logged for ${slot.toLowerCase()} yet.</p>`}
        <form class="cc-form slot-form" id="slot-quick-form-${slot}" data-slot="${slot}"><div class="cc-fields"><label class="cc-field"><span>Quick add (kcal)</span><input name="kcal" type="number" min="1" max="5000" placeholder="350"></label><label class="cc-field"><span>What was it?</span><input name="name" maxlength="60" placeholder="Optional name"></label><label class="cc-field"><span>Protein g (optional)</span><input name="p" type="number" min="0" max="500" step=".1"></label><label class="cc-field"><span>Carbs g</span><input name="c" type="number" min="0" max="900" step=".1"></label><label class="cc-field"><span>Fat g</span><input name="f" type="number" min="0" max="500" step=".1"></label></div><div class="cc-actions"><button type="submit">Add calories</button><button type="button" data-action="slot-save-template" data-slot="${slot}">Save ${slot.toLowerCase()} as template</button></div></form>
      </div></section>`
  }
  return `${heading('Diary', `Everything you ate on ${dfmt(selectedDate).toLowerCase()}. Search, scan or add a custom food.`)}<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Energy and macros</h3><small class="cc-muted">${meals.length} logged item${meals.length === 1 ? '' : 's'}${t ? ` · target ${nfmt(t.calorieTarget)} kcal` : ''}</small></div><span class="cc-chip">${nfmt(total.kcal)} kcal${t ? ` / ${nfmt(t.calorieTarget)}` : ''}</span></div>${t ? progressBar(total.kcal, t.calorieTarget) : ''}<div class="cc-macros">${[['Protein', total.protein, t?.protein], ['Carbs', total.carbs, t?.carbs], ['Fat', total.fat, t?.fat]].map(([label, value, goal]) => `<div class="cc-macro"><b>${round1(value)} <small>g</small></b><span>${label}${goal ? ` · ${nfmt(goal)} g target` : ''}</span>${goal ? progressBar(value, goal) : ''}</div>`).join('')}</div>
      <div class="cc-fields three" style="margin-top:14px">
        <div><p class="cc-small cc-muted" style="margin:0 0 4px">FIBER · ${round1(total.fiber)} / ${nfmt(goals.fiber)} g</p>${progressBar(total.fiber, goals.fiber, true)}</div>
        <div><p class="cc-small cc-muted" style="margin:0 0 4px">SUGAR · ${round1(total.sugar)} / ${nfmt(goals.sugar)} g</p>${progressBar(total.sugar, goals.sugar)}</div>
        <div><p class="cc-small cc-muted" style="margin:0 0 4px">SODIUM · ${nfmt(total.sodium)} / ${nfmt(goals.sodium)} mg</p>${progressBar(total.sodium, goals.sodium)}</div>
      </div><p class="cc-small">Food values are estimates. Your actual meal depends on ingredients and preparation.</p></article>
    <h3 class="cc-card--wide" style="margin:6px 0 -4px;font:800 20px Inter,sans-serif">Meals</h3>
    <div class="cc-card--wide diary-slots">${SLOT_ORDER.map(slotBlock).join('')}</div>
    <article class="cc-card cc-card--wide"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Find food</h3><small class="cc-muted" id="pending-slot">Adding to ${esc(pendingSlot || 'Snack')}</small></div><div class="seg"><button type="button" data-action="food-filter" data-filter="all" class="${foodFilter === 'favorites' ? '' : 'on'}">All</button><button type="button" data-action="food-filter" data-filter="favorites" class="${foodFilter === 'favorites' ? 'on' : ''}">★ Favorites</button></div></div>
      <div class="cc-fields"><label class="cc-field"><span>Order the list</span><select data-food-sort><option value="protein" ${foodSort === 'protein' ? 'selected' : ''}>Most protein per 100 kcal</option><option value="fiber" ${foodSort === 'fiber' ? 'selected' : ''}>Most fiber per 100 kcal</option><option value="lowSugar" ${foodSort === 'lowSugar' ? 'selected' : ''}>Least sugar per 100 kcal</option><option value="name" ${foodSort === 'name' ? 'selected' : ''}>Name A–Z</option></select></label><label class="cc-field"><span>Search food</span><input id="food-search" type="search" value="${esc(foodQuery)}" placeholder="Try dal, rice, apple…" autocomplete="off"></label><label class="cc-field"><span>Category</span><select id="food-category"><option value="">All categories</option>${FOOD_CATEGORIES.map(category => `<option ${foodCategory === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label></div><div id="food-results" class="food-results"></div><div class="cc-actions"><button type="button" data-action="food-focus">Search</button><button type="button" data-action="copy-yesterday">Copy yesterday’s meals</button></div><form class="cc-form" id="copy-day-form"><label class="cc-field"><span>Or copy every meal from another day</span><input name="date" type="date" max="${todayISO()}" value="${esc(copySourceDate || previousDay(selectedDate))}"></label><div class="cc-actions"><button type="submit">Copy that day</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Barcode lookup</h3><p>Enter the barcode or scan it with a supported camera. Online lookups use Open Food Facts.</p><form class="cc-form" id="barcode-form"><label class="cc-field"><span>Barcode (EAN / UPC)</span><input name="barcode" id="barcode-input" inputmode="numeric" pattern="[0-9]{8,14}" placeholder="Scan or type the number"></label><div class="cc-actions"><button class="primary" type="submit">Look up product</button><button type="button" data-action="barcode-start">Scan</button></div></form><video id="barcode-video" class="cc-camera-video" playsinline muted hidden></video><div id="barcode-status" class="cc-small cc-muted" aria-live="polite"></div><div id="barcode-result"></div></article>
    <article class="cc-card cc-card--third"><h3>Add a custom food</h3><p>Enter label values per 100 g. This stays on your device.</p><form class="cc-form" id="custom-food-form"><div class="cc-fields"><label class="cc-field"><span>Name</span><input name="name" required maxlength="80"></label><label class="cc-field"><span>Category</span><input name="cat" value="Custom" maxlength="32"></label><label class="cc-field"><span>kcal / 100 g</span><input name="kcal" type="number" min="0" max="900" required step=".1"></label><label class="cc-field"><span>Protein g</span><input name="p" type="number" min="0" max="100" step=".1"></label><label class="cc-field"><span>Carbs g</span><input name="c" type="number" min="0" max="100" step=".1"></label><label class="cc-field"><span>Fat g</span><input name="f" type="number" min="0" max="100" step=".1"></label></div><details><summary class="cc-muted cc-small">More label nutrients</summary><div class="cc-fields"><label class="cc-field"><span>Fiber g</span><input name="fi" type="number" min="0" step=".1"></label><label class="cc-field"><span>Sugar g</span><input name="su" type="number" min="0" step=".1"></label><label class="cc-field"><span>Sodium mg</span><input name="na" type="number" min="0" step="1"></label></div></details><div class="cc-actions"><button class="primary" type="submit">Save custom food</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Recipes & templates</h3><form class="cc-form" id="recipe-form"><label class="cc-field"><span>Recipe name</span><input name="name" maxlength="80" required placeholder="My lunch bowl"></label><div class="cc-fields"><label class="cc-field"><span>kcal / serving</span><input name="kcal" type="number" min="0" required></label><label class="cc-field"><span>Protein g</span><input name="p" type="number" min="0"></label><label class="cc-field"><span>Carbs g</span><input name="c" type="number" min="0"></label><label class="cc-field"><span>Fat g</span><input name="f" type="number" min="0"></label></div><div class="cc-actions"><button type="submit">Save recipe</button></div></form>
      ${(templates || []).length ? `<div class="cc-list">${templates.slice().reverse().map(template => `<div class="cc-list-item"><span><b>${esc(template.name)}</b><small>${esc(template.slot)} · ${nfmt(template.kcal)} kcal · ${(template.items || []).length} item${(template.items || []).length === 1 ? '' : 's'}</small></span><span style="display:flex;gap:6px"><button type="button" data-action="template-apply" data-id="${esc(template.id)}">＋ Log</button><button type="button" data-action="template-delete" data-id="${esc(template.id)}" aria-label="Delete template">×</button></span></div>`).join('')}</div>` : `<p class="cc-small cc-muted">Save a meal slot as a template and it will appear here.</p>`}
      ${(s.recipes || []).length ? `<div class="cc-list">${s.recipes.slice(-4).reverse().map(recipe => `<div class="cc-list-item"><span><b>${esc(recipe.name)}</b><small>${nfmt(recipe.kcal)} kcal / serving</small></span><button type="button" data-action="recipe-add" data-id="${esc(recipe.id)}">＋ Add</button></div>`).join('')}</div>` : ''}</article>
    <article class="cc-card cc-card--third"><h3>Foods you log most</h3>${frequentFoods(s.meals).map(item => `<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${item.count} logged${item.kcal ? ` · ~${nfmt(item.kcal)} kcal` : ''}</small></span><button type="button" data-action="food-quick" data-name="${esc(item.name)}" data-grams="${item.grams || 100}" data-slot="${esc(item.slot || 'Snack')}">＋ Add</button></div>`).join('') || empty('Log a few meals and your usual foods will appear here.')}<div style="margin-top:14px"><h4>Recent meals</h4>${recentMeals(s.meals).map(item => `<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.date)} · ${esc(item.slot)} · ${nfmt(item.grams)} g · ${nfmt(item.kcal)} kcal</small></span><button type="button" data-action="meal-duplicate" data-id="${esc(item.id)}">＋ Log</button></div>`).join('') || empty('Meals you log will show up here.')}</div></article>
    <article class="cc-card cc-card--third"><h3>Plan ahead</h3><form class="cc-form" id="plan-form"><div class="cc-fields"><label class="cc-field"><span>Date</span><input name="date" type="date" value="${esc(selectedDate)}" required></label><label class="cc-field"><span>Meal / note</span><input name="name" maxlength="100" required placeholder="Lentil soup and bread"></label><label class="cc-field"><span>Estimated kcal</span><input name="kcal" type="number" min="0" max="10000"></label></div><div class="cc-actions"><button class="primary" type="submit">Add to plan</button></div></form>${plans.length ? `<div class="cc-list">${plans.map(item => `<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.slot || 'Planned meal')}${item.kcal ? ` · ${nfmt(item.kcal)} kcal` : ''}</small></span><button type="button" data-action="remove-record" data-collection="mealPlans" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>` : empty('No planned meals for this day.')}</article>
    <article class="cc-card cc-card--third"><h3>By meal</h3>${slotBreakdown(meals).filter(item => item.count).map(item => `<div class="cc-row"><span>${esc(item.slot)}</span><strong>${nfmt(item.kcal)} kcal</strong></div>`).join('') || empty('Add food to see a per-meal breakdown.')}<div class="cc-actions"><button type="button" data-action="print-report">Print diary</button><button type="button" data-action="export-meals">Download CSV</button></div></article>
  </div>`
}
function renderActivity() {
  const s=scoped(),activity=dayActivity(s,selectedDate,profile()),t=targets(),zone=heartRateZone(s.vitals.find(item=>item.date===selectedDate)?.hr,profile().age)
  const logs=activity.workouts.slice().reverse(),synced=s.healthImports.find(item=>item.date===selectedDate)
  return `${heading('Movement','Log steps, walks, workouts and strength sessions. Calories are estimates.')}<div class="tracker-grid">
    ${synced?`<article class="cc-card cc-card--wide"><h3>Health Connect · ${esc(dfmt(selectedDate))}</h3><div class="cc-fields three">${synced.steps!=null?nutrientLine('Device steps',synced.steps):''}${synced.distanceKm!=null?nutrientLine('Distance',round1(synced.distanceKm),'km'):''}${synced.caloriesBurned!=null?nutrientLine('Active calories',round1(synced.caloriesBurned),'kcal'):''}${synced.hr!=null?nutrientLine('Average heart rate',synced.hr,'bpm'):''}${synced.sleepHours!=null?nutrientLine('Sleep',synced.sleepHours,'h'):''}${synced.weightKg!=null?nutrientLine('Weight',synced.weightKg,'kg'):''}${synced.bodyFat!=null?nutrientLine('Body fat',synced.bodyFat,'%'):''}${synced.spo2!=null?nutrientLine('Oxygen saturation',synced.spo2,'%'):''}${synced.glucose!=null?nutrientLine('Blood glucose',synced.glucose,'mmol/L'):''}${synced.bp?nutrientLine('Blood pressure',synced.bp):''}</div><p class="cc-small">Synced ${synced.syncedAt?esc(new Date(synced.syncedAt).toLocaleString()):'from Health Connect'} · readings are provided by your connected apps and devices.</p></article>`:''}
    <article class="cc-card cc-card--third"><h3>Steps</h3><div class="cc-stat">${nfmt(activity.steps)} <small>/ ${nfmt(profile().stepGoal)}</small></div>${progressBar(activity.steps,profile().stepGoal,true)}${activity.deviceSteps !== null ? `<p class="cc-small">Source: your phone's step sensor (Health Connect) · ${nfmt(activity.deviceSteps)} device steps${activity.manualSteps ? ` · ${nfmt(activity.manualSteps)} logged by hand (not added on top, so a walk is never counted twice)` : ''}.</p>` : ''}<form class="cc-form" id="steps-form"><label class="cc-field"><span>Add steps</span><input name="steps" type="number" min="1" max="100000" required placeholder="e.g. 2500"></label><div class="cc-actions"><button class="primary" type="submit">Save steps</button></div></form><p class="cc-small">Step counting, stride and calibration live in the step accuracy card below.</p></article>
    <article class="cc-card cc-card--third"><h3>Estimated energy</h3><div class="cc-row"><span>Step energy (rough NEAT)</span><strong>~${nfmt(activity.neatCalories)} kcal</strong></div><div class="cc-row"><span>Workout energy</span><strong>~${nfmt(activity.exerciseCalories)} kcal</strong></div><div class="cc-row"><span>Training load</span><strong>${nfmt(activity.trainingLoad)} MET-min</strong></div><div class="cc-row"><span>Recent load ratio</span><strong>${acuteChronicRatio(s.activities,selectedDate)??'—'}</strong></div><p class="cc-small">These calculations are rough planning estimates, not wearable measurements or a diagnosis.</p></article>
    <article class="cc-card cc-card--third"><h3>Heart-rate zone</h3>${zone?`<div class="cc-stat">Zone ${zone.zone}<small> · ${zone.percent}% estimated max</small></div><p>${esc(zone.label)} · Estimated max ${zone.max} bpm.</p>`:`<p>Log a heart-rate reading in Health to see its estimated training zone.</p>`}<div class="cc-notice">Heart-rate zones use an age-based estimate and do not replace a measured max heart rate or clinician advice.</div></article>
    <article class="cc-card cc-card--third"><h3>Workout</h3><form class="cc-form" id="workout-form"><label class="cc-field"><span>Activity</span><select name="exercise">${EXERCISES.map(ex=>`<option value="${esc(ex.id)}">${esc(ex.name)}</option>`).join('')}</select></label><div class="cc-fields"><label class="cc-field"><span>Minutes</span><input name="minutes" type="number" min="1" max="1440" required value="30"></label><label class="cc-field"><span>Average HR (optional)</span><input name="hr" type="number" min="35" max="240" placeholder="bpm"></label></div><div class="cc-actions"><button class="primary" type="submit">Log workout</button><button type="button" data-action="walk-start">Start a walk</button></div></form><p class="cc-small">GPS runs only while you leave this screen active. It stores distance, not route coordinates.</p></article>
    <article class="cc-card cc-card--third"><h3>Strength session</h3><form class="cc-form" id="strength-form"><div class="cc-fields"><label class="cc-field"><span>Muscle group</span><select name="muscle"><option>Full body</option><option>Chest</option><option>Back</option><option>Shoulders</option><option>Arms</option><option>Legs</option><option>Core</option></select></label><label class="cc-field"><span>Exercise</span><input name="name" maxlength="60" required placeholder="Squat"></label><label class="cc-field"><span>Sets</span><input name="sets" type="number" min="1" max="50" value="3"></label><label class="cc-field"><span>Reps / set</span><input name="reps" type="number" min="1" max="500" value="10"></label><label class="cc-field"><span>Load (kg, optional)</span><input name="loadKg" type="number" min="0" max="1000" step=".5"></label><label class="cc-field"><span>Duration (min)</span><input name="minutes" type="number" min="0" max="600" value="30"></label><label class="cc-field"><span>Rest timer (sec)</span><input name="restSeconds" type="number" min="10" max="900" value="90"></label></div><div class="cc-actions"><button class="primary" type="submit">Save set log</button><button type="button" data-action="rest-start">Start rest timer</button></div><div class="cc-timer" id="rest-clock" aria-live="polite"></div></form></article>
    <article class="cc-card cc-card--wide"><h3>Movement log · ${esc(dfmt(selectedDate))}</h3>${logs.length?`<div class="cc-list">${logs.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name||'Activity')}</b><small>${nfmt(item.minutes)} min · ${item.steps?nfmt(item.steps)+' steps · ':''}${item.distanceKm?round1(item.distanceKm)+' km · ':''}${item.muscle?esc(item.muscle)+' · ':''}~${nfmt(item.calories||estimateActivityCalories(item,profile().weightKg))} kcal estimate</small></span><button data-action="remove-record" data-collection="activities" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>`:empty('No movement logged for this day.')}</article>
  </div>`
}
function renderHealth() {
  const s=scoped(),t=targets(),sleep=s.sleeps.find(item=>item.date===selectedDate),vital=s.vitals.find(item=>item.date===selectedDate),mood=s.moods.find(item=>item.date===selectedDate)
  const water=s.water.filter(item=>item.date===selectedDate).reduce((sum,item)=>sum+(Number(item.ml)||0),0),debt=sleepDebt(s.sleeps,selectedDate,profile().sleepGoalHours,7),recovery=computeRecovery(s,selectedDate,profile())
  const zone=heartRateZone(vital?.hr,profile().age),fast=s.fastingSessions.find(item=>item.profileId===profile().id&&!item.endAt),latestWeight=s.weights.filter(item=>item.date<=selectedDate).slice().sort((a,b)=>b.date.localeCompare(a.date))[0]
  return `${heading('Health log','Add only the measurements and notes you want to keep. Manual readings are not diagnoses.')}<div class="tracker-grid">
    <article class="cc-card cc-card--third"><h3>Sleep</h3><div class="cc-stat">${sleep?round1(sleep.hours):'—'} <small>${sleep?'hours':'log a night'}</small></div><form class="cc-form" id="sleep-form"><div class="cc-fields"><label class="cc-field"><span>Hours asleep</span><input name="hours" type="number" min="0" max="24" step=".1" required value="${sleep?esc(sleep.hours):''}"></label><label class="cc-field"><span>Quality (1–5)</span><select name="quality">${[1,2,3,4,5].map(x=>`<option value="${x}" ${Number(sleep?.quality||3)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="cc-field"><span>Deep (optional hours)</span><input name="deep" type="number" min="0" max="24" step=".1" value="${esc(sleep?.deep||'')}"></label><label class="cc-field"><span>REM (optional hours)</span><input name="rem" type="number" min="0" max="24" step=".1" value="${esc(sleep?.rem||'')}"></label><label class="cc-field"><span>Bedtime</span><input name="bed" type="time" value="${esc(sleep?.bed||'')}"></label><label class="cc-field"><span>Wake time</span><input name="wake" type="time" value="${esc(sleep?.wake||'')}"></label></div><div class="cc-actions"><button class="primary" type="submit">Save sleep</button></div></form><p class="cc-small">Sleep stages must be entered from another source; this app does not measure them.</p><div class="cc-row"><span>7-day sleep debt</span><strong>${debt.nights?`${debt.hours} h`:'—'}</strong></div></article>
    <article class="cc-card cc-card--third"><h3>Vitals & glucose</h3><form class="cc-form" id="vitals-form"><div class="cc-fields three"><label class="cc-field"><span>Heart rate bpm</span><input name="hr" type="number" min="25" max="250" value="${esc(vital?.hr||'')}"></label><label class="cc-field"><span>Resting HR</span><input name="rhr" type="number" min="25" max="200" value="${esc(vital?.rhr||'')}"></label><label class="cc-field"><span>HRV ms</span><input name="hrv" type="number" min="1" max="500" value="${esc(vital?.hrv||'')}"></label><label class="cc-field"><span>SpO₂ %</span><input name="spo2" type="number" min="50" max="100" value="${esc(vital?.spo2||'')}"></label><label class="cc-field"><span>Blood pressure</span><input name="bp" maxlength="12" placeholder="120/80" value="${esc(vital?.bp||'')}"></label><label class="cc-field"><span>Temperature °C</span><input name="temp" type="number" min="30" max="45" step=".1" value="${esc(vital?.temp||'')}"></label><label class="cc-field"><span>Glucose mmol/L</span><input name="glucose" type="number" min="1" max="40" step=".1" value="${esc(vital?.glucose||'')}"></label><label class="cc-field"><span>Breathing / min</span><input name="respiration" type="number" min="1" max="80" value="${esc(vital?.respiration||'')}"></label></div><div class="cc-actions"><button class="primary" type="submit">Save manual readings</button></div></form>${zone?`<p class="cc-small">Current HR falls in estimated zone ${zone.zone} · ${zone.label}.</p>`:''}<p class="cc-small">No sensor is connected. This screen stores values you enter; it does not measure ECG, EDA, blood pressure or glucose.</p></article>
    <article class="cc-card cc-card--third"><h3>Recovery estimate</h3><div class="cc-stat">${recovery.score??'—'} <small>${recovery.score===null?' / 100 · add sleep and energy':' / 100'}</small></div><div class="cc-row"><span>Sleep signal</span><strong>${recovery.sleepScore===null?'—':`${Math.round(recovery.sleepScore)} / 100`}</strong></div><div class="cc-row"><span>Energy signal</span><strong>${recovery.energyScore===null?'—':`${Math.round(recovery.energyScore)} / 100`}</strong></div><div class="cc-row"><span>Resting HR signal</span><strong>${recovery.rhrScore===null?'—':`${Math.round(recovery.rhrScore)} / 100`}</strong></div><form class="cc-form" id="mood-form"><div class="cc-fields"><label class="cc-field"><span>Mood</span><select name="mood"><option>Okay</option><option>Good</option><option>Low</option><option>Anxious</option><option>Stressed</option><option>Great</option></select></label><label class="cc-field"><span>Energy (1–5)</span><select name="energy">${[1,2,3,4,5].map(x=>`<option value="${x}" ${Number(mood?.energy||3)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="cc-field"><span>Stress (1–5)</span><select name="stress">${[1,2,3,4,5].map(x=>`<option value="${x}" ${Number(mood?.stress||3)===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="cc-field"><span>Symptoms / note</span><input name="note" maxlength="180" value="${esc(mood?.note||'')}" placeholder="Optional"></label></div><div class="cc-actions"><button type="submit">Save check-in</button></div></form><p class="cc-small">This is a personal reflection aid, not a clinical readiness measure.</p></article>
    <article class="cc-card cc-card--third"><h3>Hydration</h3><div class="cc-stat">${formatWater(water,unitsPref())} <small>/ ${formatWater(profile().waterGoalMl,unitsPref())}</small></div>${progressBar(water,profile().waterGoalMl,true)}<form class="cc-form" id="water-form"><div class="cc-fields"><label class="cc-field"><span>Amount (${unitsPref()==='imperial'?'oz':'ml'})</span><input name="ml" type="number" min="1" max="${unitsPref()==='imperial'?'169':'5000'}" step="${unitsPref()==='imperial'?'1':'50'}" required value="${unitsPref()==='imperial'?'8':'250'}"></label><label class="cc-field"><span>Drink</span><input name="name" maxlength="40" value="Water"></label></div><div class="cc-actions"><button class="primary" type="submit">Log drink</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Body & cycle</h3><form class="cc-form" id="weight-form"><div class="cc-fields"><label class="cc-field"><span>Weight (kg)</span><input name="kg" type="number" min="20" max="500" step=".1" required placeholder="e.g. 68"></label><label class="cc-field"><span>Body fat % (optional)</span><input name="bodyFat" type="number" min="1" max="75" step=".1"></label></div><div class="cc-actions"><button type="submit">Log body measurement</button></div></form><div class="cc-row"><span>7-day average weight</span><strong>${weightTrend(s.weights,selectedDate,7)??'—'} kg</strong></div>${latestWeight?.bodyFat?`<div class="cc-row"><span>Latest body fat entry</span><strong>${round1(latestWeight.bodyFat)}%</strong></div>`:''}<form class="cc-form" id="cycle-form"><label class="cc-field"><span>Cycle start date (optional)</span><input name="date" type="date" value="${esc(selectedDate)}"></label><label class="cc-field"><span>Note</span><input name="note" maxlength="100" placeholder="Optional symptoms / flow note"></label><div class="cc-actions"><button type="submit">Log cycle note</button></div></form>${s.cycleLogs.length?`<div class="cc-list">${s.cycleLogs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(item=>`<div class="cc-list-item"><span><b>${esc(item.date)}</b><small>${esc(item.note||'Cycle start')}</small></span></div>`).join('')}</div>`:''}<p class="cc-small">Cycle predictions are not included; dates are private notes only.</p></article>
    <article class="cc-card cc-card--third"><h3>Symptoms</h3><form class="cc-form" id="symptom-form"><div class="cc-fields"><label class="cc-field"><span>Symptom</span><input name="name" required maxlength="60" placeholder="Headache"></label><label class="cc-field"><span>Severity (1&ndash;5)</span><select name="severity">${[1,2,3,4,5].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label><label class="cc-field"><span>Note</span><input name="note" maxlength="120" placeholder="Optional"></label></div><div class="cc-actions"><button type="submit">Save symptom</button></div></form>${recentSymptoms(s.symptoms).map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.date)}${item.severity?` &middot; severity ${item.severity}/5`:''}${item.note?` &middot; ${esc(item.note)}`:''}</small></span></div>`).join('')||empty('Symptoms you log will appear here.')}<p class="cc-small">Personal notes only. This app does not diagnose or suggest treatment.</p></article>
    <article class="cc-card cc-card--third"><h3>7-day averages</h3>${(()=>{const a=weeklyAverages(s,selectedDate,profile().id);return nutrientLine('Food energy',a.kcal??0,'kcal')+nutrientLine('Water',a.waterMl??0,'ml')+nutrientLine('Sleep',a.sleepHours??0,'h')+nutrientLine('Weight',a.weightKg??0,'kg')+`<p class="cc-small">Averages use only days with entries: ${a.kcalDays} food, ${a.sleepDays} sleep, ${a.waterDays} water, ${a.weightDays} weight. Blank days are not counted as zero.</p>`})()}</article>
    <article class="cc-card cc-card--third"><h3>Fasting timer</h3><div id="fasting-clock" class="cc-timer">${fast?.startAt?'00:00:00':'Ready'}</div>${fast?`<p>Started ${new Date(fast.startAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Only elapsed time is tracked.</p><div class="cc-actions"><button class="primary" data-action="fasting-stop">End fast</button></div>`:`<p>Timer records elapsed time only; it does not predict health benefits.</p><div class="cc-actions"><button class="primary" data-action="fasting-start">Start fasting timer</button></div>`}</article>
    <article class="cc-card cc-card--wide"><h3>Medicines, supplements & labs</h3><div class="cc-fields"><form class="cc-form" id="supplement-form"><label class="cc-field"><span>Medicine or supplement</span><input name="name" required maxlength="80" placeholder="Name only — no dosage advice"></label><label class="cc-field"><span>Reminder time (optional)</span><input name="time" type="time"></label><div class="cc-actions"><button type="submit">Save reminder note</button></div></form><form class="cc-form" id="lab-form"><div class="cc-fields"><label class="cc-field"><span>Lab test / custom metric</span><input name="name" required maxlength="70" placeholder="e.g. Ferritin"></label><label class="cc-field"><span>Value</span><input name="value" required maxlength="30"></label><label class="cc-field"><span>Unit</span><input name="unit" maxlength="20"></label><label class="cc-field"><span>Reference range / note</span><input name="note" maxlength="80"></label></div><div class="cc-actions"><button type="submit">Save personal result</button></div></form></div><label class="cc-field"><span>Photo of a lab report · OCR stays on this device</span><input type="file" id="lab-report-photo" accept="image/*" capture="environment"></label><div id="lab-ocr-status" class="cc-small cc-muted" aria-live="polite"></div>${s.labResults.length?`<div class="cc-list">${s.labResults.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)} · ${esc(item.value)} ${esc(item.unit||'')}</b><small>${esc(item.date)}${item.note?` · ${esc(item.note)}`:''}</small></span></div>`).join('')}</div>`:empty('Personal lab notes will appear here.') }<p class="cc-small">OCR suggests a result to review; it never saves automatically or interprets a diagnosis. Always compare it with the original report.</p></article>
  </div>`
}
function weightChartSvg(entries) {
  if (entries.length < 1) return empty('Log your weight a couple of times to see a trend.')
  const goal = Number(profile().goalWeightKg) || 0
  const values = entries.map(item => Number(item.kg))
  const all = goal ? [...values, goal] : values
  const min = Math.min(...all) - 0.6, max = Math.max(...all) + 0.6
  const span = Math.max(0.6, max - min)
  const w = 640, h = 180, pad = 16
  const x = index => entries.length === 1 ? w / 2 : pad + index * (w - pad * 2) / (entries.length - 1)
  const y = value => h - pad - ((value - min) / span) * (h - pad * 2)
  const points = entries.map((item, index) => `${x(index).toFixed(1)},${y(Number(item.kg)).toFixed(1)}`).join(' ')
  const goalLine = goal ? `<line x1="${pad}" x2="${w - pad}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--mfp-orange)" stroke-dasharray="6 6" stroke-width="2"/><text x="${pad}" y="${Math.max(12, y(goal) - 6)}" fill="var(--mfp-orange)" font-size="11">Goal ${formatWeight(goal, unitsPref())}</text>` : ''
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Weight trend" style="width:100%;height:auto;margin-top:8px">${goalLine}<polyline points="${points}" fill="none" stroke="var(--mfp-blue)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${entries.map((item, index) => `<circle cx="${x(index)}" cy="${y(Number(item.kg))}" r="4" fill="var(--mfp-blue)"/>`).join('')}<text x="${pad}" y="14" fill="var(--mfp-muted)" font-size="11">${formatWeight(max, unitsPref())}</text><text x="${pad}" y="${h - 3}" fill="var(--mfp-muted)" font-size="11">${formatWeight(min, unitsPref())}</text></svg>`
}
function renderProgress() {
  const s = scoped(), p = profile(), t = targets(), days = progressRange
  const series = weeklySeries(s, selectedDate, p, days)
  const goal = t
  const calorieDays = series.filter(item => item.calories > 0)
  const targetHit = goal ? calorieDays.filter(item => Math.abs(item.calories - goal.calorieTarget) <= goal.calorieTarget * 0.1).length : 0
  const stepDays = series.filter(item => item.steps > 0)
  const stepGoalDays = stepDays.filter(item => item.steps >= p.stepGoal).length
  const sleepAvg = (() => { const nights = series.filter(item => item.sleep > 0); return nights.length ? nights.reduce((sum, item) => sum + item.sleep, 0) / nights.length : 0 })()
  const streak = loggingStreak([...(s.meals || []).map(item => item.date), ...(s.activities || []).map(item => item.date)])
  const report = weeklyGrade({ calorieDays: calorieDays.length, targetHit, stepDays: stepDays.length, stepGoalDays, sleepAvg, sleepGoal: p.sleepGoalHours, logStreak: streak })
  const weight = weightTrend(s.weights, selectedDate, days)
  const entries = weightEntries(s, selectedDate).slice(-30)
  const projection = goalProjection(s.weights, p.goalWeightKg)
  const records = [
    { label: 'Best step day', value: nfmt(Math.max(0, ...series.map(item => item.steps))), unit: 'steps' },
    { label: 'Longest walk (all time)', value: formatDistance(Math.max(0, ...s.activities.map(item => Number(item.distanceKm) || 0))), unit: '' },
    { label: 'Most water in a day', value: formatWater(Math.max(0, ...series.map(item => item.waterMl))), unit: '' },
    { label: 'Most calories burned', value: nfmt(Math.max(0, ...series.map(item => item.activityCalories))), unit: 'kcal' },
  ]
  const stepTotal = series.reduce((sum, item) => sum + item.steps, 0), waterTotal = series.reduce((sum, item) => sum + item.waterMl, 0), sleepTotal = series.reduce((sum, item) => sum + item.sleep, 0)
  const challenges = [
    { name: 'Step challenge', detail: `${nfmt(stepTotal)} of ${nfmt(10000 * days)} steps`, percent: stepTotal / (10000 * days) * 100 },
    { name: 'Hydration challenge', detail: `${formatWater(waterTotal, unitsPref())} of ${formatWater(p.waterGoalMl * days, unitsPref())}`, percent: waterTotal / Math.max(1, p.waterGoalMl * days) * 100 },
    { name: 'Sleep challenge', detail: `${round1(sleepTotal)} of ${nfmt(p.sleepGoalHours * days)} h`, percent: sleepTotal / Math.max(1, p.sleepGoalHours * days) * 100 },
    { name: 'Logging challenge', detail: `${calorieDays.length} of ${days} days logged`, percent: calorieDays.length / days * 100 },
  ]
  const heat = loggingHeatmap(s, selectedDate, 56, p.id)
  const pattern = weekdayPattern(s.meals, selectedDate, 4, p.id)
  const goalProgress = weightGoalProgress(s.weights, selectedDate, p.goalWeightKg, p.id)
  const fat = bodyFatChange(s.weights, selectedDate, p.id)
  const changes = weekOverWeek(weeklySeries(s, selectedDate, p, 14))
  const loggedHeat = heat.filter(cell => cell.level > 0).length
  const patternDays = pattern.filter(item => item.avgKcal !== null)
  const bestDay = patternDays.slice().sort((a, b) => Math.abs(a.avgKcal - (t?.calorieTarget || a.avgKcal)) - Math.abs(b.avgKcal - (t?.calorieTarget || b.avgKcal)))[0]
  return `${heading('Progress', 'Charts, averages and a simple report card, all built from what you logged.')}<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Report card</h3><small class="cc-muted">${esc(report.summary)}</small></div><div class="seg"><button type="button" data-action="range" data-days="7" class="${days === 7 ? 'on' : ''}">7 days</button><button type="button" data-action="range" data-days="30" class="${days === 30 ? 'on' : ''}">30 days</button></div></div>
      <div class="cc-stat" style="display:flex;align-items:baseline;gap:12px">${esc(report.grade)}<small>${report.score} / 100</small></div>
      ${report.parts.length ? report.parts.map(part => `<div class="cc-row"><span>${esc(part.key)} · ${esc(part.detail)}</span><strong>${part.score}%</strong></div>`).join('') : `<p class="cc-small">Log meals and steps to unlock the grade.</p>`}</article>
    <article class="cc-card cc-card--third"><h3>Body trend</h3><div class="cc-stat">${weight ?? '—'} <small>kg · ${days}-day average</small></div>${weightChartSvg(entries)}${projection && projection.weeks ? `<div class="cc-row"><span>At your recent pace</span><strong>${projection.perWeek > 0 ? '+' : ''}${projection.perWeek} kg/week</strong></div><div class="cc-row"><span>Goal ${formatWeight(p.goalWeightKg, unitsPref())} reached around</span><strong>${esc(new Date(`${projection.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</strong></div>` : `<p class="cc-small">${projection ? `Your recent pace (${projection.perWeek > 0 ? '+' : ''}${projection.perWeek} kg/week) is not heading towards ${formatWeight(p.goalWeightKg, unitsPref())} yet, so there is no date to show.` : 'Set a goal weight in More → Goals and keep logging to see an estimate date.'}</p>`}</article>
    <article class="cc-card cc-card--third"><h3>Calories · ${days} days</h3>${miniBars(series, 'calories', Math.max(1200, ...series.map(item => item.calories)), ' kcal')}${goal ? `<p class="cc-small">Daily target ${nfmt(goal.calorieTarget)} kcal · ${targetHit} of ${calorieDays.length || 0} logged days within 10%.</p>` : ''}</article>
    <article class="cc-card cc-card--third"><h3>Steps · ${days} days</h3>${miniBars(series, 'steps', Math.max(2000, ...series.map(item => item.steps)))}<p class="cc-small">${stepGoalDays} of ${stepDays.length || 0} logged days hit ${nfmt(p.stepGoal)} steps.</p></article>
    <article class="cc-card cc-card--third"><h3>Sleep · ${days} days</h3>${miniBars(series, 'sleep', 12, ' h')}<p class="cc-small">${sleepAvg ? `${round1(sleepAvg)} h average · debt ${sleepDebt(s.sleeps, selectedDate, p.sleepGoalHours, days).hours} h` : 'Log sleep to see this chart.'}</p></article>
    <article class="cc-card cc-card--third"><h3>Water · ${days} days</h3>${miniBars(series, 'waterMl', Math.max(1000, ...series.map(item => item.waterMl)), ' ml')}<p class="cc-small">${formatWater(waterTotal, unitsPref())} logged in ${days} days.</p></article>
    <article class="cc-card cc-card--third"><h3>Personal records</h3>${records.map(item => `<div class="cc-row"><span>${esc(item.label)}</span><strong>${item.value}${item.unit ? ` ${item.unit}` : ''}</strong></div>`).join('')}</article>
    <article class="cc-card cc-card--third"><h3>Challenges</h3>${challenges.map(item => `<div style="margin-top:10px"><div class="cc-row" style="border:0;padding:0 0 4px"><span>${esc(item.name)}</span><strong>${Math.round(clamp(item.percent, 0, 100))}%</strong></div>${progressBar(item.percent, 100, item.percent >= 100)}<p class="cc-small" style="margin:4px 0 0">${esc(item.detail)}</p></div>`).join('')}</article>
    <article class="cc-card cc-card--third"><h3>Training load</h3><div class="cc-stat">${acuteChronicRatio(s.activities, selectedDate) ?? '—'} <small>recent / baseline</small></div><p class="cc-small">Ratio uses your logged MET-minute estimates. It is not a validated injury-risk prediction.</p></article>
    <article class="cc-card cc-card--third"><h3>Weekly averages</h3>${(() => { const a = weeklyAverages(s, selectedDate, p.id, days); return nutrientLine('Food energy', a.kcal ?? 0, 'kcal') + nutrientLine('Water', a.waterMl ?? 0, 'ml') + nutrientLine('Sleep', a.sleepHours ?? 0, 'h') + nutrientLine('Weight', a.weightKg ?? 0, 'kg') + `<p class="cc-small">Averages use only days with entries: ${a.kcalDays} food, ${a.sleepDays} sleep, ${a.waterDays} water, ${a.weightDays} weight.</p>` })()}</article>
    <article class="cc-card cc-card--wide"><h3>Logging heatmap · last 8 weeks</h3><p class="cc-small">${loggedHeat} of ${heat.length} days have something logged. Darker means meals, movement or sleep/water were all present.</p><div class="cc-heatmap" role="img" aria-label="Daily logging for the last eight weeks">${heat.map(cell => `<span class="cc-heat l${cell.level}" title="${esc(cell.date)}"></span>`).join('')}</div></article>
    <article class="cc-card cc-card--third"><h3>Day-of-week pattern</h3>${patternDays.length ? `${patternDays.map(item => `<div class="cc-row"><span>${esc(item.day)}${bestDay && item.day === bestDay.day ? ' · closest to target' : ''}</span><strong>${nfmt(item.avgKcal)} kcal</strong></div>`).join('')}<p class="cc-small">Average food energy on days that had entries, over the last 4 weeks. Weekend and weekday routines often explain a lot.</p>` : '<p class="cc-small">Log meals for a couple of weeks and the weekday pattern appears here.</p>'}</article>
    <article class="cc-card cc-card--third"><h3>Goal progress</h3>${goalProgress ? `<div class="cc-stat">${formatWeight(goalProgress.current, unitsPref())} <small>now</small></div>${progressBar(goalProgress.percent, 100, goalProgress.percent >= 100)}<div class="cc-row"><span>Started at</span><strong>${formatWeight(goalProgress.start, unitsPref())} · ${esc(goalProgress.since)}</strong></div><div class="cc-row"><span>Goal</span><strong>${formatWeight(goalProgress.goal, unitsPref())}</strong></div><div class="cc-row"><span>Still to go</span><strong>${formatWeight(goalProgress.toGo, unitsPref())}</strong></div><p class="cc-small">Measured between your first and latest weigh-in, so a flat week shows as no movement rather than a broken streak.</p>` : '<p class="cc-small">Set a goal weight in More → Goals and log your weight to see progress.</p>'}</article>
    <article class="cc-card cc-card--third"><h3>Body fat change</h3>${fat ? `<div class="cc-stat">${fat.change > 0 ? '+' : ''}${fat.change} <small>percentage points</small></div>${nutrientLine('First', `${fat.from}% · ${fat.fromDate}`)}${nutrientLine('Latest', `${fat.to}% · ${fat.toDate}`)}<p class="cc-small">Only entries where you typed a body-fat value are used. Scales estimate this; they do not measure it.</p>` : '<p class="cc-small">Log body fat on two different days to see a change. One reading is not a trend.</p>'}</article>
    <article class="cc-card cc-card--third"><h3>This week vs last week</h3>${changes.some(row => row.delta !== null) ? changes.map(row => `<div class="cc-row"><span>${esc(row.label)}</span><strong>${row.delta === null ? '—' : `${row.delta > 0 ? '+' : ''}${nfmt(row.delta)}${row.unit ? ` ${row.unit}` : ''}`}</strong></div>`).join('') + `<p class="cc-small">Averages of the last 7 days against the 7 before. Days without entries are left out of both.</p>` : '<p class="cc-small">Log a couple of weeks of data to compare one week with the next.</p>'}</article>
    <article class="cc-card cc-card--wide"><h3>Export your health record</h3><p>Export a local JSON backup, a CSV of meal entries, or print this summary to save as PDF from your browser.</p><div class="cc-actions"><button type="button" data-action="export-json">Download JSON backup</button><button type="button" data-action="export-meals">Download meal CSV</button><button type="button" data-action="export-daily">Download daily CSV</button><button type="button" data-action="print-report">Print / save PDF</button></div></article>
  </div>`
}
function renderMore() {
  const s=scoped(),p=profile(),habits=s.habits||[],logs=s.habitLogs.filter(item=>item.date===selectedDate),supp=s.supplements||[],medLogs=s.medicineLogs.filter(item=>item.date===selectedDate)
  const emergency=state.emergency||{}
  const healthAvailable=Capacitor.getPlatform()==='android',lastHealthSync=state.settings.healthConnectLastSyncAt?new Date(state.settings.healthConnectLastSyncAt).toLocaleString():''
  return `${heading('More tools','Profiles, habits, reminders and backups. Everything in this app is free.')}<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><h3>Profile settings</h3>${setupProfileForm()}</article>
    <article class="cc-card cc-card--third"><h3>Habits</h3><form class="cc-form" id="habit-form"><label class="cc-field"><span>Habit name</span><input name="name" required maxlength="50" placeholder="Stretch for 5 minutes"></label><div class="cc-actions"><button type="submit">Add habit</button></div></form>${habits.length?`<div class="cc-list">${habits.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${logs.some(log=>log.habitId===item.id)?'Done today':'Not logged today'}</small></span><button data-action="habit-toggle" data-id="${esc(item.id)}">${logs.some(log=>log.habitId===item.id)?'✓':'○'}</button></div>`).join('')}</div>`:empty('Add a small habit you want to keep track of.')}</article>
    <article class="cc-card cc-card--third"><h3>Reminder while open</h3><form class="cc-form" id="reminder-form"><label class="cc-field"><span>Daily check-in time</span><input name="time" type="time" value="${esc(state.settings.reminderTime||'')}"></label><div class="cc-actions"><button type="submit">Save reminder</button></div></form><p class="cc-small">Notifications can appear only while the app is open. No background alarm is promised.</p><h4>Medications / supplements</h4>${supp.length?`<div class="cc-list">${supp.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${item.time?`Reminder ${esc(item.time)}`:'No time set'}</small></span><button data-action="medicine-log" data-id="${esc(item.id)}">${medLogs.some(log=>log.itemId===item.id)?'✓':'Log'}</button></div>`).join('')}</div>`:empty('Add a reminder note from Health.')}</article>
    <article class="cc-card cc-card--third"><h3>Emergency information</h3><form class="cc-form" id="emergency-form"><div class="cc-fields"><label class="cc-field"><span>Emergency contact</span><input name="emergencyContact" maxlength="80" value="${esc(emergency.emergencyContact||'')}"></label><label class="cc-field"><span>Phone / email</span><input name="contactDetails" maxlength="80" value="${esc(emergency.contactDetails||'')}"></label><label class="cc-field"><span>Allergies</span><input name="allergies" maxlength="150" value="${esc(emergency.allergies||'')}"></label><label class="cc-field"><span>Blood type (optional)</span><input name="bloodType" maxlength="8" value="${esc(emergency.bloodType||'')}"></label><label class="cc-field"><span>Medicines</span><input name="medications" maxlength="150" value="${esc(emergency.medications||'')}"></label></div><div class="cc-actions"><button type="submit">Save emergency card</button></div></form><p class="cc-small">This information is stored in this browser and is not sent to emergency services.</p></article>
    <article class="cc-card cc-card--third"><h3>Back up & restore</h3><div class="cc-actions"><button data-action="export-json">Export all data</button><label class="cc-button">Restore backup<input type="file" id="restore-file" accept="application/json,.json" hidden></label></div><p class="cc-small">Backups may include sensitive health details. Store them somewhere private.</p></article>
    <article class="cc-card cc-card--third"><h3>Android Health Connect</h3>${healthAvailable?`<p>Read-only sync for the day selected above. Choose exactly which data types to allow in Android’s permission screen.</p><div class="cc-actions"><button class="primary" data-action="health-connect">Connect / permissions</button><button data-action="health-sync">Sync selected day</button><button data-action="health-open">Open Health Connect</button></div>${lastHealthSync?`<p class="cc-small">Last sync: ${esc(lastHealthSync)}. Imported values are stored locally.</p>`:'<p class="cc-small">Not connected yet. Sync is always started by you.</p>'}`:`<p>Health Connect sync is available in the Android APK. On web and Windows, enter readings manually or import a backup.</p><span class="cc-chip">Android only</span>`}
      <div class="settings-row"><div><b>Background steps</b><small>Reads today’s step total from your phone when you come back — including steps counted while the screen was off</small></div><button type="button" data-action="background-steps" aria-pressed="${state.settings.backgroundSteps?'true':'false'}">${state.settings.backgroundSteps?'On':'Off'}</button></div>${state.settings.backgroundSteps?`<div class="cc-actions"><button type="button" data-action="device-steps-sync">Sync steps now</button></div><p class="cc-small">${state.settings.backgroundStepsSyncAt?`Last background sync: ${esc(new Date(state.settings.backgroundStepsSyncAt).toLocaleString())}.`:'Waiting for the first background sync.'} Your phone counts the steps; this app only reads the total and never uploads it.</p>`:'<p class="cc-small">Turn this on to keep counting with the screen off. Off means steps only arrive when you tap Sync.</p>'}<div class="cc-list">${['Apple Health','Garmin','Strava','Oura','Continuous glucose monitor','ECG / EDA sensors'].map(name=>`<div class="cc-list-item"><span><b>${name}</b><small>Needs a supported provider, device and account connection.</small></span><span class="cc-chip">Not connected</span></div>`).join('')}</div><p class="cc-small">Health Connect data is read only after you grant permission. It is not uploaded to our servers.</p></article>
    <article class="cc-card cc-card--wide"><h3>Privacy and limits</h3><p><strong>Private by default:</strong> tracker entries stay in this browser or app on this device. An optional barcode lookup sends the barcode to Open Food Facts. If you choose Android Health Connect sync, only the data types you permit are imported locally.</p><p><strong>Estimates only:</strong> calorie needs, macros, food entries, exercise energy, recovery, sleep debt, and heart-rate zones are rough estimates. They are not medical diagnosis, treatment or personalized medical advice. This app is not designed to guide treatment, pregnancy nutrition, eating-disorder recovery or medication dosing.</p><p><strong>Limitations:</strong> meal photos are saved locally but are not yet automatically identified. Lab report OCR fills fields for your review; it does not interpret results. Wearables, CGMs and ECG / EDA sensors need their own supported connection.</p><div class="cc-actions"><a class="cc-button" href="/health-privacy.html" target="_blank" rel="noreferrer">Health data privacy policy</a><button data-action="clear-data">Clear all tracker data</button></div></article>
  </div>`
}

function addMeal(food, grams, slot = 'Snack', date = selectedDate, source = '') {
  const amount=Number(grams)
  if(!food||!Number.isFinite(amount)||amount<=0||amount>5000)return toast('Enter a food portion from 1 to 5,000 grams.')
  const attached = photoData && Date.now() - photoAt < PHOTO_TTL_MS ? photoData : ''
  state.meals.push({...recordBase(date),name:food.name,foodId:food.id,grams:round1(amount),slot,nutrients:calcFood(food),source,photo:attached})
  photoData='';photoAt=0;persist(`${food.name} added to your diary.`);render()
}
function copyYesterdayMeals() {
  const from = previousDay(selectedDate)
  const items = copyableMeals(scoped().meals, from, selectedDate)
  if (!items.length) return toast('No meals were logged yesterday to copy.')
  for (const item of items) state.meals.push({ ...item, id: uid(), profileId: profile().id })
  persist(`${items.length} meal${items.length === 1 ? '' : 's'} copied from ${dfmt(from)}.`); render()
}
function duplicateMeal(id) {
  const entry = scoped().meals.find(item => item.id === id)
  if (!entry) return toast('That meal is no longer in your diary.')
  state.meals.push({ ...entry, id: uid(), date: selectedDate, profileId: profile().id })
  persist(`${entry.name} logged again.`); render()
}
// Two weigh-ins on the same day are a correction, not a trend: overwrite the
// day's entry so charts and the change-since-last-week line stay truthful.
function saveWeightEntry(date, kg, bodyFat = 0) {
  const owner = profile().id
  const existing = (state.weights || []).find(item => item.date === date && (!item.profileId || item.profileId === owner))
  const values = { date, kg: round1(clamp(kg, 20, 500)), bodyFat: clamp(bodyFat, 0, 75), profileId: owner }
  if (existing) { Object.assign(existing, values); return true }
  state.weights.push({ ...recordBase(date), ...values })
  return false
}
function quickAddFood(name, grams, slot) {
  const food = allFoods().find(item => item.name === name)
  if (!food) return toast('That food is no longer in your list.')
  addMeal(food, Number(grams) || 100, slot || 'Snack')
}
function download(name, text, type) {
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}))
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1200)
}
function exportMeals() {
  const rows=scoped().meals.map(item=>[item.date,item.slot,item.name,item.grams,round1((item.nutrients?.kcal||0)*item.grams/100),round1((item.nutrients?.p||0)*item.grams/100),round1((item.nutrients?.c||0)*item.grams/100),round1((item.nutrients?.f||0)*item.grams/100)])
  const csv=[['date','meal','food','grams','kcal','protein_g','carbs_g','fat_g'],...rows].map(row=>row.map(cell=>`"${String(cell??'').replaceAll('"','""')}"`).join(',')).join('\r\n')
  download(`calorie-meals-${todayISO()}.csv`,csv,'text/csv;charset=utf-8')
}
function parseForm(form) { return Object.fromEntries(new FormData(form).entries()) }
function number(value, fallback = 0) { const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback }
function saveProfile(form) {
  const values=parseForm(form),p=profile()
  p.name=String(values.name||'Me').trim().slice(0,28)||'Me';p.age=String(values.age||'');p.equation=values.equation==='male'?'male':'female'
  p.heightCm=String(values.heightCm||'');p.weightKg=String(values.weightKg||'');p.activity=clamp(values.activity,1.2,1.9);p.goal=['lose','gain','maintain'].includes(values.goal)?values.goal:'maintain'
  p.sleepGoalHours=clamp(values.sleepGoalHours,4,12);p.waterGoalMl=clamp(values.waterGoalMl,250,10000);p.stepGoal=clamp(values.stepGoal,500,50000)
  persist('Profile saved on this device.');render()
}
function persistDaily(listName, date = selectedDate, changes) {
  const list=state[listName],p=profile();let entry=list.find(item=>item.date===date&&item.profileId===p.id)
  if(entry)Object.assign(entry,changes);else list.push({...recordBase(date),...changes})
}
async function handleForm(form) {
  const data=parseForm(form),p=profile()
  if(form.id==='profile-form')return saveProfile(form)
  if(form.id==='quick-weight-form'){
    const raw=number(data.weight),kg=unitsPref()==='imperial'?raw*0.45359237:raw
    if(kg<20||kg>500)return toast('Enter a realistic weight (20–500 kg, or 44–1,102 lb).')
    const replaced=saveWeightEntry(selectedDate,kg,0);p.weightKg=String(round1(kg))
    persist(`${replaced?'Weight updated':'Weight logged'} · ${formatWeight(kg,unitsPref())}.`);render();return
  }
  if(form.id==='quick-steps-form'){
    const steps=Math.floor(number(data.steps));if(steps<1||steps>100000)return toast('Enter between 1 and 100,000 steps.')
    state.activities.push({...recordBase(),name:'Step entry',steps,stepsOnly:true,minutes:0,met:1,calories:0});persist(`${nfmt(steps)} steps logged.`);render();return
  }
  if(form.id==='quick-water-form'){
    const raw=number(data.water),ml=unitsPref()==='imperial'?raw*29.5735:raw
    if(ml<1||ml>5000)return toast('Enter an amount between 1 and 5,000 ml.')
    state.water.push({...recordBase(),ml:Math.round(ml),name:'Water'});persist(`${formatWater(ml,unitsPref())} logged.`);render();return
  }
  if(form.id.startsWith('slot-quick-form')){
    const kcal=number(data.kcal)
    if(kcal<1||kcal>5000)return toast('Enter between 1 and 5,000 kcal.')
    const slot=form.dataset.slot||'Snack'
    // Optional macros keep a quick entry from making the macro targets useless.
    const protein=clamp(data.p,0,500),carbs=clamp(data.c,0,900),fat=clamp(data.f,0,500)
    const missing=Math.max(0,Math.round(kcal-protein*4-carbs*4-fat*9))
    state.meals.push({...recordBase(),name:String(data.name||'').trim().slice(0,60)||`Quick ${slot.toLowerCase()}`,grams:100,slot,nutrients:{kcal,p:protein,c:carbs,f:fat,fi:0,su:0,na:0},source:(protein||carbs||fat)?'Quick add + macros':'Quick add'})
    photoData='';photoAt=0
    persist(`${nfmt(kcal)} kcal added to ${slot.toLowerCase()}${protein||carbs||fat?` with ${nfmt(protein)} g protein`:''}${!protein&&!carbs&&!fat&&kcal?` · ${nfmt(missing)} kcal unassigned to a macro`:''}.`);render();return
  }
  if(form.id==='copy-day-form'){
    const from=String(data.date||'')
    if(!from)return toast('Pick a day to copy from.')
    if(from===selectedDate)return toast('That is the day you are already editing.')
    const items=copyableMeals(scoped().meals,from,selectedDate)
    if(!items.length)return toast('No meals were logged on that day.')
    for(const item of items)state.meals.push({...item,id:uid(),profileId:profile().id,source:item.source||'Copied day'})
    copySourceDate=from
    persist(`${items.length} meal${items.length===1?'':'s'} copied from ${dfmt(from)}.`);render();return
  }
  if(form.id==='custom-activity-form'){
    const minutes=clamp(data.minutes,1,1440),met=clamp(data.met,1,20)
    state.activities.push({...recordBase(),name:String(data.name||'Activity').trim().slice(0,50),minutes,met,calories:estimateActivityCalories({met,minutes},p.weightKg),source:'Custom'})
    persist('Activity logged.');render();return
  }
  if(form.id==='step-goal-form'){
    p.stepGoal=clamp(data.stepGoal,500,50000);persist(`Step goal saved · ${nfmt(p.stepGoal)} steps.`);render();return
  }
  if(form.id==='clear-collection-form'){
    const key=String(data.collection||'')
    if(!key||!Array.isArray(state[key])||!state[key].length)return toast('Choose a record type that has something in it.')
    const owner=profile().id,label=COLLECTION_LABELS[key]||key
    const mine=state[key].filter(item=>!item.profileId||item.profileId===owner)
    if(!mine.length)return toast('Those records belong to another profile.')
    if(!confirm(`Remove ${mine.length} record${mine.length===1?'':'s'} from ${label.toLowerCase()} for ${profile().name||'this profile'}? Export a backup first if you may want them back.`))return
    state[key]=state[key].filter(item=>item.profileId&&item.profileId!==owner)
    persist(`${mine.length} record${mine.length===1?'':'s'} removed from ${label.toLowerCase()}.`);render();return
  }
  if(form.id==='weekly-goal-form'){
    state.settings.weeklyWalkGoal=Math.round(clamp(data.goal,30,1500));persist(`Weekly active-minute goal saved · ${nfmt(state.settings.weeklyWalkGoal)} min.`);render();return
  }
  if(form.id==='walk-checkin-form'){
    const commit=()=>{
      const walk=(state.walks||[]).find(item=>item.id===pendingCheckin?.walkId)
      const checkin={with:data.with||'Alone',feel:data.feel||'',place:data.place||'',weather:data.weather||'',notes:String(data.notes||'').slice(0,140)}
      if(walk){walk.checkin=checkin;if(finishPhoto)walk.endPhoto=finishPhoto}
      const linked=(state.activities||[]).find(item=>item.walkId===walk?.id)
      if(linked)linked.checkin=checkin
      finishPhoto='';pendingCheckin=null;photoTask=null
      pruneWalkPhotos()
      persist('Check-in saved. Nice work.');render()
    }
    // A photo picked a moment ago may still be compressing; wait for it.
    if(photoTask)photoTask.then(commit,commit);else commit()
    return
  }
  if(form.id==='stride-form'){
    p.strideM=Math.round(clamp(data.strideCm,30,160))/100
    persist(`Stride saved · ${Math.round(p.strideM*100)} cm.`);render();return
  }
  if(form.id==='calibrate-form'){
    const stride=strideFromCalibration(number(data.steps),number(data.metres))
    if(!stride)return toast('Enter at least 20 steps and 5 metres from a measured walk.')
    p.strideM=stride
    persist(`Stride calibrated to ${Math.round(stride*100)} cm from ${nfmt(number(data.steps))} steps.`);render();return
  }
  if(form.id==='measure-form'){
    const toCm=value=>unitsPref()==='imperial'?(number(value)*2.54):number(value)
    const clean=value=>{const cm=toCm(value);return cm>0?clamp(cm,20,250):0}
    const waist=clean(data.waistCm),chest=clean(data.chestCm),hips=clean(data.hipsCm)
    if(!waist&&!chest&&!hips)return toast('Enter at least one measurement.')
    state.measurements.push({...recordBase(),waistCm:waist,chestCm:chest,hipsCm:hips})
    persist('Measurements saved.');render();return
  }
  if(form.id==='steps-form'){
    const steps=Math.floor(number(data.steps));if(steps<1||steps>100000)return toast('Enter between 1 and 100,000 steps.')
    state.activities.push({...recordBase(),name:'Step entry',steps,stepsOnly:true,minutes:0,met:1,calories:0});persist(`${nfmt(steps)} steps logged.`);render();return
  }
  if(form.id==='workout-form'){
    const ex=EXERCISES.find(item=>item.id===data.exercise),minutes=clamp(data.minutes,1,1440);if(!ex)return toast('Pick an activity from the list.')
    const calories=estimateActivityCalories({met:ex.met,minutes},p.weightKg)
    state.activities.push({...recordBase(),name:ex.name,minutes,met:ex.met,hr:number(data.hr)||0,calories})
    persist(`Workout saved · about ${nfmt(calories)} kcal estimated.`);render();return
  }
  if(form.id==='strength-form'){
    const minutes=number(data.minutes)||0,met=5,calories=estimateActivityCalories({met,minutes:minutes||30},p.weightKg)
    state.activities.push({...recordBase(),name:String(data.name||'').trim()||'Strength session',muscle:data.muscle,sets:clamp(data.sets,1,50),reps:clamp(data.reps,1,500),loadKg:number(data.loadKg),restSeconds:clamp(data.restSeconds,10,900),minutes,met,calories})
    persist('Strength session saved.');render();return
  }
  if(form.id==='sleep-form'){
    const hours=clamp(data.hours,0,24),deep=clamp(data.deep,0,24),rem=clamp(data.rem,0,24)
    if(hours<=0)return toast('Enter how many hours you slept.')
    if(deep+rem>hours+0.2)return toast('Deep and REM hours cannot exceed total sleep hours.')
    persistDaily('sleeps',selectedDate,{hours,quality:clamp(data.quality,1,5),deep,rem,bed:data.bed,wake:data.wake})
    persist('Sleep log saved. Stages are manual estimates.');render();return
  }
  if(form.id==='vitals-form'){
    const vitals={hr:clamp(data.hr,0,250),rhr:clamp(data.rhr,0,200),hrv:clamp(data.hrv,0,500),spo2:clamp(data.spo2,0,100),bp:String(data.bp||'').trim().slice(0,12),temp:clamp(data.temp,0,45),glucose:clamp(data.glucose,0,40),respiration:clamp(data.respiration,0,80)}
    if(!vitals.hr&&!vitals.rhr&&!vitals.hrv&&!vitals.spo2&&!vitals.bp&&!vitals.temp&&!vitals.glucose&&!vitals.respiration)return toast('Enter at least one reading.')
    if(vitals.bp&&!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(vitals.bp))return toast('Blood pressure should look like 120/80.')
    persistDaily('vitals',selectedDate,vitals)
    if(number(data.glucose)>0)state.glucose.push({...recordBase(),value:number(data.glucose),unit:'mmol/L',source:'manual'})
    persist('Manual readings saved.');render();return
  }
  if(form.id==='mood-form'){
    persistDaily('moods',selectedDate,{mood:data.mood,energy:clamp(data.energy,1,5),stress:clamp(data.stress,1,5),note:String(data.note||'').slice(0,180)})
    if(data.note)state.symptoms.push({...recordBase(),note:String(data.note).slice(0,180)})
    persist('Check-in saved privately.');render();return
  }
  if(form.id==='water-form'){
    const raw=number(data.ml),ml=unitsPref()==='imperial'?raw*29.5735:raw
    if(ml<1||ml>5000)return toast('Enter an amount between 1 and 5,000 ml (or 1–169 oz).')
    state.water.push({...recordBase(),ml:Math.round(ml),name:String(data.name||'Water').trim().slice(0,40)});persist('Drink logged.');render();return
  }
  if(form.id==='weight-form'){
    const kg=number(data.kg);if(kg<20||kg>500)return toast('Enter weight between 20 and 500 kg.')
    const replaced=saveWeightEntry(selectedDate,kg,data.bodyFat)
    // Only today's weigh-in should move the profile weight used for targets;
    // back-filling an old date must not change today's numbers.
    const isToday=selectedDate===todayISO()
    if(isToday)p.weightKg=String(kg)
    persist(replaced?(isToday?'Weigh-in for today updated; profile weight updated.':'Weigh-in for that day updated.'):(isToday?'Body measurement saved; profile weight updated.':'Weigh-in saved for that day.'));render();return
  }
  if(form.id==='cycle-form'){
    state.cycleLogs.push({...recordBase(data.date||selectedDate),note:String(data.note||'').slice(0,100)});persist('Cycle note saved.');render();return
  }
  if(form.id==='symptom-form'){
    state.symptoms.push({...recordBase(),name:String(data.name||'').trim().slice(0,60),severity:clamp(data.severity,1,5),note:String(data.note||'').slice(0,120)})
    persist('Symptom saved privately.');render();return
  }
  if(form.id==='custom-food-form'){
    const food={id:uid(),name:String(data.name||'').trim().slice(0,80),cat:String(data.cat||'').trim().slice(0,32)||'Custom',kcal:clamp(data.kcal,0,900),p:clamp(data.p,0,100),c:clamp(data.c,0,100),f:clamp(data.f,0,100),fi:clamp(data.fi,0,100),su:clamp(data.su,0,100),na:clamp(data.na,0,100000),serv:[['100 g',100]],source:'custom'}
    state.customFoods.push(food);persist('Custom food saved.');render();return
  }
  if(form.id==='recipe-form'){
    state.recipes.push({...recordBase(),name:String(data.name||'').trim().slice(0,80),kcal:clamp(data.kcal,0,9000),p:clamp(data.p,0,1000),c:clamp(data.c,0,1000),f:clamp(data.f,0,1000)})
    persist('Recipe saved on this device.');render();return
  }
  if(form.id==='plan-form'){
    state.mealPlans.push({...recordBase(data.date||selectedDate),name:String(data.name||'').trim().slice(0,100),kcal:clamp(data.kcal,0,10000)});persist('Meal plan saved.');render();return
  }
  if(form.id==='supplement-form'){
    state.supplements.push({...recordBase(),name:String(data.name||'').trim().slice(0,80),time:data.time||''});persist('Reminder note saved.');render();return
  }
  if(form.id==='lab-form'){
    state.labResults.push({...recordBase(),name:String(data.name||'').trim().slice(0,70),value:String(data.value||'').trim().slice(0,30),unit:String(data.unit||'').slice(0,20),note:String(data.note||'').slice(0,80)});persist('Personal result saved.');render();return
  }
  if(form.id==='habit-form'){
    state.habits.push({...recordBase(),name:String(data.name||'').trim().slice(0,50)});persist('Habit added.');render();return
  }
  if(form.id==='reminder-form'){
    await saveCheckInReminder(data.time||'');return
  }
  if(form.id==='emergency-form'){
    state.emergency={...state.emergency,emergencyContact:String(data.emergencyContact||'').slice(0,80),contactDetails:String(data.contactDetails||'').slice(0,80),allergies:String(data.allergies||'').slice(0,150),bloodType:String(data.bloodType||'').slice(0,8),medications:String(data.medications||'').slice(0,150)};persist('Emergency card saved on this device.');render();return
  }
  if(form.id==='barcode-form') { lookupBarcode(data.barcode);return }
}

async function lookupBarcode(raw) {
  const code=String(raw||'').replace(/[^0-9]/g,'')
  if(!/^\d{8,14}$/.test(code))return toast('Enter a barcode with 8–14 digits.')
  const host=$('#barcode-result',root),status=$('#barcode-status',root)
  if(status)status.textContent='Searching Open Food Facts…';if(host)host.innerHTML=''
  try {
    const response=await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}.json`)
    if(!response.ok)throw new Error('The product database did not respond.')
    const data=await response.json(),product=data.product
    if(data.status!==1||!product)throw new Error('No product matched that barcode. You can add its label values as a custom food.')
    const nutrient=product.nutriments||{},kcal=Number(nutrient['energy-kcal_100g'])||Number(nutrient.energy_100g)/4.184
    if(!Number.isFinite(kcal)||kcal<=0)throw new Error('A product was found, but it had no usable calorie value. Add its label values manually.')
    const sodium=Number(nutrient.sodium_100g)||0
    const food={id:uid(),barcode:code,name:String(product.product_name||product.product_name_en||`Product ${code}`).slice(0,80),cat:'Packaged food',kcal,p:Number(nutrient.proteins_100g)||0,c:Number(nutrient.carbohydrates_100g)||0,f:Number(nutrient.fat_100g)||0,fi:Number(nutrient.fiber_100g)||0,su:Number(nutrient.sugars_100g)||0,na:sodium<20?sodium*1000:sodium,serv:[['100 g',100]],source:'Open Food Facts'}
    if(status)status.textContent='Check this label entry before saving it.'
    if(host)host.innerHTML=`<div class="cc-notice"><strong>${esc(food.name)}</strong><br>${nfmt(food.kcal)} kcal / 100 g · P ${round1(food.p)} g · C ${round1(food.c)} g · F ${round1(food.f)} g<br>Source: Open Food Facts · verify against the package.</div><div class="cc-actions"><button class="primary" data-action="barcode-save" data-food="${encodeURIComponent(JSON.stringify(food))}">Save product & add 100 g</button></div>`
  } catch(error) { if(status)status.textContent=error.message||'Product lookup failed.' }
}
async function startBarcodeScan() {
  const status=$('#barcode-status',root),video=$('#barcode-video',root)
  if(!('BarcodeDetector'in window))return toast('This browser cannot scan barcodes. Type the number from the label instead.')
  if(!navigator.mediaDevices?.getUserMedia)return toast('Camera access is unavailable. Type the number from the label instead.')
  try {
    barcodeStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}})
    video.srcObject=barcodeStream;video.hidden=false;await video.play()
    const supported=await BarcodeDetector.getSupportedFormats(),formats=['ean_13','ean_8','upc_a','upc_e'].filter(item=>supported.includes(item))
    const detector=new BarcodeDetector({formats});if(status)status.textContent='Point your camera at the product barcode.'
    const scan=async()=>{if(!barcodeStream)return;try{const result=await detector.detect(video),code=result.find(item=>/^\d{8,14}$/.test(item.rawValue||''))?.rawValue;if(code){$('#barcode-input',root).value=code;stopBarcodeScan();lookupBarcode(code);return}}catch{}barcodeFrame=requestAnimationFrame(scan)}
    scan()
  } catch { stopBarcodeScan();toast('Could not open the camera. Enter the barcode manually.') }
}
function stopBarcodeScan() { if(barcodeFrame)cancelAnimationFrame(barcodeFrame);barcodeFrame=0;if(barcodeStream){barcodeStream.getTracks().forEach(track=>track.stop());barcodeStream=null}const video=$('#barcode-video',root);if(video){video.pause();video.srcObject=null;video.hidden=true} }
function stepSourceToday(activity = dayActivity(scoped(), selectedDate, profile())) {
  if (activity.deviceSteps !== null) return 'device'
  const entries = scoped().activities.filter(item => item.date === selectedDate)
  if (entries.some(item => /walk|run/i.test(String(item.source || '')))) return 'walk'
  if (entries.some(item => /motion/i.test(String(item.source || '')))) return 'motion'
  if (entries.some(item => Number(item.steps) > 0)) return 'manual'
  return 'none'
}
function stopMotionCount(save = true) {
  if (!motionHandler && !stepDetector) return 0
  window.removeEventListener('devicemotion', motionHandler)
  motionHandler = null
  const count = stepCount
  const minutes = Math.max(1, Math.round((Date.now() - motionStarted) / 60000))
  stepDetector = null
  stepCount = 0
  if (save && count > 0) {
    state.activities.push({ ...recordBase(), name: 'Phone motion steps', steps: count, stepsOnly: true, minutes, met: 1, calories: 0, source: 'foreground motion' })
    persist(`${nfmt(count)} estimated steps saved.`)
  }
  return count
}
function toggleMotion() {
  const status = $('#motion-status', root)
  if (stepDetector) {
    const count = stopMotionCount(true)
    if (!count) toast('No steps were detected. Keep the phone in a pocket and walk a little longer.')
    render()
    return
  }
  if (!('DeviceMotionEvent' in window)) return toast('Phone motion counting is not available here. Enter a step count manually or connect Health Connect.')
  const begin = () => {
    stepDetector = createStepDetector({ sensitivity: Number(state.settings.stepSensitivity) || 1 })
    stepCount = 0
    motionStarted = Date.now()
    motionHandler = event => {
      const acceleration = event.accelerationIncludingGravity || event.acceleration
      if (!acceleration) return
      const magnitude = Math.sqrt((acceleration.x || 0) ** 2 + (acceleration.y || 0) ** 2 + (acceleration.z || 0) ** 2)
      if (stepDetector && stepDetector.push(magnitude)) {
        stepCount = stepDetector.steps
        const node = $('#motion-status', root)
        if (node) node.textContent = `${nfmt(stepCount)} steps · ${stepDetector.cadence} steps/min · ~${formatDistance(distanceForSteps(stepCount, strideOf()), unitsPref())} · keep the screen open`
      }
    }
    window.addEventListener('devicemotion', motionHandler)
    // Re-render so the button switches to "Stop and save count" immediately.
    render()
    toast('Step counting started. Keep this screen open.')
  }
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(permission => permission === 'granted' ? begin() : toast('Motion permission was not granted.')).catch(() => toast('Could not access the motion sensor.'))
  } else begin()
}
function toggleGps() {
  const status=$('#gps-status',root)
  if(gpsWatch!==null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;const points=gpsPoints;gpsPoints=[];let metres=0;for(let i=1;i<points.length;i++){const rad=x=>x*Math.PI/180,a=points[i-1],b=points[i],dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon),h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;metres+=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}const minutes=Math.max(1,Math.round((Date.now()-gpsStarted)/60000));state.activities.push({...recordBase(),name:'GPS walk',minutes,met:3.5,distanceKm:metres/1000,calories:estimateActivityCalories({met:3.5,minutes},profile().weightKg),source:'foreground GPS'});persist(`Walk saved · ${round1(metres/1000)} km estimate.`);render();return}
  if(!navigator.geolocation)return toast('Location is unavailable here.')
  gpsPoints=[];gpsStarted=Date.now();status.textContent='Waiting for location permission…';gpsWatch=navigator.geolocation.watchPosition(position=>{const point={lat:position.coords.latitude,lon:position.coords.longitude,at:Date.now()};if(!gpsPoints.length||position.coords.accuracy<80)gpsPoints.push(point);if(status)status.textContent=`GPS walk active · ${gpsPoints.length} location samples · this screen must stay open.`},()=>{status.textContent='Location permission or signal unavailable.';if(gpsWatch!==null)navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null},{enableHighAccuracy:true,maximumAge:2000,timeout:15000})
}
function addQuickWater(ml) { state.water.push({...recordBase(),ml:Number(ml),name:'Water'});persist(`+${ml} ml logged.`);render() }
function toastUndo(message) {
  const node=$('#tracker-toast',root)
  if(!node)return
  node.innerHTML=`<div class="cc-toast">${esc(message)}<button type="button" class="toast-undo" data-action="undo-delete">Undo</button></div>`
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.innerHTML='';undoEntry=null},7000)
}
function removeRecord(collection,id) {
  if(!['meals','activities','water','weights','sleeps','vitals','moods','mealPlans','templates','walks'].includes(collection))return
  const list=state[collection]||[], index=list.findIndex(item=>item.id===id)
  if(index<0)return
  const item=list[index]
  const linked=[]
  // A saved session exists as both an activity and a walk record; remove both.
  if(collection==='activities'&&item.walkId){
    const partner=(state.walks||[]).find(entry=>entry.id===item.walkId)
    if(partner){linked.push({collection:'walks',item:partner});state.walks=state.walks.filter(entry=>entry.id!==partner.id)}
  }
  if(collection==='walks'){
    for(const entry of (state.activities||[]).filter(entry=>entry.walkId===item.id)){
      linked.push({collection:'activities',item:entry});state.activities=state.activities.filter(row=>row.id!==entry.id)
    }
  }
  undoEntry={collection,item,index,linked}
  state[collection]=list.filter(entry=>entry.id!==id)
  if(!saveState(state))return toast('Device storage is full. Export a backup and remove large photos.')
  toastUndo('Entry removed.')
  render()
}
function startRestTimer() {
  const raw=number($('#tracker-view [name="restSeconds"]',root)?.value)
  const seconds=raw>0?clamp(raw,10,900):90,clock=$('#rest-clock',root);clearInterval(restTimer);let remain=seconds
  if(clock)clock.textContent=`${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}`
  restTimer=setInterval(()=>{remain--;if(clock)clock.textContent=`${Math.floor(Math.max(0,remain)/60)}:${String(Math.max(0,remain)%60).padStart(2,'0')}`;if(remain<=0){clearInterval(restTimer);if('Notification'in window&&Notification.permission==='granted')new Notification('Rest timer complete');toast('Rest timer complete.')}},1000)
}
function startFasting() { if(state.fastingSessions.some(item=>item.profileId===profile().id&&!item.endAt))return;state.fastingSessions.push({...recordBase(),startAt:new Date().toISOString(),endAt:''});persist('Fasting timer started.');render();clearInterval(fastingTimer);fastingTimer=setInterval(updateFastingClock,30000) }
function endFasting() { const active=state.fastingSessions.find(item=>item.profileId===profile().id&&!item.endAt);if(!active)return;active.endAt=new Date().toISOString();active.minutes=Math.round((Date.now()-new Date(active.startAt).getTime())/60000);clearInterval(fastingTimer);fastingTimer=0;persist(`Timer ended · ${Math.floor(active.minutes/60)} h ${active.minutes%60} min.`);render() }
function updateFastingClock() { const el=$('#fasting-clock',root);if(!el)return;const active=state.fastingSessions.find(item=>item.profileId===profile().id&&!item.endAt);if(!active){el.textContent='Ready';return}const sec=Math.floor((Date.now()-new Date(active.startAt).getTime())/1000);el.textContent=`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}` }
function updateReminder() {
  if(Capacitor.getPlatform()==='android')return
  const time=state.settings.reminderTime;if(!time||!('Notification'in window)||Notification.permission!=='granted')return
  const now=new Date(),target=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  if(target===time&&lastReminderDay!==todayISO()){lastReminderDay=todayISO();new Notification('Health check-in',{body:'Open your private tracker to log anything you want to remember.'})}
}
function addBarcodeFood(encoded) {
  try {
    const scanned=JSON.parse(decodeURIComponent(encoded))
    // Re-scanning the same product should reuse the saved entry, not duplicate it.
    const existing=scanned.barcode?(state.customFoods||[]).find(item=>item.barcode===scanned.barcode):null
    const food=existing||scanned
    if(!existing)state.customFoods.push(food)
    addMeal(food,100,pendingSlot||'Snack',selectedDate,'Open Food Facts')
  } catch { toast('Could not save that product. Try the custom food form.') }
}
const HEALTH_VARIABLES = ['STEPS','DISTANCE','CALORIES_BURNED','HEART_RATE','SLEEP','BLOOD_PRESSURE','BLOOD_GLUCOSE','OXYGEN_SATURATION','BODY_TEMPERATURE','WEIGHT','BODY_FAT_PERCENTAGE']
function assertAndroidHealth() {
  if(Capacitor.getPlatform()!=='android')throw new Error('Health Connect sync is available in the Android app only.')
}
async function requestHealthAccess() {
  assertAndroidHealth()
  const customPermissions=HEALTH_VARIABLES.map(Variable=>({Variable,AccessType:'READ'}))
  await HealthFitness.requestHealthPermissions({customPermissions:JSON.stringify(customPermissions),allVariables:JSON.stringify({IsActive:false,AccessType:'READ'}),fitnessVariables:JSON.stringify({IsActive:false,AccessType:'READ'}),healthVariables:JSON.stringify({IsActive:false,AccessType:'READ'}),profileVariables:JSON.stringify({IsActive:false,AccessType:'READ'}),workoutVariables:JSON.stringify({IsActive:false,AccessType:'READ'})})
  state.settings.healthConnectPermissionRequestedAt=new Date().toISOString();persist('Health Connect permission screen completed. Sync only the date you choose.')
}
function pluginResultJson(value) {
  if(typeof value!=='string')return value
  try{return JSON.parse(value)}catch{return null}
}
function healthNumbers(result) {
  const rootValue=pluginResultJson(result?.results)||pluginResultJson(result?.resultDataPoints),entries=[]
  const useful=/value|sum|average|avg|count|steps|distance|kilocal|calorie|bpm|systolic|diastolic|glucose|percent|temperature|weight|duration|seconds|minutes|hours|millimeter|milligram|kilogram|kilometer|meter|millisecond|pound|fahrenheit|celsius/i
  const walk=(node,key='')=>{
    if(typeof node==='number'&&Number.isFinite(node)&&useful.test(key)){entries.push({key:key.toLowerCase(),value:node});return}
    if(typeof node==='string'&&useful.test(key)&&/^-?\d+(?:\.\d+)?$/.test(node.trim())){entries.push({key:key.toLowerCase(),value:Number(node)});return}
    if(Array.isArray(node)){for(const item of node)walk(item,key);return}
    if(node&&typeof node==='object')for(const [child,value] of Object.entries(node))walk(value,child)
  }
  walk(rootValue)
  return entries
}
function healthValue(entries,operation='AVERAGE') {
  const values=entries.filter(item=>!/(systolic|diastolic)/.test(item.key)).map(item=>item.value)
  if(!values.length)return null
  return operation==='SUM'?values.reduce((sum,value)=>sum+value,0):values.reduce((sum,value)=>sum+value,0)/values.length
}
function localDayIso(date,offsetDays=0) {
  const [year,month,day]=date.split('-').map(Number),local=new Date(year,month-1,day+offsetDays)
  return local.toISOString().replace(/\.\d{3}Z$/,'Z')
}
async function readHealthVariable(variable,operation,startDate,endDate) {
  try{
    const result=await HealthFitness.getData({parameters:JSON.stringify({Variable:variable,StartDate:startDate,EndDate:endDate,TimeUnit:'DAY',OperationType:operation,TimeUnitLength:1,AdvancedQueryReturnType:'ALL_DATA',AdvancedQueryResultType:'RAW_DATA'})})
    return healthNumbers(result)
  }catch{return []}
}
async function syncHealthConnect() {
  try{
    await requestHealthAccess()
    const start=localDayIso(selectedDate),end=localDayIso(selectedDate,1),specs=[['STEPS','SUM'],['DISTANCE','SUM'],['CALORIES_BURNED','SUM'],['HEART_RATE','AVERAGE'],['SLEEP','SUM'],['BLOOD_PRESSURE','AVERAGE'],['BLOOD_GLUCOSE','AVERAGE'],['OXYGEN_SATURATION','AVERAGE'],['BODY_TEMPERATURE','AVERAGE'],['WEIGHT','AVERAGE'],['BODY_FAT_PERCENTAGE','AVERAGE']]
    const records=await Promise.all(specs.map(async([variable,operation])=>[variable,await readHealthVariable(variable,operation,start,end)])),data=Object.fromEntries(records)
    const values={},number=(variable,operation)=>healthValue(data[variable]||[],operation)
    const steps=number('STEPS','SUM'),distance=number('DISTANCE','SUM'),calories=number('CALORIES_BURNED','SUM')
    if(steps!==null)values.steps=Math.max(0,Math.round(steps))
    const distanceUnit=data.DISTANCE?.[0]?.key||''
    if(distance!==null)values.distanceKm=Math.max(0,distanceUnit.includes('kilometer')?distance:distance/1000)
    const calorieUnit=data.CALORIES_BURNED?.[0]?.key||''
    if(calories!==null)values.caloriesBurned=Math.max(0,calorieUnit.includes('kilocal')?calories:calories/1000)
    const hr=number('HEART_RATE'),glucoseRaw=number('BLOOD_GLUCOSE'),spo2=number('OXYGEN_SATURATION'),tempRaw=number('BODY_TEMPERATURE'),weightRaw=number('WEIGHT'),bodyFat=number('BODY_FAT_PERCENTAGE')
    if(hr!==null)values.hr=Math.round(hr)
    if(glucoseRaw!==null){const glucoseUnit=data.BLOOD_GLUCOSE?.[0]?.key||'';values.glucose=round1(glucoseUnit.includes('milligram')?glucoseRaw/18.0182:glucoseRaw)}
    if(spo2!==null)values.spo2=round1(spo2)
    if(tempRaw!==null){const tempUnit=data.BODY_TEMPERATURE?.[0]?.key||'';values.temp=round1(tempUnit.includes('fahrenheit')?(tempRaw-32)*5/9:tempRaw)}
    if(weightRaw!==null){const weightUnit=data.WEIGHT?.[0]?.key||'';values.weightKg=round1(weightUnit.includes('pound')?weightRaw*.453592:weightRaw)}
    if(bodyFat!==null)values.bodyFat=round1(bodyFat)
    const pressure=data.BLOOD_PRESSURE||[],systolic=pressure.find(item=>item.key.includes('systolic'))?.value,diastolic=pressure.find(item=>item.key.includes('diastolic'))?.value
    if(systolic&&diastolic)values.bp=`${Math.round(systolic)}/${Math.round(diastolic)}`
    const sleep=data.SLEEP||[],sleepHours=sleep.filter(item=>/hours/.test(item.key)).reduce((sum,item)=>sum+item.value,0),sleepMinutes=sleep.filter(item=>/minutes/.test(item.key)).reduce((sum,item)=>sum+item.value,0),sleepSeconds=sleep.filter(item=>/seconds/.test(item.key)).reduce((sum,item)=>sum+item.value,0),sleepMillis=sleep.filter(item=>/milliseconds/.test(item.key)).reduce((sum,item)=>sum+item.value,0)
    const importedSleepHours=sleepHours||sleepMinutes/60||sleepSeconds/3600||sleepMillis/3600000
    if(importedSleepHours>0&&importedSleepHours<=24)values.sleepHours=round1(importedSleepHours)
    if(!Object.keys(values).length){toast('Health Connect returned no readable records for this day. Check its permissions and the selected date.');return}
    let imported=state.healthImports.find(item=>item.date===selectedDate&&item.profileId===profile().id)
    if(!imported){imported={...recordBase(),source:'Health Connect'};state.healthImports.push(imported)}
    Object.assign(imported,values,{source:'Health Connect',syncedAt:new Date().toISOString()})
    if(values.weightKg){const existing=state.weights.find(item=>item.date===selectedDate&&item.profileId===profile().id&&item.source==='Health Connect');const weightLog=existing||{...recordBase(),source:'Health Connect'};Object.assign(weightLog,{kg:values.weightKg,bodyFat:values.bodyFat||0});if(!existing)state.weights.push(weightLog)}
    if(values.hr||values.glucose||values.spo2||values.temp||values.bp){const existing=state.vitals.find(item=>item.date===selectedDate&&item.profileId===profile().id&&item.source==='Health Connect');const vital=existing||{...recordBase(),source:'Health Connect'};Object.assign(vital,{hr:values.hr||0,glucose:values.glucose||0,spo2:values.spo2||0,temp:values.temp||0,bp:values.bp||''});if(!existing)state.vitals.push(vital)}
    if(values.sleepHours){const existing=state.sleeps.find(item=>item.date===selectedDate&&item.profileId===profile().id&&item.source==='Health Connect');const sleepLog=existing||{...recordBase(),source:'Health Connect'};Object.assign(sleepLog,{hours:values.sleepHours});if(!existing)state.sleeps.push(sleepLog)}
    state.settings.healthConnectLastSyncAt=new Date().toISOString()
    persist();render();toast(`Health Connect synced for ${dfmt(selectedDate)}. Imported values were saved on this device.`)
  }catch(error){toast(error.message||'Could not connect to Health Connect. Install or update it, then try again.')}
}
// Steps counted by the phone's own sensor keep accumulating while the screen is
// off; Health Connect holds that total. Reading it back on resume is what turns
// "the app was closed" into "today's steps are already there".
let stepSyncRunning = false
async function syncDeviceSteps({ silent = false } = {}) {
  if (stepSyncRunning) return null
  if (Capacitor.getPlatform() !== 'android') { if (!silent) toast('Device step sync needs the Android app with Health Connect.'); return null }
  stepSyncRunning = true
  try {
    const date = todayISO()
    const entries = await readHealthVariable('STEPS', 'SUM', localDayIso(date), localDayIso(date, 1))
    const steps = healthValue(entries, 'SUM')
    if (steps === null) { if (!silent) toast('Health Connect had no step records for today yet.'); return null }
    let imported = state.healthImports.find(item => item.date === date && item.profileId === profile().id)
    if (!imported) { imported = { ...recordBase(date), source: 'Health Connect' }; state.healthImports.push(imported) }
    const next = Math.max(0, Math.round(steps))
    imported.steps = next
    imported.source = 'Health Connect'
    imported.stepsSyncedAt = new Date().toISOString()
    state.settings.backgroundStepsSyncAt = imported.stepsSyncedAt
    persist()
    if (selectedDate === date) render()
    if (!silent) toast(`${nfmt(next)} device steps for today.`)
    return next
  } catch (error) {
    if (!silent) toast(error.message || 'Could not read steps from Health Connect.')
    return null
  } finally { stepSyncRunning = false }
}
function autoDeviceStepSync() {
  if (!state.settings.backgroundSteps) return
  if (!stepSyncDue(state.settings.backgroundStepsSyncAt)) return
  syncDeviceSteps({ silent: true })
}
async function toggleBackgroundSteps() {
  if (state.settings.backgroundSteps) {
    state.settings.backgroundSteps = false
    persist('Background step sync turned off. Steps you log by hand still count.')
    render()
    return
  }
  if (Capacitor.getPlatform() !== 'android') return toast('Background step sync needs the Android app. On web, add steps by hand or use phone motion counting.')
  try {
    await requestHealthAccess()
  } catch (error) { return toast(error.message || 'Health Connect permission was not granted.') }
  state.settings.backgroundSteps = true
  persist('Background steps on. Steps your phone counts while the screen is off sync when you open the app.')
  render()
  syncDeviceSteps({ silent: true })
}
async function saveCheckInReminder(time) {
  state.settings.reminderTime=time
  if(Capacitor.getPlatform()==='android'){
    try{
      await LocalNotifications.cancel({notifications:[{id:72001}]})
      if(time){const permission=await LocalNotifications.requestPermissions();if(permission.display!=='granted'){persist();render();return toast('Notification permission was not granted. The reminder is saved but will not alert.')}
        const [hour,minute]=time.split(':').map(Number)
        await LocalNotifications.schedule({notifications:[{id:72001,title:'AbsoluteCal check-in',body:'Open your private tracker to log anything you want to remember.',schedule:{on:{hour,minute},repeats:true,allowWhileIdle:true}}]})
      }
      persist(time?'Daily Android reminder scheduled.':'Android reminder turned off.');render();return
    }catch(error){state.settings.reminderTime='';persist();render();return toast(error.message||'Android could not schedule that reminder.')}
  }
  if(time&&'Notification'in window&&Notification.permission==='default')await Notification.requestPermission()
  if(time&&(!('Notification'in window)||Notification.permission!=='granted'))state.settings.reminderTime=''
  persist(state.settings.reminderTime?'Reminder saved. It runs while this app stays open.':'Reminder turned off or notification permission was not granted.');render()
}
async function handleAction(action,button) {
  const id=button.dataset.id
  if(action==='day-prev'||action==='day-next'){
    const step=action==='day-prev'?-1:1, date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+step)
    const next=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    if(step>0&&next>todayISO())return toast('That is the future — log today first.')
    selectedDate=next;render();return
  }
  if(action==='walk-start'){startWalkSession();return}
  if(action==='walk-pause'){pauseWalkSession();return}
  if(action==='walk-resume'){resumeWalkSession();return}
  if(action==='walk-finish'){finishWalkSession();return}
  if(action==='walk-discard'){if(confirm('Discard this session without saving it?'))discardWalkSession();return}
  if(action==='save-routes'){
    const next=state.settings.saveRoutes===false
    state.settings.saveRoutes=next
    persist(next?'Routes will be kept on this device so you can see them again.':'Routes are no longer saved; new walks keep distance only.')
    render();return
  }
  if(action==='walk-mode'){
    const mode=button.dataset.mode==='run'?'run':'walk'
    const paces=PACES_FOR(mode)
    state.settings.walkMode=mode
    // Keep the chosen pace when it exists in the new mode; otherwise pick the mode default.
    if(!paces.some(item=>item.id===state.settings.walkPace))state.settings.walkPace=paces[1].id
    saveState(state);render();return
  }
  if(action==='walk-checkin-skip'){finishPhoto='';photoTask=null;pendingCheckin=null;persist('Session saved.');render();return}
  if(action==='walk-delete'){removeRecord('walks',id);return}
  if(action==='walk-filter'){walkFilterMode=['walk','run'].includes(button.dataset.mode)?button.dataset.mode:'all';render();return}
  if(action==='copy-summary'){
    const s=scoped(),p=profile(),food=dayTotal(s),activity=dayActivity(s,selectedDate,p)
    const water=(s.water||[]).filter(item=>item.date===selectedDate).reduce((sum,item)=>sum+(Number(item.ml)||0),0)
    const sleep=(s.sleeps||[]).find(item=>item.date===selectedDate)
    const weight=(s.weights||[]).filter(item=>item.date===selectedDate).slice(-1)[0]
    const text=daySummaryText({date:selectedDate,kcal:food.kcal,target:targets()?.calorieTarget||0,steps:activity.steps,stepGoal:p.stepGoal,waterMl:water,waterGoalMl:p.waterGoalMl,sleepHours:Number(sleep?.hours)||0,weightKg:Number(weight?.kg)||0,walks:(s.walks||[]).filter(item=>item.date===selectedDate)})
    try{
      if(!navigator.clipboard?.writeText)throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      toast('Today’s numbers copied to the clipboard.')
    }catch{showCopyFallback(text)}
    return
  }
  if(action==='close-copy'){const host=$('#walk-checkin-host',root);if(host)host.innerHTML='';return}
  if(action==='steps-adjust'){
    const requested=Number(button.dataset.delta)||0
    if(!requested)return
    // Never subtract more steps than the day actually has; a negative total is
    // meaningless and breaks every average built on it.
    const current=Math.max(0, Math.round(dayActivity(scoped(),selectedDate,profile()).steps))
    const delta=requested<0?Math.max(requested,-current):requested
    if(!delta)return toast('There are no steps logged to remove today.')
    state.activities.push({...recordBase(),name:delta>0?'Steps added':'Steps removed',steps:delta,stepsOnly:true,minutes:0,met:1,calories:0,source:'correction'})
    persist(`${delta>0?'＋':'−'}${nfmt(Math.abs(delta))} steps adjusted.`);render();return
  }
  if(action==='export-walks'){exportWalks();toast('Walk CSV downloaded.');return}
  if(action==='add-to-slot'){
    pendingSlot=button.dataset.slot||'Snack'
    if(tab!=='food'){tab='food';render()}else{const label=$('#pending-slot',root);if(label)label.textContent=`Adding to ${pendingSlot}`}
    const field=$('#food-search',root);if(field){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus()}
    return
  }
  if(action==='range'){progressRange=Number(button.dataset.days)===30?30:7;render();return}
  if(action==='food-filter'){foodFilter=button.dataset.filter==='favorites'?'favorites':'all';render();return}
  if(action==='food-focus'){const field=$('#food-search',root);if(field){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus()}return}
  if(action==='food-preset'){const input=$(`#grams-${CSS.escape(id)}`,root);if(input){input.value=button.dataset.grams;input.focus();input.select?.()}return}
  if(action==='food-fav'){
    const list=new Set(state.favorites||[])
    if(list.has(id))list.delete(id);else list.add(id)
    state.favorites=[...list];persist();renderFoodResults();return
  }
  if(action==='slot-save-template'){
    const slot=button.dataset.slot||'Snack', items=dayMeals(scoped()).filter(item=>(item.slot||'Snack')===slot)
    if(!items.length)return toast('Log something in that meal first, then save it as a template.')
    state.templates.push({...recordBase(),name:`${slot} · ${dfmt(selectedDate).split(',')[0]}`,slot,date:selectedDate,kcal:Math.round(items.reduce((sum,item)=>sum+mealKcalOf(item),0)),items:items.map(item=>({name:item.name,grams:item.grams,nutrients:item.nutrients,slot}))})
    persist(`${slot} saved as a template.`);render();return
  }
  if(action==='template-apply'){
    const template=(state.templates||[]).find(item=>item.id===id);if(!template)return
    const templateItems=Array.isArray(template.items)?template.items:[]
    if(!templateItems.length)return toast('That template has no foods saved. Delete it or save the meal again.')
    for(const item of templateItems){state.meals.push({...recordBase(),name:item.name,grams:item.grams,nutrients:item.nutrients,slot:item.slot||template.slot,source:'Template'})}
    persist(`${template.name} added to your diary.`);render();return
  }
  if(action==='template-delete'){state.templates=(state.templates||[]).filter(item=>item.id!==id);persist('Template deleted.');render();return}
  if(action==='undo-delete'){
    if(!undoEntry)return toast('Nothing to undo.')
    const {collection,item,index,linked}=undoEntry, list=state[collection]||[]
    list.splice(Math.min(index,list.length),0,item);state[collection]=list
    for(const entry of linked||[]){if(!(state[entry.collection]||[]).some(row=>row.id===entry.item.id))(state[entry.collection]||[]).push(entry.item)}
    undoEntry=null
    persist('Entry restored.');render();return
  }
  if(action==='export-daily'){exportDaily();toast('Daily summary CSV downloaded.');return}
  if(action==='health-connect'){await requestHealthAccess().catch(error=>toast(error.message||'Could not open Health Connect permissions.'));return}
  if(action==='health-sync'){await syncHealthConnect();return}
  if(action==='background-steps'){toggleBackgroundSteps();return}
  if(action==='device-steps-sync'){syncDeviceSteps();return}
  if(action==='health-open'){try{assertAndroidHealth();await HealthFitness.openHealthConnect()}catch(error){toast(error.message||'Install Health Connect, then try again.')}return}
  if(action==='profile-new'){const name=prompt('Name this profile (stored only on this device):');if(name?.trim()){const p=createProfile(name.trim().slice(0,28));state.profiles.push(p);state.activeProfileId=p.id;persist('Profile added.');render()}return}
  if(action==='go-profile'){
    if(!document.querySelector('#profile-form',root)){tab='more';render()}
    const field=$('#profile-form input[name="age"]',root)
    if(field){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus()}
    return
  }
  if(action==='water-quick'){addQuickWater(button.dataset.ml);return}
  if(action==='onboard-dismiss'){try{localStorage.setItem('cc-onboard-dismissed','1')}catch{}
    render();return}
  if(action==='focus-food-search'){const field=$('#food-search',root);if(field){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus()}return}
  if(action==='copy-yesterday'){copyYesterdayMeals();return}
  if(action==='meal-duplicate'){duplicateMeal(id);return}
  if(action==='food-quick'){quickAddFood(button.dataset.name,button.dataset.grams,button.dataset.slot);return}
  if(action==='meal-add'){const food=allFoods().find(item=>item.id===id),grams=Number($(`#grams-${CSS.escape(id)}`,root)?.value||100),slot=$('#meal-slot',root)?.value||pendingSlot||'Snack';if(food)addMeal(food,grams,slot);return}
  if(action==='remove-record'){removeRecord(button.dataset.collection,id);return}
  if(action==='recipe-add'){const recipe=state.recipes.find(item=>item.id===id);if(recipe)addMeal({...recipe,id:recipe.id,cat:'Recipe',fi:0,su:0,na:0,serv:[['1 serving',100]]},100,$('#meal-slot',root)?.value||'Snack','Custom recipe');return}
  if(action==='barcode-start'){await startBarcodeScan();return}
  if(action==='barcode-save'){addBarcodeFood(button.dataset.food);return}
  if(action==='motion-toggle'){toggleMotion();return}
  if(action==='gps-toggle'){toggleGps();return}
  if(action==='rest-start'){startRestTimer();return}
  if(action==='fasting-start'){startFasting();return}
  if(action==='fasting-stop'){endFasting();return}
  if(action==='habit-toggle'){
    const current=scoped().habitLogs.find(item=>item.date===selectedDate&&item.habitId===id)
    if(current)state.habitLogs=state.habitLogs.filter(item=>item.id!==current.id);else state.habitLogs.push({...recordBase(),habitId:id})
    persist('Habit check-in updated.');render();return
  }
  if(action==='medicine-log'){state.medicineLogs.push({...recordBase(),itemId:id,at:new Date().toISOString()});persist('Medicine reminder logged.');render();return}
  if(action==='export-json'){
    download(`health-tracker-backup-${todayISO()}.json`,JSON.stringify(state,null,2),'application/json')
    // Remember the date so the backup nudge is honest about when it last happened.
    state.settings.lastBackupAt=new Date().toISOString();saveState(state)
    toast('Private JSON backup downloaded.');render();return
  }
  if(action==='export-meals'){exportMeals();toast('Meal CSV downloaded.');return}
  if(action==='print-report'){window.print();return}
  if(action==='clear-data'){if(confirm('This permanently clears all tracker data stored on this device. Export a backup first if you want to keep it.')){localStorage.removeItem(STORAGE_KEY);location.reload()}return}
}

root.addEventListener('click',event=>{
  const tabButton=event.target.closest('[data-tab]');if(tabButton){if(tabButton.dataset.tab!==''){setTab(tabButton.dataset.tab)}return}
  const button=event.target.closest('[data-action]');if(button){event.preventDefault();handleAction(button.dataset.action,button)}
})
root.addEventListener('change',async event=>{
  if(event.target.id==='walk-photo-start'&&event.target.files?.[0]){
    const photo=await readPhoto(event.target.files[0])
    if(photo&&activeWalk){activeWalk={...activeWalk,startPhoto:photo};saveWalk(activeWalk);pruneWalkPhotos();render();toast('Start photo added.')}
    return
  }
  if(event.target.id==='walk-photo-finish'&&event.target.files?.[0]){
    photoTask=readPhoto(event.target.files[0])
    finishPhoto=await photoTask
    const preview=$('#finish-photo-preview',root)
    if(preview&&finishPhoto)preview.innerHTML=`<img class="walk-photo" src="${finishPhoto}" alt="Photo taken at the finish">`
    if(!finishPhoto)photoTask=null
    return
  }
  const settingKey=event.target.dataset&&event.target.dataset.setting
  if(settingKey){applySetting(settingKey,event.target.value);return}
  const goalKey=event.target.dataset&&event.target.dataset.goal
  if(goalKey){applyGoal(goalKey,event.target.value);return}
  if(event.target.hasAttribute&&event.target.hasAttribute('data-food-sort')){
    foodSort=['protein','fiber','lowSugar','name'].includes(event.target.value)?event.target.value:'protein'
    renderFoodResults();return
  }
  if(event.target.id==='walk-pace'){state.settings.walkPace=event.target.value;saveState(state);return}
  if(event.target.id==='profile-select'){state.activeProfileId=event.target.value;persist();render();return}
  if(event.target.id==='day-select'){selectedDate=event.target.value||todayISO();render();return}
  if(event.target.id==='food-category'){foodCategory=event.target.value;renderFoodResults();return}
  if(event.target.id==='restore-file'&&event.target.files?.[0])restoreFile(event.target.files[0])
  if(event.target.id==='meal-photo'&&event.target.files?.[0])compressMealPhoto(event.target.files[0])
  if(event.target.id==='lab-report-photo'&&event.target.files?.[0])readLabReport(event.target.files[0])
})
root.addEventListener('input',event=>{
  if(event.target.id==='food-search'){foodQuery=event.target.value;renderFoodResults()}
  if(event.target.id==='feature-search'){featureQuery=event.target.value;const host=$('#feature-results',root);if(host)host.innerHTML=featureResultsHtml()}
})
window.addEventListener('keydown',event=>{
  const target=event.target
  if(!target||target.matches?.('input,select,textarea,[contenteditable="true"]')||event.metaKey||event.ctrlKey||event.altKey)return
  // Never hijack keys while the check-in dialog is waiting for an answer.
  if(pendingCheckin||document.querySelector('#walk-checkin-form'))return
  const tabs={'1':'today','2':'food','3':'activity','4':'health','5':'trends','6':'more'}
  if(tabs[event.key]){setTab(tabs[event.key]);return}
  if(event.key==='/'){event.preventDefault();if(tab!=='food')setTab('food');const field=$('#food-search',root);if(field){field.focus();field.select?.()}}
  if((event.key==='w'||event.key==='W')&&!activeWalk){event.preventDefault();startWalkSession()}
})
root.addEventListener('submit',event=>{event.preventDefault();const form=event.target;if(form.id==='barcode-form'){lookupBarcode(new FormData(form).get('barcode'));return}handleForm(form)})
window.addEventListener('beforeunload',()=>{stopBarcodeScan();stopMotionCount(false);if(gpsWatch!==null)navigator.geolocation?.clearWatch(gpsWatch);releaseWakeLock()})
// Browsers throttle or drop a location watch while the page is hidden; re-arm it
// when the walker comes back so the track keeps filling in instead of stalling.
if (typeof document !== 'undefined') {
  let wasHidden = document.visibilityState === 'hidden'
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { wasHidden = true; return }
    if (!wasHidden) return
    wasHidden = false
    if (!activeWalk) return
    requestWakeLock()
    if (navigator.geolocation) watchWalkLocation()
    paintWalkMetrics()
  })
}
async function restoreFile(file) {
  try { if(file.size>10*1024*1024)throw new Error('Backup is over 10 MB.');const value=normalizeState(JSON.parse(await file.text()));if(!Array.isArray(value.meals))throw new Error('This backup is not an AbsoluteCal export.');if(!confirm('Restore this backup? It replaces data currently stored on this device.'))return;Object.assign(state,value);persist('Backup restored on this device.');render() }
  catch(error){toast(error.message||'Could not restore the backup.')}
}
async function readLabReport(file) {
  const status=$('#lab-ocr-status',root)
  if(!file.type.startsWith('image/')||file.size>18*1024*1024){if(status)status.textContent='Choose an image smaller than 18 MB. PDF files are not supported yet.';return}
  if(status)status.textContent='Reading this report on your device. The image is not uploaded.'
  try{
    const {createWorker}=await import('tesseract.js');labOcrWorker ||= await createWorker('eng')
    const result=await labOcrWorker.recognize(file,{rotateAuto:true}),lines=String(result.data?.text||'').split(/\r?\n/).map(line=>line.replace(/[|]/g,'I').replace(/\s+/g,' ').trim()).filter(Boolean)
    const known=/\b(hemoglobin|haemoglobin|hba1c|a1c|cholesterol|ldl|hdl|triglyceride|apob|tsh|t3|t4|thyroid|ferritin|vitamin|creatinine|glucose|crp|c-reactive protein|platelet|white blood cell|wbc|red blood cell|rbc|egfr|alt|ast|albumin|sodium|potassium|calcium|magnesium|iron|b12|folate)\b/i
    const pattern=/^(.{3,60}?)\s+([<>]?\s*\d{1,5}(?:[.,]\d{1,5})?)\s*([a-zA-Zµμ/%][a-zA-Zµμ/%0-9.^-]{0,17})?(?:\s+(.{1,45}))?$/
    const matches=lines.map(line=>({line,match:line.match(pattern)})).filter(item=>known.test(item.line)&&item.match)
    if(!matches.length){if(status)status.textContent='No clear lab values found. Enter the result manually, or try a sharper, straight-on report photo.';return}
    const [first]=matches,form=$('#lab-form',root)
    if(form){form.elements.name.value=first.match[1].trim().replace(/[:*]+$/,'');form.elements.value.value=first.match[2].replace(/\s/g,'').replace(',','.');form.elements.unit.value=(first.match[3]||'').trim().slice(0,20);form.elements.note.value=(first.match[4]||'OCR suggestion — verify against original').trim().slice(0,80)}
    if(status)status.textContent=`Found ${matches.length} possible result${matches.length===1?'':'s'}. Filled the first suggestion (${first.match[1].trim()}: ${first.match[2].trim()} ${first.match[3]||''}); review it and press Save personal result. Nothing was saved automatically.`
  }catch(error){if(status)status.textContent=error.message||'Could not read this image. Try another photo or enter the result manually.'}
}
async function compressMealPhoto(file) {
  if(!file.type.startsWith('image/')||file.size>12*1024*1024)return toast('Choose an image smaller than 12 MB.')
  try {const image=new Image(),url=URL.createObjectURL(file);image.src=url;await image.decode();URL.revokeObjectURL(url);const canvas=document.createElement('canvas'),scale=Math.min(1,720/image.naturalWidth);canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);photoData=canvas.toDataURL('image/jpeg',.7);photoAt=Date.now();toast('Small meal photo attached locally to the next meal.')}catch{toast('Could not load the meal photo.')}}

/* ---------------- Walk session ---------------- */
function startWalkSession() {
  if (activeWalk) return toast('A session is already running.')
  // Never carry a half-read photo from a previous check-in into a new session.
  finishPhoto = ''
  photoTask = null
  const mode = walkMode()
  const modes = PACES_FOR(mode)
  const pace = modes.some(item => item.id === state.settings.walkPace) ? state.settings.walkPace : modes[1].id
  activeWalk = { ...emptyWalk(), mode, pace }
  walkRoute = []
  walkFilter = createGpsFilter()
  walkGps = null
  saveWalk(activeWalk)
  watchWalkLocation()
  startWalkClock()
  render()
  toast(`${mode === 'run' ? 'Run' : 'Walk'} started. Keep the screen open.`)
}
function watchWalkLocation() {
  stopWalkLocation()
  gpsError = ''
  if (!navigator.geolocation) { gpsError = 'GPS is not available on this device. Distance uses your pace and stride.'; paintWalkMetrics(); return }
  walkFilter = walkFilter || createGpsFilter()
  requestWakeLock()
  try {
    walkWatch = navigator.geolocation.watchPosition(onGpsFix, onGpsError, {
      // Ask for the most precise source the device has, and never reuse a stale
      // fix: a 4-second-old position makes distance lag behind the walker.
      enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
    })
  } catch {
    walkWatch = null
    gpsError = 'GPS could not start. Distance uses your pace and stride.'
    paintWalkMetrics()
  }
}
function onGpsFix(position) {
  if (!activeWalk || !walkFilter) return
  if (!position?.coords) return
  if (activeWalk.pauseStartedAt) { paintWalkMetrics(); return }
  const result = walkFilter.push(position.coords, Date.now())
  walkGps = result
  gpsError = ''
  if (result.acceptedPoint) {
    // Keep the raw track for the map, thinned to roughly one point per 4 m so a
    // long walk stays small in localStorage. The distance maths is untouched.
    const fix = { lat: Number(position.coords.latitude), lon: Number(position.coords.longitude) }
    const lastPoint = walkRoute[walkRoute.length - 1]
    if (Number.isFinite(fix.lat) && Number.isFinite(fix.lon) && (!lastPoint || Math.abs(fix.lat - lastPoint.lat) > 0.00001 || Math.abs(fix.lon - lastPoint.lon) > 0.00001)) {
      walkRoute.push(fix)
      if (walkRoute.length > 4000) walkRoute = walkRoute.slice(-4000)
    }
    activeWalk = {
      ...activeWalk,
      distanceM: Math.round(result.distanceM),
      gps: result.distanceM >= 20,
      points: result.accepted,
      gpsAccuracy: Math.round(result.accuracy),
      gpsSpeedKmh: result.speedKmh || 0,
      moving: Boolean(result.moving),
      route: walkRoute,
    }
    saveWalk(activeWalk)
  }
  paintWalkMetrics()
}
function onGpsError(error) {
  gpsError = gpsErrorMessage(error)
  if (Number(error?.code) === 1) walkWatch = null
  paintWalkMetrics()
}
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen')
  } catch { wakeLock = null }
}
function releaseWakeLock() {
  try { wakeLock?.release?.() } catch { /* already released */ }
  wakeLock = null
}
function stopWalkLocation() {
  if (walkWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(walkWatch)
  walkWatch = null
  releaseWakeLock()
}
function gpsLine() {
  if (gpsError) return gpsError
  if (!walkGps) return activeWalk?.gpsAccuracy ? `GPS ±${activeWalk.gpsAccuracy} m` : 'Searching for a GPS signal…'
  const quality = walkGps.quality || gpsQuality(walkGps.accuracy)
  const stale = walkGps.lastAt && Date.now() - walkGps.lastAt > 12000
  if (stale) return `GPS ±${Math.round(walkGps.accuracy)} m · no fix for ${Math.max(1, Math.round((Date.now() - walkGps.lastAt) / 1000))} s — distance is paused`
  if (quality.level === 'poor' || quality.level === 'waiting') return quality.detail
  const speed = walkGps.speedKmh ? `${walkGps.speedKmh} km/h` : ''
  if (walkGps.lost) return 'Signal lost — move into the open. Distance is paused.'
  return `${quality.label} · ${walkGps.moving ? `Moving${speed ? ` ${speed}` : ''}` : 'Standing still'} · ${nfmt(walkGps.accepted)} fixes`
}
function paintWalkMap() {
  const line = document.getElementById('walk-map-path')
  if (!line) return
  const route = routePath(walkRoute, { width: 320, height: 180 })
  const start = document.getElementById('walk-map-start')
  const end = document.getElementById('walk-map-end')
  const note = document.getElementById('walk-map-note')
  if (!route) {
    line.setAttribute('points', '')
    start?.setAttribute('r', '0')
    end?.setAttribute('r', '0')
    if (note) note.textContent = 'Route appears once GPS locks. It is drawn on this device only — no map tiles, nothing uploaded.'
    return
  }
  line.setAttribute('points', route.points)
  start?.setAttribute('cx', route.start.x); start?.setAttribute('cy', route.start.y); start?.setAttribute('r', '4.5')
  end?.setAttribute('cx', route.end.x); end?.setAttribute('cy', route.end.y); end?.setAttribute('r', '5.5')
  if (note) note.textContent = `Shape of your ${formatDistance(route.distanceM / 1000, unitsPref())} so far · ${nfmt(route.count)} points, stored on this device only.`
}
function startWalkClock() {
  clearInterval(walkTimer)
  walkTimer = setInterval(paintWalkMetrics, 1000)
}
function paintWalkMetrics() {
  if (!activeWalk) return
  const summary = walkSummary(activeWalk, profile().weightKg, strideOf(profile()))
  const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text }
  set('walk-elapsed', formatDuration(summary.ms))
  set('walk-distance', formatDistance(summary.distanceKm, unitsPref()))
  set('walk-steps', nfmt(summary.steps))
  set('walk-kcal', nfmt(summary.calories))
  set('walk-pace-label', summary.pacePerKm)
  set('walk-speed', `${summary.speed} km/h`)
  set('walk-source', summary.source)
  const foot = document.getElementById('walk-foot')
  if (foot) foot.textContent = activeWalk.gps
    ? `GPS distance from ${nfmt(activeWalk.points || 0)} accepted fixes; jitter and signal jumps are ignored. Standing still does not add distance. Keep this screen open while you move.`
    : 'Until GPS locks, distance and steps come from your pace and stride. Keep this screen open while you move.'
  const gpsText = document.getElementById('walk-gps-text')
  if (gpsText) gpsText.textContent = gpsLine()
  paintWalkMap()
  const freshGps = Boolean(walkGps && walkGps.lastAt && Date.now() - walkGps.lastAt < 12000)
  const dot = document.getElementById('walk-gps-dot')
  if (dot) {
    const level = walkGps?.quality ? walkGps.quality.level : 'waiting'
    dot.className = `walk-gps__dot ${gpsError || !freshGps ? 'bad' : walkGps.moving ? 'moving' : level === 'fair' || level === 'poor' || level === 'waiting' ? 'weak' : 'still'}`
  }
  const move = document.getElementById('walk-move')
  if (move) {
    const label = freshGps ? (walkGps.moving ? 'Moving' : 'Standing still') : activeWalk.gps ? 'Signal lost' : 'No GPS yet'
    move.textContent = label
    move.className = `cc-chip walk-move ${freshGps && walkGps.moving ? 'on' : ''}`
  }
}
function pauseWalkSession() {
  if (!activeWalk || activeWalk.pauseStartedAt) return
  activeWalk = { ...activeWalk, pauseStartedAt: Date.now(), gpsSpeedKmh: 0, moving: false }
  saveWalk(activeWalk)
  render()
}
function resumeWalkSession() {
  if (!activeWalk || !activeWalk.pauseStartedAt) return
  activeWalk = { ...activeWalk, pausedMs: (Number(activeWalk.pausedMs) || 0) + (Date.now() - activeWalk.pauseStartedAt), pauseStartedAt: 0 }
  saveWalk(activeWalk)
  render()
}
function finishWalkSession() {
  if (!activeWalk) return
  if (walkFilter && !activeWalk.pauseStartedAt) {
    // Count the last leg the smoothing window was still trailing.
    const settledM = walkFilter.settle()
    activeWalk = { ...activeWalk, distanceM: Math.round(settledM), gps: settledM >= 20 }
  }
  const p = profile()
  const summary = walkSummary(activeWalk, p.weightKg, strideOf(p))
  if (summary.minutes < 0.2) { discardWalkSession(); return toast('That session was too short to save.') }
  const minutes = Math.max(1, Math.round(summary.minutes))
  const walkId = activeWalk.id
  const base = recordBase()
  const label = summary.mode === 'run' ? 'Run' : 'Walk'
  state.activities.push({
    ...base, walkId, name: label, minutes, met: summary.met,
    distanceKm: summary.distanceKm, steps: summary.steps, calories: summary.calories,
    source: summary.source === 'GPS' ? 'GPS walk' : 'Walk timer', pace: activeWalk.pace, mode: summary.mode,
    gpsAccuracy: activeWalk.gpsAccuracy || 0,
  })
  // Routes are worth keeping only if the walker wants them; the setting is in
  // the walking card and defaults on, since a route you cannot see again is not
  // a GPS feature. They never leave this device.
  const keepRoute = state.settings.saveRoutes !== false && walkRoute.length > 1
  const walkRecord = {
    ...recordBase(), id: walkId, minutes, distanceKm: summary.distanceKm, steps: summary.steps,
    calories: summary.calories, pace: activeWalk.pace, mode: summary.mode, met: summary.met,
    startedAt: new Date(activeWalk.startedAt).toISOString(), startPhoto: activeWalk.startPhoto || '',
    endPhoto: '', checkin: null, source: summary.source, gpsAccuracy: activeWalk.gpsAccuracy || 0,
    ...(keepRoute ? { route: walkRoute, routeKm: summary.distanceKm } : {}),
  }
  state.walks.push(walkRecord)
  stopWalkLocation()
  walkFilter = null
  walkGps = null
  walkRoute = []
  clearInterval(walkTimer)
  walkTimer = 0
  activeWalk = null
  clearWalk()
  finishPhoto = ''
  pendingCheckin = { walkId, record: walkRecord, summary }
  if (!saveState(state)) toast('Storage is full. Export a backup and remove some photos.')
  render()
}
function discardWalkSession() {
  finishPhoto = ''
  photoTask = null
  stopWalkLocation()
  walkFilter = null
  walkGps = null
  walkRoute = []
  clearInterval(walkTimer)
  walkTimer = 0
  activeWalk = null
  clearWalk()
  toast('Walk discarded.')
  render()
}

/* ---------------- Page extras ---------------- */
function walkRouteSvg(route) {
  const drawn = routePath(route, { width: 320, height: 130, padding: 10 })
  if (!drawn) return ''
  return `<svg class="walk-map walk-map--mini" viewBox="0 0 320 130" role="img" aria-label="Route of this session"><polyline class="walk-map__line" points="${drawn.points}"></polyline><circle class="walk-map__start" r="4" cx="${drawn.start.x}" cy="${drawn.start.y}"></circle><circle class="walk-map__end" r="5" cx="${drawn.end.x}" cy="${drawn.end.y}"></circle></svg>`
}
function walkHistoryRow(item) {
  const check = item.checkin
  const photo = item.startPhoto || item.endPhoto
  return `<div class="walk-row"><div class="walk-row__main">
    <div class="walk-row__title">${item.mode === 'run' ? '🏃' : '🚶'} ${esc(item.date)} · ${nfmt(item.minutes)} min</div>
    <div class="walk-row__meta">${formatDistance(item.distanceKm, unitsPref())} · ${nfmt(item.steps)} steps · ${nfmt(item.calories)} kcal${item.met ? ` · ${item.met} MET` : ''}${item.gpsAccuracy ? ` · GPS ±${nfmt(item.gpsAccuracy)} m` : ''}</div>
    ${check ? `<div class="walk-row__tags"><span class="tag">${esc(check.with || 'Alone')}</span><span class="tag">${esc(check.feel || '')}</span><span class="tag">${esc(check.place || '')}</span>${check.weather ? `<span class="tag">${esc(check.weather)}</span>` : ''}</div>` : ''}
    ${check?.notes ? `<p class="cc-small" style="margin:6px 0 0">“${esc(check.notes)}”</p>` : ''}
    ${walkRouteSvg(item.route)}
  </div><div class="walk-row__aside">${photo ? `<img class="walk-thumb" src="${photo}" alt="${item.startPhoto ? 'Start' : 'Finish'} photo">` : ''}<button type="button" class="cc-icon-btn" data-action="walk-delete" data-id="${esc(item.id)}" aria-label="Delete this ${esc(item.mode === 'run' ? 'run' : 'walk')} session">×</button></div></div>`
}
function extraActivity() {
  const s = scoped(), p = profile(), activity = dayActivity(s, selectedDate, p)
  const steps = Math.max(0, activity.steps)
  const source = stepSourceToday(activity)
  const info = stepSourceInfo(source)
  // Walks belong to a profile like every other record; unscoped history would
  // show another person's sessions on this dashboard.
  const walks = (s.walks || []).slice().reverse()
  const shownWalks = walkFilterMode === 'all' ? walks : walks.filter(item => (item.mode === 'run' ? 'run' : 'walk') === walkFilterMode)
  const totalKm = walks.reduce((sum, item) => sum + (Number(item.distanceKm) || 0), 0)
  const totalMinutes = walks.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0)
  const totalKcal = walks.reduce((sum, item) => sum + (Number(item.calories) || 0), 0)
  const companions = {}
  for (const item of walks) if (item.checkin?.with) companions[item.checkin.with] = (companions[item.checkin.with] || 0) + 1
  const topCompanion = Object.entries(companions).sort((a, b) => b[1] - a[1])[0]
  const stride = strideOf(p)
  const week = weeklyActiveMinutes(s.walks, selectedDate, p.id, state.settings.weeklyWalkGoal || 150)
  const streak = stepGoalStreak(s, p.stepGoal, selectedDate, p.id, 120)
  return `<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Step accuracy</h3><small class="cc-muted">Source: ${esc(info.label)}</small></div></div>
      <p class="cc-small">${esc(info.detail)}</p>
      <div class="cc-actions"><button class="primary" type="button" data-action="motion-toggle">${stepDetector ? 'Stop and save count' : 'Count steps with this phone'}</button><button type="button" data-action="steps-adjust" data-delta="250">＋250 steps</button><button type="button" data-action="steps-adjust" data-delta="-250">−250 steps</button></div>
      <div id="motion-status" class="cc-small cc-muted" aria-live="polite"></div>
      <div style="display:grid;gap:16px;margin-top:14px">
        <form class="cc-form" id="stride-form"><label class="cc-field"><span>Stride length (cm)</span><input name="strideCm" type="number" min="30" max="160" step="1" value="${Math.round(stride * 100)}"></label><div class="cc-actions"><button type="submit">Save stride</button></div><p class="cc-small">Used to turn steps into distance. Estimate it from height, or calibrate below.</p></form>
        <form class="cc-form" id="calibrate-form"><label class="cc-field"><span>Calibrate: steps counted</span><input name="steps" type="number" min="20" max="20000" placeholder="200"></label><label class="cc-field"><span>Distance walked (m)</span><input name="metres" type="number" min="10" max="20000" placeholder="150"></label><div class="cc-actions"><button type="submit">Calculate stride</button></div><p class="cc-small">Walk a measured stretch (a 400 m track or a tape-measured path) and enter both numbers. This is the single biggest accuracy win.</p></form>
      </div></article>
    <article class="cc-card cc-card--third"><h3>Your walking</h3>${nutrientLine('Sessions', nfmt(walks.length))}${nutrientLine('Total distance', formatDistance(totalKm, unitsPref()))}${nutrientLine('Total time', `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`)}${nutrientLine('Total burned', `${nfmt(totalKcal)} kcal`)}<p class="cc-small">${topCompanion ? `Most often with: <b>${esc(topCompanion[0])}</b> (${topCompanion[1]} sessions).` : 'Answer the check-in after a session and this fills in.'}</p><div class="cc-actions"><button type="button" data-action="export-walks">Download walk CSV</button></div><div class="settings-row"><div><b>Save GPS routes</b><small>Keeps the shape of each walk in this app so you can see it again. Routes are never uploaded.</small></div><button type="button" data-action="save-routes" aria-pressed="${state.settings.saveRoutes === false ? 'false' : 'true'}">${state.settings.saveRoutes === false ? 'Off' : 'On'}</button></div></article>
    <article class="cc-card cc-card--third"><h3>This week</h3><div class="cc-stat">${nfmt(week.minutes)} <small>/ ${nfmt(week.goal)} active min</small></div>${progressBar(week.minutes, week.goal, week.percent >= 100)}<p class="cc-small">${week.sessions} session${week.sessions === 1 ? '' : 's'} in the last 7 days. 150 minutes a week is the common public-health guideline for adults; it is a target, not a prescription.</p><form class="cc-form" id="weekly-goal-form"><label class="cc-field"><span>Weekly active-minute goal</span><input name="goal" type="number" min="30" max="1500" step="10" value="${esc(week.goal)}"></label><div class="cc-actions"><button type="submit">Save goal</button></div></form><div class="cc-row"><span>Step-goal streak</span><strong>${streak.current} day${streak.current === 1 ? '' : 's'} · best ${streak.best}</strong></div></article>
    <article class="cc-card cc-card--third"><h3>Custom activity</h3><p class="cc-small">Anything the list misses. MET is how intense it feels: 2 is easy, 8 is hard.</p><form class="cc-form" id="custom-activity-form"><label class="cc-field"><span>Name</span><input name="name" required maxlength="50" placeholder="Badminton with friends"></label><div class="cc-fields"><label class="cc-field"><span>Minutes</span><input name="minutes" type="number" min="1" max="1440" required value="30"></label><label class="cc-field"><span>MET</span><input name="met" type="number" min="1" max="20" step="0.1" value="4"></label></div><div class="cc-actions"><button class="primary" type="submit">Log activity</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Step goal</h3><div class="cc-stat">${nfmt(p.stepGoal)} <small>steps / day</small></div>${progressBar(steps, p.stepGoal, true)}<form class="cc-form" id="step-goal-form"><label class="cc-field"><span>Daily step goal</span><input name="stepGoal" type="number" min="500" max="50000" step="500" value="${esc(p.stepGoal)}"></label><div class="cc-actions"><button type="submit">Save goal</button></div></form><p class="cc-small">Today: ${nfmt(steps)} steps ≈ ${formatDistance(distanceForSteps(steps, stride), unitsPref())}.</p></article>
    <article class="cc-card cc-card--wide"><div class="cc-row" style="border:0;padding-top:0"><div><h3 style="margin:0">Walk &amp; run history</h3><small class="cc-muted">Photos, route maps and the answers from each finish check-in.</small></div><div class="seg">${['all', 'walk', 'run'].map(mode => `<button type="button" data-action="walk-filter" data-mode="${mode}" class="${walkFilterMode === mode ? 'on' : ''}">${mode === 'all' ? 'All' : mode === 'walk' ? 'Walks' : 'Runs'}</button>`).join('')}</div></div>${shownWalks.length ? `<div class="walk-list">${shownWalks.slice(0, 20).map(walkHistoryRow).join('')}</div>${walks.length > 20 ? `<p class="cc-small">Showing the 20 most recent of ${walks.length} sessions. The CSV export includes all of them.</p>` : ''}` : empty(walkFilterMode === 'all' ? 'No timed sessions yet. Start one from the dashboard.' : `No ${walkFilterMode === 'run' ? 'runs' : 'walks'} recorded yet.`, '<button class="primary" type="button" data-action="walk-start">Start a walk</button>')}</article>
  </div>`
}
function extraHealth() {
  const s = scoped(), p = profile(), t = targets()
  const latest = weightEntries(s, selectedDate).slice(-1)[0]
  const bmi = t?.bmi || (p.heightCm && p.weightKg ? Number((Number(p.weightKg) / ((Number(p.heightCm) / 100) ** 2)).toFixed(1)) : null)
  const category = bmiCategory(bmi)
  const measure = s.measurements.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).slice(-1)[0]
  const imperial = unitsPref()==='imperial'
  const cmText = cm => { if(!Number(cm)) return '—'; return imperial ? `${Math.round(Number(cm)/2.54*10)/10} in` : `${Math.round(Number(cm)*10)/10} cm` }
  const fieldValue = cm => esc(Number(cm)?(imperial?Math.round(Number(cm)/2.54*10)/10:Number(cm)):'')
  const vitalsNewest = s.vitals.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const bpEntry = vitalsNewest.find(item => item.bp)
  const bp = bpEntry ? bpCategory(bpEntry.bp) : null
  const glucose = glucoseStats(s.glucose, selectedDate, 7, p.id)
  const glucoseList = s.glucose.filter(item => Number(item.value) > 0).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6)
  const sleepHabit = sleepConsistency(s.sleeps, selectedDate, 14, p.id)
  const symptomTop = symptomFrequency(s.symptoms, selectedDate, 30, p.id)
  const adherence = medicationAdherence(s.supplements, s.medicineLogs, selectedDate, 7, p.id)
  const fasting = fastingSummary(s.fastingSessions, p.id)
  const labName = latestLabName(s.labResults, p.id)
  const labPoints = labSeries(s.labResults, labName, p.id)
  const cycle = daysSinceLast(s.cycleLogs, selectedDate, p.id)
  return `<div class="tracker-grid">
    <article class="cc-card cc-card--third"><h3>Body mass index</h3><div class="cc-stat">${bmi ?? '—'} ${category ? `<small>${esc(category.label)}</small>` : ''}</div><p class="cc-small">BMI is a rough population measure. It does not account for muscle, bone or body composition, and it is not a diagnosis.</p></article>
    <article class="cc-card cc-card--third"><h3>Energy baseline</h3><div class="cc-stat">${t ? nfmt(t.bmr) : '—'} <small>kcal · resting</small></div>${t ? nutrientLine('Maintenance estimate', t.maintenance, 'kcal') : ''}${t ? nutrientLine('Daily target', t.calorieTarget, 'kcal') : ''}<p class="cc-small">Mifflin–St Jeor estimate. Real needs vary day to day.</p></article>
    <article class="cc-card cc-card--third"><h3>Body measurements</h3><div class="cc-fields">${measure ? `<div><p class="cc-small cc-muted" style="margin:0">LAST · ${esc(measure.date)}</p><p class="cc-small" style="margin:2px 0 0">Waist ${cmText(measure.waistCm)} · Chest ${cmText(measure.chestCm)} · Hips ${cmText(measure.hipsCm)}</p></div>` : ''}</div><form class="cc-form" id="measure-form"><div class="cc-fields"><label class="cc-field"><span>Waist (${imperial?'in':'cm'})</span><input name="waistCm" type="number" min="${imperial?8:20}" max="${imperial?98:250}" step=".1" value="${fieldValue(measure?.waistCm)}"></label><label class="cc-field"><span>Chest (${imperial?'in':'cm'})</span><input name="chestCm" type="number" min="${imperial?8:20}" max="${imperial?98:250}" step=".1" value="${fieldValue(measure?.chestCm)}"></label><label class="cc-field"><span>Hips (${imperial?'in':'cm'})</span><input name="hipsCm" type="number" min="${imperial?8:20}" max="${imperial?98:250}" step=".1" value="${fieldValue(measure?.hipsCm)}"></label></div><div class="cc-actions"><button type="submit">Save measurements</button></div></form>${latest ? `<p class="cc-small" style="margin-top:8px">Latest weigh-in ${formatWeight(latest.kg, unitsPref())} on ${esc(latest.date)}.</p>` : ''}</article>
    <article class="cc-card cc-card--third"><h3>Blood pressure</h3>${bp ? `<div class="cc-stat">${bp.systolic}<small> / ${bp.diastolic} mmHg</small></div><div class="cc-row"><span>Reading</span><strong>${esc(bp.label)}</strong></div><p class="cc-small">${esc(bp.detail)} Latest entry ${esc(bpEntry.date)}.</p>` : '<p class="cc-small">Log a blood-pressure reading above and its usual band appears here.</p>'}</article>
    <article class="cc-card cc-card--third"><h3>Glucose log</h3><div class="cc-stat">${glucose.average ?? '—'} <small>mmol/L · 7-day average</small></div>${nutrientLine('Readings', glucose.count)}${nutrientLine('Inside 3.9–7.8', glucose.inRange)}${nutrientLine('Below range', glucose.low)}${nutrientLine('Above range', glucose.high)}${glucoseList.length ? `<div class="cc-list">${glucoseList.map(item => `<div class="cc-list-item"><span><b>${round1(item.value)} mmol/L</b><small>${esc(item.date)}${item.source ? ` · ${esc(item.source)}` : ''}</small></span></div>`).join('')}</div>` : '<p class="cc-small">No readings in the last 7 days.</p>'}<p class="cc-small">3.9–7.8 mmol/L is a common general reference band, not a target for your situation. Ask a clinician what applies to you.</p></article>
    <article class="cc-card cc-card--third"><h3>Sleep timing</h3>${sleepHabit.spreadMin === null ? `<p class="cc-small">${esc(sleepHabit.label)}</p>` : `<div class="cc-stat">± ${nfmt(sleepHabit.spreadMin / 2)} <small>min · usual variation</small></div><div class="cc-row"><span>Bedtimes compared</span><strong>${sleepHabit.nights} nights</strong></div><div class="cc-row"><span>Bedtime spread</span><strong>${nfmt(sleepHabit.spreadMin)} min</strong></div><p class="cc-small">${esc(sleepHabit.label)}. Built from the bedtimes you typed in the sleep card.</p>`}</article>
    <article class="cc-card cc-card--third"><h3>Repeat patterns</h3>${symptomTop.length ? `<div class="cc-list">${symptomTop.map(item => `<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${item.count} time${item.count === 1 ? '' : 's'} in 30 days</small></span></div>`).join('')}</div>` : '<p class="cc-small">No symptoms logged in the last 30 days.</p>'}<div class="cc-row"><span>Last cycle note</span><strong>${cycle ? `${esc(cycle.last)} · ${cycle.days} day${cycle.days === 1 ? '' : 's'} ago` : 'None yet'}</strong></div><p class="cc-small">Counting repeats of your own notes. Nothing here interprets a symptom or a cycle.</p></article>
    <article class="cc-card cc-card--third"><h3>Reminder adherence</h3><div class="cc-stat">${adherence.percent === null ? '—' : `${adherence.percent}%`} <small>last 7 days</small></div>${adherence.percent === null ? '<p class="cc-small">Add a medicine or supplement reminder in More, then tick it off here.</p>' : `${nutrientLine('Ticked off', adherence.taken)}${nutrientLine('Possible check-ins', adherence.expected)}<p class="cc-small">This counts only the reminders you created and ticked. It is not a measure of whether a medicine was taken.</p>`}</article>
    <article class="cc-card cc-card--third"><h3>Fasting history</h3>${fasting.count ? `<div class="cc-stat">${fasting.averageHours} <small>h · average of ${fasting.count}</small></div><div class="cc-list">${fasting.recent.map(item => `<div class="cc-list-item"><span><b>${item.hours} h</b><small>${esc(item.date)}</small></span></div>`).join('')}</div>` : '<p class="cc-small">Finished fasts appear here with their length.</p>'}<p class="cc-small">Elapsed time only. This app makes no claim about fasting benefits or safety.</p></article>
    <article class="cc-card cc-card--third"><h3>Lab trend</h3>${labPoints.length > 1 ? `<div class="cc-stat">${round1(labPoints[labPoints.length - 1].value)} <small>${esc(labPoints[labPoints.length - 1].unit)} · ${esc(labName)}</small></div>${nutrientLine('Earliest', `${round1(labPoints[0].value)} ${labPoints[0].unit || ''}`)}${nutrientLine('Change', `${round1(labPoints[labPoints.length - 1].value - labPoints[0].value)} ${labPoints[0].unit || ''}`)}${nutrientLine('Readings', labPoints.length)}<p class="cc-small">Same test name only: ${esc(labPoints.map(item => item.date).join(', '))}. Values are what you entered; compare them with the original report.</p>` : `<p class="cc-small">${labPoints.length === 1 ? `Only one ${esc(labName)} reading so far (${esc(labPoints[0].date)}). Log the same test name again to see a change.` : 'Save the same lab test name on two dates to see a trend.'}</p>`}</article>
  </div>`
}
function settingsCard() {
  const sets = state.settings
  const p = profile()
  const paceList = PACES_FOR(walkMode())
  const option = (value, current, label) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`
  return `<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><h3>Settings</h3><p class="cc-small">Change how the app looks and how it measures things. Everything applies immediately.</p>
      <div class="settings-grid">
        <div>
          <div class="settings-row"><div><b>Units</b><small>Weight, distance, water and height</small></div><select data-setting="units">${option('metric', sets.units, 'Metric · kg, km')}${option('imperial', sets.units, 'Imperial · lb, mi')}</select></div>
          <div class="settings-row"><div><b>Theme</b><small>Light or dark</small></div><select data-setting="theme">${option('light', sets.theme, 'Light')}${option('dark', sets.theme, 'Dark')}</select></div>
          <div class="settings-row"><div><b>Text size</b><small>Comfortable or extra large</small></div><select data-setting="fontScale">${option('large', sets.fontScale, 'Large')}${option('xl', sets.fontScale, 'Extra large')}</select></div>
          <div class="settings-row"><div><b>Daily tip</b><small>Show a tip on the dashboard</small></div><select data-setting="tips">${option('true', String(sets.tips !== false), 'Show')}${option('false', String(sets.tips === false), 'Hide')}</select></div>
        </div>
        <div>
          <div class="settings-row"><div><b>Add exercise back to goal</b><small>MyFitnessPal-style net calories</small></div><select data-setting="calorieAdjust">${option('true', String(sets.calorieAdjust !== false), 'Yes, add it back')}${option('false', String(sets.calorieAdjust === false), 'No, keep goal fixed')}</select></div>
          <div class="settings-row"><div><b>Default pace</b><small>Used to estimate burn (${walkMode() === 'run' ? 'run' : 'walk'} paces)</small></div><select data-setting="walkPace">${paceList.map(item => option(item.id, sets.walkPace, `${esc(item.label)} · ${esc(item.hint)}`)).join('')}</select></div>
          <div class="settings-row"><div><b>Water presets</b><small>Quick-add amounts in ml</small></div><div style="display:flex;gap:6px"><input data-setting="waterPreset0" type="number" min="50" max="2000" step="50" value="${esc((sets.waterPresets || [250, 500, 750])[0])}"><input data-setting="waterPreset1" type="number" min="50" max="2000" step="50" value="${esc((sets.waterPresets || [250, 500, 750])[1])}"><input data-setting="waterPreset2" type="number" min="50" max="2000" step="50" value="${esc((sets.waterPresets || [250, 500, 750])[2])}"></div></div>
        </div>
      </div></article>
    <article class="cc-card cc-card--wide"><h3>Goals</h3>
      <div class="settings-grid">
        <div>
          <div class="settings-row"><div><b>Goal weight</b><small>Shown on the weight chart</small></div><input data-goal="goalWeightKg" type="number" min="20" max="350" step="0.1" value="${esc(p.goalWeightKg || '')}" placeholder="kg"></div>
          <div class="settings-row"><div><b>Protein per kg</b><small>Used for the protein target</small></div><input data-goal="proteinPerKg" type="number" min="0.8" max="3" step="0.1" value="${esc(sets.proteinPerKg || 1.4)}"></div>
          <div class="settings-row"><div><b>Daily calorie goal</b><small>Leave blank for the estimate</small></div><input data-goal="calorieOverride" type="number" min="900" max="6000" step="10" value="${esc(p.calorieOverride || '')}" placeholder="auto"></div>
        </div>
        <div>
          <div class="settings-row"><div><b>Fiber goal (g)</b><small>Fiber tracked on the diary</small></div><input data-setting="fiberGoal" type="number" min="5" max="100" step="1" value="${esc(sets.fiberGoal)}"></div>
          <div class="settings-row"><div><b>Sugar limit (g)</b><small>Upper guide, not a strict cap</small></div><input data-setting="sugarGoal" type="number" min="5" max="300" step="1" value="${esc(sets.sugarGoal)}"></div>
          <div class="settings-row"><div><b>Sodium limit (mg)</b><small>Upper guide</small></div><input data-setting="sodiumGoal" type="number" min="200" max="8000" step="50" value="${esc(sets.sodiumGoal)}"></div>
        </div>
      </div></article>
  </div>`
}
const COLLECTION_LABELS = {
  meals: 'Food diary entries', activities: 'Movement log', walks: 'Walk sessions', weights: 'Weigh-ins', sleeps: 'Sleep nights',
  water: 'Drink entries', vitals: 'Vitals readings', moods: 'Daily check-ins', symptoms: 'Symptoms', habits: 'Habits',
  habitLogs: 'Habit check-ins', recipes: 'Recipes', mealPlans: 'Meal plans', supplements: 'Medicine reminders',
  medicineLogs: 'Medicine check-ins', cycleLogs: 'Cycle notes', labResults: 'Lab results', glucose: 'Glucose readings',
  fastingSessions: 'Fasting sessions', measurements: 'Body measurements', journal: 'Journal notes', customFoods: 'Custom foods',
}
function toolsCard() {
  const usage = storageUsage(state)
  const lastBackup = Date.parse(state.settings.lastBackupAt || '') || 0
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null
  const nudge = daysSinceBackup === null
    ? 'No backup yet. One download protects months of entries if this device is lost.'
    : daysSinceBackup >= 30 ? `Last backup was ${daysSinceBackup} days ago. Worth refreshing.` : ''
  const list = usage.collections.filter(item => COLLECTION_LABELS[item.key])
  return `<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><h3>Storage on this device</h3>
      ${nudge ? `<div class="cc-notice">${esc(nudge)} <button type="button" data-action="export-json">Export now</button></div>` : ''}
      <div class="cc-stat">${nfmt(usage.kb)} <small>KB stored locally</small></div>
      ${list.length ? `<div class="cc-list">${list.map(item => `<div class="cc-list-item"><span><b>${esc(COLLECTION_LABELS[item.key])}</b><small>${nfmt(item.count)} record${item.count === 1 ? '' : 's'}</small></span></div>`).join('')}</div>` : '<p class="cc-small">Nothing is stored yet.</p>'}
      <p class="cc-small">Approximate size of the tracker data. Photos and routes take the most room, and browser storage has a limited budget.</p>
      <form class="cc-form" id="clear-collection-form"><label class="cc-field"><span>Remove one kind of record</span><select name="collection"><option value="">Choose a record type…</option>${list.map(item => `<option value="${esc(item.key)}">${esc(COLLECTION_LABELS[item.key])} · ${nfmt(item.count)}</option>`).join('')}</select></label><div class="cc-actions"><button type="submit" class="stop">Remove those records</button><button type="button" data-action="copy-summary">Copy today’s summary</button></div><p class="cc-small">Removing one type cannot be undone from inside the app, so export a backup first.</p></form>
    </article>
  </div>`
}
function featureResultsHtml() {
  const hits = searchFeatures(featureQuery)
  const groups = [...new Set(hits.map(item => item.group))]
  return `<div class="cc-actions" style="margin-top:10px">${groups.map(group => `<span class="cc-chip">${esc(group)} · ${hits.filter(item => item.group === group).length}</span>`).join('')}</div><div class="feature-list">${hits.map(item => `<div class="feature-item"><em>${esc(item.group)}</em><div><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></div></div>`).join('') || empty('No feature matches that word.')}</div>`
}
function featureIndexCard() {
  return `<article class="cc-card cc-card--wide"><h3>Every feature in this app</h3><p class="cc-small">${FEATURE_COUNT} features, all included and free. Search to find the one you need.</p>
    <label class="cc-field"><span>Search features</span><input id="feature-search" type="search" value="${esc(featureQuery)}" placeholder="Try water, weight, barcode, streak…" autocomplete="off"></label>
    <div id="feature-results">${featureResultsHtml()}</div>
  </article>`
}
function applyAppearance() {
  const node = document.documentElement
  node.dataset.theme = state.settings.theme === 'dark' ? 'dark' : 'light'
  node.dataset.font = state.settings.fontScale === 'xl' ? 'xl' : 'large'
}
function saveSetting(patch, message) {
  Object.assign(state.settings, patch)
  applyAppearance()
  persist(message || 'Setting saved.')
  render()
}
function applySetting(key, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw
  if (key === 'units') return saveSetting({ units: value === 'imperial' ? 'imperial' : 'metric' }, value === 'imperial' ? 'Switched to imperial units.' : 'Switched to metric units.')
  if (key === 'theme') return saveSetting({ theme: value === 'dark' ? 'dark' : 'light' }, value === 'dark' ? 'Dark theme on.' : 'Light theme on.')
  if (key === 'fontScale') return saveSetting({ fontScale: value === 'xl' ? 'xl' : 'large' }, 'Text size updated.')
  if (key === 'tips') return saveSetting({ tips: value !== 'false' })
  if (key === 'calorieAdjust') return saveSetting({ calorieAdjust: value !== 'false' }, value === 'false' ? 'Exercise no longer changes your goal.' : 'Exercise is added back to your goal.')
  if (key === 'walkPace') return saveSetting({ walkPace: value || 'steady' }, 'Default walk pace saved.')
  if (key === 'fiberGoal') return saveSetting({ fiberGoal: clamp(value, 5, 100) }, 'Fiber goal saved.')
  if (key === 'sugarGoal') return saveSetting({ sugarGoal: clamp(value, 5, 300) }, 'Sugar limit saved.')
  if (key === 'sodiumGoal') return saveSetting({ sodiumGoal: clamp(value, 200, 8000) }, 'Sodium limit saved.')
  if (key.startsWith('waterPreset')) {
    const presets = [...(state.settings.waterPresets || [250, 500, 750])]
    presets[Number(key.slice(-1))] = clamp(value, 50, 2000)
    return saveSetting({ waterPresets: presets }, 'Water presets saved.')
  }
}
function applyGoal(key, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw
  if (key === 'goalWeightKg') { profile().goalWeightKg = value ? String(clamp(value, 20, 350)) : ''; persist('Goal weight saved.'); render(); return }
  if (key === 'proteinPerKg') { const amount = clamp(value, 0.8, 3); state.settings.proteinPerKg = amount; profile().proteinPerKg = amount; persist('Protein target updated.'); render(); return }
  if (key === 'calorieOverride') { profile().calorieOverride = value ? String(clamp(value, 900, 6000)) : ''; persist('Calorie goal updated.'); render(); return }
}
function exportWalks() {
  const walks=(state.walks||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  const rows=walks.map(item=>[item.date,item.mode||'walk',item.minutes,item.distanceKm,item.steps,item.calories,item.met||'',item.checkin?.with||'',item.checkin?.feel||'',item.checkin?.place||'',item.checkin?.weather||'',item.checkin?.notes||''])
  const csv=[['date','type','minutes','distance_km','steps','kcal','met','with','feel','place','weather','notes'],...rows].map(row=>row.map(cell=>`"${String(cell??'').replaceAll('"','""')}"`).join(',')).join('\r\n')
  download(`walks-${todayISO()}.csv`,csv,'text/csv;charset=utf-8')
}
function exportDaily() {
  const s = scoped(), p = profile()
  const dates = new Set([...(s.meals || []).map(item => item.date), ...(s.activities || []).map(item => item.date), ...(s.water || []).map(item => item.date), ...(s.weights || []).map(item => item.date), ...(s.sleeps || []).map(item => item.date)])
  const rows = [...dates].filter(Boolean).sort().map(date => {
    const food = calculateFoodTotals(s.meals, date), activity = dayActivity(s, date, p)
    const water = (s.water || []).filter(item => item.date === date).reduce((sum, item) => sum + (Number(item.ml) || 0), 0)
    const sleep = (s.sleeps || []).find(item => item.date === date), weight = (s.weights || []).find(item => item.date === date)
    return [date, food.kcal, round1(food.protein), round1(food.carbs), round1(food.fat), activity.steps, activity.exerciseCalories, water, Number(sleep?.hours) || 0, Number(weight?.kg) || 0]
  })
  const csv = [['date', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'steps', 'exercise_kcal', 'water_ml', 'sleep_h', 'weight_kg'], ...rows].map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  download(`health-daily-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8')
}

applyAppearance()
renderFoodResults()
render()
if(activeWalk){startWalkClock();watchWalkLocation()}
if(state.fastingSessions.some(item=>item.profileId===profile().id&&!item.endAt))fastingTimer=setInterval(updateFastingClock,30000)
setInterval(updateReminder,30000)
// Coming back from the home screen or from a locked phone is exactly when the
// accumulated sensor steps should appear, so sync then instead of polling.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoDeviceStepSync() })
window.addEventListener('focus', () => autoDeviceStepSync())
if (state.settings.backgroundSteps) autoDeviceStepSync()
