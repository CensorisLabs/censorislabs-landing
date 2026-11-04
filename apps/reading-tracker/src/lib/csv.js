const GUARD = /^[=+\-@\t\r]/

/** One CSV cell. Text starting with = + - @ gets a leading apostrophe so spreadsheets never run it as a formula. */
export function csvCell(value) {
  if (value == null) return ''
  let text = String(value)
  if (typeof value === 'string' && GUARD.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCSV(columns, rows) {
  const head = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(row) : row[c.key])).join(','))
  return [head, ...body].join('\r\n') + '\r\n'
}

const titleMap = (state) => new Map(state.books.map((b) => [b.id, b.title]))

export function booksCSV(state) {
  return toCSV([
    { label: 'Title', key: 'title' },
    { label: 'Author', key: 'author' },
    { label: 'Status', key: 'status' },
    { label: 'Current page', key: 'currentPage' },
    { label: 'Total pages', key: 'totalPages' },
    { label: 'Genre', key: 'genre' },
    { label: 'Format', key: 'format' },
    { label: 'Edition', key: 'edition' },
    { label: 'Publisher', key: 'publisher' },
    { label: 'ISBN', key: 'isbn' },
    { label: 'Published', key: 'published' },
    { label: 'Series', key: 'series' },
    { label: 'Series order', key: 'seriesOrder' },
    { label: 'Synopsis', key: 'synopsis' },
    { label: 'Price paid', key: 'price' },
    { label: 'Signed copy', get: (b) => (b.signed ? 'yes' : 'no') },
    { label: 'Loan status', get: (b) => b.loan?.status || '' },
    { label: 'Loan person', get: (b) => b.loan?.person || '' },
    { label: 'Loan due', get: (b) => b.loan?.dueDate || '' },
    { label: 'Tags', get: (b) => b.tags.join('; ') },
    { label: 'Favourite', get: (b) => (b.favorite ? 'yes' : 'no') },
    { label: 'Rating (1-5)', get: (b) => (b.rating || '') },
    { label: 'Review', key: 'review' },
    { label: 'Started', key: 'startedAt' },
    { label: 'Finished', key: 'finishedAt' },
    { label: 'Plan difficulty', get: (b) => b.plan?.difficulty || '' },
    { label: 'Plan start', get: (b) => b.plan?.startDate || '' },
    { label: 'Plan last day', get: (b) => b.plan?.days.at(-1)?.date || '' },
  ], state.books)
}

export function sessionsCSV(state) {
  const titles = titleMap(state)
  const rows = [...state.sessions].sort((a, b) => a.date.localeCompare(b.date))
  return toCSV([
    { label: 'Date', key: 'date' },
    { label: 'Book', get: (s) => titles.get(s.bookId) || '' },
    { label: 'Pages', key: 'pages' },
    { label: 'Minutes', key: 'minutes' },
    { label: 'Words', key: 'words' },
    { label: 'Chapter', key: 'chapter' },
    { label: 'Reading place', key: 'place' },
    { label: 'Ritual', key: 'ritual' },
    { label: 'Session note', key: 'memo' },
    { label: 'Source', key: 'source' },
  ], rows)
}

export function notesCSV(state) {
  const titles = titleMap(state)
  return toCSV([
    { label: 'Book', get: (n) => titles.get(n.bookId) || '' },
    { label: 'Page', get: (n) => n.page ?? '' },
    { label: 'Chapter / timestamp', key: 'chapter' },
    { label: 'Note', key: 'text' },
    { label: 'Created', key: 'createdAt' },
  ], state.notes)
}

export function quotesCSV(state) {
  const titles = titleMap(state)
  return toCSV([
    { label: 'Book', get: (q) => titles.get(q.bookId) || '' },
    { label: 'Page', get: (q) => q.page ?? '' },
    { label: 'Chapter / timestamp', key: 'chapter' },
    { label: 'Quote', key: 'text' },
    { label: 'My thought', key: 'comment' },
    { label: 'Theme tags', get: (q) => (q.tags || []).join('; ') },
    { label: 'Favourite', get: (q) => (q.favorite ? 'yes' : 'no') },
    { label: 'Saved', key: 'createdAt' },
  ], state.quotes)
}
