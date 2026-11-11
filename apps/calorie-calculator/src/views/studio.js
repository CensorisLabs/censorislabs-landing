import {
  state,
  getProfile,
  getDay,
  foodList,
  foodAllowed,
  findFood,
  findRecipe,
  recipeTotals,
  addEntry,
  makeQuickEntry,
  addPantryItem,
  removePantryItem,
  addShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  addHabit,
  toggleHabit,
  removeHabit,
  addCraving,
  removeCraving,
  addPrepTask,
  togglePrepTask,
  removePrepTask,
  saveWeeklyReview,
  addQuickAdd,
  removeQuickAdd,
  removeEntries,
  update,
  todayKey,
  addDays,
  dateSeries,
  prettyDate,
  MEALS,
  MEAL_IDS,
} from '../lib/store.js'
import {
  targetsFor,
  dayTotals,
  scoreDay,
  percent,
  round,
  netCarbs,
  latestMeasurement,
  goalProjection,
  tdee,
  bmr,
  targetCalories,
  formatWeight,
  formatVolume,
  nutrientsForFood,
  entryGlycemicLoad,
} from '../lib/calc.js'
import {
  average,
  daysUntil,
  weekStartKey,
  lastNDates,
  loggedRows,
  movingAverageWeight,
  weightRate,
  plateauDetected,
  correlation,
  sleepDebt,
  mealTiming,
  weekdayWeekend,
  proteinDistribution,
  calorieDistribution,
  nutrientGaps,
  dietQuality,
  dailyGlycemicLoad,
  netCarbShare,
  reportCard,
  planAdherence,
  duplicateGroups,
  fingerprint,
  dataQuality,
  localSafetyScore,
  habitStreak,
  stepStreak,
  plantVariety,
  restaurantEstimate,
  restaurantLabel,
} from '../lib/lab.js'
import { ALLERGEN_TAGS } from '../data/foods.js'
import { FEATURE_COUNT } from '../data/features.js'
import { icon, fmt, esc, bar, toast, statBlock, copyText, downloadFile } from '../lib/ui.js'
import { on, onForm, refresh, ui, go } from '../lib/runtime.js'

const TABS = [
  { id: 'kitchen', label: 'Kitchen', icon: 'utensils' },
  { id: 'nutrition', label: 'Nutrition', icon: 'flask' },
  { id: 'body', label: 'Body & habits', icon: 'activity' },
  { id: 'reports', label: 'Reports & data', icon: 'chart' },
]

function labCard(eyebrow, title, note, body, className = '') {
  return `<section class="kc-card kc-lab-card ${className}"><div class="kc-card__head"><div><p class="kc-eyebrow">${eyebrow}</p><h3>${title}</h3><p>${note}</p></div></div>${body}</section>`
}

function labRow(label, value, note = '') {
  return `<div class="kc-lab-row"><div><b>${label}</b>${note ? `<small>${note}</small>` : ''}</div><span>${value}</span></div>`
}

function emptyLab(text) {
  return `<p class="kc-lab-empty">${esc(text)}</p>`
}

function foodOptions(selected) {
  return foodList().slice().sort((a, b) => a.name.localeCompare(b.name)).map(food => `<option value="${esc(food.id)}" ${food.id === selected ? 'selected' : ''}>${esc(food.name)}</option>`).join('')
}

function recipeOptions(selected) {
  return state.recipes.map(recipe => `<option value="${esc(recipe.id)}" ${recipe.id === selected ? 'selected' : ''}>${esc(recipe.name)}</option>`).join('')
}

function pantryStatus(item) {
  const days = daysUntil(item.expires)
  if (days == null) return { label: 'No date', tone: 'muted' }
  if (days < 0) return { label: `Expired ${Math.abs(days)}d`, tone: 'bad' }
  if (days === 0) return { label: 'Use today', tone: 'amber' }
  if (days <= 7) return { label: `${days}d left`, tone: 'amber' }
  return { label: prettyDate(item.expires), tone: 'good' }
}

function recipeItems(recipe) {
  return (recipe?.items || []).map(item => ({ item, food: findFood(item.foodId) })).filter(row => row.food)
}

function recipeAllergens(recipe, profile) {
  const hits = ALLERGEN_TAGS.map(tag => ({
    ...tag,
    items: recipeItems(recipe).filter(row => tag.foods.includes(row.food.id)).map(row => row.food.name),
  })).filter(tag => tag.items.length)
  const conflicts = hits.filter(tag => (profile.allergens || []).includes(tag.id))
  return { hits, conflicts }
}

function comparePanel() {
  const a = findFood(ui.compareA) || foodList()[0]
  const b = findFood(ui.compareB) || foodList()[1]
  if (!a || !b) return emptyLab('Add a food first.')
  const servingA = nutrientsForFood(a, a.serving?.g || 100)
  const servingB = nutrientsForFood(b, b.serving?.g || 100)
  const rows = [
    ['Calories', `${fmt(a.kcal)} kcal`, `${fmt(b.kcal)} kcal`],
    ['Protein', `${fmt(a.p, 1)} g`, `${fmt(b.p, 1)} g`],
    ['Carbs', `${fmt(a.c, 1)} g`, `${fmt(b.c, 1)} g`],
    ['Fat', `${fmt(a.f, 1)} g`, `${fmt(b.f, 1)} g`],
    ['Fibre', `${fmt(a.fib, 1)} g`, `${fmt(b.fib, 1)} g`],
    ['Sugar', `${fmt(a.sug, 1)} g`, `${fmt(b.sug, 1)} g`],
    ['Sodium', `${fmt(a.na)} mg`, `${fmt(b.na)} mg`],
    ['Per serving', `${fmt(servingA.kcal)} kcal`, `${fmt(servingB.kcal)} kcal`],
  ]
  return `<form data-form="studio:compare" class="kc-lab-form kc-lab-form--compare"><label class="kc-field"><span>Food A</span><select name="a">${foodOptions(a.id)}</select></label><label class="kc-field"><span>Food B</span><select name="b">${foodOptions(b.id)}</select></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Compare</button></form>
    <div class="kc-lab-compare"><div class="kc-lab-compare__head"><b>${esc(a.name)}</b><b>${esc(b.name)}</b></div>${rows.map(([label, left, right]) => `<div class="kc-lab-compare__row"><span>${label}</span><b>${left}</b><b>${right}</b></div>`).join('')}</div>`
}

function kitchenTab(profile) {
  const pantry = [...(profile.pantry || [])].sort((a, b) => String(a.expires).localeCompare(String(b.expires)))
  const expiring = pantry.filter(item => {
    const days = daysUntil(item.expires)
    return days != null && days <= 7
  })
  const shopping = profile.shopping || []
  const compareA = findFood(ui.compareA) || foodList()[0]
  const compareB = findFood(ui.compareB) || foodList()[1]
  const recipe = findRecipe(ui.recipeCheck) || state.recipes[0]
  const allergenResult = recipe ? recipeAllergens(recipe, profile) : { hits: [], conflicts: [] }
  const recipeNutrition = recipe ? recipeTotals(recipe) : null
  const recipeCost = recipe ? recipeItems(recipe).reduce((sum, row) => sum + (row.food.cost ? row.food.cost * row.item.g / 100 : 0), 0) / Math.max(1, recipe.servings) : 0
  const gl = MEAL_IDS.flatMap(meal => (getDay(todayKey()).meals[meal] || [])).reduce((sum, entry) => sum + entryGlycemicLoad(entry), 0)
  const glEntries = MEAL_IDS.flatMap(meal => (getDay(todayKey()).meals[meal] || [])).map(entry => ({ name: entry.name, gl: entryGlycemicLoad(entry), kcal: entry.nutrients.kcal })).sort((a, b) => b.gl - a.gl)
  const proteinValue = foodList().filter(food => food.cost > 0 && food.p > 0).map(food => ({ ...food, value: food.p / food.cost })).sort((a, b) => b.value - a.value).slice(0, 5)
  const dense = [...foodList()].sort((a, b) => b.kcal - a.kcal).slice(0, 5)
  const light = [...foodList()].sort((a, b) => a.kcal - b.kcal).slice(0, 5)
  const gap = nutrientGaps().slice().sort((a, b) => a.pct - b.pct)[0]
  const gapPool = foodList().filter(food => foodAllowed(food, profile))
  const pairings = gapPool.map(food => {
    let value = 0
    if (gap?.key === 'protein') value = food.p
    else if (gap?.key === 'fibre') value = food.fib
    else if (gap?.key && food.micros) value = food.micros[gap.key] || 0
    return { food, value }
  }).sort((a, b) => b.value - a.value).slice(0, 3)
  const plants = plantVariety(7)
  const prep = profile.prep || []
  const restaurant = ui.restaurant || { dish: 'indian', portion: 'regular', style: 'restaurant' }
  const estimate = restaurantEstimate(restaurant)

  return `<div class="kc-lab-grid">
    ${labCard('PANTRY', 'Pantry inventory', 'Keep a simple local list of what is in the kitchen. Quantities are yours to estimate.', `<div class="kc-lab-list">${pantry.length ? pantry.map(item => {
      const status = pantryStatus(item)
      return `<div class="kc-lab-row"><div><b>${esc(item.name)}</b><small>${fmt(item.grams)} g · <span class="kc-tone-${status.tone}">${esc(status.label)}</span></small></div><div class="kc-lab-row__tools"><button type="button" class="kc-text-btn" data-action="studio:pantry-shop" data-name="${esc(item.name)}">${icon('plus')} Shop</button><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:pantry-remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon('close')}</button></div></div>`
    }).join('') : emptyLab('Your pantry is empty. Add the first item below.')}</div><form class="kc-lab-form" data-form="studio:pantry-add"><label class="kc-field"><span>Item</span><input name="name" required maxlength="80" placeholder="e.g. Paneer"></label><label class="kc-field kc-field--tiny"><span>Grams</span><input name="grams" type="number" min="0" step="10" value="250"></label><label class="kc-field"><span>Use by</span><input name="expires" type="date" value="${addDays(todayKey(), 7)}"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Add</button></form>`)}
    ${labCard('USE IT FIRST', 'Pantry expiry alerts', 'A seven-day window highlights food that deserves a plan before it is wasted.', expiring.length ? `<div class="kc-lab-list">${expiring.map(item => { const status = pantryStatus(item); return `<div class="kc-lab-row"><div><b>${esc(item.name)}</b><small>${fmt(item.grams)} g · use by ${esc(status.label)}</small></div><span class="kc-lab-badge kc-lab-badge--${status.tone}">${status.tone === 'bad' ? 'Expired' : 'Use soon'}</span></div>` }).join('')}</div>` : emptyLab('Nothing is expiring in the next seven days. Add pantry dates to activate this view.'))}
    ${labCard('SHOPPING', 'Pantry shopping list', 'Add pantry items or anything else you need. Check items off as you shop.', `<div class="kc-lab-list">${shopping.length ? shopping.map(item => `<div class="kc-lab-row ${item.done ? 'is-done' : ''}"><label class="kc-lab-check"><input type="checkbox" ${item.done ? 'checked' : ''} data-action="studio:shopping-toggle" data-id="${esc(item.id)}"><span>${esc(item.name)}</span></label><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:shopping-remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon('close')}</button></div>`).join('') : emptyLab('No shopping yet. Add an item or send one from the pantry.')}</div><form class="kc-lab-form" data-form="studio:shopping-add"><label class="kc-field"><span>Add to list</span><input name="name" required maxlength="80" placeholder="e.g. Curd"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Add</button></form>`)}
    ${labCard('COMPARE', 'Food comparison tool', 'Two foods, side by side. Values are per 100 g and per serving.', comparePanel())}
    ${labCard('GLYCAEMIC LOAD', 'Glycemic-load estimate', 'An approximate load using net carbohydrate and a food-group GI estimate. Not a clinical value.', `<div class="kc-lab-hero-value">${fmt(gl, 1)}<small>GL today</small></div><div class="kc-lab-list">${glEntries.slice(0, 4).map(entry => labRow(esc(entry.name), fmt(entry.gl, 1), `${fmt(entry.kcal)} kcal`)).join('') || '<p class="kc-muted">Log food to estimate the day’s load.</p>'}</div><p class="kc-lab-fine">Low load is often under 80 per day; this is a rough teaching guide, not a target for everyone.</p>`)}
    ${labCard('VALUE', 'Protein-per-rupee ranking', 'Protein grams per rupee of the estimated cost of 100 g. Useful when the food budget is tight.', `<div class="kc-lab-list">${proteinValue.map(food => labRow(esc(food.name), `${fmt(food.value, 1)} g/₹`, `₹${fmt(food.cost)} / 100 g`)).join('')}</div>`)}
    ${labCard('DENSITY', 'Calorie-density ranking', 'The lightest and most calorie-dense foods in the offline database.', `<div class="kc-lab-split"><div><p class="kc-lab-subhead">Lightest</p>${light.map(food => labRow(esc(food.name), `${fmt(food.kcal)} kcal`)).join('')}</div><div><p class="kc-lab-subhead">Densest</p>${dense.map(food => labRow(esc(food.name), `${fmt(food.kcal)} kcal`)).join('')}</div></div><p class="kc-lab-fine">Per 100 g. Drinks are per 100 ml.</p>`)}
    ${labCard('RECIPE COST', 'Recipe cost per serving', 'Known ingredient costs only. Missing prices are treated as zero, so this is a floor estimate.', `<div class="kc-lab-list">${state.recipes.slice(0, 5).map(item => labRow(esc(item.name), recipeCost ? `₹${fmt(recipeItems(item).reduce((sum, row) => sum + (row.food.cost ? row.food.cost * row.item.g / 100 : 0), 0) / Math.max(1, item.servings), 0)}` : '—', `${item.servings} serving${item.servings === 1 ? '' : 's'}`)).join('')}</div><p class="kc-lab-fine">Costs are local estimates entered per 100 g; they are not live prices.</p>`)}
    ${labCard('ALLERGENS', 'Recipe allergen screening', 'Checks recipe ingredients against the six common allergen groups in the food database.', `<form class="kc-lab-form" data-form="studio:recipe-check"><label class="kc-field"><span>Recipe</span><select name="recipe">${recipeOptions(recipe?.id)}</select></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Screen</button></form>${allergenResult.hits.length ? `<div class="kc-lab-list">${allergenResult.hits.map(tag => labRow(esc(tag.label), `${tag.items.length} item${tag.items.length === 1 ? '' : 's'}`, tag.items.join(', '))).join('')}</div>${allergenResult.conflicts.length ? `<p class="kc-lab-warning">${icon('info')} This recipe conflicts with your profile allergens: ${esc(allergenResult.conflicts.map(item => item.label).join(', '))}.</p>` : '<p class="kc-lab-fine">No conflict with your profile allergens.</p>'}` : '<p class="kc-lab-fine">No common allergen groups detected in this recipe.</p>'}`)}
    ${labCard('RECIPE MATH', 'Recipe nutrition per 100 g', 'Average the whole cooked recipe, including every ingredient, per 100 g.', recipeNutrition ? `<div class="kc-stat-grid kc-lab-stat-grid">${statBlock('Calories', `${fmt(recipeNutrition.total.kcal / Math.max(1, recipeNutrition.grams) * 100)}`, 'per 100 g')}${statBlock('Protein', `${fmt(recipeNutrition.total.p / Math.max(1, recipeNutrition.grams) * 100, 1)} g`, 'per 100 g')}${statBlock('Carbs', `${fmt(recipeNutrition.total.c / Math.max(1, recipeNutrition.grams) * 100, 1)} g`, 'per 100 g')}${statBlock('Fat', `${fmt(recipeNutrition.total.f / Math.max(1, recipeNutrition.grams) * 100, 1)} g`, 'per 100 g')}</div><p class="kc-lab-fine">${esc(recipe.name)} · ${fmt(recipeNutrition.grams)} g total · ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}</p>` : emptyLab('Create a recipe to see this calculation.'))}
    ${labCard('PREP', 'Meal-prep checklist', 'A small, persistent checklist for the cooking you actually intend to do.', `<div class="kc-lab-list">${prep.length ? prep.map(task => `<div class="kc-lab-row ${task.done ? 'is-done' : ''}"><label class="kc-lab-check"><input type="checkbox" ${task.done ? 'checked' : ''} data-action="studio:prep-toggle" data-id="${esc(task.id)}"><span>${esc(task.name)}</span></label><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:prep-remove" data-id="${esc(task.id)}" aria-label="Remove ${esc(task.name)}">${icon('close')}</button></div>`).join('') : emptyLab('No prep tasks. Keep it to three useful steps.')}</div><form class="kc-lab-form" data-form="studio:prep-add"><label class="kc-field"><span>Task</span><input name="name" required maxlength="100" placeholder="e.g. Boil dal for two lunches"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Add</button></form>`)}
    ${labCard('EATING OUT', 'Restaurant dish estimator', 'A planning estimate for a typical dish, portion and cooking style. Menus vary widely.', `<form class="kc-lab-form kc-lab-form--three" data-form="studio:restaurant"><label class="kc-field"><span>Dish</span><select name="dish">${[['indian', 'Indian plate'], ['pizza', 'Pizza'], ['burger', 'Burger'], ['biryani', 'Biryani'], ['salad', 'Salad'], ['noodles', 'Noodles / pasta'], ['dessert', 'Dessert']].map(([id, label]) => `<option value="${id}" ${restaurant.dish === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="kc-field"><span>Portion</span><select name="portion">${[['light', 'Light'], ['regular', 'Regular'], ['large', 'Large']].map(([id, label]) => `<option value="${id}" ${restaurant.portion === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="kc-field"><span>Style</span><select name="style">${[['home', 'Home-style'], ['restaurant', 'Restaurant'], ['fried', 'Fried / rich']].map(([id, label]) => `<option value="${id}" ${restaurant.style === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Estimate</button></form><div class="kc-lab-estimate"><b>${fmt(estimate.kcal)} kcal</b><span>P ${estimate.p} g · C ${estimate.c} g · F ${estimate.f} g</span><small>${restaurantLabel(restaurant.dish)} · ${restaurant.portion} portion · ${restaurant.style}</small></div>`)}
    ${labCard('PAIRING', 'Food pairing suggestions', `Your lowest coverage today is ${gap ? `${esc(gap.label)} at ${gap.pct}%` : 'not available yet'}. These foods help close it.`, `<div class="kc-lab-list">${pairings.map(row => labRow(esc(row.food.name), gap?.key === 'protein' ? `${fmt(row.food.p, 1)} g P` : gap?.key === 'fibre' ? `${fmt(row.food.fib, 1)} g fibre` : `${fmt(row.food.micros?.[gap?.key] || 0, 1)} ${gap?.unit || ''}`, `${fmt(row.food.serving?.g || 100)} g serving`)).join('')}</div>`)}
    ${labCard('PLANTS', 'Plant-variety counter', 'Distinct plant foods logged in the last seven days. Variety is a gentle nudge, not a score to chase.', `<div class="kc-lab-hero-value">${plants.length}<small>plant foods</small></div><div class="kc-lab-chips">${plants.slice(0, 14).map(name => `<span class="kc-pill">${esc(name)}</span>`).join('') || '<p class="kc-muted">Log fruit, vegetables, pulses or grains to start.</p>'}</div>`)}
    ${labCard('ZERO WASTE', 'Use-it-first suggestions', 'The pantry items closest to their date, with a simple next step.', expiring.length ? `<div class="kc-lab-list">${expiring.map(item => { const status = pantryStatus(item); return labRow(esc(item.name), status.label, `${fmt(item.grams)} g · add it to a meal or the shopping list`) }).join('')}</div>` : emptyLab('No dated pantry items are close to expiry.'))}
  </div>`
}

function nutritionTab(profile) {
  const day = getDay(todayKey())
  const totals = dayTotals(profile, day)
  const targets = targetsFor(profile)
  const microGaps = nutrientGaps()
  const worst = [...microGaps].sort((a, b) => a.pct - b.pct).slice(0, 3)
  const protein = proteinDistribution()
  const calories = calorieDistribution()
  const quality = dietQuality()
  const timing = mealTiming()
  const weekend = weekdayWeekend()
  const debt = sleepDebt(7)
  const gl = dailyGlycemicLoad()
  const net = netCarbShare()
  const sugarShare = totals.food.kcal ? percent(totals.food.sug * 4, totals.food.kcal) : 0
  const sodiumPotassium = totals.food.micros.k ? round(totals.food.na / totals.food.micros.k, 2) : null
  const wake = state.settings.wakeTime || '07:00'
  const bed = state.settings.bedTime || '23:00'
  const wakeMinutes = Number(wake.split(':')[0]) * 60 + Number(wake.split(':')[1] || 0)
  const bedMinutes = Number(bed.split(':')[0]) * 60 + Number(bed.split(':')[1] || 0)
  const awakeHours = Math.max(1, ((bedMinutes > wakeMinutes ? bedMinutes : bedMinutes + 1440) - wakeMinutes) / 60)
  const perHour = Math.round(targets.water / awakeHours / 50) * 50
  const hydrationRows = Array.from({ length: Math.min(6, Math.max(2, Math.round(awakeHours / 2))) }, (_, index) => {
    const steps = Math.min(6, Math.max(2, Math.round(awakeHours / 2)))
    const minutes = Math.round((wakeMinutes + (index + 1) * (awakeHours * 60 / steps)) / 5) * 5
    const hour = Math.floor((minutes % 1440) / 60)
    const label = `${String(hour % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${hour >= 12 ? 'pm' : 'am'}`
    return { label, amount: perHour * (index + 1) }
  })
  const cutoffMinutes = bedMinutes - 600
  const cutoff = `${String(Math.floor((cutoffMinutes + 1440) % 1440 / 60) % 12 || 12).padStart(2, '0')}:${String((cutoffMinutes + 1440) % 60).padStart(2, '0')} ${Math.floor((cutoffMinutes + 1440) % 1440 / 60) >= 12 ? 'pm' : 'am'}`
  const fiberFoods = foodList().filter(food => foodAllowed(food, profile)).sort((a, b) => b.fib - a.fib).slice(0, 3)
  const proteinFoods = foodList().filter(food => foodAllowed(food, profile)).sort((a, b) => b.p - a.p).slice(0, 3)

  return `<div class="kc-lab-grid">
    ${labCard('SUGAR', 'Sugar-to-calorie ratio', 'A rough share of daily energy from total sugar. It includes natural sugars in fruit and milk, so read it as context, not a verdict.', `<div class="kc-lab-hero-value">${sugarShare}%<small>of calories</small></div>${bar(totals.food.sug, targets.sugar, 'bronze')}${labRow('Sugar logged', `${fmt(totals.food.sug, 1)} g`, `guide ${fmt(targets.sugar)} g`)}<p class="kc-lab-fine">The 10% free-sugar guide is a public-health reference, not a personal prescription.</p>`)}
    ${labCard('MINERALS', 'Sodium-to-potassium ratio', 'A higher ratio is common in restaurant-heavy days. Food data is approximate.', sodiumPotassium == null ? emptyLab('Log potassium-rich food to calculate this ratio.') : `<div class="kc-lab-hero-value">${sodiumPotassium}<small>Na : K</small></div>${labRow('Sodium', `${fmt(totals.food.na)} mg`)}${labRow('Potassium', `${fmt(totals.food.micros.k, 0)} mg`)}<p class="kc-lab-fine">Under 1.0 is a useful direction for most everyday plates; clinical advice may differ.</p>`)}
    ${labCard('PROTEIN', 'Protein distribution score', 'Protein is more useful spread across meals than saved for dinner.', `<div class="kc-lab-hero-value">${protein.score}<small>/100</small></div><div class="kc-lab-list">${protein.values.map(item => labRow(item.label, `${fmt(item.p, 1)} g`, `${item.pct}% of today’s protein`)).join('')}</div>`)}
    ${labCard('CALORIES', 'Calorie distribution by meal', 'Where today’s energy actually landed.', `<div class="kc-lab-list">${calories.map(item => labRow(item.label, `${fmt(item.kcal)} kcal`, `${item.pct}%`)).join('')}</div>`)}
    ${labCard('GAPS', 'Nutrient-gap finder', 'The three nutrients furthest from today’s guide.', `<div class="kc-lab-list">${worst.map(item => labRow(item.label, `${item.pct}%`, `${fmt(item.gap, 1)} ${item.unit} to go`)).join('')}</div>`)}
    ${labCard('FIBRE', 'Fibre-gap food suggestions', 'Foods that add fibre without requiring a supplement.', `<div class="kc-lab-list">${fiberFoods.map(food => labRow(esc(food.name), `${fmt(food.fib, 1)} g`, `per 100 g · ${fmt(food.kcal)} kcal`)).join('')}</div>`)}
    ${labCard('PROTEIN GAP', 'Protein-gap food suggestions', 'High-protein additions from the offline database.', `<div class="kc-lab-list">${proteinFoods.map(food => labRow(esc(food.name), `${fmt(food.p, 1)} g`, `per 100 g · ${fmt(food.kcal)} kcal`)).join('')}</div>`)}
    ${labCard('HYDRATION', 'Hydration pacing calculator', `A simple spread of your ${fmt(targets.water)} ml guide across the waking day.`, `<form class="kc-lab-form kc-lab-form--two" data-form="studio:rhythm"><label class="kc-field"><span>Wake</span><input name="wake" type="time" value="${esc(wake)}"></label><label class="kc-field"><span>Bed</span><input name="bed" type="time" value="${esc(bed)}"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Update</button></form><div class="kc-lab-list">${hydrationRows.map(row => labRow(row.label, `${fmt(row.amount)} ml`)).join('')}</div><p class="kc-lab-fine">${perHour} ml per waking hour is a pacing guide, not a rule. Thirst, weather, activity and medical advice matter.</p>`)}
    ${labCard('CAFFEINE', 'Caffeine cutoff calculator', 'A 200 mg caffeine dose, a five-hour half-life, and a target of under 50 mg at bedtime.', `<div class="kc-lab-hero-value">${cutoff}<small>last cup</small></div>${labRow('Bedtime', bed)}${labRow('Half-life used', '5 hours')}<p class="kc-lab-fine">Caffeine sensitivity varies. This is a planning estimate, not a sleep prescription.</p>`)}
    ${labCard('SLEEP', 'Sleep-debt calculator', 'Adds the shortfall against eight hours across the last seven logged nights.', `<div class="kc-lab-hero-value">${fmt(debt.hours, 1)} h<small>shortfall</small></div>${labRow('Nights logged', `${debt.nights}`)}${labRow('Status', debt.hours < 2 ? 'Close to rested' : 'Worth protecting sleep')}<p class="kc-lab-fine">A short week is not a moral failure; it is a signal to make the next night easier.</p>`)}
    ${labCard('TIMING', 'Meal-timing score', 'Rewards meals spread through the day and penalises a large late-night share.', `<div class="kc-lab-hero-value">${timing.score}<small>/100</small></div><p class="kc-copy">${esc(timing.detail)}</p><p class="kc-lab-fine">Late food is not inherently bad. This is a pattern signal, not a rule.</p>`)}
    ${labCard('WEEK PATTERN', 'Weekday vs weekend comparison', 'Average intake across the last 28 logged days, split by weekday and weekend.', `<div class="kc-lab-split"><div>${statBlock('Weekday', `${fmt(weekend.weekday)} kcal`, `${weekend.weekdayDays} days`)}</div><div>${statBlock('Weekend', `${fmt(weekend.weekend)} kcal`, `${weekend.weekendDays} days`)}</div></div><p class="kc-lab-fine">A weekend difference is normal. Only adjust if it repeatedly conflicts with your goal.</p>`)}
    ${labCard('QUALITY', 'Diet-quality score', 'A composite of protein, fibre, micronutrient coverage, sugar, sodium and variety for today.', `<div class="kc-lab-hero-value">${quality.score}<small>/100</small></div><div class="kc-lab-list">${quality.parts.map(([label, value, max]) => labRow(label, `${Math.round(value)}/${max}`)).join('')}</div><p class="kc-lab-fine">${esc(quality.grade)}. Use the parts to choose one next step, not to judge the whole day.</p>`)}
    ${labCard('GLYCEMIC LOAD', 'Daily glycemic-load total', 'An approximate total from the foods logged today.', `<div class="kc-lab-hero-value">${fmt(gl, 1)}<small>GL</small></div><p class="kc-copy">High-fibre and protein-rich meals usually produce a lower load. Cooking and portion size still matter.</p>`)}
    ${labCard('NET CARBS', 'Net-carb share', 'Carbohydrate remaining after fibre, and its share of today’s calories.', `<div class="kc-lab-hero-value">${fmt(net.grams, 1)} g<small>net carbs</small></div>${labRow('Share of calories', `${net.pct}%`)}${labRow('Total carbs', `${fmt(totals.food.c, 1)} g`)}${labRow('Fibre', `${fmt(totals.food.fib, 1)} g`)}`)}
  </div>`
}

function bodyTab(profile) {
  const ma = movingAverageWeight(profile)
  const rate = weightRate(profile)
  const plateau = plateauDetected(profile)
  const measurement = latestMeasurement(profile)
  const whr = measurement?.waist && measurement?.hips ? round(measurement.waist / measurement.hips, 2) : null
  const targets = targetsFor(profile)
  const rows = loggedRows(14)
  const hunger = average(rows.map(row => row.day?.hunger).filter(value => value != null))
  const mood = average(rows.map(row => row.day?.mood).filter(value => value != null))
  const energy = average(rows.map(row => row.day?.energy).filter(value => value != null))
  const sleepMoodRows = rows.filter(row => row.day?.sleep != null && row.day?.mood != null)
  const sleepMood = correlation(sleepMoodRows.map(row => row.day.sleep), sleepMoodRows.map(row => row.day.mood))
  const scenarios = [0.25, 0.5, 0.75].map(value => {
    const projection = goalProjection({ ...profile, rate: value })
    return { rate: value, projection }
  })
  const low = targets.kcal - 100
  const high = targets.kcal + 250
  const habits = profile.habits || []
  const review = profile.reviews[weekStartKey()] || {}
  const cravings = profile.cravings || []
  const days = lastNDates(14)

  return `<div class="kc-lab-grid">
    ${labCard('WEIGHT', 'Seven-day weight moving average', 'Averages the last seven weigh-ins to reduce day-to-day noise.', ma == null ? emptyLab('Log at least one weight to start the average.') : `<div class="kc-lab-hero-value">${formatWeight(ma, state.settings.units)}<small>7-day average</small></div>${labRow('Latest', formatWeight(profile.weightKg, state.settings.units))}${labRow('Weigh-ins', `${profile.weights.length}`)}`)}
    ${labCard('RATE', 'Weight-rate-per-week estimate', 'The average weekly change across your last 30 days of weigh-ins.', rate == null ? emptyLab('Two weigh-ins are needed for a rate.') : `<div class="kc-lab-hero-value">${rate > 0 ? '+' : ''}${rate} kg<small>per week</small></div><p class="kc-copy">A single week can be water, salt or digestion. Look for a direction over several weeks.</p>`)}
    ${labCard('PLATEAU', 'Plateau detector', 'Flags a very small scale change over at least two weeks.', `<div class="kc-lab-hero-value">${plateau.plateau ? 'Steady' : 'Moving'}<small>scale pattern</small></div><p class="kc-copy">${esc(plateau.detail)}</p>`)}
    ${labCard('RATIO', 'Waist-to-hip ratio', 'A screening ratio from your latest tape measurements.', whr == null ? emptyLab('Add waist and hip measurements to calculate this ratio.') : `<div class="kc-lab-hero-value">${whr}<small>waist ÷ hips</small></div>${labRow('Waist', `${measurement.waist} cm`)}${labRow('Hips', `${measurement.hips} cm`)}<p class="kc-lab-fine">Ratios are a screening signal, not a diagnosis.</p>`)}
    ${labCard('SCENARIOS', 'Goal scenario table', 'What different weekly paces would mean for the same goal weight.', `<div class="kc-lab-list">${scenarios.map(item => labRow(`${item.rate} kg/week`, item.projection ? `${prettyDate(item.projection.date.toISOString().slice(0, 10))}` : '—', item.projection ? `${item.projection.weeks} weeks` : 'Set a goal')).join('')}</div>`)}
    ${labCard('MAINTENANCE', 'Maintenance calorie range', 'A ±5% band around your estimated TDEE, not a precise prescription.', `<div class="kc-lab-hero-value">${fmt(Math.round(tdee(profile) * 0.95))}–${fmt(Math.round(tdee(profile) * 1.05))}<small>kcal / day</small></div><p class="kc-lab-fine">TDEE is an estimate. Compare it with two to three weeks of real weight and hunger data.</p>`)}
    ${labCard('CYCLING', 'Calorie-cycling planner', 'A seven-day draft that averages back to your target. It is not a recommendation to over-restrict.', `<div class="kc-lab-list">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => labRow(label, `${fmt(index < 5 ? low : high)} kcal`, index < 5 ? 'lower day' : 'higher day')).join('')}</div><p class="kc-lab-fine">Five lower days and two higher days average to about ${fmt(targets.kcal)} kcal. Keep the floor in view.</p>`)}
    ${labCard('HABITS', 'Custom habit tracker', 'Build a private list of habits that support the food work.', `<div class="kc-lab-list">${habits.length ? habits.map(habit => `<div class="kc-lab-row"><div><b>${esc(habit.name)}</b><small>${habitStreak(habit)}-day streak</small></div><div class="kc-lab-row__tools"><button type="button" class="kc-chip ${habit.checks[todayKey()] ? 'is-active' : ''}" data-action="studio:habit-toggle" data-id="${esc(habit.id)}">${habit.checks[todayKey()] ? 'Done' : 'Check'}</button><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:habit-remove" data-id="${esc(habit.id)}" aria-label="Remove ${esc(habit.name)}">${icon('close')}</button></div></div>`).join('') : emptyLab('Add one habit you can repeat on an ordinary day.')}</div><form class="kc-lab-form" data-form="studio:habit-add"><label class="kc-field"><span>New habit</span><input name="name" required maxlength="60" placeholder="e.g. Vegetables at lunch"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Add</button></form>`)}
    ${labCard('STREAK GRID', 'Habit streak grid', 'The last 14 days for each habit. Filled means checked.', habits.length ? `<div class="kc-lab-habit-grid">${habits.map(habit => `<div class="kc-lab-habit-row"><span>${esc(habit.name)}</span><div class="kc-lab-habit-cells">${days.map(date => `<i class="kc-lab-habit-cell ${habit.checks[date] ? 'is-on' : ''}" title="${esc(prettyDate(date))}"></i>`).join('')}</div></div>`).join('')}</div>` : emptyLab('Add a habit to draw its grid.'))}
    ${labCard('REVIEW', 'Weekly review journal', 'Three prompts, once a week. Saved by week on this device.', `<form class="kc-lab-form kc-lab-form--stack" data-form="studio:review"><label class="kc-field"><span>What worked?</span><textarea name="wins" rows="2" maxlength="300" placeholder="A meal, a choice, a small win">${esc(review.wins || '')}</textarea></label><label class="kc-field"><span>What felt hard?</span><textarea name="challenge" rows="2" maxlength="300" placeholder="Be specific and kind">${esc(review.challenge || '')}</textarea></label><label class="kc-field"><span>One next step</span><input name="next" maxlength="160" value="${esc(review.next || '')}" placeholder="Make it small"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Save review</button></form><p class="kc-lab-fine">Week of ${prettyDate(weekStartKey())}.</p>`)}
    ${labCard('CRAVINGS', 'Craving log', 'Name the craving without acting on it. Patterns are easier to see when they are written down.', `<div class="kc-lab-list">${cravings.length ? cravings.slice(0, 5).map(item => `<div class="kc-lab-row"><div><b>${esc(item.text)}</b><small>${prettyDate(item.date)} · intensity ${item.intensity}/5</small></div><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:craving-remove" data-id="${esc(item.id)}" aria-label="Remove craving">${icon('close')}</button></div>`).join('') : emptyLab('No cravings logged yet.')}</div><form class="kc-lab-form" data-form="studio:craving-add"><label class="kc-field"><span>Craving</span><input name="text" required maxlength="100" placeholder="e.g. Something sweet after lunch"></label><label class="kc-field kc-field--tiny"><span>1–5</span><input name="intensity" type="number" min="1" max="5" value="3"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Log</button></form>`)}
    ${labCard('HUNGER', 'Hunger average', 'The average hunger check-in across the last 14 logged days.', `<div class="kc-lab-hero-value">${hunger ? fmt(hunger, 1) : '—'}<small>/ 5</small></div><p class="kc-copy">${hunger ? 'A very high average can mean meals are too small, too fast or not satisfying enough.' : 'Log a hunger check-in on Today to see this pattern.'}</p>`)}
    ${labCard('MOOD', 'Mood and energy average', 'Two optional signals, averaged over the last 14 logged days.', `<div class="kc-lab-split"><div>${statBlock('Mood', mood ? `${fmt(mood, 1)}/4` : '—', 'Optional check-in')}</div><div>${statBlock('Energy', energy ? `${fmt(energy, 1)}/5` : '—', 'Optional check-in')}</div></div>`)}
    ${labCard('CORRELATION', 'Sleep-mood correlation', 'A descriptive correlation from days where both sleep and mood were logged.', sleepMood == null ? emptyLab('Log sleep and mood on three days to see a correlation.') : `<div class="kc-lab-hero-value">${sleepMood}<small>r</small></div><p class="kc-copy">${sleepMood > 0.2 ? 'More sleep and better mood tended to move together in this small sample.' : sleepMood < -0.2 ? 'In this sample, more sleep and better mood did not move together.' : 'No clear relationship appears in this small sample.'}</p><p class="kc-lab-fine">Correlation is not causation, and this is only your own data.</p>`)}
    ${labCard('STEPS', 'Step streak', 'Consecutive days at 8,000 steps or more, counting back from today or yesterday.', `<div class="kc-lab-hero-value">${stepStreak()}<small>days</small></div>${labRow('Today', `${fmt(getDay(todayKey()).steps || 0)} steps`)}<p class="kc-lab-fine">Movement counts even when the step number is not perfect.</p>`)}
    ${labCard('BALANCE', 'Today calorie balance', 'A compact view of food, your target and exercise credit for the day you are viewing.', `<div class="kc-lab-hero-value">${fmt(dayTotals(profile, getDay(ui.date)).remaining)}<small>kcal ${getDay(ui.date) === todayKey() ? 'left' : ''}</small></div><div class="kc-lab-list">${labRow('Food eaten', `${fmt(dayTotals(profile, getDay(ui.date)).food.kcal)} kcal`)}${labRow('Your target', `${fmt(dayTotals(profile, getDay(ui.date)).targets.kcal)} kcal`)}${labRow('Exercise credit', `+${fmt(dayTotals(profile, getDay(ui.date)).burned)} kcal`)}${labRow('Budget with credit', `${fmt(dayTotals(profile, getDay(ui.date)).budget)} kcal`)}</div>`)}
    ${labCard('PROFILE', 'BMR and TDEE summary', 'Your profile’s resting and maintenance estimates, used by the planner and targets.', `<div class="kc-lab-list">${labRow('BMR', `${fmt(bmr(profile))} kcal`, 'At rest')}${labRow('TDEE', `${fmt(tdee(profile))} kcal`, 'Maintenance')}${labRow('Goal target', `${fmt(targetCalories(profile))} kcal`, 'From your goal and pace')}${labRow('Protein target', `${fmt(targetsFor(profile).protein)} g`, '')}${labRow('Carbs target', `${fmt(targetsFor(profile).carbs)} g`, '')}${labRow('Fat target', `${fmt(targetsFor(profile).fat)} g`, '')}</div>`)}
    ${labCard('EATEN', 'Calories consumed estimate', 'Today’s logged food against your profile target. Helps when you want the daily score without the full diary.', `<div class="kc-lab-hero-value">${fmt(dayTotals(profile, getDay(ui.date)).food.kcal)}<small>kcal logged</small></div><div class="kc-lab-list">${labRow('Today vs target', `${percent(dayTotals(profile, getDay(ui.date)).food.kcal, targetCalories(profile))}%`, '')}${labRow('Protein eaten', `${fmt(dayTotals(profile, getDay(ui.date)).food.p, 1)} g`, `${fmt(targetsFor(profile).protein)} g target`)}${labRow('Carbs eaten', `${fmt(dayTotals(profile, getDay(ui.date)).food.c, 1)} g`, `${fmt(targetsFor(profile).carbs)} g target`)}${labRow('Fat eaten', `${fmt(dayTotals(profile, getDay(ui.date)).food.f, 1)} g`, `${fmt(targetsFor(profile).fat)} g target`)}</div>`)}
  </div>`
}

function reportsTab(profile) {
  const week = reportCard(7)
  const month = reportCard(30)
  const rows30 = loggedRows(30)
  const best = [...rows30].sort((a, b) => b.score - a.score)[0]
  const toughest = [...rows30].filter(row => row.totals.food.kcal > 0).sort((a, b) => a.score - b.score)[0]
  const timed = MEAL_IDS.flatMap(meal => (getDay(todayKey()).meals[meal] || []))
  const windows = [
    { label: 'Before 11am', meals: timed.filter(entry => new Date(entry.at).getHours() < 11) },
    { label: '11am–4pm', meals: timed.filter(entry => { const hour = new Date(entry.at).getHours(); return hour >= 11 && hour < 16 }) },
    { label: '4pm–9pm', meals: timed.filter(entry => { const hour = new Date(entry.at).getHours(); return hour >= 16 && hour < 21 }) },
    { label: 'After 9pm', meals: timed.filter(entry => new Date(entry.at).getHours() >= 21) },
  ]
  const totalTimed = timed.reduce((sum, entry) => sum + entry.nutrients.kcal, 0)
  const adherence = planAdherence(7)
  const spendRows = loggedRows(30)
  const spend = spendRows.reduce((sum, row) => sum + row.totals.cost, 0)
  const spendDays = spendRows.filter(row => row.totals.cost > 0).length
  const variety = new Set(rows30.flatMap(row => MEAL_IDS.flatMap(meal => (row.day.meals?.[meal] || []).map(entry => entry.name))))
  const quality = dataQuality()
  const dupes = duplicateGroups(30)
  const safety = localSafetyScore()
  const quickAdds = profile.quickAdds || []
  const planText = mealPlanText(profile)
  const shoppingText = shoppingListText(profile)
  const snapshot = progressSnapshot(profile)
  const hash = ui.fingerprint || fingerprint()
  const photo = ui.photoEstimate || { dish: 'indian', portion: 'regular', style: 'home' }
  const photoEstimate = restaurantEstimate(photo)

  return `<div class="kc-lab-grid">
    ${labCard('PHOTO', 'Food photo calorie estimation', 'Photograph the plate, then describe it with the three selectors. Nothing leaves the device — the app turns your description into a structured estimate you can log.', `<form class="kc-lab-form kc-lab-form--three" data-form="studio:photo-estimate"><label class="kc-field"><span>Dish type</span><select name="dish">${[['indian', 'Indian plate'], ['pizza', 'Pizza'], ['burger', 'Burger'], ['biryani', 'Biryani'], ['salad', 'Salad'], ['noodles', 'Noodles / pasta'], ['dessert', 'Dessert']].map(([id, label]) => `<option value="${id}" ${photo.dish === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="kc-field"><span>Portion</span><select name="portion">${[['light', 'Light'], ['regular', 'Regular'], ['large', 'Large']].map(([id, label]) => `<option value="${id}" ${photo.portion === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="kc-field"><span>Style</span><select name="style">${[['home', 'Home-style'], ['restaurant', 'Restaurant'], ['fried', 'Fried / rich']].map(([id, label]) => `<option value="${id}" ${photo.style === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">Estimate</button></form><div class="kc-lab-estimate"><b>${fmt(photoEstimate.kcal)}<small>kcal estimated</small></b><span>P ${photoEstimate.p} g · C ${photoEstimate.c} g · F ${photoEstimate.f} g</span><small>${restaurantLabel(photo.dish)} · ${photo.portion} portion · ${photo.style}</small></div><div class="kc-lab-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="studio:photo-log">${icon('plus')} Log to breakfast</button></div><p class="kc-lab-fine">This is a photo-estimate stub: it returns a structured manual estimate from the restaurant estimator rather than automatic image analysis. That keeps the app local and offline.</p>`)}
    ${labCard('WEEK', 'Seven-day report card', 'A compact read of the last seven days, including unlogged days.', `<div class="kc-lab-report-grade">${week.grade}</div><div class="kc-stat-grid kc-lab-stat-grid">${statBlock('Average', `${fmt(week.avgKcal)} kcal`, 'logged days')}${statBlock('Score', `${week.avgScore}/100`, 'logged days')}${statBlock('Protein days', `${week.proteinDays}`, 'at target')}${statBlock('Water days', `${week.waterDays}`, 'at target')}</div><p class="kc-lab-fine">${week.overDays} day${week.overDays === 1 ? '' : 's'} above 110% of target. The next week only needs one small repeatable improvement.</p>`)}
    ${labCard('MONTH', 'Thirty-day nutrition audit', 'Averages across the last month, with the number of logged days made visible.', `<div class="kc-lab-list">${labRow('Logged days', `${month.logged.length} / 30`)}${labRow('Average intake', `${fmt(month.avgKcal)} kcal`)}${labRow('Average score', `${month.avgScore}/100`)}${labRow('Protein-target days', `${month.proteinDays}`)}${labRow('Water-target days', `${month.waterDays}`)}</div>`)}
    ${labCard('HIGHLIGHTS', 'Best and toughest day', 'The highest and lowest scoring logged days in the last 30.', `<div class="kc-lab-split"><div>${best ? statBlock('Best', `${best.score}/100`, prettyDate(best.date)) : emptyLab('No logged days.')}</div><div>${toughest ? statBlock('Toughest', `${toughest.score}/100`, prettyDate(toughest.date)) : emptyLab('No logged days.')}</div></div><p class="kc-lab-fine">A low-score day is information about the week, not a verdict on you.</p>`)}
    ${labCard('TIMING', 'Meal-timing breakdown', 'Today’s calories grouped by the time they were logged.', totalTimed ? `<div class="kc-lab-list">${windows.map(window => labRow(window.label, `${fmt(window.meals.reduce((sum, entry) => sum + entry.nutrients.kcal, 0))} kcal`, `${percent(window.meals.reduce((sum, entry) => sum + entry.nutrients.kcal, 0), totalTimed)}%`)).join('')}</div>` : emptyLab('Log food to see the timing breakdown.'))}
    ${labCard('PLAN', 'Plan-adherence check', 'How many planned foods from the last seven days actually made it into the diary.', `<div class="kc-lab-hero-value">${adherence.pct}%<small>planned foods logged</small></div>${labRow('Matched', `${adherence.matched}`, `of ${adherence.planned} planned`)}${adherence.planned ? bar(adherence.matched, adherence.planned, 'accent') : ''}<p class="kc-lab-fine">A plan is a draft. Changing it to fit a real day is not failure.</p>`)}
    ${labCard('SPEND', 'Food-spend review', 'Known costs from the last 30 days. Missing prices are excluded.', `<div class="kc-lab-hero-value">₹${fmt(spend)}<small>last 30 days</small></div>${labRow('Days with cost data', `${spendDays}`)}${labRow('Average per logged day', `₹${fmt(spend / Math.max(1, spendDays))}`)}${labRow('Budget guide', `₹${fmt(state.settings.budget || 0)} / day`)}`)}
    ${labCard('VARIETY', 'Food-variety count', 'Distinct foods logged in the last 30 days. More variety usually means more micronutrients.', `<div class="kc-lab-hero-value">${variety.size}<small>foods</small></div><p class="kc-copy">${variety.size >= 30 ? 'A broad base. Check that protein, fibre and plants are represented, not just variety.' : 'Try adding one new fruit, vegetable, pulse or grain this week.'}</p>`)}
    ${labCard('QUALITY', 'Data-quality check', 'Finds common record problems that make trends less trustworthy.', `<div class="kc-lab-list">${labRow('Duplicate groups', `${quality.duplicates}`, 'same food and portion')}${labRow('Zero-calorie entries', `${quality.zero}`)}${labRow('Water-only days', `${quality.waterOnly}`)}${labRow('Weights logged', quality.missingWeight ? 'None' : 'Yes')}${labRow('Last backup', quality.backupAge == null ? 'Never' : `${quality.backupAge} days ago`)}</div>`)}
    ${labCard('DUPLICATES', 'Duplicate-entry finder', 'Entries with the same name and portion in the same meal and day.', dupes.length ? `<div class="kc-lab-list">${dupes.slice(0, 5).map(group => `<div class="kc-lab-row"><div><b>${esc(group.name)}</b><small>${prettyDate(group.date)} · ${esc(group.meal)} · ${group.count} copies</small></div><button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="studio:dedupe" data-date="${esc(group.date)}" data-ids="${esc(group.removeIds.join(','))}">Remove extras</button></div>`).join('')}</div>` : emptyLab('No duplicate entries found in the last 30 days.'))}
    ${labCard('BACKUP', 'Backup fingerprint', 'A short local fingerprint of the current data. Compare it after an export if you want a quick integrity check.', `<div class="kc-lab-fingerprint">${hash}</div><div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="studio:fingerprint">Refresh</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="studio:copy-fingerprint">${icon('copy')} Copy</button></div><p class="kc-lab-fine">This is a lightweight checksum, not encryption or a cryptographic signature.</p>`)}
    ${labCard('QUICK ADDS', 'Quick-add presets', 'Save repeated snacks or meals, then log one in a tap. Presets are stored per profile.', `<div class="kc-lab-list">${quickAdds.length ? quickAdds.map(item => `<div class="kc-lab-row"><div><b>${esc(item.name)}</b><small>${fmt(item.kcal)} kcal · P ${fmt(item.p, 1)} · C ${fmt(item.c, 1)} · F ${fmt(item.f, 1)}</small></div><div class="kc-lab-row__tools"><button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="studio:quick-log" data-id="${esc(item.id)}">Log</button><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="studio:quick-remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon('close')}</button></div></div>`).join('') : emptyLab('No presets yet. Add a repeatable snack or breakfast.')}</div><form class="kc-lab-form kc-lab-form--three" data-form="studio:quick-add"><label class="kc-field"><span>Name</span><input name="name" required maxlength="60" placeholder="e.g. Evening curd"></label><label class="kc-field kc-field--tiny"><span>kcal</span><input name="kcal" type="number" min="0" max="3000" required placeholder="120"></label><label class="kc-field kc-field--tiny"><span>P (g)</span><input name="p" type="number" min="0" max="300" step="0.1" placeholder="10"></label><button class="kc-btn kc-btn--soft kc-btn--sm" type="submit">${icon('plus')} Save</button></form>`)}
    ${labCard('EXPORT', 'Meal-plan text export', 'Download the next seven planned days as a plain text file.', `<div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="studio:export-plan">${icon('download')} Export plan</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="studio:copy-plan">${icon('copy')} Copy</button></div><pre class="kc-lab-pre">${esc(planText.slice(0, 420))}${planText.length > 420 ? '\n…' : ''}</pre>`)}
    ${labCard('EXPORT', 'Shopping-list export', 'Download the current shopping list as plain text.', `<div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="studio:export-shopping">${icon('download')} Export list</button></div><pre class="kc-lab-pre">${esc(shoppingText.slice(0, 360))}${shoppingText.length > 360 ? '\n…' : ''}</pre>`)}
    ${labCard('SNAPSHOT', 'Progress-snapshot copy', 'A plain-language seven-day summary you can paste into notes or share with a professional.', `<pre class="kc-lab-pre">${esc(snapshot)}</pre><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="studio:copy-snapshot">${icon('copy')} Copy snapshot</button>`)}
    ${labCard('SAFETY', 'Local-data safety score', 'A practical score for backup, record quality, storage and duplicate hygiene.', `<div class="kc-lab-hero-value">${safety}<small>/100</small></div>${bar(safety, 100, safety >= 70 ? 'accent' : 'bronze')}<p class="kc-copy">${safety >= 85 ? 'Your local record is in good shape. Export a fresh backup after the next big change.' : safety >= 65 ? 'A small cleanup or backup would make this record more resilient.' : 'Start with a JSON backup, then resolve duplicates or zero-calorie entries.'}</p><p class="kc-lab-fine">Everything remains on this device. A backup is the only copy that survives losing it.</p>`)}
  </div>`
}

function mealPlanText(profile) {
  const start = todayKey()
  const lines = [`kcal · 7-day meal plan · ${profile.name}`, '']
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(start, index)
    lines.push(`${prettyDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}`)
    const plan = profile.plan?.[date] || {}
    for (const meal of MEALS) {
      const items = (plan[meal.id] || []).map(item => {
        const food = findFood(item.foodId)
        return food ? `${food.name} (${fmt(item.grams)} g)` : null
      }).filter(Boolean)
      lines.push(`  ${meal.name}: ${items.length ? items.join(', ') : '—'}`)
    }
    lines.push('')
  }
  lines.push('Generated locally by kcal · CensorisLabs')
  return lines.join('\n')
}

function shoppingListText(profile) {
  const items = profile.shopping || []
  const lines = [`kcal · shopping list · ${profile.name}`, '']
  if (!items.length) lines.push('No items yet.')
  for (const item of items) lines.push(`${item.done ? '[x]' : '[ ]'} ${item.name}`)
  if (profile.pantry?.length) {
    lines.push('', 'Pantry reference')
    for (const item of profile.pantry) lines.push(`- ${item.name}: ${fmt(item.grams)} g, use by ${prettyDate(item.expires)}`)
  }
  lines.push('', 'Generated locally by kcal · CensorisLabs')
  return lines.join('\n')
}

function progressSnapshot(profile) {
  const week = reportCard(7)
  const rate = weightRate(profile)
  const habits = profile.habits || []
  const lines = [
    `kcal · 7-day progress · ${profile.name}`,
    `Average intake: ${fmt(week.avgKcal)} kcal across ${week.logged.length} logged days`,
    `Average daily score: ${week.avgScore}/100`,
    `Protein target: ${week.proteinDays} day${week.proteinDays === 1 ? '' : 's'} · Water target: ${week.waterDays} day${week.waterDays === 1 ? '' : 's'}`,
    `Weight: ${formatWeight(profile.weightKg, state.settings.units)} · Weekly rate: ${rate == null ? 'not enough data' : `${rate > 0 ? '+' : ''}${rate} kg`}`,
    `Habits: ${habits.length ? habits.map(habit => `${habit.name} (${habitStreak(habit)}d)`).join(', ') : 'none tracked'}`,
    'Generated locally by kcal · CensorisLabs',
  ]
  return lines.join('\n')
}

export function renderStudio(root) {
  const profile = getProfile()
  const tab = TABS.some(item => item.id === ui.studioTab) ? ui.studioTab : 'kitchen'
  root.innerHTML = `<div class="kc-view kc-studio">
    <div class="kc-page-head"><div><p class="kc-eyebrow">KCAL STUDIO · ${FEATURE_COUNT} FEATURES</p><h1>Experiment, don’t guess.</h1><p>${esc(profile.name)} · sixty extra tools for the kitchen, body, habits and local data.</p></div><div class="kc-page-actions"><span class="kc-pill">${icon('flask')} 60 new tools</span><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="studio:guide">${icon('book')} Feature guide</button></div></div>
    <div class="kc-tabbar">${TABS.map(item => `<button type="button" class="kc-tab ${tab === item.id ? 'is-active' : ''}" data-action="studio:tab" data-tab="${item.id}">${icon(item.icon)} ${item.label}</button>`).join('')}</div>
    ${tab === 'kitchen' ? kitchenTab(profile) : tab === 'nutrition' ? nutritionTab(profile) : tab === 'body' ? bodyTab(profile) : reportsTab(profile)}
    <p class="kc-disclaimer">Studio estimates are educational pattern tools, not medical advice or a diagnosis. Food composition, portion sizes and personal needs vary.</p>
  </div>`
}

on('studio:tab', element => { ui.studioTab = element.dataset.tab; refresh() })
on('studio:guide', () => { ui.moreTab = 'guide'; go('more') })
on('studio:pantry-remove', element => {
  update(() => removePantryItem(element.dataset.id), { label: 'Remove pantry item' })
  toast('Pantry item removed')
})
on('studio:pantry-shop', element => {
  let added = false
  update(() => { added = addShoppingItem(element.dataset.name) }, { label: 'Add pantry item to shopping' })
  toast(added ? `${element.dataset.name} added to the list` : 'Already on the shopping list')
})
on('studio:shopping-toggle', element => {
  update(() => toggleShoppingItem(element.dataset.id), { label: 'Update shopping list' })
})
on('studio:shopping-remove', element => {
  update(() => removeShoppingItem(element.dataset.id), { label: 'Remove shopping item' })
  toast('Shopping item removed')
})
on('studio:prep-toggle', element => {
  update(() => togglePrepTask(element.dataset.id), { label: 'Update prep task' })
})
on('studio:prep-remove', element => {
  update(() => removePrepTask(element.dataset.id), { label: 'Remove prep task' })
})
on('studio:habit-toggle', element => {
  update(() => toggleHabit(element.dataset.id), { label: 'Check habit' })
})
on('studio:habit-remove', element => {
  update(() => removeHabit(element.dataset.id), { label: 'Remove habit' })
})
on('studio:craving-remove', element => {
  update(() => removeCraving(element.dataset.id), { label: 'Remove craving' })
})
on('studio:quick-log', element => {
  const preset = getProfile().quickAdds.find(item => item.id === element.dataset.id)
  if (!preset) return
  update(() => addEntry(todayKey(), 'breakfast', makeQuickEntry(preset)), { label: 'Log quick preset' })
  toast(`${preset.name} logged to breakfast`)
})
on('studio:quick-remove', element => {
  update(() => removeQuickAdd(element.dataset.id), { label: 'Remove quick preset' })
  toast('Preset removed')
})
on('studio:dedupe', element => {
  const ids = String(element.dataset.ids || '').split(',').filter(Boolean)
  let removed = 0
  update(() => { removed = removeEntries(element.dataset.date, ids) }, { label: 'Remove duplicate entries' })
  toast(`${removed} duplicate entr${removed === 1 ? 'y' : 'ies'} removed`)
})
on('studio:fingerprint', () => {
  ui.fingerprint = fingerprint()
  refresh()
  toast('Fingerprint refreshed')
})
on('studio:copy-fingerprint', async () => {
  const ok = await copyText(`${ui.fingerprint || fingerprint()} · kcal backup fingerprint`)
  toast(ok ? 'Fingerprint copied' : 'Could not copy fingerprint', ok ? 'ok' : 'error')
})
on('studio:export-plan', () => {
  downloadFile(`kcal-meal-plan-${todayKey()}.txt`, mealPlanText(getProfile()), 'text/plain;charset=utf-8')
  toast('Meal plan exported')
})
on('studio:copy-plan', async () => {
  const ok = await copyText(mealPlanText(getProfile()))
  toast(ok ? 'Meal plan copied' : 'Could not copy the plan', ok ? 'ok' : 'error')
})
on('studio:export-shopping', () => {
  downloadFile(`kcal-shopping-${todayKey()}.txt`, shoppingListText(getProfile()), 'text/plain;charset=utf-8')
  toast('Shopping list exported')
})
on('studio:copy-snapshot', async () => {
  const ok = await copyText(progressSnapshot(getProfile()))
  toast(ok ? 'Progress snapshot copied' : 'Could not copy the snapshot', ok ? 'ok' : 'error')
})

onForm('studio:pantry-add', form => {
  const data = new FormData(form)
  update(() => addPantryItem({ name: data.get('name'), grams: data.get('grams'), expires: data.get('expires') }), { label: 'Add pantry item' })
  toast('Pantry item added')
})
onForm('studio:shopping-add', form => {
  const data = new FormData(form)
  let added = false
  update(() => { added = addShoppingItem(data.get('name')) }, { label: 'Add shopping item' })
  toast(added ? 'Added to shopping list' : 'That item is already on the list')
})
onForm('studio:prep-add', form => {
  const data = new FormData(form)
  update(() => addPrepTask(data.get('name')), { label: 'Add prep task' })
  toast('Prep task added')
})
onForm('studio:habit-add', form => {
  const data = new FormData(form)
  let habit = null
  update(() => { habit = addHabit(data.get('name')) }, { label: 'Add habit' })
  if (habit) toast('Habit added')
})
onForm('studio:craving-add', form => {
  const data = new FormData(form)
  update(() => addCraving({ text: data.get('text'), intensity: data.get('intensity') }), { label: 'Log craving' })
  toast('Craving logged')
})
onForm('studio:review', form => {
  const data = new FormData(form)
  update(() => saveWeeklyReview(weekStartKey(), { wins: data.get('wins'), challenge: data.get('challenge'), next: data.get('next') }), { label: 'Save weekly review' })
  toast('Weekly review saved')
})
onForm('studio:quick-add', form => {
  const data = new FormData(form)
  update(() => addQuickAdd({ name: data.get('name'), kcal: data.get('kcal'), p: data.get('p'), c: data.get('c'), f: data.get('f') }), { label: 'Add quick preset' })
  toast('Quick preset saved')
})
onForm('studio:compare', form => {
  const data = new FormData(form)
  ui.compareA = data.get('a')
  ui.compareB = data.get('b')
  refresh()
})
onForm('studio:recipe-check', form => {
  ui.recipeCheck = new FormData(form).get('recipe')
  refresh()
})
onForm('studio:restaurant', form => {
  const data = new FormData(form)
  ui.restaurant = { dish: data.get('dish'), portion: data.get('portion'), style: data.get('style') }
  refresh()
})
onForm('studio:photo-estimate', form => {
  const data = new FormData(form)
  ui.photoEstimate = { dish: data.get('dish'), portion: data.get('portion'), style: data.get('style') }
  refresh()
})
on('studio:photo-log', () => {
  const photo = ui.photoEstimate || { dish: 'indian', portion: 'regular', style: 'home' }
  const estimate = restaurantEstimate(photo)
  const name = `Photo estimate: ${restaurantLabel(photo.dish)}`
  update(() => addEntry(todayKey(), 'breakfast', makeQuickEntry({ name, kcal: estimate.kcal, p: estimate.p, c: estimate.c, f: estimate.f })), { label: 'Log photo estimate' })
  toast(`${name} logged to breakfast`)
})
onForm('studio:rhythm', form => {
  const data = new FormData(form)
  update(() => {
    state.settings.wakeTime = data.get('wake') || '07:00'
    state.settings.bedTime = data.get('bed') || '23:00'
  }, { label: 'Update daily rhythm' })
  toast('Hydration pacing updated')
})
