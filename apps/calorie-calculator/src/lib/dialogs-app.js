import {
  getProfile,
  state,
  update,
  addDays,
  todayKey,
  prettyDate,
  relativeDate,
  setWeight,
  saveMeasurement,
  getDay,
  findEntry,
  removeEntry,
  addFood,
  addExercise,
  removeExercise,
  saveTemplate,
  applyTemplate,
  deleteTemplate,
  deleteRecipe,
  copyDay,
  copyMeal,
  clearDay,
  setPlanItem,
  removePlanItem,
  planFor,
  planTotals,
  generateWeekPlan,
  exportPayload,
  importPayload,
  resetEverything,
  addProfile,
  switchProfile,
  removeProfile,
  foodList,
  findFood,
  foodAllowed,
  addRecipe,
  recipeTotals,
  MEALS,
  MEAL_IDS,
  dayHasData,
  profileStats,
  setWellbeing,
} from './store.js'
import {
  ACTIVITIES,
  GOALS,
  MACRO_PRESETS,
  targetsFor,
  autoTargets,
  bmr,
  tdee,
  targetCalories,
  goalDelta,
  calorieFloor,
  bodyFat,
  bmi,
  bmiCategory,
  healthyWeightRange,
  idealWeight,
  waistHeightRatio,
  leanBodyMass,
  goalProjection,
  formatWeight,
  formatHeight,
  kgToLb,
  lbToKg,
  cmToIn,
  inToCm,
  mlToOz,
  ozToMl,
  exerciseCalories,
  dayTotals,
  scoreDay,
  fastingProgress,
  round,
  durationLabel,
} from './calc.js'
import { EXERCISES, EXERCISE_GROUPS } from '../data/exercises.js'
import { ALLERGEN_TAGS } from '../data/foods.js'
import { deviceStepCounterAvailable } from './steps.js'
import { movementForDay, stepMetrics, stepCadence, strideMeters, burnBasisLabel, STEP_GOAL_PRESETS, STEP_CADENCE_MIN, STEP_CADENCE_MAX } from './movement.js'
import { openModal, closeModal, toast, esc, fmt, icon, confirmDialog, copyText, statBlock } from './ui.js'
import { refresh, ui, setDate } from './runtime.js'

function unitsLabel(key) {
  return state.settings.units === 'imperial' ? key === 'weight' ? 'lb' : key === 'height' ? 'in' : 'fl oz' : key === 'weight' ? 'kg' : key === 'height' ? 'cm' : 'ml'
}

function displayWeight(kg) {
  return state.settings.units === 'imperial' ? kgToLb(kg) : round(kg, 1)
}

function parseWeight(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return state.settings.units === 'imperial' ? lbToKg(number) : number
}

function displayLength(cm) {
  return state.settings.units === 'imperial' ? cmToIn(cm) : round(cm, 1)
}

function parseLength(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return state.settings.units === 'imperial' ? inToCm(number) : number
}

function displayVolume(ml) {
  return state.settings.units === 'imperial' ? mlToOz(ml) : Math.round(ml)
}

export function openExercise({ date = ui.date } = {}) {
  const profile = getProfile()
  const body = `<form id="exercise-form" class="kc-form">
    <div class="kc-field"><label for="ex-select">Activity</label><select id="ex-select" data-autofocus>${EXERCISE_GROUPS.map(group => `<optgroup label="${esc(group)}">${EXERCISES.filter(item => item.group === group).map(item => `<option value="${item.id}">${esc(item.name)} · MET ${item.met}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="ex-minutes">Minutes</label><input id="ex-minutes" type="number" min="1" max="600" step="1" value="30"></div><div class="kc-field"><label>Body weight used</label><div class="kc-readonly">${formatWeight(profile.weightKg, state.settings.units)}</div></div></div>
    <div class="kc-duration-chips">${[15, 30, 45, 60, 90].map(minutes => `<button type="button" class="kc-chip" data-minutes="${minutes}">${minutes} min</button>`).join('')}</div>
    <div class="kc-plan-preview" id="ex-preview"></div>
    <p class="kc-note">${icon('info')} MET values are averages. The figure is <b>active</b> calories — the MET burn minus the resting metabolism your daily target already counts — so it adds to the budget without double-counting.</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('activity')} Add exercise</button></div>
  </form>`
  openModal({
    title: 'Log exercise',
    eyebrow: 'MOVEMENT',
    subtitle: relativeDate(date),
    size: 'md',
    body,
    onMount(modal) {
      const select = modal.querySelector('#ex-select')
      const minutes = modal.querySelector('#ex-minutes')
      const preview = modal.querySelector('#ex-preview')
      const updatePreview = () => {
        const exercise = EXERCISES.find(item => item.id === select.value)
        const kcal = exerciseCalories(exercise?.met || 0, Number(minutes.value) || 0, profile.weightKg)
        const gross = Math.round((exercise?.met || 0) * 3.5 * profile.weightKg / 200 * (Number(minutes.value) || 0))
        preview.innerHTML = `<b>${fmt(kcal)} kcal active</b><span>${esc(exercise?.name || '')} · ${fmt(minutes.value)} min · ${formatWeight(profile.weightKg, state.settings.units)} · ${fmt(gross)} kcal including resting</span>`
      }
      select.addEventListener('change', updatePreview)
      minutes.addEventListener('input', updatePreview)
      modal.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
        minutes.value = button.dataset.minutes
        modal.querySelectorAll('[data-minutes]').forEach(item => item.classList.toggle('is-active', item === button))
        updatePreview()
      }))
      updatePreview()
      modal.querySelector('#exercise-form').addEventListener('submit', event => {
        event.preventDefault()
        const exercise = EXERCISES.find(item => item.id === select.value)
        const value = Math.max(1, Number(minutes.value) || 1)
        const kcal = exerciseCalories(exercise?.met || 0, value, profile.weightKg)
        update(() => addExercise(date, { name: exercise.name, group: exercise.group, met: exercise.met, minutes: value, kcal }), { label: 'Log exercise' })
        closeModal(); refresh(); toast(`${exercise.name} logged · ${kcal} kcal`)
      })
    },
  })
}

export function openExerciseSuggest({ date = ui.date } = {}) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const body = `<div class="kc-copy"><p>A small suggestion to move today based on your profile and what you have already eaten. Pick one and log it, or just use it as a nudge.</p></div>
    <div class="kc-suggest-body">
      <div class="kc-suggest-strip"><span>${icon('flame')} Estimated burn</span><b>${fmt(exerciseCalories(4.3, 30, profile.weightKg))} kcal</b><small>30 min brisk walk at ${formatWeight(profile.weightKg, state.settings.units)}</small></div>
      <div class="kc-suggest-chips">
        ${EXERCISE_GROUPS.slice(0, 6).map(group => {
          const pick = EXERCISES.filter(item => item.group === group).slice(0, 2)
          return `<div class="kc-suggest-group"><span class="kc-suggest-group__label">${esc(group)}</span>${pick.map(item => `<button type="button" class="kc-chip" data-exercise="${item.id}">${esc(item.name)} · ${item.met} MET</button>`).join('')}</div>`
        }).join('')}
      </div>
      <div class="kc-form-grid kc-form-grid--3">
        <div class="kc-field"><label>Suggested duration</label><div class="kc-readonly">20 min · ${fmt(exerciseCalories(4.3, 20, profile.weightKg))} kcal</div></div>
        <div class="kc-field"><label>10 min</label><div class="kc-readonly">${fmt(exerciseCalories(4.3, 10, profile.weightKg))} kcal</div></div>
        <div class="kc-field"><label>45 min</label><div class="kc-readonly">${fmt(exerciseCalories(4.3, 45, profile.weightKg))} kcal</div></div>
      </div>
    </div>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" id="suggest-log">${icon('activity')} Log suggested 20 min walk</button></div>
    <p class="kc-note">${icon('info')} These are suggestions, not instructions. Choose movement you will actually do, and log the real duration afterwards if it differs.</p>`;
  openModal({
    title: 'Exercise suggestion',
    eyebrow: 'MOVEMENT IDEAS',
    subtitle: `Today's budget: ${fmt(targets.kcal)} kcal · ${fmt(profile.weightKg, 1)} kg body weight`,
    size: 'md',
    body,
    onMount(modal) {
      const logSuggest = (exerciseId, minutes) => {
        const exercise = EXERCISES.find(item => item.id === exerciseId)
        if (!exercise) return
        const kcal = exerciseCalories(exercise.met, minutes, profile.weightKg)
        update(() => addExercise(date, { name: exercise.name, group: exercise.group, met: exercise.met, minutes, kcal }), { label: 'Log suggested exercise' })
        closeModal(); refresh(); toast(`${exercise.name} logged · ${kcal} kcal`)
      }
      modal.querySelector('#suggest-log').addEventListener('click', () => logSuggest('walk', 20))
      modal.querySelectorAll('[data-exercise]').forEach(button => {
        const matchMin = button.textContent.match(/\d+/)
        const minutes = matchMin ? Number(matchMin[0]) : 20
        button.addEventListener('click', () => logSuggest(button.dataset.exercise, minutes))
      })
    },
  })
}

export function openWaterLog({ date = ui.date } = {}) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const day = getDay(date)
  const body = `<div class="kc-water-dialog"><div class="kc-water-dialog__top">${icon('water')}<div><b>${fmt(day.water)} ${unitsLabel('water')}</b><span>of ${fmt(targets.water)} ${unitsLabel('water')} target · ${Math.min(100, Math.round((day.water || 0) / targets.water * 100))}%</span></div></div><div class="kc-water-buttons">${[200, 250, 330, 500, 750, 1000].map(amount => `<button type="button" class="kc-water-add" data-water="${amount}">+${fmt(state.settings.units === 'imperial' ? mlToOz(amount) : amount)}<small>${state.settings.units === 'imperial' ? 'fl oz' : 'ml'}</small></button>`).join('')}</div><form id="water-form" class="kc-form"><div class="kc-field"><label for="water-custom">Custom amount (${unitsLabel('water')})</label><div class="kc-inline"><input id="water-custom" type="number" min="1" step="1" placeholder="e.g. 400"><button class="kc-btn" type="submit">Add</button></div></div></form><p class="kc-note">Hydration needs vary with climate, activity and health. This is a practical guide, not a prescription.</p></div>`
  openModal({
    title: 'Water',
    eyebrow: 'HYDRATION',
    subtitle: relativeDate(date),
    size: 'sm',
    body,
    onMount(modal) {
      const add = amount => {
        update(() => { getDay(date).water = Math.min(12000, (getDay(date).water || 0) + amount) }, { label: 'Log water' })
        closeModal(); refresh(); toast(`Added ${fmt(state.settings.units === 'imperial' ? mlToOz(amount) : amount)} ${unitsLabel('water')}`)
      }
      modal.querySelectorAll('[data-water]').forEach(button => button.addEventListener('click', () => add(Number(button.dataset.water))))
      modal.querySelector('#water-form').addEventListener('submit', event => {
        event.preventDefault()
        const raw = Number(modal.querySelector('#water-custom').value)
        const amount = state.settings.units === 'imperial' ? ozToMl(raw) : raw
        if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return }
        add(Math.round(amount))
      })
    },
  })
}

export function openWeightLog({ date = ui.date } = {}) {
  const profile = getProfile()
  const body = `<form id="weight-form" class="kc-form"><div class="kc-form-grid"><div class="kc-field"><label for="weight-value">Weight (${unitsLabel('weight')})</label><input id="weight-value" type="number" min="20" max="500" step="0.1" inputmode="decimal" value="${displayWeight(profile.weightKg)}" data-autofocus required></div><div class="kc-field"><label for="weight-date">Date</label><input id="weight-date" type="date" value="${date}" max="${todayKey()}"></div></div><div class="kc-weight-context">${statBlock('Starting weight', formatWeight(profile.startWeightKg, state.settings.units))}${statBlock('Goal', formatWeight(profile.goalWeightKg, state.settings.units))}${statBlock('Change', `${profile.weightKg >= profile.startWeightKg ? '+' : ''}${round(profile.weightKg - profile.startWeightKg, 1)} ${unitsLabel('weight')}`)}</div><p class="kc-note">Weighing at a similar time of day gives a more useful trend. One reading is noise; the weekly direction matters.</p><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('scale')} Save weigh-in</button></div></form>`
  openModal({
    title: 'Log weight',
    eyebrow: 'BODY TREND',
    subtitle: 'Adds to your weight history',
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelector('#weight-form').addEventListener('submit', event => {
        event.preventDefault()
        const value = parseWeight(modal.querySelector('#weight-value').value)
        const chosenDate = modal.querySelector('#weight-date').value || date
        if (!value || value < 20 || value > 500) { toast('Enter a realistic weight.', 'error'); return }
        update(() => setWeight(value, chosenDate), { label: 'Log weight' })
        closeModal(); refresh(); toast('Weigh-in saved')
      })
    },
  })
}

export function openStepsLog({ date = ui.date } = {}) {
  const profile = getProfile()
  const current = Math.max(0, Number(getDay(date).steps) || 0)
  const body = `<form id="steps-form" class="kc-form kc-form--small">
    <div class="kc-field kc-field--wide"><label for="steps-date">Date</label><input id="steps-date" type="date" value="${date}" max="${todayKey()}"></div>
    <div class="kc-field kc-field--wide"><label for="steps-value">Steps</label><input id="steps-value" type="number" min="0" max="200000" step="100" value="${current || ''}" placeholder="e.g. 8000" data-autofocus></div>
    <div class="kc-steps-chips">${[1000, 2500, 5000, 7500, 10000].map(extra => `<button type="button" class="kc-chip" data-steps="${extra}">+${extra / 1000}k</button>`).join('')}</div>
    <div class="kc-plan-preview" id="steps-preview"></div>
    <p class="kc-note">${icon('info')} Steps are stored per day and feed your step streak. ${esc(burnBasisLabel(profile))}.${deviceStepCounterAvailable() ? ' The Android build can read the hardware step counter instead.' : ''}</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('footsteps')} Save steps</button></div>
  </form>`
  openModal({
    title: 'Log steps',
    eyebrow: 'MOVEMENT',
    subtitle: relativeDate(date),
    size: 'sm',
    body,
    onMount(modal) {
      const valueInput = modal.querySelector('#steps-value')
      const preview = modal.querySelector('#steps-preview')
      const renderPreview = () => {
        const metrics = stepMetrics({ steps: Number(valueInput.value) || 0, profile })
        preview.innerHTML = `<b>${fmt(metrics.distanceKm, 2)} km</b><span>${fmt(metrics.activeKcal)} kcal active · ${fmt(metrics.minutes)} min at ${fmt(metrics.speedKmh, 1)} km/h · ${fmt(metrics.grossKcal)} kcal including resting</span>`
      }
      valueInput.addEventListener('input', renderPreview)
      modal.querySelector('#steps-form').addEventListener('submit', event => {
        event.preventDefault()
        const value = Math.max(0, Number(valueInput.value) || 0)
        const chosenDate = modal.querySelector('#steps-date').value || date
        update(() => setWellbeing('steps', value, chosenDate), { label: 'Log steps' })
        closeModal(); refresh(); toast(value ? `${fmt(value)} steps saved` : 'Steps cleared')
      })
      modal.querySelectorAll('[data-steps]').forEach(button => button.addEventListener('click', () => {
        const base = Math.max(0, Number(getDay(modal.querySelector('#steps-date').value || date).steps) || 0)
        valueInput.value = base + Number(button.dataset.steps)
        renderPreview()
      }))
      renderPreview()
    },
  })
}

/** Stride, cadence and step-credit settings. These change the calorie maths, so
 *  they live with the profile rather than in cosmetic settings. */
export function openStepSettings() {
  const profile = getProfile()
  const day = getDay(ui.date)
  const movement = movementForDay(day, profile)
  const body = `<form id="step-settings" class="kc-form">
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="ss-goal">Daily step goal</label><input id="ss-goal" type="number" min="1000" max="50000" step="500" value="${profile.stepGoal}"></div>
      <div class="kc-field"><label for="ss-cadence">Walking cadence (steps/min)</label><input id="ss-cadence" type="number" min="${STEP_CADENCE_MIN}" max="${STEP_CADENCE_MAX}" step="5" value="${stepCadence(profile)}"></div>
    </div>
    <div class="kc-steps-chips">${STEP_GOAL_PRESETS.map(goal => `<button type="button" class="kc-chip" data-goal="${goal}">${goal.toLocaleString('en-IN')}</button>`).join('')}</div>
    <div class="kc-field"><label for="ss-stride">Stride length (cm)</label><input id="ss-stride" type="number" min="45" max="130" step="1" value="${profile.strideCm ? Math.round(profile.strideCm) : ''}" placeholder="Auto from height: ${Math.round(strideMeters(profile) * 100)}"><small class="kc-muted">Leave empty to derive it from your height (${Math.round(profile.heightCm)} cm). Measure a 10-step walk and divide by 10 for the most accurate value.</small></div>
    <label class="kc-toggle-row"><input id="ss-credit" type="checkbox" ${profile.creditStepCalories === false ? '' : 'checked'}> <span>Count step calories in the daily budget<small class="kc-muted">Turn this off if you would rather only credit logged exercise.</small></span></label>
    <div class="kc-plan-preview" id="ss-preview"></div>
    <p class="kc-note">${icon('info')} ${esc(burnBasisLabel(profile))}. Estimates are models, not measurements — use them consistently rather than chasing exactness.</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} Save movement settings</button></div>
  </form>`
  openModal({
    title: 'Step & movement settings',
    eyebrow: 'MOVEMENT',
    subtitle: `${fmt(movement.steps)} steps today · ${fmt(movement.stepCreditKcal)} kcal credited`,
    size: 'md',
    body,
    onMount(modal) {
      const goalInput = modal.querySelector('#ss-goal')
      const cadenceInput = modal.querySelector('#ss-cadence')
      const strideInput = modal.querySelector('#ss-stride')
      const creditInput = modal.querySelector('#ss-credit')
      const preview = modal.querySelector('#ss-preview')
      const draftProfile = () => ({
        ...getProfile(),
        stepGoal: Math.max(1000, Math.round(Number(goalInput.value) || 8000)),
        stepCadence: Math.min(STEP_CADENCE_MAX, Math.max(STEP_CADENCE_MIN, Math.round(Number(cadenceInput.value) || 100))),
        strideCm: Number(strideInput.value) > 0 ? Number(strideInput.value) : null,
        creditStepCalories: creditInput.checked,
      })
      const renderPreview = () => {
        const draft = draftProfile()
        const today = getDay(ui.date)
        const steps = Number(today.steps) || 8000
        const metrics = movementForDay({ ...today, steps }, draft)
        const label = draft.creditStepCalories === false
          ? 'step credit turned off'
          : `${fmt(metrics.stepCreditKcal)} kcal credited from ${fmt(metrics.creditSteps)} of ${fmt(steps)} steps`
        preview.innerHTML = `<b>${fmt(metrics.distanceKm, 2)} km · ${fmt(metrics.minutes)} min</b><span>${fmt(metrics.activeKcal)} kcal active at ${Math.round(metrics.strideM * 100)} cm stride · ${label} · ${fmt(metrics.grossKcal)} kcal including resting</span>`
      }
      ;[goalInput, cadenceInput, strideInput].forEach(input => input.addEventListener('input', renderPreview))
      creditInput.addEventListener('change', renderPreview)
      modal.querySelectorAll('[data-goal]').forEach(button => button.addEventListener('click', () => { goalInput.value = button.dataset.goal; renderPreview() }))
      modal.querySelector('#step-settings').addEventListener('submit', event => {
        event.preventDefault()
        const draft = draftProfile()
        update(() => Object.assign(getProfile(), { stepGoal: draft.stepGoal, stepCadence: draft.stepCadence, strideCm: draft.strideCm, creditStepCalories: draft.creditStepCalories }), { label: 'Movement settings' })
        closeModal(); refresh(); toast(`Step goal ${fmt(draft.stepGoal)} · ${fmt(stepMetrics({ steps: 8000, profile: draft }).activeKcal)} kcal per 8,000 steps`)
      })
      renderPreview()
    },
  })
}

export function openMeasurementLog({ date = ui.date } = {}) {
  const profile = getProfile()
  const latest = [...profile.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || {}
  const fields = [
    ['waist', 'Waist'], ['hips', 'Hips'], ['neck', 'Neck'], ['chest', 'Chest'], ['arms', 'Arms'], ['thighs', 'Thigh'],
  ]
  const body = `<form id="measure-form" class="kc-form"><div class="kc-field"><label for="measure-date">Date</label><input id="measure-date" type="date" value="${date}" max="${todayKey()}"></div><div class="kc-form-grid kc-form-grid--3">${fields.map(([key, label]) => `<div class="kc-field"><label for="m-${key}">${label} (${unitsLabel('height')})</label><input id="m-${key}" type="number" min="1" max="300" step="0.1" inputmode="decimal" value="${latest[key] ? displayLength(latest[key]) : ''}" placeholder="—"></div>`).join('')}</div><p class="kc-note">${icon('info')} Waist, hips and neck feed the Navy body-fat estimate. Leave a field empty if you are not measuring it.</p><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} Save measurements</button></div></form>`
  openModal({
    title: 'Body measurements',
    eyebrow: 'BODY COMPOSITION',
    subtitle: 'Optional, private, and stored locally',
    size: 'md',
    body,
    onMount(modal) {
      modal.querySelector('#measure-form').addEventListener('submit', event => {
        event.preventDefault()
        const chosenDate = modal.querySelector('#measure-date').value || date
        const measurement = { date: chosenDate }
        for (const [key] of fields) {
          const input = modal.querySelector(`#m-${key}`)
          if (input.value) measurement[key] = parseLength(input.value)
        }
        if (!Object.keys(measurement).some(key => key !== 'date')) { toast('Enter at least one measurement.', 'error'); return }
        update(() => saveMeasurement(measurement, chosenDate), { label: 'Save measurements' })
        closeModal(); refresh(); toast('Measurements saved')
      })
    },
  })
}

export function openProfileEditor(profile = getProfile()) {
  const isActive = profile.id === state.activeProfileId
  const units = state.settings.units
  const body = `<form id="profile-form" class="kc-form">
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-name">Name</label><input id="pf-name" type="text" maxlength="30" value="${esc(profile.name)}" data-autofocus required></div><div class="kc-field"><label for="pf-emoji">Emoji</label><input id="pf-emoji" type="text" maxlength="4" value="${esc(profile.emoji || '🌿')}"></div></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-sex">Equation setting</label><select id="pf-sex"><option value="female" ${profile.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${profile.sex === 'male' ? 'selected' : ''}>Male</option></select></div><div class="kc-field"><label for="pf-age">Age</label><input id="pf-age" type="number" min="18" max="100" value="${profile.age}" required></div></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-height">Height (${units === 'imperial' ? 'in' : 'cm'})</label><input id="pf-height" type="number" min="45" max="250" step="0.1" value="${displayLength(profile.heightCm)}" required></div><div class="kc-field"><label for="pf-weight">Current weight (${unitsLabel('weight')})</label><input id="pf-weight" type="number" min="20" max="500" step="0.1" value="${displayWeight(profile.weightKg)}" required></div></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-start">Starting weight (${unitsLabel('weight')})</label><input id="pf-start" type="number" min="20" max="500" step="0.1" value="${displayWeight(profile.startWeightKg)}"></div><div class="kc-field"><label for="pf-goal-weight">Goal weight (${unitsLabel('weight')})</label><input id="pf-goal-weight" type="number" min="20" max="500" step="0.1" value="${displayWeight(profile.goalWeightKg)}"></div></div>
    <div class="kc-field"><label for="pf-activity">Activity level</label><select id="pf-activity">${ACTIVITIES.map(item => `<option value="${item.value}" ${Number(profile.activity) === item.value ? 'selected' : ''}>${esc(item.label)} — ${esc(item.note)}</option>`).join('')}</select></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-goal">Goal</label><select id="pf-goal">${GOALS.map(item => `<option value="${item.id}" ${profile.goal === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></div><div class="kc-field"><label for="pf-rate">Pace</label><select id="pf-rate"><option value="0.25" ${Number(profile.rate) === 0.25 ? 'selected' : ''}>0.25 kg / week</option><option value="0.5" ${Number(profile.rate) === 0.5 ? 'selected' : ''}>0.5 kg / week</option><option value="0.75" ${Number(profile.rate) === 0.75 ? 'selected' : ''}>0.75 kg / week</option></select></div></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="pf-diet">Food preference</label><select id="pf-diet"><option value="omnivore" ${profile.diet === 'omnivore' ? 'selected' : ''}>Omnivore</option><option value="vegetarian" ${profile.diet === 'vegetarian' ? 'selected' : ''}>Vegetarian</option><option value="vegan" ${profile.diet === 'vegan' ? 'selected' : ''}>Vegan</option><option value="pescatarian" ${profile.diet === 'pescatarian' ? 'selected' : ''}>Pescatarian</option></select></div><div class="kc-field"><label>Allergens to flag</label><div class="kc-check-grid kc-check-grid--small">${ALLERGEN_TAGS.map(item => `<label class="kc-check"><input type="checkbox" value="${item.id}" ${profile.allergens?.includes(item.id) ? 'checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}</div></div></div>
    <p class="kc-note">These inputs estimate needs; they are not a diagnosis. For pregnancy, medical conditions or eating-disorder recovery, use a clinician’s plan.${!isActive ? ' You are editing another household profile.' : ''}</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} Save profile</button></div>
  </form>`
  openModal({
    title: isActive ? 'Your profile' : `Edit ${profile.name}`,
    eyebrow: 'PROFILE',
    subtitle: 'Targets recalculate automatically after a change',
    size: 'lg',
    body,
    onMount(modal) {
      modal.querySelector('#profile-form').addEventListener('submit', event => {
        event.preventDefault()
        const name = modal.querySelector('#pf-name').value.trim()
        const age = Number(modal.querySelector('#pf-age').value)
        const heightCm = parseLength(modal.querySelector('#pf-height').value)
        const weightKg = parseWeight(modal.querySelector('#pf-weight').value)
        if (!name || !age || !heightCm || !weightKg || age < 18 || age > 100 || heightCm < 100 || heightCm > 250 || weightKg < 20 || weightKg > 500) {
          toast('Check the name, age, height and weight.', 'error')
          return
        }
        const target = state.profiles.find(item => item.id === profile.id)
        const previousWeight = target.weightKg
        update(() => {
          target.name = name
          target.emoji = modal.querySelector('#pf-emoji').value.trim() || '🌿'
          target.sex = modal.querySelector('#pf-sex').value
          target.age = age
          target.heightCm = heightCm
          target.weightKg = weightKg
          target.startWeightKg = parseWeight(modal.querySelector('#pf-start').value) || weightKg
          target.goalWeightKg = parseWeight(modal.querySelector('#pf-goal-weight').value) || weightKg
          target.activity = Number(modal.querySelector('#pf-activity').value)
          target.goal = modal.querySelector('#pf-goal').value
          target.rate = Number(modal.querySelector('#pf-rate').value)
          target.diet = modal.querySelector('#pf-diet').value
          target.allergens = [...modal.querySelectorAll('.kc-check input:checked')].map(input => input.value)
          if (weightKg !== previousWeight) {
            if (isActive) {
              setWeight(weightKg, todayKey())
            } else {
              target.weights = target.weights.filter(item => item.date !== todayKey())
              target.weights.push({ date: todayKey(), kg: weightKg })
              target.weights.sort((a, b) => a.date.localeCompare(b.date))
            }
          }
        }, { label: 'Update profile' })
        closeModal(); refresh(); toast('Profile updated')
      })
    },
  })
}

export function openAddProfile() {
  const body = `<form id="add-profile-form" class="kc-form"><div class="kc-field"><label for="np-name">Profile name</label><input id="np-name" type="text" maxlength="30" placeholder="e.g. Ravi" data-autofocus required></div><div class="kc-check-grid kc-check-grid--small"><label class="kc-check"><input type="radio" name="np-type" value="blank" checked><span>Start blank</span></label><label class="kc-check"><input type="radio" name="np-type" value="copy"><span>Copy my targets</span></label></div><p class="kc-note">Each profile has its own diary, plan, weight history and favourites. Food data is shared on this device.</p><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('users')} Create profile</button></div></form>`
  openModal({
    title: 'Add a profile',
    eyebrow: 'HOUSEHOLD',
    subtitle: 'Keep separate diaries on one device',
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelector('#add-profile-form').addEventListener('submit', event => {
        event.preventDefault()
        const name = modal.querySelector('#np-name').value.trim()
        if (!name) { toast('Give the profile a name.', 'error'); return }
        const copy = modal.querySelector('input[name="np-type"]:checked').value === 'copy'
        let newProfile
        update(() => {
          newProfile = addProfile(name)
          if (copy) {
            const source = getProfile()
            newProfile.targetsMode = source.targetsMode
            newProfile.macroPreset = source.macroPreset
            newProfile.customMacros = source.customMacros ? { ...source.customMacros } : null
            newProfile.targets = { ...source.targets }
            newProfile.activity = source.activity
            newProfile.goal = source.goal
          }
          switchProfile(newProfile.id)
        }, { label: 'Add profile' })
        closeModal(); refresh(); toast(`${name} is ready`)
        if (newProfile) openProfileEditor(newProfile)
      })
    },
  })
}

export function openProfileSwitcher() {
  const body = `<div class="kc-profile-list">${state.profiles.map(profile => `<div class="kc-profile-row ${profile.id === state.activeProfileId ? 'is-active' : ''}"><span class="kc-profile-avatar">${esc(profile.emoji || '🌿')}</span><div><b>${esc(profile.name)}</b><small>${formatWeight(profile.weightKg, state.settings.units)} · ${esc(GOALS.find(goal => goal.id === profile.goal)?.label || 'Maintain')}</small></div><div class="kc-profile-actions">${profile.id === state.activeProfileId ? '<span class="kc-pill kc-pill--good">Active</span>' : `<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-switch="${esc(profile.id)}">Switch</button>`}<button type="button" class="kc-icon-btn" data-edit-profile="${esc(profile.id)}" aria-label="Edit ${esc(profile.name)}">${icon('edit')}</button>${state.profiles.length > 1 ? `<button type="button" class="kc-icon-btn kc-icon-btn--danger" data-remove-profile="${esc(profile.id)}" aria-label="Delete ${esc(profile.name)}">${icon('trash')}</button>` : ''}</div></div>`).join('')}</div><button type="button" class="kc-btn kc-btn--soft kc-btn--block" id="add-profile">${icon('plus')} Add another profile</button>`
  openModal({
    title: 'Profiles',
    eyebrow: 'WHO IS TRACKING?',
    subtitle: 'Everyone keeps a private diary on this device',
    size: 'md',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-switch]').forEach(button => button.addEventListener('click', () => {
        update(() => switchProfile(button.dataset.switch), { label: 'Switch profile' })
        closeModal(); refresh(); toast('Profile switched')
      }))
      modal.querySelectorAll('[data-edit-profile]').forEach(button => button.addEventListener('click', () => {
        const profile = state.profiles.find(item => item.id === button.dataset.editProfile)
        if (profile) openProfileEditor(profile)
      }))
      modal.querySelectorAll('[data-remove-profile]').forEach(button => button.addEventListener('click', async () => {
        const profile = state.profiles.find(item => item.id === button.dataset.removeProfile)
        if (!profile) return
        const ok = await confirmDialog({ title: `Delete ${profile.name}?`, message: 'This removes that profile’s diary, weight history and plan from this device. Other profiles are untouched.', confirmLabel: 'Delete profile', danger: true })
        if (!ok) return
        update(() => removeProfile(profile.id), { label: 'Delete profile' })
        closeModal(); refresh(); toast('Profile deleted')
      }))
      modal.querySelector('#add-profile').addEventListener('click', () => openAddProfile())
    },
  })
}

export function openTargetsEditor() {
  const profile = getProfile()
  const auto = autoTargets(profile)
  const targets = targetsFor(profile)
  const body = `<form id="targets-form" class="kc-form">
    <div class="kc-energy-summary">${statBlock('BMR', `${fmt(bmr(profile))} kcal`, 'At rest')}${statBlock('TDEE', `${fmt(tdee(profile))} kcal`, 'Maintenance')}${statBlock('Goal target', `${fmt(targetCalories(profile))} kcal`, GOALS.find(goal => goal.id === profile.goal)?.label || '')}</div>
    <div class="kc-form-grid"><div class="kc-field"><label for="tg-mode">How targets are set</label><select id="tg-mode"><option value="auto" ${profile.targetsMode === 'auto' ? 'selected' : ''}>Automatic from my profile</option><option value="manual" ${profile.targetsMode === 'manual' ? 'selected' : ''}>Manual overrides</option></select></div><div class="kc-field"><label for="tg-preset">Macro preset</label><select id="tg-preset">${MACRO_PRESETS.map(item => `<option value="${item.id}" ${profile.macroPreset === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></div></div>
    <div id="tg-custom" class="kc-form-grid kc-form-grid--3" ${profile.macroPreset === 'custom' ? '' : 'hidden'}>${[['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']].map(([key, label]) => `<div class="kc-field"><label for="tg-custom-${key}">${label}</label><input id="tg-custom-${key}" type="number" min="0" step="1" value="${profile.customMacros?.[key] ?? ''}"></div>`).join('')}</div>
    <p class="kc-form-label">Manual targets <span class="kc-form-label__hint">(used when manual mode is selected)</span></p>
    <div class="kc-form-grid kc-form-grid--3">
      <div class="kc-field"><label for="tg-kcal">Calories</label><input id="tg-kcal" type="number" min="800" max="6000" step="10" value="${targets.kcal}"></div>
      <div class="kc-field"><label for="tg-p">Protein (g)</label><input id="tg-p" type="number" min="0" max="500" step="1" value="${targets.protein}"></div>
      <div class="kc-field"><label for="tg-c">Carbs (g)</label><input id="tg-c" type="number" min="0" max="800" step="1" value="${targets.carbs}"></div>
      <div class="kc-field"><label for="tg-f">Fat (g)</label><input id="tg-f" type="number" min="0" max="300" step="1" value="${targets.fat}"></div>
      <div class="kc-field"><label for="tg-fib">Fibre (g)</label><input id="tg-fib" type="number" min="0" max="100" step="1" value="${targets.fiber}"></div>
      <div class="kc-field"><label for="tg-water">Water (${unitsLabel('water')})</label><input id="tg-water" type="number" min="200" max="6000" step="50" value="${displayVolume(targets.water)}"></div>
      <div class="kc-field"><label for="tg-sugar">Sugar limit (g)</label><input id="tg-sugar" type="number" min="0" max="300" step="1" value="${targets.sugar}"></div>
      <div class="kc-field"><label for="tg-sodium">Sodium limit (mg)</label><input id="tg-sodium" type="number" min="0" max="6000" step="50" value="${targets.sodium}"></div>
    </div>
    <div class="kc-auto-note">${icon('sparkles')}<span>Automatic target: <b>${fmt(auto.kcal)} kcal</b> · P ${auto.protein} g · C ${auto.carbs} g · F ${auto.fat} g · Fibre ${auto.fiber} g. The safety floor is ${fmt(calorieFloor(profile))} kcal.</span></div>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} Save targets</button></div>
  </form>`
  openModal({
    title: 'Daily targets',
    eyebrow: 'YOUR NUMBERS',
    subtitle: 'Automatic by default; override anything you need',
    size: 'lg',
    body,
    onMount(modal) {
      const mode = modal.querySelector('#tg-mode')
      const preset = modal.querySelector('#tg-preset')
      const custom = modal.querySelector('#tg-custom')
      preset.addEventListener('change', () => { custom.hidden = preset.value !== 'custom' })
      modal.querySelector('#targets-form').addEventListener('submit', event => {
        event.preventDefault()
        const customMacros = preset.value === 'custom' ? {
          p: Math.max(0, Number(modal.querySelector('#tg-custom-p').value) || 0),
          c: Math.max(0, Number(modal.querySelector('#tg-custom-c').value) || 0),
          f: Math.max(0, Number(modal.querySelector('#tg-custom-f').value) || 0),
        } : null
        update(() => {
          profile.targetsMode = mode.value
          profile.macroPreset = preset.value
          profile.customMacros = customMacros
          profile.targets = {
            kcal: Math.max(800, Number(modal.querySelector('#tg-kcal').value) || auto.kcal),
            protein: Math.max(0, Number(modal.querySelector('#tg-p').value) || 0),
            carbs: Math.max(0, Number(modal.querySelector('#tg-c').value) || 0),
            fat: Math.max(0, Number(modal.querySelector('#tg-f').value) || 0),
            fiber: Math.max(0, Number(modal.querySelector('#tg-fib').value) || 0),
            water: Math.round(state.settings.units === 'imperial' ? ozToMl(Number(modal.querySelector('#tg-water').value) || 0) : Number(modal.querySelector('#tg-water').value) || 0),
            sugar: Math.max(0, Number(modal.querySelector('#tg-sugar').value) || 0),
            sodium: Math.max(0, Number(modal.querySelector('#tg-sodium').value) || 0),
          }
        }, { label: 'Save targets' })
        closeModal(); refresh(); toast('Targets saved')
      })
    },
  })
}

export function openFasting() {
  const day = getDay(ui.date)
  const status = fastingProgress(day)
  const body = `<div class="kc-fasting">
    <div class="kc-fasting__status">${icon('clock')}<div><span>${status.active ? 'Fasting now' : day.fasting?.end ? 'Fast completed' : 'Not fasting'}</span><b>${status.elapsedLabel}</b><small>${status.active ? `Goal window ends ${status.endLabel}` : 'Choose a window and start when ready.'}</small></div></div>
    <div class="kc-fast-presets">${[12, 14, 16, 18, 20].map(hours => `<button type="button" class="kc-chip ${Number(day.fasting?.goalHours) === hours ? 'is-active' : ''}" data-hours="${hours}">${hours}:${24 - hours}</button>`).join('')}</div>
    <div class="kc-progress">${status.active ? `<span style="width:${status.pct}%"></span>` : ''}</div>
    <p class="kc-note">${icon('info')} A fasting timer is a habit tool, not a treatment. Skip fasting during pregnancy, with diabetes medication, or a history of disordered eating unless a clinician agrees.</p>
    <div class="kc-form-actions">${day.fasting?.start && !day.fasting?.end ? `<button type="button" class="kc-btn kc-btn--soft" id="fast-end">End fast</button>` : `<button type="button" class="kc-btn" id="fast-start">${icon('clock')} Start ${Number(day.fasting?.goalHours) || 16}h fast</button>`}${day.fasting?.start ? `<button type="button" class="kc-btn kc-btn--ghost" id="fast-reset">Reset timer</button>` : ''}</div>
    <p class="kc-meta" id="fast-updated">${status.active ? `Started ${new Date(day.fasting.start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>
  </div>`
  openModal({
    title: 'Fasting timer',
    eyebrow: 'INTERMITTENT FASTING',
    subtitle: relativeDate(ui.date),
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-hours]').forEach(button => button.addEventListener('click', () => {
        update(() => { getDay(ui.date).fasting.goalHours = Number(button.dataset.hours) }, { label: 'Fasting window' })
        openFasting()
      }))
      modal.querySelector('#fast-start')?.addEventListener('click', () => {
        update(() => { const value = getDay(ui.date); value.fasting = { ...value.fasting, start: new Date().toISOString(), end: null } }, { label: 'Start fast' })
        closeModal(); refresh(); toast('Fasting timer started')
      })
      modal.querySelector('#fast-end')?.addEventListener('click', () => {
        update(() => { const value = getDay(ui.date); value.fasting.end = new Date().toISOString() }, { label: 'End fast' })
        closeModal(); refresh(); toast('Fast completed')
      })
      modal.querySelector('#fast-reset')?.addEventListener('click', () => {
        update(() => { getDay(ui.date).fasting = { start: null, end: null, goalHours: 16 } }, { label: 'Reset fast' })
        closeModal(); refresh(); toast('Fasting timer reset')
      })
    },
  })
}

export function openDatePicker() {
  const body = `<form id="date-form" class="kc-form"><div class="kc-field"><label for="date-input">Jump to a date</label><input id="date-input" type="date" value="${ui.date}" max="${todayKey()}" data-autofocus></div><div class="kc-quick-dates"><button type="button" class="kc-chip" data-date="${todayKey()}">Today</button><button type="button" class="kc-chip" data-date="${addDays(todayKey(), -1)}">Yesterday</button><button type="button" class="kc-chip" data-date="${addDays(todayKey(), -7)}">A week ago</button></div><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('calendar')} Open day</button></div></form>`
  openModal({
    title: 'Choose a day',
    eyebrow: 'CALENDAR',
    subtitle: 'Browse past diaries and trends',
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => { closeModal(); setDate(button.dataset.date) }))
      modal.querySelector('#date-form').addEventListener('submit', event => {
        event.preventDefault()
        const value = modal.querySelector('#date-input').value
        if (!value) return
        closeModal(); setDate(value)
      })
    },
  })
}

export function openTemplateSave({ date = ui.date, meal = 'breakfast' } = {}) {
  const day = getDay(date)
  const items = day.meals[meal] || []
  const body = items.length ? `<form id="template-form" class="kc-form"><div class="kc-field"><label for="tmpl-name">Template name</label><input id="tmpl-name" type="text" maxlength="40" value="${esc(MEALS.find(item => item.id === meal)?.name || '')} favourites" data-autofocus required></div><div class="kc-field"><label for="tmpl-meal">Meal slot</label><select id="tmpl-meal">${MEALS.map(item => `<option value="${item.id}" ${item.id === meal ? 'selected' : ''}>${item.name}</option>`).join('')}</select></div><p class="kc-note">${items.length} item${items.length === 1 ? '' : 's'} · ${fmt(items.reduce((sum, item) => sum + item.nutrients.kcal, 0))} kcal. Templates are saved to this profile.</p><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('copy')} Save template</button></div></form>` : `<div class="kc-empty">${icon('copy')}<h3>This meal is empty</h3><p>Add a few foods first, then save the whole meal as a reusable template.</p></div>`
  openModal({
    title: 'Save meal template',
    eyebrow: 'REUSE A MEAL',
    subtitle: relativeDate(date),
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelector('#template-form')?.addEventListener('submit', event => {
        event.preventDefault()
        const name = modal.querySelector('#tmpl-name').value.trim()
        const selectedMeal = modal.querySelector('#tmpl-meal').value
        if (!name) return
        update(() => saveTemplate(name, selectedMeal, getDay(date).meals[selectedMeal] || []), { label: 'Save meal template' })
        closeModal(); refresh(); toast('Meal template saved')
      })
    },
  })
}

export function openTemplateList({ date = ui.date, meal = null } = {}) {
  const profile = getProfile()
  const templates = profile.templates || []
  const body = templates.length ? `<div class="kc-template-list">${templates.map(template => `<div class="kc-template-row"><div><b>${esc(template.name)}</b><small>${template.items.length} items · ${MEALS.find(item => item.id === template.meal)?.name || 'Any meal'}</small></div><div class="kc-template-actions"><button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-apply="${esc(template.id)}">${icon('plus')} Apply</button><button type="button" class="kc-icon-btn kc-icon-btn--danger" data-delete-template="${esc(template.id)}" aria-label="Delete ${esc(template.name)}">${icon('trash')}</button></div></div>`).join('')}</div><p class="kc-note">Templates are applied to ${relativeDate(date)}. ${meal ? `Default slot: ${MEALS.find(item => item.id === meal)?.name}.` : ''}</p>` : `<div class="kc-empty">${icon('copy')}<h3>No templates yet</h3><p>Open a meal in your diary and choose “Save as template” to build one.</p></div>`
  openModal({
    title: 'Meal templates',
    eyebrow: 'REUSE A MEAL',
    subtitle: `${templates.length} saved`,
    size: 'md',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-apply]').forEach(button => button.addEventListener('click', () => {
        const template = profile.templates.find(item => item.id === button.dataset.apply)
        if (!template) return
        update(() => applyTemplate(template.id, date, template.meal), { label: 'Apply meal template' })
        closeModal(); refresh(); toast(`${template.items.length} items added to ${MEALS.find(item => item.id === template.meal)?.name || 'your diary'}`)
      }))
      modal.querySelectorAll('[data-delete-template]').forEach(button => button.addEventListener('click', () => {
        update(() => deleteTemplate(button.dataset.deleteTemplate), { label: 'Delete meal template' })
        openTemplateList({ date, meal })
      }))
    },
  })
}

export function openCopyDay({ date = ui.date } = {}) {
  const options = [
    { key: addDays(date, -1), label: 'Yesterday' },
    { key: addDays(date, -7), label: 'A week ago' },
    { key: addDays(date, -2), label: 'Two days ago' },
  ]
  const sourceHasData = key => dayHasData(getDay(key, false))
  const body = `<div class="kc-copy-dialog"><p class="kc-copy">Choose a day to copy into <b>${esc(relativeDate(date))}</b>. Existing entries are kept; duplicates are skipped.</p><div class="kc-copy-options">${options.map(option => `<button type="button" class="kc-copy-option" data-copy-day="${option.key}" ${sourceHasData(option.key) ? '' : 'disabled'}><b>${esc(option.label)}</b><small>${esc(prettyDate(option.key))} · ${sourceHasData(option.key) ? 'has entries' : 'empty'}</small></button>`).join('')}</div><div class="kc-copy-meals"><span>Or copy one meal from yesterday</span><div>${MEALS.map(meal => `<button type="button" class="kc-chip" data-copy-meal="${meal.id}">${meal.name}</button>`).join('')}</div></div><p class="kc-note">Copying a day does not copy water, notes or weight.</p></div>`
  openModal({
    title: 'Copy a day',
    eyebrow: 'FASTER LOGGING',
    subtitle: 'Repeat what already worked',
    size: 'md',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-copy-day]').forEach(button => button.addEventListener('click', () => {
        const source = button.dataset.copyDay
        let copied = 0
        update(() => { copied = copyDay(source, date) }, { label: 'Copy day' })
        closeModal(); refresh(); toast(copied ? `${copied} entries copied` : 'Nothing new to copy')
      }))
      modal.querySelectorAll('[data-copy-meal]').forEach(button => button.addEventListener('click', () => {
        const meal = button.dataset.copyMeal
        let copied = 0
        update(() => { copied = copyMeal(addDays(date, -1), date, meal) }, { label: 'Copy meal' })
        closeModal(); refresh(); toast(copied ? `${copied} items added` : 'That meal was already copied or is empty')
      }))
    },
  })
}

export function openFoodSwap(entry, date, meal) {
  const profile = getProfile()
  const currentFood = entry.foodId ? findFood(entry.foodId) : null
  if (!currentFood) { toast('Only database foods can be swapped.', 'error'); return }
  const kcalPer100 = entry.grams > 0 ? entry.nutrients.kcal / entry.grams * 100 : currentFood.kcal
  const alternatives = foodList()
    .filter(food => food.id !== currentFood.id && foodAllowed(food, profile))
    .filter(food => food.cat === currentFood.cat || Math.abs(food.kcal - kcalPer100) <= Math.max(60, kcalPer100 * 0.35))
    .sort((a, b) => b.p - a.p)
    .slice(0, 12)
  const body = `<div class="kc-copy"><p>Swap <b>${esc(entry.name)}</b> (${fmt(entry.nutrients.kcal)} kcal) for a similar food. Portions are adjusted to match the calories.</p></div><div class="kc-swap-list">${alternatives.map(food => {
    const grams = Math.max(10, Math.round(entry.nutrients.kcal / Math.max(1, food.kcal) * 100 / 5) * 5)
    return `<button type="button" class="kc-swap-row" data-swap="${esc(food.id)}"><span class="kc-food-avatar">${esc(food.name.slice(0, 1))}</span><span><b>${esc(food.name)}</b><small>${grams} g · ${fmt(food.kcal * grams / 100)} kcal · P ${fmt(food.p * grams / 100, 1)} g</small></span>${icon('right')}</button>`
  }).join('')}</div><p class="kc-note">${icon('info')} Values are estimates. Choose a food that suits the meal, not only the calories.</p>`
  openModal({
    title: 'Find a swap',
    eyebrow: 'HIGHER-PROTEIN OPTIONS',
    subtitle: `Current: ${fmt(entry.nutrients.kcal)} kcal · P ${fmt(entry.nutrients.p, 1)} g`,
    size: 'md',
    body,
    onMount(modal) {
      modal.querySelectorAll('[data-swap]').forEach(button => button.addEventListener('click', () => {
        const replacement = findFood(button.dataset.swap)
        if (!replacement) return
        const grams = Math.max(10, Math.round(entry.nutrients.kcal / Math.max(1, replacement.kcal) * 100 / 5) * 5)
        update(() => {
          const found = findEntry(date, entry.id)
          if (!found) return
          removeEntry(date, entry.id)
          addFood(date, found.meal, replacement, grams, 1, `${grams} g`)
        }, { label: 'Swap food' })
        closeModal(); refresh(); toast(`Swapped for ${replacement.name}`)
      }))
      void meal
    },
  })
}

export function openReport(date = ui.date) {
  const profile = getProfile()
  const day = getDay(date)
  const totals = dayTotals(profile, day)
  const score = scoreDay(profile, day)
  const weight = day.weight || profile.weightKg
  const body = `<div class="kc-report kc-print-area">
    <div class="kc-report__head"><div><p class="kc-eyebrow">KCAL DAILY REPORT</p><h3>${esc(profile.name)} · ${esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h3></div><div class="kc-report__score"><b>${score.score}</b><span>/100</span><small>${esc(score.grade)}</small></div></div>
    <div class="kc-report__grid">${statBlock('Calories', `${fmt(totals.food.kcal)} / ${fmt(totals.targets.kcal)}`, 'kcal')}${statBlock('Protein', `${fmt(totals.food.p)} / ${fmt(totals.targets.protein)}`, 'g')}${statBlock('Carbs', `${fmt(totals.food.c)} / ${fmt(totals.targets.carbs)}`, 'g')}${statBlock('Fat', `${fmt(totals.food.f)} / ${fmt(totals.targets.fat)}`, 'g')}${statBlock('Water', `${fmt(day.water)} / ${fmt(totals.targets.water)}`, 'ml')}${statBlock('Weight', formatWeight(weight, state.settings.units), '')}</div>
    <table class="kc-report__table"><thead><tr><th>Meal</th><th>Food</th><th>Portion</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr></thead><tbody>${MEALS.map(meal => {
      const entries = day.meals[meal.id] || []
      if (!entries.length) return `<tr><td>${meal.name}</td><td colspan="6" class="kc-muted">No entries</td></tr>`
      return entries.map((entry, index) => `<tr><td>${index === 0 ? meal.name : ''}</td><td>${esc(entry.name)}</td><td>${esc(entry.portionLabel)}</td><td>${fmt(entry.nutrients.kcal)}</td><td>${fmt(entry.nutrients.p, 1)}</td><td>${fmt(entry.nutrients.c, 1)}</td><td>${fmt(entry.nutrients.f, 1)}</td></tr>`).join('')
    }).join('')}</tbody></table>
    <div class="kc-report__foot"><div><b>Notes</b><p>${esc(day.notes || '—')}</p></div><div><b>Movement</b><p>${day.exercise.length ? day.exercise.map(item => `${esc(item.name)} (${item.minutes} min, ${item.kcal} kcal)`).join(' · ') : 'No exercise logged.'}${day.steps ? ` · ${fmt(day.steps)} steps` : ''}</p></div></div>
    <p class="kc-report__disclaimer">Generated locally by kcal · CensorisLabs. Estimates only, not medical advice.</p>
  </div>`
  openModal({
    title: 'Daily report',
    eyebrow: 'PRINT OR SAVE',
    subtitle: 'Use your browser or print dialog to save as PDF',
    size: 'lg',
    body,
    footer: `<button type="button" class="kc-btn kc-btn--ghost" id="report-copy">${icon('copy')} Copy summary</button><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Close</button><button type="button" class="kc-btn" id="report-print">${icon('print')} Print / PDF</button>`,
    onMount(modal) {
      modal.querySelector('#report-print').addEventListener('click', () => window.print())
      modal.querySelector('#report-copy').addEventListener('click', async () => {
        const lines = [`kcal · ${prettyDate(date)}`, `Calories: ${totals.food.kcal} / ${totals.targets.kcal} kcal`, `Protein: ${totals.food.p} g · Carbs: ${totals.food.c} g · Fat: ${totals.food.f} g`, `Water: ${day.water} ml · Steps: ${day.steps || 0}`, ...MEALS.map(meal => `${meal.name}: ${(day.meals[meal.id] || []).map(entry => `${entry.name} (${entry.portionLabel})`).join(', ') || '—'}`), `Score: ${score.score}/100 (${score.grade})`]
        const ok = await copyText(lines.join('\n'))
        toast(ok ? 'Summary copied' : 'Could not copy the summary', ok ? 'ok' : 'error')
      })
    },
  })
}

export function openImportDialog() {
  const body = `<form id="import-form" class="kc-form"><div class="kc-field"><label for="import-file">kcal JSON backup</label><input id="import-file" type="file" accept="application/json,.json" required></div><p class="kc-warning">${icon('info')} Importing replaces the data currently on this device. Export a backup first if you are unsure.</p><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('upload')} Import backup</button></div></form>`
  openModal({
    title: 'Import a backup',
    eyebrow: 'RESTORE',
    subtitle: 'JSON files exported by kcal',
    size: 'sm',
    body,
    onMount(modal) {
      modal.querySelector('#import-form').addEventListener('submit', async event => {
        event.preventDefault()
        const file = modal.querySelector('#import-file').files?.[0]
        if (!file) return
        try {
          const text = await file.text()
          const payload = JSON.parse(text)
          update(() => importPayload(payload), { label: 'Import backup' })
          closeModal(); refresh(); toast('Backup imported')
        } catch (error) {
          toast(error.message || 'That file could not be imported.', 'error')
        }
      })
    },
  })
}

export function openShortcuts() {
  const shortcuts = [
    ['N', 'Quick add food'],
    ['W', 'Add 250 ml of water'],
    ['D', 'Open the diary'],
    ['P', 'Open progress'],
    ['T', 'Jump to today'],
    ['/', 'Open food search'],
    ['Ctrl / ⌘ + Z', 'Undo the last change'],
    ['Esc', 'Close a dialog'],
  ]
  openModal({
    title: 'Keyboard shortcuts',
    eyebrow: 'MOVE FASTER',
    subtitle: 'Available on desktop and in the Windows app',
    size: 'sm',
    body: `<div class="kc-shortcuts">${shortcuts.map(([key, label]) => `<div><kbd>${esc(key)}</kbd><span>${esc(label)}</span></div>`).join('')}</div><p class="kc-note">Shortcuts pause while you are typing in a field.</p>`,
  })
}

export function openRecipeActions(recipe) {
  const totals = recipeTotals(recipe)
  const body = `<div class="kc-copy"><p><b>${esc(recipe.name)}</b> · ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · ${recipe.minutes} min</p><p class="kc-muted">${recipe.items.map(item => `${esc(findFood(item.foodId)?.name || 'Unknown')} ${item.g} g`).join(' · ')}</p><p>${fmt(totals.perServing.kcal)} kcal · P ${fmt(totals.perServing.p, 1)} · C ${fmt(totals.perServing.c, 1)} · F ${fmt(totals.perServing.f, 1)} per serving</p>${recipe.steps?.length ? `<ol class="kc-steps">${recipe.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}</div>`
  openModal({
    title: 'Recipe',
    eyebrow: 'YOUR KITCHEN',
    subtitle: recipe.tags?.join(' · ') || '',
    size: 'sm',
    body,
    footer: `${recipe.custom ? `<button type="button" class="kc-btn kc-btn--danger kc-btn--soft" id="recipe-delete">${icon('trash')} Delete</button>` : ''}<button type="button" class="kc-btn kc-btn--ghost" id="recipe-edit">${icon('edit')} Edit</button><button type="button" class="kc-btn" id="recipe-log">${icon('plus')} Log a serving</button>`,
    onMount(modal) {
      modal.querySelector('#recipe-edit').addEventListener('click', () => {
        import('./dialogs-food.js').then(module => module.openRecipeBuilder(recipe))
      })
      modal.querySelector('#recipe-log').addEventListener('click', () => {
        import('./dialogs-food.js').then(module => module.openRecipeLog(recipe, { date: ui.date }))
      })
      modal.querySelector('#recipe-delete')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Delete this recipe?', message: 'Past diary entries keep their recorded nutrition.', confirmLabel: 'Delete', danger: true })
        if (!ok) return
        update(() => deleteRecipe(recipe.id), { label: 'Delete recipe' })
        closeModal(); refresh(); toast('Recipe deleted')
      })
    },
  })
}

export function openResetDialog() {
  const body = `<div class="kc-copy"><p>This erases every profile, diary, plan, custom food and recipe stored on this device. It cannot be undone.</p><p class="kc-warning">${icon('info')} Export a JSON backup first if you might want this data later.</p></div>`
  openModal({
    title: 'Reset all data?',
    eyebrow: 'DANGER ZONE',
    size: 'sm',
    body,
    footer: `<button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button type="button" class="kc-btn kc-btn--danger" id="reset-confirm">Reset everything</button>`,
    onMount(modal) {
      modal.querySelector('#reset-confirm').addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Last check', message: 'All local kcal data will be deleted now.', confirmLabel: 'Yes, reset', danger: true })
        if (!ok) return
        update(() => resetEverything(), { label: 'Reset all data', snapshot: false })
        closeModal(); refresh(); toast('All kcal data was reset')
      })
    },
  })
}
