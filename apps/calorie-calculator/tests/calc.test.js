import test from 'node:test'
import assert from 'node:assert/strict'
import { nutrientsForFood, sumNutrients } from '../src/lib/calc.js'

const knownFood = { per: 100, kcal: 100, p: 5, c: 10, f: 2, fib: 1, sug: 1, na: 20, micros: { ca: 100, fe: 2, vc: 5, va: 10, k: 200, mg: 20 } }
const unknownFood = { per: 100, kcal: 200, p: 8, c: 20, f: 5, fib: 2, sug: 2, na: 50, microsUnknown: true }

test('micronutrient coverage tracks entries with real data', () => {
  const known = { nutrients: nutrientsForFood(knownFood, 100) }
  const unknown = { nutrients: nutrientsForFood(unknownFood, 100) }
  const totals = sumNutrients([known, unknown])
  assert.equal(totals.microsEntries, 2)
  assert.equal(totals.microsKnownEntries, 1)
  assert.equal(totals.micros.ca, 100)
})

test('foods without a micronutrient profile are not treated as zero-data foods', () => {
  const nutrients = nutrientsForFood(unknownFood, 100)
  assert.equal(nutrients.microsKnown, false)
  assert.equal(nutrients.micros.ca, 0)
})

test('legacy entries with visible micronutrients still count as known', () => {
  const totals = sumNutrients([{ nutrients: { kcal: 100, micros: { ca: 10 } } }])
  assert.equal(totals.microsKnownEntries, 1)
})