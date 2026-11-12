import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReminderSchedule, clockMinutes, reminderInterval, ownedReminderIds, WATER_ID_BASE, MEAL_ID_BASE } from '../src/lib/reminder-schedule.js'

const settings = { reminders: { water: false, meals: false }, waterInterval: 90, wakeTime: '07:00', bedTime: '23:00' }

test('disabled reminders schedule nothing', () => {
  assert.deepEqual(buildReminderSchedule(settings), [])
  assert.deepEqual(buildReminderSchedule(undefined), [])
})

test('meal reminders fire daily at breakfast, lunch and dinner', () => {
  const schedule = buildReminderSchedule({ ...settings, reminders: { water: false, meals: true } })
  assert.equal(schedule.length, 3)
  assert.deepEqual(schedule.map(item => item.schedule.on.at), [{ hour: 8, minute: 0 }, { hour: 13, minute: 0 }, { hour: 20, minute: 0 }])
  assert.ok(schedule.every(item => item.schedule.on.every === 'day'))
  assert.deepEqual(schedule.map(item => item.id), [MEAL_ID_BASE, MEAL_ID_BASE + 1, MEAL_ID_BASE + 2])
})

test('water reminders run between waking and bedtime at the chosen interval', () => {
  const schedule = buildReminderSchedule({ ...settings, reminders: { water: true, meals: false }, waterInterval: 90 })
  const times = schedule.map(item => `${item.schedule.on.at.hour}:${String(item.schedule.on.at.minute).padStart(2, '0')}`)
  assert.equal(times[0], '8:00')
  assert.equal(times[1], '9:30')
  assert.equal(times.at(-1), '21:30')
  assert.ok(times.length >= 8 && times.length <= 12, `unexpected slot count ${times.length}`)
  assert.ok(schedule.every(item => item.id >= WATER_ID_BASE))
})

test('a shorter day and custom wake time bound the water slots', () => {
  const schedule = buildReminderSchedule({ reminders: { water: true, meals: false }, waterInterval: 60, wakeTime: '09:00', bedTime: '21:00' })
  const times = schedule.map(item => item.schedule.on.at.hour)
  assert.equal(times[0], 10)
  assert.equal(times.at(-1), 20)
  assert.equal(schedule.length, 11)
})

test('interval is clamped and unusable settings fall back to a daytime window', () => {
  assert.equal(reminderInterval({ waterInterval: 5 }), 30)
  assert.equal(reminderInterval({ waterInterval: 600 }), 240)
  assert.equal(reminderInterval({}), 90)
  const schedule = buildReminderSchedule({ reminders: { water: true, meals: false }, waterInterval: 90, wakeTime: 'nonsense', bedTime: '00:30' })
  assert.ok(schedule.length > 0)
  assert.equal(clockMinutes('07:30', 0), 450)
  assert.equal(clockMinutes('25:00', 60), 60)
})

test('both kinds share the schedule with unique ids', () => {
  const schedule = buildReminderSchedule({ ...settings, reminders: { water: true, meals: true } })
  const ids = schedule.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(schedule.some(item => item.extra.kind === 'water'))
  assert.ok(schedule.some(item => item.extra.kind === 'meal'))
})

test('only this app\'s ids are cancelled', () => {
  const owned = ownedReminderIds([
    { id: WATER_ID_BASE }, { id: WATER_ID_BASE + 3 }, { id: MEAL_ID_BASE }, { id: 42 }, { id: 9999 },
  ])
  assert.deepEqual(owned, [{ id: WATER_ID_BASE }, { id: WATER_ID_BASE + 3 }, { id: MEAL_ID_BASE }])
})
