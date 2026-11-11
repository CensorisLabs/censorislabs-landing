import {
  getProfile,
  getDay,
  foodList,
  foodAllowed,
  findFood,
  update,
  addDays,
  copyMeal,
  clearDay,
  applyTemplate,
  state,
  MEALS,
  relativeDate,
  todayKey,
  prettyDate,
} from '../lib/store.js'
import { openFoodPicker, openQuickAdd, openPortion, openCustomFood, openRecipeBuilder, openRecipeLog } from '../lib/dialogs-food.js'
import { openCopyDay, openTemplateSave, openTemplateList, openReport, openFoodSwap, openRecipeActions } from '../lib/dialogs-app.js'
import { FILTERS } from '../data/foods.js'
import { on, refresh, ui, go, setDate as runtimeSetDate } from '../lib/runtime.js'
import {
  targetsFor,
  dayTotals,
  scoreDay,
  netCarbs,
  formatVolume,
  round,
  percent,
} from '../lib/calc.js'
import {
  icon,
  fmt,
  esc,
  bar,
  toast,
  emptyState,
  timeLabel,
  confirmDialog,
  sectionHeading,
} from '../lib/ui.js'

function openLoggedEntry(date, meal, id) {
  const day = getDay(date, false)
  const entry = (day.meals[meal] || []).find(item => item.id === id)
  if (!entry) return
  const food = entry.foodId ? findFood(entry.foodId) : null
  if (food) openPortion(food, { date, meal, entry })
  else openQuickAdd({ date, meal, entry })
}

function searchPool(profile) {
  if (ui.filter === 'favorites') return profile.favorites.map(id => findFood(id)).filter(Boolean)
  if (ui.filter === 'recent') return profile.recents.map(id => findFood(id)).filter(Boolean)
  if (ui.filter === 'all') return foodList()
  return foodList().filter(food => food.tags.includes(ui.filter))
}

function searchFoods(profile, query) {
  let pool = searchPool(profile).filter(food => foodAllowed(food, profile))
  if (query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    pool = pool.filter(food => tokens.every(token => `${food.name} ${food.cat} ${food.tags.join(' ')} ${food.code || ''}`.toLowerCase().includes(token)))
  } else if (ui.filter === 'all') {
    const quick = [...new Set([...profile.favorites, ...profile.recents])].map(id => findFood(id)).filter(Boolean)
    pool = quick.length ? quick : pool
  }
  const sorted = [...pool]
  if (ui.sort === 'protein') sorted.sort((a, b) => b.p - a.p)
  else if (ui.sort === 'lowcal') sorted.sort((a, b) => a.kcal - b.kcal)
  else sorted.sort((a, b) => a.name.localeCompare(b.name))
  return sorted
}

function resultRow(food) {
  const serving = food.serving?.g || 100
  const nutrients = { kcal: Math.round(food.kcal * serving / 100), p: round(food.p * serving / 100, 1) }
  return `<button type="button" class="kc-food-row" data-action="diary:result" data-food="${esc(food.id)}">
    <span class="kc-food-avatar">${esc(food.name.slice(0, 1))}</span>
    <span class="kc-food-main"><b>${esc(food.name)}</b><small>${esc(food.serving?.label || '100 g')} · ${fmt(nutrients.kcal)} kcal · P ${fmt(nutrients.p, 1)} g</small></span>
    <span class="kc-food-add">${icon('plus')}</span>
  </button>`
}

function entryRow(entry, meal) {
  return `<div class="kc-entry-row kc-entry-row--full">
    <button type="button" class="kc-entry-main" data-action="diary:entry" data-meal="${meal}" data-id="${esc(entry.id)}">
      <span class="kc-entry-name">${esc(entry.name)}<small>${esc(entry.portionLabel)} · ${timeLabel(entry.at)} · P ${fmt(entry.nutrients.p, 1)} · C ${fmt(entry.nutrients.c, 1)} · F ${fmt(entry.nutrients.f, 1)}</small></span>
      <span class="kc-entry-kcal">${fmt(entry.nutrients.kcal)}<small>kcal</small></span>
    </button>
    ${entry.foodId ? `<button type="button" class="kc-icon-btn kc-entry-tool" data-action="diary:swap" data-meal="${meal}" data-id="${esc(entry.id)}" aria-label="Swap ${esc(entry.name)}">${icon('sort')}</button>` : ''}
  </div>`
}

export function renderDiary(root) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const day = getDay(ui.date)
  const totals = dayTotals(profile, day)
  const score = scoreDay(profile, day)
  const isToday = ui.date === todayKey()
  const recipes = state.recipes.slice(0, 4)
  const templates = profile.templates.slice(0, 3)
  const waterLabel = state.settings.units === 'imperial' ? formatVolume(day.water || 0, 'imperial') : `${fmt(day.water || 0)} ml`
  const quickPicks = [...new Set([...profile.favorites, ...profile.recents])].map(id => findFood(id)).filter(Boolean).slice(0, 8)
  const initialResults = searchFoods(profile, ui.searchQuery || '')

  root.innerHTML = `<div class="kc-view kc-diary">
    ${!isToday ? `<p class="kc-day-context">${icon('calendar')} Viewing ${esc(relativeDate(ui.date))}. You can log and edit this day.</p>` : ''}
    <section class="kc-card kc-diary-summary">
      <div class="kc-diary-summary__numbers">
        <div><span>Eaten</span><b>${fmt(totals.food.kcal)}</b><small>of ${fmt(targets.kcal)} kcal</small></div>
        <div><span>Remaining</span><b class="${totals.remaining < 0 ? 'kc-bad' : 'kc-good'}">${fmt(totals.remaining)}</b><small>kcal</small></div>
        <div><span>Protein</span><b>${fmt(totals.food.p, 0)}</b><small>of ${fmt(targets.protein)} g</small></div>
        <div><span>Water</span><b>${fmt(day.water || 0)}</b><small>${state.settings.units === 'imperial' ? 'fl oz' : 'ml'}</small></div>
        <div><span>Score</span><b>${score.score}</b><small>${esc(score.grade)}</small></div>
        <div><span>Cost</span><b>₹${fmt(totals.cost)}</b><small>known prices</small></div>
      </div>
      <div class="kc-diary-summary__bar">${bar(totals.food.kcal, totals.budget, totals.remaining < 0 ? 'danger' : 'accent')}</div>
      <p class="kc-meta">Net carbs ${fmt(netCarbs(totals.food), 1)} g · Fibre ${fmt(totals.food.fib, 1)} g · ${waterLabel} water · ${fmt(totals.burned)} kcal exercise credit</p>
    </section>

    <section class="kc-card kc-diary-search-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">FIND FOOD</p><h3>Log what you ate</h3><p>Search offline, use a barcode code, or add a custom food.</p></div><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="diary:full-search">${icon('search')} Full search</button></div>
      <label class="kc-search kc-search--lg">${icon('search')}<input id="diary-search" type="search" value="${esc(ui.searchQuery || '')}" placeholder="Search 160+ foods and dishes" autocomplete="off" aria-label="Search foods for the diary"></label>
      <div class="kc-chips kc-chips--scroll">${FILTERS.map(item => `<button type="button" class="kc-chip ${ui.filter === item.id ? 'is-active' : ''}" data-action="diary:filter" data-filter="${item.id}">${esc(item.label)}</button>`).join('')}</div>
      <div class="kc-picker__meta"><span id="diary-count">${initialResults.length} foods</span><label class="kc-sort">${icon('sort')}<select id="diary-sort" aria-label="Sort search results"><option value="relevance" ${ui.sort === 'relevance' ? 'selected' : ''}>Suggested</option><option value="protein" ${ui.sort === 'protein' ? 'selected' : ''}>Highest protein</option><option value="lowcal" ${ui.sort === 'lowcal' ? 'selected' : ''}>Lowest calories</option></select></label></div>
      <div id="diary-results" class="kc-food-list kc-food-list--inline">${initialResults.length ? initialResults.slice(0, 20).map(resultRow).join('') : emptyState('search', 'No matches', 'Try a shorter name or another filter.')}</div>
      ${quickPicks.length ? `<div class="kc-quick-picks"><span class="kc-history__label">${icon('star')} Quick picks</span>${quickPicks.map(food => `<button type="button" class="kc-chip" data-action="diary:result" data-food="${esc(food.id)}">${esc(food.name)}</button>`).join('')}</div>` : ''}
    </section>

    <div class="kc-diary-tools">
      <button type="button" class="kc-tool" data-action="diary:history">${icon('book')}<span>Meal history</span></button>
      <button type="button" class="kc-tool" data-action="diary:quick">${icon('plus')}<span>Quick add</span></button>
      <button type="button" class="kc-tool" data-action="diary:custom">${icon('utensils')}<span>Custom food</span></button>
      <button type="button" class="kc-tool" data-action="diary:recipe-builder">${icon('book')}<span>Recipe builder</span></button>
      <button type="button" class="kc-tool" data-action="diary:templates">${icon('copy')}<span>Templates</span></button>
      <button type="button" class="kc-tool" data-action="diary:copy">${icon('calendar')}<span>Copy a day</span></button>
      <button type="button" class="kc-tool" data-action="diary:report">${icon('print')}<span>Report</span></button>
    </div>

    <div class="kc-section-head"><div><p class="kc-eyebrow">DIARY</p><h2>${esc(relativeDate(ui.date))}</h2></div><button type="button" class="kc-text-btn" data-action="diary:clear">${icon('trash')} Clear day</button></div>
    <div class="kc-meal-grid kc-meal-grid--diary">
      ${MEALS.map(meal => {
        const entries = day.meals[meal.id] || []
        const mealTotals = totals.meals[meal.id]
        return `<section class="kc-card kc-meal-card kc-meal-card--full">
          <header class="kc-meal-card__head"><span class="kc-meal-icon kc-tone-${meal.id}">${icon(meal.icon)}</span><div><h3>${meal.name}</h3><p>${entries.length ? `${entries.length} item${entries.length === 1 ? '' : 's'} · P ${fmt(mealTotals.totals.p, 1)} · C ${fmt(mealTotals.totals.c, 1)} · F ${fmt(mealTotals.totals.f, 1)}` : 'Nothing logged yet'}</p></div><div class="kc-meal-total"><b>${fmt(mealTotals.totals.kcal)}</b><small>kcal</small></div><button type="button" class="kc-icon-btn kc-icon-btn--accent" data-action="diary:add" data-meal="${meal.id}" aria-label="Add to ${meal.name}">${icon('plus')}</button></header>
          ${entries.length ? `<div class="kc-meal-entries">${entries.map(entry => entryRow(entry, meal.id)).join('')}</div>` : emptyState('plus', `No ${meal.name.toLowerCase()} yet`, 'Search above or add the first item.', `<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="diary:add" data-meal="${meal.id}">Add ${meal.name.toLowerCase()}</button>`)}
          <footer class="kc-meal-card__foot"><button type="button" class="kc-text-btn" data-action="diary:add" data-meal="${meal.id}">${icon('plus')} Add food</button><button type="button" class="kc-text-btn" data-action="diary:copy-meal" data-meal="${meal.id}">${icon('copy')} Copy yesterday</button><button type="button" class="kc-text-btn" data-action="diary:template" data-meal="${meal.id}">${icon('book')} Save template</button><span>${fmt(mealTotals.totals.kcal)} kcal</span></footer>
        </section>`
      }).join('')}
    </div>

    <div class="kc-two-col">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">RECIPES</p><h3>Cook once, log faster</h3><p>${state.recipes.length} recipes in your kitchen.</p></div><button type="button" class="kc-text-btn" data-action="diary:recipe-builder">${icon('plus')} New</button></div>
        <div class="kc-recipe-list">${recipes.map(recipe => {
          const totalsForRecipe = recipe.items.reduce((sum, item) => {
            const food = findFood(item.foodId)
            return sum + (food ? food.kcal * item.g / 100 : 0)
          }, 0)
          return `<div class="kc-recipe-row"><div><b>${esc(recipe.name)}</b><small>${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · ${fmt(totalsForRecipe / Math.max(1, recipe.servings))} kcal each</small></div><div><button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="diary:recipe-log" data-id="${esc(recipe.id)}">Log</button><button type="button" class="kc-icon-btn" data-action="diary:recipe-view" data-id="${esc(recipe.id)}" aria-label="View ${esc(recipe.name)}">${icon('chevron')}</button></div></div>`
        }).join('') || '<p class="kc-muted">No recipes yet.</p>'}</div>
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">TEMPLATES</p><h3>Repeat a meal</h3><p>Save a meal once, reuse it any day.</p></div><button type="button" class="kc-text-btn" data-action="diary:templates">${icon('copy')} All</button></div>
        <div class="kc-template-list">${templates.map(template => `<div class="kc-template-row"><div><b>${esc(template.name)}</b><small>${template.items.length} items · ${MEALS.find(item => item.id === template.meal)?.name || 'Any meal'}</small></div><button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="diary:template-apply" data-id="${esc(template.id)}">${icon('plus')} Apply</button></div>`).join('') || '<p class="kc-muted">No templates yet. Use “Save template” under a meal.</p>'}</div>
      </section>
    </div>

    <div class="kc-diary-footer-actions">
      <button type="button" class="kc-btn kc-btn--soft" data-action="diary:copy">${icon('copy')} Copy a day</button>
      <button type="button" class="kc-btn kc-btn--ghost" data-action="diary:report">${icon('print')} Daily report</button>
      <button type="button" class="kc-btn kc-btn--ghost" data-action="diary:clear">${icon('trash')} Clear day</button>
    </div>
    ${mealHistoryPanel()}
  </div>`

  const input = root.querySelector('#diary-search')
  const results = root.querySelector('#diary-results')
  const count = root.querySelector('#diary-count')
  const paint = () => {
    const query = input.value.trim()
    ui.searchQuery = query
    const found = searchFoods(getProfile(), query)
    count.textContent = `${found.length} food${found.length === 1 ? '' : 's'}`
    results.innerHTML = found.length ? found.slice(0, 24).map(resultRow).join('') : emptyState('search', 'No matches', 'Try a shorter name, another filter, or a custom food.')
  }
  input?.addEventListener('input', paint)
  root.querySelector('#diary-sort')?.addEventListener('change', event => {
    ui.sort = event.target.value
    paint()
  })
}

function mealHistoryRows(days = 7) {
  const profile = getProfile()
  const rows = []
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addDays(todayKey(), -index)
    const day = getDay(date, false)
    for (const meal of MEALS) {
      for (const entry of day.meals[meal.id] || []) {
        rows.push({ date, meal: meal.name, mealId: meal.id, entry })
      }
    }
  }
  return rows
}

function mealHistoryPanel() {
  const rows = mealHistoryRows(7).slice(0, 30)
  return `<section class="kc-card kc-history-card">
    <div class="kc-card__head"><div><p class="kc-eyebrow">MEAL HISTORY</p><h3>Last 7 days, all meals</h3><p>${rows.length} entries across breakfast, lunch, dinner and snacks.</p></div><button type="button" class="kc-text-btn" data-action="diary:history-jump">${icon('calendar')} Jump to day</button></div>
    <div class="kc-meal-history">${rows.length ? rows.map(row => `<div class="kc-meal-history__row"><span class="kc-meal-history__date">${esc(prettyDate(row.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span class="kc-meal-history__meal">${esc(row.meal)}</span><span class="kc-meal-history__food">${esc(row.entry.name)}<small>${esc(row.entry.portionLabel)}</small></span><span class="kc-meal-history__kcal">${fmt(row.entry.nutrients.kcal)} kcal</span><button type="button" class="kc-icon-btn kc-icon-btn--tiny" data-action="diary:history-jump" data-date="${esc(row.date)}" aria-label="Open ${esc(prettyDate(row.date))}">${icon('right')}</button></div>`).join('') : '<p class="kc-muted">Log meals to build a history.</p>'}</div>
  </section>`
}

on('diary:add', element => openFoodPicker({ date: ui.date, meal: element.dataset.meal }))
on('diary:full-search', () => openFoodPicker({ date: ui.date, meal: null }))
on('diary:result', element => {
  const food = findFood(element.dataset.food)
  if (food) openPortion(food, { date: ui.date, meal: null })
})
on('diary:entry', element => openLoggedEntry(ui.date, element.dataset.meal, element.dataset.id))
on('diary:swap', element => {
  const day = getDay(ui.date, false)
  const entry = (day.meals[element.dataset.meal] || []).find(item => item.id === element.dataset.id)
  if (entry) openFoodSwap(entry, ui.date, element.dataset.meal)
})
on('diary:filter', element => {
  ui.filter = element.dataset.filter
  refresh()
})
on('diary:quick', () => openQuickAdd({ date: ui.date, meal: null }))
on('diary:custom', () => openCustomFood({ date: ui.date }))
on('diary:recipe-builder', () => openRecipeBuilder())
on('diary:recipe-log', element => {
  const recipe = state.recipes.find(item => item.id === element.dataset.id)
  if (recipe) openRecipeLog(recipe, { date: ui.date })
})
on('diary:recipe-view', element => {
  const recipe = state.recipes.find(item => item.id === element.dataset.id)
  if (recipe) openRecipeActions(recipe)
})
on('diary:templates', () => openTemplateList({ date: ui.date }))
on('diary:template', element => openTemplateSave({ date: ui.date, meal: element.dataset.meal }))
on('diary:template-apply', element => {
  const template = getProfile().templates.find(item => item.id === element.dataset.id)
  if (!template) return
  update(() => applyTemplate(template.id, ui.date, template.meal), { label: 'Apply meal template' })
  toast(`Added ${template.items.length} items`)
})
on('diary:copy', () => openCopyDay({ date: ui.date }))
on('diary:copy-meal', element => {
  const meal = element.dataset.meal
  let copied = 0
  update(() => { copied = copyMeal(addDays(ui.date, -1), ui.date, meal) }, { label: 'Copy meal' })
  toast(copied ? `${copied} item${copied === 1 ? '' : 's'} copied` : 'Nothing new to copy')
})
on('diary:report', () => openReport(ui.date))
on('diary:history', () => {
  const panel = document.querySelector('.kc-history-card')
  if (!panel) {
    toast('Log a meal first to build a history')
    return
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
  panel.classList.add('is-highlighted')
  setTimeout(() => panel.classList.remove('is-highlighted'), 1200)
})
on('diary:history-jump', element => {
  const date = element.dataset.date || todayKey()
  closeModal()
  runtimeSetDate(date)
  go('diary')
})
on('diary:clear', async () => {
  const ok = await confirmDialog({ title: 'Clear this day?', message: 'This removes all meals, water and exercise from the selected day. Weight and notes stay.', confirmLabel: 'Clear day', danger: true })
  if (!ok) return
  update(() => clearDay(ui.date), { label: 'Clear day' })
  toast('Day cleared')
})

function closeModal() {
  const backdrop = document.querySelector('.kc-modal-backdrop')
  if (!backdrop) return
  backdrop.remove()
  document.body.classList.remove('kc-modal-open')
}
