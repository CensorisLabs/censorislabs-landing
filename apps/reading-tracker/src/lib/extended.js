import { addDays } from './dates.js'

export function isValidIsbn(value) {
  const isbn = String(value || '').replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((n, digit, i) => n + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0)
    return sum % 11 === 0
  }
  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn].reduce((n, digit, i) => n + Number(digit) * (i % 2 ? 3 : 1), 0)
    return sum % 10 === 0 && (isbn.startsWith('978') || isbn.startsWith('979'))
  }
  return false
}

export function finishForecast(sessions, book, today) {
  const from = addDays(today, -6)
  const pages = sessions.filter(s => s.date >= from && s.date <= today).reduce((n, s) => n + Math.max(0, Number(s.pages) || 0), 0)
  const pace = pages / 7
  const remaining = Math.max(0, Number(book.totalPages) - Number(book.currentPage))
  return { pagesLastWeek: pages, pagesPerDay: pace, days: pace ? Math.ceil(remaining / pace) : null, date: pace ? addDays(today, Math.ceil(remaining / pace)) : null }
}

export function weeklyDigest(sessions, books, today) {
  const from = addDays(today, -6)
  const rows = sessions.filter(s => s.date >= from && s.date <= today)
  const byBook = new Map()
  for (const row of rows) byBook.set(row.bookId, (byBook.get(row.bookId) || 0) + (Number(row.pages) || 0))
  const favorite = [...byBook.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    from, to: today,
    pages: rows.reduce((n, s) => n + (Number(s.pages) || 0), 0),
    minutes: rows.reduce((n, s) => n + (Number(s.minutes) || 0), 0),
    sessions: rows.length,
    days: new Set(rows.filter(s => s.pages > 0 || s.minutes > 0).map(s => s.date)).size,
    topBook: favorite ? books.find(b => b.id === favorite[0])?.title || '' : '',
  }
}

export function recommendBook(books, mood, energy) {
  const available = books.filter(b => ['reading', 'planning'].includes(b.status))
  const scored = available.map(book => {
    let score = book.status === 'reading' ? 2 : 0
    const feel = book.readingFeel || 'balanced'
    if (energy === 'low' && feel === 'light') score += 5
    if (energy === 'high' && feel === 'deep') score += 5
    if (energy === 'steady' && feel === 'balanced') score += 3
    if (mood === 'wind-down' && feel === 'light') score += 3
    if (mood === 'curious' && (book.genre || '').toLowerCase().match(/history|science|essay|mystery|nonfiction/)) score += 3
    if (mood === 'focused' && feel === 'deep') score += 3
    score += Math.min(2, Number(book.priorityRank) || 0)
    return { book, score }
  }).sort((a, b) => b.score - a.score || String(a.book.title).localeCompare(String(b.book.title)))
  return scored[0]?.book || null
}

export function rateFlashcard(card, rating, today) {
  const old = Math.max(0, Number(card.intervalDays) || 0)
  const intervalDays = rating === 'again' ? 1 : rating === 'hard' ? Math.max(1, Math.ceil(old * 1.2)) : rating === 'easy' ? Math.max(3, Math.ceil(old * 2.5)) : Math.max(1, Math.ceil(old * 2))
  return { ...card, intervalDays, dueDate: addDays(today, intervalDays), reviews: (Number(card.reviews) || 0) + 1, lastRating: rating }
}

const icsEscape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const icsDate = value => String(value || '').replace(/-/g, '')

export function plansToICS(books, today) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const events = books.flatMap(book => (book.plan?.days || [])
    .filter(day => day.date >= today && day.endPage > (Number(book.currentPage) || 0))
    .map(day => `BEGIN:VEVENT\r\nUID:${book.id}-${day.date}@censorislabs\r\nDTSTAMP:${stamp}Z\r\nDTSTART;VALUE=DATE:${icsDate(day.date)}\r\nDTEND;VALUE=DATE:${icsDate(addDays(day.date, 1))}\r\nSUMMARY:${icsEscape(`Read ${book.title}`)}\r\nDESCRIPTION:${icsEscape(`Pages ${day.startPage}–${day.endPage} (${day.pages} pages)`)}\r\nEND:VEVENT`))
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CensorisLabs//Reading Tracker//EN\r\nCALSCALE:GREGORIAN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`
}

export function markdownArchive(state) {
  const lines = ['# Reading Tracker export', '', `Exported ${new Date().toISOString().slice(0, 10)}`, '']
  for (const book of state.books) {
    lines.push(`## ${book.title}`, '', `- Author: ${book.author || '—'}`, `- Publisher: ${book.publisher || '—'}`, `- Edition: ${book.edition || '—'}`, `- ISBN: ${book.isbn || '—'}`, `- Progress: ${book.currentPage || 0}/${book.totalPages || '—'} pages`, '')
    const notes = state.notes.filter(n => n.bookId === book.id)
    const quotes = state.quotes.filter(q => q.bookId === book.id)
    for (const note of notes) lines.push(`### Note${note.chapter ? ` · ${note.chapter}` : ''}${note.page ? ` · p. ${note.page}` : ''}`, '', note.text, '')
    for (const quote of quotes) lines.push(`> ${quote.text.replace(/\n/g, '\n> ')}`, '', `— ${quote.chapter || 'Highlight'}${quote.page ? `, p. ${quote.page}` : ''}`, quote.tags?.length ? `Tags: ${quote.tags.join(', ')}` : '', '')
  }
  return lines.join('\n').trimEnd() + '\n'
}
