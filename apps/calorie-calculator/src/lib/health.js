// Shared reading and summary helpers for the health tracker (vitals, medicines
// and symptoms). Everything works on local entries only; nothing is synced.
import { addDays, getDay, todayKey } from './store.js'
import { movementForDay } from './movement.js'

export const VITAL_FIELDS = ['systolic', 'diastolic', 'pulse', 'glucose', 'spo2', 'tempC', 'respRate']

export const GLUCOSE_CONTEXTS = [
  { id: 'fasting', label: 'Fasting' },
  { id: 'post', label: 'After a meal' },
  { id: 'random', label: 'Any time' },
]

export const COMMON_SYMPTOMS = ['Headache', 'Fatigue', 'Nausea', 'Cramps', 'Dizziness', 'Bloating', 'Back pain', 'Poor sleep', 'Anxiety', 'Sore throat']

export function vitalsInRange(vitals = [], days = 7, end = todayKey()) {
  const start = addDays(end, -(Math.max(1, days) - 1))
  return vitals.filter(item => item && item.date >= start && item.date <= end)
}

export function latestVital(vitals = [], field) {
  const matches = vitals
    .filter(item => item && Number(item[field]) > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || (Number(b.at) || 0) - (Number(a.at) || 0))
  return matches[0] || null
}

/** One averaged point per day, oldest first, for charting a single vital. */
export function vitalSeries(vitals = [], field, days = 14, end = todayKey()) {
  const start = addDays(end, -(Math.max(1, days) - 1))
  const buckets = new Map()
  for (const item of vitals) {
    if (!item || item.date < start || item.date > end) continue
    const value = Number(item[field])
    if (!Number.isFinite(value) || value <= 0) continue
    const bucket = buckets.get(item.date) || { date: item.date, total: 0, count: 0 }
    bucket.total += value
    bucket.count += 1
    buckets.set(item.date, bucket)
  }
  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(bucket => ({ date: bucket.date, value: Math.round(bucket.total / bucket.count) }))
}

export function vitalAverage(vitals = [], field, days = 7, end = todayKey()) {
  const values = vitalSeries(vitals, field, days, end).map(point => point.value)
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function bloodPressureCategory(systolic, diastolic) {
  const high = Number(systolic)
  const low = Number(diastolic)
  if (!high || !low) return { label: 'Not measured', tone: '' }
  if (high >= 180 || low >= 120) return { label: 'Very high · seek care', tone: 'bad' }
  if (high >= 140 || low >= 90) return { label: 'High', tone: 'bad' }
  if (high >= 130 || low >= 80) return { label: 'Elevated', tone: 'amber' }
  if (high < 90 || low < 60) return { label: 'Low', tone: 'amber' }
  return { label: 'In range', tone: 'good' }
}

export function pulseCategory(pulse) {
  const value = Number(pulse)
  if (!value) return { label: 'Not measured', tone: '' }
  if (value > 100) return { label: 'Above resting range', tone: 'amber' }
  if (value < 60) return { label: 'Below resting range', tone: 'amber' }
  return { label: 'Resting range', tone: 'good' }
}

export function glucoseCategory(value, context = 'random') {
  const level = Number(value)
  if (!level) return { label: 'Not measured', tone: '' }
  if (context === 'fasting') {
    if (level < 70) return { label: 'Low', tone: 'bad' }
    if (level < 100) return { label: 'In range', tone: 'good' }
    if (level < 126) return { label: 'Above range', tone: 'amber' }
    return { label: 'High', tone: 'bad' }
  }
  if (level < 140) return { label: 'In range', tone: 'good' }
  if (level < 200) return { label: 'Above range', tone: 'amber' }
  return { label: 'High', tone: 'bad' }
}

export function spo2Category(value) {
  const level = Number(value)
  if (!level) return { label: 'Not measured', tone: '' }
  if (level >= 95) return { label: 'In range', tone: 'good' }
  if (level >= 90) return { label: 'Low', tone: 'amber' }
  return { label: 'Very low · seek care', tone: 'bad' }
}

export function temperatureCategory(value) {
  const level = Number(value)
  if (!level) return { label: 'Not measured', tone: '' }
  if (level >= 38) return { label: 'Fever', tone: 'bad' }
  if (level >= 37.3) return { label: 'Elevated', tone: 'amber' }
  if (level < 35.5) return { label: 'Low', tone: 'amber' }
  return { label: 'In range', tone: 'good' }
}

export function medicationTakenToday(medId, logs = [], date = todayKey()) {
  return logs.some(entry => entry && entry.medId === medId && entry.date === date)
}

export function medicationAdherence(medications = [], logs = [], days = 7, end = todayKey()) {
  const active = medications.filter(med => med && med.active !== false)
  const start = addDays(end, -(Math.max(1, days) - 1))
  const expected = active.length * days
  const ids = new Set(active.map(med => med.id))
  const taken = logs.filter(entry => entry && entry.date >= start && entry.date <= end && ids.has(entry.medId)).length
  return { expected, taken, pct: expected ? Math.round(taken / expected * 100) : 0, active: active.length }
}

export function symptomSummary(symptoms = [], days = 14, end = todayKey()) {
  const start = addDays(end, -(Math.max(1, days) - 1))
  const recent = symptoms.filter(item => item && item.date >= start && item.date <= end)
  const counts = new Map()
  for (const item of recent) {
    const name = String(item.name || '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
  return { total: recent.length, days, top, recent }
}

/** Seven (or N) days of step totals plus the goal-day and active-minute picture. */
export function stepSummary(profile, end = todayKey(), days = 7) {
  const entries = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(end, -offset)
    const movement = movementForDay(getDay(date, false), profile)
    entries.push({
      date,
      steps: movement.steps,
      goal: movement.stepGoal,
      met: movement.steps >= movement.stepGoal && movement.stepGoal > 0,
      distanceKm: movement.distanceKm,
      activeMinutes: movement.minutes,
      creditKcal: movement.stepCreditKcal,
    })
  }
  const logged = entries.filter(entry => entry.steps > 0)
  const total = entries.reduce((sum, entry) => sum + entry.steps, 0)
  return {
    days,
    entries,
    logged: logged.length,
    total,
    average: logged.length ? Math.round(total / logged.length) : 0,
    best: entries.reduce((max, entry) => Math.max(max, entry.steps), 0),
    goalDays: entries.filter(entry => entry.met).length,
    activeMinutes: Math.round(entries.reduce((sum, entry) => sum + entry.activeMinutes, 0)),
    distanceKm: Math.round(entries.reduce((sum, entry) => sum + entry.distanceKm, 0) * 10) / 10,
  }
}
