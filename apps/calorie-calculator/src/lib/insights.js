// Derived insight engine for kcal. Everything here is computed from the local
// log — no network, no stored results. Each insight is one small answer with a
// number, a plain-language note and a tone so the UI can colour it.

import {
  getProfile,
  profileLogs,
  getDay,
  todayKey,
  addDays,
  prettyDate,
  profileStats,
  state,
} from './store.js'
import {
  dayTotals,
  targetsFor,
  weightChange,
  goalProgress,
  goalProjection,
  bmi,
  bmiCategory,
  bodyFat,
  leanBodyMass,
  round,
  tdee,
  formatWeight,
  percent,
} from './calc.js'
import { movementForDay, strideMeters, stepCadence } from './movement.js'

const avg = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)
const sd = values => {
  if (values.length < 2) return 0
  const mean = avg(values)
  return Math.sqrt(avg(values.map(value => (value - mean) ** 2)))
}
const sum = values => values.reduce((total, value) => total + value, 0)
const kg = value => `${round(value, 1).toLocaleString('en-IN')} kg`
const nf = (value, digits = 0) => round(value, digits).toLocaleString('en-IN', { maximumFractionDigits: digits })

/** Last `days` dates, newest last, with their day objects (may be empty). */
export function windowDays(days, end = todayKey()) {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(end, index - (days - 1))
    return { date, day: getDay(date, false) }
  })
}

const logged = entries => entries.filter(item => item.day && (item.day.meals.breakfast.length + item.day.meals.lunch.length + item.day.meals.dinner.length + item.day.meals.snacks.length) > 0)

export function buildInsights(profile = getProfile()) {
  const targets = targetsFor(profile)
  const week = windowDays(7)
  const fortnight = windowDays(14)
  const month = windowDays(30)
  const loggedWeek = logged(week)
  const loggedMonth = logged(month)
  const totalsOf = entry => dayTotals(profile, entry.day)
  const weekTotals = loggedWeek.map(totalsOf)
  const monthTotals = loggedMonth.map(totalsOf)
  const stats = profileStats(profile.id)
  const weights = [...profile.weights].sort((a, b) => a.date.localeCompare(b.date))
  const last14 = weights.filter(item => item.date >= addDays(todayKey(), -14))
  const trend = weights.length >= 2 ? round((weights.at(-1).kg - weights.find(item => item.date >= addDays(todayKey(), -14))?.kg ?? weights.at(-1).kg) / Math.max(1, last14.length / 7), 2) : 0
  const adaptive = (() => {
    if (!loggedMonth.length || !last14.length) return 0
    const intake = avg(monthTotals.map(item => item.food.kcal))
    const change = (last14.at(-1).kg - last14[0].kg) * 7700 / 14
    return round(intake - change, 0)
  })()
  const entries = loggedMonth.flatMap(entry => Object.entries(entry.day.meals).flatMap(([meal, list]) => list.map(item => ({ ...item, meal, date: entry.date }))))
  const foodCounts = new Map()
  for (const entry of entries) foodCounts.set(entry.name, (foodCounts.get(entry.name) || 0) + 1)
  const topFoods = [...foodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const mealMisses = Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snacks'].map(meal => [meal, loggedMonth.filter(entry => !(entry.day.meals[meal] || []).length).length]))
  const dinnerShare = avg(loggedMonth.map(entry => {
    const totals = dayTotals(profile, entry.day)
    const dinner = totals.meals.dinner.totals.kcal
    return totals.food.kcal > 0 ? dinner / totals.food.kcal : 0
  }))
  const totalGrams = entries.reduce((total, entry) => total + (entry.grams || 0), 0)
  const totalKcal = entries.reduce((total, entry) => total + (entry.kcal || 0), 0)
  const density = totalGrams > 0 ? totalKcal / totalGrams * 100 : 0
  const proteinSources = [...entries.reduce((map, entry) => {
    if (entry.p) map.set(entry.name, (map.get(entry.name) || 0) + entry.p)
    return map
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const proteinPerMeal = loggedMonth.flatMap(entry => Object.values(dayTotals(profile, entry.day).meals).map(meal => meal.totals.p).filter(value => value > 0))
  const rows = []
  const add = (group, id, title, value, note, tone = '') => rows.push({ group, id, title, value, note, tone })

  // ---- energy ----
  const avgIntake = avg(weekTotals.map(item => item.food.kcal))
  const avgBurn = avg(weekTotals.map(item => tdee(profile) + item.burned))
  const avgDeficit = avgBurn - avgIntake
  add('Energy', 'intake', 'Average intake', loggedWeek.length ? `${nf(avgIntake)} kcal` : '—', loggedWeek.length ? `Target ${nf(targets.kcal)} kcal · ${avgIntake > targets.kcal ? 'over by ' + nf(avgIntake - targets.kcal) : 'under by ' + nf(targets.kcal - avgIntake)}` : 'Log a few days to see this', loggedWeek.length ? (Math.abs(avgIntake - targets.kcal) < targets.kcal * 0.08 ? 'good' : 'amber') : '')
  add('Energy', 'burn', 'Average daily burn', loggedWeek.length ? `${nf(avgBurn)} kcal` : '—', 'TDEE plus logged exercise', '')
  add('Energy', 'deficit', 'Average deficit', loggedWeek.length ? `${avgDeficit >= 0 ? '−' : '+'}${nf(Math.abs(avgDeficit))} kcal` : '—', avgDeficit > 0 ? `About ${kg(avgDeficit * 7 / 7700)} per week` : 'Surplus — expected while gaining', avgDeficit > 0 ? 'good' : 'amber')
  add('Energy', 'adaptive', 'Adaptive maintenance', adaptive ? `${nf(adaptive)} kcal` : '—', adaptive ? 'Inferred from intake and weight change' : 'Needs 2+ weeks of weight and food logs', '')
  add('Energy', 'variability', 'Intake variability', loggedWeek.length > 2 ? `±${nf(sd(weekTotals.map(item => item.food.kcal)))} kcal` : '—', sd(weekTotals.map(item => item.food.kcal)) > targets.kcal * 0.2 ? 'High day-to-day swings make averages noisy' : 'Steady week to week', sd(weekTotals.map(item => item.food.kcal)) > targets.kcal * 0.2 ? 'amber' : 'good')
  const weekend = monthTotals.filter((_, index) => [0, 6].includes(new Date(loggedMonth[index]?.date || todayKey()).getDay()))
  const weekday = monthTotals.filter((_, index) => ![0, 6].includes(new Date(loggedMonth[index]?.date || todayKey()).getDay()))
  add('Energy', 'weekend', 'Weekend vs weekday', loggedWeek.length ? `${nf(avg(weekend.map(item => item.food.kcal)) - avg(weekday.map(item => item.food.kcal)))} kcal` : '—', 'Weekend days compared with weekdays', '')

  // ---- macros ----
  const proteinAvg = avg(weekTotals.map(item => item.food.p))
  const proteinHits = weekTotals.filter(item => item.food.p >= targets.protein * 0.9).length
  add('Macros', 'protein', 'Protein average', loggedWeek.length ? `${nf(proteinAvg)} g` : '—', loggedWeek.length ? `${nf(proteinAvg / Math.max(1, profile.weightKg), 1)} g per kg · target ${nf(targets.protein)} g` : '', proteinAvg >= targets.protein * 0.9 ? 'good' : 'amber')
  add('Macros', 'protein-days', 'Days hitting protein', `${proteinHits}/${Math.max(1, loggedWeek.length)}`, 'Within 10% of your protein target', proteinHits >= loggedWeek.length * 0.7 ? 'good' : 'amber')
  const carbShare = avg(weekTotals.map(item => (item.food.c * 4) / Math.max(1, item.food.kcal)))
  const fatShare = avg(weekTotals.map(item => (item.food.f * 9) / Math.max(1, item.food.kcal)))
  add('Macros', 'carb-share', 'Carbohydrate share', `${nf(carbShare * 100)}%`, 'Of logged calories', carbShare > 0.65 ? 'amber' : '')
  add('Macros', 'fat-share', 'Fat share', `${nf(fatShare * 100)}%`, 'Of logged calories', fatShare > 0.4 ? 'amber' : '')
  const fibreAvg = avg(weekTotals.map(item => item.food.fib))
  add('Macros', 'fibre', 'Fibre average', loggedWeek.length ? `${nf(fibreAvg, 1)} g` : '—', `Target ${nf(targets.fiber)} g · gap ${nf(Math.max(0, targets.fiber - fibreAvg), 1)} g`, fibreAvg >= targets.fiber * 0.85 ? 'good' : 'amber')
  const sugarAvg = avg(weekTotals.map(item => item.food.sug))
  add('Macros', 'sugar', 'Sugar average', loggedWeek.length ? `${nf(sugarAvg, 1)} g` : '—', `Guide ${nf(targets.sugar)} g`, sugarAvg > targets.sugar ? 'amber' : 'good')
  add('Macros', 'protein-spread', 'Protein per meal', proteinPerMeal.length ? `${nf(Math.min(...proteinPerMeal))}–${nf(Math.max(...proteinPerMeal))} g` : '—', 'Even distribution supports muscle protein synthesis', proteinPerMeal.length && Math.max(...proteinPerMeal) > Math.min(...proteinPerMeal) * 2.5 ? 'amber' : 'good')
  add('Macros', 'protein-consistency', 'Protein consistency', proteinPerMeal.length > 1 ? `±${nf(sd(proteinPerMeal), 1)} g` : '—', 'Spread across meals rather than one big hit', '')
  add('Macros', 'micros', 'Micronutrient coverage', (() => {
    const keys = Object.keys(weekTotals[0]?.food.micros || {})
    if (!keys.length || !loggedWeek.length) return '—'
    const hit = keys.filter(key => avg(weekTotals.map(item => item.food.micros[key])) >= 60)
    return `${hit.length}/${keys.length}`
  })(), 'Nutrients at 60% or more of target on average', '')

  // ---- body ----
  add('Body', 'weight-trend', 'Weight trend', weights.length ? kg(trend) : '—', 'Per week over the last 14 days', weights.length && trend < 0 === (profile.goal === 'lose') ? 'good' : weights.length ? 'amber' : '')
  add('Body', 'weight-30', 'Weight change (30 days)', weights.length ? kg(weightChange(profile, 30)) : '—', 'From your weight log', '')
  add('Body', 'goal', 'Goal progress', `${nf(goalProgress(profile))}%`, `Start ${kg(profile.startWeightKg)} → now ${kg(profile.weightKg)} · goal ${kg(profile.goalWeightKg)}`, '')
  const projection = goalProjection(profile)
  add('Body', 'projection', 'Projected goal date', projection?.date ? prettyDate(projection.date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—', projection?.weeks ? `${nf(projection.weeks, 1)} weeks at the current rate` : 'Log weight to project', '')
  add('Body', 'bmi', 'BMI', `${nf(bmi(profile), 1)}`, bmiCategory(bmi(profile)), bmi(profile) >= 18.5 && bmi(profile) < 25 ? 'good' : 'amber')
  const fat = bodyFat(profile)
  add('Body', 'bodyfat', 'Body fat estimate', fat ? `${nf(fat, 1)}%` : '—', fat ? `Lean mass ${kg(leanBodyMass(profile))}` : 'Add waist, neck and hip measurements', '')
  const waist = profile.measurements.filter(item => item.waist).sort((a, b) => a.date.localeCompare(b.date))
  add('Body', 'waist', 'Waist change', waist.length > 1 ? `${nf(waist.at(-1).waist - waist[0].waist, 1)} cm` : '—', waist.length > 1 ? `Across ${waist.length} measurements` : 'Add a second waist measurement', waist.length > 1 && waist.at(-1).waist < waist[0].waist ? 'good' : '')
  const weekWater = loggedWeek.map(entry => entry.day.water || 0)
  add('Body', 'hydration-weight', 'Hydration vs weight', weekWater.length ? `${nf(avg(weekWater) / 1000, 1)} L` : '—', 'Daily water average this week', avg(weekWater) >= targets.water * 0.85 ? 'good' : 'amber')

  // ---- habits ----
  add('Habits', 'streak', 'Current streak', `${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`, `Best ${stats.bestStreak ?? stats.currentStreak} days`, stats.currentStreak > 0 ? 'good' : '')
  add('Habits', 'logged', 'Days logged (14)', `${logged(fortnight).length}/14`, 'A logged day beats a perfect one', logged(fortnight).length >= 10 ? 'good' : 'amber')
  const waterAvg = avg(weekWater)
  add('Habits', 'water', 'Water average', weekWater.length ? `${nf(waterAvg / 1000, 1)} L` : '—', `Target ${nf(targets.water / 1000, 1)} L · ${nf(Math.max(0, targets.water - waterAvg) / 1000, 1)} L short`, waterAvg >= targets.water * 0.85 ? 'good' : 'amber')
  const stepGoal = Number(profile.stepGoal) || 8000
  const stepsAvg = avg(loggedWeek.map(entry => entry.day.steps || 0).filter(Boolean))
  add('Habits', 'steps', 'Steps average', stepsAvg ? nf(stepsAvg) : '—', `Goal ${nf(stepGoal)} · ${stepsAvg >= stepGoal ? 'goal met' : 'below goal'}`, stepsAvg >= stepGoal ? 'good' : 'amber')
  const stepDistance = loggedWeek.reduce((sum, entry) => sum + movementForDay(entry.day, profile).distanceKm, 0)
  const stepCredit = loggedWeek.reduce((sum, entry) => sum + movementForDay(entry.day, profile).stepCreditKcal, 0)
  add('Movement', 'step-distance', 'Distance walked (7 days)', stepDistance ? `${nf(stepDistance, 1)} km` : '—', `${nf(stepDistance / 7, 1)} km a day at ${Math.round(strideMeters(profile) * 100)} cm stride`, stepDistance > 20 ? 'good' : '')
  add('Movement', 'step-credit', 'Calories from steps (7 days)', stepCredit ? nf(stepCredit) : '—', 'Active calories, net of resting metabolism', stepCredit > 700 ? 'good' : '')
  add('Movement', 'step-cadence', 'Walking pace assumed', `${stepCadence(profile)}/min`, 'Change it in Steps setup for a closer burn estimate', '')
  const sleepAvg = avg(loggedWeek.map(entry => entry.day.sleep || 0).filter(Boolean))
  add('Habits', 'sleep', 'Sleep average', sleepAvg ? `${nf(sleepAvg, 1)} h` : '—', sleepAvg && sleepAvg < 7 ? 'Under 7 h — hunger hormones shift' : 'Sleep logged alongside food', sleepAvg && sleepAvg < 7 ? 'amber' : '')
  const moodAvg = avg(loggedWeek.map(entry => entry.day.mood || 0).filter(Boolean))
  add('Habits', 'mood', 'Mood average', moodAvg ? `${nf(moodAvg, 1)}/5` : '—', 'Self-reported wellbeing', '')
  const exerciseMinutes = sum(fortnight.map(item => (item.day?.exercise || []).reduce((total, session) => total + session.minutes, 0)))
  add('Habits', 'exercise', 'Exercise (14 days)', `${nf(exerciseMinutes)} min`, `${nf(exerciseMinutes / 14)} min per day average`, exerciseMinutes >= 150 ? 'good' : 'amber')
  const caffeine = avg(loggedWeek.map(entry => entry.day.caffeine || 0).filter(Boolean))
  add('Habits', 'caffeine', 'Caffeine average', caffeine ? `${nf(caffeine, 1)} cups` : '—', caffeine > 4 ? 'Above the usual 400 mg guide' : 'Within a typical day', caffeine > 4 ? 'amber' : '')

  // ---- food & timing ----
  add('Food & timing', 'top-food', 'Most logged food', topFoods[0]?.[0] ?? '—', topFoods[0] ? `${topFoods[0][1]} entries in 30 days` : 'Log food to see patterns', '')
  add('Food & timing', 'variety', 'Variety', `${foodCounts.size} foods`, 'Distinct foods in the last 30 days', foodCounts.size >= 15 ? 'good' : 'amber')
  const worstMeal = Object.entries(mealMisses).sort((a, b) => b[1] - a[1])[0]
  add('Food & timing', 'missed-meal', 'Most missed meal', worstMeal ? worstMeal[0][0].toUpperCase() + worstMeal[0].slice(1) : '—', worstMeal ? `Skipped on ${worstMeal[1]} of ${loggedMonth.length} logged days` : '', '')
  add('Food & timing', 'dinner-share', 'Dinner share of calories', loggedMonth.length ? percent(dinnerShare) : '—', dinnerShare > 0.4 ? 'Heavy evening load' : 'Comfortably spread', dinnerShare > 0.4 ? 'amber' : 'good')
  add('Food & timing', 'density', 'Calorie density', density ? `${nf(density)} kcal/100 g` : '—', density > 250 ? 'Dense choices — add volume foods' : 'Good volume for the calories', density > 250 ? 'amber' : 'good')
  add('Food & timing', 'protein-source', 'Top protein source', proteinSources[0]?.[0] ?? '—', proteinSources[0] ? `${nf(proteinSources[0][1])} g total in 30 days` : '', '')
  add('Food & timing', 'cost', 'Food spend (30 days)', loggedMonth.length ? `₹${nf(sum(monthTotals.map(item => item.cost)))}` : '—', 'From entry costs, where filled in', '')
  add('Food & timing', 'meal-size', 'Average meal size', loggedMonth.length ? `${nf(avg(loggedMonth.map(entry => {
    const totals = dayTotals(profile, entry.day)
    const count = Object.values(totals.meals).reduce((total, meal) => total + meal.entries.length, 0)
    return count ? totals.food.kcal / count : 0
  }).filter(Boolean)))} kcal` : '—', 'Per logged entry', '')
  const lastWeek = windowDays(14).slice(0, 7)
  const lastWeekLogged = logged(lastWeek)
  const lastWeekTotals = lastWeekLogged.map(entry => dayTotals(profile, entry.day))
  add('Energy', 'recap', 'This week vs last', loggedWeek.length && lastWeekLogged.length ? `${nf(avgIntake - avg(lastWeekTotals.map(item => item.food.kcal)))} kcal` : '—', 'Average intake, last 7 days against the 7 before', '')
  add('Energy', 'over-days', 'Days over target', `${weekTotals.filter(item => item.food.kcal > targets.kcal).length}/${Math.max(1, loggedWeek.length)}`, 'This week', weekTotals.filter(item => item.food.kcal > targets.kcal).length > loggedWeek.length / 2 ? 'amber' : 'good')
  add('Energy', 'under-days', 'Days under 1,200 kcal', `${weekTotals.filter(item => item.food.kcal > 0 && item.food.kcal < 1200).length}`, 'Very low days can cost muscle and energy', weekTotals.filter(item => item.food.kcal > 0 && item.food.kcal < 1200).length > 1 ? 'amber' : 'good')
  add('Energy', 'adherence', 'Days within 10% of target', `${weekTotals.filter(item => Math.abs(item.food.kcal - targets.kcal) <= targets.kcal * 0.1).length}/${Math.max(1, loggedWeek.length)}`, 'The steadiest days are the ones that count', '')
  add('Energy', 'surplus', 'Surplus days', `${weekTotals.filter(item => item.food.kcal > targets.kcal + 150).length}`, 'More than 150 kcal over target', '')
  add('Macros', 'breakfast-protein', 'Protein at breakfast', `${loggedWeek.filter(entry => dayTotals(profile, entry.day).meals.breakfast.totals.p >= 20).length}/${Math.max(1, loggedWeek.length)}`, 'Days with 20 g or more before noon', '')
  add('Macros', 'fibre-density', 'Fibre per 1,000 kcal', loggedWeek.length ? `${nf(fibreAvg / Math.max(1, avgIntake) * 1000, 1)} g` : '—', 'Target 14 g — the single best diet-quality marker', fibreAvg / Math.max(1, avgIntake) * 1000 >= 12 ? 'good' : 'amber')
  add('Macros', 'sugar-share', 'Sugar share of calories', loggedWeek.length ? `${nf(avg(weekTotals.map(item => item.food.sug * 4 / Math.max(1, item.food.kcal))) * 100)}%` : '—', 'Added and free sugars add up fast', '')
  add('Macros', 'sodium', 'Sodium average', loggedWeek.length ? `${nf(avg(weekTotals.map(item => item.food.na)))} mg` : '—', `Guide ${nf(targets.sodium)} mg`, avg(weekTotals.map(item => item.food.na)) > targets.sodium ? 'amber' : 'good')
  add('Macros', 'sodium-days', 'High-sodium days', `${weekTotals.filter(item => item.food.na > targets.sodium).length}`, 'Days above the sodium guide', '')
  add('Food & timing', 'meal-rate', 'Best-logged meal', (() => {
    const order = Object.entries(mealMisses).sort((a, b) => a[1] - b[1])[0]
    return order ? order[0][0].toUpperCase() + order[0].slice(1) : '—'
  })(), 'The meal you almost never skip', 'good')
  add('Food & timing', 'snack-share', 'Snack share', loggedWeek.length ? percent(avg(loggedWeek.map(entry => {
    const totals = dayTotals(profile, entry.day)
    return totals.food.kcal > 0 ? totals.meals.snacks.totals.kcal / totals.food.kcal : 0
  }))) : '—', 'Of daily calories', '')
  add('Food & timing', 'breakfast-share', 'Breakfast share', loggedWeek.length ? percent(avg(loggedWeek.map(entry => {
    const totals = dayTotals(profile, entry.day)
    return totals.food.kcal > 0 ? totals.meals.breakfast.totals.kcal / totals.food.kcal : 0
  }))) : '—', 'Of daily calories', '')
  add('Food & timing', 'entries', 'Entries per day', loggedWeek.length ? `${nf(avg(loggedWeek.map(entry => Object.values(entry.day.meals).reduce((total, list) => total + list.length, 0))), 1)}` : '—', 'Logged foods per day', '')
  add('Food & timing', 'favourite-share', 'Favourite share', (() => {
    if (!entries.length) return '—'
    const favourites = entries.filter(entry => (profile.favorites || []).includes(entry.foodId)).length
    return percent(favourites / entries.length)
  })(), 'Entries that are saved favourites', '')
  add('Habits', 'water-days', 'Days hitting water', `${loggedWeek.filter(entry => (entry.day.water || 0) >= targets.water * 0.9).length}/${Math.max(1, loggedWeek.length)}`, 'Within 10% of the water target', '')
  add('Habits', 'step-days', 'Days hitting step goal', `${loggedWeek.filter(entry => (entry.day.steps || 0) >= stepGoal).length}/${Math.max(1, loggedWeek.length)}`, `Goal ${nf(stepGoal)} steps`, '')
  add('Habits', 'sleep-days', 'Days with 7 h sleep', `${loggedWeek.filter(entry => (entry.day.sleep || 0) >= 7).length}/${Math.max(1, loggedWeek.length)}`, 'Sleep logged alongside food', '')
  add('Habits', 'exercise-days', 'Training days (14)', `${fortnight.filter(entry => (entry.day?.exercise || []).length).length}`, 'Any logged session counts', '')
  add('Habits', 'weigh-gap', 'Days since weigh-in', weights.length ? `${Math.max(0, Math.round((new Date(`${todayKey()}T12:00`) - new Date(`${weights.at(-1).date}T12:00`)) / 86_400_000))}` : '—', weights.length ? `Last entry ${prettyDate(weights.at(-1).date, { day: 'numeric', month: 'short' })}` : 'Log a weight to start a trend', weights.length ? '' : 'amber')
  add('Habits', 'measure-gap', 'Days since measurements', profile.measurements.length ? `${Math.max(0, Math.round((new Date(`${todayKey()}T12:00`) - new Date(`${[...profile.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1).date}T12:00`)) / 86_400_000))}` : '—', 'Waist and hip trends beat the scale', '')
  add('Habits', 'log-gap', 'Days since last log', loggedMonth.length ? `${Math.max(0, Math.round((new Date(`${todayKey()}T12:00`) - new Date(`${loggedMonth.at(-1).date}T12:00`)) / 86_400_000))}` : '—', 'A short gap is normal — a long one hides the trend', '')

  return rows
}

export const INSIGHT_GROUPS = ['Energy', 'Macros', 'Body', 'Habits', 'Food & timing']
