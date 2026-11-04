import test from 'node:test'
import assert from 'node:assert/strict'
import { finishForecast, isValidIsbn, markdownArchive, plansToICS, rateFlashcard, recommendBook, weeklyDigest } from '../src/lib/extended.js'

test('ISBN check digits accept valid 10 and 13 digit values', () => {
  assert.equal(isValidIsbn('0-306-40615-2'), true)
  assert.equal(isValidIsbn('978 0 306 40615 7'), true)
  assert.equal(isValidIsbn('9780306406158'), false)
})

test('finish forecast uses the rolling seven day page pace', () => {
  const result = finishForecast([{ date: '2025-01-05', pages: 14 }], { currentPage: 30, totalPages: 100 }, '2025-01-07')
  assert.equal(result.pagesLastWeek, 14)
  assert.equal(result.pagesPerDay, 2)
  assert.equal(result.days, 35)
  assert.equal(result.date, '2025-02-11')
})

test('weekly digest summarizes pages, minutes, days, and most-read book', () => {
  const result = weeklyDigest([
    { bookId: 'a', date: '2025-01-06', pages: 12, minutes: 30 },
    { bookId: 'a', date: '2025-01-07', pages: 8, minutes: 15 },
    { bookId: 'b', date: '2025-01-07', pages: 4, minutes: 5 },
  ], [{ id: 'a', title: 'North' }, { id: 'b', title: 'South' }], '2025-01-07')
  assert.deepEqual([result.pages, result.minutes, result.sessions, result.days, result.topBook], [24, 50, 3, 2, 'North'])
})

test('energy matcher prefers a suitable current or queued book', () => {
  const books = [
    { id: 'deep', title: 'Deep Study', status: 'reading', readingFeel: 'deep' },
    { id: 'light', title: 'Short Stories', status: 'planning', readingFeel: 'light' },
  ]
  assert.equal(recommendBook(books, 'wind-down', 'low').id, 'light')
  assert.equal(recommendBook(books, 'focused', 'high').id, 'deep')
})

test('flashcard ratings schedule increasing review intervals', () => {
  const card = { intervalDays: 3, reviews: 2 }
  assert.equal(rateFlashcard(card, 'again', '2025-01-07').dueDate, '2025-01-08')
  assert.equal(rateFlashcard(card, 'good', '2025-01-07').intervalDays, 6)
  assert.equal(rateFlashcard(card, 'easy', '2025-01-07').intervalDays, 8)
})

test('calendar export writes future unfinished plan days as all-day events', () => {
  const result = plansToICS([{ id: 'b1', title: 'A Book, Again', currentPage: 4, plan: { days: [
    { date: '2025-01-06', startPage: 1, endPage: 2, pages: 1 },
    { date: '2025-01-08', startPage: 5, endPage: 7, pages: 3 },
  ] } }], '2025-01-07')
  assert.match(result, /BEGIN:VCALENDAR/)
  assert.match(result, /DTSTART;VALUE=DATE:20250108/)
  assert.match(result, /SUMMARY:Read A Book\\, Again/)
  assert.equal((result.match(/BEGIN:VEVENT/g) || []).length, 1)
})

test('Markdown archive includes per-book metadata, notes, and highlights', () => {
  const result = markdownArchive({
    books: [{ id: 'b', title: 'North', currentPage: 4, totalPages: 20, publisher: 'Press', edition: '2nd' }],
    notes: [{ bookId: 'b', text: 'Remember this', page: 4 }],
    quotes: [{ bookId: 'b', text: 'A saved line', page: 5, tags: ['hope'] }],
  })
  assert.match(result, /Publisher: Press/)
  assert.match(result, /Remember this/)
  assert.match(result, /> A saved line/)
})
