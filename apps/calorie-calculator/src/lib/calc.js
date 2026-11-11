import { movementForDay, exerciseCalories as netExerciseCalories } from './movement.js'

export const MEALS = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunrise' },
  { id: 'lunch', name: 'Lunch', icon: 'sun' },
  { id: 'dinner', name: 'Dinner', icon: 'moon' },
  { id: 'snacks', name: 'Snacks', icon: 'sparkles' },
]

export const ACTIVITIES = [
  { value: 1.2, label: 'Mostly seated', note: 'Desk work, very little exercise' },
  { value: 1.375, label: 'Lightly active', note: 'Light exercise 1–3 days a week' },
  { value: 1.55, label: 'Moderately active', note: 'Moderate exercise 3–5 days a week' },
  { value: 1.725, label: 'Very active', note: 'Hard exercise 6–7 days a week' },
  { value: 1.9, label: 'Extremely active', note: 'Physical job or twice-daily training' },
]

export const GOALS = [
  { id: 'lose', label: 'Lose fat', note: 'A modest calorie deficit' },
  { id: 'maintain', label: 'Maintain', note: 'Stay around maintenance' },
  { id: 'gain', label: 'Gain weight', note: 'A controlled surplus' },
]

export const MACRO_PRESETS = [
  { id: 'balanced', label: 'Balanced', pct: { p: 30, c: 40, f: 30 }, note: 'A steady all-round split' },
  { id: 'high-protein', label: 'High protein', pct: { p: 35, c: 35, f: 30 }, note: 'More protein for training' },
  { id: 'low-carb', label: 'Lower carb', pct: { p: 30, c: 25, f: 45 }, note: 'Fewer carbs, more fat' },
  { id: 'keto', label: 'Keto-style', pct: { p: 25, c: 5, f: 70 }, note: 'Very low carbohydrate' },
  { id: 'endurance', label: 'Endurance', pct: { p: 20, c: 55, f: 25 }, note: 'Carb-forward for long sessions' },
  { id: 'mediterranean', label: 'Mediterranean', pct: { p: 25, c: 45, f: 30 }, note: 'Balanced with healthy fats' },
  { id: 'custom', label: 'Custom grams', pct: null, note: 'Set protein, carbs and fat yourself' },
]

export const MICRO_TARGETS = [
  { key: 'ca', label: 'Calcium', unit: 'mg', target: 1000, icon: 'bone' },
  { key: 'fe', label: 'Iron', unit: 'mg', target: 18, icon: 'drop' },
  { key: 'vc', label: 'Vitamin C', unit: 'mg', target: 40, icon: 'orange' },
  { key: 'k', label: 'Potassium', unit: 'mg', target: 3500, icon: 'banana' },
  { key: 'mg', label: 'Magnesium', unit: 'mg', target: 400, icon: 'leaf' },
]

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function round(value, decimals = 0) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function zeroNutrients() {
  return { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, na: 0, micros: { ca: 0, fe: 0, vc: 0, va: 0, k: 0, mg: 0 } }
}

export function nutrientsForFood(food, grams) {
  const factor = Math.max(0, Number(grams) || 0) / (food.per || 100)
  const micros = food.micros || {}
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    p: round((food.p || 0) * factor, 1),
    c: round((food.c || 0) * factor, 1),
    f: round((food.f || 0) * factor, 1),
    fib: round((food.fib || 0) * factor, 1),
    sug: round((food.sug || 0) * factor, 1),
    na: Math.round((food.na || 0) * factor),
    micros: {
      ca: round((micros.ca || 0) * factor, 1),
      fe: round((micros.fe || 0) * factor, 1),
      vc: round((micros.vc || 0) * factor, 1),
      va: round((micros.va || 0) * factor, 1),
      k: round((micros.k || 0) * factor, 1),
      mg: round((micros.mg || 0) * factor, 1),
    },
  }
}

export function emptyNutrients() {
  return zeroNutrients()
}

export function sumNutrients(entries) {
  const totals = zeroNutrients()
  for (const entry of entries || []) {
    const nutrients = entry.nutrients || emptyNutrients()
    totals.kcal += nutrients.kcal || 0
    totals.p += nutrients.p || 0
    totals.c += nutrients.c || 0
    totals.f += nutrients.f || 0
    totals.fib += nutrients.fib || 0
    totals.sug += nutrients.sug || 0
    totals.na += nutrients.na || 0
    for (const key of Object.keys(totals.micros)) totals.micros[key] += nutrients.micros?.[key] || 0
  }
  totals.kcal = Math.round(totals.kcal)
  totals.p = round(totals.p, 1)
  totals.c = round(totals.c, 1)
  totals.f = round(totals.f, 1)
  totals.fib = round(totals.fib, 1)
  totals.sug = round(totals.sug, 1)
  totals.na = Math.round(totals.na)
  for (const key of Object.keys(totals.micros)) totals.micros[key] = round(totals.micros[key], 1)
  return totals
}

export function bmr(profile) {
  const base = 10 * Number(profile.weightKg || 0) + 6.25 * Number(profile.heightCm || 0) - 5 * Number(profile.age || 0)
  return Math.max(0, Math.round(base + (profile.sex === 'male' ? 5 : -161)))
}

export function tdee(profile) {
  return Math.round(bmr(profile) * Number(profile.activity || 1.2))
}

export function goalDelta(profile) {
  const rate = Number(profile.rate ?? 0.5)
  if (profile.goal === 'lose') return -rate * 1100
  if (profile.goal === 'gain') return rate * 1100
  return 0
}

export function calorieFloor(profile) {
  return profile.sex === 'male' ? 1500 : 1200
}

export function targetCalories(profile) {
  const raw = tdee(profile) + goalDelta(profile)
  const floor = calorieFloor(profile)
  return Math.round(Math.max(floor, raw) / 10) * 10
}

export function autoTargets(profile) {
  const kcal = targetCalories(profile)
  const preset = MACRO_PRESETS.find(item => item.id === profile.macroPreset) || MACRO_PRESETS[0]
  let p
  let c
  let f
  if (profile.macroPreset === 'custom' && profile.customMacros) {
    p = Math.max(0, Number(profile.customMacros.p) || 0)
    c = Math.max(0, Number(profile.customMacros.c) || 0)
    f = Math.max(0, Number(profile.customMacros.f) || 0)
  } else {
    const pct = preset.pct || MACRO_PRESETS[0].pct
    p = Math.round(kcal * pct.p / 400)
    c = Math.round(kcal * pct.c / 400)
    f = Math.round(kcal * pct.f / 900)
  }
  return {
    kcal,
    protein: p,
    carbs: c,
    fat: f,
    fiber: Math.max(15, Math.round(kcal * 14 / 1000)),
    water: waterTarget(profile),
    sugar: Math.round(kcal * 0.1 / 4),
    sodium: 2300,
  }
}

export function targetsFor(profile) {
  if (profile.targetsMode === 'manual') {
    return { ...autoTargets(profile), ...profile.targets }
  }
  return autoTargets(profile)
}

export function waterTarget(profile) {
  return Math.max(1800, Math.round((Number(profile.weightKg || 60) * 35 + 300) / 100) * 100)
}

export function bmi(profile) {
  const height = Number(profile.heightCm) / 100
  if (!height) return 0
  return round(Number(profile.weightKg) / (height * height), 1)
}

export function bmiCategory(value) {
  if (!value) return { label: '—', tone: 'muted' }
  if (value < 18.5) return { label: 'Underweight', tone: 'amber' }
  if (value < 25) return { label: 'Healthy range', tone: 'good' }
  if (value < 30) return { label: 'Overweight', tone: 'amber' }
  return { label: 'Obese range', tone: 'bad' }
}

export function healthyWeightRange(profile) {
  const height = Number(profile.heightCm) / 100
  return { min: round(18.5 * height * height, 1), max: round(24.9 * height * height, 1) }
}

export function idealWeight(profile) {
  const height = Number(profile.heightCm) / 100
  return round(22 * height * height, 1)
}

export function latestMeasurement(profile) {
  return [...(profile.measurements || [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null
}

export function bodyFat(profile) {
  const measurement = latestMeasurement(profile)
  const height = Number(profile.heightCm)
  if (measurement?.waist && measurement?.neck && profile.sex === 'male' && measurement.waist > measurement.neck) {
    const value = 495 / (1.0324 - 0.19077 * Math.log10(measurement.waist - measurement.neck) + 0.15456 * Math.log10(height)) - 450
    if (Number.isFinite(value)) return { value: round(clamp(value, 3, 60), 1), method: 'Navy tape method' }
  }
  if (measurement?.waist && measurement?.neck && measurement?.hips && profile.sex === 'female' && measurement.waist + measurement.hips > measurement.neck) {
    const value = 495 / (1.29579 - 0.35004 * Math.log10(measurement.waist + measurement.hips - measurement.neck) + 0.221 * Math.log10(height)) - 450
    if (Number.isFinite(value)) return { value: round(clamp(value, 3, 60), 1), method: 'Navy tape method' }
  }
  const estimate = 1.2 * bmi(profile) + 0.23 * Number(profile.age) - 10.8 * (profile.sex === 'male' ? 1 : 0) - 5.4
  return { value: round(clamp(estimate, 3, 60), 1), method: 'BMI estimate' }
}

export function leanBodyMass(profile) {
  return round(Number(profile.weightKg) * (1 - bodyFat(profile).value / 100), 1)
}

export function waistHeightRatio(profile) {
  const measurement = latestMeasurement(profile)
  if (!measurement?.waist) return null
  return round(measurement.waist / Number(profile.heightCm), 2)
}

export function goalProjection(profile) {
  const current = Number(profile.weightKg)
  const goal = Number(profile.goalWeightKg)
  const rate = Number(profile.rate)
  if (!goal || !rate || Math.abs(goal - current) < 0.1) return null
  const days = Math.ceil(Math.abs(goal - current) / rate * 7)
  const date = new Date()
  date.setDate(date.getDate() + days)
  return { days, date, weeks: round(days / 7, 1), direction: goal < current ? 'lose' : 'gain' }
}

export function goalProgress(profile) {
  const start = Number(profile.startWeightKg) || Number(profile.weightKg)
  const current = Number(profile.weightKg)
  const goal = Number(profile.goalWeightKg)
  if (Math.abs(start - goal) < 0.1) return 100
  return round(clamp((start - current) / (start - goal) * 100, 0, 100), 0)
}

export function weightChange(profile, days = 30) {
  const weights = [...profile.weights].sort((a, b) => a.date.localeCompare(b.date))
  if (!weights.length) return 0
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const startKeyValue = cutoff.toISOString().slice(0, 10)
  const baseline = weights.find(item => item.date >= startKeyValue) || weights[0]
  return round(Number(profile.weightKg) - baseline.kg, 1)
}

export function dayTotals(profile, day) {
  const targets = targetsFor(profile)
  const meals = {}
  let food = zeroNutrients()
  let cost = 0
  for (const meal of MEALS) {
    const entries = day?.meals?.[meal.id] || []
    const totals = sumNutrients(entries)
    meals[meal.id] = { entries, totals }
    food.kcal += totals.kcal
    food.p += totals.p
    food.c += totals.c
    food.f += totals.f
    food.fib += totals.fib
    food.sug += totals.sug
    food.na += totals.na
    for (const key of Object.keys(food.micros)) food.micros[key] += totals.micros[key]
    cost += entries.reduce((sum, entry) => sum + (entry.cost || 0), 0)
  }
  food = { ...food, kcal: Math.round(food.kcal), p: round(food.p, 1), c: round(food.c, 1), f: round(food.f, 1), fib: round(food.fib, 1), sug: round(food.sug, 1), na: Math.round(food.na), micros: Object.fromEntries(Object.entries(food.micros).map(([key, value]) => [key, round(value, 1)])) }
  // Movement credit comes from one shared model: steps (minus any steps already
  // inside a logged walk/run) plus net exercise calories.
  const movement = movementForDay(day, profile)
  const spent = (day?.exercise || []).reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
  const burned = movement.creditKcal
  const budget = targets.kcal + burned
  const remaining = Math.round(budget - food.kcal)
  return {
    targets,
    meals,
    food,
    burned,
    movement,
    loggedBurn: Math.round(spent),
    budget,
    remaining,
    net: Math.round(food.kcal - burned),
    cost: round(cost, 0),
    pct: budget > 0 ? clamp(round(food.kcal / budget * 100, 0), 0, 999) : 0,
  }
}

export function scoreDay(profile, day) {
  const totals = dayTotals(profile, day)
  const targets = totals.targets
  const parts = []
  const calorieDiff = Math.abs(totals.food.kcal - targets.kcal)
  const calorieDiffPct = calorieDiff / Math.max(1, targets.kcal)
  // Full credit within 10% of target, then a linear falloff to zero at 50% off.
  const calorieScore = totals.food.kcal === 0
    ? 0
    : calorieDiffPct <= 0.1
      ? 30
      : Math.max(0, Math.round(30 * (1 - (calorieDiffPct - 0.1) / 0.4)))
  parts.push({ label: 'Calories', score: calorieScore, max: 30 })
  const proteinScore = Math.min(25, Math.round((totals.food.p / Math.max(1, targets.protein)) * 25))
  parts.push({ label: 'Protein', score: proteinScore, max: 25 })
  const fibreScore = Math.min(15, Math.round((totals.food.fib / Math.max(1, targets.fiber)) * 15))
  parts.push({ label: 'Fibre', score: fibreScore, max: 15 })
  const waterScore = Math.min(15, Math.round(((day?.water || 0) / Math.max(1, targets.water)) * 15))
  parts.push({ label: 'Water', score: waterScore, max: 15 })
  const loggedMeals = MEALS.filter(meal => (day?.meals?.[meal.id] || []).length).length
  const mealScore = Math.min(10, loggedMeals * 3)
  parts.push({ label: 'Meals logged', score: mealScore, max: 10 })
  const movementScore = totals.burned >= 120 || (day?.steps || 0) >= (totals.movement?.stepGoal || 8000) ? 5 : 0
  parts.push({ label: 'Movement', score: movementScore, max: 5 })
  const score = clamp(parts.reduce((sum, part) => sum + part.score, 0), 0, 100)
  const grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 55 ? 'On track' : score > 0 ? 'Keep going' : 'No logs yet'
  return { score, grade, parts }
}

// Net-of-resting burn: the daily target already includes resting metabolism, so
// crediting the full MET burn back would double-count it.
export function exerciseCalories(met, minutes, weightKg) {
  return netExerciseCalories(met, minutes, weightKg)
}

export function fastingProgress(day, now = Date.now()) {
  const fasting = day?.fasting || {}
  const goalHours = Number(fasting.goalHours) || 16
  if (!fasting.start) return { active: false, goalHours, pct: 0, elapsedLabel: '—', endLabel: '—', done: false }
  const start = new Date(fasting.start).getTime()
  const end = fasting.end ? new Date(fasting.end).getTime() : now
  const elapsed = Math.max(0, end - start)
  const goalMs = goalHours * 3600000
  return {
    active: !fasting.end,
    goalHours,
    pct: clamp(round(elapsed / goalMs * 100, 0), 0, 100),
    elapsedLabel: durationLabel(elapsed),
    endLabel: new Date(start + goalMs).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    done: elapsed >= goalMs,
    elapsedMs: elapsed,
  }
}

export function durationLabel(ms) {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function projection(profile) {
  return goalProjection(profile)
}

export function kgToLb(kg) {
  return round(kg * 2.2046226218, 1)
}

export function lbToKg(lb) {
  return round(lb / 2.2046226218, 1)
}

export function cmToIn(cm) {
  return round(cm / 2.54, 1)
}

export function inToCm(inches) {
  return round(inches * 2.54, 1)
}

export function mlToOz(ml) {
  return round(ml / 29.5735295625, 1)
}

export function ozToMl(oz) {
  return round(oz * 29.5735295625, 0)
}

export function formatWeight(kg, units = 'metric') {
  if (units === 'imperial') return `${kgToLb(kg)} lb`
  return `${round(kg, 1)} kg`
}

export function formatHeight(cm, units = 'metric') {
  if (units === 'imperial') {
    const totalInches = Math.round(cm / 2.54)
    return `${Math.floor(totalInches / 12)}′ ${totalInches % 12}″`
  }
  return `${round(cm, 0)} cm`
}

export function formatVolume(ml, units = 'metric') {
  if (units === 'imperial') return `${mlToOz(ml)} fl oz`
  return ml >= 1000 ? `${round(ml / 1000, 2)} L` : `${Math.round(ml)} ml`
}

export function foodDensity(food) {
  return food.kcal <= 80 ? 'Very light' : food.kcal <= 160 ? 'Light' : food.kcal <= 300 ? 'Moderate' : food.kcal <= 450 ? 'Dense' : 'Very dense'
}

export function nutrientScore(food) {
  if (!food) return 0
  const protein = Math.min(30, (food.p || 0) * 1.2)
  const fibre = Math.min(25, (food.fib || 0) * 2.2)
  const micro = Object.values(food.micros || {}).filter(value => value > 0).length * 4
  const sugarPenalty = Math.min(20, (food.sug || 0) * 0.45)
  const sodiumPenalty = Math.min(20, (food.na || 0) / 200)
  const caloriePenalty = Math.min(15, (food.kcal || 0) / 60)
  return Math.round(clamp(35 + protein + fibre + micro - sugarPenalty - sodiumPenalty - caloriePenalty, 1, 100))
}

export function proteinPerKcal(food) {
  if (!food?.kcal) return 0
  return round((food.p || 0) / food.kcal * 100, 1)
}

export function netCarbs(totals) {
  return Math.max(0, round((totals.c || 0) - (totals.fib || 0), 1))
}

// Approximate glycemic index by food group. This is a teaching estimate, not a
// clinical GI value: preparation, ripeness and portion all change the response.
export function estimatedGI(food) {
  if (!food) return 55
  if (Number.isFinite(food.gi)) return food.gi
  if (['Dals & legumes', 'Vegetables', 'Nuts & seeds', 'Dairy & eggs'].includes(food.cat)) return 30
  if (food.cat === 'Fruits') return 45
  if (food.cat === 'Protein') return 0
  if (food.cat === 'Sweets') return 75
  if (food.cat === 'Fast food') return 65
  if (food.cat === 'Drinks') return food.sug > 8 ? 65 : 30
  if (food.cat === 'Rice & grains' || food.cat === 'Bread & bakery') return food.fib >= 4 ? 50 : 68
  if (food.cat === 'Breakfast') return food.fib >= 3 ? 52 : 62
  return 55
}

export function glycemicLoad(food, grams) {
  if (!food) return 0
  const carbs = Math.max(0, (food.c || 0) - (food.fib || 0))
  return round(estimatedGI(food) * carbs * Math.max(0, Number(grams) || 0) / 100 / 100, 1)
}

export function entryGlycemicLoad(entry) {
  if (!entry?.nutrients) return 0
  const gi = Number.isFinite(entry.gi) ? entry.gi : 55
  return round(gi * netCarbs(entry.nutrients) / 100, 1)
}

export function macroCalories(grams, type) {
  const factor = type === 'p' ? 4 : type === 'c' ? 4 : 9
  return Math.round((grams || 0) * factor)
}

export function rangeAvg(values) {
  const valid = values.filter(value => Number.isFinite(value) && value > 0)
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length, 0) : 0
}

export function percent(value, total) {
  if (!total) return 0
  return clamp(Math.round(value / total * 100), 0, 999)
}

export function greeting(name) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}`
}

export function daysAgoLabel(timestamp) {
  if (!timestamp) return 'Never'
  const days = Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
