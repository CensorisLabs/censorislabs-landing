import test from 'node:test'
import assert from 'node:assert/strict'
import { BRAND_FOODS, BRAND_CODE_MAP, BRAND_MAP } from '../src/data/brands.js'

test('the bundled catalogue is present', () => {
  assert.ok(BRAND_FOODS.length >= 50, `expected a useful catalogue, found ${BRAND_FOODS.length}`)
  assert.equal(BRAND_CODE_MAP.size, BRAND_FOODS.length)
  assert.equal(BRAND_MAP.size, BRAND_FOODS.length)
})

test('every barcode is a scannable 8-14 digit code and is unique', () => {
  const seen = new Set()
  for (const food of BRAND_FOODS) {
    assert.match(food.code, /^[0-9]{8,14}$/, `${food.name} has an invalid barcode`)
    assert.ok(!seen.has(food.code), `duplicate barcode ${food.code}`)
    seen.add(food.code)
  }
})

test('every entry has usable nutrition', () => {
  for (const food of BRAND_FOODS) {
    assert.ok(food.name.length > 1, 'missing name')
    assert.equal(food.per, 100)
    assert.ok(food.kcal > 0 && food.kcal <= 900, `${food.name} has implausible energy`)
    for (const key of ['p', 'c', 'f', 'fib', 'sug']) {
      const value = food[key]
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${food.name} has an invalid ${key}`)
    }
    const expected = food.p * 4 + food.c * 4 + food.f * 9
    assert.ok(Math.abs(food.kcal - expected) <= Math.max(80, expected * 0.3), `${food.name} energy disagrees with its macros`)
    assert.ok(food.serving.g >= 1 && food.serving.g <= 500, `${food.name} has an invalid serving`)
  }
})

test('barcode lookup resolves and never returns user food ids', () => {
  const food = BRAND_CODE_MAP.get(BRAND_FOODS[0].code)
  assert.equal(food.id, BRAND_FOODS[0].id)
  assert.ok(food.id.startsWith('brand-'))
  assert.equal(BRAND_CODE_MAP.get('00000000'), undefined)
})
