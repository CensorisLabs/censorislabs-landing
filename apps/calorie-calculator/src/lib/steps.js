// Bridge to the native Android step counter plugin (sensor TYPE_STEP_COUNTER).
// In a browser or the Electron build there is no pedometer, so every helper
// reports availability and the UI falls back to manual step entry.

function plugin() {
  const capacitor = typeof window !== 'undefined' ? window.Capacitor : null
  return capacitor?.Plugins?.StepCounter || null
}

let listenerHandle = null

export function deviceStepCounterAvailable() {
  return Boolean(plugin())
}

export async function startDeviceSteps() {
  const counter = plugin()
  if (!counter) return { available: false, steps: 0 }
  try {
    return await counter.start()
  } catch {
    return { available: false, steps: 0 }
  }
}

export async function readDeviceSteps() {
  const counter = plugin()
  if (!counter) return { available: false, steps: 0 }
  try {
    return await counter.getSteps()
  } catch {
    return { available: false, steps: 0 }
  }
}

export async function stopDeviceSteps() {
  const counter = plugin()
  if (!counter) return
  try {
    await counter.stop()
  } catch {
    /* stopping a sensor is best effort */
  }
}

export async function watchDeviceSteps(callback) {
  const counter = plugin()
  if (!counter) return null
  try {
    if (listenerHandle) await listenerHandle.remove()
    listenerHandle = await counter.addListener('steps', payload => callback(payload?.steps || 0))
    return listenerHandle
  } catch {
    return null
  }
}
