// Step counting + stride calibration.
//
// Accuracy notes (these matter, so they are written down rather than hidden):
// • A phone browser only receives `devicemotion` while this page is open and
//   visible. No background pedometer is possible on the web.
// • The detector below is an adaptive peak detector with hysteresis, a
//   refractory window and an amplitude gate — far better than a fixed
//   threshold, but it is still an estimate.
// • When Android Health Connect is available it reports the device's own
//   pedometer, which is the most accurate source and takes priority.
// • Stride length is what turns steps into distance. Defaulting it from height
//   is a guess; calibrating it against a known distance is not.

const DEFAULTS = {
  minIntervalMs: 280,      // ~214 steps/min ceiling
  maxIntervalMs: 2200,     // gaps longer than this reset cadence tracking
  smoothing: 0.24,
  windowSize: 64,
  minAmplitude: 0.55,
  sensitivity: 1,
}

export function createStepDetector(options = {}) {
  const config = { ...DEFAULTS, ...options }
  let smooth = 9.81
  let buffer = []
  let armed = false
  let candidateAt = 0
  let candidatePeak = 0
  let lastStepAt = 0
  let intervals = []
  let steps = 0

  const stats = () => {
    const n = buffer.length || 1
    let mean = 0
    for (const value of buffer) mean += value
    mean /= n
    let variance = 0
    for (const value of buffer) variance += (value - mean) ** 2
    return { mean, sd: Math.sqrt(variance / n) }
  }

  return {
    reset() {
      smooth = 9.81; buffer = []; armed = false; candidateAt = 0
      candidatePeak = 0; lastStepAt = 0; intervals = []; steps = 0
    },
    get steps() { return steps },
    get cadence() {
      if (!intervals.length) return 0
      const recent = intervals.slice(-8)
      const average = recent.reduce((sum, value) => sum + value, 0) / recent.length
      return average > 0 ? Math.round(60000 / average) : 0
    },
    get lastStepAt() { return lastStepAt },
    // Returns true when this sample completed a step.
    push(magnitude, now = Date.now()) {
      const value = Number(magnitude)
      if (!Number.isFinite(value)) return false
      smooth += config.smoothing * (value - smooth)
      buffer.push(smooth)
      if (buffer.length > config.windowSize) buffer.shift()
      if (buffer.length < 12) return false

      const { mean, sd } = stats()
      const threshold = mean + Math.max(config.minAmplitude, sd * 0.55) * config.sensitivity

      if (!armed && smooth > threshold) {
        armed = true
        candidateAt = now
        candidatePeak = smooth
        return false
      }
      if (armed) {
        if (smooth > candidatePeak) candidatePeak = smooth
        // A step completes when the signal falls back through the mean.
        if (smooth < mean) {
          armed = false
          const amplitude = candidatePeak - mean
          const gap = now - lastStepAt
          if (amplitude >= config.minAmplitude && gap >= config.minIntervalMs) {
            if (lastStepAt && gap <= config.maxIntervalMs) {
              intervals.push(gap)
              if (intervals.length > 12) intervals.shift()
            } else {
              intervals = []
            }
            lastStepAt = now
            steps += 1
            return true
          }
        }
      }
      return false
    },
  }
}

// Walking/running energy cost rises with speed. MET values from the
// Compendium of Physical Activities, interpolated by speed.
export function metForSpeed(speedKmh) {
  const speed = Number(speedKmh) || 0
  if (speed < 1) return 2.3
  if (speed < 3.2) return 2.8
  if (speed < 4) return 3.0
  if (speed < 4.8) return 3.5
  if (speed < 5.6) return 4.3
  if (speed < 6.4) return 5.0
  if (speed < 7.2) return 6.3
  if (speed < 8.4) return 8.3
  if (speed < 9.7) return 9.8
  if (speed < 11.3) return 11.0
  if (speed < 12.9) return 11.8
  if (speed < 14.5) return 12.8
  return 14.5
}

export function defaultStrideM(heightCm, equation = 'female') {
  const height = Number(heightCm) > 0 ? Number(heightCm) : 170
  const ratio = equation === 'male' ? 0.415 : 0.413
  return Math.round((height / 100) * ratio * 1000) / 1000
}

// Turn a calibration walk into a stride length. 200 steps over 150 m → 0.75 m.
export function strideFromCalibration(steps, distanceM) {
  const count = Math.max(0, Number(steps) || 0)
  const metres = Math.max(0, Number(distanceM) || 0)
  if (count < 20 || metres < 5) return null
  const stride = metres / count
  if (!Number.isFinite(stride) || stride < 0.3 || stride > 1.6) return null
  return Math.round(stride * 1000) / 1000
}

export function stepsForDistance(distanceM, strideM = 0.76) {
  const stride = Number(strideM) > 0 ? Number(strideM) : 0.76
  return Math.max(0, Math.round((Number(distanceM) || 0) / stride))
}

// Steps × stride is metres; callers want kilometres.
export function distanceForSteps(steps, strideM = 0.76) {
  const stride = Number(strideM) > 0 ? Number(strideM) : 0.76
  return Math.max(0, Math.round(((Number(steps) || 0) * stride) / 10) / 100)
}

// Which source is being shown, and how much to trust it.
export function stepSourceInfo(source) {
  if (source === 'device') return { label: 'Connected device', tone: 'good', detail: 'Reported by Health Connect — the most accurate source available.' }
  if (source === 'manual') return { label: 'Manual entry', tone: 'good', detail: 'You typed this number, so it is exactly what you meant.' }
  if (source === 'motion') return { label: 'Phone estimate', tone: 'warn', detail: 'Accelerometer estimate while the screen was open. Calibrate your stride to improve distance.' }
  if (source === 'walk') return { label: 'Walk session', tone: 'warn', detail: 'Counted from your walk session distance and stride.' }
  return { label: 'No steps yet', tone: 'muted', detail: 'Log steps, start a walk, or connect Health Connect.' }
}
