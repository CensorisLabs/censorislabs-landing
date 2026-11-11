import {
  getProfile,
  getDay,
  findFood,
  update,
  addDays,
  todayKey,
  parseKey,
  prettyDate,
  dateSeries,
  planFor,
  planTotals,
  removePlanItem,
  addPlanToDay,
  generateWeekPlan,
  groceryFor,
  state,
  persist,
  MEALS,
} from '../lib/store.js'
import { targetsFor, round, percent } from '../lib/calc.js'
import { icon, fmt, esc, bar, toast, emptyState, statBlock } from '../lib/ui.js'
import { on, refresh, ui, go } from '../lib/runtime.js'
import { openFoodPicker, openRecipeBuilder, openRecipeLog } from '../lib/dialogs-food.js'
import { openRecipeActions, openTemplateList } from '../lib/dialogs-app.js'

function weekStart(offset = ui.planOffset) {
  const today = parseKey(todayKey())
  const mondayOffset = -((today.getDay() + 6) % 7)
  return addDays(todayKey(), mondayOffset + offset * 7)
}

function weekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function budgetState() {
  return state.settings.budget || 0
}

export function renderPlan(root) {
  const profile = getProfile()
  const start = weekStart()
  const days = weekDays(start)
  const targets = targetsFor(profile)
  const planSummaries = days.map(date => {
    const plan = profile.plan[date] || { breakfast: [], lunch: [], dinner: [], snacks: [] }
    const totals = planTotals(plan)
    const itemCount = MEALS.reduce((sum, meal) => sum + (plan[meal.id] || []).length, 0)
    return { date, plan, totals, itemCount }
  })
  const totalPlanned = planSummaries.reduce((sum, day) => sum + day.totals.kcal, 0)
  const plannedDays = planSummaries.filter(day => day.itemCount > 0).length
  const grocery = groceryFor(start, 7)
  const groceryCost = grocery.reduce((sum, item) => sum + item.cost, 0)
  const groceryKnown = grocery.filter(item => item.cost > 0).length
  const recipes = state.recipes.slice(0, 5)
  const groceryChecks = state.grocery?.[profile.id] || {}
  const weekLabel = `${prettyDate(start, { day: 'numeric', month: 'short' })} – ${prettyDate(addDays(start, 6), { day: 'numeric', month: 'short' })}`
  const budget = budgetState()

  root.innerHTML = `<div class="kc-view kc-plan">
    <div class="kc-page-head"><div><p class="kc-eyebrow">MEAL PLANNER</p><h1>Plan the week</h1><p>${weekLabel} · average ${fmt(totalPlanned / 7)} kcal planned per day · target ${fmt(targets.kcal)}</p></div><div class="kc-page-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="plan:week" data-delta="-1">${icon('left')} Previous</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="plan:week" data-delta="0">This week</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="plan:week" data-delta="1">Next ${icon('right')}</button></div></div>
    <div class="kc-plan-toolbar"><button type="button" class="kc-btn" data-action="plan:auto">${icon('sparkles')} Auto-fill the week</button><button type="button" class="kc-btn kc-btn--soft" data-action="plan:add-week">${icon('plus')} Add plan to diary</button><button type="button" class="kc-btn kc-btn--ghost" data-action="plan:templates">${icon('copy')} Templates</button><span class="kc-meta">${plannedDays}/7 days planned</span></div>
    ${!plannedDays ? `<div class="kc-plan-empty">${emptyState('calendar', 'A blank week is a clean start', 'Generate a balanced draft, or add foods to any slot. The plan does not log food until you add it to your diary.', '<button type="button" class="kc-btn kc-btn--soft" data-action="plan:auto">Auto-fill the week</button>')}</div>` : ''}
    <div class="kc-week-grid">
      ${planSummaries.map(summary => {
        const weekday = prettyDate(summary.date, { weekday: 'short' })
        const dayNumber = prettyDate(summary.date, { day: 'numeric' })
        const isToday = summary.date === todayKey()
        const pct = percent(summary.totals.kcal, targets.kcal)
        return `<section class="kc-card kc-plan-day ${isToday ? 'is-today' : ''}">
          <header><div><span>${esc(weekday)}</span><b>${esc(dayNumber)}</b></div><em>${summary.itemCount ? `${fmt(summary.totals.kcal)} kcal` : 'Empty'}</em></header>
          ${bar(summary.totals.kcal, targets.kcal, pct > 110 ? 'danger' : 'accent')}
          <div class="kc-plan-slots">${MEALS.map(meal => {
            const items = summary.plan[meal.id] || []
            return `<div class="kc-plan-slot"><div class="kc-plan-slot__label"><span>${meal.name}</span><button type="button" class="kc-icon-btn kc-icon-btn--tiny" data-action="plan:add" data-date="${summary.date}" data-meal="${meal.id}" aria-label="Add ${meal.name} to ${esc(weekday)}">${icon('plus')}</button></div>${items.length ? items.map(item => {
              const food = findFood(item.foodId)
              if (!food) return ''
              return `<div class="kc-plan-item"><span>${esc(food.name)}<small>${item.grams} g · ${fmt(food.kcal * item.grams / 100)} kcal</small></span><button type="button" class="kc-icon-btn kc-icon-btn--tiny" data-action="plan:remove" data-date="${summary.date}" data-meal="${meal.id}" data-food="${esc(item.foodId)}" aria-label="Remove ${esc(food.name)}">${icon('close')}</button></div>`
            }).join('') : `<button type="button" class="kc-plan-add" data-action="plan:add" data-date="${summary.date}" data-meal="${meal.id}">Add ${meal.name.toLowerCase()}</button>`}</div>`
          }).join('')}</div>
          <footer><span>P ${fmt(summary.totals.p, 0)} · C ${fmt(summary.totals.c, 0)} · F ${fmt(summary.totals.f, 0)}</span><button type="button" class="kc-text-btn" data-action="plan:add-day" data-date="${summary.date}">Log this day</button></footer>
        </section>`
      }).join('')}
    </div>

    <div class="kc-two-col">
      <section class="kc-card kc-grocery-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">GROCERY LIST</p><h3>${grocery.length} item${grocery.length === 1 ? '' : 's'} for the week</h3><p>${groceryKnown ? `₹${fmt(groceryCost)} estimated for ${groceryKnown} priced items` : 'Add prices to foods to estimate the week.'}</p></div><button type="button" class="kc-text-btn" data-action="plan:grocery-clear">Clear checks</button></div>
        ${grocery.length ? `<div class="kc-grocery-list">${grocery.map(item => `<label class="kc-grocery-row ${groceryChecks[item.foodId] ? 'is-checked' : ''}"><input type="checkbox" ${groceryChecks[item.foodId] ? 'checked' : ''} data-action="plan:grocery-toggle" data-food="${esc(item.foodId)}"><span><b>${esc(item.name)}</b><small>${item.g} g · ${esc(item.category)}</small></span><em>${item.cost ? `₹${Math.round(item.cost)}` : '—'}</em></label>`).join('')}</div>` : `<p class="kc-muted">Plan a few meals and the shopping list writes itself.</p>`}
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">BUDGET</p><h3>${budget ? `₹${fmt(budget)} per day` : 'No food budget set'}</h3><p>${budget ? `About ₹${fmt(budget * 7)} for the week. Planned groceries: ${groceryKnown ? `₹${fmt(groceryCost)}` : 'not priced yet'}.` : 'Set a daily figure to keep cost visible while planning.'}</p></div></div>
        <form id="budget-form" class="kc-inline-budget"><label class="kc-field"><span>Daily food budget (₹)</span><input id="budget-input" type="number" min="0" max="100000" step="10" value="${budget || ''}" placeholder="e.g. 450"></label><button type="submit" class="kc-btn kc-btn--soft kc-btn--sm">Save</button></form>
        <div class="kc-plan-stats">${statBlock('Planned this week', `${fmt(totalPlanned)} kcal`)}${statBlock('Grocery estimate', groceryKnown ? `₹${fmt(groceryCost)}` : '—')}${statBlock('Budget vs plan', budget && groceryKnown ? `${groceryCost > budget * 7 ? 'Over' : 'Within'} by ₹${fmt(Math.abs(groceryCost - budget * 7))}` : '—')}</div>
        <p class="kc-meta">Prices are local estimates you enter per food; they are not live shop prices.</p>
      </section>
    </div>

    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">RECIPES</p><h3>Build a repeatable meal</h3><p>Combine ingredients once, then plan or log a serving.</p></div><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="plan:recipe-builder">${icon('plus')} New recipe</button></div>
      <div class="kc-recipe-grid">${recipes.map(recipe => {
        const totals = recipe.items.reduce((sum, item) => {
          const food = findFood(item.foodId)
          return sum + (food ? food.kcal * item.g / 100 : 0)
        }, 0)
        const perServing = Math.round(totals / Math.max(1, recipe.servings))
        return `<article class="kc-recipe-card"><div class="kc-recipe-card__top"><span class="kc-food-avatar">${esc(recipe.name.slice(0, 1))}</span><span class="kc-pill">${recipe.minutes} min</span></div><h4>${esc(recipe.name)}</h4><p>${recipe.items.length} ingredients · ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}</p><div class="kc-recipe-card__foot"><b>${fmt(perServing)} kcal<small>/ serving</small></b><div><button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="plan:recipe-log" data-id="${esc(recipe.id)}">Log</button><button type="button" class="kc-icon-btn" data-action="plan:recipe-view" data-id="${esc(recipe.id)}" aria-label="View ${esc(recipe.name)}">${icon('chevron')}</button></div></div></article>`
      }).join('') || '<p class="kc-muted">No recipes yet.</p>'}</div>
    </section>

    <section class="kc-card kc-plan-note"><div>${icon('info')}<p><b>Planning is not logging.</b> Add a plan to your diary when you actually eat it. Nutrition is an estimate, and a plan is a suggestion — not a rule. Adjust portions to hunger, training and real life.</p></div></section>
  </div>`

  root.querySelector('#budget-form')?.addEventListener('submit', event => {
    event.preventDefault()
    const value = Math.max(0, Number(root.querySelector('#budget-input').value) || 0)
    update(() => { state.settings.budget = value }, { label: 'Set food budget' })
    toast(value ? `Daily food budget set to ₹${fmt(value)}` : 'Food budget cleared')
  })
}

on('plan:week', element => {
  const delta = Number(element.dataset.delta)
  ui.planOffset = delta === 0 ? 0 : ui.planOffset + delta
  refresh()
})
on('plan:auto', () => {
  const start = weekStart()
  update(() => generateWeekPlan(start), { label: 'Auto-fill meal plan' })
  toast('A balanced week has been drafted')
})
on('plan:add', element => openFoodPicker({ mode: 'plan', planDate: element.dataset.date, meal: element.dataset.meal }))
on('plan:remove', element => {
  update(() => removePlanItem(element.dataset.date, element.dataset.meal, element.dataset.food), { label: 'Remove from plan' })
  toast('Removed from plan')
})
on('plan:add-day', element => {
  let added = 0
  update(() => { added = addPlanToDay(element.dataset.date) }, { label: 'Add plan to diary' })
  toast(added ? `${added} foods added to ${prettyDate(element.dataset.date)}` : 'That day is already in your diary or empty')
})
on('plan:add-week', () => {
  let added = 0
  const start = weekStart()
  update(() => {
    for (const date of weekDays(start)) added += addPlanToDay(date)
  }, { label: 'Add week to diary' })
  toast(added ? `${added} planned foods added to the diary` : 'Nothing new to add')
})
on('plan:grocery-toggle', element => {
  const profile = getProfile()
  state.grocery ||= {}
  state.grocery[profile.id] ||= {}
  if (element.checked) state.grocery[profile.id][element.dataset.food] = true
  else delete state.grocery[profile.id][element.dataset.food]
  persist()
  refresh()
})
on('plan:grocery-clear', () => {
  const profile = getProfile()
  if (state.grocery) delete state.grocery[profile.id]
  persist(); refresh(); toast('Grocery checks cleared')
})
on('plan:templates', () => openTemplateList({ date: todayKey() }))
on('plan:recipe-builder', () => openRecipeBuilder())
on('plan:recipe-log', element => {
  const recipe = state.recipes.find(item => item.id === element.dataset.id)
  if (recipe) openRecipeLog(recipe, { date: todayKey() })
})
on('plan:recipe-view', element => {
  const recipe = state.recipes.find(item => item.id === element.dataset.id)
  if (recipe) openRecipeActions(recipe)
})
