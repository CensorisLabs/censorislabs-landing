// CSV importing for AbsoluteCal.
//
// Two shapes are supported, detected from the header row:
//   * MyFitnessPal diary export: Date, Meal, Food, Calories, Protein, Carbs, Fat, ...
//   * Apple Health metrics (Health Auto Export style): Start, Type, Value, Unit
//
// Everything is parsed locally and merged into the existing days. Nothing is
// uploaded, and re-importing the same file skips entries that already match.

import { addEntry, getDay, makeQuickEntry, setWellbeing, setWeight } from './store.js'

const MAX_KCAL = 20000

function pad(value) {
  return String(value).padStart(2, '0')
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF and BOM. */
export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1 } else quoted = false
      } else {
        field += character
      }
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') { row.push(field); field = '' }
    else if (character === '\n') {
      row.push(field); field = ''
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row)
      row = []
    } else if (character !== '\r') field += character
  }
  row.push(field)
  if (row.some(cell => String(cell).trim() !== '')) rows.push(row)
  return rows
}

function headerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function numberFrom(value) {
  const raw = String(value ?? '').replace(/[^\d.,-]/g, '')
  if (!raw) return 0
  const cleaned = /,\d{3}(?:\D|$)/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Accepts ISO, US M/D/Y and anything Date can parse. Returns YYYY-MM-DD. */
export function normalizeDate(value) {
  const text = String(value || '').trim()
  if (!text) return null
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`
  match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += 2000
    return `${year}-${pad(match[1])}-${pad(match[2])}`
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

function mealFor(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('breakfast')) return 'breakfast'
  if (text.includes('lunch')) return 'lunch'
  if (text.includes('dinner')) return 'dinner'
  return 'snacks'
}

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(headerKey(alias))
    if (index >= 0) return index
  }
  return -1
}

function appleKind(type) {
  const key = headerKey(String(type || '').replace(/^HKQuantityTypeIdentifier/i, '').replace(/^HKCategoryTypeIdentifier/i, ''))
  if (key.includes('dietary energy')) return 'kcal'
  if (key.includes('dietary protein') || key === 'protein') return 'p'
  if (key.includes('dietary carbohydrate') || key === 'carbohydrates') return 'c'
  if (key.includes('dietary fat') || key === 'total fat') return 'f'
  if (key.includes('dietary fiber') || key.includes('dietary fibre')) return 'fib'
  if (key.includes('dietary sugar')) return 'sug'
  if (key.includes('dietary sodium')) return 'na'
  if (key.includes('step count') || key === 'steps') return 'steps'
  if (key === 'weight' || key.includes('body mass')) return 'weight'
  if (key.includes('sleep')) return 'sleep'
  if (key.includes('dietary water') || key === 'water') return 'water'
  return null
}

function parseApple(rows, columns) {
  const nutrition = new Map()
  const steps = new Map()
  const weights = new Map()
  const sleep = new Map()
  const water = new Map()
  let skipped = 0

  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[columns.date])
    const endDate = columns.end >= 0 ? normalizeDate(row[columns.end]) : null
    const kind = appleKind(row[columns.type])
    if (!date || !kind) { skipped += 1; continue }
    const rawValue = row[columns.value]
    const value = numberFrom(rawValue)
    const unit = String(row[columns.unit] || rawValue || '').toLowerCase()
    if (!Number.isFinite(value) || value === 0) { skipped += 1; continue }

    if (kind === 'steps') {
      steps.set(date, (steps.get(date) || 0) + Math.max(0, Math.round(value)))
    } else if (kind === 'weight') {
      const kg = /lb|pound/.test(unit) ? value * 0.45359237 : value
      if (kg >= 20 && kg <= 400) weights.set(date, Math.round(kg * 10) / 10)
    } else if (kind === 'sleep') {
      const hours = /min/.test(unit) ? value / 60 : /(^|[^a-z])s(ec|econd)?s?($|[^a-z])/.test(unit) ? value / 3600 : value
      const night = endDate || date
      if (hours > 0 && hours <= 24) sleep.set(night, (sleep.get(night) || 0) + Math.round(hours * 10) / 10)
    } else if (kind === 'water') {
      const ml = /fl\s*oz/.test(unit) ? value * 29.5735 : /(^|[^a-z])l($|[^a-z])/.test(unit) ? value * 1000 : value
      water.set(date, (water.get(date) || 0) + Math.max(0, Math.round(ml)))
    } else {
      const bucket = nutrition.get(date) || { date, kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, na: 0 }
      const converted = kind === 'kcal' && /kj/.test(unit) ? value / 4.184 : value
      bucket[kind] += converted
      nutrition.set(date, bucket)
    }
  }

  const nutritionDays = [...nutrition.values()]
    .map(bucket => {
      const computed = bucket.kcal || (bucket.p * 4 + bucket.c * 4 + bucket.f * 9)
      return {
        date: bucket.date,
        kcal: Math.min(MAX_KCAL, Math.round(computed)),
        p: Math.round(bucket.p * 10) / 10,
        c: Math.round(bucket.c * 10) / 10,
        f: Math.round(bucket.f * 10) / 10,
        fib: Math.round(bucket.fib * 10) / 10,
        sug: Math.round(bucket.sug * 10) / 10,
        na: Math.round(bucket.na),
      }
    })
    .filter(day => day.kcal > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    format: 'apple',
    rows: rows.length - 1,
    skipped,
    nutrition: nutritionDays,
    steps: [...steps.entries()].map(([date, count]) => ({ date, steps: count })).sort((a, b) => a.date.localeCompare(b.date)),
    weights: [...weights.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => a.date.localeCompare(b.date)),
    sleep: [...sleep.entries()].map(([date, hours]) => ({ date, hours })).sort((a, b) => a.date.localeCompare(b.date)),
    water: [...water.entries()].map(([date, ml]) => ({ date, ml })).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

function parseDiary(rows, columns) {
  const entries = []
  let skipped = 0
  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[columns.date])
    const name = String(row[columns.food] || '').trim()
    const kcal = Math.min(MAX_KCAL, numberFrom(row[columns.kcal]))
    const p = numberFrom(row[columns.p])
    const c = numberFrom(row[columns.c])
    const f = numberFrom(row[columns.f])
    if (!date || !name || (kcal <= 0 && p <= 0 && c <= 0 && f <= 0)) { skipped += 1; continue }
    entries.push({
      date,
      meal: mealFor(row[columns.meal]),
      name: name.slice(0, 120),
      portion: String(row[columns.serving] || '').trim().slice(0, 60),
      kcal: kcal || Math.round(p * 4 + c * 4 + f * 9),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      fib: Math.round(numberFrom(row[columns.fib]) * 10) / 10,
    })
  }
  return { format: 'mfp', rows: rows.length - 1, skipped, entries }
}

/** Parse any supported CSV into a preview-ready result. */
export function readCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('That file has no data rows.')
  const headers = rows[0].map(headerKey)
  const columns = {
    date: findColumn(headers, ['date', 'start', 'start date', 'day']),
    meal: findColumn(headers, ['meal', 'meal name', 'meal type']),
    food: findColumn(headers, ['food', 'food name', 'name', 'item']),
    serving: findColumn(headers, ['serving size', 'serving', 'servings', 'portion']),
    kcal: findColumn(headers, ['calories', 'kcal', 'energy', 'calories kcal']),
    p: findColumn(headers, ['protein', 'protein g']),
    c: findColumn(headers, ['carbs', 'carbohydrates', 'carbs g']),
    f: findColumn(headers, ['fat', 'fat g']),
    fib: findColumn(headers, ['fiber', 'fibre', 'fiber g']),
    type: findColumn(headers, ['type', 'metric', 'health type', 'data type', 'category']),
    value: findColumn(headers, ['value', 'qty', 'quantity', 'amount']),
    unit: findColumn(headers, ['unit', 'units']),
    end: findColumn(headers, ['end', 'finish', 'end date', 'end time']),
  }

  if (columns.date >= 0 && columns.type >= 0 && columns.value >= 0 && columns.food < 0) {
    return parseApple(rows, columns)
  }
  if (columns.date >= 0 && columns.food >= 0) {
    return parseDiary(rows, columns)
  }
  throw new Error('Unrecognised CSV. Export a MyFitnessPal diary or Apple Health metrics file.')
}

/** Merge a parsed result into the local diary. Call inside update(). */
export function applyImport(result) {
  const summary = { entries: 0, days: new Set(), steps: 0, weights: 0, sleep: 0, water: 0, skipped: result.skipped || 0 }

  for (const item of result.entries || []) {
    const day = getDay(item.date)
    const duplicate = (day.meals[item.meal] || []).some(entry => entry.name === item.name && Math.round(entry.nutrients.kcal) === Math.round(item.kcal))
    if (duplicate) { summary.skipped += 1; continue }
    const entry = makeQuickEntry({ name: item.name, kcal: item.kcal, p: item.p, c: item.c, f: item.f, fib: item.fib })
    entry.portionLabel = item.portion || 'Imported'
    addEntry(item.date, item.meal, entry)
    summary.entries += 1
    summary.days.add(item.date)
  }

  for (const item of result.nutrition || []) {
    const day = getDay(item.date)
    if ((day.meals.snacks || []).some(entry => entry.name === 'Apple Health nutrition')) { summary.skipped += 1; continue }
    const entry = makeQuickEntry({ name: 'Apple Health nutrition', kcal: item.kcal, p: item.p, c: item.c, f: item.f, fib: item.fib, sug: item.sug, na: item.na })
    entry.portionLabel = 'Daily total'
    addEntry(item.date, 'snacks', entry)
    summary.entries += 1
    summary.days.add(item.date)
  }

  for (const item of result.steps || []) {
    const day = getDay(item.date)
    if (item.steps > (Number(day.steps) || 0)) {
      setWellbeing('steps', item.steps, item.date)
      summary.steps += 1
      summary.days.add(item.date)
    }
  }

  for (const item of result.sleep || []) {
    const day = getDay(item.date)
    if (item.hours > (Number(day.sleep) || 0)) {
      setWellbeing('sleep', Math.min(24, item.hours), item.date)
      summary.sleep += 1
      summary.days.add(item.date)
    }
  }

  for (const item of result.water || []) {
    const day = getDay(item.date)
    if (item.ml > (Number(day.water) || 0)) {
      day.water = Math.min(12000, item.ml)
      summary.water += 1
      summary.days.add(item.date)
    }
  }

  for (const item of result.weights || []) {
    if (setWeight(item.kg, item.date)) {
      summary.weights += 1
      summary.days.add(item.date)
    }
  }

  return { ...summary, days: summary.days.size }
}

export function importSummary(result) {
  if (result.format === 'apple') {
    return [
      ['Nutrition days', result.nutrition.length],
      ['Step days', result.steps.length],
      ['Weigh-ins', result.weights.length],
      ['Sleep nights', result.sleep.length],
      ['Water days', result.water.length],
    ]
  }
  return [
    ['Meal entries', result.entries.length],
    ['Days covered', new Set(result.entries.map(entry => entry.date)).size],
  ]
}
