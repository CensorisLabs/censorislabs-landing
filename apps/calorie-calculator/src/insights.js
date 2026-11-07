// Pure summary helpers shared by the meal and health views.
// No DOM access, so these can be reasoned about (and tested) in isolation.

export function previousDay(date = '') {
  const base = new Date(`${date}T12:00:00`)
  if (Number.isNaN(base.getTime())) return date
  base.setDate(base.getDate() - 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

function dayKeys(date, days) {
  const start = new Date(`${date}T12:00:00`)
  const keys = []
  if (Number.isNaN(start.getTime())) return keys
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(start)
    day.setDate(day.getDate() - offset)
    keys.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
  }
  return keys
}

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink']

export function mealKcal(meal) {
  const grams = Math.max(0, Number(meal?.grams) || 0)
  return (Number(meal?.nutrients?.kcal) || 0) * grams / 100
}

// Calorie total per meal slot for one day, always returning every slot.
export function slotBreakdown(meals = []) {
  const buckets = new Map(MEAL_SLOTS.map(slot => [slot, { slot, kcal: 0, count: 0 }]))
  for (const meal of meals || []) {
    const slot = MEAL_SLOTS.includes(meal?.slot) ? meal.slot : 'Snack'
    const bucket = buckets.get(slot)
    bucket.kcal += mealKcal(meal)
    bucket.count += 1
  }
  return [...buckets.values()].map(bucket => ({ ...bucket, kcal: Math.round(bucket.kcal) }))
}

// Most frequently logged foods, worst case capped at `limit`.
export function frequentFoods(meals = [], limit = 6) {
  const seen = new Map()
  for (const meal of meals || []) {
    if (!meal?.name) continue
    const key = meal.foodId || meal.name
    const entry = seen.get(key)
    if (entry) {
      entry.count += 1
      continue
    }
    seen.set(key, {
      name: meal.name,
      slot: MEAL_SLOTS.includes(meal.slot) ? meal.slot : 'Snack',
      grams: Math.round(Number(meal.grams) || 100) || 100,
      kcal: Math.round(mealKcal(meal)),
      count: 1,
    })
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// Distinct recent diary entries, newest first, for one-tap repeat logging.
export function recentMeals(meals = [], limit = 6) {
  const seen = new Set()
  const output = []
  const sorted = (meals || []).slice().sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))
  for (const meal of sorted) {
    if (!meal || !meal.id || !meal.name) continue
    const key = `${meal.name}|${meal.grams}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push({
      id: meal.id,
      name: meal.name,
      date: meal.date || '',
      slot: MEAL_SLOTS.includes(meal.slot) ? meal.slot : 'Meal',
      grams: Math.round(Number(meal.grams) || 100),
      kcal: Math.round(mealKcal(meal)),
    })
    if (output.length >= limit) break
  }
  return output
}

// Meals from `fromDate`, retagged for `toDate` so they can be re-logged.
export function copyableMeals(meals = [], fromDate = '', toDate = '') {
  return (meals || [])
    .filter(item => item && item.date === fromDate)
    .map(item => ({ ...item, date: toDate }))
}

// Averages over the last `days` days, counting only days that have data.
// Days without entries are reported separately instead of being averaged as zero.
export function weeklyAverages(state = {}, date = '', profileId = '', days = 7) {
  const keys = dayKeys(date, days)
  const mine = list => (list || []).filter(item => !item?.profileId || item.profileId === profileId)
  const meals = mine(state.meals)
  const water = mine(state.water)
  const sleeps = mine(state.sleeps)
  const weights = mine(state.weights)

  let kcalTotal = 0
  let kcalDays = 0
  let waterTotal = 0
  let waterDays = 0
  let sleepTotal = 0
  let sleepDays = 0
  let weightTotal = 0
  let weightDays = 0

  for (const key of keys) {
    let dayKcal = 0
    let dayMeals = 0
    for (const meal of meals) {
      if (meal.date !== key) continue
      dayKcal += mealKcal(meal)
      dayMeals += 1
    }
    if (dayMeals) {
      kcalTotal += dayKcal
      kcalDays += 1
    }
    const dayWater = water.filter(item => item.date === key).reduce((sum, item) => sum + (Number(item.ml) || 0), 0)
    if (dayWater) {
      waterTotal += dayWater
      waterDays += 1
    }
    const sleep = sleeps.find(item => item.date === key)
    if (sleep && Number(sleep.hours) > 0) {
      sleepTotal += Number(sleep.hours)
      sleepDays += 1
    }
    const weight = weights.find(item => item.date === key)
    if (weight && Number(weight.kg) > 0) {
      weightTotal += Number(weight.kg)
      weightDays += 1
    }
  }

  const average = (total, count) => (count ? Math.round(total / count * 10) / 10 : null)
  return {
    days: keys.length,
    kcal: average(kcalTotal, kcalDays),
    kcalDays,
    waterMl: average(waterTotal, waterDays),
    waterDays,
    sleepHours: average(sleepTotal, sleepDays),
    sleepDays,
    weightKg: average(weightTotal, weightDays),
    weightDays,
  }
}

// Symptom entries are user-written notes; nothing here interprets them.
export function recentSymptoms(symptoms = [], limit = 6) {
  return (symptoms || [])
    .filter(item => item && (item.name || item.note))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, limit)
    .map(item => ({
      id: item.id,
      date: item.date || '',
      name: item.name || 'Symptom',
      severity: Math.max(0, Math.min(5, Number(item.severity) || 0)),
      note: item.note || '',
    }))
}
