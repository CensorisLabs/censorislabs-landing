// Builds the notification schedule that the installed Android app hands to the
// operating system. Kept free of browser and Capacitor imports so it can be
// unit-tested and reasoned about: every entry is a daily repeating local
// notification with a stable id, so rescheduling can cancel the previous set.

export const WATER_ID_BASE = 9100
export const MEAL_ID_BASE = 9200
export const MAX_WATER_SLOTS = 18

const MEAL_ITEMS = [
  { id: 'breakfast', label: 'Breakfast', hour: 8, minute: 0 },
  { id: 'lunch', label: 'Lunch', hour: 13, minute: 0 },
  { id: 'dinner', label: 'Dinner', hour: 20, minute: 0 },
]

/** "07:00" -> 420. Invalid input falls back. */
export function clockMinutes(value, fallback) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return fallback
  return hours * 60 + minutes
}

export function reminderInterval(settings) {
  const value = Number(settings?.waterInterval) || 90
  return Math.min(240, Math.max(30, Math.round(value)))
}

function waterSlots(settings) {
  const interval = reminderInterval(settings)
  const wake = clockMinutes(settings?.wakeTime, 7 * 60)
  const bed = clockMinutes(settings?.bedTime, 23 * 60)
  let start = wake + 60
  let end = bed - 60
  if (end - start < 120) { start = 8 * 60; end = 21 * 60 }
  if (start < 0) start = 8 * 60
  if (end > 23 * 60 + 30) end = 23 * 60

  const slots = []
  for (let minute = start; minute <= end && slots.length < MAX_WATER_SLOTS; minute += interval) {
    slots.push({ hour: Math.floor(minute / 60), minute: minute % 60 })
  }
  return slots
}

/**
 * Returns the notifications to schedule for the current settings. Disabled
 * reminder kinds contribute nothing, so an empty array means "cancel every
 * reminder this app owns".
 */
export function buildReminderSchedule(settings) {
  const reminders = settings?.reminders || {}
  const schedule = []

  if (reminders.meals) {
    MEAL_ITEMS.forEach((meal, index) => {
      schedule.push({
        id: MEAL_ID_BASE + index,
        title: 'kcal check-in',
        body: `${meal.label} is not logged yet. A quick entry is enough.`,
        schedule: { on: { every: 'day', at: { hour: meal.hour, minute: meal.minute } }, allowWhileIdle: true },
        extra: { kind: 'meal', meal: meal.id },
      })
    })
  }

  if (reminders.water) {
    waterSlots(settings).forEach((slot, index) => {
      schedule.push({
        id: WATER_ID_BASE + index,
        title: 'Time for water',
        body: 'A glass now keeps your hydration guide on track.',
        schedule: { on: { every: 'day', at: { hour: slot.hour, minute: slot.minute } }, allowWhileIdle: true },
        extra: { kind: 'water' },
      })
    })
  }

  return schedule
}

export function ownedReminderIds(notifications) {
  return (notifications || [])
    .map(item => Number(item.id))
    .filter(id => id >= WATER_ID_BASE && id < MEAL_ID_BASE + 100)
    .map(id => ({ id }))
}
