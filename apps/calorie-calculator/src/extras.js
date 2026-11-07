// Extra analytics for AbsoluteCal: small, pure calculations that turn records
// the app already stores into one more useful number. Every function is written
// to survive empty or messy input and to say nothing it cannot support.

const DAY_MS = 86400000
const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0)
const round = (value, places = 1) => {
  const factor = 10 ** places
  return Math.round(num(value) * factor) / factor
}
const sum = (list, pick) => (Array.isArray(list) ? list : []).reduce((total, item) => total + num(pick(item)), 0)
const mealKcal = meal => (num(meal?.nutrients?.kcal) * num(meal?.grams)) / 100
const mealNutrient = (meal, key) => (num(meal?.nutrients?.[key]) * num(meal?.grams)) / 100
const hoursOfDay = time => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return (num(match[1]) * 60 + num(match[2])) / 60
}
const median = values => {
  const list = (values || []).filter(value => Number.isFinite(value)).sort((a, b) => a - b)
  if (!list.length) return null
  const middle = Math.floor(list.length / 2)
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2
}
const average = values => {
  const list = (values || []).filter(value => Number.isFinite(value))
  return list.length ? list.reduce((total, value) => total + value, 0) / list.length : null
}
const share = (part, whole) => (num(whole) > 0 ? Math.round((num(part) / num(whole)) * 1000) / 10 : null)
const lastN = (list, n) => (Array.isArray(list) ? list.slice(-n) : [])
const byDate = (list, field = 'date') => (Array.isArray(list) ? list.filter(item => item && item[field]) : [])

/* ---------------------------- Nutrition ---------------------------- */

export function macroSplit(totals = {}) {
  const protein = num(totals.protein) * 4
  const carbs = num(totals.carbs) * 4
  const fat = num(totals.fat) * 9
  const kcal = protein + carbs + fat
  if (!kcal) return null
  return { protein: share(protein, kcal), carbs: share(carbs, kcal), fat: share(fat, kcal), fromMacros: Math.round(kcal) }
}

export function sugarShareOfCalories(totals = {}) {
  if (num(totals.kcal) <= 0) return null
  return share(num(totals.sugar) * 4, totals.kcal)
}

export function nutrientDensity(totals = {}, key = 'protein') {
  const kcal = num(totals.kcal)
  if (kcal <= 0) return null
  return round((num(totals[key]) / kcal) * 1000, 1)
}

export function topContributors(meals = [], key = 'kcal', limit = 3) {
  const rows = (meals || [])
    .map(meal => ({ name: meal?.name || 'Untitled', value: key === 'kcal' ? mealKcal(meal) : mealNutrient(meal, key) }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, Math.max(1, limit))
  return rows.map(row => ({ ...row, value: Math.round(row.value) }))
}

export function slotEnergyShare(meals = []) {
  const buckets = new Map()
  for (const meal of meals || []) {
    const slot = meal?.slot || 'Snack'
    buckets.set(slot, (buckets.get(slot) || 0) + mealKcal(meal))
  }
  const total = [...buckets.values()].reduce((a, b) => a + b, 0)
  if (!total) return []
  return [...buckets.entries()].map(([slot, kcal]) => ({ slot, kcal: Math.round(kcal), percent: share(kcal, total) })).sort((a, b) => b.kcal - a.kcal)
}

export function largestMeal(meals = []) {
  const rows = (meals || []).map(meal => ({ name: meal?.name || 'Untitled', slot: meal?.slot || 'Snack', kcal: Math.round(mealKcal(meal)) })).filter(row => row.kcal > 0)
  if (!rows.length) return null
  return rows.sort((a, b) => b.kcal - a.kcal)[0]
}

export function entryStats(meals = []) {
  const values = (meals || []).map(mealKcal).filter(value => value > 0)
  if (!values.length) return null
  return { count: values.length, average: Math.round(average(values)), median: Math.round(median(values)) }
}

export function repeatedFoods(meals = []) {
  const counts = new Map()
  for (const meal of meals || []) {
    const name = meal?.name
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export function entrySourceMix(meals = []) {
  const buckets = new Map()
  for (const meal of meals || []) {
    const source = meal?.source || 'Manual'
    buckets.set(source, (buckets.get(source) || 0) + 1)
  }
  const total = (meals || []).length
  return [...buckets.entries()].map(([source, count]) => ({ source, count, percent: share(count, total) })).sort((a, b) => b.count - a.count)
}

export function proteinBySlot(meals = [], targetProtein = 0) {
  const target = num(targetProtein)
  return slotEnergyShare(meals).map(row => {
    const protein = (meals || []).filter(meal => (meal?.slot || 'Snack') === row.slot).reduce((total, meal) => total + mealNutrient(meal, 'p'), 0)
    return { slot: row.slot, protein: Math.round(protein), shareOfTarget: target > 0 ? share(protein, target) : null }
  })
}

export function foodVariety(meals = []) {
  const names = new Set((meals || []).map(meal => meal?.name).filter(Boolean))
  return { distinct: names.size, entries: (meals || []).length, ratio: names.size ? round(names.size / Math.max(1, (meals || []).length), 2) : null }
}

const DRINK_WORDS = /(water|tea|coffee|chai|juice|cola|soda|drink|lassi|milk|shake|beer|wine|smoothie|buttermilk|coconut water)/i
export function drinkEnergy(meals = []) {
  const drinks = (meals || []).filter(meal => meal?.slot === 'Drink' || DRINK_WORDS.test(String(meal?.name || '')))
  const kcal = drinks.reduce((total, meal) => total + mealKcal(meal), 0)
  return { count: drinks.length, kcal: Math.round(kcal) }
}

export function calorieDensity(totals = {}, grams = 0) {
  const weight = num(grams)
  if (weight <= 0 || num(totals.kcal) <= 0) return null
  return round((num(totals.kcal) / weight) * 100, 1)
}

export function recipeStats(recipes = []) {
  const list = Array.isArray(recipes) ? recipes.filter(item => item && item.name) : []
  if (!list.length) return { count: 0, averageKcal: null }
  return { count: list.length, averageKcal: Math.round(average(list.map(item => num(item.kcal)))) }
}

export function customFoodUsage(customFoods = [], meals = []) {
  const entries = Array.isArray(meals) ? meals : []
  const ids = new Set(entries.map(meal => meal?.foodId).filter(Boolean))
  const used = (customFoods || []).filter(food => ids.has(food?.id)).length
  return { custom: (customFoods || []).length, used, unused: Math.max(0, (customFoods || []).length - used) }
}

export function favoriteCoverage(favorites = [], foods = []) {
  const ids = new Set((Array.isArray(foods) ? foods : []).map(food => food?.id))
  const kept = (favorites || []).filter(id => ids.has(id))
  return { saved: (favorites || []).length, available: kept.length, stale: (favorites || []).length - kept.length }
}

export function planGap(plans = [], eatenKcal = 0) {
  const planned = sum(plans, plan => plan.kcal)
  if (!planned) return null
  return { planned: Math.round(planned), eaten: Math.round(num(eatenKcal)), difference: Math.round(num(eatenKcal) - planned) }
}

export function macroBalanceTarget(targets = null) {
  if (!targets) return null
  const protein = num(targets.protein) * 4
  const carbs = num(targets.carbs) * 4
  const fat = num(targets.fat) * 9
  const kcal = protein + carbs + fat
  if (!kcal) return null
  return { protein: share(protein, kcal), carbs: share(carbs, kcal), fat: share(fat, kcal) }
}

export function biggestNutrientGap(totals = {}, targets = null) {
  if (!targets) return null
  const rows = [
    { key: 'Protein', value: num(totals.protein), target: num(targets.protein) },
    { key: 'Carbs', value: num(totals.carbs), target: num(targets.carbs) },
    { key: 'Fat', value: num(totals.fat), target: num(targets.fat) },
  ].filter(row => row.target > 0).map(row => ({ ...row, percent: share(row.value, row.target), missing: Math.round(row.target - row.value) }))
  if (!rows.length) return null
  return rows.sort((a, b) => a.percent - b.percent)[0]
}

/* ----------------------------- Movement ----------------------------- */

export function stepSummary(series = []) {
  const rows = (series || []).filter(item => num(item.steps) > 0)
  if (!rows.length) return null
  const values = rows.map(item => num(item.steps))
  return { days: rows.length, average: Math.round(average(values)), best: Math.round(Math.max(...values)), low: Math.round(Math.min(...values)) }
}

export function stepGoalHitRate(series = [], goal = 0) {
  const rows = (series || []).filter(item => num(item.steps) > 0)
  if (!rows.length || num(goal) <= 0) return null
  const hits = rows.filter(item => num(item.steps) >= num(goal)).length
  return { hits, days: rows.length, percent: share(hits, rows.length) }
}

export function walkStats(walks = []) {
  const list = (walks || []).filter(item => num(item.minutes) > 0)
  if (!list.length) return null
  const longest = list.slice().sort((a, b) => num(b.minutes) - num(a.minutes))[0]
  return {
    sessions: list.length,
    minutes: Math.round(sum(list, item => item.minutes)),
    distanceKm: round(sum(list, item => item.distanceKm), 1),
    averageKm: round(average(list.map(item => num(item.distanceKm))), 1),
    longest: { date: longest.date, minutes: Math.round(num(longest.minutes)) },
  }
}

export function walkPaceTrend(walks = []) {
  const rows = (walks || []).filter(item => num(item.minutes) > 0 && num(item.distanceKm) > 0.1).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (rows.length < 2) return null
  const paceOf = item => num(item.minutes) / num(item.distanceKm)
  const oldest = paceOf(rows[0])
  const newest = paceOf(rows[rows.length - 1])
  return { oldest: round(oldest, 1), newest: round(newest, 1), faster: round(oldest - newest, 1) }
}

export function walkModeMix(walks = []) {
  const list = walks || []
  const runs = list.filter(item => item.mode === 'run').length
  return { walks: list.length - runs, runs, runPercent: share(runs, list.length) }
}

export function checkinBreakdown(walks = [], field = 'with', limit = 4) {
  const counts = new Map()
  for (const walk of walks || []) {
    const value = walk?.checkin?.[field]
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, Math.max(1, limit))
}

export function checkinCompletion(walks = []) {
  const list = walks || []
  if (!list.length) return null
  const answered = list.filter(item => item.checkin && Object.values(item.checkin).some(Boolean)).length
  return { answered, sessions: list.length, percent: share(answered, list.length) }
}

export function mediaCoverage(walks = []) {
  const list = walks || []
  const photos = list.filter(item => item.startPhoto || item.endPhoto).length
  const routes = list.filter(item => Array.isArray(item.route) && item.route.length > 1).length
  return { photos, routes, sessions: list.length, photoPercent: share(photos, list.length), routePercent: share(routes, list.length) }
}

export function activityMix(activities = [], limit = 5) {
  const counts = new Map()
  for (const item of activities || []) {
    const name = item?.name || 'Activity'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, Math.max(1, limit))
}

export function restDays(series = []) {
  const rows = series || []
  if (!rows.length) return null
  const rest = rows.filter(item => num(item.steps) === 0 && num(item.activityCalories) === 0).length
  return { rest, days: rows.length, percent: share(rest, rows.length) }
}

export function strengthVolume(activities = []) {
  const sets = (activities || []).filter(item => num(item.sets) > 0)
  if (!sets.length) return null
  const volume = sets.reduce((total, item) => total + num(item.sets) * num(item.reps) * Math.max(1, num(item.loadKg) || 1), 0)
  return { sessions: sets.length, sets: Math.round(sum(sets, item => item.sets)), volumeKg: Math.round(volume) }
}

export function muscleBalance(activities = []) {
  const counts = new Map()
  for (const item of activities || []) {
    if (!item?.muscle) continue
    counts.set(item.muscle, (counts.get(item.muscle) || 0) + 1)
  }
  return [...counts.entries()].map(([muscle, count]) => ({ muscle, count })).sort((a, b) => b.count - a.count)
}

export function metMinutes(activities = []) {
  const list = activities || []
  if (!list.length) return null
  return Math.round(sum(list, item => Math.max(0, num(item.met) || 1) * num(item.minutes)))
}

export function sessionMinutes(activities = []) {
  const rows = (activities || []).filter(item => num(item.minutes) > 0)
  if (!rows.length) return null
  return { sessions: rows.length, total: Math.round(sum(rows, item => item.minutes)), average: Math.round(average(rows.map(item => num(item.minutes)))) }
}

export function stepSourceMix(devices = {}, manualSteps = 0, stepsOnlyEntries = 0) {
  const device = num(devices.deviceSteps)
  const manual = num(manualSteps)
  if (!device && !manual) return null
  return { device, manual, manualEntries: num(stepsOnlyEntries), deviceShare: share(device, device + manual) }
}

export function kmLastDays(walks = [], days = 30, today = '') {
  const end = new Date(`${today}T12:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const from = new Date(end.getTime() - (days - 1) * DAY_MS)
  const total = (walks || []).filter(item => {
    const date = new Date(`${item.date}T12:00:00`)
    return !Number.isNaN(date.getTime()) && date >= from && date <= end
  }).reduce((distance, item) => distance + num(item.distanceKm), 0)
  return round(total, 1)
}

/* ------------------------------ Sleep ------------------------------ */

export function sleepSummary(sleeps = [], goalHours = 8) {
  const rows = (sleeps || []).filter(item => num(item.hours) > 0)
  if (!rows.length) return null
  const hits = rows.filter(item => num(item.hours) >= num(goalHours)).length
  return {
    nights: rows.length,
    average: round(average(rows.map(item => num(item.hours))), 1),
    shortest: round(Math.min(...rows.map(item => num(item.hours))), 1),
    goalHits: hits,
    goalPercent: share(hits, rows.length),
  }
}

export function bedtimeAverage(sleeps = []) {
  const times = (sleeps || []).map(item => hoursOfDay(item?.bed)).filter(value => value !== null)
  if (!times.length) return null
  const shifted = times.map(value => (value >= 12 ? value - 24 : value))
  const mean = average(shifted)
  const normalised = mean < 0 ? mean + 24 : mean
  return { hours: round(normalised, 2), clock: `${String(Math.floor(normalised)).padStart(2, '0')}:${String(Math.round((normalised % 1) * 60)).padStart(2, '0')}`, nights: times.length }
}

export function wakeAverage(sleeps = []) {
  const times = (sleeps || []).map(item => hoursOfDay(item?.wake)).filter(value => value !== null)
  if (!times.length) return null
  const mean = average(times)
  return { hours: round(mean, 2), clock: `${String(Math.floor(mean)).padStart(2, '0')}:${String(Math.round((mean % 1) * 60)).padStart(2, '0')}`, nights: times.length }
}

export function sleepQualityAverage(sleeps = []) {
  const values = (sleeps || []).map(item => num(item.quality)).filter(value => value > 0)
  if (!values.length) return null
  return round(average(values), 1)
}

export function stageShare(sleeps = []) {
  const rows = (sleeps || []).filter(item => num(item.hours) > 0)
  if (!rows.length) return null
  const deep = sum(rows, item => item.deep)
  const rem = sum(rows, item => item.rem)
  const total = sum(rows, item => item.hours)
  if (!deep && !rem) return null
  return { deep: round(deep, 1), rem: round(rem, 1), deepPercent: share(deep, total), remPercent: share(rem, total) }
}

export function weekendSleepShift(sleeps = []) {
  const rows = byDate(sleeps)
  const weekend = rows.filter(item => [0, 6].includes(new Date(`${item.date}T12:00:00`).getDay())).map(item => num(item.hours)).filter(Boolean)
  const weekdays = rows.filter(item => ![0, 6].includes(new Date(`${item.date}T12:00:00`).getDay())).map(item => num(item.hours)).filter(Boolean)
  if (!weekend.length || !weekdays.length) return null
  return { weekend: round(average(weekend), 1), weekday: round(average(weekdays), 1), shift: round(average(weekend) - average(weekdays), 1) }
}

export function shortNights(sleeps = [], goalHours = 8) {
  const rows = (sleeps || []).filter(item => num(item.hours) > 0)
  if (!rows.length) return null
  const short = rows.filter(item => num(item.hours) < num(goalHours) - 1).length
  return { short, nights: rows.length }
}

export function sleepRegularity(sleeps = []) {
  const times = (sleeps || []).map(item => hoursOfDay(item?.bed)).filter(value => value !== null).map(value => (value >= 12 ? value - 24 : value))
  if (times.length < 3) return null
  const mean = average(times)
  const deviation = average(times.map(value => Math.abs(value - mean)) ) * 60
  return { nights: times.length, deviationMin: Math.round(deviation) }
}

/* ------------------------------- Body ------------------------------- */

export function weightRate(weights = []) {
  const rows = byDate(weights).filter(item => num(item.kg) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (rows.length < 2) return null
  const first = rows[0]
  const last = rows[rows.length - 1]
  const days = Math.max(1, Math.round((new Date(`${last.date}T12:00:00`) - new Date(`${first.date}T12:00:00`)) / DAY_MS))
  const perWeek = (num(last.kg) - num(first.kg)) / days * 7
  return { perWeek: round(perWeek, 2), days, from: num(first.kg), to: num(last.kg) }
}

export function weightRange(weights = []) {
  const values = (weights || []).map(item => num(item.kg)).filter(value => value > 0)
  if (values.length < 2) return null
  return { low: round(Math.min(...values), 1), high: round(Math.max(...values), 1), span: round(Math.max(...values) - Math.min(...values), 1) }
}

export function bmiFrom(weightKg, heightCm) {
  const weight = num(weightKg)
  const height = num(heightCm)
  if (weight <= 0 || height <= 0) return null
  return round(weight / (height / 100) ** 2, 1)
}

export function waistToHeight(measure = null, heightCm = 0) {
  if (!measure || num(heightCm) <= 0) return null
  const waist = num(measure.waistCm)
  if (waist <= 0) return null
  return { ratio: round(waist / num(heightCm), 2), waist, height: num(heightCm) }
}

export function waistHipRatio(measure = null) {
  if (!measure || num(measure.waistCm) <= 0 || num(measure.hipsCm) <= 0) return null
  return round(num(measure.waistCm) / num(measure.hipsCm), 2)
}

export function leanMass(weightKg = 0, bodyFat = 0) {
  const weight = num(weightKg)
  const fat = num(bodyFat)
  if (weight <= 0 || fat <= 0 || fat >= 70) return null
  return { fatMass: round(weight * fat / 100, 1), leanMass: round(weight * (1 - fat / 100), 1) }
}

export function weighInCadence(weights = []) {
  const rows = byDate(weights).filter(item => num(item.kg) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (rows.length < 2) return null
  const days = Math.round((new Date(`${rows[rows.length - 1].date}T12:00:00`) - new Date(`${rows[0].date}T12:00:00`)) / DAY_MS)
  return { entries: rows.length, averageGapDays: round(days / (rows.length - 1), 1) }
}

export function measurementChange(measurements = []) {
  const rows = byDate(measurements).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (rows.length < 2) return null
  const first = rows[0]
  const last = rows[rows.length - 1]
  const diff = key => (num(first[key]) > 0 && num(last[key]) > 0 ? round(num(last[key]) - num(first[key]), 1) : null)
  return { waist: diff('waistCm'), chest: diff('chestCm'), hips: diff('hipsCm'), from: first.date, to: last.date }
}

/* --------------------------- Consistency --------------------------- */

export function habitStats(habits = [], logs = [], date = '', days = 30) {
  const rows = habits || []
  if (!rows.length) return null
  const keys = new Set()
  const end = new Date(`${date}T12:00:00`)
  for (let index = 0; index < days; index += 1) {
    const day = new Date(end.getTime() - index * DAY_MS)
    keys.add(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
  }
  const done = (logs || []).filter(log => keys.has(log.date)).length
  return { habits: rows.length, checkins: done, possible: rows.length * days, percent: share(done, rows.length * days) }
}

export function habitStreak(habitId = '', logs = [], date = '') {
  const set = new Set((logs || []).filter(log => log.habitId === habitId).map(log => log.date))
  if (!set.size) return null
  let cursor = new Date(`${date}T12:00:00`)
  let current = 0
  for (let index = 0; index < 400; index += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (set.has(key)) current += 1
    else if (index === 0) { /* today may still be open */ }
    else break
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return { current, total: set.size }
}

export function unusedHabits(habits = [], logs = []) {
  const used = new Set((logs || []).map(log => log.habitId))
  return (habits || []).filter(habit => !used.has(habit?.id)).map(habit => habit.name)
}

export function moodAverages(moods = []) {
  const rows = (moods || []).filter(item => num(item.energy) > 0)
  if (!rows.length) return null
  return {
    entries: rows.length,
    energy: round(average(rows.map(item => num(item.energy))), 1),
    stress: round(average(rows.map(item => num(item.stress)).filter(Boolean)), 1),
  }
}

export function symptomDays(symptoms = [], days = 30, date = '') {
  const end = new Date(`${date}T12:00:00`)
  const from = end.getTime() - (days - 1) * DAY_MS
  const rows = (symptoms || []).filter(item => {
    const at = new Date(`${item.date}T12:00:00`).getTime()
    return Number.isFinite(at) && at >= from
  })
  return { entries: rows.length, days: new Set(rows.map(item => item.date)).size, averageSeverity: rows.length ? round(average(rows.map(item => num(item.severity)).filter(value => value > 0)), 1) : null }
}

export function waterGoalRate(water = [], goalMl = 0, days = 7, date = '') {
  if (num(goalMl) <= 0) return null
  const end = new Date(`${date}T12:00:00`)
  let hit = 0
  for (let index = 0; index < days; index += 1) {
    const day = new Date(end.getTime() - index * DAY_MS)
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const total = (water || []).filter(item => item.date === key).reduce((total, item) => total + num(item.ml), 0)
    if (total >= num(goalMl)) hit += 1
  }
  return { hit, days, percent: share(hit, days) }
}

export function bestStreak(dates = []) {
  const sorted = [...new Set((dates || []).filter(Boolean))].sort()
  if (!sorted.length) return null
  let best = 1
  let run = 1
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T12:00:00`)
    const current = new Date(`${sorted[index]}T12:00:00`)
    const gap = Math.round((current - previous) / DAY_MS)
    if (gap === 1) { run += 1; best = Math.max(best, run) } else if (gap > 1) run = 1
  }
  return { best, days: sorted.length, first: sorted[0], last: sorted[sorted.length - 1] }
}

export function bestWeekday(series = [], key = 'steps') {
  const buckets = new Map()
  for (const item of series || []) {
    const date = new Date(`${item.date}T12:00:00`)
    if (Number.isNaN(date.getTime())) continue
    const label = date.toLocaleDateString(undefined, { weekday: 'short' })
    const bucket = buckets.get(label) || { values: [] }
    bucket.values.push(num(item[key]))
    buckets.set(label, bucket)
  }
  const rows = [...buckets.entries()].filter(([, bucket]) => bucket.values.some(value => value > 0)).map(([day, bucket]) => ({ day, average: Math.round(average(bucket.values.filter(value => value > 0))) }))
  if (!rows.length) return null
  return rows.sort((a, b) => b.average - a.average)[0]
}

/* ----------------------------- Vitals ----------------------------- */

export function vitalAverage(vitals = [], key = 'rhr') {
  const values = (vitals || []).map(item => num(item[key])).filter(value => value > 0)
  if (!values.length) return null
  return round(average(values), 1)
}

export function vitalExtreme(vitals = [], key = 'temp', mode = 'max') {
  const values = (vitals || []).map(item => num(item[key])).filter(value => value > 0)
  if (!values.length) return null
  return mode === 'max' ? Math.max(...values) : Math.min(...values)
}

export function bpAverage(vitals = []) {
  const rows = (vitals || []).map(item => String(item?.bp || '').match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/)).filter(Boolean)
  if (!rows.length) return null
  return { systolic: Math.round(average(rows.map(match => num(match[1])))), diastolic: Math.round(average(rows.map(match => num(match[2])))), readings: rows.length }
}

export function glucoseRange(entries = []) {
  const values = (entries || []).map(item => num(item.value)).filter(value => value > 0)
  if (!values.length) return null
  return { low: round(Math.min(...values), 1), high: round(Math.max(...values), 1), average: round(average(values), 1), count: values.length }
}

/* ---------------------------- Data health ---------------------------- */

const objectOrEmpty = value => (value && typeof value === 'object' ? value : {})

export function recordCounts(state = {}) {
  return Object.entries(objectOrEmpty(state))
    .filter(([, value]) => Array.isArray(value) && value.length)
    .map(([key, value]) => ({ key, count: value.length }))
    .sort((a, b) => b.count - a.count)
}

export function dateRange(state = {}) {
  const dates = []
  for (const value of Object.values(objectOrEmpty(state))) {
    if (!Array.isArray(value)) continue
    for (const item of value) if (item?.date) dates.push(String(item.date))
  }
  if (!dates.length) return null
  dates.sort()
  return { first: dates[0], last: dates[dates.length - 1], days: Math.max(1, Math.round((new Date(`${dates[dates.length - 1]}T12:00:00`) - new Date(`${dates[0]}T12:00:00`)) / DAY_MS) + 1) }
}

export function orphanRecords(state = {}) {
  const data = objectOrEmpty(state)
  const ids = new Set((data.profiles || []).map(profile => profile.id))
  let count = 0
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue
    count += value.filter(item => item?.profileId && !ids.has(item.profileId)).length
  }
  return count
}

export function invalidRecords(state = {}) {
  const data = objectOrEmpty(state)
  const problems = []
  const check = (list, test, label) => {
    const count = (data[list] || []).filter(test).length
    if (count) problems.push({ label, count })
  }
  check('weights', item => !(num(item.kg) > 0), 'weigh-ins without a weight')
  check('meals', item => !(num(item.grams) > 0), 'meals without grams')
  check('sleeps', item => num(item.hours) > 24, 'sleep nights over 24 hours')
  check('water', item => !(num(item.ml) > 0), 'drinks without an amount')
  check('walks', item => num(item.minutes) < 0, 'sessions with negative minutes')
  return problems
}

export function emptyCollections(state = {}) {
  return Object.entries(objectOrEmpty(state)).filter(([, value]) => Array.isArray(value) && value.length === 0).map(([key]) => key)
}

export function photoBytes(state = {}) {
  let chars = 0
  for (const value of Object.values(objectOrEmpty(state))) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item?.startPhoto === 'string') chars += item.startPhoto.length
      if (typeof item?.endPhoto === 'string') chars += item.endPhoto.length
      if (typeof item?.photo === 'string') chars += item.photo.length
    }
  }
  return Math.round((chars * 2) / 1024)
}

export function routeBytes(state = {}) {
  let points = 0
  for (const walk of objectOrEmpty(state).walks || []) if (Array.isArray(walk.route)) points += walk.route.length
  return { points, kb: Math.round((points * 24) / 1024 * 10) / 10 }
}

export function backupAge(lastBackupAt = '', now = Date.now()) {
  const at = Date.parse(lastBackupAt || '')
  if (!at) return null
  return { days: Math.max(0, Math.floor((now - at) / DAY_MS)), at }
}

export function profileCounts(state = {}) {
  const data = objectOrEmpty(state)
  const profiles = data.profiles || []
  return profiles.map(profile => {
    let total = 0
    for (const [key, value] of Object.entries(data)) {
      if (!Array.isArray(value) || key === 'profiles') continue
      total += value.filter(item => !item?.profileId || item.profileId === profile.id).length
    }
    return { id: profile.id, name: profile.name || 'Profile', records: total }
  })
}

/* ------------------------------ Planning ------------------------------ */

export function plannedDays(plans = []) {
  const dates = new Set((plans || []).map(plan => plan.date).filter(Boolean))
  return { plans: (plans || []).length, days: dates.size }
}

export function templateUsage(templates = []) {
  const list = templates || []
  if (!list.length) return null
  const items = list.reduce((total, template) => total + (Array.isArray(template.items) ? template.items.length : 0), 0)
  return { templates: list.length, items, averageItems: round(items / list.length, 1) }
}

export function journalSummary(journal = []) {
  const entries = (journal || []).filter(item => String(item?.text || item?.note || '').trim())
  if (!entries.length) return null
  const words = entries.reduce((total, item) => total + String(item.text || item.note).trim().split(/\s+/).length, 0)
  return { entries: entries.length, words, averageWords: Math.round(words / entries.length) }
}

export function vitalCoverage(days = 7, state = {}, date = '') {
  const data = objectOrEmpty(state)
  const end = new Date(`${date}T12:00:00`)
  const keys = new Set()
  for (let index = 0; index < days; index += 1) {
    const day = new Date(end.getTime() - index * DAY_MS)
    keys.add(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
  }
  const covered = new Set((data.vitals || []).map(item => item.date).filter(key => keys.has(key)))
  return { days: covered.size, window: days, percent: share(covered.size, days) }
}
