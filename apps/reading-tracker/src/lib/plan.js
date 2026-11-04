import { addDays, weekday } from './dates.js'

/**
 * How the plan grows: day 1 is always exactly one page, then the daily target
 * climbs by `rate` pages per reading day until it reaches `cap` pages, where it
 * stays until the last page. Harder books climb more slowly and level off lower,
 * so they take more days; easier books ramp up quickly.
 */
export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', hint: 'Light and quick to follow', rate: 3, cap: 40 },
  { id: 'medium', label: 'Moderate', hint: 'Needs steady attention', rate: 2, cap: 25 },
  { id: 'hard', label: 'Hard', hint: 'Dense ideas, read slowly', rate: 1, cap: 15 },
  { id: 'dense', label: 'Very hard', hint: 'Technical or heavy going', rate: 0.5, cap: 8 },
]

export const difficultyOf = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1]

/** Pages to read on each reading day. Starts at 1 and always sums to totalPages. */
export function dailyTargets(totalPages, difficultyId = 'medium') {
  const total = Math.floor(Number(totalPages))
  if (!Number.isFinite(total) || total < 1) return []
  const { rate, cap } = difficultyOf(difficultyId)
  const out = []
  let remaining = total
  while (remaining > 0) {
    let target = Math.round(Math.min(cap, 1 + rate * out.length))
    if (out.length) target = Math.max(target, out[out.length - 1])
    target = Math.min(target, remaining)
    out.push(target)
    remaining -= target
  }
  // A final day of only a page or two is not worth a day of its own: fold it into the day before.
  if (out.length > 2) {
    const last = out[out.length - 1]
    const prev = out[out.length - 2]
    if (last < Math.ceil(prev * 0.2)) { out.pop(); out[out.length - 1] = prev + last }
  }
  return out
}

export function normalizeReadingDays(days) {
  const set = new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  return set.size ? [...set].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6]
}

export function nextReadingDate(iso, readingDays) {
  let date = iso
  for (let i = 0; i < 8; i++) {
    if (readingDays.includes(weekday(date))) return date
    date = addDays(date, 1)
  }
  return iso
}

/**
 * `fromPage` is the page already reached (0 for a new book). The plan covers the
 * remaining pages, starts at exactly one page, and ends on `totalPages`.
 */
export function buildPlan({ totalPages, startDate, difficulty = 'medium', readingDays, fromPage = 0 }) {
  const total = Math.floor(Number(totalPages))
  const from = Math.max(0, Math.floor(Number(fromPage)) || 0)
  if (!Number.isFinite(total) || total < 1) throw new Error('Enter a page count of at least 1.')
  if (from >= total) throw new Error('This book is already finished, so there is nothing left to plan.')
  const targets = dailyTargets(total - from, difficulty)
  const days = normalizeReadingDays(readingDays)
  let date = nextReadingDate(startDate, days)
  let page = from
  const list = targets.map((pages) => {
    const entry = { date, pages, startPage: page + 1, endPage: page + pages }
    page += pages
    date = nextReadingDate(addDays(date, 1), days)
    return entry
  })
  return {
    difficulty: difficultyOf(difficulty).id,
    readingDays: days,
    startDate: list[0].date,
    createdAt: new Date().toISOString(),
    days: list,
  }
}

/** done: read through the end of the day · partial: started · missed: date passed · today / upcoming */
export function dayStatus(day, currentPage, today) {
  if (currentPage >= day.endPage) return 'done'
  const started = currentPage >= day.startPage
  if (day.date < today) return 'missed'
  if (day.date === today) return started ? 'partial' : 'today'
  return started ? 'partial' : 'upcoming'
}

/** The next unfinished day and the pages still to read in it. */
export function currentTarget(plan, currentPage, today) {
  if (!plan?.days?.length) return null
  const index = plan.days.findIndex((d) => d.endPage > currentPage)
  if (index === -1) return { kind: 'done' }
  const day = plan.days[index]
  const kind = day.date < today ? 'overdue' : day.date === today ? 'today' : 'upcoming'
  const from = Math.max(currentPage + 1, day.startPage)
  return { kind, index, day, from, to: day.endPage, pages: day.endPage - from + 1 }
}

export function planSummary(plan, currentPage, today) {
  const days = plan.days
  const firstOpen = days.findIndex((d) => d.endPage > currentPage)
  const before = days.filter((d) => d.date < today)
  const owed = before.length ? before[before.length - 1].endPage : 0
  const todayIndex = days.findIndex((d) => d.date === today)
  return {
    total: days.length,
    doneCount: firstOpen === -1 ? days.length : firstOpen,
    finished: firstOpen === -1,
    overduePages: Math.max(0, owed - currentPage),
    todayIndex,
    todayDone: todayIndex !== -1 && days[todayIndex].endPage <= currentPage,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    peak: Math.max(...days.map((d) => d.pages)),
  }
}

/** Keeps every target; moves the unfinished days so the next one lands on `fromISO` (or the next reading day). */
export function reschedulePlan(plan, fromISO, currentPage) {
  let date = nextReadingDate(fromISO, plan.readingDays)
  const days = plan.days.map((d) => {
    if (d.endPage <= currentPage) return { ...d }
    const moved = { ...d, date }
    date = nextReadingDate(addDays(date, 1), plan.readingDays)
    return moved
  })
  return { ...plan, days }
}
