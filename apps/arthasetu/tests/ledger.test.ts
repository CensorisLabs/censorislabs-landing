import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRule,
  detectSubscriptions,
  categoryTotals,
  formatDate,
  ledgerCsv,
  materializeRecurring,
  monthKey,
  monthLabel,
  monthTotals,
  nextId,
  recurringCommitment,
  saveRule,
  shiftMonth,
  spendChange,
  toIsoDate,
  topCategories,
} from '../src/domain/ledger.ts'

test('dates are normalised to ISO from statements, forms and old display strings', () => {
  assert.equal(toIsoDate('2026-10-09'), '2026-10-09')
  assert.equal(toIsoDate('09/10/2026'), '2026-10-09')
  assert.equal(toIsoDate('9-10-26'), '2026-10-09')
  assert.equal(toIsoDate('09 Oct 2026'), '2026-10-09')
  assert.equal(formatDate('2026-10-09'), '09 Oct 2026')
})

test('month helpers agree on boundaries', () => {
  assert.equal(monthKey(new Date(2026, 0, 31)), '2026-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(monthLabel('2026-10'), 'Oct 2026')
})

test('month totals only count the selected month', () => {
  const tx = [
    { date: '2026-10-01', amount: 500, type: 'expense' as const, category: 'Dining' },
    { date: '2026-10-02', amount: 2000, type: 'expense' as const, category: 'Home' },
    { date: '2026-10-03', amount: 50000, type: 'income' as const, category: 'Income' },
    { date: '2026-09-30', amount: 900, type: 'expense' as const, category: 'Travel' },
  ]
  assert.deepEqual(monthTotals(tx, '2026-10'), { income: 50000, expenses: 2500, net: 47500, count: 3 })
  assert.deepEqual(topCategories(tx, '2026-10'), [['Home', 2000], ['Dining', 500]])
  assert.equal(spendChange(tx, '2026-10').percent, 178)
})

test('repeated merchants become subscription candidates', () => {
  const tx = [
    { date: '2026-08-03', amount: 649, type: 'expense' as const, merchant: 'Netflix' },
    { date: '2026-09-03', amount: 649, type: 'expense' as const, merchant: 'Netflix' },
    { date: '2026-10-03', amount: 649, type: 'expense' as const, merchant: 'Netflix' },
    { date: '2026-10-04', amount: 250, type: 'expense' as const, merchant: 'Corner shop' },
    { date: '2026-10-05', amount: 649, type: 'income' as const, merchant: 'Netflix' },
  ]
  const found = detectSubscriptions(tx)
  assert.equal(found.length, 1)
  assert.equal(found[0].merchant, 'Netflix')
  assert.equal(found[0].months, 3)
})

test('merchant rules survive a storage round trip and are per merchant', () => {
  const memory = new Map<string, string>()
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value) },
    removeItem: key => { memory.delete(key) },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
  saveRule('Swiggy', 'Dining')
  assert.equal(applyRule('swiggy', 'Daily life'), 'Dining')
  assert.equal(applyRule('BigBasket', 'Daily life'), 'Daily life')
  saveRule('Swiggy', 'Groceries')
  assert.equal(applyRule('SWIGGY', 'Daily life'), 'Groceries')
})

test('ids stay unique inside one millisecond', () => {
  const ids = new Set(Array.from({ length: 500 }, () => nextId()))
  assert.equal(ids.size, 500)
})

test('monthly transactions materialise once per month without duplicates', () => {
  const source = { id: 1, date: '2026-01-31', amount: 649, type: 'expense' as const, merchant: 'Rent', recurring: 'monthly' as const }
  const first = materializeRecurring([source], '2026-03')
  assert.equal(first.length, 3)
  assert.deepEqual(first.slice(1).map(item => item.date), ['2026-02-28', '2026-03-31'])
  assert.ok(first.slice(1).every(item => item.recurrenceOf === 1))
  const second = materializeRecurring(first, '2026-03')
  assert.equal(second.length, 3)
})

test('recurring commitment counts rules, not generated copies', () => {
  const tx = [
    { id: 1, merchant: 'Rent', amount: 20000, type: 'expense' as const, recurring: 'monthly' as const },
    { id: 2, merchant: 'Rent', amount: 20000, type: 'expense' as const, recurrenceOf: 1 },
    { id: 3, merchant: 'Salary', amount: 90000, type: 'income' as const, recurring: 'monthly' as const },
  ]
  assert.deepEqual(recurringCommitment(tx), { count: 1, monthly: 20000, merchants: ['Rent'] })
})

test('ledger CSV quotes commas and quotes and starts with a BOM', () => {
  const csv = ledgerCsv([{ date: '2026-01-02', merchant: 'Cafe, "Blue"', category: 'Food', type: 'expense', account: 'UPI', amount: 250, splits: [{ category: 'Food', amount: 150 }, { category: 'Home', amount: 100 }] }])
  assert.ok(csv.startsWith(String.fromCharCode(65279) + 'date,merchant'))
  assert.ok(csv.includes('"Cafe, ""Blue"""'))
  assert.ok(csv.includes('Food:150 | Home:100'))
})

test('category totals honour a valid two-way split', () => {
  const tx = [{ category: 'Groceries', amount: 500, type: 'expense' as const, splits: [{ category: 'Groceries', amount: 300 }, { category: 'Home', amount: 200 }] }]
  assert.deepEqual(categoryTotals(tx), { Groceries: 300, Home: 200 })
})

test('category totals ignore splits that do not add up', () => {
  const tx = [{ category: 'Dining', amount: 500, type: 'expense' as const, splits: [{ category: 'Dining', amount: 300 }] }]
  assert.deepEqual(categoryTotals(tx), { Dining: 500 })
})
