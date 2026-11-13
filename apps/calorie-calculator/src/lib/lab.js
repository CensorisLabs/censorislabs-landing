import {
  addDays,
  dateSeries,
  getDay,
  getProfile,
  findFood,
  state,
  todayKey,
  MEALS,
  MEAL_IDS,
} from './store.js'
import {
  dayTotals,
  scoreDay,
  targetsFor,
  entryGlycemicLoad,
  netCarbs,
  percent,
  round,
} from './calc.js'

export function average(values) {
  const valid = values.filter(value => Number.isFinite(value))
  if (!valid.length) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function daysUntil(date) {
  if (!date) return null
  const today = new Date(`${todayKey()}T12:00:00`)
  const target = new Date(`${date}T12:00:00`)
  return Math.ceil((target - today) / 86400000)
}

export function weekStartKey(date = todayKey()) {
  const parsed = new Date(`${date}T12:00:00`)
  const offset = -((parsed.getDay() + 6) % 7)
  parsed.setDate(parsed.getDate() + offset)
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

export function lastNDates(days, end = todayKey()) {
  return Array.from({ length: days }, (_, index) => addDays(end, index - days + 1))
}

export function loggedRows(days = 30, end = todayKey()) {
  const profile = getProfile()
  return lastNDates(days, end).map(date => {
    const day = getDay(date, false)
    const totals = dayTotals(profile, day)
    const score = scoreDay(profile, day).score
    return { date, day, totals, score }
  }).filter(row => row.totals.food.kcal > 0 || (row.day?.water || 0) > 0 || (row.day?.steps || 0) > 0)
}

export function weightSeries(profile = getProfile(), days = 30) {
  const cutoff = addDays(todayKey(), -days)
  return [...(profile.weights || [])]
    .filter(item => item.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function movingAverageWeight(profile = getProfile()) {
  const weights = weightSeries(profile, 14).slice(-7)
  return weights.length ? round(average(weights.map(item => item.kg)), 1) : null
}

export function weightRate(profile = getProfile()) {
  const weights = weightSeries(profile, 30)
  if (weights.length < 2) return null
  const first = weights[0]
  const last = weights[weights.length - 1]
  const days = Math.max(1, (new Date(`${last.date}T12:00:00`) - new Date(`${first.date}T12:00:00`)) / 86400000)
  return round((last.kg - first.kg) / days * 7, 2)
}

export function plateauDetected(profile = getProfile()) {
  const weights = weightSeries(profile, 21)
  if (weights.length < 3) return { plateau: false, detail: 'Log at least three weigh-ins over three weeks.' }
  const change = round(weights[weights.length - 1].kg - weights[0].kg, 1)
  const span = Math.max(1, (new Date(`${weights[weights.length - 1].date}T12:00:00`) - new Date(`${weights[0].date}T12:00:00`)) / 86400000)
  if (span >= 14 && Math.abs(change) <= 0.3) {
    return { plateau: true, detail: `Only ${change >= 0 ? '+' : ''}${change} kg across ${Math.round(span)} days. Check measurements and photos before changing targets.` }
  }
  return { plateau: false, detail: `${change >= 0 ? '+' : ''}${change} kg across ${Math.round(span)} days. The trend is still moving.` }
}

export function correlation(xs, ys) {
  const pairs = xs.map((x, index) => [Number(x), Number(ys[index])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (pairs.length < 3) return null
  const meanX = average(pairs.map(pair => pair[0]))
  const meanY = average(pairs.map(pair => pair[1]))
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0)
  const denomX = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0))
  const denomY = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0))
  if (!denomX || !denomY) return null
  return round(numerator / (denomX * denomY), 2)
}

export function sleepDebt(days = 7) {
  const rows = lastNDates(days).map(date => getDay(date, false)).filter(day => day?.sleep != null)
  if (!rows.length) return { hours: 0, nights: 0, enough: false }
  const debt = rows.reduce((sum, day) => sum + Math.max(0, 8 - Number(day.sleep || 0)), 0)
  return { hours: round(debt, 1), nights: rows.length, enough: debt < 2 }
}

export function mealTiming() {
  const entries = MEAL_IDS.flatMap(meal => (getDay(todayKey()).meals[meal] || []))
  if (!entries.length) return { score: 0, detail: 'Log a meal to see timing.', lateKcal: 0 }
  let lateKcal = 0
  let earlyKcal = 0
  let total = 0
  for (const entry of entries) {
    const hour = new Date(entry.at).getHours()
    total += entry.nutrients.kcal
    if (hour >= 21) lateKcal += entry.nutrients.kcal
    if (hour >= 6 && hour < 10) earlyKcal += entry.nutrients.kcal
  }
  const spread = MEALS.filter(meal => (getDay(todayKey()).meals[meal.id] || []).length).length
  const score = Math.max(0, Math.min(100, Math.round(60 + spread * 8 - (lateKcal / Math.max(1, total)) * 35 + (earlyKcal / Math.max(1, total)) * 10)))
  return {
    score,
    lateKcal: Math.round(lateKcal),
    detail: lateKcal ? `${Math.round(lateKcal / Math.max(1, total) * 100)}% of today's calories were logged after 9pm.` : 'No food logged after 9pm today.',
  }
}

export function weekdayWeekend() {
  const rows = loggedRows(28).filter(row => row.totals.food.kcal > 0)
  const weekday = rows.filter(row => ![0, 6].includes(new Date(`${row.date}T12:00:00`).getDay())).map(row => row.totals.food.kcal)
  const weekend = rows.filter(row => [0, 6].includes(new Date(`${row.date}T12:00:00`).getDay())).map(row => row.totals.food.kcal)
  return { weekday: Math.round(average(weekday)), weekend: Math.round(average(weekend)), weekdayDays: weekday.length, weekendDays: weekend.length }
}

export function proteinDistribution() {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const day = getDay(todayKey())
  const values = MEALS.map(meal => ({ label: meal.name, p: (day.meals[meal.id] || []).reduce((sum, entry) => sum + entry.nutrients.p, 0) }))
  const total = values.reduce((sum, item) => sum + item.p, 0)
  const ideal = total > 0 ? 100 / 4 : 0
  const score = total > 0 ? Math.max(0, Math.round(100 - values.reduce((sum, item) => sum + Math.abs(item.p / total * 100 - ideal), 0))) : 0
  return { values: values.map(item => ({ ...item, pct: percent(item.p, total) })), score, total: round(total, 1), target: targets.protein }
}

export function calorieDistribution() {
  const totals = dayTotals(getProfile(), getDay(todayKey()))
  return MEALS.map(meal => ({ label: meal.name, kcal: totals.meals[meal.id].totals.kcal, pct: percent(totals.meals[meal.id].totals.kcal, totals.food.kcal) }))
}

export function nutrientGaps() {
  const totals = dayTotals(getProfile(), getDay(todayKey()))
  const targets = targetsFor(getProfile())
  const hasMicros = (totals.food.microsKnownEntries || 0) > 0
  const items = [
    { key: 'protein', label: 'Protein', value: totals.food.p, target: targets.protein, unit: 'g', known: true },
    { key: 'fibre', label: 'Fibre', value: totals.food.fib, target: targets.fiber, unit: 'g', known: true },
    { key: 'ca', label: 'Calcium', value: totals.food.micros.ca, target: 1000, unit: 'mg', known: hasMicros },
    { key: 'fe', label: 'Iron', value: totals.food.micros.fe, target: 18, unit: 'mg', known: hasMicros },
    { key: 'vc', label: 'Vitamin C', value: totals.food.micros.vc, target: 40, unit: 'mg', known: hasMicros },
    { key: 'va', label: 'Vitamin A', value: totals.food.micros.va, target: 900, unit: 'µg', known: hasMicros },
    { key: 'k', label: 'Potassium', value: totals.food.micros.k, target: 3500, unit: 'mg', known: hasMicros },
    { key: 'mg', label: 'Magnesium', value: totals.food.micros.mg, target: 400, unit: 'mg', known: hasMicros },
  ]
  return items.map(item => ({ ...item, pct: percent(item.value, item.target), gap: Math.max(0, round(item.target - item.value, 1)) }))
}

export function dietQuality() {
  const profile = getProfile()
  const day = getDay(todayKey())
  const totals = dayTotals(profile, day)
  const targets = targetsFor(profile)
  if (!totals.food.kcal) return { score: 0, grade: 'No data', parts: [] }
  const protein = Math.min(25, percent(totals.food.p, targets.protein) / 4)
  const fibre = Math.min(20, percent(totals.food.fib, targets.fiber) / 5)
  const micros = Object.values(totals.food.micros)
  const microCoverage = average(micros.map((value, index) => percent(value, [1000, 18, 40, 900, 3500, 400][index])))
  const micro = Math.min(20, microCoverage / 5)
  const sugar = Math.max(0, 15 - Math.max(0, percent(totals.food.sug, targets.sugar) - 100) / 10)
  const sodium = Math.max(0, 10 - Math.max(0, percent(totals.food.na, targets.sodium) - 100) / 10)
  const variety = Math.min(10, (day.meals ? new Set(MEAL_IDS.flatMap(meal => (day.meals[meal] || []).map(entry => entry.name))).size : 0) * 1.5)
  const score = Math.round(protein + fibre + micro + sugar + sodium + variety)
  const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 50 ? 'Developing' : 'Needs support'
  return { score, grade, parts: [['Protein', protein, 25], ['Fibre', fibre, 20], ['Micronutrients', micro, 20], ['Sugar', sugar, 15], ['Sodium', sodium, 10], ['Variety', variety, 10]] }
}

export function dailyGlycemicLoad() {
  const day = getDay(todayKey())
  return round(MEAL_IDS.flatMap(meal => day.meals[meal] || []).reduce((sum, entry) => sum + entryGlycemicLoad(entry), 0), 1)
}

export function netCarbShare() {
  const totals = dayTotals(getProfile(), getDay(todayKey())).food
  return { grams: netCarbs(totals), pct: percent(netCarbs(totals) * 4, totals.kcal) }
}

export function reportCard(days = 7) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const rows = lastNDates(days).map(date => {
    const day = getDay(date, false)
    const totals = dayTotals(profile, day)
    return { date, day, totals, score: scoreDay(profile, day).score }
  })
  const logged = rows.filter(row => row.totals.food.kcal > 0)
  const avgKcal = Math.round(average(logged.map(row => row.totals.food.kcal)))
  const avgScore = Math.round(average(logged.map(row => row.score)))
  const proteinDays = logged.filter(row => row.totals.food.p >= targets.protein).length
  const waterDays = rows.filter(row => (row.day?.water || 0) >= targets.water).length
  const overDays = logged.filter(row => row.totals.food.kcal > targets.kcal * 1.1).length
  const grade = avgScore >= 85 ? 'A' : avgScore >= 72 ? 'B' : avgScore >= 58 ? 'C' : logged.length ? 'D' : '—'
  return { rows, logged, avgKcal, avgScore, proteinDays, waterDays, overDays, grade }
}

export function planAdherence(days = 7) {
  const profile = getProfile()
  let planned = 0
  let matched = 0
  for (const date of lastNDates(days)) {
    const plan = profile.plan?.[date]
    if (!plan) continue
    const day = getDay(date, false)
    for (const meal of MEAL_IDS) {
      for (const item of plan[meal] || []) {
        planned += 1
        if ((day?.meals?.[meal] || []).some(entry => entry.foodId === item.foodId)) matched += 1
      }
    }
  }
  return { planned, matched, pct: percent(matched, planned) }
}

export function duplicateGroups(days = 30) {
  const groups = []
  for (const date of lastNDates(days)) {
    const day = getDay(date, false)
    for (const meal of MEAL_IDS) {
      const seen = new Map()
      for (const entry of day?.meals?.[meal] || []) {
        const key = `${entry.name}|${entry.grams}|${entry.portionLabel}`
        if (!seen.has(key)) seen.set(key, [])
        seen.get(key).push(entry)
      }
      for (const entries of seen.values()) {
        if (entries.length > 1) groups.push({ date, meal, name: entries[0].name, count: entries.length, removeIds: entries.slice(1).map(entry => entry.id) })
      }
    }
  }
  return groups
}

export function storageStatus() {
  try {
    const bytes = new Blob([localStorage.getItem('censoris-kcal-v2') || '']).size
    return { bytes, mb: round(bytes / 1024 / 1024, 2) }
  } catch {
    return { bytes: 0, mb: 0 }
  }
}

export function fingerprint() {
  const text = JSON.stringify(state)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

export function dataQuality() {
  const profile = getProfile()
  const duplicates = duplicateGroups(30)
  const zero = MEAL_IDS.flatMap(meal => Object.values(state.logs[profile.id] || {}).flatMap(day => day.meals?.[meal] || [])).filter(entry => !(entry.nutrients?.kcal > 0)).length
  const waterOnly = Object.values(state.logs[profile.id] || {}).filter(day => (day.water || 0) > 0 && !MEAL_IDS.some(meal => (day.meals?.[meal] || []).length)).length
  const missingWeight = !profile.weights?.length
  const storage = storageStatus()
  const backupAge = state.settings.lastExport ? Math.floor((Date.now() - state.settings.lastExport) / 86400000) : null
  const score = Math.max(0, 100 - duplicates.length * 6 - Math.min(25, zero * 2) - Math.min(10, waterOnly) - (missingWeight ? 8 : 0) - (backupAge == null ? 15 : backupAge > 30 ? 8 : 0) - (storage.mb > 4 ? 10 : 0))
  return { duplicates: duplicates.length, zero, waterOnly, missingWeight, backupAge, storage, score }
}

export function localSafetyScore() {
  const quality = dataQuality()
  return quality.score
}

export function habitStreak(habit) {
  let streak = 0
  let cursor = todayKey()
  if (!habit?.checks?.[cursor]) cursor = addDays(cursor, -1)
  while (habit?.checks?.[cursor]) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function stepStreak() {
  let streak = 0
  let cursor = todayKey()
  if (!((getDay(cursor, false).steps || 0) >= 8000)) cursor = addDays(cursor, -1)
  while ((getDay(cursor, false).steps || 0) >= 8000) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function plantVariety(days = 7) {
  const plants = new Set()
  for (const date of dateSeries(todayKey(), days)) {
    const day = getDay(date, false)
    for (const meal of MEAL_IDS) {
      for (const entry of day.meals?.[meal] || []) {
        const food = entry.foodId ? findFood(entry.foodId) : null
        if (!food) continue
        const plant = food.tags?.includes('vg') || ['Fruits', 'Vegetables', 'Nuts & seeds', 'Dals & legumes', 'Rice & grains', 'Bread & bakery'].includes(food.cat)
        if (plant) plants.add(entry.name)
      }
    }
  }
  return [...plants]
}

export function restaurantEstimate({ dish = 'indian', portion = 'regular', style = 'restaurant' }) {
  const bases = {
    indian: { kcal: 520, p: 22, c: 58, f: 22 },
    pizza: { kcal: 680, p: 28, c: 76, f: 27 },
    burger: { kcal: 720, p: 30, c: 64, f: 35 },
    biryani: { kcal: 610, p: 24, c: 72, f: 24 },
    salad: { kcal: 280, p: 14, c: 22, f: 14 },
    noodles: { kcal: 560, p: 18, c: 72, f: 21 },
    dessert: { kcal: 420, p: 6, c: 55, f: 20 },
  }
  const base = bases[dish] || bases.indian
  const portionFactor = portion === 'light' ? 0.72 : portion === 'large' ? 1.35 : 1
  const styleFactor = style === 'home' ? 0.82 : style === 'fried' ? 1.22 : 1
  const factor = portionFactor * styleFactor
  return {
    kcal: Math.round(base.kcal * factor / 10) * 10,
    p: Math.round(base.p * factor),
    c: Math.round(base.c * factor),
    f: Math.round(base.f * factor),
  }
}

export function restaurantLabel(value) {
  return ({ indian: 'Indian thali / curry plate', pizza: 'Pizza', burger: 'Burger and sides', biryani: 'Biryani plate', salad: 'Main-course salad', noodles: 'Noodles / pasta', dessert: 'Dessert' })[value] || 'Dish'
}
