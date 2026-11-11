import { state, getProfile, getDay, addDays, todayKey, prettyDate, exportPayload, persist, MEALS } from './store.js'
import { dayTotals, scoreDay, targetsFor } from './calc.js'
import { downloadFile } from './ui.js'

export function exportBackup() {
  const payload = exportPayload()
  downloadFile(`kcal-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2))
  state.settings.lastExport = Date.now()
  persist()
  return true
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function exportCsv(days = 90) {
  const profile = getProfile()
  const rows = [['date', 'meal', 'food', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugar_g', 'sodium_mg', 'cost_inr', 'protein_target_g', 'kcal_target']]
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addDays(todayKey(), -index)
    const day = getDay(date, false)
    const totals = dayTotals(profile, day)
    for (const meal of MEALS) {
      for (const entry of day.meals?.[meal.id] || []) {
        rows.push([
          date,
          meal.name,
          entry.name,
          entry.portionLabel,
          entry.grams || '',
          entry.nutrients.kcal,
          entry.nutrients.p,
          entry.nutrients.c,
          entry.nutrients.f,
          entry.nutrients.fib,
          entry.nutrients.sug,
          entry.nutrients.na,
          entry.cost || 0,
          totals.targets.protein,
          totals.targets.kcal,
        ])
      }
    }
  }
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n')
  downloadFile(`kcal-diary-${todayKey()}.csv`, csv, 'text/csv;charset=utf-8')
  return rows.length - 1
}

export function daySummaryText(date = todayKey()) {
  const profile = getProfile()
  const day = getDay(date, false)
  const totals = dayTotals(profile, day)
  const score = scoreDay(profile, day)
  const lines = [
    `kcal · ${prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
    `Calories ${totals.food.kcal} / ${totals.targets.kcal} kcal · ${totals.remaining >= 0 ? `${totals.remaining} left` : `${Math.abs(totals.remaining)} over`}`,
    `P ${totals.food.p} g · C ${totals.food.c} g · F ${totals.food.f} g · Fibre ${totals.food.fib} g`,
    `Water ${day.water || 0} ml · Steps ${day.steps || 0} · Exercise ${totals.burned} kcal`,
    ...MEALS.map(meal => `${meal.name}: ${(day.meals?.[meal.id] || []).map(entry => `${entry.name} (${entry.portionLabel})`).join(', ') || '—'}`),
    `Score ${score.score}/100 (${score.grade})`,
    'Tracked with kcal · CensorisLabs',
  ]
  return lines.join('\n')
}

export function profileBackupSummary() {
  const profile = getProfile()
  const weights = profile.weights.length
  const loggedDays = Object.values(state.logs[profile.id] || {}).length
  return { weights, loggedDays, customFoods: state.customFoods.length, recipes: state.recipes.length, profiles: state.profiles.length }
}
