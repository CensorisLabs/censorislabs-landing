export const STORAGE_KEY = 'censorislabs-calorie-health-v2'
export const ACTIVITY_FACTORS = [
  { value: 1.2, label: 'Mostly seated' },
  { value: 1.375, label: 'Light activity · 1–3 days/week' },
  { value: 1.55, label: 'Moderate · 3–5 days/week' },
  { value: 1.725, label: 'High · 6–7 days/week' },
  { value: 1.9, label: 'Very high · physical work' },
]

export const uid = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
export const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))

export function createProfile(name = 'Me') {
  return {
    id: uid(), name, age: '', equation: 'female', heightCm: '', weightKg: '', activity: 1.2,
    goal: 'maintain', sleepGoalHours: 8, waterGoalMl: 2000, stepGoal: 8000, calorieOverride: '',
    goalWeightKg: '', waistCm: '', chestCm: '', hipsCm: '', proteinPerKg: 1.4,
  }
}

export const WALK_MET = { gentle: 2.8, steady: 3.5, brisk: 4.3 }

export function walkCalories(minutes, weightKg, pace = 'steady') {
  const met = WALK_MET[pace] || WALK_MET.steady
  return Math.round(Math.max(0, Number(minutes) || 0) * met * 3.5 * Math.max(0, Number(weightKg) || 0) / 200)
}

export function stepsToDistanceKm(steps) {
  return Math.round(Math.max(0, Number(steps) || 0) * 0.00076 * 1000) / 1000
}

export function distanceToSteps(km) {
  return Math.round(Math.max(0, Number(km) || 0) / 0.00076)
}

export function bmiCategory(bmi) {
  const value = Number(bmi)
  if (!value || value <= 0) return null
  if (value < 18.5) return { label: 'Underweight', tone: 'warn' }
  if (value < 25) return { label: 'Healthy range', tone: 'good' }
  if (value < 30) return { label: 'Above range', tone: 'warn' }
  return { label: 'High range', tone: 'alert' }
}

export function loggingStreak(dates = [], today = todayISO(), max = 400) {
  const set = new Set(dates.filter(Boolean))
  let streak = 0
  const cursor = new Date(`${today}T12:00:00`)
  for (let index = 0; index < max; index += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (set.has(key)) streak += 1
    else if (index > 0) break
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function daysAgoISO(days = 0, from = todayISO()) {
  const date = new Date(`${from}T12:00:00`)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function createInitialState() {
  const profile = createProfile()
  return {
    version: 4, activeProfileId: profile.id, profiles: [profile],
    meals: [], activities: [], weights: [], sleeps: [], water: [], vitals: [], moods: [],
    habits: [], habitLogs: [], recipes: [], mealPlans: [], supplements: [], medicineLogs: [],
    cycleLogs: [], symptoms: [], labResults: [], glucose: [], fastingSessions: [], customMetrics: [], customFoods: [], journal: [], healthImports: [],
    favorites: [], templates: [], measurements: [], walks: [],
    emergency: { bloodType: '', allergies: '', medications: '', emergencyContact: '', notes: '' },
    dashboard: ['calories', 'macros', 'activity', 'sleep', 'hydration', 'recovery'],
    settings: {
      units: 'metric', reminderTime: '', reduceMotion: false, localOnly: true,
      dashboard: ['calories', 'macros', 'activity', 'sleep', 'hydration', 'recovery'],
      theme: 'light', fontScale: 'large', calorieAdjust: true, walkPace: 'steady',
      walkMode: 'walk', stepSensitivity: 1, backgroundSteps: false,
      backgroundStepsSyncAt: '', saveRoutes: true, weeklyWalkGoal: 150,
      waterPresets: [250, 500, 750], fiberGoal: 30, sugarGoal: 50, sodiumGoal: 2300,
      proteinPerKg: 1.4, tips: true,
    },
  }
}

const COLLECTIONS = [
  'profiles', 'meals', 'activities', 'weights', 'sleeps', 'water', 'vitals', 'moods', 'habits',
  'habitLogs', 'recipes', 'mealPlans', 'supplements', 'medicineLogs', 'cycleLogs', 'symptoms',
  'labResults', 'glucose', 'fastingSessions', 'customMetrics', 'customFoods', 'journal', 'healthImports',
  'favorites', 'templates', 'measurements', 'walks',
]

export function normalizeState(input) {
  const base = createInitialState()
  if (!input || typeof input !== 'object') return base
  const value = { ...base, ...input }
  for (const key of COLLECTIONS) value[key] = Array.isArray(input[key]) ? input[key] : base[key]
  value.profiles = value.profiles.length ? value.profiles : base.profiles
  value.profiles = value.profiles.map(profile => ({ ...createProfile('Me'), ...profile }))
  if (!value.profiles.some(profile => profile.id === value.activeProfileId)) value.activeProfileId = value.profiles[0].id
  value.emergency = { ...base.emergency, ...(input.emergency || {}) }
  value.settings = { ...base.settings, ...(input.settings || {}) }
  // Older saves may predate a field that the UI now reads directly; repair the
  // shapes here so no render can crash on missing nested data.
  value.templates = value.templates.map(template => ({ ...template, items: Array.isArray(template?.items) ? template.items : [] }))
  value.walks = value.walks.map(walk => ({ ...walk, checkin: walk?.checkin || null }))
  value.customFoods = value.customFoods.map(food => ({ ...food, serv: Array.isArray(food?.serv) && food.serv.length ? food.serv : [['100 g', 100]] }))
  value.profiles = value.profiles.map(profile => ({ ...profile, stepGoal: Number(profile.stepGoal) > 0 ? profile.stepGoal : 8000, waterGoalMl: Number(profile.waterGoalMl) > 0 ? profile.waterGoalMl : 2000 }))
  if (!Array.isArray(value.settings.waterPresets) || !value.settings.waterPresets.length) value.settings.waterPresets = [250, 500, 750]
  value.dashboard = Array.isArray(input.dashboard) ? input.dashboard : base.dashboard
  return value
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState()
  } catch {
    return createInitialState()
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 4 }))
    return true
  } catch {
    return false
  }
}

export function activeProfile(state) {
  return state.profiles.find(profile => profile.id === state.activeProfileId) || state.profiles[0]
}

export function calculateTargets(profile) {
  const age = Number(profile?.age), height = Number(profile?.heightCm), weight = Number(profile?.weightKg)
  if (!age || !height || !weight || age < 18 || age > 100 || height < 120 || height > 230 || weight < 35 || weight > 350) return null
  const bmr = 10 * weight + 6.25 * height - 5 * age + (profile.equation === 'male' ? 5 : -161)
  const maintenance = bmr * clamp(profile.activity || 1.2, 1.2, 1.9)
  const delta = profile.goal === 'lose' ? -250 : profile.goal === 'gain' ? 200 : 0
  const naturalTarget = Math.max(bmr, maintenance + delta)
  const calorieTarget = Number(profile.calorieOverride) > 0 ? Math.max(bmr, clamp(profile.calorieOverride, 900, 10000)) : naturalTarget
  const protein = Math.round(weight * clamp(profile.proteinPerKg || 1.4, 0.8, 3))
  const fat = Math.round(Math.max(weight * 0.6, calorieTarget * 0.25 / 9))
  const carbs = Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4))
  return {
    bmr: Math.round(bmr), maintenance: Math.round(maintenance), calorieTarget: Math.round(calorieTarget),
    goalDelta: Math.round(calorieTarget - maintenance), protein, carbs, fat,
    bmi: Number((weight / ((height / 100) ** 2)).toFixed(1)),
  }
}

export function calculateFoodTotals(meals = [], date = todayISO()) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, count: 0 }
  for (const meal of meals) {
    if (meal.date !== date) continue
    const grams = Math.max(0, Number(meal.grams) || 0)
    const n = meal.nutrients || {}
    const scale = grams / 100
    totals.kcal += (Number(n.kcal) || 0) * scale
    totals.protein += (Number(n.p) || 0) * scale
    totals.carbs += (Number(n.c) || 0) * scale
    totals.fat += (Number(n.f) || 0) * scale
    totals.fiber += (Number(n.fi) || 0) * scale
    totals.sugar += (Number(n.su) || 0) * scale
    totals.sodium += (Number(n.na) || 0) * scale
    totals.count += 1
  }
  for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']) totals[key] = Math.round(totals[key] * 10) / 10
  return totals
}

export function estimateActivityCalories(activity, weightKg) {
  const met = Math.max(1, Number(activity?.met) || 1)
  const minutes = Math.max(0, Number(activity?.minutes) || 0)
  const weight = Math.max(0, Number(weightKg) || 0)
  return Math.round(Math.max(0, met - 1) * 3.5 * weight / 200 * minutes)
}

export function estimateStepCalories(steps, weightKg) {
  return Math.round(Math.max(0, Number(steps) || 0) * Math.max(0, Number(weightKg) || 0) * 0.00045)
}

// Auto step sync should not hammer Health Connect every time the app regains
// focus; five minutes is enough to pick up a walk without re-reading constantly.
export const STEP_SYNC_MIN_MINUTES = 5
export function stepSyncDue(lastSyncAt, now = Date.now(), minMinutes = STEP_SYNC_MIN_MINUTES) {
  const minutes = Math.max(1, Number(minMinutes) || STEP_SYNC_MIN_MINUTES)
  const last = Date.parse(lastSyncAt) || 0
  if (!last) return true
  // A clock change can put the last sync in the future; treat that as due so
  // steps are never stuck showing an old total.
  if (last > now) return true
  return now - last >= minutes * 60000
}

export function dayActivity(state, date = todayISO(), profile = activeProfile(state)) {
  const workouts = state.activities.filter(item => item.date === date)
  const exerciseCalories = workouts.reduce((sum, item) => sum + (item.stepsOnly ? 0 : (Number(item.calories) || estimateActivityCalories(item, profile.weightKg))), 0)
  const manualSteps = workouts.filter(item => item.source !== 'Health Connect').reduce((sum, item) => sum + (Number(item.steps) || 0), 0)
  const imported = (state.healthImports || []).find(item => item.date === date && (!item.profileId || item.profileId === profile.id))
  const importedSteps = imported?.steps
  const deviceSteps = importedSteps === null || importedSteps === undefined || importedSteps === '' || !Number.isFinite(Number(importedSteps)) ? null : Math.max(0, Number(importedSteps))
  // A device total of 0 says nothing useful, so fall back to what was logged.
  const stepTotal = deviceSteps ? deviceSteps : manualSteps
  // A device that reports 0 for the day (or a phone without a step sensor) must
  // not hide steps the user logged by hand, so both totals use the same value.
  const steps = stepTotal
  return {
    workouts, steps: stepTotal, manualSteps, deviceSteps, deviceCalories: Number(imported?.caloriesBurned) || 0, exerciseCalories,
    neatCalories: estimateStepCalories(stepTotal, profile.weightKg),
    trainingLoad: workouts.reduce((sum, item) => sum + (Math.max(0, Number(item.met) || 1) * Math.max(0, Number(item.minutes) || 0)), 0),
  }
}

export function sleepDebt(sleeps = [], date = todayISO(), goalHours = 8, days = 7) {
  const from = new Date(`${date}T00:00:00`)
  let total = 0, count = 0
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(from)
    day.setDate(day.getDate() - offset)
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const entry = sleeps.find(item => item.date === key)
    if (!entry) continue
    total += Math.max(0, Number(goalHours) - Number(entry.hours || 0))
    count++
  }
  return { hours: Math.round(total * 10) / 10, nights: count }
}

export function computeRecovery(state, date = todayISO(), profile = activeProfile(state)) {
  const sleep = state.sleeps.find(item => item.date === date)
  const mood = state.moods.find(item => item.date === date)
  const vital = state.vitals.find(item => item.date === date)
  const sleepScore = sleep ? clamp((Number(sleep.hours) / Math.max(1, Number(profile.sleepGoalHours) || 8)) * 100, 0, 100) : null
  const energyScore = mood ? clamp(Number(mood.energy) * 20, 0, 100) : null
  const rhrHistory = state.vitals.filter(item => item.rhr > 0 && item.date < date).sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map(item => Number(item.rhr))
  const baselineRhr = rhrHistory.length ? rhrHistory.reduce((sum, value) => sum + value, 0) / rhrHistory.length : null
  const rhrScore = vital?.rhr && baselineRhr ? clamp(100 - (Number(vital.rhr) - baselineRhr) * 3, 20, 100) : null
  const parts = [sleepScore, energyScore, rhrScore].filter(value => value !== null)
  return { score: parts.length ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length) : null, available: parts.length, sleepScore, energyScore, rhrScore, baselineRhr }
}

export function heartRateZone(bpm, age) {
  const rate = Number(bpm), years = Number(age)
  if (!rate || !years) return null
  const max = Math.max(100, 208 - 0.7 * years)
  const percent = rate / max
  const zone = percent < 0.6 ? 1 : percent < 0.7 ? 2 : percent < 0.8 ? 3 : percent < 0.9 ? 4 : 5
  return { max: Math.round(max), percent: Math.round(percent * 100), zone, label: ['','Very light','Fat burn','Aerobic','Anaerobic','Peak'][zone] }
}

export function weeklySeries(state, date = todayISO(), profile = activeProfile(state), days = 7) {
  const start = new Date(`${date}T00:00:00`)
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start)
    day.setDate(day.getDate() - (days - index - 1))
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const food = calculateFoodTotals(state.meals, key)
    const activity = dayActivity(state, key, profile)
    const sleep = state.sleeps.find(item => item.date === key)
    const weight = state.weights.find(item => item.date === key)
    const waterMl = state.water.filter(item => item.date === key).reduce((sum, item) => sum + (Number(item.ml) || 0), 0)
    return { date: key, label: day.toLocaleDateString(undefined, { weekday: 'short' }), calories: food.kcal, steps: activity.steps, activityCalories: activity.exerciseCalories, sleep: Number(sleep?.hours) || 0, weight: Number(weight?.kg) || 0, waterMl }
  })
}

export function weightTrend(weights = [], date = todayISO(), windowDays = 7) {
  const end = new Date(`${date}T23:59:59`)
  const start = new Date(end)
  start.setDate(start.getDate() - windowDays + 1)
  const values = weights.filter(item => {
    const day = new Date(`${item.date}T12:00:00`)
    return day >= start && day <= end && Number(item.kg) > 0
  }).map(item => Number(item.kg))
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
}

export function acuteChronicRatio(activities = [], date = todayISO()) {
  const end = new Date(`${date}T00:00:00`)
  const loadFor = days => activities.filter(item => {
    const d = new Date(`${item.date}T12:00:00`)
    const difference = (end - d) / 86400000
    return difference >= 0 && difference < days
  }).reduce((sum, item) => sum + (Number(item.load) || (Number(item.met) || 1) * (Number(item.minutes) || 0)), 0)
  const acute = loadFor(7), chronicWeekly = loadFor(28) / 4
  return chronicWeekly > 0 ? Math.round(acute / chronicWeekly * 100) / 100 : null
}
