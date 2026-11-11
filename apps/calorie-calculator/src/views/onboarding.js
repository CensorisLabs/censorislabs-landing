import { getProfile, update, state, createDemoProfile } from '../lib/store.js'
import { ACTIVITIES, GOALS, targetsFor, bmr, tdee, targetCalories } from '../lib/calc.js'
import { icon, fmt, esc, openModal, closeModal, toast } from '../lib/ui.js'
import { refresh, go } from '../lib/runtime.js'

const STEPS = 5

export function openOnboarding() {
  const profile = getProfile()
  const draft = {
    name: profile.name === 'You' ? '' : profile.name,
    emoji: profile.emoji || '🌿',
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activity: profile.activity,
    goal: profile.goal,
    rate: profile.rate,
    diet: profile.diet,
  }
  let step = 0

  const modal = openModal({
    title: 'Welcome to kcal',
    eyebrow: 'CENSORISLABS · DAILY TRACKER',
    subtitle: 'Five short steps. Everything stays on this device.',
    dismissible: false,
    size: 'lg',
    className: 'kc-onboarding',
    body: '<div id="onboarding-step"></div>',
  })
  const container = modal.querySelector('#onboarding-step')

  const progress = () => `<div class="kc-onboard-progress">${Array.from({ length: STEPS }, (_, index) => `<span class="${index <= step ? 'is-done' : ''}"></span>`).join('')}<small>Step ${step + 1} of ${STEPS}</small></div>`

  const collect = () => {
    const name = container.querySelector('#onboard-name')
    if (name) draft.name = name.value.trim()
    const emoji = container.querySelector('#onboard-emoji')
    if (emoji) draft.emoji = emoji.value.trim() || '🌿'
    const sex = container.querySelector('#onboard-sex')
    if (sex) draft.sex = sex.value
    const age = container.querySelector('#onboard-age')
    if (age) draft.age = Number(age.value) || draft.age
    const height = container.querySelector('#onboard-height')
    if (height) draft.heightCm = Number(height.value) || draft.heightCm
    const weight = container.querySelector('#onboard-weight')
    if (weight) draft.weightKg = Number(weight.value) || draft.weightKg
    const activity = container.querySelector('input[name="onboard-activity"]:checked')
    if (activity) draft.activity = Number(activity.value)
    const goal = container.querySelector('input[name="onboard-goal"]:checked')
    if (goal) draft.goal = goal.value
    const rate = container.querySelector('#onboard-rate')
    if (rate) draft.rate = Number(rate.value) || draft.rate
    const diet = container.querySelector('input[name="onboard-diet"]:checked')
    if (diet) draft.diet = diet.value
  }

  const render = () => {
    if (step === 0) {
      container.innerHTML = `${progress()}
        <div class="kc-onboard-welcome"><div class="kc-onboard-mark">kcal</div>      <h2>Food, energy and the small habits around them.</h2><p>A complete daily tracker — 160 foods, a private diary, weight and measurement trends, micronutrients, recipes, a weekly planner, a 60-tool Studio and reports. No account, ads or analytics.</p><ul class="kc-onboard-points"><li>${icon('check')} Log a meal in seconds</li><li>${icon('check')} See kcal, protein, fibre and water together</li><li>${icon('check')} Works offline, including the installed apps</li><li>${icon('check')} Your entries never leave this device</li></ul><div class="kc-onboard-actions"><button type="button" class="kc-btn" id="onboard-start">Set up my targets</button><button type="button" class="kc-btn kc-btn--ghost" id="onboard-demo">Explore with demo data</button></div><button type="button" class="kc-text-btn" id="onboard-skip">Skip setup and use sensible defaults</button></div>`
      container.querySelector('#onboard-start').addEventListener('click', () => { step = 1; render() })
      container.querySelector('#onboard-demo').addEventListener('click', () => {
        update(() => createDemoProfile(), { label: 'Create demo profile' })
        closeModal(); refresh(); go('today'); toast('Demo profile loaded with sample history')
      })
      container.querySelector('#onboard-skip').addEventListener('click', finish)
      return
    }
    if (step === 1) {
      container.innerHTML = `${progress()}<div class="kc-onboard-form"><p class="kc-eyebrow">ABOUT YOU</p><h2>What should we call you?</h2><p class="kc-muted">This stays local and appears only in your own app.</p><div class="kc-form-grid"><div class="kc-field"><label for="onboard-name">Name</label><input id="onboard-name" type="text" maxlength="30" value="${esc(draft.name)}" placeholder="Your name" data-autofocus></div><div class="kc-field"><label for="onboard-emoji">Emoji</label><input id="onboard-emoji" type="text" maxlength="4" value="${esc(draft.emoji)}"></div></div><div class="kc-field"><label for="onboard-sex">Equation setting</label><select id="onboard-sex"><option value="female" ${draft.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${draft.sex === 'male' ? 'selected' : ''}>Male</option></select></div><p class="kc-note">The equation uses sex as a physiological input. It is not a gender question.</p><div class="kc-onboard-actions"><button type="button" class="kc-btn kc-btn--ghost" data-back>Back</button><button type="button" class="kc-btn" data-next>Continue</button></div></div>`
    } else if (step === 2) {
      container.innerHTML = `${progress()}<div class="kc-onboard-form"><p class="kc-eyebrow">BODY</p><h2>A starting point</h2><p class="kc-muted">Use a recent measurement, not a goal. You can change this at any time.</p><div class="kc-form-grid kc-form-grid--3"><div class="kc-field"><label for="onboard-age">Age</label><input id="onboard-age" type="number" min="18" max="100" value="${draft.age}" data-autofocus></div><div class="kc-field"><label for="onboard-height">Height (cm)</label><input id="onboard-height" type="number" min="120" max="230" step="0.5" value="${draft.heightCm}"></div><div class="kc-field"><label for="onboard-weight">Weight (kg)</label><input id="onboard-weight" type="number" min="35" max="250" step="0.1" value="${draft.weightKg}"></div></div><div class="kc-sex-help">${icon('info')} You can switch to pounds and inches in Settings after setup.</div><div class="kc-onboard-actions"><button type="button" class="kc-btn kc-btn--ghost" data-back>Back</button><button type="button" class="kc-btn" data-next>Continue</button></div></div>`
    } else if (step === 3) {
      container.innerHTML = `${progress()}<div class="kc-onboard-form"><p class="kc-eyebrow">ACTIVITY</p><h2>How active is an ordinary week?</h2><p class="kc-muted">Choose the closest average. Exercise can also be logged separately.</p><div class="kc-choice-list">${ACTIVITIES.map(item => `<label class="kc-choice"><input type="radio" name="onboard-activity" value="${item.value}" ${Number(draft.activity) === item.value ? 'checked' : ''}><span><b>${esc(item.label)}</b><small>${esc(item.note)}</small></span></label>`).join('')}</div><div class="kc-onboard-actions"><button type="button" class="kc-btn kc-btn--ghost" data-back>Back</button><button type="button" class="kc-btn" data-next>Continue</button></div></div>`
    } else if (step === 4) {
      container.innerHTML = `${progress()}<div class="kc-onboard-form"><p class="kc-eyebrow">GOAL</p><h2>What are you working toward?</h2><div class="kc-choice-list kc-choice-list--three">${GOALS.map(item => `<label class="kc-choice"><input type="radio" name="onboard-goal" value="${item.id}" ${draft.goal === item.id ? 'checked' : ''}><span><b>${esc(item.label)}</b><small>${esc(item.note)}</small></span></label>`).join('')}</div><div class="kc-form-grid"><div class="kc-field"><label for="onboard-rate">Pace</label><select id="onboard-rate"><option value="0.25" ${Number(draft.rate) === 0.25 ? 'selected' : ''}>Gentle · 0.25 kg / week</option><option value="0.5" ${Number(draft.rate) === 0.5 ? 'selected' : ''}>Steady · 0.5 kg / week</option><option value="0.75" ${Number(draft.rate) === 0.75 ? 'selected' : ''}>Faster · 0.75 kg / week</option></select></div><div class="kc-field"><label>Food preference</label><div class="kc-radio-row">${[['omnivore', 'Everything'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['pescatarian', 'Pescatarian']].map(([value, label]) => `<label class="kc-radio-pill"><input type="radio" name="onboard-diet" value="${value}" ${draft.diet === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></div></div><div class="kc-onboard-actions"><button type="button" class="kc-btn kc-btn--ghost" data-back>Back</button><button type="button" class="kc-btn" data-next>Review targets</button></div></div>`
    } else {
      const preview = { ...profile, ...draft }
      const goals = targetsFor(preview)
      const projectionDays = draft.goal === 'maintain' ? null : Math.ceil(Math.abs(draft.weightKg - profile.goalWeightKg || 5) / draft.rate * 7)
      container.innerHTML = `${progress()}<div class="kc-onboard-form"><p class="kc-eyebrow">READY</p><h2>${esc(draft.name || 'Your')} plan is ready.</h2><p class="kc-muted">These are starting estimates. Adjust after two or three weeks of real data.</p><div class="kc-target-review"><div class="kc-target-review__main"><span>DAILY ENERGY TARGET</span><strong>${fmt(goals.kcal)}</strong><small>kcal</small></div><div class="kc-target-review__macros"><div><span>Protein</span><b>${goals.protein} g</b></div><div><span>Carbs</span><b>${goals.carbs} g</b></div><div><span>Fat</span><b>${goals.fat} g</b></div><div><span>Fibre</span><b>${goals.fiber} g</b></div></div></div><div class="kc-target-review__formula">${icon('info')} BMR ${fmt(bmr(preview))} kcal × ${preview.activity} activity = ${fmt(tdee(preview))} kcal maintenance. Your goal target is ${fmt(targetCalories(preview))} kcal.${projectionDays ? ` At ${draft.rate} kg/week, a ${Math.abs(draft.weightKg - profile.goalWeightKg).toFixed(1)} kg change takes roughly ${Math.ceil(projectionDays / 7)} weeks.` : ''}</div><div class="kc-onboard-actions"><button type="button" class="kc-btn kc-btn--ghost" data-back>Back</button><button type="button" class="kc-btn" data-finish>${icon('check')} Start tracking</button></div><p class="kc-onboard-fine">You can change targets, units, macros and appearance from Settings. kcal is not medical advice.</p></div>`
    }
    container.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => { collect(); step = Math.max(0, step - 1); render() }))
    container.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
      collect()
      if (step === 1 && (!draft.name || draft.name.length < 1)) { toast('Add a name or the word “Me”.', 'error'); return }
      if (step === 2 && (draft.age < 18 || draft.age > 100 || draft.heightCm < 120 || draft.heightCm > 230 || draft.weightKg < 35 || draft.weightKg > 250)) { toast('Check age, height and weight.', 'error'); return }
      step = Math.min(STEPS - 1, step + 1)
      render()
    }))
    container.querySelector('[data-finish]')?.addEventListener('click', finish)
  }

  function finish() {
    update(() => {
      const target = getProfile()
      target.name = draft.name || 'Me'
      target.emoji = draft.emoji || '🌿'
      target.sex = draft.sex
      target.age = draft.age
      target.heightCm = draft.heightCm
      target.weightKg = draft.weightKg
      target.startWeightKg = profile.startWeightKg || draft.weightKg
      target.goalWeightKg = profile.goalWeightKg || draft.weightKg
      target.activity = draft.activity
      target.goal = draft.goal
      target.rate = draft.rate
      target.diet = draft.diet
      target.goalWeightKg = draft.goal === 'maintain' ? draft.weightKg : Number((draft.weightKg + (draft.goal === 'lose' ? -5 : 5)).toFixed(1))
      target.startWeightKg = draft.weightKg
      target.targetsMode = 'auto'
      target.targets = targetsFor(target)
      state.onboarded = true
    }, { label: 'Complete setup' })
    closeModal()
    refresh()
    go('today')
    toast('Welcome to kcal')
  }

  render()
}
