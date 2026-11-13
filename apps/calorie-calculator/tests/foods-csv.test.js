import test from 'node:test'
import assert from 'node:assert/strict'
import { readFoodsCsv } from '../src/lib/foods-csv.js'

const csv = [
  'Name,Brand,Barcode,Kcal,Protein,Carbs,Fat,Fibre,Sugar,Sodium (mg),Serving (g),Serving label,Diet',
  'Chocolate Muesli,"Yoga Bar",8906080300012,398,12,56,12,8,14,180,40,40 g pack,veg',
  'Peanut Butter,Suncup,8906001234567,600,25,20,48,6,8,290,30,30 g,vegan',
  'Mystery Snack,Local Brand,123,450,5,60,20,2,10,300,50,50 g,',
].join('\r\n')

test('reads foods, keeps quoted names and normalises barcodes', () => {
  const { foods } = readFoodsCsv(csv)
  assert.equal(foods.length, 3)
  assert.equal(foods[0].name, 'Chocolate Muesli')
  assert.equal(foods[0].brand, 'Yoga Bar')
  assert.equal(foods[0].code, '8906080300012')
  assert.deepEqual(foods[0].tags, ['imported', 'v'])
  assert.equal(foods[0].dietUnknown, false)
  assert.deepEqual(foods[1].tags, ['imported', 'vg', 'v'])
})

test('salt is converted to sodium and short barcodes are dropped', () => {
  const { foods } = readFoodsCsv('Name,Salt (g),Barcode,Kcal\nSalted chips,1.2,123,500')
  assert.equal(foods[0].code, '')
  assert.equal(foods[0].na, 480)
})

test('missing calories are calculated from macros', () => {
  const { foods } = readFoodsCsv('Name,Protein,Carbs,Fat\nDal packet,20,55,8')
  assert.equal(foods[0].kcal, 372)
  assert.equal(foods[0].dietUnknown, true)
  assert.deepEqual(foods[0].tags, ['imported'])
})

test('micronutrient columns are imported per 100 g', () => {
  const { foods } = readFoodsCsv('Name,Kcal,Calcium (mg),Iron (mg),Vitamin C (mg),Vitamin A (µg),Potassium (mg),Magnesium (mg)\nRagi bowl,120,350,3.9,0,0,220,90')
  assert.deepEqual(foods[0].micros, { ca: 350, fe: 3.9, vc: 0, va: 0, k: 220, mg: 90 })
  assert.equal(foods[0].microsUnknown, false)
})

test('foods without micronutrient columns are marked as unknown, not zero', () => {
  const { foods } = readFoodsCsv('Name,Kcal\nPlain snack,200')
  assert.equal(foods[0].micros, undefined)
  assert.equal(foods[0].microsUnknown, true)
})

test('rows without a name or any nutrition are skipped', () => {
  const { foods, skipped } = readFoodsCsv('Name,Kcal\n,120\nEmpty food,\nReal food,90')
  assert.equal(foods.length, 1)
  assert.equal(foods[0].name, 'Real food')
  assert.equal(skipped, 2)
})

test('an unrelated CSV is rejected with a useful message', () => {
  assert.throws(() => readFoodsCsv('alpha,beta\n1,2'), /Could not find a food table/)
  assert.throws(() => readFoodsCsv(''), /no food rows/)
})
