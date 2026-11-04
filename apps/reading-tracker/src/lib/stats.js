import { addDays, diffDays, startOfWeek } from './dates.js'

/** A day counts as a reading day when at least one page or minute was logged. */
export const readingDates = (sessions) => new Set(sessions.filter((s) => s.pages > 0 || s.minutes > 0).map((s) => s.date))

export function computeStreaks(dateSet, today) {
  const dates = [...dateSet].filter((d) => d <= today).sort()
  let longest = 0, run = 0, prev = null
  for (const d of dates) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }
  const readToday = dateSet.has(today)
  let cursor = readToday ? today : addDays(today, -1)
  let current = 0
  while (dateSet.has(cursor)) { current++; cursor = addDays(cursor, -1) }
  return {
    current,
    longest: Math.max(longest, current),
    readToday,
    lastReadDate: dates.length ? dates[dates.length - 1] : null,
    atRisk: current > 0 && !readToday,
  }
}

export function minutesBetween(sessions, from, to) {
  return sessions.reduce((sum, s) => (s.date >= from && s.date <= to ? sum + s.minutes : sum), 0)
}

export function weekMinutes(sessions, today, weekStartsOn = 1) {
  return minutesBetween(sessions, startOfWeek(today, weekStartsOn), today)
}

/** The last n calendar days, oldest first, with minutes and pages read on each. */
export function lastDays(sessions, today, n = 7) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    let minutes = 0, pages = 0
    for (const s of sessions) if (s.date === date) { minutes += s.minutes; pages += s.pages }
    out.push({ date, minutes, pages })
  }
  return out
}

export const finishedInYear = (books, year) => books.filter((b) => b.status === 'finished' && String(b.finishedAt || '').startsWith(String(year)))

export function totals(state) {
  const pages = state.sessions.reduce((n, s) => n + s.pages, 0)
  const minutes = state.sessions.reduce((n, s) => n + s.minutes, 0)
  return {
    pages,
    minutes,
    sessions: state.sessions.length,
    finished: state.books.filter((b) => b.status === 'finished').length,
    readingDays: readingDates(state.sessions).size,
  }
}

const TITLES = ['Page Sprout', 'Bookmark Scout', 'Chapter Chaser', 'Shelf Explorer', 'Story Weaver', 'Lore Keeper', 'Library Sage', 'Grand Archivist', 'Legend of the Stacks']

/** XP comes only from real reading: pages, minutes and finished books. */
export const xpOf = ({ pages, minutes, finished }) => pages + Math.floor(minutes / 2) + finished * 100

export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1
  const floorXp = 60 * (level - 1) ** 2
  const nextXp = 60 * level ** 2
  return {
    level,
    xp,
    floorXp,
    nextXp,
    progress: (xp - floorXp) / (nextXp - floorXp),
    title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))],
  }
}

/** curious · happy · ecstatic · content · sleepy · lonely — decided purely from the reading log. */
export function buddyMood({ streaks, today, planDoneToday }) {
  if (!streaks.lastReadDate) return 'curious'
  const since = diffDays(streaks.lastReadDate, today)
  if (since <= 0) return planDoneToday || streaks.current >= 7 ? 'ecstatic' : 'happy'
  if (since === 1) return 'content'
  if (since <= 3) return 'sleepy'
  return 'lonely'
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function buddyLine({ name, mood, streaks, today, pagesToday, weekMins, weeklyGoal }) {
  const since = streaks.lastReadDate ? diffDays(streaks.lastReadDate, today) : 0
  switch (mood) {
    case 'curious': return `Hi, I'm ${name}! Log your first reading session and I'll start keeping count.`
    case 'ecstatic': return streaks.current >= 7
      ? `${plural(streaks.current, 'day')} in a row! I could not be prouder.`
      : "Today's reading is done. That was a great session!"
    case 'happy': return weeklyGoal > 0 ? `You read today. ${weekMins} of ${weeklyGoal} minutes this week.` : 'You read today. Lovely!'
    case 'content': return pagesToday > 0 ? `Ready when you are. ${plural(pagesToday, 'page')} are waiting today.` : `Read yesterday, and still going. Want to keep the ${plural(streaks.current, 'day')} streak?`
    case 'sleepy': return `It has been ${plural(since, 'day')}. A few pages would wake me right up.`
    default: return `I've missed reading with you (${plural(since, 'day')}). Even one page counts.`
  }
}
