import test from 'node:test'
import assert from 'node:assert/strict'
import * as extras from '../src/extras.js'

const TODAY = '2026-11-07'
const names = Object.keys(extras).filter(key => typeof extras[key] === 'function')

test('every helper is callable with no arguments and never throws', () => {
  assert.ok(names.length >= 70, `expected the full set, found ${names.length}`)
  for (const name of names) {
    assert.doesNotThrow(() => extras[name](), `${name} must survive empty input`)
  }
})

test('helpers survive junk rows and empty lists', () => {
  // Every helper is called from the renderer with either an array or an empty
  // object from state, never with an arbitrary scalar, so those are the shapes
  // this sweep holds to.
  for (const name of names) {
    assert.doesNotThrow(() => extras[name]([{ date: 'nope', kg: 0, hours: 0, kcal: '', grams: null }]), `${name} must survive junk rows`)
    assert.doesNotThrow(() => extras[name]([]), `${name} must survive an empty list`)
  }
})

const meal = (kcal, grams, extra = {}) => ({ date: TODAY, name: 'Dal', grams, slot: 'Lunch', nutrients: { kcal, p: 8, c: 20, f: 3, fi: 4, su: 2, na: 200 }, ...extra })

test('macro split uses calorie weightings, not raw grams', () => {
  const split = extras.macroSplit({ protein: 25, carbs: 50, fat: 10 })
  // 100 kcal protein, 200 kcal carbs, 90 kcal fat = 390
  assert.equal(split.protein, 25.6)
  assert.equal(split.carbs, 51.3)
  assert.equal(split.fat, 23.1)
  assert.equal(extras.macroSplit({}), null)
})

test('density rows divide by energy and stay null without food', () => {
  assert.equal(extras.nutrientDensity({ kcal: 500, protein: 25 }, 'protein'), 50)
  assert.equal(extras.nutrientDensity({ kcal: 0, protein: 25 }, 'protein'), null)
})

test('top contributors rank and cap correctly', () => {
  const meals = [meal(100, 100, { name: 'A' }), meal(300, 100, { name: 'B' }), meal(200, 100, { name: 'C' })]
  const top = extras.topContributors(meals, 'kcal', 2)
  assert.deepEqual(top.map(row => row.name), ['B', 'C'])
  assert.deepEqual(extras.topContributors([], 'kcal'), [])
})

test('meal statistics ignore empty portions', () => {
  const stats = extras.entryStats([meal(100, 100), meal(300, 100), meal(500, 0)])
  assert.equal(stats.count, 2)
  assert.equal(stats.average, 200)
  assert.equal(stats.median, 200)
  assert.equal(extras.entryStats([]), null)
})

test('repeated foods are only counted when logged more than once', () => {
  const meals = [meal(100, 100, { name: 'Oats' }), meal(100, 100, { name: 'Oats' }), meal(100, 100, { name: 'Dal' })]
  assert.deepEqual(extras.repeatedFoods(meals), [{ name: 'Oats', count: 2 }])
})

test('drink detection follows slot and words', () => {
  const drinks = [meal(50, 100, { name: 'Masala chai' }), meal(0, 100, { name: 'Lunch' }), meal(90, 200, { name: 'Cola', slot: 'Drink' })]
  assert.equal(extras.drinkEnergy(drinks).count, 2)
  // 50 kcal per 100 g x 100 g + 90 kcal per 100 g x 200 g
  assert.equal(extras.drinkEnergy(drinks).kcal, 230)
})

test('walk statistics sum and pick the longest session', () => {
  const walks = [
    { date: '2026-11-01', minutes: 30, distanceKm: 2.2 },
    { date: '2026-11-03', minutes: 50, distanceKm: 4 },
  ]
  const stats = extras.walkStats(walks)
  assert.equal(stats.sessions, 2)
  assert.equal(stats.minutes, 80)
  assert.equal(stats.distanceKm, 6.2)
  assert.equal(stats.longest.date, '2026-11-03')
})

test('pace trend reports a positive number when the latest walk is faster', () => {
  const trend = extras.walkPaceTrend([
    { date: '2026-11-01', minutes: 30, distanceKm: 3 },
    { date: '2026-11-05', minutes: 25, distanceKm: 3 },
  ])
  assert.equal(trend.oldest, 10)
  assert.equal(trend.newest, 8.3)
  assert.equal(trend.faster, 1.7)
})

test('check-in breakdown counts only answered sessions', () => {
  const walks = [
    { checkin: { with: 'Friends' } },
    { checkin: { with: 'Friends' } },
    { checkin: { with: 'Alone' } },
    { checkin: null },
  ]
  assert.deepEqual(extras.checkinBreakdown(walks, 'with'), [{ label: 'Friends', count: 2 }, { label: 'Alone', count: 1 }])
  assert.deepEqual(extras.checkinCompletion(walks), { answered: 3, sessions: 4, percent: 75 })
})

test('step goal hit rate divides by days that have steps', () => {
  const series = [{ steps: 9000 }, { steps: 5000 }, { steps: 0 }]
  assert.deepEqual(extras.stepGoalHitRate(series, 8000), { hits: 1, days: 2, percent: 50 })
  assert.equal(extras.stepGoalHitRate(series, 0), null)
})

test('strength volume multiplies sets, reps and load', () => {
  const volume = extras.strengthVolume([{ sets: 4, reps: 8, loadKg: 40 }, { sets: 3, reps: 10, loadKg: 0 }])
  assert.equal(volume.sets, 7)
  assert.equal(volume.volumeKg, 1310)
})

test('sleep summary distinguishes goal hits from logged nights', () => {
  const summary = extras.sleepSummary([{ hours: 8 }, { hours: 6 }, { hours: 0 }], 8)
  assert.deepEqual(summary, { nights: 2, average: 7, shortest: 6, goalHits: 1, goalPercent: 50 })
})

test('bedtime average handles bedtimes either side of midnight', () => {
  const average = extras.bedtimeAverage([{ bed: '23:30' }, { bed: '00:30' }])
  assert.equal(average.clock, '00:00')
})

test('duration helpers format times and refuse nonsense', () => {
  assert.equal(extras.bedtimeAverage([{ bed: 'nope' }]), null)
  assert.equal(extras.wakeAverage([{ wake: '07:15' }]).clock, '07:15')
  assert.equal(extras.sleepQualityAverage([{ quality: 4 }, { quality: 2 }]), 3)
})

test('stage shares are percentages of the nights logged', () => {
  const share = extras.stageShare([{ hours: 8, deep: 2, rem: 1 }])
  assert.equal(share.deep, 2)
  assert.equal(share.deepPercent, 25)
  assert.equal(share.remPercent, 12.5)
})

test('weekend sleep shift is sign-aware', () => {
  const shift = extras.weekendSleepShift([
    { date: '2026-11-07', hours: 9 }, { date: '2026-11-06', hours: 7 }, { date: '2026-11-05', hours: 7 },
  ])
  assert.equal(shift.weekend, 9)
  assert.equal(shift.weekday, 7)
  assert.equal(shift.shift, 2)
})

test('weight rate is per week, not per entry', () => {
  const rate = extras.weightRate([
    { date: '2026-10-08', kg: 80 }, { date: '2026-11-05', kg: 78 },
  ])
  assert.equal(rate.days, 28)
  assert.equal(rate.perWeek, -0.5)
})

test('body helpers respect missing values', () => {
  assert.equal(extras.bmiFrom(70, 0), null)
  assert.equal(extras.bmiFrom(70, 175), 22.9)
  assert.equal(extras.waistToHeight({ waistCm: 80 }, 0), null)
  assert.equal(extras.waistToHeight({ waistCm: 80 }, 160).ratio, 0.5)
  assert.equal(extras.waistHipRatio({ waistCm: 80, hipsCm: 0 }), null)
  assert.equal(extras.leanMass(70, 0), null)
  assert.deepEqual(extras.leanMass(70, 20), { fatMass: 14, leanMass: 56 })
})

test('measurement change compares first and last readings', () => {
  const change = extras.measurementChange([
    { date: '2026-10-01', waistCm: 90, chestCm: 100, hipsCm: 104 },
    { date: '2026-11-01', waistCm: 86, chestCm: 100, hipsCm: 102 },
  ])
  assert.equal(change.waist, -4)
  assert.equal(change.chest, 0)
  assert.equal(change.hips, -2)
})

test('habit helpers count possible check-ins honestly', () => {
  const habits = [{ id: 'a' }, { id: 'b' }]
  const stats = extras.habitStats(habits, [{ habitId: 'a', date: TODAY }], TODAY, 2)
  assert.deepEqual(stats, { habits: 2, checkins: 1, possible: 4, percent: 25 })
  assert.equal(extras.habitStats([], [], TODAY, 2), null)
})

test('vital averages and extremes skip empty rows', () => {
  const vitals = [{ rhr: 60 }, { rhr: 0 }, { rhr: 70 }]
  assert.equal(extras.vitalAverage(vitals, 'rhr'), 65)
  assert.equal(extras.vitalExtreme([{ temp: 36.4 }, { temp: 38.1 }], 'temp', 'max'), 38.1)
})

test('blood pressure average parses valid readings only', () => {
  const average = extras.bpAverage([{ bp: '120/80' }, { bp: '140/90' }, { bp: 'nonsense' }])
  assert.deepEqual(average, { systolic: 130, diastolic: 85, readings: 2 })
})

test('data health finds orphaned and implausible records', () => {
  const state = {
    profiles: [{ id: 'p1' }],
    weights: [{ profileId: 'gone', kg: 70 }, { profileId: 'p1', kg: 0 }],
    meals: [{ profileId: 'p1', grams: 0 }],
    sleeps: [], water: [], walks: [], journal: [],
  }
  assert.equal(extras.orphanRecords(state), 1)
  const invalid = extras.invalidRecords(state)
  assert.equal(invalid.find(item => item.label.includes('weigh-ins')).count, 1)
  assert.equal(invalid.find(item => item.label.includes('meals')).count, 1)
})

test('storage estimates count photo and route bytes', () => {
  assert.equal(extras.photoBytes({ walks: [{ startPhoto: 'x'.repeat(100) }] }), 0)
  assert.equal(extras.photoBytes({ meals: [{ photo: 'x'.repeat(5120) }] }), 10)
  assert.deepEqual(extras.routeBytes({ walks: [{ route: [{}, {}, {}] }] }), { points: 3, kb: 0.1 })
})

test('date range reports first and last day', () => {
  const range = extras.dateRange({ meals: [{ date: '2026-11-01' }, { date: '2026-11-10' }] })
  assert.equal(range.first, '2026-11-01')
  assert.equal(range.last, '2026-11-10')
  assert.equal(range.days, 10)
})

test('best logging streak finds the longest run of consecutive days', () => {
  const streak = extras.bestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06'])
  assert.equal(streak.best, 3)
  assert.equal(streak.first, '2026-11-01')
})

test('best weekday averages only days with data', () => {
  const best = extras.bestWeekday([{ date: '2026-11-07', steps: 9000 }, { date: '2026-11-01', steps: 3000 }], 'steps')
  assert.equal(best.day, 'Sat')
  assert.equal(best.average, 9000)
})

test('water goal rate counts days, not entries', () => {
  const rate = extras.waterGoalRate([{ date: TODAY, ml: 1200 }, { date: TODAY, ml: 900 }], 2000, 1, TODAY)
  assert.deepEqual(rate, { hit: 1, days: 1, percent: 100 })
})

test('backup age handles a missing timestamp', () => {
  assert.equal(extras.backupAge(''), null)
  const age = extras.backupAge('2026-11-01T00:00:00.000Z', Date.parse('2026-11-07T00:00:00.000Z'))
  assert.equal(age.days, 6)
})

test('profile counts do not double-count other profiles', () => {
  const state = {
    profiles: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    meals: [{ profileId: 'a' }, { profileId: 'a' }, { profileId: 'b' }, {}],
  }
  assert.deepEqual(extras.profileCounts(state).map(row => row.records), [3, 2])
})
