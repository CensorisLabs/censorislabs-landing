import './shared/base.css'
import './components.css'
import './app.css'
import { mountApp } from './shared/shell.js'
import {
  state,
  getProfile,
  getDay,
  getTargets,
  update,
  persist,
  subscribe,
  undo,
  syncAchievements,
  logWater,
  profileStats,
  addDays,
  todayKey,
  dateKey,
  relativeDate,
  prettyDate,
  setWellbeing,
  MEALS,
} from './lib/store.js'
import { formatVolume, greeting, targetsFor } from './lib/calc.js'
import { icon, toast } from './lib/ui.js'
import { bindRenderer, ui, go, stepDate, goToday, on, handleAction, handleForm } from './lib/runtime.js'
import { renderToday } from './views/today.js'
import { renderDiary } from './views/diary.js'
import { renderProgress } from './views/progress.js'
import { renderPlan } from './views/plan.js'
import { renderCalendar } from './views/calendar.js'
import { renderStudio } from './views/studio.js'
import { renderMore } from './views/more.js'
import { openOnboarding } from './views/onboarding.js'
import {
  openDatePicker,
  openProfileSwitcher,
  openShortcuts,
} from './lib/dialogs-app.js'
import { openFoodPicker, openQuickAdd } from './lib/dialogs-food.js'

const NAV = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'diary', label: 'Diary', icon: 'book' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'plan', label: 'Plan', icon: 'utensils' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'studio', label: 'Studio', icon: 'flask' },
  { id: 'more', label: 'More', icon: 'settings' },
]

const VIEWS = {
  today: renderToday,
  diary: renderDiary,
  progress: renderProgress,
  plan: renderPlan,
  calendar: renderCalendar,
  studio: renderStudio,
  more: renderMore,
}

mountApp({
  appId: 'calorie-calculator',
  eyebrow: 'HEALTH · KCAL DAILY TRACKER',
  title: 'A clearer daily target.',
  description: 'Track food, energy, protein, fibre and water in one private place. Built for real days, not perfect ones.',
  content: `<div class="kc-app" id="kcal-app">
    <header class="kc-datebar">
      <div class="kc-datebar__identity">
        <button type="button" class="kc-avatar" id="kc-avatar" data-action="app:profile" aria-label="Open profile switcher">🌿</button>
        <div><p class="kc-eyebrow" id="kc-date-eyebrow">TODAY</p><h1 id="kc-greeting">Hello</h1><p class="kc-date-sub" id="kc-date-sub"></p></div>
      </div>
      <div class="kc-datebar__tools">
        <span class="kc-streak-chip" id="kc-streak-chip"></span>
        <div class="kc-date-nav"><button type="button" class="kc-icon-btn" data-action="app:prev" aria-label="Previous day">${icon('left')}</button><button type="button" class="kc-date-pill" id="kc-date-button" data-action="app:date" aria-label="Choose a date">Today</button><button type="button" class="kc-icon-btn" data-action="app:next" aria-label="Next day">${icon('right')}</button></div>
        <button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" id="kc-today-button" data-action="app:today">Today</button>
        <button type="button" class="kc-icon-btn" data-action="app:undo" aria-label="Undo last change" title="Undo">${icon('undo')}</button>
      </div>
    </header>
    <nav class="kc-top-nav" aria-label="Tracker sections">${NAV.map(item => `<button type="button" class="kc-top-nav__item" data-action="app:nav" data-view="${item.id}">${icon(item.icon)}<span>${item.label}</span></button>`).join('')}</nav>
    <section class="kc-view-root" id="kc-view" aria-live="polite"></section>
    <nav class="kc-bottom-nav" aria-label="Tracker sections">${NAV.map(item => `<button type="button" class="kc-bottom-nav__item" data-action="app:nav" data-view="${item.id}">${icon(item.icon)}<span>${item.label}</span></button>`).join('')}</nav>
    <div class="kc-offline-chip" id="kc-offline" hidden>${icon('offline')} Offline — everything still works</div>
  </div>`,
})

const $ = selector => document.querySelector(selector)
let onboardingShown = false
let booted = false
let lastAchievementCheck = 0
let lastView = ''

function applyTheme() {
  document.documentElement.dataset.kcAccent = state.settings.accent || 'lime'
  document.documentElement.dataset.kcDensity = state.settings.density || 'comfortable'
  document.documentElement.dataset.kcTheme = state.settings.theme || 'dark'
  document.documentElement.dataset.kcNature = state.settings.nature ? 'true' : 'false'
}

function updateHeader() {
  const profile = getProfile()
  const stats = profileStats(profile.id)
  const dateEyebrow = ui.date === todayKey() ? 'TODAY' : relativeDate(ui.date).toUpperCase()
  const eyebrow = $('#kc-date-eyebrow')
  if (eyebrow) eyebrow.textContent = dateEyebrow
  const greetingNode = $('#kc-greeting')
  if (greetingNode) greetingNode.textContent = ui.date === todayKey() ? greeting(profile.name) : prettyDate(ui.date, { weekday: 'long', day: 'numeric', month: 'long' })
  const avatar = $('#kc-avatar')
  if (avatar) { avatar.textContent = profile.emoji || '🌿'; avatar.setAttribute('aria-label', `Open profiles — ${profile.name}`) }
  const dateSub = $('#kc-date-sub')
  if (dateSub) dateSub.textContent = `${fmtTargets()} · ${profile.diet === 'omnivore' ? 'all foods' : profile.diet} · ${state.profiles.length} profile${state.profiles.length === 1 ? '' : 's'}`
  const dateButton = $('#kc-date-button')
  if (dateButton) { dateButton.textContent = ui.date === todayKey() ? 'Today' : prettyDate(ui.date); dateButton.classList.toggle('is-past', ui.date < todayKey()) }
  const todayButton = $('#kc-today-button')
  if (todayButton) todayButton.hidden = ui.date === todayKey()
  const streak = $('#kc-streak-chip')
  if (streak) { streak.innerHTML = `${icon('flame')} ${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`; streak.classList.toggle('is-empty', stats.currentStreak === 0) }
  document.querySelectorAll('[data-action="app:nav"]').forEach(button => {
    const active = button.dataset.view === ui.view
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-current', active ? 'page' : 'false')
  })
  const offline = $('#kc-offline')
  if (offline) offline.hidden = navigator.onLine
}

function fmtTargets() {
  const target = targetsFor(getProfile())
  return `${target.kcal.toLocaleString('en-IN')} kcal target`
}

function render() {
  applyTheme()
  updateHeader()
  const root = $('#kc-view')
  if (!root) return
  const scrollY = window.scrollY
  const active = document.activeElement
  const activeId = active && active.id && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) ? active.id : ''
  const selectionStart = active?.selectionStart
  const selectionEnd = active?.selectionEnd
  const viewFunction = VIEWS[ui.view] || renderToday
  viewFunction(root)
  if (ui.view !== lastView) {
    window.scrollTo({ top: 0, behavior: 'auto' })
    lastView = ui.view
  } else {
    window.scrollTo({ top: scrollY, behavior: 'auto' })
  }
  if (activeId) {
    const element = document.getElementById(activeId)
    if (element) {
      element.focus({ preventScroll: true })
      try { element.setSelectionRange(selectionStart, selectionEnd) } catch { /* select elements do not support selection */ }
    }
  }
  if (booted && Date.now() - lastAchievementCheck > 2500) {
    lastAchievementCheck = Date.now()
    const unlocked = syncAchievements()
    if (unlocked.length) {
      toast(`Badge unlocked: ${unlocked.slice(0, 2).map(item => item.name).join(', ')}${unlocked.length > 2 ? ` +${unlocked.length - 2}` : ''}`)
    }
  }
  booted = true
  if (!state.onboarded && !onboardingShown) {
    onboardingShown = true
    window.setTimeout(() => openOnboarding(), 350)
  }
}

on('app:nav', element => {
  const view = element.dataset.view
  if (!VIEWS[view]) return
  try { sessionStorage.setItem('kcal-view', view) } catch { /* private mode */ }
  go(view)
})
on('app:prev', () => stepDate(-1))
on('app:next', () => stepDate(1))
on('app:today', () => goToday())
on('app:date', () => openDatePicker())
on('app:profile', () => openProfileSwitcher())
on('app:undo', () => {
  const label = undo()
  toast(label ? `Undid: ${label}` : 'Nothing to undo', label ? 'ok' : 'error')
})

document.addEventListener('click', event => {
  const element = event.target.closest('[data-action]')
  if (!element) return
  if (!element.matches('input, select, textarea')) event.preventDefault()
  handleAction(element.dataset.action, element, event)
})
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]')
  if (!form) return
  event.preventDefault()
  handleForm(form.dataset.form, form, event)
})

window.addEventListener('online', () => { updateHeader(); toast('Back online') })
window.addEventListener('offline', () => { updateHeader(); toast('Offline — kcal keeps working') })
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  window.__kcalInstallPrompt = event
})

document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable
  if (document.querySelector('.kc-modal-backdrop')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !typing) {
    event.preventDefault()
    const label = undo()
    toast(label ? `Undid: ${label}` : 'Nothing to undo', label ? 'ok' : 'error')
    return
  }
  if (typing) return
  if (event.key === '/') { event.preventDefault(); openFoodPicker({ date: ui.date, meal: null }) }
  else if (event.key.toLowerCase() === 'n') { event.preventDefault(); openQuickAdd({ date: ui.date, meal: null }) }
  else if (event.key.toLowerCase() === 'w') {
    event.preventDefault()
    update(() => logWater(ui.date, 250), { label: 'Log water' })
    toast('+250 ml water')
  } else if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    update(() => setWellbeing('steps', daySteps() + 2500, ui.date), { label: 'Add steps' })
    toast(`+2,500 steps`)
  } else if (event.key.toLowerCase() === 'd') { event.preventDefault(); go('diary') }
  else if (event.key.toLowerCase() === 'p') { event.preventDefault(); go('progress') }
  else if (event.key.toLowerCase() === 't') { event.preventDefault(); goToday() }
  else if (event.key === '?') { event.preventDefault(); openShortcuts() }
})

function daySteps() {
  return Number(getDay(ui.date).steps || 0)
}

window.addEventListener('censorislabs:save-error', () => toast('Local storage is full or unavailable. Export a backup.', 'error'))

subscribe(() => render())
bindRenderer(render)

try {
  const savedView = sessionStorage.getItem('kcal-view')
  if (savedView && VIEWS[savedView]) ui.view = savedView
} catch { /* private mode */ }

render()

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          // Only announce a genuinely newer build, not the first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            notify('Update ready', 'A new version is downloaded. Reopen kcal to use it — your diary is safe.')
          }
        })
      })
    }).catch(() => { /* offline cache is a progressive enhancement */ })
  })
}

let lastWaterReminder = 0
let lastMealReminder = ''
function checkReminders() {
  if (!state.settings.reminders) return
  const profile = getProfile()
  const targets = getTargets(profile)
  const day = getDay(ui.date)
  const now = Date.now()
  if (state.settings.reminders.water && now - lastWaterReminder > (state.settings.waterInterval || 90) * 60000) {
    if ((day.water || 0) < targets.water * 0.75) {
      lastWaterReminder = now
      notify('Time for water', `${formatVolume(Math.max(0, targets.water - (day.water || 0)))} still to go today.`)
    }
  }
  if (state.settings.reminders.meals) {
    const hour = new Date().getHours()
    const meal = hour === 8 ? 'breakfast' : hour === 13 ? 'lunch' : hour === 20 ? 'dinner' : null
    if (meal) {
      const key = `${dateKey()}-${meal}`
      if (lastMealReminder !== key && (getDay(dateKey()).meals[meal] || []).length === 0) {
        lastMealReminder = key
        notify('kcal check-in', `${MEALS.find(item => item.id === meal)?.name} is not logged yet. A quick entry is enough.`)
      }
    }
  }
}
function notify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: './icon.svg', tag: 'kcal-reminder' })
    else toast(body)
  } catch { toast(body) }
}
window.setInterval(checkReminders, 60000)
