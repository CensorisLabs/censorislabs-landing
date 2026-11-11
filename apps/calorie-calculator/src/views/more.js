import {
  getProfile,
  state,
  update,
  persist,
  createDemoProfile,
  switchProfile,
  storageBytes,
  profileStats,
  todayKey,
  prettyDate,
  relativeDate,
  MEALS,
} from '../lib/store.js'
import {
  targetsFor,
  autoTargets,
  bmr,
  tdee,
  bmi,
  bmiCategory,
  bodyFat,
  formatWeight,
  formatHeight,
  daysAgoLabel,
  round,
} from '../lib/calc.js'
import { FEATURE_GROUPS, FEATURE_COUNT } from '../data/features.js'
import { ACHIEVEMENTS } from '../data/achievements.js'
import { icon, fmt, esc, bar, toast, statBlock, copyText } from '../lib/ui.js'
import { on, refresh, ui, go } from '../lib/runtime.js'
import {
  openProfileEditor,
  openProfileSwitcher,
  openAddProfile,
  openTargetsEditor,
  openFasting,
  openMeasurementLog,
  openImportDialog,
  openResetDialog,
  openReport,
  openShortcuts,
  openStepSettings,
} from '../lib/dialogs-app.js'
import { exportBackup, exportCsv, daySummaryText, profileBackupSummary } from '../lib/export.js'
import { APP_VERSION } from '../shared/version.js'
import { renderInsights } from './insights.js'
import { renderTools } from './tools.js'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Settings' },
  { id: 'insights', label: 'Insights' },
  { id: 'tools', label: 'Tools' },
  { id: 'data', label: 'Data' },
  { id: 'guide', label: 'Guide' },
]

const TAB_TITLES = {
  profile: 'Your space',
  preferences: 'Settings',
  insights: 'Insights',
  tools: 'Tools',
  data: 'Your data',
  guide: 'Feature guide',
}

const ACCENTS = [
  ['lime', 'Lime', '#b5e36b'],
  ['mint', 'Mint', '#7fe0c0'],
  ['teal', 'Teal', '#5ed0c6'],
  ['sky', 'Sky', '#7cb8ff'],
  ['violet', 'Violet', '#b49cff'],
  ['rose', 'Rose', '#f49bc3'],
  ['coral', 'Coral', '#ff9277'],
  ['amber', 'Amber', '#f6be59'],
  ['sand', 'Sand', '#dcc8a4'],
]

function profileTab(profile, stats) {
  const targets = targetsFor(profile)
  const bf = bodyFat(profile)
  const bmiValue = bmi(profile)
  const category = bmiCategory(bmiValue)
  const latestMeasurement = [...profile.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const demo = state.profiles.find(item => item.name === 'Demo')
  return `<div class="kc-more-profile">
    <section class="kc-card kc-profile-hero">
      <div class="kc-profile-hero__avatar">${esc(profile.emoji || '🌿')}</div>
      <div class="kc-profile-hero__copy"><p class="kc-eyebrow">YOUR PROFILE</p><h1>${esc(profile.name)}</h1><p>${esc(profile.age)} years · ${formatHeight(profile.heightCm, state.settings.units)} · ${formatWeight(profile.weightKg, state.settings.units)} · ${esc(profile.diet)}</p><div class="kc-profile-chips"><span class="kc-pill">${icon('target')} ${fmt(targets.kcal)} kcal</span><span class="kc-pill">${icon('activity')} ${fmt(profile.activity, 3)} activity</span><span class="kc-pill">${icon('flame')} ${stats.currentStreak}-day streak</span></div></div>
      <div class="kc-profile-hero__actions"><button type="button" class="kc-btn" data-action="more:edit-profile">${icon('edit')} Edit profile</button><button type="button" class="kc-btn kc-btn--ghost" data-action="more:profiles">${icon('users')} Switch profile</button><button type="button" class="kc-btn kc-btn--ghost" data-action="more:add-profile">${icon('plus')} Add profile</button></div>
    </section>
    <div class="kc-stat-grid kc-stat-grid--four">
      ${statBlock('BMR', `${fmt(bmr(profile))} kcal`, 'At rest')}
      ${statBlock('TDEE', `${fmt(tdee(profile))} kcal`, 'Maintenance')}
      ${statBlock('BMI', `${bmiValue}`, category.label, category.tone === 'good' ? 'good' : 'amber')}
      ${statBlock('Body fat', `${bf.value}%`, bf.method)}
      ${statBlock('Goal weight', formatWeight(profile.goalWeightKg, state.settings.units), `${profile.rate} kg/week pace`)}
      ${statBlock('Fasting window', `${profile.targetsMode === 'manual' ? 'Manual targets' : 'Auto targets'}`, '')}
      ${statBlock('Logged days', fmt(stats.loggedDays), 'All time')}
      ${statBlock('Best streak', `${stats.bestStreak} days`, '')}
    </div>
    <div class="kc-two-col">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">DAILY TARGETS</p><h3>What you are aiming for</h3><p>${profile.targetsMode === 'manual' ? 'Manual overrides are active.' : `Automatic from ${fmt(profile.activity, 3)} activity and a ${profile.goal} goal.`}</p></div><button type="button" class="kc-text-btn" data-action="more:targets">${icon('edit')} Edit</button></div>
        <div class="kc-target-list">${[['Calories', `${fmt(targets.kcal)} kcal`], ['Protein', `${fmt(targets.protein)} g`], ['Carbs', `${fmt(targets.carbs)} g`], ['Fat', `${fmt(targets.fat)} g`], ['Fibre', `${fmt(targets.fiber)} g`], ['Water', `${fmt(targets.water)} ml`], ['Sugar limit', `${fmt(targets.sugar)} g`], ['Sodium limit', `${fmt(targets.sodium)} mg`]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
        <p class="kc-meta">Formula: Mifflin–St Jeor BMR × activity. A safety floor of ${profile.sex === 'male' ? '1,500' : '1,200'} kcal applies.</p>
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">BODY & HABITS</p><h3>Optional signals</h3><p>Measurements and a fasting window add context.</p></div><button type="button" class="kc-text-btn" data-action="more:measure">${icon('edit')} Measure</button></div>
        <div class="kc-measure-grid">${[['waist', 'Waist'], ['hips', 'Hips'], ['neck', 'Neck'], ['chest', 'Chest'], ['arms', 'Arms'], ['thighs', 'Thigh']].map(([key, label]) => `<div><span>${label}</span><b>${latestMeasurement?.[key] ? `${latestMeasurement[key]} cm` : '—'}</b></div>`).join('')}</div>
        <div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:fasting">${icon('clock')} Fasting timer</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:weight">${icon('scale')} Weigh in</button></div>
      </section>
    </div>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">HOUSEHOLD</p><h3>${state.profiles.length} profile${state.profiles.length === 1 ? '' : 's'} on this device</h3><p>Each diary, plan, weight history and set of favourites is separate.</p></div><button type="button" class="kc-text-btn" data-action="more:add-profile">${icon('plus')} Add</button></div>
      <div class="kc-profile-list">${state.profiles.map(item => `<div class="kc-profile-row ${item.id === profile.id ? 'is-active' : ''}"><span class="kc-profile-avatar">${esc(item.emoji || '🌿')}</span><div><b>${esc(item.name)}</b><small>${formatWeight(item.weightKg, state.settings.units)} · ${fmt(targetsFor(item).kcal)} kcal target</small></div><div class="kc-profile-actions">${item.id === profile.id ? '<span class="kc-pill kc-pill--good">Active</span>' : `<button type="button" class="kc-btn kc-btn--soft kc-btn--xs" data-action="more:switch" data-id="${esc(item.id)}">Switch</button>`}<button type="button" class="kc-icon-btn" data-action="more:edit-other" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.name)}">${icon('edit')}</button></div></div>`).join('')}</div>
      <div class="kc-inline-actions">${demo ? `<button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:switch-demo">${icon('sparkles')} Open demo diary</button>` : `<button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:demo">${icon('sparkles')} Create a demo profile</button>`}<button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:profiles">${icon('users')} Manage profiles</button></div>
    </section>
    
  </div>`
}

function preferencesTab(profile) {
  const targets = targetsFor(profile)
  return `<div class="kc-more-preferences">
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">UNITS</p><h3>How numbers are shown</h3><p>Stored values stay metric; display and entry convert for you.</p></div></div>
      <div class="kc-segmented"><button type="button" class="${state.settings.units === 'metric' ? 'is-active' : ''}" data-action="more:units" data-units="metric">Metric · kg / cm / ml</button><button type="button" class="${state.settings.units === 'imperial' ? 'is-active' : ''}" data-action="more:units" data-units="imperial">Imperial · lb / in / fl oz</button></div>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">APPEARANCE</p><h3>Make it yours</h3><p>Accent colour applies to the tracker; the shared appearance panel changes the shell theme.</p></div><button type="button" class="kc-text-btn" data-action="more:appearance">${icon('settings')} Shell theme</button></div>
      <div class="kc-segmented kc-segmented--small"><button type="button" class="${state.settings.theme !== 'light' && state.settings.theme !== 'auto' ? 'is-active' : ''}" data-action="more:theme" data-theme="dark">${icon('moon')} Dark</button><button type="button" class="${state.settings.theme === 'light' ? 'is-active' : ''}" data-action="more:theme" data-theme="light">${icon('sun')} Light</button><button type="button" class="${state.settings.theme === 'auto' ? 'is-active' : ''}" data-action="more:theme" data-theme="auto">${icon('settings')} System</button></div>
      <label class="kc-switch-row"><span><b>Nature background</b><small>Soft green gradients and a foliage backdrop behind the tracker.</small></span><input type="checkbox" data-action="more:nature" ${state.settings.nature ? 'checked' : ''}></label>
      <div class="kc-accent-grid">${ACCENTS.map(([id, label, color]) => `<button type="button" class="kc-accent ${state.settings.accent === id ? 'is-active' : ''}" data-action="more:accent" data-accent="${id}" aria-pressed="${state.settings.accent === id}"><i style="background:${color}"></i><span>${label}</span></button>`).join('')}</div>
      <div class="kc-preference-row"><div><b>Density</b><small>Compact fits more on a laptop screen.</small></div><div class="kc-segmented kc-segmented--small"><button type="button" class="${state.settings.density !== 'compact' ? 'is-active' : ''}" data-action="more:density" data-density="comfortable">Comfortable</button><button type="button" class="${state.settings.density === 'compact' ? 'is-active' : ''}" data-action="more:density" data-density="compact">Compact</button></div></div>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">MOVEMENT</p><h3>Steps and burn</h3><p>The goal drives your streak and charts; stride and cadence drive the calorie estimate.</p></div><button type="button" class="kc-text-btn" data-action="more:step-settings">${icon('settings')} Steps setup</button></div>
      <div class="kc-preference-row"><div><b>Step goal</b><small>8,000 is a gentle default, not a prescription.</small></div><input id="step-goal" class="kc-select kc-select--inline" type="number" min="1000" max="50000" step="500" value="${getProfile().stepGoal || 8000}" aria-label="Daily step goal"></div>
      <p class="kc-meta">On Android the hardware step counter can fill this in automatically; elsewhere log steps on Today. Stride, cadence and step-credit settings live in Steps setup.</p>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">REMINDERS</p><h3>A gentle nudge, not a nag</h3><p>Reminders only run while kcal is open. They never leave this device.</p></div><button type="button" class="kc-text-btn" data-action="more:notify">${icon('info')} Notification permission</button></div>
      <label class="kc-switch-row"><span><b>Water reminders</b><small>Prompt me when I am behind my hydration guide.</small></span><input type="checkbox" data-action="more:reminder" data-kind="water" ${state.settings.reminders.water ? 'checked' : ''}></label>
      <label class="kc-switch-row"><span><b>Meal reminders</b><small>One quiet prompt at breakfast, lunch and dinner time.</small></span><input type="checkbox" data-action="more:reminder" data-kind="meals" ${state.settings.reminders.meals ? 'checked' : ''}></label>
      <div class="kc-preference-row"><div><b>Water reminder interval</b><small>How often the hydration prompt may appear.</small></div><select id="water-interval" class="kc-select kc-select--inline"><option value="60" ${state.settings.waterInterval === 60 ? 'selected' : ''}>Every hour</option><option value="90" ${state.settings.waterInterval === 90 ? 'selected' : ''}>Every 90 minutes</option><option value="120" ${state.settings.waterInterval === 120 ? 'selected' : ''}>Every 2 hours</option><option value="180" ${state.settings.waterInterval === 180 ? 'selected' : ''}>Every 3 hours</option></select></div>
      <p class="kc-meta">Notification permission is requested by your browser or operating system. If it is denied, reminders appear as in-app toasts while the app is open.</p>
    </section>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">FOOD BUDGET</p><h3>${state.settings.budget ? `₹${fmt(state.settings.budget)} per day` : 'No budget set'}</h3><p>Food costs are optional estimates you enter per food or custom entry.</p></div></div>
      <form id="more-budget-form" class="kc-inline-budget"><label class="kc-field"><span>Daily food budget (₹)</span><input id="more-budget" type="number" min="0" max="100000" step="10" value="${state.settings.budget || ''}" placeholder="e.g. 450"></label><button type="submit" class="kc-btn kc-btn--soft kc-btn--sm">Save</button></form>
      <div class="kc-target-list"><div><span>Today’s water target</span><b>${fmt(targets.water)} ml</b></div><div><span>Week start</span><b>Monday</b></div><div><span>Currency</span><b>INR · ₹</b></div></div>
    </section>
    <section class="kc-card kc-maintenance-card"><div>${icon('info')}<p><b>Health note.</b> kcal estimates energy and nutrient needs. It is not a medical device and does not diagnose anything. Pregnancy, eating-disorder recovery, diabetes medication and other clinical situations need individual guidance.</p></div></section>
  </div>`
}

function dataTab(profile, stats) {
  const bytes = storageBytes()
  const kb = bytes / 1024
  const storagePct = Math.min(100, bytes / (5 * 1024 * 1024) * 100)
  const summary = profileBackupSummary()
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
  const online = navigator.onLine
  return `<div class="kc-more-data">
    <section class="kc-card kc-backup-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">BACKUP</p><h3>${state.settings.lastExport ? `Last export ${daysAgoLabel(state.settings.lastExport)}` : 'No backup exported yet'}</h3><p>A JSON backup includes every profile, diary, food, recipe, plan and weigh-in.</p></div><span class="kc-backup-icon">${icon('download')}</span></div>
      <div class="kc-backup-actions"><button type="button" class="kc-btn" data-action="more:export">${icon('download')} Export JSON backup</button><button type="button" class="kc-btn kc-btn--soft" data-action="more:import">${icon('upload')} Import backup</button><button type="button" class="kc-btn kc-btn--ghost" data-action="more:csv">${icon('chart')} 90-day CSV</button><button type="button" class="kc-btn kc-btn--ghost" data-action="more:report">${icon('print')} Print daily report</button></div>
      <p class="kc-meta">${state.settings.lastExport ? `Back up regularly — this device is the only copy. ${daysAgoLabel(state.settings.lastExport)}.` : 'This device is the only copy. Export a backup and keep it somewhere safe.'}</p>
    </section>
    <div class="kc-two-col">
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">STORAGE</p><h3>${kb < 1024 ? `${fmt(kb, 1)} KB` : `${fmt(kb / 1024, 2)} MB`} used</h3><p>Stored in this browser or app’s local storage.</p></div></div>
        ${bar(storagePct, 100, storagePct > 85 ? 'danger' : 'accent')}
        <div class="kc-target-list"><div><span>Profiles</span><b>${summary.profiles}</b></div><div><span>Custom foods</span><b>${summary.customFoods}</b></div><div><span>Recipes</span><b>${summary.recipes}</b></div><div><span>Weigh-ins</span><b>${summary.weights}</b></div><div><span>Days with a record</span><b>${summary.loggedDays}</b></div><div><span>Food entries</span><b>${fmt(stats.totalEntries)}</b></div></div>
        <p class="kc-meta">Most browsers allow about 5 MB of local storage. A multi-year diary with text stays well below that; photos are never stored.</p>
      </section>
      <section class="kc-card">
        <div class="kc-card__head"><div><p class="kc-eyebrow">OFFLINE & INSTALL</p><h3>${installed ? 'Installed app' : online ? 'Online · offline ready' : 'Offline now'}</h3><p>kcal works without a connection after the first load.</p></div><span class="kc-status-dot ${online ? 'is-online' : ''}"></span></div>
        <div class="kc-target-list"><div><span>Connection</span><b>${online ? 'Online' : 'Offline'}</b></div><div><span>Service worker</span><b>${'serviceWorker' in navigator ? 'Available' : 'Not supported'}</b></div><div><span>App data</span><b>Local only</b></div><div><span>Analytics</span><b>None</b></div></div>
        <button type="button" class="kc-btn kc-btn--soft kc-btn--block" data-action="more:install">${icon('install')} ${installed ? 'How to install' : 'Install kcal'}</button>
        <p class="kc-meta">The Windows and Android builds are already self-contained. In a browser, use the install option in the menu or address bar.</p>
      </section>
    </div>
    <section class="kc-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">MORE TOOLS</p><h3>Small things that help</h3><p>Copy a summary for a clinician, friend or your own notes.</p></div></div>
      <div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:copy-day">${icon('copy')} Copy today’s summary</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:shortcuts">${icon('info')} Keyboard shortcuts</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="more:targets">${icon('target')} Edit targets</button></div>
    </section>
    <section class="kc-card kc-danger-card">
      <div class="kc-card__head"><div><p class="kc-eyebrow">DANGER ZONE</p><h3>Reset all local data</h3><p>Erases every profile, diary, plan, recipe and custom food on this device.</p></div><button type="button" class="kc-btn kc-btn--danger kc-btn--soft" data-action="more:reset">${icon('trash')} Reset…</button></div>
    </section>
  </div>`
}

function guideTab(profile, stats) {
  const unlocked = ACHIEVEMENTS.filter(item => profile.achievements[item.id]).length
  return `<div class="kc-more-guide">
    <section class="kc-card kc-guide-hero"><div class="kc-guide-count"><strong>${FEATURE_COUNT}</strong><span>features included</span></div><div><p class="kc-eyebrow">THE WHOLE TOOLKIT</p><h2>Everything here is in this build</h2><p>No account, no cloud profile, no feature that quietly calls a server. The food database, diary, trends, planner and reports all run on this device.</p></div></section>
    <div class="kc-feature-groups">${FEATURE_GROUPS.map((group, index) => `<details class="kc-feature-group" ${index < 2 ? 'open' : ''}><summary><span>${icon(group.icon)} ${esc(group.title)}</span><em>${group.items.length}</em>${icon('chevron')}</summary><ul>${group.items.map(item => `<li>${icon('check')} ${esc(item)}</li>`).join('')}</ul></details>`).join('')}</div>
    <div class="kc-two-col">
      <section class="kc-card"><div class="kc-card__head"><div><p class="kc-eyebrow">ACHIEVEMENTS</p><h3>${unlocked} of ${ACHIEVEMENTS.length} unlocked</h3><p>Badges are stored per profile.</p></div></div>${bar(unlocked, ACHIEVEMENTS.length, 'bronze')}<div class="kc-badge-inline">${ACHIEVEMENTS.slice(0, 8).map(item => `<span class="kc-badge-mini ${profile.achievements[item.id] ? 'is-unlocked' : ''}" title="${esc(item.desc)}">${icon(item.icon)}</span>`).join('')}</div><button type="button" class="kc-text-btn" data-action="more:achievements">${icon('award')} See all badges</button></section>
      <section class="kc-card"><div class="kc-card__head"><div><p class="kc-eyebrow">ABOUT</p><h3>kcal · version ${APP_VERSION}</h3><p>A CensorisLabs daily food and energy tracker.</p></div></div><div class="kc-target-list"><div><span>Data location</span><b>This device</b></div><div><span>Food records</span><b>${profileStats(profile.id).distinctFoods} used</b></div><div><span>Profiles</span><b>${state.profiles.length}</b></div><div><span>Last backup</span><b>${daysAgoLabel(state.settings.lastExport)}</b></div></div><p class="kc-meta">Estimates use publicly known equations and approximate food composition. They are not medical advice, a diagnosis, or a substitute for a clinician or dietitian.</p><button type="button" class="kc-text-btn" data-action="more:shortcuts">${icon('info')} Keyboard shortcuts</button></section>
    </div>
  </div>`
}

export function renderMore(root) {
  const profile = getProfile()
  const stats = profileStats(profile.id)
  const tab = TABS.some(item => item.id === ui.moreTab) ? ui.moreTab : 'profile'
  root.innerHTML = `<div class="kc-view kc-more">
    <div class="kc-page-head"><div><p class="kc-eyebrow">KCAL · CENSORISLABS</p><h1>${TAB_TITLES[tab]}</h1><p>${esc(profile.name)} · local-only tracking since ${esc(prettyDate(new Date(profile.createdAt).toISOString().slice(0, 10)))}</p></div><div class="kc-page-actions"><span class="kc-pill">${icon('lock')} Private by design</span></div></div>
    <div class="kc-tabbar">${TABS.map(item => `<button type="button" class="kc-tab ${tab === item.id ? 'is-active' : ''}" data-action="more:tab" data-tab="${item.id}">${item.label}</button>`).join('')}</div>
    ${tab === 'profile' ? profileTab(profile, stats) : tab === 'preferences' ? preferencesTab(profile) : tab === 'data' ? dataTab(profile, stats) : tab === 'guide' ? guideTab(profile, stats) : '<div id="more-panel"></div>'}
  </div>`

  const panel = root.querySelector('#more-panel')
  if (panel && tab === 'insights') renderInsights(panel)
  if (panel && tab === 'tools') renderTools(panel)

  root.querySelector('#more-budget-form')?.addEventListener('submit', event => {
    event.preventDefault()
    const value = Math.max(0, Number(root.querySelector('#more-budget').value) || 0)
    update(() => { state.settings.budget = value }, { label: 'Set food budget' })
    toast(value ? `Daily food budget set to ₹${fmt(value)}` : 'Food budget cleared')
  })
  root.querySelector('#water-interval')?.addEventListener('change', event => {
    update(() => { state.settings.waterInterval = Number(event.target.value) || 90 }, { label: 'Water reminder interval' })
    toast('Reminder interval updated')
  })
  root.querySelector('#step-goal')?.addEventListener('change', event => {
    const value = Math.min(50000, Math.max(1000, Number(event.target.value) || 8000))
    update(() => { getProfile().stepGoal = value }, { label: 'Change step goal' })
    toast(`Step goal set to ${fmt(value)}`)
  })
}

on('more:tab', element => { ui.moreTab = element.dataset.tab; refresh() })
on('more:step-settings', () => openStepSettings())
on('more:edit-profile', () => openProfileEditor())
on('more:profiles', () => openProfileSwitcher())
on('more:add-profile', () => openAddProfile())
on('more:switch', element => {
  update(() => switchProfile(element.dataset.id), { label: 'Switch profile' })
  toast('Profile switched')
})
on('more:edit-other', element => {
  const profile = state.profiles.find(item => item.id === element.dataset.id)
  if (profile) openProfileEditor(profile)
})
on('more:switch-demo', () => {
  const demo = state.profiles.find(item => item.name === 'Demo')
  if (!demo) return
  update(() => switchProfile(demo.id), { label: 'Switch to demo' })
  go('today')
  toast('Demo diary opened')
})
on('more:demo', () => {
  if (!state.profiles.some(item => item.name === 'Demo')) {
    update(() => createDemoProfile(), { label: 'Create demo profile' })
    go('today')
    toast('Demo profile created with 21 days of sample data')
  }
})
on('more:targets', () => openTargetsEditor())
on('more:fasting', () => openFasting())
on('more:measure', () => openMeasurementLog({ date: todayKey() }))
on('more:weight', () => {
  import('../lib/dialogs-app.js').then(module => module.openWeightLog({ date: todayKey() }))
})
on('more:units', element => {
  update(() => { state.settings.units = element.dataset.units === 'imperial' ? 'imperial' : 'metric' }, { label: 'Change units' })
  toast(`Using ${element.dataset.units} units`)
})
on('more:accent', element => {
  update(() => { state.settings.accent = element.dataset.accent }, { label: 'Change accent' })
})
on('more:theme', element => {
  update(() => { state.settings.theme = element.dataset.theme === 'light' ? 'light' : element.dataset.theme === 'auto' ? 'auto' : 'dark' }, { label: 'Change theme' })
  toast(`${element.dataset.theme === 'light' ? 'Light' : element.dataset.theme === 'auto' ? 'System' : 'Dark'} theme`)
})
on('more:nature', element => {
  update(() => { state.settings.nature = Boolean(element.checked) }, { label: 'Nature background' })
  toast(element.checked ? 'Nature background on' : 'Nature background off')
})
on('more:density', element => {
  update(() => { state.settings.density = element.dataset.density }, { label: 'Change density' })
})
on('more:appearance', () => document.querySelector('.appearance-toggle')?.click())
on('more:reminder', element => {
  const kind = element.dataset.kind
  if (element.checked && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  update(() => {
    state.settings.reminders ||= { water: false, meals: false }
    state.settings.reminders[kind] = element.checked
  }, { label: 'Update reminders' })
  toast(element.checked ? 'Reminders on while kcal is open' : 'Reminders off')
})
on('more:notify', async () => {
  if (!('Notification' in window)) { toast('Notifications are not available on this device.', 'error'); return }
  const permission = await Notification.requestPermission()
  toast(permission === 'granted' ? 'Notifications allowed' : 'Notifications remain blocked; in-app toasts will be used', permission === 'granted' ? 'ok' : 'error')
})
on('more:export', () => {
  exportBackup()
  refresh()
  toast('JSON backup downloaded')
})
on('more:import', () => openImportDialog())
on('more:csv', () => {
  const rows = exportCsv(90)
  toast(`${fmt(rows)} diary rows exported`)
})
on('more:report', () => openReport(ui.date))
on('more:copy-day', async () => {
  const ok = await copyText(daySummaryText(ui.date))
  toast(ok ? 'Day summary copied' : 'Could not copy the summary', ok ? 'ok' : 'error')
})
on('more:shortcuts', () => openShortcuts())
on('more:reset', () => openResetDialog())
on('more:achievements', () => {
  ui.progressTab = 'achievements'
  go('progress')
})
on('more:install', async () => {
  const prompt = window.__kcalInstallPrompt
  if (!prompt) {
    toast('Use your browser menu → “Install app”. The Windows and Android builds are already installed apps.', 'error')
    return
  }
  prompt.prompt()
  const choice = await prompt.userChoice
  window.__kcalInstallPrompt = null
  toast(choice.outcome === 'accepted' ? 'kcal installed' : 'Install dismissed')
})
