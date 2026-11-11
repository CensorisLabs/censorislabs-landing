import {
  getProfile,
  getDay,
  addDays,
  foodList,
  foodAllowed,
  findFood,
  update,
  setWellbeing,
  logWater,
  removeExercise,
  profileStats,
  persist,
  state,
  MEALS,
  relativeDate,
  todayKey,
} from '../lib/store.js'
import {
  targetsFor,
  dayTotals,
  scoreDay,
  fastingProgress,
  MICRO_TARGETS,
  netCarbs,
  formatVolume,
  formatWeight,
  round,
  percent,
  greeting,
  waterTarget,
} from '../lib/calc.js'
import {
  icon,
  ring,
  fmt,
  esc,
  bar,
  macroBar,
  toast,
  statBlock,
  emptyState,
  timeLabel,
  sectionHeading,
} from '../lib/ui.js'
import { on, refresh, go, goProgress, ui } from '../lib/runtime.js'
import { openFoodPicker, openQuickAdd, openPortion } from '../lib/dialogs-food.js'
import { deviceStepCounterAvailable, startDeviceSteps, watchDeviceSteps } from '../lib/steps.js'
import { movementForDay, burnBasisLabel } from '../lib/movement.js'
import {
  openExercise,
  openStepSettings,
  openExerciseSuggest,
  openStepsLog,
  openWaterLog,
  openWeightLog,
  openFasting,
  openCopyDay,
  openTemplateSave,
  openReport,
  openShortcuts,
} from '../lib/dialogs-app.js'

function stepStreakDays(goal = getProfile().stepGoal || 8000, endDate = todayKey()) {
  let cursor = endDate
  if ((getDay(cursor, false).steps || 0) < goal) cursor = addDays(cursor, -1)
  let streak = 0
  while ((getDay(cursor, false).steps || 0) >= goal && streak < 400) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function mealLabel(meal) {
  return meal === 'snacks' ? 'snack' : meal
}

function mealForNow() {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snacks'
}

function openLoggedEntry(date, meal, id) {
  const day = getDay(date, false)
  const entry = (day.meals[meal] || []).find(item => item.id === id)
  if (!entry) return
  const food = entry.foodId ? findFood(entry.foodId) : null
  if (food) openPortion(food, { date, meal, entry })
  else openQuickAdd({ date, meal, entry })
}

function suggestionFoods(profile, remaining, proteinGap) {
  const allowance = remaining > 400 ? remaining * 0.75 : Math.max(140, remaining)
  const pool = foodList()
    .filter(food => foodAllowed(food, profile))
    .filter(food => food.kcal > 20 && food.kcal <= Math.max(allowance, 120))
  if (proteinGap > 12) {
    return [...pool].sort((a, b) => (b.p / Math.max(1, b.kcal)) - (a.p / Math.max(1, a.kcal))).slice(0, 3)
  }
  return [...pool].sort((a, b) => a.kcal - b.kcal).slice(0, 3)
}

function suggestedPlate(profile, totals, meal) {
  const remaining = Math.max(0, totals.remaining)
  const empty = { items: [], kcal: 0, p: 0, c: 0, f: 0, budget: 0, note: 'Nothing left to spend today — log a light snack or call it done.' }
  if (remaining < 180) return empty

  const budget = Math.min(remaining, meal === 'snacks' ? 320 : meal === 'breakfast' ? 450 : 700)
  const pool = foodList().filter(food => foodAllowed(food, profile))
  const proteinGap = Math.max(0, totals.targets.protein - totals.food.p)

  const best = (cats, test = () => true) => pool
    .filter(food => cats.includes(food.cat) && test(food))
    .sort((a, b) => (b.p * 100 / Math.max(1, b.kcal)) - (a.p * 100 / Math.max(1, a.kcal)))[0] || null

  const proteinCats = meal === 'breakfast' ? ['Dairy & eggs', 'Breakfast'] : ['Protein', 'Dals & legumes', 'Indian mains', 'Dairy & eggs']
  const proteinPick = best(proteinCats, food => food.kcal > 20 && food.kcal <= 300) || best(['Protein', 'Dals & legumes'])
  const carbPick = proteinGap > 60
    ? best(['Rice & grains', 'Bread & bakery'], food => food.kcal <= 150)
    : best(['Rice & grains', 'Bread & bakery', 'Breakfast'], food => food.kcal <= 220)
  const vegPick = pool.filter(food => ['Vegetables', 'Fruits'].includes(food.cat) && food.kcal <= 70)
    .sort((a, b) => b.fib - a.fib)[0] || null

  const items = []
  for (const [food, share] of [[proteinPick, 0.45], [carbPick, 0.35], [vegPick, 0.2]]) {
    if (!food) continue
    const grams = Math.round(budget * share / Math.max(1, food.kcal) * 100 / 10) * 10
    items.push({ food, g: Math.min(250, Math.max(40, grams)) })
  }
  if (!items.length) return empty

  const sum = items.reduce((acc, item) => {
    const scale = item.g / 100
    return {
      kcal: acc.kcal + Math.round(item.food.kcal * scale),
      p: acc.p + Math.round(item.food.p * scale * 10) / 10,
      c: acc.c + Math.round(item.food.c * scale * 10) / 10,
      f: acc.f + Math.round(item.food.f * scale * 10) / 10,
    }
  }, { kcal: 0, p: 0, c: 0, f: 0 })

  return {
    ...sum,
    items,
    budget,
    note: proteinGap > 25
      ? `Protein is ${Math.round(proteinGap)} g short, so this plate leads with it.`
      : `Built to fit about ${budget} kcal of what is left.`,
  }
}




// Step burn lives in lib/movement.js so every screen uses the same model.
const stepBurnOf = (day, profile) => movementForDay(day, profile).stepCreditKcal

function dailyInsight(targets, totals, day, score, isToday) {
  const entries = MEALS.reduce((sum, meal) => sum + totals.meals[meal.id].entries.length, 0)
  const proteinLeft = Math.max(0, targets.protein - totals.food.p)
  if (!entries) return 'Start with something you actually enjoy. A protein-forward first meal makes the rest of the day easier to steer.'
  if (!isToday) return `${entries} entries on this day. Browse the diary to edit portions or copy the day into today.`
  if (totals.remaining < -80) return `You are ${fmt(Math.abs(totals.remaining))} kcal over target. No punishment needed — a walk, water and a lighter next meal are enough.`
  if (totals.remaining < 120) return `You are close to target with ${fmt(totals.remaining)} kcal left. Fruit, curd or a small protein portion can close the day comfortably.`
  if (proteinLeft > 25 && totals.remaining > 200) return `${fmt(totals.remaining)} kcal and ${fmt(proteinLeft)} g protein are still available. Lean protein, dal or paneer would balance the day.`
  if (score.score >= 85) return 'A balanced day: calories, protein, fibre and water are all close to target. Repeat what worked.'
  return `${fmt(totals.remaining)} kcal left. Fibre is at ${percent(totals.food.fib, targets.fiber)}% — vegetables or fruit are a useful next add.`
}

function entryRow(entry, meal) {
  return `<button type="button" class="kc-entry-row" data-action="today:entry" data-meal="${meal}" data-id="${esc(entry.id)}">
    <span class="kc-entry-main"><span class="kc-entry-name">${esc(entry.name)}<small>${esc(entry.portionLabel)} · ${timeLabel(entry.at)}</small></span><span class="kc-entry-kcal">${fmt(entry.nutrients.kcal)}<small>kcal</small></span>${icon('chevron')}</span>
  </button>`
}

function moodButtons(day) {
  const moods = [['😞', 1, 'Low'], ['😐', 2, 'Okay'], ['🙂', 3, 'Good'], ['😄', 4, 'Great']]
  return moods.map(([emoji, value, label]) => `<button type="button" class="kc-mood ${day.mood === value ? 'is-active' : ''}" data-action="today:mood" data-value="${value}" aria-label="Mood: ${label}" aria-pressed="${day.mood === value}"><span>${emoji}</span><small>${label}</small></button>`).join('')
}

function scaleButtons(field, value, labels) {
  return labels.map((label, index) => `<button type="button" class="kc-scale-dot ${value === index + 1 ? 'is-active' : ''}" data-action="today:${field}" data-value="${index + 1}" aria-label="${label}" aria-pressed="${value === index + 1}">${index + 1}</button>`).join('')
}

export function renderToday(root) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const day = getDay(ui.date)
  const totals = dayTotals(profile, day)
  const score = scoreDay(profile, day)
  const streak = profileStats(profile.id)
  const fasting = fastingProgress(day)
  const isToday = ui.date === todayKey()
  const waterPct = percent(day.water || 0, targets.water)
  const suggestions = suggestionFoods(profile, totals.remaining, targets.protein - totals.food.p)
  const unitLabel = state.settings.units === 'imperial' ? 'fl oz' : 'ml'
  const waterLabel = state.settings.units === 'imperial' ? `${formatVolume(day.water || 0, 'imperial')} of ${formatVolume(targets.water, 'imperial')}` : `${fmt(day.water || 0)} ml of ${fmt(targets.water)} ml`
  const entriesCount = MEALS.reduce((sum, meal) => sum + totals.meals[meal.id].entries.length, 0)
  const plate = suggestedPlate(profile, totals, mealForNow())
  const stepGoal = Number(profile.stepGoal) || 8000
  const movement = totals.movement
  const noteId = 'day-note'

  root.innerHTML = `<div class="kc-view kc-today">
    ${!isToday ? `<p class="kc-day-context">${icon('calendar')} Viewing ${esc(relativeDate(ui.date))}. New entries go to this day.</p>` : ''}
    <section class="kc-card kc-summary">
      <div class="kc-summary__top">
        <div class="kc-summary__ring ${totals.remaining < 0 ? 'is-over' : ''}">
          ${ring(totals.pct, `<span class="kc-summary__label">${totals.remaining < 0 ? 'over' : 'left'}</span><strong>${fmt(Math.abs(totals.remaining))}</strong><small>kcal</small>`, { size: 206, thickness: 15, tone: totals.remaining < 0 ? 'danger' : 'accent' })}
        </div>
        <div class="kc-summary__stats">
          <div class="kc-summary__headline"><p class="kc-eyebrow">${esc(relativeDate(ui.date))} · ${esc(greeting(profile.name))}</p><h2>${entriesCount ? `${fmt(totals.food.kcal)} kcal logged` : 'Your day starts here'}</h2><p>${totals.remaining < 0 ? `${fmt(Math.abs(totals.remaining))} kcal over your budget` : `${fmt(totals.remaining)} kcal left of ${fmt(totals.budget)}`}${totals.burned ? ` · ${fmt(totals.burned)} earned` : ''}.</p></div>
          <div class="kc-summary__numbers">
            <div><span>Target</span><b>${fmt(targets.kcal)}</b></div>
            <div><span>Food</span><b>${fmt(totals.food.kcal)}</b></div>
            <div><span>Earned</span><b class="kc-good">${totals.burned ? `+${fmt(totals.burned)}` : '0'}</b></div>
            <div><span>Net</span><b>${fmt(totals.net)}</b></div>
          </div>
        </div>
      </div>
      <div class="kc-summary__chips">
        <button type="button" class="kc-pill kc-pill--button" data-action="today:score">${icon('target')} Score ${score.score}/100</button>
        <button type="button" class="kc-pill kc-pill--button" data-action="today:streak">${icon('flame')} ${streak.currentStreak}-day streak</button>
        <span class="kc-pill">${icon('water')} ${waterPct}% water</span>
        ${totals.cost > 0 ? `<span class="kc-pill">₹${fmt(totals.cost)} food cost</span>` : ''}
        ${profile.targetsMode === 'manual' ? '<span class="kc-pill">Manual targets</span>' : ''}
        ${stepStreakDays(stepGoal, ui.date) > 0 ? `<span class="kc-pill">${icon('footsteps')} ${stepStreakDays(stepGoal, ui.date)}-day step streak</span>` : ''}
      </div>
      <div class="kc-quick-row">
        <button type="button" class="kc-quick" data-action="today:quick">${icon('plus')}<span>Quick add</span></button>
        <button type="button" class="kc-quick" data-action="today:add" data-meal="${mealForNow()}">${icon('search')}<span>Log food</span></button>
        <button type="button" class="kc-quick" data-action="today:water" data-amount="250">${icon('water')}<span>Water</span></button>
        <button type="button" class="kc-quick" data-action="today:exercise">${icon('activity')}<span>Exercise</span></button>
        <button type="button" class="kc-quick" data-action="today:exercise-suggest">${icon('sparkles')}<span>Suggest move</span></button>
      </div>
      <p class="kc-insight">${icon('sparkles')} ${esc(dailyInsight(targets, totals, day, score, isToday))}</p>
    </section>

    <div class="kc-macro-grid">
      ${[
        { label: 'Protein', value: totals.food.p, target: targets.protein, tone: 'protein', unit: 'g' },
        { label: 'Carbs', value: totals.food.c, target: targets.carbs, tone: 'carb', unit: 'g' },
        { label: 'Fat', value: totals.food.f, target: targets.fat, tone: 'fat', unit: 'g' },
        { label: 'Fibre', value: totals.food.fib, target: targets.fiber, tone: 'fibre', unit: 'g' },
      ].map(macro => `<article class="kc-macro-card kc-tone-${macro.tone}">
        <div class="kc-macro-card__head"><span>${icon(macro.label === 'Protein' ? 'dumbbell' : macro.label === 'Fibre' ? 'leaf' : 'circle')} ${macro.label}</span><b>${fmt(macro.value, 0)}<small>/${fmt(macro.target)} ${macro.unit}</small></b></div>
        ${bar(macro.value, macro.target, macro.tone === 'protein' ? 'protein' : macro.tone === 'carb' ? 'carb' : macro.tone === 'fat' ? 'fat' : 'fibre')}
        <p>${macro.value >= macro.target ? `${fmt(macro.value - macro.target, 0)} ${macro.unit} over` : `${fmt(macro.target - macro.value, 0)} ${macro.unit} to go`}</p>
      </article>`).join('')}
    </div>

    <div class="kc-section-head"><div><p class="kc-eyebrow">TODAY'S PLATE</p><h2>Meals</h2></div><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:diary">Open diary ${icon('right')}</button></div>
    <div class="kc-meal-grid">
      ${MEALS.map(meal => {
        const mealTotals = totals.meals[meal.id]
        const entries = mealTotals.entries
        return `<section class="kc-card kc-meal-card">
          <header class="kc-meal-card__head"><span class="kc-meal-icon kc-tone-${meal.id}">${icon(meal.icon)}</span><div><h3>${meal.name}</h3><p>${entries.length ? `${entries.length} item${entries.length === 1 ? '' : 's'} · ${fmt(mealTotals.totals.kcal)} kcal` : 'Nothing logged yet'}</p></div><button type="button" class="kc-icon-btn kc-icon-btn--accent" data-action="today:add" data-meal="${meal.id}" aria-label="Add to ${meal.name}">${icon('plus')}</button></header>
          ${entries.length ? `<div class="kc-meal-entries">${entries.slice(0, 3).map(entry => entryRow(entry, meal.id)).join('')}${entries.length > 3 ? `<button type="button" class="kc-more-link" data-action="today:diary">+${entries.length - 3} more in the diary</button>` : ''}</div>` : `<button type="button" class="kc-meal-empty" data-action="today:add" data-meal="${meal.id}">${icon('plus')} Add ${meal.name.toLowerCase()}</button>`}
          <footer class="kc-meal-card__foot"><button type="button" class="kc-text-btn" data-action="today:add" data-meal="${meal.id}">Add food</button><button type="button" class="kc-text-btn" data-action="today:template" data-meal="${meal.id}">Save template</button><span class="kc-meal-macro">P ${fmt(mealTotals.totals.p, 1)} · C ${fmt(mealTotals.totals.c, 1)} · F ${fmt(mealTotals.totals.f, 1)}</span><span>${fmt(mealTotals.totals.kcal)} kcal</span></footer>
        </section>`
      }).join('')}
    </div>

    <div class="kc-two-col">
      <section class="kc-card kc-water-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">HYDRATION</p><h3>${state.settings.units === 'imperial' ? formatVolume(day.water || 0, 'imperial') : `${fmt(day.water || 0)} ml`}</h3><p>${state.settings.units === 'imperial' ? `${waterLabel}` : `${fmt(targets.water)} ml goal`}</p></div><span class="kc-water-icon">${icon('water')}</span></div>
        ${bar(day.water || 0, targets.water, 'water')}
        <div class="kc-water-actions"><button type="button" class="kc-chip" data-action="today:water" data-amount="250">+250 ml</button><button type="button" class="kc-chip" data-action="today:water" data-amount="500">+500 ml</button><button type="button" class="kc-chip" data-action="today:water-log">Custom</button><button type="button" class="kc-text-btn" data-action="today:water-undo">Undo</button></div>
        <p class="kc-meta">${waterPct}% of the daily guide · ${targets.water - (day.water || 0) > 0 ? `${fmt(targets.water - (day.water || 0))} ml to go` : targets.water - (day.water || 0) < 0 ? `${fmt(Math.abs(targets.water - (day.water || 0)))} ml over goal` : 'Goal reached'}</p>
      </section>
      <section class="kc-card kc-fast-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">FASTING WINDOW</p><h3>${fasting.active ? `${fasting.goalHours}:${24 - fasting.goalHours} · ${fasting.elapsedLabel}` : `${day.fasting?.goalHours || 16}:${24 - (day.fasting?.goalHours || 16)} window`}</h3><p>${fasting.active ? `Goal reached at ${fasting.endLabel}` : day.fasting?.end ? 'Fast completed' : 'Optional habit tool'}</p></div><span class="kc-water-icon">${icon('clock')}</span></div>
        ${bar(fasting.pct, 100, 'fast')}
        <div class="kc-water-actions"><button type="button" class="kc-chip" data-action="today:fast">${fasting.active ? 'View timer' : 'Start a fast'}</button><span class="kc-meta">${fasting.active ? `${fasting.pct}% of window` : 'Choose 12:12 to 20:4'}</span></div>
      </section>
    </div>

    <section class="kc-card kc-movement-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">MOVEMENT</p><h3>${fmt(totals.burned)} kcal credit</h3><p>${movement.steps ? `${fmt(movement.steps)} steps · ${fmt(movement.distanceKm, 2)} km · ${fmt(movement.minutes)} min walking` : 'No steps logged'} · ${day.sleep ? `${fmt(day.sleep, 1)} h sleep` : 'Sleep not logged'}</p></div><div class="kc-card__head-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:step-settings">${icon('settings')} Steps setup</button><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="today:exercise">${icon('plus')} Log exercise</button></div></div>
      <div class="kc-step-stats">
        <div class="kc-step-ring">${ring(Math.min(100, movement.goalPct), `<strong>${fmt(movement.steps)}</strong><small>of ${fmt(movement.stepGoal)} steps</small>`, { size: 124, thickness: 10, tone: movement.goalPct >= 100 ? 'accent' : 'muted' })}</div>
        <div class="kc-step-figures">
          <div><span>Distance</span><b>${fmt(movement.distanceKm, 2)} km</b><small>${Math.round(movement.strideM * 100)} cm stride</small></div>
          <div><span>Active burn</span><b>${fmt(movement.activeKcal)} kcal</b><small>${fmt(movement.grossKcal)} incl. resting</small></div>
          <div><span>Credited to budget</span><b>${movement.stepCreditSuppressed ? 'Off' : `+${fmt(movement.stepCreditKcal)}`}</b><small>${movement.stepCreditSuppressed ? 'Step credit disabled' : `${fmt(movement.creditSteps)} of ${fmt(movement.steps)} steps`}</small></div>
          <div><span>Pace</span><b>${fmt(movement.speedKmh, 1)} km/h</b><small>${fmt(movement.cadence)} steps/min assumed</small></div>
        </div>
        ${bar(movement.steps, movement.stepGoal, 'accent')}
      </div>
      ${movement.walkSteps > 0 ? `<p class="kc-meta kc-meta--warn">${icon('info')} ${fmt(movement.walkSteps)} of these steps sit inside your logged ${fmt(movement.stepLikeMinutes)} min of walking or running, so they are covered by that session instead of being credited twice.</p>` : ''}
      ${movement.baselineSteps > 0 ? `<p class="kc-meta">${icon('info')} Your activity level already assumes about ${fmt(movement.baselineSteps)} everyday steps, so only steps beyond that add to the budget.</p>` : ''}
      <p class="kc-meta">${icon('info')} ${esc(burnBasisLabel(profile))}. Active burn excludes the resting metabolism your target already includes.</p>
      ${day.exercise.length ? `<div class="kc-exercise-list">${day.exercise.map(item => `<div class="kc-exercise-row"><span>${icon('activity')}<b>${esc(item.name)}</b><small>${item.minutes} min · ${item.kcal} kcal</small></span><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="today:exercise-remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon('close')}</button></div>`).join('')}</div>` : `<p class="kc-muted kc-small">Exercise is optional — never eat back a burn you did not earn. A walk still counts.</p>`}
      <div class="kc-inline-fields">
        <label class="kc-field kc-field--inline"><span>Steps</span><input id="today-steps" type="number" min="0" max="100000" step="100" value="${day.steps ?? ''}" placeholder="e.g. 8000"></label>
        <label class="kc-field kc-field--inline"><span>Sleep (h)</span><input id="today-sleep" type="number" min="0" max="24" step="0.5" value="${day.sleep != null ? round(day.sleep, 1) : ''}" placeholder="e.g. 7.5"></label>
        <label class="kc-field kc-field--inline"><span>Caffeine (mg)</span><input id="today-caffeine" type="number" min="0" max="2000" step="10" value="${day.caffeine ?? ''}" placeholder="e.g. 120"></label>
        <button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:weight">${icon('scale')} Weigh in</button>
        <button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:steps-add">${icon('footsteps')} Steps</button>
        <button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:step-settings">${icon('settings')} Step goal</button>
        <button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="today:steps-quick">+2,500 steps</button>
        ${deviceStepCounterAvailable() ? `<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="today:steps-device">${icon('footsteps')} Sync device steps</button>` : ''}
      </div>
    </section>
    <section class="kc-card kc-balance-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">TODAY'S BALANCE</p><h3>Calories in vs target vs burned</h3><p>The simpler read of the day: food, your profile target, and movement credit.</p></div></div>
      <div class="kc-balance-grid">
        <div><span>Food eaten</span><b>${fmt(totals.food.kcal)}</b><small>kcal</small></div>
        <div><span>Your target</span><b>${fmt(totals.targets.kcal)}</b><small>kcal</small></div>
        <div><span>Movement credit</span><b class="kc-good">+${fmt(totals.burned)}</b><small>${fmt(movement.stepCreditKcal)} from steps · ${fmt(movement.exerciseCreditKcal)} exercise</small></div>
        <div><span>Budget with credit</span><b>${fmt(totals.budget)}</b><small>kcal</small></div>
        <div><span>Remaining</span><b class="${totals.remaining < 0 ? 'kc-bad' : 'kc-good'}">${fmt(totals.remaining)}</b><small>kcal</small></div>
      </div>
      <p class="kc-meta">Credit = active calories from your steps plus logged exercise, both net of resting metabolism. Change how steps are converted in Steps setup.</p>
    </section>

    <section class="kc-card kc-suggest-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">WHAT FITS</p><h3>${totals.remaining > 150 ? `${fmt(totals.remaining)} kcal still available` : 'Small, useful additions'}</h3><p>Higher-protein picks that fit your remaining budget.</p></div><button type="button" class="kc-text-btn" data-action="today:add" data-meal="${mealForNow()}">Browse all</button></div>
      <div class="kc-suggestion-grid">${suggestions.map(food => {
        const nutrients = { kcal: Math.round(food.kcal * food.serving.g / 100), p: round(food.p * food.serving.g / 100, 1) }
        return `<button type="button" class="kc-suggestion" data-action="today:suggest" data-food="${esc(food.id)}"><span class="kc-food-avatar">${esc(food.name.slice(0, 1))}</span><span><b>${esc(food.name)}</b><small>${esc(food.serving.label)} · ${fmt(nutrients.kcal)} kcal</small></span><span class="kc-suggestion__p">P ${fmt(nutrients.p, 1)} g</span></button>`
      }).join('') || '<p class="kc-muted">Add a few foods to get suggestions.</p>'}</div>
    </section>
    <section class="kc-card kc-suggest-card kc-suggest-card--balanced">
      <div class="kc-card__head"><div><p class="kc-eyebrow">SUGGESTED PLATE</p><h3>${plate.items.length ? `A balanced ${mealLabel(mealForNow())}` : 'Nothing to suggest'}</h3><p>${esc(plate.note)}</p></div><button type="button" class="kc-text-btn" data-action="today:suggestion">${icon('sparkles')} Review</button></div>
      <div class="kc-suggestion-list">${plate.items.map(item => `<button type="button" class="kc-suggestion kc-suggestion--row" data-action="today:suggest-plate" data-food="${esc(item.food.id)}" data-grams="${item.g}"><span class="kc-food-avatar">${esc(item.food.name.slice(0, 1))}</span><span><b>${esc(item.food.name)}</b><small>${item.g} g · ${fmt(item.food.kcal * item.g / 100)} kcal · P ${fmt(item.food.p * item.g / 100, 1)} · C ${fmt(item.food.c * item.g / 100, 1)} · F ${fmt(item.food.f * item.g / 100, 1)}</small></span></button>`).join('') || '<p class="kc-muted">Not enough budget left for a full plate. A piece of fruit or a glass of curd still counts.</p>'}</div>
      ${plate.items.length ? `<p class="kc-meta">Plate total: ${fmt(plate.kcal)} kcal · P ${fmt(plate.p, 1)} g · C ${fmt(plate.c, 1)} g · F ${fmt(plate.f, 1)} g</p>` : ''}
    </section>

    <div class="kc-two-col">
      <section class="kc-card kc-score-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">DAILY SCORE</p><h3>${score.grade}</h3><p>Calories, protein, fibre, water and movement.</p></div><span class="kc-score-number">${score.score}</span></div>
        <div class="kc-score-parts">${score.parts.map(part => `<div><span>${esc(part.label)}</span><i><b style="width:${Math.round(part.score / part.max * 100)}%"></b></i><small>${part.score}/${part.max}</small></div>`).join('')}</div>
      </section>
      <section class="kc-card kc-micro-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">MICRONUTRIENTS</p><h3>Daily coverage</h3><p>From the foods logged on this day.</p></div><button type="button" class="kc-text-btn" data-action="today:diary">Diary</button></div>
        <div class="kc-micro-list">${MICRO_TARGETS.map(micro => {
          const value = totals.food.micros[micro.key] || 0
          return `<div class="kc-micro-row"><span>${esc(micro.label)}</span>${bar(value, micro.target, 'fibre')}<b>${fmt(value, value < 10 ? 1 : 0)} ${micro.unit}</b></div>`
        }).join('')}</div>
        <p class="kc-meta">These are estimates; supplement decisions belong with a clinician.</p>
      </section>
    </div>

    <section class="kc-card kc-wellbeing-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">HOW IT FELT</p><h3>Daily check-in</h3><p>Optional signals that numbers do not capture.</p></div></div>
      <div class="kc-wellbeing-grid">
        <div><span class="kc-form-label">Mood</span><div class="kc-moods">${moodButtons(day)}</div></div>
        <div><span class="kc-form-label">Energy</span><div class="kc-scale">${scaleButtons('energy', day.energy, ['Drained', 'Low', 'Okay', 'Good', 'Energised'])}</div></div>
        <div><span class="kc-form-label">Hunger</span><div class="kc-scale">${scaleButtons('hunger', day.hunger, ['Not hungry', 'Slight', 'Moderate', 'Strong', 'Very hungry'])}</div></div>
      </div>
    </section>

    <section class="kc-card kc-note-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">NOTES</p><h3>Anything worth remembering</h3><p>Meal context, cravings, a win. Saved on this device.</p></div><span class="kc-meta" id="note-status">${day.notes ? 'Saved locally' : ''}</span></div>
      <textarea id="${noteId}" class="kc-note-area" rows="3" maxlength="1200" placeholder="e.g. Lunch kept me full until 5pm. Add more protein at breakfast tomorrow.">${esc(day.notes || '')}</textarea>
      <div class="kc-note-foot"><button type="button" class="kc-text-btn" data-action="today:copy">${icon('copy')} Copy a day</button><button type="button" class="kc-text-btn" data-action="today:report">${icon('print')} Daily report</button><button type="button" class="kc-text-btn" data-action="today:shortcuts">${icon('info')} Shortcuts</button><button type="button" class="kc-text-btn" data-action="today:plan">${icon('calendar')} Meal plan</button></div>
    </section>

    <p class="kc-disclaimer">kcal is an estimate and education tool, not medical advice. Needs vary with health, medication, pregnancy and activity. For clinical guidance, speak with a qualified professional.</p>
  </div>`

  const note = root.querySelector('#day-note')
  let timer = 0
  const saveNote = () => {
    const value = getDay(ui.date).notes
    if (value === note.value) return
    getDay(ui.date).notes = note.value
    persist()
    const status = root.querySelector('#note-status')
    if (status) status.textContent = 'Saved locally'
  }
  note?.addEventListener('input', () => {
    const status = root.querySelector('#note-status')
    if (status) status.textContent = 'Saving…'
    window.clearTimeout(timer)
    timer = window.setTimeout(saveNote, 600)
  })
  note?.addEventListener('blur', saveNote)

  const bindNumber = (selector, field) => {
    const input = root.querySelector(selector)
    input?.addEventListener('change', () => {
      const value = input.value === '' ? null : Math.max(0, Number(input.value) || 0)
      update(() => setWellbeing(field, value, ui.date), { label: `Update ${field}` })
    })
  }
  bindNumber('#today-steps', 'steps')
  bindNumber('#today-sleep', 'sleep')
  bindNumber('#today-caffeine', 'caffeine')
}

on('today:add', element => openFoodPicker({ date: ui.date, meal: element.dataset.meal }))
on('today:quick', () => openQuickAdd({ date: ui.date, meal: mealForNow() }))
on('today:entry', element => openLoggedEntry(ui.date, element.dataset.meal, element.dataset.id))
on('today:water', element => {
  const amount = Number(element.dataset.amount) || 250
  update(() => logWater(ui.date, amount), { label: 'Log water' })
  toast(`+${fmt(amount)} ml water`)
})
on('today:water-undo', () => {
  update(() => logWater(ui.date, -250), { label: 'Undo water' })
  toast('Removed 250 ml')
})
on('today:water-log', () => openWaterLog({ date: ui.date }))
on('today:exercise', () => openExercise({ date: ui.date }))
on('today:exercise-suggest', () => openExerciseSuggest({ date: ui.date }))
on('today:exercise-remove', element => {
  update(() => removeExercise(ui.date, element.dataset.id), { label: 'Remove exercise' })
  toast('Exercise removed')
})
on('today:weight', () => openWeightLog({ date: ui.date }))
on('today:fast', () => openFasting())
on('today:copy', () => openCopyDay({ date: ui.date }))
on('today:report', () => openReport(ui.date))
on('today:shortcuts', () => openShortcuts())
on('today:template', element => openTemplateSave({ date: ui.date, meal: element.dataset.meal }))
on('today:diary', () => go('diary'))
on('today:plan', () => go('plan'))
on('today:score', () => goProgress('achievements'))
on('today:streak', () => goProgress('achievements'))
on('today:suggest', element => {
  const food = findFood(element.dataset.food)
  if (food) openPortion(food, { date: ui.date, meal: mealForNow() })
})
on('today:suggest-plate', element => {
  const food = findFood(element.dataset.food)
  if (food) openPortion(food, { date: ui.date, meal: mealForNow(), grams: Number(element.dataset.grams) || null })
})
on('today:suggestion', () => {
  const plate = suggestedPlate(getProfile(), dayTotals(getProfile(), getDay(ui.date)), mealForNow())
  if (!plate.items.length) {
    toast(plate.note, 'error')
    return
  }
  toast(`Plate: ${fmt(plate.kcal)} kcal · P ${fmt(plate.p, 0)} g · C ${fmt(plate.c, 0)} g · F ${fmt(plate.f, 0)} g. Tap a line to log it.`)
})
on('today:steps-add', () => {
  openStepsLog({ date: ui.date })
})
on('today:step-settings', () => {
  openStepSettings()
})
on('today:steps-device', async () => {
  const result = await startDeviceSteps()
  if (!result?.available) {
    toast(result?.message || 'This device has no step counter sensor.', 'error')
    return
  }
  // The sensor counts steps since it started watching. A larger manual entry for
  // the day (from a watch or another phone) is kept rather than overwritten.
  const write = value => update(() => {
    const existing = Math.max(0, Number(getDay(ui.date).steps) || 0)
    setWellbeing('steps', Math.max(existing, Math.max(0, Math.round(value))), ui.date)
  }, { label: 'Device steps' })
  if (Number(result.steps) > 0) write(Number(result.steps))
  let lastSynced = Math.max(0, Number(result.steps) || 0)
  await watchDeviceSteps(steps => {
    if (!Number.isFinite(steps)) return
    // The sensor streams often; only persist meaningful changes to avoid constant writes.
    if (Math.abs(steps - lastSynced) < 10) return
    lastSynced = steps
    write(steps)
  })
  toast('Reading the device step counter')
})
on('today:steps-quick', () => {
  update(() => setWellbeing('steps', Math.max(0, (Number(getDay(ui.date).steps || 0) + 2500)), ui.date), { label: 'Add 2,500 steps' })
  refresh()
  toast('+2,500 steps')
})
on('today:mood', element => {
  update(() => setWellbeing('mood', Number(element.dataset.value), ui.date), { label: 'Mood check-in' })
})
on('today:energy', element => {
  update(() => setWellbeing('energy', Number(element.dataset.value), ui.date), { label: 'Energy check-in' })
})
on('today:hunger', element => {
  update(() => setWellbeing('hunger', Number(element.dataset.value), ui.date), { label: 'Hunger check-in' })
})
