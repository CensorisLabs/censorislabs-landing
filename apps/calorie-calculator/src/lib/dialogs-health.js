import { logVital, saveMedication, logSymptom, update, todayKey } from './store.js'
import { openModal, closeModal, toast, icon } from './ui.js'
import { refresh } from './runtime.js'

const BP_HINT = 'Systolic is the top number, diastolic the bottom one. Sit for five minutes before measuring.'

export function openVitalsLog({ date = todayKey() } = {}) {
  const body = `<form id="vitals-form" class="kc-form">
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="v-date">Date</label><input id="v-date" type="date" value="${date}" max="${todayKey()}"></div>
      <div class="kc-field"><label for="v-note">Label (optional)</label><input id="v-note" type="text" maxlength="40" placeholder="e.g. morning, after walk"></div>
    </div>
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="v-sys">Blood pressure — systolic (mmHg)</label><input id="v-sys" type="number" min="70" max="260" inputmode="numeric" placeholder="e.g. 118" data-autofocus></div>
      <div class="kc-field"><label for="v-dia">Blood pressure — diastolic (mmHg)</label><input id="v-dia" type="number" min="40" max="160" inputmode="numeric" placeholder="e.g. 76"></div>
    </div>
    <p class="kc-note">${icon('info')} ${BP_HINT}</p>
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="v-pulse">Resting pulse (bpm)</label><input id="v-pulse" type="number" min="30" max="230" inputmode="numeric" placeholder="e.g. 64"></div>
      <div class="kc-field"><label for="v-spo2">Blood oxygen SpO₂ (%)</label><input id="v-spo2" type="number" min="50" max="100" inputmode="numeric" placeholder="e.g. 98"></div>
      <div class="kc-field"><label for="v-glucose">Blood glucose (mg/dL)</label><input id="v-glucose" type="number" min="20" max="700" inputmode="numeric" placeholder="e.g. 92"></div>
      <div class="kc-field"><label for="v-context">Glucose reading</label><select id="v-context"><option value="fasting">Fasting</option><option value="post">After a meal</option><option value="random">Any time</option></select></div>
      <div class="kc-field"><label for="v-temp">Body temperature (°C)</label><input id="v-temp" type="number" min="30" max="45" step="0.1" inputmode="decimal" placeholder="e.g. 36.8"></div>
      <div class="kc-field"><label for="v-resp">Breathing rate (breaths/min)</label><input id="v-resp" type="number" min="4" max="80" inputmode="numeric" placeholder="e.g. 14"></div>
    </div>
    <p class="kc-note">Fill any fields you measured and leave the rest empty. Entries stay on this device and are not medical advice.</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('heart')} Save reading</button></div>
  </form>`

  openModal({
    title: 'Log a reading',
    eyebrow: 'VITALS',
    subtitle: 'Blood pressure, pulse, oxygen, glucose and temperature',
    body,
    onMount(modal) {
      modal.querySelector('#vitals-form').addEventListener('submit', event => {
        event.preventDefault()
        const value = id => modal.querySelector(`#${id}`).value.trim()
        const numbers = {
          systolic: Number(value('v-sys')) || 0,
          diastolic: Number(value('v-dia')) || 0,
          pulse: Number(value('v-pulse')) || 0,
          glucose: Number(value('v-glucose')) || 0,
          spo2: Number(value('v-spo2')) || 0,
          tempC: Number(value('v-temp')) || 0,
          respRate: Number(value('v-resp')) || 0,
        }
        if ((numbers.systolic && !numbers.diastolic) || (!numbers.systolic && numbers.diastolic)) {
          toast('Enter both blood pressure numbers, or neither.', 'error')
          return
        }
        if (!Object.values(numbers).some(Boolean)) {
          toast('Add at least one measurement.', 'error')
          return
        }
        if (numbers.systolic && (numbers.systolic <= numbers.diastolic)) {
          toast('Systolic should be the higher number.', 'error')
          return
        }
        update(() => logVital({
          ...numbers,
          glucoseContext: value('v-context') || 'random',
          note: value('v-note'),
          date: value('v-date') || date,
        }), { label: 'Log vitals' })
        closeModal()
        refresh()
        toast('Reading saved locally')
      })
    },
  })
}

export function openMedicationAdd() {
  const body = `<form id="med-form" class="kc-form">
    <div class="kc-field"><label for="med-name">Medicine or supplement</label><input id="med-name" type="text" maxlength="80" placeholder="e.g. Vitamin D3" data-autofocus required></div>
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="med-dose">Dose (optional)</label><input id="med-dose" type="text" maxlength="60" placeholder="e.g. 1 tablet · 60,000 IU"></div>
      <div class="kc-field"><label for="med-time">Reminder time (optional)</label><input id="med-time" type="time"></div>
    </div>
    <div class="kc-field"><label for="med-note">Note (optional)</label><input id="med-note" type="text" maxlength="200" placeholder="e.g. with breakfast"></div>
    <p class="kc-note">${icon('info')} AbsoluteCal only keeps a tick-list for today. It does not send notifications or change any prescription — follow your clinician's instructions.</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} Add medicine</button></div>
  </form>`

  openModal({
    title: 'Add a medicine',
    eyebrow: 'MEDICATIONS',
    subtitle: 'Track a daily dose and its adherence',
    body,
    onMount(modal) {
      modal.querySelector('#med-form').addEventListener('submit', event => {
        event.preventDefault()
        const name = modal.querySelector('#med-name').value.trim()
        if (!name) { toast('Give the medicine a name.', 'error'); return }
        update(() => saveMedication({
          name,
          dose: modal.querySelector('#med-dose').value,
          time: modal.querySelector('#med-time').value,
          note: modal.querySelector('#med-note').value,
        }), { label: 'Add medicine' })
        closeModal()
        refresh()
        toast(`${name} added`)
      })
    },
  })
}

export function openSymptomLog({ date = todayKey(), name = '' } = {}) {
  const body = `<form id="symptom-form" class="kc-form">
    <div class="kc-field"><label for="sym-name">Symptom</label><input id="sym-name" type="text" maxlength="60" list="sym-list" value="${String(name).replace(/"/g, '&quot;')}" placeholder="e.g. Headache" data-autofocus required>
      <datalist id="sym-list">${['Headache', 'Fatigue', 'Nausea', 'Cramps', 'Dizziness', 'Bloating', 'Back pain', 'Poor sleep', 'Anxiety', 'Sore throat'].map(item => `<option value="${item}"></option>`).join('')}</datalist>
    </div>
    <div class="kc-field"><label>How strong is it?</label><div class="kc-symptom-scale">${[1, 2, 3].map(level => `<label class="kc-chip"><input type="radio" name="sym-severity" value="${level}" ${level === 1 ? 'checked' : ''}> ${level === 1 ? 'Mild' : level === 2 ? 'Moderate' : 'Severe'}</label>`).join('')}</div></div>
    <div class="kc-form-grid kc-form-grid--2">
      <div class="kc-field"><label for="sym-date">Date</label><input id="sym-date" type="date" value="${date}" max="${todayKey()}"></div>
      <div class="kc-field"><label for="sym-note">What was happening? (optional)</label><input id="sym-note" type="text" maxlength="300" placeholder="e.g. after skipping lunch"></div>
    </div>
    <p class="kc-note">A symptom diary helps spot patterns, but it is not a diagnosis. Persistent or severe symptoms deserve a clinician.</p>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('activity')} Save symptom</button></div>
  </form>`

  openModal({
    title: 'Log a symptom',
    eyebrow: 'SYMPTOMS',
    subtitle: 'Private, on-device notes you can look back on',
    body,
    onMount(modal) {
      modal.querySelector('#symptom-form').addEventListener('submit', event => {
        event.preventDefault()
        const nameValue = modal.querySelector('#sym-name').value.trim()
        if (!nameValue) { toast('Name the symptom first.', 'error'); return }
        const severity = Number(modal.querySelector('input[name="sym-severity"]:checked')?.value) || 1
        update(() => logSymptom({
          name: nameValue,
          severity,
          note: modal.querySelector('#sym-note').value,
          date: modal.querySelector('#sym-date').value || date,
        }), { label: 'Log symptom' })
        closeModal()
        refresh()
        toast('Symptom saved')
      })
    },
  })
}
