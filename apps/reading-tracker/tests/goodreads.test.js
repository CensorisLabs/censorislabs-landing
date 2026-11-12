import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseGoodreads } from '../src/lib/goodreads.js'

test('quoted commas and escaped quotes survive CSV parsing', () => {
  const rows = parseCsv('Title,Author\n"Book, with comma","Name ""Nickname"" Here"\n')
  assert.deepEqual(rows[1], ['Book, with comma', 'Name "Nickname" Here'])
})

test('Goodreads shelves map to reading states', () => {
  const csv = [
    'Title,Author,Number of Pages,My Rating,Exclusive Shelf,ISBN,ISBN13,Date Read,Original Publication Year',
    'Dune,Frank Herbert,412,5,read,9780441013593,9780441013593,2024/01/02,1965',
    '"A Book, Maybe",Some Author,300,0,currently-reading,,, ,2020',
    'Later Title,Another Author,200,3,to-read,,, ,2019',
  ].join('\n')
  const { books, skipped } = parseGoodreads(csv)
  assert.equal(skipped, 0)
  assert.equal(books.length, 3)
  assert.deepEqual(books[0], {
    title: 'Dune', author: 'Frank Herbert', totalPages: 412, currentPage: 412,
    status: 'finished', rating: 5, isbn: '9780441013593', published: '1965', finishedAt: '2024-01-02',
  })
  assert.equal(books[1].title, 'A Book, Maybe')
  assert.equal(books[1].status, 'reading')
  assert.equal(books[1].currentPage, 0)
  assert.equal(books[2].status, 'planning')
})

test('a file without a Title column is rejected', () => {
  assert.throws(() => parseGoodreads('Author,Pages\nSomeone,100\n'), /no Title column/)
})
