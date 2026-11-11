import { getProfile, getDay, state, todayKey, addDays, prettyDate, parseKey, dateKey } from '../lib/store.js'
import { targetsFor, dayTotals, scoreDay, percent, formatWeight } from '../lib/calc.js'
import { icon, fmt, esc, toast, statBlock } from '../lib/ui.js'
import { on, refresh, ui, go, goToday, setDate } from '../lib/runtime.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthStart(offset) {
  const base = parseKey(todayKey())
  return new Date(base.getFullYear(), base.getMonth() + offset, 1)
}

function monthCells(start) {
  const firstWeekday = (start.getDay() + 6) % 7
  const gridStart = new Date(start)
  gridStart.setDate(start.getDate() - firstWeekday)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return dateKey(date)
  })
}

function streakLine(profile) {
  let cursor = todayKey()
  if (!dayHasRecord(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (dayHasRecord(cursor) && streak < 400) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function dayHasRecord(date) {
  const day = getDay(date, false)
  if (!day) return false
  const meals = ['breakfast', 'lunch', 'dinner', 'snacks'].some(meal => (day.meals?.[meal] || []).length)
  return meals || (day.water || 0) > 0 || (day.exercise || []).length > 0 || Boolean(day.steps) || Boolean(day.weight)
}

export function renderCalendar(root) {
  const profile = getProfile()
  const targets = targetsFor(profile)
  const start = monthStart(ui.calendarOffset || 0)
  const cells = monthCells(start)
  const monthLabel = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const monthPrefix = dateKey(start).slice(0, 7)
  const monthDates = cells.filter(date => date.startsWith(monthPrefix))
  const rows = monthDates.map(date => {
    const day = getDay(date, false)
    return { date, day, totals: dayTotals(profile, day), score: scoreDay(profile, day).score, logged: dayHasRecord(date) }
  })
  const logged = rows.filter(row => row.logged)
  const avgKcal = logged.length ? Math.round(logged.reduce((sum, row) => sum + row.totals.food.kcal, 0) / logged.length) : 0
  const targetDays = logged.filter(row => Math.abs(row.totals.food.kcal - targets.kcal) <= targets.kcal * 0.1).length
  const selected = ui.date

  root.innerHTML = `<div class="kc-view kc-calendar">
    <div class="kc-page-head"><div><p class="kc-eyebrow">CALENDAR</p><h1>${esc(monthLabel)}</h1><p>${logged.length} logged day${logged.length === 1 ? '' : 's'} · average ${fmt(avgKcal)} kcal · ${targetDays} within 10% of target</p></div><div class="kc-page-actions"><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="calendar:prev">${icon('left')} Previous</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="calendar:month" data-offset="0">This month</button><button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="calendar:next">Next ${icon('right')}</button></div></div>
    <section class="kc-card kc-calendar-card">
      <div class="kc-calendar-weekdays">${WEEKDAYS.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="kc-calendar-grid">${cells.map(date => {
        const inMonth = date.startsWith(monthPrefix)
        const day = getDay(date, false)
        const totals = dayTotals(profile, day)
        const score = scoreDay(profile, day).score
        const loggedDay = dayHasRecord(date)
        const isToday = date === todayKey()
        const isSelected = date === selected
        const over = totals.food.kcal > totals.budget
        return `<button type="button" class="kc-calendar-day ${inMonth ? '' : 'is-outside'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${loggedDay ? 'has-data' : ''} ${over && loggedDay ? 'is-over' : ''}" data-action="calendar:day" data-date="${date}" aria-label="${esc(prettyDate(date))}${loggedDay ? ` · ${fmt(totals.food.kcal)} kcal` : ' · no entries'}">
          <span class="kc-calendar-day__num">${Number(date.slice(8))}</span>
          ${loggedDay ? `<span class="kc-calendar-day__kcal">${fmt(totals.food.kcal)}</span><span class="kc-calendar-day__score">${score}</span>` : ''}
          ${(day?.water || 0) >= targets.water ? `<i class="kc-calendar-dot kc-calendar-dot--water" title="Water goal met"></i>` : ''}
          ${(day?.exercise || []).length ? `<i class="kc-calendar-dot kc-calendar-dot--move" title="Exercise logged"></i>` : ''}
        </button>`
      }).join('')}</div>
      <div class="kc-calendar-legend"><span><i class="kc-calendar-dot kc-calendar-dot--water"></i> Water goal</span><span><i class="kc-calendar-dot kc-calendar-dot--move"></i> Exercise</span><span>Number under each day is its score</span></div>
    </section>
    <div class="kc-stat-grid kc-stat-grid--four">
      ${statBlock('Logged days', `${logged.length}`, esc(monthLabel))}
      ${statBlock('Average intake', `${fmt(avgKcal)} kcal`, `${percent(avgKcal, targets.kcal)}% of target`)}
      ${statBlock('Current streak', `${streakLine(profile)} days`, 'Logging back from today')}
      ${statBlock('Weight', formatWeight(profile.weightKg, state.settings.units), 'Latest weigh-in')}
    </div>
    <div class="kc-inline-actions"><button type="button" class="kc-btn kc-btn--soft" data-action="calendar:today">${icon('calendar')} Open today</button><button type="button" class="kc-btn kc-btn--ghost" data-action="calendar:progress">${icon('chart')} Progress</button></div>
    <p class="kc-disclaimer">A day with no entries is not a failure; the calendar only shows what was recorded on this device.</p>
  </div>`
}

on('calendar:prev', () => { ui.calendarOffset = (ui.calendarOffset || 0) - 1; refresh() })
on('calendar:next', () => { ui.calendarOffset = (ui.calendarOffset || 0) + 1; refresh() })
on('calendar:month', () => { ui.calendarOffset = 0; refresh() })
on('calendar:day', element => {
  setDate(element.dataset.date)
  go('today')
})
on('calendar:today', () => { goToday(); go('today') })
on('calendar:progress', () => { go('progress') })
