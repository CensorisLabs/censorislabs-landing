import { FOODS, FOOD_MAP, ALLERGEN_TAGS } from '../data/foods.js'
import { RECIPES } from '../data/recipes.js'
import { ACHIEVEMENTS } from '../data/achievements.js'
import { nutrientsForFood, sumNutrients, targetsFor, dayTotals, scoreDay, zeroNutrients, estimatedGI } from './calc.js'

const KEY = 'censoris-kcal-v2'

export const MEALS = [
  { id: 'breakfast', name: 'Breakfast', short: 'Breakfast', icon: 'sunrise', hint: 'Start steady' },
  { id: 'lunch', name: 'Lunch', short: 'Lunch', icon: 'sun', hint: 'Midday fuel' },
  { id: 'dinner', name: 'Dinner', short: 'Dinner', icon: 'moon', hint: 'Finish light' },
  { id: 'snacks', name: 'Snacks', short: 'Snacks', icon: 'sparkles', hint: 'Small gaps' },
]
export const MEAL_IDS = MEALS.map(meal => meal.id)

const listeners = new Set()
const undoStack = []

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseKey(key) {
  const [year, month, day] = String(key).split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function addDays(key, amount) {
  const date = parseKey(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

export function todayKey() {
  return dateKey(new Date())
}

export function prettyDate(key, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseKey(key).toLocaleDateString('en-IN', options)
}

export function relativeDate(key) {
  const today = todayKey()
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return prettyDate(key, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function round(value, decimals = 0) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function blankTargets() {
  return { kcal: 2000, protein: 120, carbs: 220, fat: 65, fiber: 28, water: 2400, sugar: 50, sodium: 2300 }
}

export function blankProfile(name = 'You', id = uid('profile')) {
  return {
    id,
    name,
    emoji: '🌿',
    sex: 'female',
    age: 30,
    heightCm: 165,
    weightKg: 65,
    startWeightKg: 65,
    goalWeightKg: 60,
    activity: 1.375,
    goal: 'lose',
    rate: 0.5,
    diet: 'omnivore',
    allergens: [],
    targetsMode: 'auto',
    macroPreset: 'balanced',
    customMacros: null,
    targets: blankTargets(),
    stepGoal: 8000,
    stepCadence: 100,
    strideCm: null,
    creditStepCalories: true,
    weights: [],
    measurements: [],
    favorites: [],
    recents: [],
    plan: {},
    templates: [],
    achievements: {},
    pantry: [],
    shopping: [],
    habits: [],
    reviews: {},
    cravings: [],
    prep: [],
    quickAdds: [],
    createdAt: Date.now(),
  }
}

export function blankDay() {
  return {
    meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    water: 0,
    exercise: [],
    weight: null,
    notes: '',
    mood: null,
    energy: null,
    hunger: null,
    sleep: null,
    steps: null,
    caffeine: null,
    fasting: { start: null, end: null, goalHours: 16 },
    createdAt: Date.now(),
  }
}

export function defaultState() {
  const profile = blankProfile()
  return {
    version: 2,
    onboarded: false,
    activeProfileId: profile.id,
    profiles: [profile],
    logs: { [profile.id]: {} },
    customFoods: [],
    recipes: RECIPES.map(recipe => ({ ...recipe, items: recipe.items.map(item => ({ ...item })) })),
    settings: {
      units: 'metric',
      weekStart: 1,
      accent: 'lime',
      density: 'comfortable',
      theme: 'dark',
      nature: false,
      reminders: { water: false, meals: false },
      waterInterval: 90,
      stepGoal: 8000,
      wakeTime: '07:00',
      bedTime: '23:00',
      currency: 'INR',
      budget: 450,
      lastExport: null,
      createdAt: Date.now(),
      installDismissed: false,
    },
    vitals: [],
    medications: [],
    medicationLogs: [],
    symptoms: [],
    updatedAt: Date.now(),
  }
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 2) return defaultState()
  const base = defaultState()
  const profiles = Array.isArray(raw.profiles) && raw.profiles.length
    ? raw.profiles.map(profile => ({ ...blankProfile(profile.name || 'You', profile.id), ...profile, targets: { ...blankTargets(), ...(profile.targets || {}) }, weights: Array.isArray(profile.weights) ? profile.weights : [], measurements: Array.isArray(profile.measurements) ? profile.measurements : [], favorites: Array.isArray(profile.favorites) ? profile.favorites : [], recents: Array.isArray(profile.recents) ? profile.recents : [], plan: profile.plan && typeof profile.plan === 'object' ? profile.plan : {}, templates: Array.isArray(profile.templates) ? profile.templates : [], achievements: profile.achievements && typeof profile.achievements === 'object' ? profile.achievements : {} }))
    : base.profiles
  const logs = raw.logs && typeof raw.logs === 'object' ? raw.logs : {}
  for (const profile of profiles) {
    if (!logs[profile.id] || typeof logs[profile.id] !== 'object') logs[profile.id] = {}
    for (const [date, day] of Object.entries(logs[profile.id])) {
      logs[profile.id][date] = { ...blankDay(), ...day, meals: { breakfast: [], lunch: [], dinner: [], snacks: [], ...(day.meals || {}) }, fasting: { start: null, end: null, goalHours: 16, ...(day.fasting || {}) } }
    }
  }
  // The step goal used to be a global setting; it belongs to the person whose
  // stride and weight drive the estimates, so carry it onto each profile once.
  const legacyStepGoal = Math.max(1000, Number(raw.settings?.stepGoal) || 0)
  for (const profile of profiles) {
    profile.stepGoal = Math.max(1000, Math.round(Number(profile.stepGoal) || legacyStepGoal || 8000))
    profile.stepCadence = Math.min(220, Math.max(60, Math.round(Number(profile.stepCadence) || 100)))
    profile.strideCm = Number(profile.strideCm) > 0 ? Number(profile.strideCm) : null
    profile.creditStepCalories = profile.creditStepCalories !== false
  }
  const active = profiles.some(profile => profile.id === raw.activeProfileId) ? raw.activeProfileId : profiles[0].id
  return {
    ...base,
    ...raw,
    version: 2,
    profiles,
    logs,
    activeProfileId: active,
    customFoods: Array.isArray(raw.customFoods) ? raw.customFoods : [],
    recipes: Array.isArray(raw.recipes) ? raw.recipes : base.recipes,
    vitals: Array.isArray(raw.vitals) ? raw.vitals : [],
    medications: Array.isArray(raw.medications) ? raw.medications : [],
    medicationLogs: Array.isArray(raw.medicationLogs) ? raw.medicationLogs : [],
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
    settings: { ...base.settings, ...(raw.settings || {}), reminders: { ...base.settings.reminders, ...(raw.settings?.reminders || {}) } },
  }
}

function load() {
  try {
    const stored = localStorage.getItem(KEY)
    if (!stored) return defaultState()
    return migrate(JSON.parse(stored))
  } catch {
    return defaultState()
  }
}

export let state = load()

export function persist() {
  state.updatedAt = Date.now()
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch (error) {
    console.warn('kcal: could not save local data', error)
    window.dispatchEvent(new CustomEvent('kcal:save-error'))
    return false
  }
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit() {
  for (const listener of listeners) listener()
}

export function pushUndo(label = 'Change') {
  try {
    undoStack.push({ label, at: Date.now(), data: JSON.stringify(state) })
    if (undoStack.length > 12) undoStack.shift()
  } catch {
    /* A very large state should never prevent the change itself. */
  }
}

export function undo() {
  const item = undoStack.pop()
  if (!item) return null
  state = JSON.parse(item.data)
  persist()
  emit()
  return item.label
}

export function canUndo() {
  return undoStack.length > 0
}

export function update(mutator, options = {}) {
  if (options.snapshot !== false) pushUndo(options.label || 'Change')
  mutator(state)
  const saved = persist()
  emit()
  return saved
}

export function getProfile(id = state.activeProfileId) {
  return state.profiles.find(profile => profile.id === id) || state.profiles[0]
}

export function profileLogs(profileId = state.activeProfileId) {
  if (!state.logs[profileId] || typeof state.logs[profileId] !== 'object') state.logs[profileId] = {}
  return state.logs[profileId]
}

export function getDay(date = todayKey(), create = true) {
  const logs = profileLogs()
  let day = logs[date]
  if (!day && create) {
    day = blankDay()
    logs[date] = day
  }
  return day || blankDay()
}

export function getTargets(profile = getProfile()) {
  return targetsFor(profile)
}

export function getTotals(date = todayKey(), profile = getProfile()) {
  return dayTotals(profile, getDay(date))
}

export function foodList() {
  return [...state.customFoods, ...FOODS]
}

export function findFood(id) {
  return state.customFoods.find(food => food.id === id) || FOOD_MAP.get(id) || null
}

export function findRecipe(id) {
  return state.recipes.find(recipe => recipe.id === id) || null
}

export function recipeTotals(recipe) {
  const totals = zeroNutrients()
  for (const item of recipe.items) {
    const food = findFood(item.foodId)
    if (!food) continue
    const nutrients = nutrientsForFood(food, item.g)
    totals.kcal += nutrients.kcal
    totals.p += nutrients.p
    totals.c += nutrients.c
    totals.f += nutrients.f
    totals.fib += nutrients.fib
    totals.sug += nutrients.sug
    totals.na += nutrients.na
    for (const key of Object.keys(totals.micros)) totals.micros[key] += nutrients.micros[key] || 0
  }
  const perServing = recipe.servings > 0 ? recipe.servings : 1
  return {
    total: totals,
    perServing: {
      kcal: Math.round(totals.kcal / perServing),
      p: Math.round((totals.p / perServing) * 10) / 10,
      c: Math.round((totals.c / perServing) * 10) / 10,
      f: Math.round((totals.f / perServing) * 10) / 10,
      fib: Math.round((totals.fib / perServing) * 10) / 10,
      sug: Math.round((totals.sug / perServing) * 10) / 10,
      na: Math.round(totals.na / perServing),
      micros: Object.fromEntries(Object.entries(totals.micros).map(([key, value]) => [key, value / perServing])),
    },
    grams: recipe.items.reduce((sum, item) => sum + Number(item.g || 0), 0),
  }
}

export function foodAllowed(food, profile = getProfile()) {
  if (!food) return false
  if (profile.diet === 'vegetarian' && !food.tags.includes('v')) return false
  if (profile.diet === 'vegan' && !food.tags.includes('vg')) return false
  if (profile.diet === 'pescatarian' && !food.tags.includes('v') && !['salmon', 'tuna-canned', 'prawns', 'fish-curry'].includes(food.id)) return false
  if (profile.allergens?.length) {
    for (const allergen of ALLERGEN_TAGS) {
      if (profile.allergens.includes(allergen.id) && allergen.foods.includes(food.id)) return false
    }
  }
  return true
}

export function allergenWarning(food, profile = getProfile()) {
  if (!food || !profile.allergens?.length) return ''
  const hits = ALLERGEN_TAGS.filter(allergen => profile.allergens.includes(allergen.id) && allergen.foods.includes(food.id)).map(allergen => allergen.label)
  return hits.join(', ')
}

export function makeEntry(food, grams, qty = 1, portionLabel = '') {
  const safeGrams = Math.max(1, Number(grams) || 1)
  return {
    id: uid('entry'),
    foodId: food.id,
    name: food.name,
    grams: safeGrams,
    qty,
    portionLabel: portionLabel || `${Math.round(safeGrams)} ${food.tags?.includes('drink') ? 'ml' : 'g'}`,
    liquid: food.tags?.includes('drink') || false,
    nutrients: nutrientsForFood(food, safeGrams),
    gi: estimatedGI(food),
    cost: food.cost ? round(food.cost * safeGrams / 100, 2) : 0,
    at: Date.now(),
  }
}

export function makeQuickEntry({ name, kcal, p = 0, c = 0, f = 0, fib = 0, sug = 0, na = 0, cost = 0, portionLabel = '' }) {
  return {
    id: uid('entry'),
    foodId: null,
    name: name || 'Quick entry',
    grams: 0,
    qty: 1,
    portionLabel: portionLabel || 'Quick add',
    nutrients: { kcal: Math.max(0, Number(kcal) || 0), p: Math.max(0, Number(p) || 0), c: Math.max(0, Number(c) || 0), f: Math.max(0, Number(f) || 0), fib: Math.max(0, Number(fib) || 0), sug: Math.max(0, Number(sug) || 0), na: Math.max(0, Number(na) || 0), micros: { ca: 0, fe: 0, vc: 0, va: 0, k: 0, mg: 0 } },
    gi: 55,
    cost: Math.max(0, Number(cost) || 0),
    at: Date.now(),
  }
}

export function addEntry(date, meal, entry) {
  const day = getDay(date)
  if (!day.meals[meal]) day.meals[meal] = []
  day.meals[meal].push(entry)
  if (entry.foodId) rememberFood(entry.foodId)
  return entry
}

export function addFood(date, meal, food, grams, qty = 1, portionLabel = '') {
  return addEntry(date, meal, makeEntry(food, grams, qty, portionLabel))
}

export function addRecipe(date, meal, recipe, servings = 1) {
  const totals = recipeTotals(recipe).perServing
  const entry = {
    id: uid('entry'),
    foodId: null,
    recipeId: recipe.id,
    name: recipe.name,
    grams: 0,
    qty: servings,
    portionLabel: `${servings} serving${servings === 1 ? '' : 's'}`,
    nutrients: {
      kcal: totals.kcal * servings,
      p: round(totals.p * servings, 1),
      c: round(totals.c * servings, 1),
      f: round(totals.f * servings, 1),
      fib: round(totals.fib * servings, 1),
      sug: round(totals.sug * servings, 1),
      na: totals.na * servings,
      micros: Object.fromEntries(Object.entries(totals.micros).map(([key, value]) => [key, value * servings])),
    },
    gi: 50,
    cost: 0,
    at: Date.now(),
  }
  return addEntry(date, meal, entry)
}

export function findEntry(date, entryId) {
  const day = getDay(date, false)
  for (const meal of MEAL_IDS) {
    const entry = (day.meals[meal] || []).find(item => item.id === entryId)
    if (entry) return { entry, meal, day }
  }
  return null
}

export function removeEntry(date, entryId) {
  const day = getDay(date)
  for (const meal of MEAL_IDS) {
    const index = (day.meals[meal] || []).findIndex(item => item.id === entryId)
    if (index >= 0) {
      day.meals[meal].splice(index, 1)
      return true
    }
  }
  return false
}

export function moveEntry(date, entryId, meal) {
  const found = findEntry(date, entryId)
  if (!found) return false
  removeEntry(date, entryId)
  if (!found.day.meals[meal]) found.day.meals[meal] = []
  found.day.meals[meal].push(found.entry)
  return true
}

export function duplicateEntry(date, entryId) {
  const found = findEntry(date, entryId)
  if (!found) return null
  const copy = { ...found.entry, id: uid('entry'), at: Date.now(), nutrients: { ...found.entry.nutrients, micros: { ...found.entry.nutrients.micros } } }
  found.day.meals[found.meal].push(copy)
  return copy
}

export function logWater(date, amount) {
  const day = getDay(date)
  day.water = clamp((Number(day.water) || 0) + Number(amount || 0), 0, 12000)
  return day.water
}

export function addExercise(date, { name, met, minutes, kcal }) {
  const day = getDay(date)
  day.exercise.push({ id: uid('ex'), name, met, minutes: Math.max(1, Number(minutes) || 1), kcal: Math.max(0, Math.round(kcal)) })
}

export function removeExercise(date, id) {
  const day = getDay(date)
  day.exercise = day.exercise.filter(item => item.id !== id)
}

export function setWeight(kg, date = todayKey()) {
  const profile = getProfile()
  const value = Math.round(Number(kg) * 10) / 10
  if (!Number.isFinite(value) || value <= 0) return false
  profile.weights = profile.weights.filter(item => item.date !== date)
  profile.weights.push({ date, kg: value })
  profile.weights.sort((a, b) => a.date.localeCompare(b.date))
  profile.weightKg = value
  getDay(date).weight = value
  return true
}

export function saveMeasurement(measurement, date = todayKey()) {
  const profile = getProfile()
  profile.measurements = profile.measurements.filter(item => item.date !== date)
  profile.measurements.push({ ...measurement, date })
  profile.measurements.sort((a, b) => a.date.localeCompare(b.date))
}

export function latestMeasurement(profile = getProfile()) {
  return [...profile.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null
}

export function setWellbeing(field, value, date = todayKey()) {
  const day = getDay(date)
  if (!['mood', 'energy', 'hunger', 'sleep', 'steps', 'caffeine'].includes(field)) return
  day[field] = value
}

export function addPantryItem({ name, grams = 100, expires = '' }) {
  const profile = getProfile()
  const item = {
    id: uid('pantry'),
    name: String(name || '').trim() || 'Pantry item',
    grams: Math.max(0, Number(grams) || 0),
    expires: expires || addDays(todayKey(), 7),
    addedAt: Date.now(),
  }
  profile.pantry.unshift(item)
  return item
}

export function removePantryItem(id) {
  getProfile().pantry = getProfile().pantry.filter(item => item.id !== id)
}

export function addShoppingItem(name) {
  const profile = getProfile()
  const clean = String(name || '').trim()
  if (!clean || profile.shopping.some(item => item.name.toLowerCase() === clean.toLowerCase())) return false
  profile.shopping.push({ id: uid('shop'), name: clean, done: false })
  return true
}

export function toggleShoppingItem(id) {
  const item = getProfile().shopping.find(entry => entry.id === id)
  if (item) item.done = !item.done
}

export function removeShoppingItem(id) {
  getProfile().shopping = getProfile().shopping.filter(item => item.id !== id)
}

export function addHabit(name, iconName = 'leaf') {
  const profile = getProfile()
  const clean = String(name || '').trim()
  if (!clean) return null
  const habit = { id: uid('habit'), name: clean, icon: iconName, checks: {} }
  profile.habits.push(habit)
  return habit
}

export function toggleHabit(id, date = todayKey()) {
  const habit = getProfile().habits.find(item => item.id === id)
  if (!habit) return
  if (habit.checks[date]) delete habit.checks[date]
  else habit.checks[date] = true
}

export function removeHabit(id) {
  getProfile().habits = getProfile().habits.filter(item => item.id !== id)
}

export function addCraving({ text, intensity = 3, date = todayKey() }) {
  const clean = String(text || '').trim()
  if (!clean) return null
  const entry = { id: uid('craving'), text: clean, intensity: clamp(Number(intensity) || 3, 1, 5), date, at: Date.now() }
  getProfile().cravings.unshift(entry)
  return entry
}

export function removeCraving(id) {
  getProfile().cravings = getProfile().cravings.filter(item => item.id !== id)
}

export function addPrepTask(name) {
  const clean = String(name || '').trim()
  if (!clean) return null
  const task = { id: uid('prep'), name: clean, done: false }
  getProfile().prep.push(task)
  return task
}

export function togglePrepTask(id) {
  const task = getProfile().prep.find(item => item.id === id)
  if (task) task.done = !task.done
}

export function removePrepTask(id) {
  getProfile().prep = getProfile().prep.filter(item => item.id !== id)
}

export function saveWeeklyReview(week, review) {
  const profile = getProfile()
  profile.reviews[week] = { ...review, updatedAt: Date.now() }
}

export function addQuickAdd({ name, kcal, p = 0, c = 0, f = 0 }) {
  const profile = getProfile()
  const clean = String(name || '').trim()
  if (!clean) return null
  const preset = { id: uid('quick'), name: clean, kcal: Math.max(0, Number(kcal) || 0), p: Math.max(0, Number(p) || 0), c: Math.max(0, Number(c) || 0), f: Math.max(0, Number(f) || 0) }
  profile.quickAdds.unshift(preset)
  return preset
}

export function removeQuickAdd(id) {
  getProfile().quickAdds = getProfile().quickAdds.filter(item => item.id !== id)
}

export function removeEntries(date, ids) {
  const day = getDay(date, false)
  const remove = new Set(ids)
  let removed = 0
  for (const meal of MEAL_IDS) {
    const before = day.meals[meal]?.length || 0
    if (!before) continue
    day.meals[meal] = day.meals[meal].filter(entry => !remove.has(entry.id))
    removed += before - day.meals[meal].length
  }
  return removed
}

export function toggleFavorite(foodId) {
  const profile = getProfile()
  const index = profile.favorites.indexOf(foodId)
  if (index >= 0) profile.favorites.splice(index, 1)
  else profile.favorites.unshift(foodId)
  profile.favorites = profile.favorites.slice(0, 60)
}

export function rememberFood(foodId) {
  const profile = getProfile()
  profile.recents = [foodId, ...profile.recents.filter(id => id !== foodId)].slice(0, 30)
}

export function rememberSearch(query) {
  const profile = getProfile()
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  profile.searches = [trimmed, ...(profile.searches || []).filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
}

export function saveCustomFood(food) {
  const index = state.customFoods.findIndex(item => item.id === food.id)
  if (index >= 0) state.customFoods[index] = food
  else state.customFoods.push(food)
}

export function deleteCustomFood(id) {
  state.customFoods = state.customFoods.filter(food => food.id !== id)
}

export function saveRecipe(recipe) {
  const index = state.recipes.findIndex(item => item.id === recipe.id)
  if (index >= 0) state.recipes[index] = recipe
  else state.recipes.unshift(recipe)
}

export function deleteRecipe(id) {
  state.recipes = state.recipes.filter(recipe => recipe.id !== id)
}

export function saveTemplate(name, meal, items) {
  const profile = getProfile()
  const template = { id: uid('template'), name, meal, items: items.map(item => ({ ...item, nutrients: { ...item.nutrients, micros: { ...item.nutrients.micros } } })), createdAt: Date.now() }
  profile.templates.unshift(template)
  return template
}

export function applyTemplate(templateId, date, meal) {
  const profile = getProfile()
  const template = profile.templates.find(item => item.id === templateId)
  if (!template) return 0
  const targetMeal = meal || template.meal
  for (const item of template.items) addEntry(date, targetMeal, { ...item, id: uid('entry'), at: Date.now() })
  return template.items.length
}

export function deleteTemplate(templateId) {
  const profile = getProfile()
  profile.templates = profile.templates.filter(item => item.id !== templateId)
}

export function copyMeal(fromDate, toDate, meal) {
  const source = getDay(fromDate, false).meals[meal] || []
  const target = getDay(toDate)
  if (!target.meals[meal]) target.meals[meal] = []
  let copied = 0
  for (const entry of source) {
    if (target.meals[meal].some(item => item.name === entry.name && item.grams === entry.grams)) continue
    target.meals[meal].push({ ...entry, id: uid('entry'), at: Date.now(), nutrients: { ...entry.nutrients, micros: { ...entry.nutrients.micros } } })
    copied += 1
  }
  return copied
}

export function copyDay(fromDate, toDate) {
  let copied = 0
  for (const meal of MEAL_IDS) copied += copyMeal(fromDate, toDate, meal)
  return copied
}

export function clearDay(date) {
  const day = getDay(date)
  for (const meal of MEAL_IDS) day.meals[meal] = []
  day.exercise = []
  day.water = 0
}

export function setTargetsMode(mode) {
  getProfile().targetsMode = mode
}

export function planFor(date) {
  const profile = getProfile()
  if (!profile.plan[date]) profile.plan[date] = { breakfast: [], lunch: [], dinner: [], snacks: [] }
  return profile.plan[date]
}

export function setPlanItem(date, meal, foodId, grams, qty = 1) {
  const plan = planFor(date)
  if (!plan[meal]) plan[meal] = []
  plan[meal] = plan[meal].filter(item => item.foodId !== foodId)
  plan[meal].push({ foodId, grams: Math.max(1, grams), qty })
}

export function removePlanItem(date, meal, foodId) {
  const plan = planFor(date)
  plan[meal] = (plan[meal] || []).filter(item => item.foodId !== foodId)
}

export function planTotals(plan) {
  const totals = zeroNutrients()
  for (const meal of MEAL_IDS) {
    for (const item of plan[meal] || []) {
      const food = findFood(item.foodId)
      if (!food) continue
      const nutrients = nutrientsForFood(food, item.grams)
      totals.kcal += nutrients.kcal
      totals.p += nutrients.p
      totals.c += nutrients.c
      totals.f += nutrients.f
      totals.fib += nutrients.fib
      totals.sug += nutrients.sug
      totals.na += nutrients.na
      for (const key of Object.keys(totals.micros)) totals.micros[key] += nutrients.micros[key] || 0
    }
  }
  totals.kcal = Math.round(totals.kcal)
  totals.p = round(totals.p, 1)
  totals.c = round(totals.c, 1)
  totals.f = round(totals.f, 1)
  totals.fib = round(totals.fib, 1)
  totals.na = Math.round(totals.na)
  return totals
}

export function addPlanToDay(date) {
  const plan = planFor(date)
  let added = 0
  for (const meal of MEAL_IDS) {
    for (const item of plan[meal] || []) {
      const food = findFood(item.foodId)
      if (!food) continue
      const day = getDay(date)
      if ((day.meals[meal] || []).some(entry => entry.foodId === item.foodId)) continue
      addFood(date, meal, food, item.grams, item.qty || 1, item.qty > 1 ? `${item.qty} × ${food.serving?.label || `${item.grams} g`}` : food.serving?.label)
      added += 1
    }
  }
  return added
}

export function groceryFor(startDate, days = 7) {
  const map = new Map()
  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index)
    const plan = getProfile().plan[date]
    if (!plan) continue
    for (const meal of MEAL_IDS) {
      for (const item of plan[meal] || []) {
        const food = findFood(item.foodId)
        if (!food) continue
        const current = map.get(item.foodId) || { foodId: item.foodId, name: food.name, grams: 0, cost: 0, category: food.cat }
        current.grams += Number(item.grams) || 0
        current.cost += food.cost ? food.cost * Number(item.grams) / 100 : 0
        map.set(item.foodId, current)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scaleToKcal(food, kcal) {
  if (!food.kcal || !kcal) return 30
  return clamp(Math.round((kcal / food.kcal) * 100 / 5) * 5, 15, 400)
}

export function generateWeekPlan(startDate, profile = getProfile()) {
  const allowed = foodList().filter(food => foodAllowed(food, profile))
  const pick = (pool, random) => pool[Math.floor(random() * pool.length)] || null
  const breakfastPool = allowed.filter(food => food.cat === 'Breakfast' || ['egg-boiled', 'greek-yogurt', 'besan-chilla', 'poha', 'masala-oats'].includes(food.id))
  const mainPool = allowed.filter(food => ['Indian mains', 'Dals & legumes', 'Protein'].includes(food.cat))
  const carbPool = allowed.filter(food => ['Rice & grains', 'Bread & bakery'].includes(food.cat))
  const vegPool = allowed.filter(food => food.cat === 'Vegetables')
  const snackPool = allowed.filter(food => ['Fruits', 'Nuts & seeds', 'Snacks', 'Dairy & eggs'].includes(food.cat))
  const targets = targetsFor(profile)
  let planned = 0
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(startDate, index)
    const random = seededRandom(index * 977 + profile.age * 13 + profile.weightKg * 7 + Date.now() % 997)
    const plan = { breakfast: [], lunch: [], dinner: [], snacks: [] }
    const breakfast = pick(breakfastPool, random)
    if (breakfast) plan.breakfast.push({ foodId: breakfast.id, grams: scaleToKcal(breakfast, targets.kcal * 0.25), qty: 1 })
    const lunch = pick(mainPool, random)
    const carb = pick(carbPool, random)
    if (lunch) plan.lunch.push({ foodId: lunch.id, grams: scaleToKcal(lunch, targets.kcal * 0.22), qty: 1 })
    if (carb) plan.lunch.push({ foodId: carb.id, grams: scaleToKcal(carb, targets.kcal * 0.13), qty: 1 })
    const dinner = pick(mainPool, random)
    const veg = pick(vegPool, random)
    if (dinner) plan.dinner.push({ foodId: dinner.id, grams: scaleToKcal(dinner, targets.kcal * 0.24), qty: 1 })
    if (veg) plan.dinner.push({ foodId: veg.id, grams: scaleToKcal(veg, targets.kcal * 0.08), qty: 1 })
    const snack = pick(snackPool, random)
    if (snack) plan.snacks.push({ foodId: snack.id, grams: scaleToKcal(snack, targets.kcal * 0.08), qty: 1 })
    getProfile().plan[date] = plan
    planned += plan.breakfast.length + plan.lunch.length + plan.dinner.length + plan.snacks.length
  }
  return planned
}

export function syncAchievements() {
  const profile = getProfile()
  const stats = profileStats(profile.id)
  const unlocked = []
  for (const achievement of ACHIEVEMENTS) {
    if (!profile.achievements[achievement.id] && achievement.test(stats)) {
      profile.achievements[achievement.id] = Date.now()
      unlocked.push(achievement)
    }
  }
  if (unlocked.length) persist()
  return unlocked
}

export function profileStats(profileId = state.activeProfileId) {
  const profile = getProfile(profileId)
  const logs = state.logs[profileId] || {}
  const dates = Object.keys(logs).sort()
  let totalEntries = 0
  let waterGoalDays = 0
  let proteinGoalDays = 0
  let fibreGoalDays = 0
  let perfectDays = 0
  let stepGoalDays = 0
  let exerciseMinutes = 0
  let earlyEntries = 0
  let lateEntries = 0
  let notesDays = 0
  let completedFasts = 0
  let costDays = 0
  let plannedMeals = 0
  let distinct = new Set()
  let currentRun = 0
  let bestRun = 0
  let loggedDayCount = 0
  let previousDate = null
  const targets = targetsFor(profile)
  for (const date of dates) {
    const day = logs[date]
    if (!day) continue
    const totals = dayTotals(profile, day)
    const hasData = MEAL_IDS.some(meal => (day.meals?.[meal] || []).length) || day.water > 0 || (day.exercise || []).length || day.weight || day.notes || day.steps
    if (!hasData) continue
    currentRun = previousDate && addDays(previousDate, 1) === date ? currentRun + 1 : 1
    bestRun = Math.max(bestRun, currentRun)
    loggedDayCount += 1
    previousDate = date
    totalEntries += MEAL_IDS.reduce((sum, meal) => sum + (day.meals?.[meal] || []).length, 0)
    for (const meal of MEAL_IDS) for (const entry of day.meals?.[meal] || []) { if (entry.foodId) distinct.add(entry.foodId) }
    if (day.water >= targets.water) waterGoalDays += 1
    if (totals.food.p >= targets.protein) proteinGoalDays += 1
    if (totals.food.fib >= targets.fiber) fibreGoalDays += 1
    if (scoreDay(profile, day).score >= 90) perfectDays += 1
    if ((day.steps || 0) >= (Number(profile.stepGoal) || 8000)) stepGoalDays += 1
    exerciseMinutes += (day.exercise || []).reduce((sum, item) => sum + Number(item.minutes || 0), 0)
    for (const meal of MEAL_IDS) for (const entry of day.meals?.[meal] || []) {
      const hour = new Date(entry.at || 0).getHours()
      if (hour > 0 && hour < 8) earlyEntries += 1
      if (hour >= 22) lateEntries += 1
    }
    if (day.notes?.trim()) notesDays += 1
    if (day.fasting?.start && day.fasting?.end) completedFasts += 1
    const dayCost = MEAL_IDS.reduce((sum, meal) => sum + (day.meals?.[meal] || []).reduce((mealSum, entry) => mealSum + (entry.cost || 0), 0), 0)
    if (dayCost > 0) costDays += 1
  }
  for (const plan of Object.values(profile.plan || {})) {
    for (const meal of MEAL_IDS) plannedMeals += (plan[meal] || []).length
  }
  const today = todayKey()
  let currentStreak = 0
  let cursor = today
  if (!logs[today] || !dayHasData(logs[today])) cursor = addDays(today, -1)
  while (logs[cursor] && dayHasData(logs[cursor])) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }
  return {
    totalEntries,
    loggedDays: loggedDayCount,
    bestStreak: bestRun,
    currentStreak,
    waterGoalDays,
    proteinGoalDays,
    fibreGoalDays,
    perfectDays,
    stepGoalDays,
    exerciseMinutes,
    earlyEntries,
    lateEntries,
    notesDays,
    completedFasts,
    costDays,
    plannedMeals,
    distinctFoods: distinct.size,
    weightCount: profile.weights.length,
    customRecipeCount: state.recipes.filter(recipe => recipe.custom).length,
    profileCount: state.profiles.length,
    backedUp: Boolean(state.settings.lastExport),
  }
}

export function dayHasData(day) {
  if (!day) return false
  return MEAL_IDS.some(meal => (day.meals?.[meal] || []).length) || (day.water || 0) > 0 || (day.exercise || []).length > 0 || Boolean(day.notes) || Boolean(day.weight) || Boolean(day.steps)
}

export function streakFor(profileId = state.activeProfileId) {
  const stats = profileStats(profileId)
  return { current: stats.currentStreak, best: stats.bestStreak }
}

export function dateSeries(endDate, days) {
  return Array.from({ length: days }, (_, index) => addDays(endDate, index - days + 1))
}

export function createDemoProfile() {
  const profile = blankProfile('Demo', uid('demo'))
  profile.emoji = '🌱'
  profile.sex = 'female'
  profile.age = 31
  profile.heightCm = 168
  profile.weightKg = 70.6
  profile.startWeightKg = 74.2
  profile.goalWeightKg = 66
  profile.activity = 1.55
  profile.goal = 'lose'
  profile.rate = 0.5
  profile.favorites = ['roti-chapati', 'chicken-breast', 'greek-yogurt', 'banana', 'dal-tadka', 'masala-oats']
  profile.recents = ['masala-oats', 'dal-tadka', 'rice-white', 'chicken-breast', 'banana', 'greek-yogurt']
  const today = todayKey()
  for (let index = 55; index >= 0; index -= 1) {
    const date = addDays(today, -index)
    const kg = 74.2 - (55 - index) * 0.065 + Math.sin(index / 3) * 0.25
    profile.weights.push({ date, kg: Math.round(kg * 10) / 10 })
  }
  profile.weights.sort((a, b) => a.date.localeCompare(b.date))
  profile.measurements = [
    { date: addDays(today, -28), waist: 84, hips: 100, neck: 33, chest: 94, arms: 29, thighs: 58 },
    { date: addDays(today, -3), waist: 81.5, hips: 98, neck: 32.6, chest: 92, arms: 28.4, thighs: 56.5 },
  ]
  const menus = [
    ['masala-oats', 'chicken-breast', 'rice-white', 'broccoli', 'greek-yogurt', 'banana', 'almonds'],
    ['egg-boiled', 'dal-tadka', 'roti-chapati', 'salad-green', 'paneer', 'apple', 'peanuts'],
    ['poha', 'rajma', 'rice-brown', 'cucumber', 'greek-yogurt', 'orange', 'walnuts'],
    ['besan-chilla', 'chicken-curry', 'chapati', 'bhindi-masala', 'curd', 'papaya', 'pistachios'],
    ['masala-oats', 'chole', 'basmati', 'mixed-veg', 'paneer-bhurji', 'watermelon', 'almonds'],
  ]
  const random = seededRandom(42)
  const logs = state.logs[profile.id] || {}
  for (let index = 20; index >= 0; index -= 1) {
    const date = addDays(today, -index)
    if (index > 0 && index % 6 === 5) continue
    const menu = menus[index % menus.length]
    const day = blankDay()
    const add = (meal, foodId, grams) => {
      const food = FOOD_MAP.get(foodId)
      if (!food) return
      day.meals[meal].push(makeEntry(food, grams, 1, `${grams} g`))
    }
    add('breakfast', menu[0], ['masala-oats', 'poha', 'masala-oats', 'besan-chilla', 'masala-oats'].includes(menu[0]) ? 200 : 120)
    add('lunch', menu[1], 180)
    add('lunch', menu[2], 150)
    add('dinner', menu[3], 150)
    add('dinner', menu[4], 120)
    add('snacks', menu[5], 150)
    add('snacks', menu[6], 25)
    day.water = 1600 + Math.round(random() * 1200 / 50) * 50
    day.steps = 4200 + Math.round(random() * 6800 / 100) * 100
    day.sleep = 6.5 + Math.round(random() * 2 * 10) / 10
    day.mood = 3 + Math.round(random() * 1)
    day.energy = 3 + Math.round(random() * 2)
    day.hunger = 2 + Math.round(random() * 2)
    day.notes = index === 2 ? 'Walked after lunch, felt good.' : ''
    if (index % 3 === 0) {
      day.exercise.push({ id: uid('ex'), name: 'Brisk walk', met: 4.3, minutes: 35, kcal: 160 })
    }
    logs[date] = day
  }
  state.logs[profile.id] = logs
  state.profiles.push(profile)
  state.activeProfileId = profile.id
  state.onboarded = true
  state.settings.budget = 550
  const weekStart = addDays(today, -((parseKey(today).getDay() + 6) % 7))
  generateWeekPlan(weekStart, profile)
  persist()
  return profile
}

export function exportPayload() {
  return { app: 'censoris-kcal', version: 2, exportedAt: new Date().toISOString(), data: state }
}

export function importPayload(payload) {
  const data = payload?.data || payload
  if (!data || data.version !== 2 || !Array.isArray(data.profiles) || !data.profiles.length) throw new Error('This file is not a kcal backup.')
  state = migrate(data)
  persist()
  emit()
}

export function resetEverything() {
  state = defaultState()
  persist()
  emit()
}

export function storageBytes() {
  try {
    return new Blob([localStorage.getItem(KEY) || '']).size
  } catch {
    return 0
  }
}

export function removeProfile(id) {
  if (state.profiles.length <= 1) return false
  state.profiles = state.profiles.filter(profile => profile.id !== id)
  delete state.logs[id]
  if (state.activeProfileId === id) state.activeProfileId = state.profiles[0].id
  persist()
  return true
}

export function switchProfile(id) {
  if (!state.profiles.some(profile => profile.id === id)) return false
  state.activeProfileId = id
  persist()
  return true
}

export function addProfile(name = 'New profile') {
  const profile = blankProfile(name)
  profile.emoji = '🧭'
  state.profiles.push(profile)
  state.logs[profile.id] = {}
  persist()
  return profile
}

// --- Health tracker: vitals, medications and symptoms -----------------------

function vitalNumber(value, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(max, Math.max(min, Math.round(parsed * 10) / 10))
}

export function logVital(vital = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(vital.date || '')) ? vital.date : todayKey()
  const entry = {
    id: uid('vital'),
    date,
    at: Date.now(),
    systolic: vitalNumber(vital.systolic, 70, 260),
    diastolic: vitalNumber(vital.diastolic, 40, 160),
    pulse: vitalNumber(vital.pulse, 30, 230),
    glucose: vitalNumber(vital.glucose, 20, 700),
    glucoseContext: ['fasting', 'post', 'random'].includes(vital.glucoseContext) ? vital.glucoseContext : 'random',
    spo2: vitalNumber(vital.spo2, 50, 100),
    tempC: vitalNumber(vital.tempC, 30, 45),
    respRate: vitalNumber(vital.respRate, 4, 80),
    note: String(vital.note || '').trim().slice(0, 400),
  }
  state.vitals.unshift(entry)
  state.vitals = state.vitals.slice(0, 3000)
  return entry
}

export function removeVital(id) {
  state.vitals = state.vitals.filter(item => item.id !== id)
}

export function saveMedication({ name, dose = '', time = '', note = '' } = {}) {
  const clean = String(name || '').trim()
  if (!clean) return null
  const medication = {
    id: uid('med'),
    name: clean.slice(0, 80),
    dose: String(dose || '').trim().slice(0, 60),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || '')) ? time : '',
    note: String(note || '').trim().slice(0, 200),
    active: true,
    createdAt: Date.now(),
  }
  state.medications.push(medication)
  return medication
}

export function removeMedication(id) {
  state.medications = state.medications.filter(item => item.id !== id)
  state.medicationLogs = state.medicationLogs.filter(item => item.medId !== id)
}

export function toggleMedicationLog(medId, date = todayKey()) {
  const exists = state.medicationLogs.some(item => item.medId === medId && item.date === date)
  if (exists) state.medicationLogs = state.medicationLogs.filter(item => !(item.medId === medId && item.date === date))
  else state.medicationLogs.push({ id: uid('medlog'), medId, date, at: Date.now() })
  return !exists
}

export function logSymptom({ name, severity = 1, note = '', date = todayKey() } = {}) {
  const clean = String(name || '').trim()
  if (!clean) return null
  const entry = {
    id: uid('symptom'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : todayKey(),
    at: Date.now(),
    name: clean.slice(0, 60),
    severity: Math.min(3, Math.max(1, Math.round(Number(severity) || 1))),
    note: String(note || '').trim().slice(0, 300),
  }
  state.symptoms.unshift(entry)
  state.symptoms = state.symptoms.slice(0, 3000)
  return entry
}

export function removeSymptom(id) {
  state.symptoms = state.symptoms.filter(item => item.id !== id)
}
