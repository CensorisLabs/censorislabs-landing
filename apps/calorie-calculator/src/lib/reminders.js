// Native reminder scheduling.
//
// The installed Android app runs inside a Capacitor WebView, which exposes the
// registered LocalNotifications plugin as window.Capacitor.Plugins. Going
// through that proxy keeps the web build free of native-only imports while
// still letting the phone schedule notifications that fire with the app closed.

import { buildReminderSchedule, ownedReminderIds } from './reminder-schedule.js'

export const REMINDER_CHANNEL = 'kcal-reminders'

function nativePlugin() {
  try {
    const capacitor = globalThis.Capacitor
    if (!capacitor || typeof capacitor.isNativePlatform !== 'function') return null
    if (!capacitor.isNativePlatform()) return null
    const plugin = capacitor.Plugins?.LocalNotifications
    return plugin || null
  } catch {
    return null
  }
}

/** True only inside the installed app, where the OS can deliver notifications. */
export function isNativeReminderPlatform() {
  return Boolean(nativePlugin())
}

export function reminderPlatform() {
  if (nativePlugin()) return 'device'
  if (typeof window !== 'undefined' && 'Notification' in window) return 'browser'
  return 'none'
}

export async function requestReminderPermission() {
  const plugin = nativePlugin()
  if (!plugin) {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    try { return await Notification.requestPermission() } catch { return 'denied' }
  }
  try {
    let status = await plugin.checkPermissions()
    if (status?.display !== 'granted') status = await plugin.requestPermissions()
    return status?.display || 'denied'
  } catch {
    return 'denied'
  }
}

async function ensureChannel(plugin) {
  try {
    await plugin.createChannel({
      id: REMINDER_CHANNEL,
      name: 'kcal reminders',
      description: 'Water and meal nudges from your own diary',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
  } catch {
    // Channels are Android-only; other platforms schedule without one.
  }
}

/**
 * Replaces every reminder this app owns with the schedule for `settings`.
 * Safe to call whenever a toggle changes or the app starts.
 */
export async function syncNativeReminders(settings) {
  const plugin = nativePlugin()
  if (!plugin) return { supported: false, scheduled: 0, permission: 'unsupported' }

  try {
    const pending = await plugin.getPending().catch(() => ({ notifications: [] }))
    const ours = ownedReminderIds(pending?.notifications)
    if (ours.length) await plugin.cancel({ notifications: ours }).catch(() => {})

    const schedule = buildReminderSchedule(settings)
    if (!schedule.length) return { supported: true, scheduled: 0, permission: 'granted' }

    let status = await plugin.checkPermissions()
    if (status?.display !== 'granted') status = await plugin.requestPermissions()
    if (status?.display !== 'granted') {
      return { supported: true, scheduled: 0, permission: status?.display || 'denied' }
    }

    await ensureChannel(plugin)
    await plugin.schedule({
      notifications: schedule.map(item => ({ ...item, channelId: REMINDER_CHANNEL, autoCancel: true })),
    })
    return { supported: true, scheduled: schedule.length, permission: 'granted' }
  } catch (error) {
    const message = String(error?.message || error)
    const exactAlarmBlocked = /exact|alarm/i.test(message)
    return { supported: true, scheduled: 0, permission: 'error', exactAlarmBlocked, message }
  }
}
