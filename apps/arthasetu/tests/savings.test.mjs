import test from 'node:test'
import assert from 'node:assert/strict'
import { savingsRate } from '../src/domain/finance.ts'

test('savingsRate reports what a period kept', () => {
  assert.equal(savingsRate(50_000, 20_000), 0.6)
  assert.equal(savingsRate(10_000, 10_000), 0)
})

test('savingsRate goes negative instead of flooring at zero', () => {
  assert.equal(savingsRate(50_000, 60_000), -0.2)
  assert.equal(savingsRate(100, 10_000), -99)
})

test('savingsRate declines to divide by a missing or invalid income', () => {
  assert.equal(savingsRate(0, 1_000), null)
  assert.equal(savingsRate(-500, 0), null)
  assert.equal(savingsRate(Number.NaN, 10), null)
  assert.equal(savingsRate(10, Number.POSITIVE_INFINITY), null)
})
