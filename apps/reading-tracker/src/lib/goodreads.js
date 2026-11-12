// Minimal Goodreads library export parser. Goodreads wraps fields in quotes and
// includes extra columns, so this parses the CSV properly instead of splitting
// on commas. Unknown shelves are ignored rather than guessed.

const SHELF_STATUS = { read: 'finished', 'currently-reading': 'reading', 'to-read': 'planning' }

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ',') { row.push(field); field = '' }
    else if (character === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (character !== '\r') field += character
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

export function parseGoodreads(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return { books: [], skipped: 0 }
  const header = rows[0].map(cell => cell.trim().toLowerCase())
  const column = name => header.indexOf(name)
  const titleAt = column('title')
  if (titleAt < 0) throw new Error('This does not look like a Goodreads library export: no Title column.')
  const authorAt = column('author')
  const pagesAt = column('number of pages')
  const ratingAt = column('my rating')
  const shelfAt = column('exclusive shelf')
  const isbnAt = column('isbn')
  const isbn13At = column('isbn13')
  const dateAt = column('date read')
  const yearAt = column('original publication year')
  const books = []
  let skipped = 0
  for (const row of rows.slice(1)) {
    const title = String(row[titleAt] || '').trim()
    if (!title) { skipped += 1; continue }
    const shelf = String(row[shelfAt] || '').trim().toLowerCase()
    const status = SHELF_STATUS[shelf] || 'planning'
    const totalPages = Math.max(0, Number(row[pagesAt]) || 0)
    const rating = Math.min(5, Math.max(0, Number(row[ratingAt]) || 0))
    const rawIsbn = String(row[isbnAt] || '').replace(/[^0-9Xx]/g, '')
    const rawIsbn13 = String(row[isbn13At] || '').replace(/[^0-9Xx]/g, '')
    const dateRead = String(row[dateAt] || '').trim()
    const slashDate = dateRead.match(/^([0-9]{4})[/-]([0-9]{1,2})[/-]([0-9]{1,2})$/)
    const parsedDate = !slashDate && dateRead ? new Date(dateRead) : null
    books.push({
      title,
      author: String(row[authorAt] || '').trim(),
      totalPages,
      currentPage: status === 'finished' ? totalPages : 0,
      status,
      rating,
      isbn: rawIsbn13 || rawIsbn,
      published: String(row[yearAt] || '').trim(),
      finishedAt: slashDate ? `${slashDate[1]}-${slashDate[2].padStart(2, '0')}-${slashDate[3].padStart(2, '0')}` : parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '',
    })
  }
  return { books, skipped }
}
