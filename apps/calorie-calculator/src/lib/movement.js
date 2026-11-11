// One calorie-burn model for the whole app.
//
// Everything here is an estimate, but the arithmetic is deliberately explicit so
// the numbers agree wherever they appear (Today, Progress, Insights, Tools):
//
//   * Steps are turned into distance with a stride length derived from height
//     (with an optional manual override), then into "active" calories with the
//     ACSM walking equation:
//         VO2 = 0.1 × speed(m/min) + 1.8 × speed × grade + 3.5   (walking)
//         VO2 = 0.2 × speed(m/min) + 0.9 × speed × grade + 3.5   (running)
//         kcal/min = VO2 × kg ÷ 200
//     The resting share (3.5 ml/kg/min) is subtracted, because the daily target
//     already comes from a TDEE that includes resting metabolism. That is what
//     keeps "exercise credit" from double-counting.
//   * Logged exercise uses its MET value with the same net-of-resting rule:
//         net kcal = (MET − 1) × 3.5 × kg ÷ 200 × minutes
//   * Steps that are already inside a logged walk or run are not credited twice.

export const STEP_CADENCE_DEFAULT = 100
export const STEP_CADENCE_MIN = 60
export const STEP_CADENCE_MAX = 220
export const STEP_GOAL_PRESETS = [5000, 7500, 8000, 10000, 12000, 15000]

const RESTING_VO2 = 3.5
const WALKING_GROUPS = new Set(['Walking', 'Running'])
const STEP_LIKE_NAME = /walk|run|jog|hike|stair|treadmill|skip/i

function num(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function clampNumber(value, min, max, fallback = min) {
  const parsed = num(value, fallback)
  return Math.min(max, Math.max(min, parsed))
}

/** Walking stride in metres: ~0.415 × height for men, ~0.413 × height for women. */
export function strideMeters(profile = {}) {
  const override = num(profile.strideCm, 0)
  if (override >= 45 && override <= 130) return Math.round(override) / 100
  const height = num(profile.heightCm, 0)
  if (height < 100 || height > 250) return 0.72
  const ratio = profile.sex === 'male' ? 0.415 : 0.413
  return Math.round(height / 100 * ratio * 1000) / 1000
}

export function stepCadence(profile = {}) {
  return clampNumber(profile.stepCadence, STEP_CADENCE_MIN, STEP_CADENCE_MAX, STEP_CADENCE_DEFAULT)
}

export function stepsToDistanceKm(steps, stride) {
  return Math.max(0, num(steps)) * Math.max(0.3, num(stride, 0.72)) / 1000
}

/** VO2-based walking/running burn. Returns net (active) and gross kcal. */
export function walkingCalories({ speedKmh, minutes, weightKg, grade = 0 }) {
  const weight = num(weightKg, 0)
  const time = Math.max(0, num(minutes))
  const speed = Math.min(30, Math.max(0.5, num(speedKmh, 0)))
  const slope = Math.min(0.5, Math.max(0, num(grade)))
  if (!weight || !time) return { net: 0, gross: 0 }
  const metresPerMinute = speed * 1000 / 60
  const running = metresPerMinute > 134
  const vo2 = (running ? 0.2 : 0.1) * metresPerMinute + (running ? 0.9 : 1.8) * metresPerMinute * slope + RESTING_VO2
  const gross = vo2 * weight / 200 * time
  const net = Math.max(0, (vo2 - RESTING_VO2) * weight / 200 * time)
  return { net: Math.round(net), gross: Math.round(gross) }
}

/** Net-of-resting MET burn, used for every logged exercise. */
export function exerciseCalories(met, minutes, weightKg) {
  const value = num(met, 0)
  const time = Math.max(0, num(minutes))
  const weight = num(weightKg, 0)
  if (value <= 1 || !time || !weight) return 0
  return Math.round((value - 1) * RESTING_VO2 * weight / 200 * time)
}

export function exerciseGross(met, minutes, weightKg) {
  const value = num(met, 0)
  const time = Math.max(0, num(minutes))
  const weight = num(weightKg, 0)
  if (value <= 0 || !time || !weight) return 0
  return Math.round(value * RESTING_VO2 * weight / 200 * time)
}

export function isStepLikeExercise(entry) {
  if (!entry) return false
  if (entry.group) return WALKING_GROUPS.has(entry.group)
  return STEP_LIKE_NAME.test(String(entry.name || ''))
}

/** Metrics for a raw step count, before any double-count correction. */
export function stepMetrics({ steps, profile = {} }) {
  const count = Math.min(200000, Math.max(0, Math.round(num(steps))))
  const stride = strideMeters(profile)
  const cadence = stepCadence(profile)
  const distanceKm = stepsToDistanceKm(count, stride)
  const minutes = cadence > 0 ? count / cadence : 0
  const speedKmh = minutes > 0 ? distanceKm / (minutes / 60) : 0
  const burn = walkingCalories({ speedKmh, minutes, weightKg: profile.weightKg })
  return {
    steps: count,
    strideM: stride,
    cadence,
    distanceKm: Math.round(distanceKm * 100) / 100,
    minutes: Math.round(minutes),
    speedKmh: Math.round(speedKmh * 10) / 10,
    activeKcal: burn.net,
    grossKcal: burn.gross,
    kcalPerStep: count ? burn.net / count : 0,
    perKmKcal: distanceKm > 0 ? burn.net / distanceKm : 0,
  }
}

/**
 * Everyday steps the activity multiplier in TDEE already pays for. Crediting the
 * full day of walking on top of a "moderately active" target would count the same
 * movement twice, so only steps beyond this baseline earn extra calories.
 */
const ACTIVITY_STEP_BASELINE = [[1.2, 3000], [1.375, 6000], [1.55, 9000], [1.725, 12000], [1.9, 15000]]

export function baselineSteps(profile = {}) {
  const multiplier = Number(profile.activity) || 1.2
  let best = ACTIVITY_STEP_BASELINE[0]
  let gap = Infinity
  for (const entry of ACTIVITY_STEP_BASELINE) {
    const distance = Math.abs(entry[0] - multiplier)
    if (distance < gap) {
      gap = distance
      best = entry
    }
  }
  return best[1]
}

/** What the activity setting already assumes, in plain words. */
export function baselineLabel(profile = {}) {
  const goal = baselineSteps(profile)
  return goal > 0 ? `your activity level already counts about ${goal.toLocaleString('en-IN')} everyday steps` : 'no everyday steps are assumed'
}

/**
 * Everything movement-related for one day: step metrics, exercise credit, the
 * steps that are already covered by a logged walk/run, and the combined credit
 * that belongs in the calorie budget.
 */
export function movementForDay(day = {}, profile = {}) {
  const steps = Math.max(0, num(day?.steps))
  const entries = Array.isArray(day?.exercise) ? day.exercise : []
  const stepLike = entries.filter(isStepLikeExercise)
  const stepLikeMinutes = stepLike.reduce((sum, entry) => sum + Math.max(0, num(entry.minutes)), 0)

  const raw = stepMetrics({ steps, profile })
  const cadence = raw.cadence
  // Steps covered twice: those inside a logged walk (the session already paid for
  // them) and those the activity multiplier in TDEE already accounts for.
  const walkSteps = Math.round(stepLike.reduce((sum, entry) => {
    const minutes = Math.max(0, num(entry.minutes))
    // A run turns over far more steps per minute than the walking cadence, so
    // using the walk estimate for it would leave real steps uncounted.
    const perMinute = /run|jog|sprint/i.test(`${entry.group || ''} ${entry.name || ''}`) ? 160 : cadence
    return sum + minutes * perMinute
  }, 0))
  const baseline = baselineSteps(profile)
  const coveredSteps = Math.min(steps, Math.max(walkSteps, baseline))
  const creditSteps = Math.max(0, steps - coveredSteps)
  const creditMetrics = creditSteps === steps ? raw : stepMetrics({ steps: creditSteps, profile })

  const exerciseCredit = entries.reduce((sum, entry) => sum + Math.max(0, Math.round(num(entry.kcal))), 0)
  const exerciseMinutes = entries.reduce((sum, entry) => sum + Math.max(0, num(entry.minutes)), 0)
  const stepGoal = Math.max(1000, Math.round(num(profile.stepGoal, 8000)) || 8000)

  const stepCredit = profile.creditStepCalories === false ? 0 : Math.round(creditMetrics.activeKcal)

  return {
    steps,
    stepGoal,
    goalPct: stepGoal > 0 ? Math.min(999, Math.round(steps / stepGoal * 100)) : 0,
    strideM: raw.strideM,
    cadence,
    distanceKm: raw.distanceKm,
    minutes: raw.minutes,
    speedKmh: raw.speedKmh,
    activeKcal: raw.activeKcal,
    grossKcal: raw.grossKcal,
    kcalPerStep: raw.kcalPerStep,
    coveredSteps,
    walkSteps: Math.min(steps, walkSteps),
    baselineSteps: Math.min(steps, baseline),
    creditSteps,
    stepCreditKcal: stepCredit,
    stepCreditSuppressed: profile.creditStepCalories === false,
    exerciseCreditKcal: Math.round(exerciseCredit),
    exerciseMinutes: Math.round(exerciseMinutes),
    creditKcal: Math.round(exerciseCredit) + stepCredit,
    stepLikeMinutes: Math.round(stepLikeMinutes),
  }
}

/** Short, honest copy about how a burn number was produced. */
export function burnBasisLabel(profile = {}) {
  const mode = profile.sex === 'male' ? 'male' : 'female'
  return `ACSM walking equation · ${Math.round(strideMeters(profile) * 100)} cm stride (${mode} height estimate) · ${stepCadence(profile)} steps/min`
}
