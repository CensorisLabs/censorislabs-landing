import {
  state,
  getProfile,
  update,
  todayKey,
  prettyDate,
  removeVital,
  removeSymptom,
  removeMedication,
  toggleMedicationLog,
} from '../lib/store.js'
import {
  latestVital,
  vitalSeries,
  vitalAverage,
  vitalsInRange,
  bloodPressureCategory,
  pulseCategory,
  glucoseCategory,
  spo2Category,
  temperatureCategory,
  medicationAdherence,
  medicationTakenToday,
  symptomSummary,
  stepSummary,
  COMMON_SYMPTOMS,
} from '../lib/health.js'
import {
  icon,
  fmt,
  esc,
  bar,
  barChart,
  lineChart,
  statBlock,
  emptyState,
  toast,
  confirmDialog,
} from '../lib/ui.js'
import { on, refresh, goProgress } from '../lib/runtime.js'
import { openVitalsLog, openMedicationAdd, openSymptomLog } from '../lib/dialogs-health.js'
import { openStepsLog } from '../lib/dialogs-app.js'

const SEVERITY = ['', 'Mild', 'Moderate', 'Severe']
const SEVERITY_TONE = ['', 'is-good', 'is-amber', 'is-bad']

function latestBloodPressure(vitals) {
  return [...vitals]
    .filter(item => Number(item.systolic) > 0 && Number(item.diastolic) > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || (Number(b.at) || 0) - (Number(a.at) || 0))[0] || null
}

function badge(category) {
  return `<span class="kc-health-badge ${category.tone ? `is-${category.tone}` : ''}">${esc(category.label)}</span>`
}

function tile({ label, value, unit = '', note, category }) {
  return `<article class="kc-health-tile">
    <span class="kc-health-tile__label">${esc(label)}</span>
    <span class="kc-health-tile__value">${value}${unit ? `<small> ${esc(unit)}</small>` : ''}</span>
    ${category ? badge(category) : `<small class="kc-muted">${esc(note || 'No reading yet')}</small>`}
  </article>`
}

function vitalSummary(item) {
  const parts = []
  if (item.systolic && item.diastolic) parts.push(`BP ${item.systolic}/${item.diastolic}`)
  if (item.pulse) parts.push(`Pulse ${item.pulse} bpm`)
  if (item.glucose) parts.push(`Glucose ${item.glucose} mg/dL`)
  if (item.spo2) parts.push(`SpO₂ ${item.spo2}%`)
  if (item.tempC) parts.push(`${item.tempC} °C`)
  if (item.respRate) parts.push(`${item.respRate}/min`)
  return parts.join(' · ') || 'Reading'
}

function medicationSection() {
  const meds = state.medications
  const today = todayKey()
  const adherence = medicationAdherence(meds, state.medicationLogs, 7)
  const rows = meds.map(med => {
    const taken = medicationTakenToday(med.id, state.medicationLogs, today)
    return `<div class="kc-med-row">
      <button type="button" class="kc-med-check ${taken ? 'is-taken' : ''}" data-action="health:med-toggle" data-id="${esc(med.id)}" aria-pressed="${taken}" aria-label="${taken ? 'Mark as not taken' : 'Mark as taken'}: ${esc(med.name)}">${icon(taken ? 'check' : 'circle')}</button>
      <div class="kc-med-main"><b>${esc(med.name)}</b><small>${[med.dose, med.time, med.note].filter(Boolean).map(esc).join(' · ') || 'No dose or time set'}</small></div>
      <button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="health:med-remove" data-id="${esc(med.id)}" aria-label="Remove ${esc(med.name)}">${icon('close')}</button>
    </div>`
  }).join('')

  return `<section class="kc-card kc-med-card">
    <div class="kc-card__head"><div><p class="kc-eyebrow">MEDICATIONS</p><h3>${meds.length ? `${meds.filter(med => medicationTakenToday(med.id, state.medicationLogs, today)).length} of ${meds.length} taken today` : 'Nothing tracked yet'}</h3><p>Daily tick-list with a 7-day adherence estimate.</p></div><button type="button" class="kc-text-btn" data-action="health:med-add">${icon('plus')} Add</button></div>
    ${meds.length ? `<div class="kc-med-list">${rows}</div><div class="kc-adherence"><div class="kc-adherence__head"><span>7-day adherence</span><b>${adherence.pct}%</b></div>${bar(adherence.taken, Math.max(1, adherence.expected), 'accent')}<small>${adherence.taken} of ${adherence.expected} doses ticked</small></div>` : emptyState('activity', 'No medicines tracked', 'Add a medicine or supplement to tick off each day. Nothing is prescribed or sent anywhere.', '<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="health:med-add">Add medicine</button>')}
    <p class="kc-meta">${icon('info')} Adherence counts a tick per medicine per day. It is a personal reminder, not a clinical record.</p>
  </section>`
}

function symptomSection() {
  const summary = symptomSummary(state.symptoms, 14)
  const rows = state.symptoms.slice(0, 8).map(item => `<div class="kc-symptom-row">
    <span class="kc-health-badge ${SEVERITY_TONE[item.severity] || ''}">${SEVERITY[item.severity] || 'Mild'}</span>
    <div><b>${esc(item.name)}</b><small>${esc(prettyDate(item.date))}${item.note ? ` · ${esc(item.note)}` : ''}</small></div>
    <button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="health:symptom-remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon('close')}</button>
  </div>`).join('')

  return `<section class="kc-card kc-symptom-card">
    <div class="kc-card__head"><div><p class="kc-eyebrow">SYMPTOMS</p><h3>${summary.total ? `${summary.total} note${summary.total === 1 ? '' : 's'} in 14 days` : 'Nothing logged'}</h3><p>Log how you feel and look for patterns beside food, sleep and steps.</p></div><button type="button" class="kc-text-btn" data-action="health:symptom">${icon('plus')} Log symptom</button></div>
    <div class="kc-symptom-chips">${COMMON_SYMPTOMS.map(name => `<button type="button" class="kc-chip" data-action="health:symptom" data-name="${esc(name)}">${esc(name)}</button>`).join('')}</div>
    ${summary.top.length ? `<div class="kc-symptom-top">${summary.top.map(item => `<span class="kc-pill">${esc(item.name)} · ${item.count}×</span>`).join('')}</div>` : ''}
    ${rows || emptyState('activity', 'No symptoms noted', 'Quick-add a common symptom or log your own with a severity and note.')}
  </section>`
}

function movementSection(profile) {
  const summary = stepSummary(profile, todayKey(), 7)
  const items = summary.entries.map(entry => ({
    label: prettyDate(entry.date, { weekday: 'short', day: 'numeric', month: 'short' }),
    short: prettyDate(entry.date, { weekday: 'narrow' }),
    value: entry.steps,
  }))

  return `<section class="kc-card kc-health-movement">
    <div class="kc-card__head"><div><p class="kc-eyebrow">STEPS</p><h3>${fmt(summary.total)} steps in 7 days</h3><p>${summary.goalDays} of 7 days at or above ${fmt(summary.entries[0]?.goal || profile.stepGoal)} steps · ${fmt(summary.activeMinutes)} active minutes</p></div><div class="kc-card__head-actions"><button type="button" class="kc-text-btn" data-action="health:steps">${icon('footsteps')} Log steps</button><button type="button" class="kc-text-btn" data-action="health:step-progress">${icon('chart')} Analytics</button></div></div>
    ${summary.total ? barChart(items, { target: summary.entries[0]?.goal || profile.stepGoal, height: 130 }) : emptyState('footsteps', 'No steps logged this week', 'Log steps on Today or sync the Android step counter.')}
    <div class="kc-stat-grid kc-stat-grid--four">
      ${statBlock('Average', fmt(summary.average), 'On logged days')}
      ${statBlock('Best day', fmt(summary.best), 'This week')}
      ${statBlock('Distance', `${fmt(summary.distanceKm, 1)} km`, '7 days')}
      ${statBlock('Active minutes', fmt(summary.activeMinutes), 'Walking estimate')}
    </div>
  </section>`
}

export function renderHealth(root) {
  const profile = getProfile()
  const vitals = state.vitals
  const bp = latestBloodPressure(vitals)
  const pulse = latestVital(vitals, 'pulse')
  const glucose = latestVital(vitals, 'glucose')
  const spo2 = latestVital(vitals, 'spo2')
  const temperature = latestVital(vitals, 'tempC')
  const breathing = latestVital(vitals, 'respRate')
  const bpCategory = bp ? bloodPressureCategory(bp.systolic, bp.diastolic) : null
  const trend = vitalSeries(vitals, 'systolic', 14).map(point => ({ label: prettyDate(point.date, { day: 'numeric', month: 'short' }), value: point.value }))
  const recent = [...vitals]
    .sort((a, b) => b.date.localeCompare(a.date) || (Number(b.at) || 0) - (Number(a.at) || 0))
    .slice(0, 8)
  const history = recent.map(item => `<div class="kc-vital-row">
    <div><b>${esc(vitalSummary(item))}</b><small>${esc(prettyDate(item.date))}${item.note ? ` · ${esc(item.note)}` : ''}</small></div>
    <button type="button" class="kc-icon-btn kc-icon-btn--danger" data-action="health:vital-remove" data-id="${esc(item.id)}" aria-label="Delete reading from ${esc(item.date)}">${icon('close')}</button>
  </div>`).join('')
  const weekReadings = vitalsInRange(vitals, 7).length

  root.innerHTML = `<div class="kc-view kc-health">
    <div class="kc-page-head">
      <div><p class="kc-eyebrow">HEALTH</p><h1>Vitals, medicines and symptoms</h1><p>${esc(profile.name)} · ${vitals.length} reading${vitals.length === 1 ? '' : 's'} · ${state.medications.length} medicine${state.medications.length === 1 ? '' : 's'} · private to this device</p></div>
      <div class="kc-page-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="health:vitals">${icon('heart')} Log reading</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="health:med-add">${icon('plus')} Medicine</button></div>
    </div>

    <section class="kc-card kc-vitals-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">VITALS</p><h3>${bp ? `Blood pressure ${bp.systolic}/${bp.diastolic}` : 'Your latest readings'}</h3><p>${weekReadings ? `${weekReadings} reading${weekReadings === 1 ? '' : 's'} in the last 7 days` : 'Log a reading to start the picture'}</p></div><button type="button" class="kc-text-btn" data-action="health:vitals">${icon('plus')} New reading</button></div>
      <div class="kc-health-grid">
        ${tile({ label: 'Blood pressure', value: bp ? `${bp.systolic}/${bp.diastolic}` : '—', unit: 'mmHg', category: bp ? bpCategory : null, note: 'No reading yet' })}
        ${tile({ label: 'Resting pulse', value: pulse ? fmt(pulse.pulse) : '—', unit: 'bpm', category: pulse ? pulseCategory(pulse.pulse) : null, note: 'No reading yet' })}
        ${tile({ label: 'Blood glucose', value: glucose ? fmt(glucose.glucose) : '—', unit: 'mg/dL', category: glucose ? glucoseCategory(glucose.glucose, glucose.glucoseContext) : null, note: 'No reading yet' })}
        ${tile({ label: 'Blood oxygen', value: spo2 ? fmt(spo2.spo2) : '—', unit: '%', category: spo2 ? spo2Category(spo2.spo2) : null, note: 'No reading yet' })}
        ${tile({ label: 'Temperature', value: temperature ? fmt(temperature.tempC, 1) : '—', unit: '°C', category: temperature ? temperatureCategory(temperature.tempC) : null, note: 'No reading yet' })}
        ${tile({ label: 'Breathing rate', value: breathing ? fmt(breathing.respRate) : '—', unit: '/min', note: breathing ? 'Resting breaths per minute' : 'No reading yet' })}
      </div>
    </section>

    <div class="kc-two-col kc-health-trends">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">BLOOD PRESSURE</p><h3>Systolic, last 14 days</h3><p>One averaged point per day with the 120 mmHg guide.</p></div></div>
        ${trend.length ? lineChart(trend, { height: 180, tone: 'water', target: 120 }) : emptyState('heart', 'No blood pressure readings', 'Blood pressure is best measured rested, seated, and twice in a row.', '<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" data-action="health:vitals">Log a reading</button>')}
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">AVERAGES</p><h3>Last 7 days</h3><p>Only fields you actually measured are averaged.</p></div></div>
        <div class="kc-stat-grid">
          ${statBlock('Systolic', vitalAverage(vitals, 'systolic', 7) ?? '—', 'mmHg')}
          ${statBlock('Diastolic', vitalAverage(vitals, 'diastolic', 7) ?? '—', 'mmHg')}
          ${statBlock('Pulse', vitalAverage(vitals, 'pulse', 7) ?? '—', 'bpm')}
          ${statBlock('Readings', fmt(weekReadings), '7 days')}
        </div>
        <p class="kc-meta">${icon('info')} Ranges are general adult guides, not a diagnosis. One high reading is not a trend; persistent numbers belong with a clinician.</p>
      </section>
    </div>

    <div class="kc-two-col kc-health-log">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">HISTORY</p><h3>Recent readings</h3><p>Newest first. Delete a mistaken entry any time.</p></div><button type="button" class="kc-text-btn" data-action="health:vitals">${icon('plus')} Add</button></div>
        <div class="kc-vital-list">${history || emptyState('heart', 'Nothing logged yet', 'Your readings will appear here, newest first.')}</div>
      </section>
      ${medicationSection()}
    </div>

    ${symptomSection()}
    ${movementSection(profile)}

    <p class="kc-disclaimer">AbsoluteCal keeps these notes on this device only. Ranges are general adult guides, not medical advice, and no reading replaces a clinician's assessment. If a measurement looks alarming or you feel unwell, seek care.</p>
  </div>`
}

on('health:vitals', () => openVitalsLog({ date: todayKey() }))
on('health:med-add', () => openMedicationAdd())
on('health:symptom', element => openSymptomLog({ name: element?.dataset?.name || '' }))
on('health:med-toggle', element => {
  const med = state.medications.find(item => item.id === element.dataset.id)
  if (!med) return
  update(() => toggleMedicationLog(med.id, todayKey()), { label: 'Medication tick' })
  toast(`${med.name} ${medicationTakenToday(med.id, state.medicationLogs, todayKey()) ? 'ticked' : 'unticked'}`)
})
on('health:med-remove', async element => {
  const med = state.medications.find(item => item.id === element.dataset.id)
  if (!med) return
  const ok = await confirmDialog({ title: `Remove ${med.name}?`, message: 'This also deletes its tick history.', confirmLabel: 'Remove', danger: true })
  if (!ok) return
  update(() => removeMedication(med.id), { label: 'Remove medicine' })
  refresh()
  toast('Medicine removed')
})
on('health:vital-remove', async element => {
  const id = element.dataset.id
  const ok = await confirmDialog({ title: 'Delete this reading?', message: 'It will be removed from your local history.', confirmLabel: 'Delete', danger: true })
  if (!ok) return
  update(() => removeVital(id), { label: 'Delete reading' })
  refresh()
  toast('Reading deleted')
})
on('health:symptom-remove', async element => {
  const id = element.dataset.id
  const ok = await confirmDialog({ title: 'Delete this symptom note?', message: 'It will be removed from your local history.', confirmLabel: 'Delete', danger: true })
  if (!ok) return
  update(() => removeSymptom(id), { label: 'Delete symptom' })
  refresh()
  toast('Symptom deleted')
})
on('health:steps', () => openStepsLog({ date: todayKey() }))
on('health:step-progress', () => goProgress('nutrition'))
