import '../../shared/base.css'
import './tracker.css'
import { mountApp } from '../../shared/shell.js'
import {
  STORAGE_KEY, ACTIVITY_FACTORS, activeProfile, calculateFoodTotals, calculateTargets,
  clamp, computeRecovery, createInitialState, createProfile, dayActivity, estimateActivityCalories,
  heartRateZone, loadState, normalizeState, saveState, sleepDebt, todayISO, uid, weeklySeries,
  weightTrend, acuteChronicRatio,
} from './core.js'
import { EXERCISES, FOOD_CATEGORIES, FOODS, searchFoods } from './foods.js'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nfmt = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0)
const dfmt = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const round1 = value => Math.round((Number(value) || 0) * 10) / 10
const scopeRecords = (state, profile) => {
  const copy = { ...state }
  for (const key of ['meals','activities','weights','sleeps','water','vitals','moods','habits','habitLogs','recipes','mealPlans','supplements','medicineLogs','cycleLogs','symptoms','labResults','glucose','fastingSessions','customMetrics','journal']) {
    copy[key] = (state[key] || []).filter(item => !item.profileId || item.profileId === profile.id)
  }
  return copy
}
const calcFood = food => ({ kcal: Number(food.kcal) || 0, p: Number(food.p) || 0, c: Number(food.c) || 0, f: Number(food.f) || 0, fi: Number(food.fi) || 0, su: Number(food.su) || 0, na: Number(food.na) || 0 })

const root = mountApp({
  appId: 'calorie-calculator', freeOnly: true,
  eyebrow: 'HEALTH · PRIVATE TRACKER · FREE FOREVER',
  title: 'Your health, on your terms.',
  description: 'Meals, movement, sleep and health notes in one private tracker. Estimates are clearly labeled, and your entries stay on this device.',
  content: `<div class="tracker" id="tracker-app">
    <div class="tracker-top"><label class="tracker-profile">PROFILE <select id="profile-select" aria-label="Active profile"></select><button class="cc-button" type="button" data-action="profile-new">Add</button></label><label class="tracker-date">DAY <input id="day-select" type="date" aria-label="Selected day"></label><span class="cc-offline-label">LOCAL DATA · NO ACCOUNT</span></div>
    <nav class="tracker-nav" aria-label="Health tracker sections"><button type="button" data-tab="today">Today</button><button type="button" data-tab="food">Food</button><button type="button" data-tab="activity">Activity</button><button type="button" data-tab="health">Health</button><button type="button" data-tab="trends">Trends</button><button type="button" data-tab="more">More</button></nav>
    <section class="tracker-view" id="tracker-view" aria-live="polite"></section><div id="tracker-toast" aria-live="polite"></div>
  </div>`,
})

const state = loadState()
let tab = 'today', selectedDate = todayISO(), foodQuery = '', foodCategory = '', barcodeStream = null, barcodeFrame = 0
let motionHandler = null, motionStarted = 0, motionCount = 0, lastStepAt = 0, gpsWatch = null, gpsPoints = [], gpsStarted = 0, restTimer = 0
let fastingTimer = 0, toastTimer = 0, photoData = '', lastReminderDay = ''

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
  const pages = { today: renderToday, food: renderFood, activity: renderActivity, health: renderHealth, trends: renderTrends, more: renderMore }
  if (view) view.innerHTML = (pages[tab] || renderToday)()
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
function empty(text) { return `<div class="cc-empty">${esc(text)}</div>` }
function dayMeals(s = scoped()) { return s.meals.filter(item => item.date === selectedDate) }
function dayTotal(s = scoped()) { return calculateFoodTotals(s.meals, selectedDate) }
function nutrientLine(label, value, unit = '') { return `<div class="cc-row"><span>${label}</span><strong>${nfmt(value)}${unit ? ` ${unit}` : ''}</strong></div>` }
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
    <label class="cc-field"><span>Water goal (ml)</span><input name="waterGoalMl" type="number" min="250" max="10000" step="100" value="${esc(p.waterGoalMl)}"></label>
    <label class="cc-field"><span>Step goal</span><input name="stepGoal" type="number" min="500" max="50000" step="500" value="${esc(p.stepGoal)}"></label>
  </div><div class="cc-actions"><button class="primary" type="submit">Save profile</button></div><p class="cc-small">Mifflin–St Jeor estimates vary by person. No weight-loss target is set below the estimated basal rate.</p></form>`
}
function renderToday() {
  const s = scoped(), p = profile(), t = targets(), food = dayTotal(s), activity = dayActivity(s, selectedDate, p)
  const water = s.water.filter(item=>item.date===selectedDate).reduce((sum,item)=>sum+(Number(item.ml)||0),0)
  const sleep = s.sleeps.find(item=>item.date===selectedDate), recovery=computeRecovery(s,selectedDate,p)
  const meals = dayMeals(s).slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')))
  const debt=sleepDebt(s.sleeps,selectedDate,p.sleepGoalHours,7)
  const score = recovery.score === null ? '—' : recovery.score
  return `${heading('Today',dfmt(selectedDate))}<div class="tracker-grid">
    ${calorieCard(s,t,food)}
    ${t ? `<article class="cc-card cc-card--third"><h3>Energy baseline</h3><div class="cc-stat">${nfmt(t.bmr)} <small>kcal</small></div><p>Estimated resting energy (BMR). Daily maintenance estimate: ${nfmt(t.maintenance)} kcal.</p><p class="cc-small">Activity multipliers are rough planning estimates, not a measurement.</p></article>` : ''}
    <article class="cc-card cc-card--third"><h3>Movement</h3><div class="cc-stat">${nfmt(activity.steps)} <small>steps</small></div>${progressBar(activity.steps,p.stepGoal,true)}<div class="cc-row"><span>Step energy estimate</span><strong>~${nfmt(activity.neatCalories)} kcal</strong></div><div class="cc-row"><span>Workouts</span><strong>~${nfmt(activity.exerciseCalories)} kcal</strong></div><p class="cc-small">Separate estimates. Steps and workouts are not added to food targets.</p><div class="cc-actions"><button data-tab="activity">Log movement</button></div></article>
    <article class="cc-card cc-card--third"><h3>Sleep & recovery</h3><div class="cc-stat">${score}<small>${score==='—'?' · log a few measures':' / 100 · estimate'}</small></div><div class="cc-row"><span>Sleep</span><strong>${sleep?`${round1(sleep.hours)} h`:'—'}</strong></div><div class="cc-row"><span>7-day sleep debt</span><strong>${debt.nights?`${debt.hours} h`:'—'}</strong></div><p class="cc-small">Recovery score uses only the manual sleep, energy and resting-HR values you enter.</p><div class="cc-actions"><button data-tab="health">Log health</button></div></article>
    <article class="cc-card cc-card--third"><h3>Hydration</h3><div class="cc-stat">${nfmt(water)} <small>/ ${nfmt(p.waterGoalMl)} ml</small></div>${progressBar(water,p.waterGoalMl,true)}<div class="cc-actions"><button data-action="water-quick" data-ml="250">+250 ml</button><button data-action="water-quick" data-ml="500">+500 ml</button></div></article>
    <article class="cc-card cc-card--third"><h3>Today’s food</h3>${meals.length?`<div class="cc-list">${meals.slice(0,5).map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.slot||'Meal')} · ${nfmt(item.grams)} g · ${nfmt((item.nutrients?.kcal||0)*item.grams/100)} kcal</small></span><button aria-label="Remove ${esc(item.name)}" data-action="remove-record" data-collection="meals" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>`:empty('No meals logged for this day yet.')}<div class="cc-actions"><button data-tab="food">Open food diary</button></div></article>
    <article class="cc-card cc-card--third"><h3>Quick actions</h3><div class="cc-actions"><button class="primary" data-tab="food">Add a meal</button><button data-tab="activity">Log exercise</button><button data-tab="health">Log sleep or vitals</button></div><p class="cc-small">Track what matters to you. Skip anything you do not want to record.</p></article>
    <article class="cc-card cc-card--wide"><h3>Your profile</h3>${setupProfileForm()}</article>
  </div>`
}
function allFoods() { return [...FOODS,...(state.customFoods||[])] }
function foodResult(food) {
  const grams=Number(food.serv?.[0]?.[1])||100
  return `<article class="food-result"><div><h4>${esc(food.name)}</h4><small>${esc(food.cat||'Custom')} · ${nfmt(food.kcal)} kcal / 100 g · P ${round1(food.p)} · C ${round1(food.c)} · F ${round1(food.f)}</small></div><div><input aria-label="Grams for ${esc(food.name)}" id="grams-${esc(food.id)}" type="number" min="1" max="5000" value="${grams}" inputmode="decimal"><small>grams</small></div><button data-action="meal-add" data-id="${esc(food.id)}">Add to diary</button></article>`
}
function renderFoodResults() {
  const host=$('#food-results',root);if(!host)return
  let pool=allFoods()
  if(foodCategory)pool=pool.filter(item=>item.cat===foodCategory)
  const hits=foodQuery.trim()?searchFoods(foodQuery,pool):pool.slice(0,12)
  host.innerHTML=hits.slice(0,36).map(foodResult).join('')||empty('No food match. Try fewer words or add it as a custom food.')
}
function renderFood() {
  const s=scoped(), meals=dayMeals(s), total=dayTotal(s), t=targets(), plans=s.mealPlans.filter(item=>item.date===selectedDate)
  return `${heading('Food diary','Search the built-in food list, add a custom item, or look up a barcode online.')}<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><div class="cc-row"><div><h3>Energy and macros</h3><small class="cc-muted">${meals.length} logged item${meals.length===1?'':'s'} · food records only</small></div><span class="cc-chip">${nfmt(total.kcal)} kcal${t?` / ${nfmt(t.calorieTarget)}`:''}</span></div>${t?progressBar(total.kcal,t.calorieTarget):''}<div class="cc-macros">${[['Protein',total.protein,t?.protein],['Carbs',total.carbs,t?.carbs],['Fat',total.fat,t?.fat]].map(([label,value,goal])=>`<div class="cc-macro"><b>${round1(value)} <small>g</small></b><span>${label}${goal?` · ${nfmt(goal)} g target`:''}</span>${goal?progressBar(value,goal):''}</div>`).join('')}</div><div class="cc-row"><span>Fiber · sugars · sodium</span><strong>${round1(total.fiber)} g · ${round1(total.sugar)} g · ${nfmt(total.sodium)} mg</strong></div><p class="cc-small">Food values are estimates. Your actual meal depends on ingredients and preparation.</p></article>
    <article class="cc-card cc-card--wide"><h3>Find food</h3><div class="cc-fields"><label class="cc-field"><span>Search food</span><input id="food-search" type="search" value="${esc(foodQuery)}" placeholder="Try dal, rice, apple…" autocomplete="off"></label><label class="cc-field"><span>Category</span><select id="food-category"><option value="">All categories</option>${FOOD_CATEGORIES.map(category=>`<option ${foodCategory===category?'selected':''}>${esc(category)}</option>`).join('')}</select></label></div><div id="food-results" class="food-results"></div></article>
    <article class="cc-card cc-card--third"><h3>Barcode lookup</h3><p>Enter the barcode or scan it with a supported camera. Online lookups use Open Food Facts and need an internet connection.</p><form class="cc-form" id="barcode-form"><label class="cc-field"><span>Barcode (EAN / UPC)</span><input name="barcode" id="barcode-input" inputmode="numeric" pattern="[0-9]{8,14}" placeholder="Scan or type the number"></label><div class="cc-actions"><button class="primary" type="submit">Look up product</button><button type="button" data-action="barcode-start">Scan</button></div></form><video id="barcode-video" class="cc-camera-video" playsinline muted hidden></video><div id="barcode-status" class="cc-small cc-muted" aria-live="polite"></div><div id="barcode-result"></div></article>
    <article class="cc-card cc-card--third"><h3>Add a custom food</h3><p>Enter label values per 100 g. This stays on your device.</p><form class="cc-form" id="custom-food-form"><div class="cc-fields"><label class="cc-field"><span>Name</span><input name="name" required maxlength="80"></label><label class="cc-field"><span>Category</span><input name="cat" value="Custom" maxlength="32"></label><label class="cc-field"><span>kcal / 100 g</span><input name="kcal" type="number" min="0" max="900" required step=".1"></label><label class="cc-field"><span>Protein g</span><input name="p" type="number" min="0" max="100" step=".1"></label><label class="cc-field"><span>Carbs g</span><input name="c" type="number" min="0" max="100" step=".1"></label><label class="cc-field"><span>Fat g</span><input name="f" type="number" min="0" max="100" step=".1"></label></div><details><summary class="cc-muted cc-small">More label nutrients</summary><div class="cc-fields"><label class="cc-field"><span>Fiber g</span><input name="fi" type="number" min="0" step=".1"></label><label class="cc-field"><span>Sugar g</span><input name="su" type="number" min="0" step=".1"></label><label class="cc-field"><span>Sodium mg</span><input name="na" type="number" min="0" step="1"></label></div></details><div class="cc-actions"><button class="primary" type="submit">Save custom food</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Recipes & planning</h3><form class="cc-form" id="recipe-form"><label class="cc-field"><span>Recipe name</span><input name="name" maxlength="80" required placeholder="My lunch bowl"></label><div class="cc-fields three"><label class="cc-field"><span>kcal / serving</span><input name="kcal" type="number" min="0" required></label><label class="cc-field"><span>Protein g</span><input name="p" type="number" min="0"></label><label class="cc-field"><span>Carbs g</span><input name="c" type="number" min="0"></label><label class="cc-field"><span>Fat g</span><input name="f" type="number" min="0"></label></div><div class="cc-actions"><button type="submit">Save recipe</button></div></form>${(s.recipes||[]).length?`<div class="cc-list">${s.recipes.slice(-5).reverse().map(recipe=>`<div class="cc-list-item"><span><b>${esc(recipe.name)}</b><small>${nfmt(recipe.kcal)} kcal / serving</small></span><button data-action="recipe-add" data-id="${esc(recipe.id)}">+ Add</button></div>`).join('')}</div>`:empty('Saved recipes will appear here.')}</article>
    <article class="cc-card cc-card--wide"><h3>Diary · ${esc(dfmt(selectedDate))}</h3><div class="cc-fields"><label class="cc-field"><span>Meal type</span><select id="meal-slot"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option><option>Drink</option></select></label><label class="cc-field"><span>Meal photo (optional, saved locally)</span><input type="file" id="meal-photo" accept="image/*" capture="environment"></label></div>${meals.length?`<div class="cc-list">${meals.slice().reverse().map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.slot||'Meal')} · ${nfmt(item.grams)} g · ${nfmt((item.nutrients?.kcal||0)*item.grams/100)} kcal${item.source?` · ${esc(item.source)}`:''}</small></span><button aria-label="Remove ${esc(item.name)}" data-action="remove-record" data-collection="meals" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>`:empty('Nothing logged yet. Add food from the search above.')}</article>
    <article class="cc-card cc-card--wide"><h3>Plan a meal</h3><form class="cc-form" id="plan-form"><div class="cc-fields three"><label class="cc-field"><span>Date</span><input name="date" type="date" value="${esc(selectedDate)}" required></label><label class="cc-field"><span>Meal / note</span><input name="name" maxlength="100" required placeholder="Example: lentil soup and bread"></label><label class="cc-field"><span>Estimated kcal (optional)</span><input name="kcal" type="number" min="0" max="10000"></label></div><div class="cc-actions"><button class="primary" type="submit">Add to plan</button></div></form>${plans.length?`<div class="cc-list">${plans.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${esc(item.slot||'Planned meal')}${item.kcal?` · ${nfmt(item.kcal)} kcal`:''}</small></span><button data-action="remove-record" data-collection="mealPlans" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>`:empty('No planned meals for this day.')}</article>
  </div>`
}
function renderActivity() {
  const s=scoped(),activity=dayActivity(s,selectedDate,profile()),t=targets(),zone=heartRateZone(s.vitals.find(item=>item.date===selectedDate)?.hr,profile().age)
  const logs=activity.workouts.slice().reverse()
  return `${heading('Movement','Log steps, walks, workouts and strength sessions. Calories are estimates.')}<div class="tracker-grid">
    <article class="cc-card cc-card--third"><h3>Steps</h3><div class="cc-stat">${nfmt(activity.steps)} <small>/ ${nfmt(profile().stepGoal)}</small></div>${progressBar(activity.steps,profile().stepGoal,true)}<form class="cc-form" id="steps-form"><label class="cc-field"><span>Add steps</span><input name="steps" type="number" min="1" max="100000" required placeholder="e.g. 2500"></label><div class="cc-actions"><button class="primary" type="submit">Save steps</button><button type="button" data-action="motion-toggle">Start phone estimate</button></div></form><p class="cc-small">Phone motion is foreground-only and approximate. Manual step entry is more reliable; no background pedometer runs.</p><div id="motion-status" aria-live="polite"></div></article>
    <article class="cc-card cc-card--third"><h3>Estimated energy</h3><div class="cc-row"><span>Step energy (rough NEAT)</span><strong>~${nfmt(activity.neatCalories)} kcal</strong></div><div class="cc-row"><span>Workout energy</span><strong>~${nfmt(activity.exerciseCalories)} kcal</strong></div><div class="cc-row"><span>Training load</span><strong>${nfmt(activity.trainingLoad)} MET-min</strong></div><div class="cc-row"><span>Recent load ratio</span><strong>${acuteChronicRatio(s.activities,selectedDate)??'—'}</strong></div><p class="cc-small">These calculations are rough planning estimates, not wearable measurements or a diagnosis.</p></article>
    <article class="cc-card cc-card--third"><h3>Heart-rate zone</h3>${zone?`<div class="cc-stat">Zone ${zone.zone}<small> · ${zone.percent}% estimated max</small></div><p>${esc(zone.label)} · Estimated max ${zone.max} bpm.</p>`:`<p>Log a heart-rate reading in Health to see its estimated training zone.</p>`}<div class="cc-notice">Heart-rate zones use an age-based estimate and do not replace a measured max heart rate or clinician advice.</div></article>
    <article class="cc-card cc-card--third"><h3>Workout</h3><form class="cc-form" id="workout-form"><label class="cc-field"><span>Activity</span><select name="exercise">${EXERCISES.map(ex=>`<option value="${esc(ex.id)}">${esc(ex.name)}</option>`).join('')}</select></label><div class="cc-fields"><label class="cc-field"><span>Minutes</span><input name="minutes" type="number" min="1" max="1440" required value="30"></label><label class="cc-field"><span>Average HR (optional)</span><input name="hr" type="number" min="35" max="240" placeholder="bpm"></label></div><div class="cc-actions"><button class="primary" type="submit">Log workout</button><button type="button" data-action="gps-toggle">Start GPS walk</button></div><div id="gps-status" class="cc-small cc-muted"></div></form><p class="cc-small">GPS runs only while you leave this screen active. It stores distance, not route coordinates.</p></article>
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
    <article class="cc-card cc-card--third"><h3>Hydration</h3><div class="cc-stat">${nfmt(water)} <small>/ ${nfmt(profile().waterGoalMl)} ml</small></div>${progressBar(water,profile().waterGoalMl,true)}<form class="cc-form" id="water-form"><div class="cc-fields"><label class="cc-field"><span>Amount (ml)</span><input name="ml" type="number" min="1" max="5000" step="50" required value="250"></label><label class="cc-field"><span>Drink</span><input name="name" maxlength="40" value="Water"></label></div><div class="cc-actions"><button class="primary" type="submit">Log drink</button></div></form></article>
    <article class="cc-card cc-card--third"><h3>Body & cycle</h3><form class="cc-form" id="weight-form"><div class="cc-fields"><label class="cc-field"><span>Weight (kg)</span><input name="kg" type="number" min="20" max="500" step=".1" required placeholder="e.g. 68"></label><label class="cc-field"><span>Body fat % (optional)</span><input name="bodyFat" type="number" min="1" max="75" step=".1"></label></div><div class="cc-actions"><button type="submit">Log body measurement</button></div></form><div class="cc-row"><span>7-day average weight</span><strong>${weightTrend(s.weights,selectedDate,7)??'—'} kg</strong></div>${latestWeight?.bodyFat?`<div class="cc-row"><span>Latest body fat entry</span><strong>${round1(latestWeight.bodyFat)}%</strong></div>`:''}<form class="cc-form" id="cycle-form"><label class="cc-field"><span>Cycle start date (optional)</span><input name="date" type="date" value="${esc(selectedDate)}"></label><label class="cc-field"><span>Note</span><input name="note" maxlength="100" placeholder="Optional symptoms / flow note"></label><div class="cc-actions"><button type="submit">Log cycle note</button></div></form>${s.cycleLogs.length?`<div class="cc-list">${s.cycleLogs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(item=>`<div class="cc-list-item"><span><b>${esc(item.date)}</b><small>${esc(item.note||'Cycle start')}</small></span></div>`).join('')}</div>`:''}<p class="cc-small">Cycle predictions are not included; dates are private notes only.</p></article>
    <article class="cc-card cc-card--third"><h3>Fasting timer</h3><div id="fasting-clock" class="cc-timer">${fast?.startAt?'00:00:00':'Ready'}</div>${fast?`<p>Started ${new Date(fast.startAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Only elapsed time is tracked.</p><div class="cc-actions"><button class="primary" data-action="fasting-stop">End fast</button></div>`:`<p>Timer records elapsed time only; it does not predict health benefits.</p><div class="cc-actions"><button class="primary" data-action="fasting-start">Start fasting timer</button></div>`}</article>
    <article class="cc-card cc-card--wide"><h3>Medicines, supplements & labs</h3><div class="cc-fields"><form class="cc-form" id="supplement-form"><label class="cc-field"><span>Medicine or supplement</span><input name="name" required maxlength="80" placeholder="Name only — no dosage advice"></label><label class="cc-field"><span>Reminder time (optional)</span><input name="time" type="time"></label><div class="cc-actions"><button type="submit">Save reminder note</button></div></form><form class="cc-form" id="lab-form"><div class="cc-fields"><label class="cc-field"><span>Lab test / custom metric</span><input name="name" required maxlength="70" placeholder="e.g. Ferritin"></label><label class="cc-field"><span>Value</span><input name="value" required maxlength="30"></label><label class="cc-field"><span>Unit</span><input name="unit" maxlength="20"></label><label class="cc-field"><span>Reference range / note</span><input name="note" maxlength="80"></label></div><div class="cc-actions"><button type="submit">Save personal result</button></div></form></div>${s.labResults.length?`<div class="cc-list">${s.labResults.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)} · ${esc(item.value)} ${esc(item.unit||'')}</b><small>${esc(item.date)}${item.note?` · ${esc(item.note)}`:''}</small></span></div>`).join('')}</div>`:empty('Personal lab notes will appear here.') }<p class="cc-small">Manual records only. No OCR, medication interaction checker, clinician portal or device sync is connected.</p></article>
  </div>`
}
function renderTrends() {
  const s=scoped(),series=weeklySeries(s,selectedDate,profile(),7),maxCalories=Math.max(1000,...series.map(item=>item.calories)),maxSteps=Math.max(1000,...series.map(item=>item.steps)),weight=weightTrend(s.weights,selectedDate,7),ratio=acuteChronicRatio(s.activities,selectedDate),sleep=sleepDebt(s.sleeps,selectedDate,profile().sleepGoalHours,7),goal=targets()
  const bars=(arr,key,max)=>`<div class="cc-bars">${arr.map(item=>`<div class="cc-bar" title="${esc(item.date)} · ${nfmt(item[key])}"><b>${nfmt(item[key])||'—'}</b><i style="height:${Math.max(2,clamp(item[key]/max*100,0,100))}%"></i><span>${esc(item.label)}</span></div>`).join('')}</div>`
  return `${heading('Trends','A simple view of the information you logged. Missing days remain blank or zero.')}<div class="tracker-grid">
    <article class="cc-card cc-card--third"><h3>Calories · 7 days</h3>${bars(series,'calories',maxCalories)}${goal?`<p class="cc-small">Daily target: ${nfmt(goal.calorieTarget)} kcal. Estimates only.</p>`:''}</article>
    <article class="cc-card cc-card--third"><h3>Steps · 7 days</h3>${bars(series,'steps',maxSteps)}<p class="cc-small">Manual and foreground phone estimates appear here.</p></article>
    <article class="cc-card cc-card--third"><h3>Sleep · 7 days</h3>${bars(series,'sleep',12)}<p class="cc-small">Sleep debt estimate: ${sleep.nights?sleep.hours+' h':'log sleep to start'}.</p></article>
    <article class="cc-card cc-card--third"><h3>Body trend</h3><div class="cc-stat">${weight??'—'} <small>kg · 7-day average</small></div><p>Use similar conditions when comparing entries. Day-to-day scale changes are common.</p></article>
    <article class="cc-card cc-card--third"><h3>Training load</h3><div class="cc-stat">${ratio??'—'} <small>recent / baseline</small></div><p>Ratio uses your logged MET-minute estimates. It is not a validated injury-risk prediction.</p></article>
    <article class="cc-card cc-card--third"><h3>Weekly summary</h3>${nutrientLine('Logged food energy',series.reduce((sum,item)=>sum+item.calories,0),'kcal')}${nutrientLine('Logged activity energy',series.reduce((sum,item)=>sum+item.activityCalories,0),'kcal')}${nutrientLine('Water logged',series.reduce((sum,item)=>sum+item.waterMl,0),'ml')}<p class="cc-small">Activity is never subtracted from meals or silently added to your target.</p></article>
    <article class="cc-card cc-card--wide"><h3>Export your health record</h3><p>Export a local JSON backup, a CSV of meal entries, or print this week’s summary to save as PDF from your browser.</p><div class="cc-actions"><button data-action="export-json">Download JSON backup</button><button data-action="export-meals">Download meal CSV</button><button data-action="print-report">Print / save PDF</button></div></article>
  </div>`
}
function renderMore() {
  const s=scoped(),p=profile(),habits=s.habits||[],logs=s.habitLogs.filter(item=>item.date===selectedDate),supp=s.supplements||[],medLogs=s.medicineLogs.filter(item=>item.date===selectedDate)
  const emergency=state.emergency||{}
  return `${heading('More tools','Profiles, habits, reminders and backups. Everything in this app is free.')}<div class="tracker-grid">
    <article class="cc-card cc-card--wide"><h3>Profile settings</h3>${setupProfileForm()}</article>
    <article class="cc-card cc-card--third"><h3>Habits</h3><form class="cc-form" id="habit-form"><label class="cc-field"><span>Habit name</span><input name="name" required maxlength="50" placeholder="Stretch for 5 minutes"></label><div class="cc-actions"><button type="submit">Add habit</button></div></form>${habits.length?`<div class="cc-list">${habits.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${logs.some(log=>log.habitId===item.id)?'Done today':'Not logged today'}</small></span><button data-action="habit-toggle" data-id="${esc(item.id)}">${logs.some(log=>log.habitId===item.id)?'✓':'○'}</button></div>`).join('')}</div>`:empty('Add a small habit you want to keep track of.')}</article>
    <article class="cc-card cc-card--third"><h3>Reminder while open</h3><form class="cc-form" id="reminder-form"><label class="cc-field"><span>Daily check-in time</span><input name="time" type="time" value="${esc(state.settings.reminderTime||'')}"></label><div class="cc-actions"><button type="submit">Save reminder</button></div></form><p class="cc-small">Notifications can appear only while the app is open. No background alarm is promised.</p><h4>Medications / supplements</h4>${supp.length?`<div class="cc-list">${supp.map(item=>`<div class="cc-list-item"><span><b>${esc(item.name)}</b><small>${item.time?`Reminder ${esc(item.time)}`:'No time set'}</small></span><button data-action="medicine-log" data-id="${esc(item.id)}">${medLogs.some(log=>log.itemId===item.id)?'✓':'Log'}</button></div>`).join('')}</div>`:empty('Add a reminder note from Health.')}</article>
    <article class="cc-card cc-card--third"><h3>Emergency information</h3><form class="cc-form" id="emergency-form"><div class="cc-fields"><label class="cc-field"><span>Emergency contact</span><input name="emergencyContact" maxlength="80" value="${esc(emergency.emergencyContact||'')}"></label><label class="cc-field"><span>Phone / email</span><input name="contactDetails" maxlength="80" value="${esc(emergency.contactDetails||'')}"></label><label class="cc-field"><span>Allergies</span><input name="allergies" maxlength="150" value="${esc(emergency.allergies||'')}"></label><label class="cc-field"><span>Blood type (optional)</span><input name="bloodType" maxlength="8" value="${esc(emergency.bloodType||'')}"></label><label class="cc-field"><span>Medicines</span><input name="medications" maxlength="150" value="${esc(emergency.medications||'')}"></label></div><div class="cc-actions"><button type="submit">Save emergency card</button></div></form><p class="cc-small">This information is stored in this browser and is not sent to emergency services.</p></article>
    <article class="cc-card cc-card--third"><h3>Back up & restore</h3><div class="cc-actions"><button data-action="export-json">Export all data</button><label class="cc-button">Restore backup<input type="file" id="restore-file" accept="application/json,.json" hidden></label></div><p class="cc-small">Backups may include sensitive health details. Store them somewhere private.</p></article>
    <article class="cc-card cc-card--third"><h3>Devices & services</h3><div class="cc-list">${['Android Health Connect','Apple Health','Garmin','Strava','Oura','Continuous glucose monitor','ECG / EDA sensors'].map(name=>`<div class="cc-list-item"><span><b>${name}</b><small>Not connected in this version</small></span><span class="cc-chip">Manual entry</span></div>`).join('')}</div><p class="cc-small">Food barcode lookups use Open Food Facts when online. No activity, medical or account data is uploaded.</p></article>
    <article class="cc-card cc-card--wide"><h3>Privacy and limits</h3><p><strong>Private by default:</strong> tracker entries are stored in this browser or app on this device. An optional barcode lookup sends the barcode to Open Food Facts. No cover, meal photo, Health Connect, Apple Health, wearable, CGM, or medical data is sent by this version.</p><p><strong>Estimates only:</strong> calorie needs, macros, food entries, exercise energy, recovery, sleep debt, and heart-rate zones are rough estimates. They are not medical diagnosis, treatment or personalized medical advice. This app is not designed to guide treatment, pregnancy nutrition, eating-disorder recovery or medication dosing.</p><p><strong>Availability:</strong> photos are attached locally for your own record; this build does not identify foods from photos or perform lab-result OCR. Imported data remains under your control.</p><div class="cc-actions"><button data-action="clear-data">Clear all tracker data</button></div></article>
  </div>`
}

function addMeal(food, grams, slot = 'Snack', date = selectedDate, source = '') {
  const amount=Number(grams)
  if(!food||!Number.isFinite(amount)||amount<=0||amount>5000)return toast('Enter a food portion from 1 to 5,000 grams.')
  state.meals.push({...recordBase(date),name:food.name,foodId:food.id,grams:round1(amount),slot,nutrients:calcFood(food),source,photo:photoData||''})
  photoData='';persist(`${food.name} added to your diary.`);render()
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
function handleForm(form) {
  const data=parseForm(form),p=profile()
  if(form.id==='profile-form')return saveProfile(form)
  if(form.id==='steps-form'){
    const steps=Math.floor(number(data.steps));if(steps<1||steps>100000)return toast('Enter between 1 and 100,000 steps.')
    state.activities.push({...recordBase(),name:'Step entry',steps,stepsOnly:true,minutes:0,met:1,calories:0});persist(`${nfmt(steps)} steps logged.`);render();return
  }
  if(form.id==='workout-form'){
    const ex=EXERCISES.find(item=>item.id===data.exercise),minutes=clamp(data.minutes,1,1440);if(!ex)return
    const calories=estimateActivityCalories({met:ex.met,minutes},p.weightKg)
    state.activities.push({...recordBase(),name:ex.name,minutes,met:ex.met,hr:number(data.hr)||0,calories})
    persist(`Workout saved · about ${nfmt(calories)} kcal estimated.`);render();return
  }
  if(form.id==='strength-form'){
    const minutes=number(data.minutes)||0,met=5,calories=estimateActivityCalories({met,minutes:minutes||30},p.weightKg)
    state.activities.push({...recordBase(),name:data.name.trim(),muscle:data.muscle,sets:clamp(data.sets,1,50),reps:clamp(data.reps,1,500),loadKg:number(data.loadKg),restSeconds:clamp(data.restSeconds,10,900),minutes,met,calories})
    persist('Strength session saved.');render();return
  }
  if(form.id==='sleep-form'){
    const hours=clamp(data.hours,0,24),deep=clamp(data.deep,0,24),rem=clamp(data.rem,0,24)
    if(deep+rem>hours+0.2)return toast('Deep and REM hours cannot exceed total sleep hours.')
    persistDaily('sleeps',selectedDate,{hours,quality:clamp(data.quality,1,5),deep,rem,bed:data.bed,wake:data.wake})
    persist('Sleep log saved. Stages are manual estimates.');render();return
  }
  if(form.id==='vitals-form'){
    persistDaily('vitals',selectedDate,{hr:clamp(data.hr,0,250),rhr:clamp(data.rhr,0,200),hrv:clamp(data.hrv,0,500),spo2:clamp(data.spo2,0,100),bp:String(data.bp||'').slice(0,12),temp:clamp(data.temp,0,45),glucose:clamp(data.glucose,0,40),respiration:clamp(data.respiration,0,80)})
    if(number(data.glucose)>0)state.glucose.push({...recordBase(),value:number(data.glucose),unit:'mmol/L',source:'manual'})
    persist('Manual readings saved.');render();return
  }
  if(form.id==='mood-form'){
    persistDaily('moods',selectedDate,{mood:data.mood,energy:clamp(data.energy,1,5),stress:clamp(data.stress,1,5),note:String(data.note||'').slice(0,180)})
    if(data.note)state.symptoms.push({...recordBase(),note:String(data.note).slice(0,180)})
    persist('Check-in saved privately.');render();return
  }
  if(form.id==='water-form'){
    state.water.push({...recordBase(),ml:clamp(data.ml,1,5000),name:String(data.name||'Water').trim().slice(0,40)});persist('Drink logged.');render();return
  }
  if(form.id==='weight-form'){
    const kg=number(data.kg);if(kg<20||kg>500)return toast('Enter weight between 20 and 500 kg.')
    state.weights.push({...recordBase(),kg,bodyFat:clamp(data.bodyFat,0,75)});p.weightKg=String(kg);persist('Body measurement saved; profile weight updated.');render();return
  }
  if(form.id==='cycle-form'){
    state.cycleLogs.push({...recordBase(data.date||selectedDate),note:String(data.note||'').slice(0,100)});persist('Cycle note saved.');render();return
  }
  if(form.id==='custom-food-form'){
    const food={id:uid(),name:data.name.trim().slice(0,80),cat:data.cat.trim().slice(0,32)||'Custom',kcal:clamp(data.kcal,0,900),p:clamp(data.p,0,100),c:clamp(data.c,0,100),f:clamp(data.f,0,100),fi:clamp(data.fi,0,100),su:clamp(data.su,0,100),na:clamp(data.na,0,100000),serv:[['100 g',100]],source:'custom'}
    state.customFoods.push(food);persist('Custom food saved.');render();return
  }
  if(form.id==='recipe-form'){
    state.recipes.push({...recordBase(),name:data.name.trim().slice(0,80),kcal:clamp(data.kcal,0,9000),p:clamp(data.p,0,1000),c:clamp(data.c,0,1000),f:clamp(data.f,0,1000)})
    persist('Recipe saved on this device.');render();return
  }
  if(form.id==='plan-form'){
    state.mealPlans.push({...recordBase(data.date),name:data.name.trim().slice(0,100),kcal:clamp(data.kcal,0,10000)});persist('Meal plan saved.');render();return
  }
  if(form.id==='supplement-form'){
    state.supplements.push({...recordBase(),name:data.name.trim().slice(0,80),time:data.time||''});persist('Reminder note saved.');render();return
  }
  if(form.id==='lab-form'){
    state.labResults.push({...recordBase(),name:data.name.trim().slice(0,70),value:data.value.trim().slice(0,30),unit:String(data.unit||'').slice(0,20),note:String(data.note||'').slice(0,80)});persist('Personal result saved.');render();return
  }
  if(form.id==='habit-form'){
    state.habits.push({...recordBase(),name:data.name.trim().slice(0,50)});persist('Habit added.');render();return
  }
  if(form.id==='reminder-form'){
    state.settings.reminderTime=data.time||''
    if(state.settings.reminderTime&&'Notification'in window&&Notification.permission==='default')Notification.requestPermission()
    persist('Reminder preference saved. It only runs while this app stays open.');render();return
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
    const food={id:uid(),name:String(product.product_name||product.product_name_en||`Product ${code}`).slice(0,80),cat:'Packaged food',kcal,p:Number(nutrient.proteins_100g)||0,c:Number(nutrient.carbohydrates_100g)||0,f:Number(nutrient.fat_100g)||0,fi:Number(nutrient.fiber_100g)||0,su:Number(nutrient.sugars_100g)||0,na:sodium<20?sodium*1000:sodium,serv:[['100 g',100]],source:'Open Food Facts'}
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
function toggleMotion() {
  const status=$('#motion-status',root)
  if(motionHandler){window.removeEventListener('devicemotion',motionHandler);motionHandler=null;const minutes=Math.max(1,Math.round((Date.now()-motionStarted)/60000));state.activities.push({...recordBase(),name:'Phone motion step estimate',steps:motionCount,stepsOnly:true,minutes,met:1,calories:0,source:'foreground motion'});persist(`${nfmt(motionCount)} approximate steps saved.`);motionCount=0;render();return}
  if(!('DeviceMotionEvent'in window))return toast('Phone motion counting is not available here. Enter a step count manually.')
  const begin=()=>{motionStarted=Date.now();motionCount=0;lastStepAt=0;motionHandler=event=>{const a=event.acceleration||event.accelerationIncludingGravity;if(!a)return;const magnitude=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);const adjusted=event.acceleration?magnitude:Math.abs(magnitude-9.81);if(adjusted>1.8&&Date.now()-lastStepAt>360){motionCount++;lastStepAt=Date.now();if(status)status.textContent=`Approx. ${nfmt(motionCount)} steps · keep this screen open.`}};window.addEventListener('devicemotion',motionHandler);if(status)status.textContent='Listening to phone motion. Walk naturally; this is an estimate.';toast('Foreground step estimate started.')}
  if(typeof DeviceMotionEvent.requestPermission==='function')DeviceMotionEvent.requestPermission().then(permission=>permission==='granted'?begin():toast('Motion permission was not granted.')).catch(()=>toast('Could not access motion sensor.'))
  else begin()
}
function toggleGps() {
  const status=$('#gps-status',root)
  if(gpsWatch!==null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;const points=gpsPoints;gpsPoints=[];let metres=0;for(let i=1;i<points.length;i++){const rad=x=>x*Math.PI/180,a=points[i-1],b=points[i],dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon),h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;metres+=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}const minutes=Math.max(1,Math.round((Date.now()-gpsStarted)/60000));state.activities.push({...recordBase(),name:'GPS walk',minutes,met:3.5,distanceKm:metres/1000,calories:estimateActivityCalories({met:3.5,minutes},profile().weightKg),source:'foreground GPS'});persist(`Walk saved · ${round1(metres/1000)} km estimate.`);render();return}
  if(!navigator.geolocation)return toast('Location is unavailable here.')
  gpsPoints=[];gpsStarted=Date.now();status.textContent='Waiting for location permission…';gpsWatch=navigator.geolocation.watchPosition(position=>{const point={lat:position.coords.latitude,lon:position.coords.longitude,at:Date.now()};if(!gpsPoints.length||position.coords.accuracy<80)gpsPoints.push(point);if(status)status.textContent=`GPS walk active · ${gpsPoints.length} location samples · this screen must stay open.`},()=>{status.textContent='Location permission or signal unavailable.';if(gpsWatch!==null)navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null},{enableHighAccuracy:true,maximumAge:2000,timeout:15000})
}
function addQuickWater(ml) { state.water.push({...recordBase(),ml:Number(ml),name:'Water'});persist(`+${ml} ml logged.`);render() }
function removeRecord(collection,id) {
  if(!['meals','activities','water','weights','sleeps','vitals','moods','mealPlans'].includes(collection))return
  state[collection]=state[collection].filter(item=>item.id!==id);persist('Entry removed.');render()
}
function startRestTimer() {
  const seconds=clamp($('#tracker-view [name="restSeconds"]',root)?.value,10,900)||90,clock=$('#rest-clock',root);clearInterval(restTimer);let remain=seconds
  if(clock)clock.textContent=`${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}`
  restTimer=setInterval(()=>{remain--;if(clock)clock.textContent=`${Math.floor(Math.max(0,remain)/60)}:${String(Math.max(0,remain)%60).padStart(2,'0')}`;if(remain<=0){clearInterval(restTimer);if('Notification'in window&&Notification.permission==='granted')new Notification('Rest timer complete');toast('Rest timer complete.')}},1000)
}
function startFasting() { if(state.fastingSessions.some(item=>item.profileId===profile().id&&!item.endAt))return;state.fastingSessions.push({...recordBase(),startAt:new Date().toISOString(),endAt:''});persist('Fasting timer started.');render();clearInterval(fastingTimer);fastingTimer=setInterval(updateFastingClock,30000) }
function endFasting() { const active=state.fastingSessions.find(item=>item.profileId===profile().id&&!item.endAt);if(!active)return;active.endAt=new Date().toISOString();active.minutes=Math.round((Date.now()-new Date(active.startAt).getTime())/60000);clearInterval(fastingTimer);fastingTimer=0;persist(`Timer ended · ${Math.floor(active.minutes/60)} h ${active.minutes%60} min.`);render() }
function updateFastingClock() { const el=$('#fasting-clock',root);if(!el)return;const active=state.fastingSessions.find(item=>item.profileId===profile().id&&!item.endAt);if(!active){el.textContent='Ready';return}const sec=Math.floor((Date.now()-new Date(active.startAt).getTime())/1000);el.textContent=`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}` }
function updateReminder() {
  const time=state.settings.reminderTime;if(!time||!('Notification'in window)||Notification.permission!=='granted')return
  const now=new Date(),target=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  if(target===time&&lastReminderDay!==todayISO()){lastReminderDay=todayISO();new Notification('Health check-in',{body:'Open your private tracker to log anything you want to remember.'})}
}
function addBarcodeFood(encoded) {
  try { const food=JSON.parse(decodeURIComponent(encoded));state.customFoods.push(food);addMeal(food,100,'Snack',selectedDate,'Open Food Facts') }
  catch { toast('Could not save that product. Try the custom food form.') }
}
async function handleAction(action,button) {
  const id=button.dataset.id
  if(action==='profile-new'){const name=prompt('Name this profile (stored only on this device):');if(name?.trim()){const p=createProfile(name.trim().slice(0,28));state.profiles.push(p);state.activeProfileId=p.id;persist('Profile added.');render()}return}
  if(action==='go-profile'){document.querySelector('#tracker-view .cc-card--wide .cc-fields input[name="age"]')?.focus();return}
  if(action==='water-quick'){addQuickWater(button.dataset.ml);return}
  if(action==='meal-add'){const food=allFoods().find(item=>item.id===id),grams=Number($(`#grams-${CSS.escape(id)}`,root)?.value||100),slot=$('#meal-slot',root)?.value||'Snack';if(food)addMeal(food,grams,slot);return}
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
  if(action==='export-json'){download(`health-tracker-backup-${todayISO()}.json`,JSON.stringify(state,null,2),'application/json');toast('Private JSON backup downloaded.');return}
  if(action==='export-meals'){exportMeals();toast('Meal CSV downloaded.');return}
  if(action==='print-report'){window.print();return}
  if(action==='clear-data'){if(confirm('This permanently clears all tracker data stored on this device. Export a backup first if you want to keep it.')){localStorage.removeItem(STORAGE_KEY);location.reload()}return}
}

root.addEventListener('click',event=>{
  const tabButton=event.target.closest('[data-tab]');if(tabButton){if(tabButton.dataset.tab!==''){setTab(tabButton.dataset.tab)}return}
  const button=event.target.closest('[data-action]');if(button){event.preventDefault();handleAction(button.dataset.action,button)}
})
root.addEventListener('change',event=>{
  if(event.target.id==='profile-select'){state.activeProfileId=event.target.value;persist();render();return}
  if(event.target.id==='day-select'){selectedDate=event.target.value||todayISO();render();return}
  if(event.target.id==='food-category'){foodCategory=event.target.value;renderFoodResults();return}
  if(event.target.id==='restore-file'&&event.target.files?.[0])restoreFile(event.target.files[0])
  if(event.target.id==='meal-photo'&&event.target.files?.[0])compressMealPhoto(event.target.files[0])
})
root.addEventListener('input',event=>{if(event.target.id==='food-search'){foodQuery=event.target.value;renderFoodResults()}})
root.addEventListener('submit',event=>{event.preventDefault();const form=event.target;if(form.id==='barcode-form'){lookupBarcode(new FormData(form).get('barcode'));return}handleForm(form)})
window.addEventListener('beforeunload',()=>{stopBarcodeScan();if(motionHandler)window.removeEventListener('devicemotion',motionHandler);if(gpsWatch!==null)navigator.geolocation?.clearWatch(gpsWatch)})
async function restoreFile(file) {
  try { if(file.size>10*1024*1024)throw new Error('Backup is over 10 MB.');const value=normalizeState(JSON.parse(await file.text()));if(!Array.isArray(value.meals))throw new Error('This backup is not a Calorie Calculator export.');if(!confirm('Restore this backup? It replaces data currently stored on this device.'))return;Object.assign(state,value);persist('Backup restored on this device.');render() }
  catch(error){toast(error.message||'Could not restore the backup.')}
}
async function compressMealPhoto(file) {
  if(!file.type.startsWith('image/')||file.size>12*1024*1024)return toast('Choose an image smaller than 12 MB.')
  try {const image=new Image(),url=URL.createObjectURL(file);image.src=url;await image.decode();URL.revokeObjectURL(url);const canvas=document.createElement('canvas'),scale=Math.min(1,720/image.naturalWidth);canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);photoData=canvas.toDataURL('image/jpeg',.7);toast('Small meal photo attached locally to the next meal.')}catch{toast('Could not load the meal photo.')}}

renderFoodResults()
render()
if(state.fastingSessions.some(item=>item.profileId===profile().id&&!item.endAt))fastingTimer=setInterval(updateFastingClock,30000)
setInterval(updateReminder,30000)
