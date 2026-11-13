import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestCategory } from '../src/domain/statement.ts'

test('transfer credits are not classified as income', () => {
  assert.equal(suggestCategory('Self transfer', 'income', 'NEFT CR SELF TRANSFER').category, 'Transfers')
  assert.equal(suggestCategory('Credit card payment', 'income', 'UPI CREDIT CARD PAYMENT').category, 'Transfers')
})

test('salary and ordinary NEFT credits remain income', () => {
  assert.equal(suggestCategory('Acme Corp', 'income', 'NEFT CR SALARY').category, 'Income')
  assert.equal(suggestCategory('Acme Corp', 'income', 'NEFT CR INVOICE 42').category, 'Income')
})

test('payment channels alone do not make an expense a transfer', () => {
  assert.equal(suggestCategory('Local shop', 'expense', 'UPI/IMPS PAYMENT').category, 'Daily life')
  assert.equal(suggestCategory('Loan repayment', 'expense', 'NACH LOAN EMI').category, 'Transfers')
})