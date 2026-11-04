// Calendar dates are stored as local "YYYY-MM-DD" strings so a plan never shifts
// because of time zones or daylight-saving changes.
const LOCALE = 'en-IN'
const pad = (n) => String(n).padStart(2, '0')

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso))
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]) - 1, day = Number(m[3])
  const d = new Date(y, mo, day)
  return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null
}

export const isISO = (value) => parseISO(value) !== null
export const todayISO = () => toISO(new Date())

export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

const utcDay = (iso) => {
  const d = parseISO(iso)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole days from a to b (positive when b is later). */
export const diffDays = (a, b) => Math.round((utcDay(b) - utcDay(a)) / 86400000)

/** 0 = Sunday … 6 = Saturday */
export const weekday = (iso) => parseISO(iso).getDay()

export function startOfWeek(iso, weekStartsOn = 1) {
  return addDays(iso, -((weekday(iso) - weekStartsOn + 7) % 7))
}

/** Weeks (arrays of 7 ISO dates) covering the month; rows entirely outside the month are dropped. */
export function monthGrid(year, month, weekStartsOn = 1) {
  const first = toISO(new Date(year, month, 1))
  let cursor = startOfWeek(first, weekStartsOn)
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let i = 0; i < 7; i++) { row.push(cursor); cursor = addDays(cursor, 1) }
    if (row.some((iso) => parseISO(iso).getMonth() === month)) weeks.push(row)
  }
  return weeks
}

export const monthKey = (iso) => iso.slice(0, 7)
export const addMonths = (year, month, delta) => {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

const fmt = (options) => {
  const formatter = new Intl.DateTimeFormat(LOCALE, options)
  return (iso) => (parseISO(iso) ? formatter.format(parseISO(iso)) : '')
}
export const fmtLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const fmtMedium = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const fmtShort = fmt({ day: 'numeric', month: 'short' })
export const fmtDayMonth = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
export const fmtMonthYear = (year, month) => new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
export const weekdayName = (index, style = 'short') => new Intl.DateTimeFormat(LOCALE, { weekday: style }).format(new Date(2023, 0, 1 + index))
