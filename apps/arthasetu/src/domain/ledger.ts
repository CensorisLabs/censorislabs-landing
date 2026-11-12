// Ledger helpers shared by the ArthaSetu UI and its tests: dates, month
// windows, transaction ids, merchant category rules and simple insights.
//
// Dates are stored as ISO (YYYY-MM-DD) so month filtering and sorting are
// reliable. Every helper accepts the older display strings too, which is how
// existing backups and the old hardcoded entries are migrated on read.

export type TxType = 'income' | 'expense'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const RULES_KEY = 'arthasetu-category-rules'

const pad = (value: number) => String(value).padStart(2, '0')

export function toIsoDate(value: string): string {
  const text = String(value || '').trim()
  if (!text) return todayIso()
  let match = text.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  match = text.match(/^([0-9]{1,2})[/.-]([0-9]{1,2})[/.-]([0-9]{2,4})$/)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += 2000
    return `${year}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`
  }
  match = text.match(/^([0-9]{1,2})[ -]([A-Za-z]{3,})[ -]([0-9]{2,4})$/)
  if (match) {
    const month = MONTHS.findIndex(name => name.toLowerCase() === match![2].slice(0, 3).toLowerCase()) + 1
    let year = Number(match[3])
    if (year < 100) year += 2000
    if (month) return `${year}-${pad(month)}-${pad(Number(match[1]))}`
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? todayIso() : isoFromDate(parsed)
}

export function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(): string {
  return isoFromDate(new Date())
}

export function formatDate(iso: string): string {
  const match = String(iso || '').match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/)
  if (!match) return String(iso || '')
  const month = MONTHS[Number(match[2]) - 1] || ''
  return `${match[3]} ${month} ${match[1]}`
}

export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function shiftMonth(key: string, delta: number): string {
  const match = String(key || '').match(/^([0-9]{4})-([0-9]{2})$/)
  if (!match) return monthKey()
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + delta, 1)
  return monthKey(date)
}

export function monthLabel(key: string): string {
  const match = String(key || '').match(/^([0-9]{4})-([0-9]{2})$/)
  if (!match) return ''
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`
}

let idCounter = 0
export function nextId(): number {
  idCounter = (idCounter + 1) % 1000
  return Date.now() * 1000 + idCounter
}

export function monthTotals(transactions: Array<{ date: string; amount: number; type: TxType }>, month: string) {
  let income = 0
  let expenses = 0
  let count = 0
  for (const item of transactions) {
    if (!String(item.date).startsWith(month)) continue
    count += 1
    if (item.type === 'income') income += item.amount
    else expenses += item.amount
  }
  return { income, expenses, net: income - expenses, count }
}

export function topCategories(transactions: Array<{ date: string; amount: number; type: TxType; category: string }>, month: string, limit = 4) {
  const totals: Record<string, number> = {}
  for (const item of transactions) {
    if (item.type !== 'expense' || !String(item.date).startsWith(month)) continue
    totals[item.category] = (totals[item.category] || 0) + item.amount
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit)
}

export function spendChange(transactions: Array<{ date: string; amount: number; type: TxType }>, month: string) {
  const current = monthTotals(transactions, month).expenses
  const previous = monthTotals(transactions, shiftMonth(month, -1)).expenses
  if (!previous) return { current, previous, percent: current ? 100 : 0 }
  return { current, previous, percent: Math.round(((current - previous) / previous) * 100) }
}

/** Merchants charged in two or more distinct months look like subscriptions. */
export function detectSubscriptions(transactions: Array<{ date: string; amount: number; type: TxType; merchant: string }>) {
  const groups: Record<string, { merchant: string; amount: number; months: Set<string> }> = {}
  for (const item of transactions) {
    if (item.type !== 'expense') continue
    const key = item.merchant.toLowerCase().trim()
    if (!key) continue
    const group = groups[key] || { merchant: item.merchant, amount: item.amount, months: new Set<string>() }
    group.months.add(String(item.date).slice(0, 7))
    group.amount = Math.max(group.amount, item.amount)
    groups[key] = group
  }
  return Object.values(groups)
    .filter(group => group.months.size >= 2)
    .map(group => ({ merchant: group.merchant, amount: group.amount, months: group.months.size }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readRules(): Record<string, string> {
  const store = storage()
  if (!store) return {}
  try {
    const parsed = JSON.parse(store.getItem(RULES_KEY) || '{}') as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
  } catch {
    return {}
  }
}

export function saveRule(merchant: string, category: string) {
  const store = storage()
  const key = String(merchant || '').toLowerCase().trim()
  if (!store || !key || !category) return
  const rules = readRules()
  if (rules[key] === category) return
  rules[key] = category
  try { store.setItem(RULES_KEY, JSON.stringify(rules)) } catch { /* private mode */ }
}

export function applyRule(merchant: string, fallback: string): string {
  return readRules()[String(merchant || '').toLowerCase().trim()] || fallback
}

export type RecurringTx = { id: number; date: string; recurring?: 'monthly'; recurrenceOf?: number }

function daysInMonth(key: string): number {
  const match = key.match(/^([0-9]{4})-([0-9]{2})$/)
  if (!match) return 28
  return new Date(Number(match[1]), Number(match[2]), 0).getDate()
}

/** Adds a monthly copy of each recurring transaction for every month after its
 * date up to the current month. Existing copies are detected by recurrenceOf +
 * month, so running this repeatedly never duplicates a row. */
export function materializeRecurring<T extends RecurringTx>(transactions: T[], currentMonth = monthKey()): T[] {
  const out = [...transactions]
  const covered = new Set(transactions.filter(item => item.recurrenceOf).map(item => `${item.recurrenceOf}:${item.date.slice(0, 7)}`))
  for (const source of transactions.filter(item => item.recurring === 'monthly' && !item.recurrenceOf)) {
    const day = Number(source.date.slice(8, 10)) || 1
    let key = shiftMonth(source.date.slice(0, 7), 1)
    for (let count = 0; count < 36 && key <= currentMonth; count += 1) {
      const marker = `${source.id}:${key}`
      if (!covered.has(marker)) {
        const date = `${key}-${String(Math.min(day, daysInMonth(key))).padStart(2, '0')}`
        out.push({ ...source, id: nextId(), date, recurring: undefined, recurrenceOf: source.id })
        covered.add(marker)
      }
      key = shiftMonth(key, 1)
    }
  }
  return out
}
