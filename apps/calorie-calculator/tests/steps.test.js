import test from 'node:test'
import assert from 'node:assert/strict'
import { createStepDetector, defaultStrideM, distanceForSteps, metForSpeed, stepSourceInfo, stepsForDistance, strideFromCalibration } from '../src/steps.js'
import { elapsedMs, paceLabel, walkSummary } from '../src/walk.js'

// Feed a synthetic accelerometer trace: gravity plus a walking oscillation.
function simulate(detector, { seconds = 30, cadencePerMinute = 110, amplitude = 2.4, noise = 0.12, stepMs = 20 } = {}) {
  let steps = 0
  const period = 60000 / cadencePerMinute
  let random = 42
  const rand = () => {
    random = (random * 1103515245 + 12345) % 2147483648
    return random / 2147483648 - 0.5
  }
  for (let t = 0; t < seconds * 1000; t += stepMs) {
    const magnitude = 9.81 + amplitude * Math.sin((t / period) * Math.PI * 2) + rand() * noise * 2
    if (detector.push(magnitude, 1000 + t)) steps += 1
  }
  return steps
}

test('detector counts a straight-line walking trace within a small margin', () => {
  const detector = createStepDetector()
  const steps = simulate(detector, { seconds: 30, cadencePerMinute: 110 })
  assert.ok(steps >= 50 && steps <= 58, `expected ~55 steps for 30 s at 110 spm, got ${steps}`)
  assert.equal(detector.steps, steps)
  assert.ok(detector.cadence >= 90 && detector.cadence <= 130, `cadence ${detector.cadence} should be near 110`)
})

test('a still phone produces no steps', () => {
  const detector = createStepDetector()
  for (let t = 0; t < 10000; t += 20) detector.push(9.81 + Math.sin(t / 900) * 0.05, t)
  assert.equal(detector.steps, 0)
})

test('hand tremor and double-crossings do not double count', () => {
  const detector = createStepDetector()
  // 240 steps/min is faster than any walk; the 280 ms refractory window must
  // clamp it rather than counting every oscillation.
  const steps = simulate(detector, { seconds: 10, cadencePerMinute: 240 })
  assert.ok(steps <= 21, `expected the refractory window to clamp this, got ${steps}`)
  assert.ok(steps >= 15, `expected roughly half the oscillations, got ${steps}`)
})

test('stride defaults scale with height and are plausible', () => {
  const stride = defaultStrideM(175, 'male')
  assert.ok(stride > 0.7 && stride < 0.78, `stride ${stride}`)
  assert.ok(defaultStrideM(160, 'female') < stride)
})

test('calibration converts a measured walk into a stride', () => {
  assert.equal(strideFromCalibration(200, 150), 0.75)
  assert.equal(strideFromCalibration(10, 150), null)
  assert.equal(strideFromCalibration(200, 2), null)
  assert.equal(strideFromCalibration(20, 40), null, 'a 2 m stride is not human')
})

test('steps and distance convert both ways', () => {
  assert.equal(stepsForDistance(760, 0.76), 1000)
  assert.equal(distanceForSteps(1000, 0.76), 0.76)
})

test('MET rises with speed and stays realistic', () => {
  const walking = metForSpeed(4.5)
  const brisk = metForSpeed(5.5)
  const running = metForSpeed(9.5)
  assert.ok(walking > 3 && walking < 4)
  assert.ok(brisk > walking)
  assert.ok(running > brisk)
  assert.ok(metForSpeed(0) >= 2)
})

test('paused time is excluded from a session', () => {
  const walk = { startedAt: 0, endedAt: 60000, pausedMs: 10000, pauseStartedAt: 0 }
  assert.equal(elapsedMs(walk, 60000), 50000)
  const paused = { startedAt: 0, pauseStartedAt: 20000, pausedMs: 0, endedAt: 0 }
  assert.equal(elapsedMs(paused, 50000), 20000)
})

test('a steady walk produces believable distance, steps and calories', () => {
  const walk = { startedAt: 0, endedAt: 30 * 60000, pausedMs: 0, pauseStartedAt: 0, mode: 'walk', pace: 'steady', gps: false, distanceM: 0 }
  const summary = walkSummary(walk, 78, 0.76)
  assert.ok(summary.distanceKm > 2 && summary.distanceKm < 2.5, `distance ${summary.distanceKm}`)
  assert.ok(summary.steps > 2700 && summary.steps < 3400, `steps ${summary.steps}`)
  assert.ok(summary.calories > 80 && summary.calories < 220, `calories ${summary.calories}`)
  assert.equal(summary.modeLabel, 'Walk')
})

test('GPS distance wins over the pace estimate', () => {
  const walk = { startedAt: 0, endedAt: 30 * 60000, pausedMs: 0, pauseStartedAt: 0, mode: 'walk', pace: 'steady', gps: true, distanceM: 4000, points: 12 }
  const summary = walkSummary(walk, 78, 0.76)
  assert.equal(summary.distanceKm, 4)
  assert.equal(summary.source, 'GPS')
})

test('a run burns more than the same time walking', () => {
  const base = { startedAt: 0, endedAt: 20 * 60000, pausedMs: 0, pauseStartedAt: 0, gps: false, distanceM: 0 }
  const walk = walkSummary({ ...base, mode: 'walk', pace: 'steady' }, 78, 0.76)
  const run = walkSummary({ ...base, mode: 'run', pace: 'run' }, 78, 0.76)
  assert.ok(run.calories > walk.calories)
  assert.ok(run.distanceKm > walk.distanceKm)
})

test('pace formats as minutes per kilometre', () => {
  assert.equal(paceLabel(30, 3), '10:00 /km')
  assert.equal(paceLabel(0, 0), '—')
})

test('step source labels do not overstate accuracy', () => {
  assert.equal(stepSourceInfo('device').tone, 'good')
  assert.equal(stepSourceInfo('motion').tone, 'warn')
  assert.match(stepSourceInfo('none').detail, /Log steps/)
})
