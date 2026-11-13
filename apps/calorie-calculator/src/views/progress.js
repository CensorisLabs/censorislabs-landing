import {
  getProfile,
  getDay,
  getTotals,
  update,
  addDays,
  todayKey,
  prettyDate,
  dateSeries,
  profileStats,
  state,
  MEALS,
} from '../lib/store.js'
import {
  targetsFor,
  dayTotals,
  scoreDay,
  rangeAvg,
  bmi,
  bmiCategory,
  bodyFat,
  leanBodyMass,
  healthyWeightRange,
  idealWeight,
  waistHeightRatio,
  bmr,
  tdee,
  goalProjection,
  goalProgress,
  weightChange,
  formatWeight,
  percent,
  round,
  MICRO_TARGETS,
  netCarbs,
} from '../lib/calc.js'
import { ACHIEVEMENTS } from '../data/achievements.js'
import {
  icon,
  fmt,
  esc,
  bar,
  barChart,
  lineChart,
  heatmap,
  statBlock,
  emptyState,
  toast,
  ring,
  sectionHeading,
} from '../lib/ui.js'
import { average, movingAverageWeight, weightRate, plateauDetected } from '../lib/lab.js'
import { on, refresh, ui, go, goProgress } from '../lib/runtime.js'
import {
  openWeightLog,
  openMeasurementLog,
  openStepsLog,
  openTargetsEditor,
  openProfileEditor,
  openReport,
  openFasting,
  openStepSettings,
} from '../lib/dialogs-app.js'
import { movementForDay, strideMeters } from '../lib/movement.js'
import { exportCsv } from '../lib/export.js'

function weightTab(profile) {
  const current = Number(profile.weightKg)
  const weights = [...profile.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-90)
  const points = weights.map(item => ({ label: prettyDate(item.date, { day: 'numeric', month: 'short' }), value: item.kg }))
  const change30 = weightChange(profile, 30)
  const changeAll = round(current - Number(profile.startWeightKg), 1)
  const bf = bodyFat(profile)
  const measurement = [...profile.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const projection = goalProjection(profile)
  const bmiValue = bmi(profile)
  const bmiTone = bmiCategory(bmiValue)
  const range = healthyWeightRange(profile)
  const whtr = waistHeightRatio(profile)
  const progress = goalProgress(profile)
  const smooth = movingAverageWeight(profile)
  const rate = weightRate(profile)
  const plateau = plateauDetected(profile)

  return `<div class="kc-progress-weight">
    <section class="kc-card kc-weight-hero">
      <div class="kc-weight-hero__main">
        <div><p class="kc-eyebrow">CURRENT WEIGHT</p><h2>${formatWeight(current, state.settings.units)}</h2><p>${changeAll === 0 ? 'No change since you started' : `${changeAll > 0 ? '+' : ''}${changeAll} kg since you started`} · ${change30 === 0 ? 'steady over 30 days' : `${change30 > 0 ? '+' : ''}${change30} kg in 30 days`}</p></div>
        <div class="kc-weight-hero__actions"><button type="button" class="kc-btn" data-action="progress:weight">${icon('scale')} Log weight</button><button type="button" class="kc-btn kc-btn--ghost" data-action="progress:measure">${icon('edit')} Measurements</button></div>
      </div>
      <div class="kc-goal-line"><span>Start ${formatWeight(profile.startWeightKg, state.settings.units)}</span><div class="kc-goal-track"><i style="width:${progress}%"></i></div><span>Goal ${formatWeight(profile.goalWeightKg, state.settings.units)}</span></div>
      <p class="kc-meta">${progress}% of the way from your start weight to your goal. ${projection ? `At ${profile.rate} kg/week, the goal date is about ${projection.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (${projection.weeks} weeks).` : 'Set a goal weight and pace to see a projection.'}</p>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">TREND</p><h3>Weight over time</h3><p>${weights.length} weigh-in${weights.length === 1 ? '' : 's'} · goal line shown</p></div><button type="button" class="kc-text-btn" data-action="progress:weight">${icon('plus')} Add</button></div>
      ${points.length ? lineChart(points, { height: 220, tone: 'water', target: Number(profile.goalWeightKg) }) : emptyState('scale', 'No weigh-ins yet', 'Log your first weight to start a trend. One reading is a data point, not a verdict.', '<button type="button" class="kc-btn kc-btn--soft" data-action="progress:weight">Log weight</button>')}
      <div class="kc-weight-history">${weights.slice(-6).reverse().map(item => `<div class="kc-weight-history__row"><span>${esc(prettyDate(item.date))}</span><b>${formatWeight(item.kg, state.settings.units)}</b><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="progress:weight-delete" data-date="${esc(item.date)}" aria-label="Delete weigh-in from ${esc(item.date)}">${icon('close')}</button></div>`).join('')}</div>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">SMOOTHED TREND</p><h3>${smooth ? `${formatWeight(smooth, state.settings.units)} 7-day average` : 'Not enough weigh-ins yet'}</h3><p>Daily weight swings with water and salt. The average is the signal.</p></div></div>
      <div class="kc-stat-grid">
        ${statBlock('7-day average', smooth ? formatWeight(smooth, state.settings.units) : '—', 'Smoothed reading')}
        ${statBlock('Weekly rate', rate == null ? '—' : `${rate > 0 ? '+' : ''}${rate} kg`, rate == null ? 'Needs two weigh-ins' : rate < 0 ? 'Losing' : rate > 0 ? 'Gaining' : 'Steady')}
        ${statBlock('Plateau watch', weights.length < 3 ? '—' : plateau.plateau ? 'Stalled' : 'Moving', weights.length < 3 ? 'Needs 3 weigh-ins' : plateau.plateau ? '3-week check' : 'Trend is changing')}
      </div>
      <p class="kc-meta">${esc(plateau.detail)}</p>
    </section>
    <div class="kc-stat-grid">
      ${statBlock('BMI', `${bmiValue}`, bmiTone.label, bmiTone.tone === 'good' ? 'good' : bmiTone.tone === 'bad' ? 'bad' : 'amber')}
      ${statBlock('Body fat', `${bf.value}%`, bf.method)}
      ${statBlock('Lean mass', `${leanBodyMass(profile)} kg`, 'Estimated')}
      ${statBlock('BMR', `${fmt(bmr(profile))} kcal`, 'At complete rest')}
      ${statBlock('TDEE', `${fmt(tdee(profile))} kcal`, 'Maintenance estimate')}
      ${statBlock('Ideal weight', `${idealWeight(profile)} kg`, 'BMI 22')}
      ${statBlock('Healthy range', `${range.min}–${range.max} kg`, 'BMI 18.5–24.9')}
      ${statBlock('Waist : height', whtr ? whtr.toFixed(2) : '—', whtr ? (whtr < 0.5 ? 'Below 0.50' : 'Above 0.50') : 'Add a waist measurement')}
    </div>
    <div class="kc-two-col">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">BODY MEASUREMENTS</p><h3>${measurement ? prettyDate(measurement.date) : 'No measurements yet'}</h3><p>${measurement ? `Waist ${measurement.waist || '—'} cm · Hips ${measurement.hips || '—'} cm · Neck ${measurement.neck || '—'} cm` : 'Tape measurements add context when the scale stalls.'}</p></div><button type="button" class="kc-text-btn" data-action="progress:measure">${icon('edit')} Update</button></div>
        <div class="kc-measure-grid">${[['waist', 'Waist'], ['hips', 'Hips'], ['neck', 'Neck'], ['chest', 'Chest'], ['arms', 'Arms'], ['thighs', 'Thigh']].map(([key, label]) => `<div><span>${label}</span><b>${measurement?.[key] ? `${measurement[key]} cm` : '—'}</b></div>`).join('')}</div>
        <p class="kc-meta">The Navy estimate uses waist, neck and (for women) hips. It is a screening estimate, not a DEXA scan.</p>
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">YOUR PLAN</p><h3>Targets at a glance</h3><p>Calculated from your profile and activity.</p></div><button type="button" class="kc-text-btn" data-action="progress:targets">${icon('edit')} Edit</button></div>
        <div class="kc-target-list">${[['Calories', `${fmt(targetsFor(profile).kcal)} kcal`], ['Protein', `${fmt(targetsFor(profile).protein)} g`], ['Carbs', `${fmt(targetsFor(profile).carbs)} g`], ['Fat', `${fmt(targetsFor(profile).fat)} g`], ['Fibre', `${fmt(targetsFor(profile).fiber)} g`], ['Water', `${fmt(targetsFor(profile).water)} ml`]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
        <div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="progress:profile">${icon('users')} Edit profile</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="progress:fast">${icon('clock')} Fasting</button></div>
      </section>
    </div>
  </div>`
}

function nutritionTab(profile) {
  const range = ui.progressRange
  const dates = dateSeries(ui.date, range)
  const rows = dates.map(date => {
    const day = getDay(date, false)
    const totals = dayTotals(profile, day)
    return { date, day, totals, score: scoreDay(profile, day).score }
  })
  const logged = rows.filter(row => row.totals.food.kcal > 0)
  const averages = {
    kcal: rangeAvg(logged.map(row => row.totals.food.kcal)),
    p: rangeAvg(logged.map(row => row.totals.food.p)),
    c: rangeAvg(logged.map(row => row.totals.food.c)),
    f: rangeAvg(logged.map(row => row.totals.food.f)),
    fib: rangeAvg(logged.map(row => row.totals.food.fib)),
    water: rangeAvg(rows.map(row => row.day?.water || 0)),
    steps: rangeAvg(rows.map(row => row.day?.steps || 0)),
    score: rangeAvg(logged.map(row => row.score)),
  }
  const targets = targetsFor(profile)
  const totalKcal = logged.reduce((sum, row) => sum + row.totals.food.kcal, 0)
  const avgPct = percent(averages.kcal, targets.kcal)
  const calorieItems = rows.map(row => ({ label: prettyDate(row.date, { weekday: 'long', day: 'numeric', month: 'short' }), short: prettyDate(row.date, { weekday: 'narrow' }), value: row.totals.food.kcal }))
  const microDays = logged.filter(row => (row.totals.food.microsKnownEntries || 0) > 0)
  const microAverages = MICRO_TARGETS.map(micro => ({ ...micro, value: rangeAvg(microDays.map(row => row.totals.food.micros[micro.key] || 0)) }))
  const heat = dateSeries(ui.date, 112).map(date => {
    const day = getDay(date, false)
    const totals = dayTotals(profile, day)
    const score = scoreDay(profile, day).score
    const has = MEALS.some(meal => (day.meals?.[meal.id] || []).length) || (day.water || 0) > 0
    const level = !has ? 0 : score >= 85 ? 4 : score >= 65 ? 3 : totals.food.kcal > 0 ? 2 : 1
    return { level, label: `${prettyDate(date)} · ${fmt(totals.food.kcal)} kcal · score ${score}` }
  })
  const best = [...logged].sort((a, b) => b.score - a.score)[0]
  const hydrationDays = rows.filter(row => (row.day?.water || 0) >= targetsFor(profile).water).length
  const proteinDays = logged.filter(row => row.totals.food.p >= targets.protein).length
  const stepDays = dateSeries(ui.date, 14).map(date => {
    const day = getDay(date, false)
    return { date, movement: movementForDay(day, profile) }
  })
  const stepItems = stepDays.map(entry => ({ label: prettyDate(entry.date, { day: 'numeric', month: 'short' }), short: prettyDate(entry.date, { day: 'numeric' }), value: entry.movement.steps }))
  const stepLogged = stepDays.filter(entry => entry.movement.steps > 0)
  const stepTotal = stepLogged.reduce((sum, entry) => sum + entry.movement.steps, 0)
  const stepAvg = stepLogged.length ? Math.round(stepTotal / stepLogged.length) : 0
  const stepBest = stepLogged.reduce((max, entry) => Math.max(max, entry.movement.steps), 0)
  const stepDistance = stepLogged.reduce((sum, entry) => sum + entry.movement.distanceKm, 0)
  const stepCredit = stepLogged.reduce((sum, entry) => sum + entry.movement.stepCreditKcal, 0)
  const stepGoal = Number(profile.stepGoal) || 8000

  return `<div class="kc-progress-nutrition">
    <div class="kc-range-row"><div><p class="kc-eyebrow">NUTRITION</p><h2>${range}-day view</h2><p>${logged.length} logged day${logged.length === 1 ? '' : 's'} · ${fmt(totalKcal)} kcal recorded</p></div><div class="kc-range-buttons">${[7, 14, 30].map(days => `<button type="button" class="kc-chip ${range === days ? 'is-active' : ''}" data-action="progress:range" data-days="${days}">${days} days</button>`).join('')}</div></div>
    <div class="kc-stat-grid kc-stat-grid--four">
      ${statBlock('Average intake', `${fmt(averages.kcal)} kcal`, `${avgPct}% of target`)}
      ${statBlock('Average protein', `${fmt(averages.p, 0)} g`, `${proteinDays} days on target`)}
      ${statBlock('Average water', `${fmt(averages.water)} ml`, `${hydrationDays} goal days`)}
      ${statBlock('Average score', `${fmt(averages.score)}/100`, logged.length ? 'Across logged days' : 'No logs')}
    </div>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">CALORIES</p><h3>Daily intake</h3><p>Bars above the line are over target; empty days are not logged.</p></div><button type="button" class="kc-text-btn" data-action="progress:export">${icon('download')} CSV</button></div>
      ${barChart(calorieItems, { target: targets.kcal, height: 170 })}
      <div class="kc-chart-legend"><span><i class="kc-legend-dot"></i> Intake</span><span><i class="kc-legend-line"></i> ${fmt(targets.kcal)} kcal target</span></div>
    </section>
    <div class="kc-two-col">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">MACROS</p><h3>Average vs target</h3><p>Protein, carbs and fat across logged days.</p></div></div>
        <div class="kc-macro-average">${[['Protein', averages.p, targets.protein, 'protein'], ['Carbs', averages.c, targets.carbs, 'carb'], ['Fat', averages.f, targets.fat, 'fat'], ['Fibre', averages.fib, targets.fiber, 'fibre']].map(([label, value, target, tone]) => `<div class="kc-macro-average__row"><div><span>${label}</span><b>${fmt(value, 0)} / ${fmt(target)} g</b></div>${bar(value, target, tone)}<small>${percent(value, target)}%</small></div>`).join('')}</div>
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">MICRONUTRIENTS</p><h3>Average coverage</h3><p>Where the logged food lands against a daily guide.</p></div></div>
        ${microDays.length ? `<div class="kc-micro-list">${microAverages.map(micro => `<div class="kc-micro-row"><span>${esc(micro.label)}</span>${bar(micro.value, micro.target, 'fibre')}<b>${fmt(micro.value, micro.value < 10 ? 1 : 0)} ${micro.unit}</b></div>`).join('')}</div>` : '<p class="kc-muted">No logged day has micronutrient data, so no average is shown.</p>'}
        <p class="kc-meta">${microDays.length ? `Based on ${microDays.length} of ${logged.length} logged day${logged.length === 1 ? '' : 's'} with micronutrient data.` : 'Branded, quick-add and imported entries often omit micronutrients.'}</p>
      </section>
    </div>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">CONSISTENCY</p><h3>The last 16 weeks</h3><p>Every square is a day. Darker means a more complete day.</p></div><div class="kc-heat-legend"><span>Less</span><i class="kc-heat kc-heat--1"></i><i class="kc-heat kc-heat--2"></i><i class="kc-heat kc-heat--3"></i><i class="kc-heat kc-heat--4"></i><span>More</span></div></div>
      ${heatmap(heat, { weeks: 16 })}
      <div class="kc-heat-footer"><span>${best ? `Best day: ${prettyDate(best.date)} · ${best.score}/100` : 'Log a day to start the map.'}</span><span>${hydrationDays} hydration goal days · ${fmt(averages.steps)} average steps</span></div>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">WATER HISTORY</p><h3>Weekly hydration</h3><p>Last 7 days of logged water against your guide.</p></div></div>
      <div class="kc-two-col">
        ${dateSeries(ui.date, 7).map(date => {
          const day = getDay(date, false)
          const totals = dayTotals(profile, day)
          return `<div class="kc-water-row"><div><span>${prettyDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>${fmt(day.water || 0)}</b><small>/ ${fmt(totals.targets.water)} ml</small></div>${bar(day.water || 0, totals.targets.water, 'water')}${day.water >= totals.targets.water ? '<span class="kc-pill kc-pill--good">Goal</span>' : ''}</div>`
        }).join('')}
      </div>
      <p class="kc-meta">Water carries over from the previous day when you are under the guide, so a small morning deficit is normal.</p>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">MOVEMENT</p><h3>Steps, last 14 days</h3><p>${stepTotal ? `${fmt(stepTotal)} steps · ${fmt(stepDistance, 1)} km across ${stepLogged.length} day${stepLogged.length === 1 ? '' : 's'}` : 'No steps logged yet'}</p></div><button type="button" class="kc-text-btn" data-action="progress:step-settings">${icon('settings')} Steps setup</button><button type="button" class="kc-text-btn" data-action="progress:steps">${icon('footsteps')} Log steps</button></div>
      ${stepTotal ? barChart(stepItems, { target: stepGoal, height: 150 }) : emptyState('footsteps', 'No step history', 'Log steps on Today, or sync the device step counter if the Android build is installed.', '<button type="button" class="kc-btn kc-btn--soft" data-action="progress:steps">Log steps</button>')}
      <div class="kc-stat-grid kc-stat-grid--four">
        ${statBlock('Average steps', fmt(stepAvg), 'On logged days')}
        ${statBlock('Best day', fmt(stepBest), 'Single day')}
        ${statBlock('Distance (14 days)', `${round(stepDistance, 1)} km`, `${round(strideMeters(profile) * 100)} cm stride`)}
        ${statBlock('Step credit', `${fmt(stepCredit)} kcal`, 'Active burn, net of resting')}
      </div>
      <div class="kc-chart-legend"><span><i class="kc-legend-dot"></i> Steps</span><span><i class="kc-legend-line"></i> ${fmt(stepGoal)} step goal</span></div>
      <p class="kc-meta">${fmt(stepGoal)} steps is your current goal, not a prescription. Step credit counts in your daily budget unless you turn it off, and steps already inside a logged walk or run are not counted twice.</p>
    </section>
    <section class="kc-card kc-quality-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">DIET QUALITY</p><h3>Today's quality score</h3><p>Protein, fibre, micronutrient coverage, sugar, sodium and variety.</p></div></div>
      <div class="kc-diet-quality">
        <div class="kc-diet-quality__hero">${dietQuality().score}<small>/100</small></div>
        <div class="kc-diet-quality__grade">${esc(dietQuality().grade)}</div>
        <div class="kc-diet-quality__parts">${dietQuality().parts.map(([label, value, max]) => `<div><span>${label}</span>${bar(value, max, 'bronze')}<small>${Math.round(value)}/${max}</small></div>`).join('')}</div>
      </div>
      <p class="kc-meta">This is a teaching composite, not a verdict. Use the lowest part as your next small step.</p>
    </section>
    <div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--soft" data-action="progress:report">${icon('print')} Daily report</button><button type="button" class="kc-btn kc-btn--ghost" data-action="progress:export">${icon('download')} Export 90-day CSV</button></div>
  </div>`
}

function achievementsTab(profile) {
  const stats = profileStats(profile.id)
  const unlocked = ACHIEVEMENTS.filter(item => profile.achievements[item.id])
  const percentDone = Math.round(unlocked.length / ACHIEVEMENTS.length * 100)
  return `<div class="kc-progress-achievements">
    <section class="kc-card kc-achievement-hero">
      <div>${ring(percentDone, `<strong>${unlocked.length}</strong><small>of ${ACHIEVEMENTS.length}</small>`, { size: 150, thickness: 12, tone: 'bronze' })}</div>
      <div class="kc-achievement-hero__copy"><p class="kc-eyebrow">MILESTONES</p><h2>${percentDone}% of the badges</h2><p>Badges reward consistency, not perfection. Keep the streak gentle and repeatable.</p><div class="kc-achievement-stats">${statBlock('Current streak', `${stats.currentStreak} days`)}${statBlock('Best streak', `${stats.bestStreak} days`)}${statBlock('Logged days', `${stats.loggedDays}`)}${statBlock('Exercise', `${fmt(stats.exerciseMinutes)} min`)}</div></div>
    </section>
    <div class="kc-badge-grid">${ACHIEVEMENTS.map(item => {
      const when = profile.achievements[item.id]
      return `<div class="kc-badge ${when ? 'is-unlocked' : ''}"><span class="kc-badge__icon">${icon(item.icon)}</span><div><b>${esc(item.name)}</b><small>${esc(item.desc)}</small><em>${when ? `Unlocked ${prettyDate(new Date(when).toISOString().slice(0, 10))}` : 'Locked'}</em></div></div>`
    }).join('')}</div>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">AT A GLANCE</p><h3>Your tracking footprint</h3><p>Everything here is calculated from local entries.</p></div></div>
      <div class="kc-stat-grid kc-stat-grid--four">${statBlock('Food entries', fmt(stats.totalEntries))}${statBlock('Distinct foods', fmt(stats.distinctFoods))}${statBlock('Water goal days', fmt(stats.waterGoalDays))}${statBlock('Protein goal days', fmt(stats.proteinGoalDays))}${statBlock('Perfect days', fmt(stats.perfectDays))}${statBlock('Notes', fmt(stats.notesDays))}${statBlock('Fasts completed', fmt(stats.completedFasts))}${statBlock('Recipes created', fmt(stats.customRecipeCount))}</div>
    </section>
  </div>`
}

export function renderProgress(root) {
  const profile = getProfile()
  const tab = ui.progressTab
  root.innerHTML = `<div class="kc-view kc-progress">
    <div class="kc-page-head"><div><p class="kc-eyebrow">PROGRESS</p><h1>${tab === 'weight' ? 'Body trend' : tab === 'nutrition' ? 'Nutrition trend' : 'Milestones'}</h1><p>${esc(profile.name)} · ${formatWeight(profile.weightKg, state.settings.units)} · goal ${formatWeight(profile.goalWeightKg, state.settings.units)}</p></div><div class="kc-page-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="progress:profile">${icon('users')} Profile</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="progress:targets">${icon('target')} Targets</button></div></div>
    <div class="kc-tabbar">${[['weight', 'Weight'], ['nutrition', 'Nutrition'], ['achievements', 'Achievements']].map(([id, label]) => `<button type="button" class="kc-tab ${tab === id ? 'is-active' : ''}" data-action="progress:tab" data-tab="${id}">${label}</button>`).join('')}</div>
    ${tab === 'weight' ? weightTab(profile) : tab === 'nutrition' ? nutritionTab(profile) : achievementsTab(profile)}
  </div>`
}

function dietQuality() {
  const profile = getProfile()
  const day = getDay(ui.date, false)
  const totals = dayTotals(profile, day)
  const targets = targetsFor(profile)
  if (!totals.food.kcal) return { score: 0, grade: 'No data', parts: [['Protein', 0, 25], ['Fibre', 0, 20], ['Micronutrients', 0, 20], ['Sugar', 0, 15], ['Sodium', 0, 10], ['Variety', 0, 10]] }
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

on('progress:tab', element => { ui.progressTab = element.dataset.tab; refresh() })
on('progress:range', element => { ui.progressRange = Number(element.dataset.days) || 7; refresh() })
on('progress:weight', () => openWeightLog({ date: todayKey() }))
on('progress:steps', () => openStepsLog({ date: todayKey() }))
on('progress:step-settings', () => openStepSettings())
on('progress:measure', () => openMeasurementLog({ date: todayKey() }))
on('progress:targets', () => openTargetsEditor())
on('progress:profile', () => openProfileEditor())
on('progress:report', () => openReport(ui.date))
on('progress:fast', () => openFasting())
on('progress:export', () => {
  const rows = exportCsv(90)
  toast(`${fmt(rows)} diary rows exported`)
})
on('progress:weight-delete', element => {
  const date = element.dataset.date
  update(() => {
    const target = getProfile()
    target.weights = target.weights.filter(item => item.date !== date)
    const latest = [...target.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    if (latest) target.weightKg = latest.kg
  }, { label: 'Delete weigh-in' })
  toast('Weigh-in removed')
})
