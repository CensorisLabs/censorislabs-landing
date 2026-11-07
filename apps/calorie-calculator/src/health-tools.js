// Extra summaries that sit on top of the tracker data: pacing, completeness,
// trends, adherence and simple statistics. Pure functions only, so each one can
// be tested without a browser, and every label states what the number is not.

export const GLUCOSE_RANGE = { low: 3.9, high: 7.8 }
export const WEEKLY_ACTIVE_MINUTES = 150

const DAY_MS = 86400000

export function dayKey(date) {
  const value = date instanceof Date ? date : new Date(`${date}T12:00:00`)
  if (Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function dayKeys(date, days) {
  const end = new Date(`${date}T12:00:00`)
  const keys = []
  if (Number.isNaN(end.getTime())) return keys
  for (let offset = days - 1; offset >= 0; offset -= 1) keys.push(dayKey(new Date(end.getTime() - offset * DAY_MS)))
  return keys
}

export function recordsFor(list, profileId) {
  return (Array.isArray(list) ? list : []).filter(item => item && (!item.profileId || item.profileId === profileId))
}

// A day's calories are judged against where the clock is in the waking window,
// not the whole 24 hours: eating "nothing by 6am" is not being behind.
export function caloriePacing({ kcal = 0, target = 0, now = new Date() } = {}) {
  const goal = Number(target) || 0
  if (goal <= 0) return null
  const hours = now.getHours() + now.getMinutes() / 60
  const fraction = Math.max(0, Math.min(1, (hours - 6) / 16))
  const expected = goal * fraction
  const eaten = Math.max(0, Number(kcal) || 0)
  const difference = Math.round(eaten - expected)
  const tolerance = Math.max(60, goal * 0.12)
  const status = Math.abs(difference) <= tolerance ? 'onPace' : difference > 0 ? 'ahead' : 'behind'
  return {
    status,
    expected: Math.round(expected),
    difference,
    fraction,
    label: status === 'onPace'
      ? `On pace · about ${Math.abs(difference)} kcal from the line`
      : status === 'ahead'
        ? `${Math.abs(difference)} kcal above an even pace`
        : `${Math.abs(difference)} kcal below an even pace`,
  }
}

export function macroRemaining(totals = {}, targets = null) {
  if (!targets) return null
  const left = key => Math.round((Number(targets[key]) || 0) - (Number(totals[key]) || 0))
  return { protein: left('protein'), carbs: left('carbs'), fat: left('fat') }
}

// Six things a complete day of tracking tends to include. Used only as a nudge,
// never as a score of health.
export function dayCompleteness(state = {}, date = '', profileId = '') {
  const inDay = list => recordsFor(list, profileId).filter(item => item.date === date)
  const meals = inDay(state.meals)
  const water = inDay(state.water)
  const sleeps = inDay(state.sleeps)
  const weights = inDay(state.weights)
  const moods = inDay(state.moods)
  const activities = inDay(state.activities)
  const items = [
    { key: 'meals', label: 'Meals', done: meals.length > 0 },
    { key: 'water', label: 'Water', done: water.length > 0 },
    { key: 'sleep', label: 'Sleep', done: sleeps.length > 0 },
    { key: 'steps', label: 'Movement', done: activities.length > 0 },
    { key: 'weight', label: 'Weight', done: weights.length > 0 },
    { key: 'mood', label: 'Check-in', done: moods.length > 0 },
  ]
  const done = items.filter(item => item.done)
  return { items, done: done.length, total: items.length, missing: items.filter(item => !item.done).map(item => item.label) }
}

export function compareToPrevious(value, previous) {
  const today = Number(value) || 0
  const before = Number(previous)
  if (!Number.isFinite(before) || previous === null || previous === undefined) return null
  const difference = Math.round(today - before)
  return { difference, label: difference === 0 ? 'same as yesterday' : `${difference > 0 ? '+' : ''}${difference} vs yesterday` }
}

// Per-100-kcal scores let a 300 kcal snack and a 90 g yogurt compare fairly.
export function rankFoods(foods = [], key = 'protein', limit = 12) {
  const list = (Array.isArray(foods) ? foods : []).filter(food => food && Number(food.kcal) > 0)
  const score = food => {
    const kcal = Math.max(1, Number(food.kcal) || 0)
    if (key === 'fiber') return (Number(food.fi) || 0) * 100 / kcal
    if (key === 'lowSugar') return -(Number(food.su) || 0) * 100 / kcal
    return (Number(food.p) || 0) * 100 / kcal
  }
  return list
    .map(food => ({ ...food, score: Math.round(score(food) * 10) / 10 }))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))
    .slice(0, Math.max(1, limit))
}

export function parseBp(text = '') {
  const match = String(text).match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/)
  if (!match) return null
  const systolic = Number(match[1])
  const diastolic = Number(match[2])
  if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 160) return null
  return { systolic, diastolic }
}

// A plain reading of the common adult bands. It is a label for a number you
// typed in, never a diagnosis or a treatment suggestion.
export function bpCategory(bp) {
  const parsed = typeof bp === 'string' ? parseBp(bp) : bp
  if (!parsed) return null
  const { systolic, diastolic } = parsed
  let label = 'In the usual range'
  let tone = 'good'
  if (systolic >= 140 || diastolic >= 90) { label = 'High reading'; tone = 'alert' }
  else if (systolic >= 130 || diastolic >= 85) { label = 'Above the usual range'; tone = 'warn' }
  else if (systolic < 90 || diastolic < 60) { label = 'Low reading'; tone = 'warn' }
  return { label, tone, systolic, diastolic, detail: 'One reading is not a diagnosis. A clinician measures blood pressure properly and over time.' }
}

export function glucoseStats(entries = [], date = '', days = 7, profileId = '') {
  const keys = new Set(dayKeys(date, days))
  const values = recordsFor(entries, profileId)
    .filter(item => keys.has(item.date) && Number(item.value) > 0)
    .map(item => Number(item.value))
  if (!values.length) return { count: 0, average: null, low: 0, high: 0, inRange: 0 }
  const low = values.filter(value => value < GLUCOSE_RANGE.low).length
  const high = values.filter(value => value > GLUCOSE_RANGE.high).length
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
  return { count: values.length, average, low, high, inRange: values.length - low - high }
}

// Bedtimes around midnight (22:00–06:00) are shifted into a continuous range so
// 23:40 and 00:20 are five minutes apart instead of twenty-three hours.
function bedtimeMinutes(time = '') {
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 12 * 60 ? minutes - 24 * 60 : minutes
}

export function sleepConsistency(sleeps = [], date = '', days = 14, profileId = '') {
  const keys = new Set(dayKeys(date, days))
  const times = recordsFor(sleeps, profileId)
    .filter(item => keys.has(item.date) && item.bed)
    .map(item => bedtimeMinutes(item.bed))
    .filter(value => value !== null)
  if (times.length < 2) return { nights: times.length, spreadMin: null, label: 'Log a bedtime on two nights to see how steady your sleep timing is.' }
  const spread = Math.round(Math.max(...times) - Math.min(...times))
  const label = spread <= 30 ? 'Very steady bedtimes' : spread <= 60 ? 'Fairly steady bedtimes' : 'Bedtimes move around a lot'
  return { nights: times.length, spreadMin: spread, label }
}

export function symptomFrequency(symptoms = [], date = '', days = 30, profileId = '', limit = 4) {
  const keys = new Set(dayKeys(date, days))
  const counts = new Map()
  for (const entry of recordsFor(symptoms, profileId)) {
    if (!keys.has(entry.date)) continue
    const name = String(entry.name || '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function medicationAdherence(supplements = [], medicineLogs = [], date = '', days = 7, profileId = '') {
  const items = recordsFor(supplements, profileId)
  const keys = dayKeys(date, days)
  if (!items.length) return { percent: null, taken: 0, expected: 0 }
  const logged = new Set(recordsFor(medicineLogs, profileId).map(item => `${item.itemId}|${item.date}`))
  let taken = 0
  for (const item of items) for (const key of keys) if (logged.has(`${item.id}|${key}`)) taken += 1
  const expected = items.length * keys.length
  return { taken, expected, percent: Math.round(taken / Math.max(1, expected) * 100) }
}

export function fastingSummary(sessions = [], profileId = '', limit = 5) {
  const done = recordsFor(sessions, profileId)
    .filter(item => item.endAt && Number(item.minutes) > 0)
    .sort((a, b) => String(b.endAt).localeCompare(String(a.endAt)))
  if (!done.length) return { count: 0, averageHours: null, recent: [] }
  const average = done.reduce((sum, item) => sum + Number(item.minutes), 0) / done.length
  return {
    count: done.length,
    averageHours: Math.round(average / 60 * 10) / 10,
    recent: done.slice(0, limit).map(item => ({ id: item.id, date: item.date, hours: Math.round(Number(item.minutes) / 6) / 10 })),
  }
}

export function labSeries(labResults = [], name = '', profileId = '') {
  const wanted = String(name || '').trim().toLowerCase()
  if (!wanted) return []
  return recordsFor(labResults, profileId)
    .filter(item => String(item.name || '').trim().toLowerCase() === wanted && Number.isFinite(Number(String(item.value).replace(',', '.'))))
    .map(item => ({ date: item.date, value: Number(String(item.value).replace(',', '.')), unit: item.unit || '' }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export function latestLabName(labResults = [], profileId = '') {
  const sorted = recordsFor(labResults, profileId).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return sorted[0]?.name || ''
}

export function daysSinceLast(cycleLogs = [], date = '', profileId = '') {
  const dates = recordsFor(cycleLogs, profileId).map(item => item.date).filter(Boolean).sort()
  const last = dates[dates.length - 1]
  if (!last) return null
  const difference = Math.round((new Date(`${date}T12:00:00`) - new Date(`${last}T12:00:00`)) / DAY_MS)
  return { last, days: Number.isFinite(difference) ? difference : null }
}

// One cell per day, level 0–3 by how many of meals, movement and sleep exist.
export function loggingHeatmap(state = {}, date = '', days = 56, profileId = '') {
  const keys = dayKeys(date, days)
  const has = (list, key) => recordsFor(list, profileId).some(item => item.date === key)
  return keys.map(key => {
    const signals = [has(state.meals, key), has(state.activities, key) || has(state.walks, key), has(state.sleeps, key) || has(state.water, key)]
    return { date: key, level: signals.filter(Boolean).length }
  })
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayPattern(meals = [], date = '', weeks = 4, profileId = '') {
  const buckets = new Map(WEEKDAYS.map(day => [day, { day, total: 0, days: 0 }]))
  const byDate = new Map()
  const keys = new Set(dayKeys(date, weeks * 7))
  for (const meal of recordsFor(meals, profileId)) {
    if (!keys.has(meal.date)) continue
    const grams = Math.max(0, Number(meal.grams) || 0)
    byDate.set(meal.date, (byDate.get(meal.date) || 0) + (Number(meal.nutrients?.kcal) || 0) * grams / 100)
  }
  for (const [key, kcal] of byDate) {
    const bucket = buckets.get(WEEKDAYS[new Date(`${key}T12:00:00`).getDay()])
    bucket.total += kcal
    bucket.days += 1
  }
  return [...buckets.values()].map(bucket => ({
    day: bucket.day,
    avgKcal: bucket.days ? Math.round(bucket.total / bucket.days) : null,
    days: bucket.days,
  }))
}

export function weightGoalProgress(weights = [], date = '', goalKg = 0, profileId = '') {
  const goal = Number(goalKg) || 0
  const entries = recordsFor(weights, profileId)
    .filter(item => item.date <= date && Number(item.kg) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (!goal || entries.length < 1) return null
  const first = entries[0]
  const last = entries[entries.length - 1]
  const start = Number(first.kg)
  const current = Number(last.kg)
  const span = start - goal
  const moved = start - current
  const percent = Math.abs(span) < 0.2 ? 100 : Math.round(Math.max(0, Math.min(100, moved / span * 100)))
  return {
    start, current, goal,
    toGo: Math.round(Math.abs(current - goal) * 10) / 10,
    percent,
    direction: current > goal ? 'down' : current < goal ? 'up' : 'at goal',
    since: first.date,
  }
}

export function bodyFatChange(weights = [], date = '', profileId = '') {
  const entries = recordsFor(weights, profileId)
    .filter(item => item.date <= date && Number(item.bodyFat) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (entries.length < 2) return null
  const first = entries[0]
  const last = entries[entries.length - 1]
  return {
    from: Number(first.bodyFat),
    to: Number(last.bodyFat),
    change: Math.round((Number(last.bodyFat) - Number(first.bodyFat)) * 10) / 10,
    fromDate: first.date,
    toDate: last.date,
  }
}

// Compares the recent half of a series with the half before it.
export function weekOverWeek(series = []) {
  const rows = Array.isArray(series) ? series.filter(item => item && item.date) : []
  if (rows.length < 4) return []
  const half = Math.floor(rows.length / 2)
  const older = rows.slice(0, half)
  const recent = rows.slice(rows.length - half)
  const average = (list, key) => {
    const values = list.map(item => Number(item[key]) || 0).filter(value => value > 0)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  const build = (key, label, unit) => {
    const before = average(older, key)
    const now = average(recent, key)
    if (before === null || now === null) return { key, label, unit, before, now, delta: null }
    return { key, label, unit, before: Math.round(before), now: Math.round(now), delta: Math.round(now - before) }
  }
  return [
    build('calories', 'Food energy', 'kcal'),
    build('steps', 'Steps', ''),
    build('sleep', 'Sleep', 'h'),
    build('waterMl', 'Water', 'ml'),
  ]
}

export function stepGoalStreak(state = {}, goal = 0, date = '', profileId = '', days = 120) {
  const target = Number(goal) || 0
  if (target <= 0) return { current: 0, best: 0 }
  const keys = dayKeys(date, days)
  const totals = new Map()
  const bump = (key, amount) => totals.set(key, (totals.get(key) || 0) + Math.max(0, Number(amount) || 0))
  for (const item of recordsFor(state.activities, profileId)) if (item.date) bump(item.date, item.steps)
  for (const item of recordsFor(state.healthImports, profileId)) if (item.date && Number(item.steps) > 0) bump(item.date, Number(item.steps))
  let current = 0
  let best = 0
  let run = 0
  for (const key of keys) {
    const hit = (totals.get(key) || 0) >= target
    if (hit) { run += 1; best = Math.max(best, run) } else run = 0
  }
  // The current streak counts back from the newest day, but a day still in
  // progress must not break yesterday's streak.
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const hit = (totals.get(keys[index]) || 0) >= target
    if (hit) current += 1
    else if (index === keys.length - 1) continue
    else break
  }
  return { current, best }
}

export function weeklyActiveMinutes(walks = [], date = '', profileId = '', goal = WEEKLY_ACTIVE_MINUTES) {
  const keys = new Set(dayKeys(date, 7))
  const sessions = recordsFor(walks, profileId).filter(item => keys.has(item.date))
  const minutes = sessions.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0)
  return { minutes: Math.round(minutes), sessions: sessions.length, goal: Number(goal) || WEEKLY_ACTIVE_MINUTES, percent: Math.round(Math.min(100, minutes / Math.max(1, goal) * 100)) }
}

export function cadencePerMinute(steps = 0, minutes = 0) {
  const time = Number(minutes) || 0
  if (time <= 0) return null
  return Math.round((Number(steps) || 0) / time)
}

export function storageUsage(state = {}) {
  let text = ''
  try { text = JSON.stringify(state) } catch { text = '' }
  // localStorage keeps UTF-16 code units, so two bytes per character is the
  // closest estimate available without reading the browser's own usage report.
  const bytes = text.length * 2
  const collections = Object.entries(state || {})
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({ key, count: value.length }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
  return { bytes, kb: Math.round(bytes / 1024 * 10) / 10, collections }
}

export function daySummaryText({ date = '', kcal = 0, target = 0, steps = 0, stepGoal = 0, waterMl = 0, waterGoalMl = 0, sleepHours = 0, weightKg = 0, walks = [] } = {}) {
  const parts = [`${date} · AbsoluteCal`]
  parts.push(`Food ${Math.round(kcal)}${target ? ` / ${Math.round(target)}` : ''} kcal`)
  parts.push(`Steps ${Math.round(steps)}${stepGoal ? ` / ${Math.round(stepGoal)}` : ''}`)
  if (waterMl) parts.push(`Water ${(waterMl / 1000).toFixed(1)} L${waterGoalMl ? ` / ${(waterGoalMl / 1000).toFixed(1)} L` : ''}`)
  if (sleepHours) parts.push(`Sleep ${sleepHours} h`)
  if (weightKg) parts.push(`Weight ${weightKg} kg`)
  if (walks.length) parts.push(`${walks.length} walk${walks.length === 1 ? '' : 's'} · ${Math.round(walks.reduce((sum, item) => sum + (Number(item.distanceKm) || 0), 0) * 10) / 10} km`)
  return parts.join('\n')
}
