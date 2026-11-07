import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GLUCOSE_RANGE, bpCategory, bodyFatChange, cadencePerMinute, caloriePacing, compareToPrevious,
  dayCompleteness, dayKeys, daysSinceLast, fastingSummary, glucoseStats, labSeries, loggingHeatmap,
  macroRemaining, medicationAdherence, parseBp, rankFoods, sleepConsistency, stepGoalStreak,
  storageUsage, symptomFrequency, weekOverWeek, weekdayPattern, weeklyActiveMinutes, weightGoalProgress,
  daySummaryText,
} from '../src/health-tools.js'

const TODAY = '2026-11-07'
const mealsOn = (dates, kcal = 500) => dates.map((date, index) => ({ id: `m${index}`, date, grams: 100, slot: 'Lunch', name: 'Dal', nutrients: { kcal } }))

test('calorie pacing compares against the waking window, not a full 24 hours', () => {
  const morning = caloriePacing({ kcal: 0, target: 2000, now: new Date('2026-11-07T06:30:00') })
  assert.equal(morning.status, 'onPace', 'almost nothing expected at 6:30')
  const evening = caloriePacing({ kcal: 300, target: 2000, now: new Date('2026-11-07T20:00:00') })
  assert.equal(evening.status, 'behind')
  assert.ok(evening.difference < 0)
  const over = caloriePacing({ kcal: 2600, target: 2000, now: new Date('2026-11-07T21:00:00') })
  assert.equal(over.status, 'ahead')
  assert.equal(caloriePacing({ kcal: 0, target: 0 }), null)
})

test('macro remaining never hides an overshoot', () => {
  const left = macroRemaining({ protein: 120, carbs: 40, fat: 90 }, { protein: 100, carbs: 250, fat: 70 })
  assert.deepEqual(left, { protein: -20, carbs: 210, fat: -20 })
  assert.equal(macroRemaining({}, null), null)
})

test('day completeness lists what is still missing', () => {
  const state = {
    meals: [{ date: TODAY }], water: [{ date: TODAY }], sleeps: [], activities: [{ date: TODAY }], weights: [], moods: [],
  }
  const result = dayCompleteness(state, TODAY)
  assert.equal(result.done, 3)
  assert.equal(result.total, 6)
  assert.deepEqual(result.missing, ['Sleep', 'Weight', 'Check-in'])
})

test('comparisons and helpers handle missing history', () => {
  assert.equal(compareToPrevious(2000, null), null)
  assert.deepEqual(compareToPrevious(2000, 1800).difference, 200)
  assert.equal(cadencePerMinute(0, 0), null)
  assert.equal(cadencePerMinute(1200, 15), 80)
})

test('rankFoods scores per 100 kcal and sorts best first', () => {
  const foods = [
    { name: 'Oats', kcal: 380, p: 13, fi: 10, su: 1 },
    { name: 'Sugar', kcal: 400, p: 0, fi: 0, su: 100 },
    { name: 'Curd', kcal: 60, p: 3.5, fi: 0, su: 3 },
  ]
  assert.equal(rankFoods(foods, 'protein')[0].name, 'Curd')
  assert.equal(rankFoods(foods, 'fiber')[0].name, 'Oats')
  assert.equal(rankFoods(foods, 'lowSugar')[0].name, 'Oats')
  assert.equal(rankFoods([{ name: 'Air', kcal: 0 }], 'protein').length, 0)
})

test('blood pressure parsing rejects impossible input and labels the reading', () => {
  assert.equal(parseBp('120'), null)
  assert.equal(parseBp('500/20'), null)
  assert.deepEqual(parseBp('118 / 76'), { systolic: 118, diastolic: 76 })
  assert.equal(bpCategory('118/76').tone, 'good')
  assert.equal(bpCategory('135/86').label, 'Above the usual range')
  assert.equal(bpCategory('150/95').tone, 'alert')
  assert.equal(bpCategory('85/55').label, 'Low reading')
  assert.equal(bpCategory('nonsense'), null)
})

test('glucose stats count readings in and out of the reference band', () => {
  const entries = [
    { date: TODAY, value: 4.5 }, { date: TODAY, value: 8.2 }, { date: '2026-11-06', value: 3.2 },
    { date: '2026-10-01', value: 9.9 },
  ]
  const stats = glucoseStats(entries, TODAY, 7)
  assert.equal(stats.count, 3)
  assert.equal(stats.high, 1)
  assert.equal(stats.low, 1)
  assert.equal(stats.inRange, 1)
  assert.equal(stats.average, 5.3)
  assert.deepEqual(glucoseStats([], TODAY, 7), { count: 0, average: null, low: 0, high: 0, inRange: 0 })
  assert.ok(GLUCOSE_RANGE.high > GLUCOSE_RANGE.low)
})

test('sleep consistency handles bedtimes across midnight', () => {
  const sleeps = [
    { date: TODAY, bed: '23:30' }, { date: '2026-11-06', bed: '23:45' }, { date: '2026-11-05', bed: '00:10' },
  ]
  const result = sleepConsistency(sleeps, TODAY, 14)
  assert.equal(result.nights, 3)
  assert.equal(result.spreadMin, 40, '00:10 is 10 minutes after midnight, not 23h from 23:30')
  assert.equal(sleepConsistency([{ date: TODAY, bed: '23:00' }], TODAY).spreadMin, null)
})

test('symptom frequency ranks repeats inside the window only', () => {
  const symptoms = [
    { date: TODAY, name: 'Headache' }, { date: '2026-11-05', name: 'Headache' },
    { date: '2026-11-04', name: 'Cramp' }, { date: '2026-08-01', name: 'Headache' },
  ]
  const ranked = symptomFrequency(symptoms, TODAY, 30)
  assert.deepEqual(ranked[0], { name: 'Headache', count: 2 })
  assert.equal(ranked.length, 2)
})

test('medication adherence counts reminders against logged days', () => {
  const supplements = [{ id: 'a' }, { id: 'b' }]
  const logs = [{ itemId: 'a', date: TODAY }, { itemId: 'a', date: '2026-11-06' }]
  const result = medicationAdherence(supplements, logs, TODAY, 2)
  assert.deepEqual(result, { taken: 2, expected: 4, percent: 50 })
  assert.equal(medicationAdherence([], [], TODAY).percent, null)
})

test('fasting summary keeps finished fasts only', () => {
  const sessions = [
    { date: '2026-11-06', endAt: '2026-11-06T10:00:00Z', minutes: 960 },
    { date: '2026-11-05', endAt: '2026-11-05T10:00:00Z', minutes: 720 },
    { date: TODAY, endAt: '', minutes: 0 },
  ]
  const result = fastingSummary(sessions)
  assert.equal(result.count, 2)
  assert.equal(result.averageHours, 14)
  assert.deepEqual(result.recent[0], { id: undefined, date: '2026-11-06', hours: 16 })
  assert.equal(fastingSummary([]).averageHours, null)
})

test('lab series matches one test name and ignores non-numbers', () => {
  const labs = [
    { date: '2026-09-01', name: 'Ferritin', value: '42', unit: 'ng/mL' },
    { date: '2026-10-01', name: 'ferritin', value: '57.5', unit: 'ng/mL' },
    { date: '2026-10-02', name: 'Ferritin', value: 'not a number' },
  ]
  const series = labSeries(labs, 'Ferritin')
  assert.equal(series.length, 2)
  assert.equal(series[1].value, 57.5)
  assert.deepEqual(labSeries(labs, ''), [])
})

test('cycle gap is measured from the last note', () => {
  assert.equal(daysSinceLast([], TODAY), null)
  assert.deepEqual(daysSinceLast([{ date: '2026-10-28' }], TODAY), { last: '2026-10-28', days: 10 })
})

test('heatmap gives one cell per day with a 0–3 level', () => {
  const state = { meals: [{ date: TODAY }], activities: [{ date: TODAY }], sleeps: [{ date: TODAY }] }
  const cells = loggingHeatmap(state, TODAY, 14)
  assert.equal(cells.length, 14)
  assert.equal(cells[cells.length - 1].level, 3)
  assert.equal(cells[0].level, 0)
})

test('weekday pattern averages only days that have food', () => {
  const pattern = weekdayPattern(mealsOn(['2026-11-07', '2026-10-31'], 600), TODAY, 4)
  assert.equal(pattern.length, 7)
  const saturday = pattern.find(item => item.day === 'Sat')
  assert.equal(saturday.avgKcal, 600)
  assert.equal(saturday.days, 2)
  assert.equal(pattern.find(item => item.day === 'Mon').avgKcal, null)
})

test('weight goal progress reports how far is left', () => {
  const weights = [{ date: '2026-09-01', kg: 80 }, { date: TODAY, kg: 76 }]
  const progress = weightGoalProgress(weights, TODAY, 70)
  assert.equal(progress.start, 80)
  assert.equal(progress.current, 76)
  assert.equal(progress.toGo, 6)
  assert.equal(progress.percent, 40)
  assert.equal(weightGoalProgress(weights, TODAY, 0), null)
  const atGoal = weightGoalProgress([{ date: TODAY, kg: 70 }], TODAY, 70)
  assert.equal(atGoal.percent, 100)
})

test('body fat change needs two readings', () => {
  assert.equal(bodyFatChange([{ date: TODAY, bodyFat: 24 }], TODAY), null)
  const change = bodyFatChange([
    { date: '2026-10-01', bodyFat: 26 }, { date: TODAY, bodyFat: 23.5 },
  ], TODAY)
  assert.equal(change.change, -2.5)
})

test('week over week averages each half of the series', () => {
  const series = [
    { date: '2026-11-01', calories: 2000, steps: 8000, sleep: 7, waterMl: 1500 },
    { date: '2026-11-02', calories: 2000, steps: 8000, sleep: 7, waterMl: 1500 },
    { date: '2026-11-03', calories: 2200, steps: 10000, sleep: 8, waterMl: 2000 },
    { date: '2026-11-04', calories: 2200, steps: 10000, sleep: 8, waterMl: 2000 },
  ]
  const rows = weekOverWeek(series)
  const kcal = rows.find(row => row.key === 'calories')
  assert.equal(kcal.before, 2000)
  assert.equal(kcal.now, 2200)
  assert.equal(kcal.delta, 200)
  assert.deepEqual(weekOverWeek([{ date: TODAY, calories: 1 }]), [])
})

test('step streak ignores an unfinished today but keeps yesterday alive', () => {
  const state = {
    activities: [
      { date: '2026-11-04', steps: 9000 }, { date: '2026-11-05', steps: 9000 }, { date: '2026-11-06', steps: 9000 },
    ],
  }
  const streak = stepGoalStreak(state, 8000, TODAY, '', 30)
  assert.equal(streak.current, 3, 'today has not been walked yet, so the run is still alive')
  assert.equal(streak.best, 3)
  assert.equal(stepGoalStreak(state, 0, TODAY).current, 0)
})

test('weekly active minutes total the last seven days', () => {
  const walks = [
    { date: TODAY, minutes: 40 }, { date: '2026-11-05', minutes: 30 }, { date: '2026-10-01', minutes: 90 },
  ]
  const result = weeklyActiveMinutes(walks, TODAY)
  assert.equal(result.minutes, 70)
  assert.equal(result.sessions, 2)
  assert.equal(result.goal, 150)
  assert.equal(result.percent, 47)
})

test('storage usage reports size and per-collection counts', () => {
  const usage = storageUsage({ meals: [{}, {}], walks: [{}], settings: {} })
  assert.ok(usage.kb >= 0)
  assert.deepEqual(usage.collections[0], { key: 'meals', count: 2 })
})

test('day summary text is readable and omits empty sections', () => {
  const text = daySummaryText({ date: TODAY, kcal: 1500, target: 2000, steps: 6000, stepGoal: 8000, waterMl: 1500, walks: [{ distanceKm: 2.4 }] })
  assert.match(text, /^2026-11-07 · AbsoluteCal/)
  assert.match(text, /Food 1500 \/ 2000 kcal/)
  assert.match(text, /Water 1\.5 L/)
  assert.match(text, /1 walk · 2\.4 km/)
  assert.doesNotMatch(text, /Sleep/)
})

test('dayKeys walks backwards without timezone drift', () => {
  assert.deepEqual(dayKeys(TODAY, 3), ['2026-11-05', '2026-11-06', '2026-11-07'])
  assert.deepEqual(dayKeys('not-a-date', 3), [])
})
