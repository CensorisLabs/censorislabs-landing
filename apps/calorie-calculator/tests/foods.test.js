import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../src/data/foods.js'

test('every base food reports a micronutrient profile', () => {
  for (const food of FOODS) {
    assert.ok(food.micros, `${food.name} is missing micronutrients`)
    for (const key of ['ca', 'fe', 'vc', 'va', 'k', 'mg']) {
      assert.ok(Number.isFinite(food.micros[key]) && food.micros[key] >= 0, `${food.name} has an invalid ${key}`)
    }
  }
})