// Import foods (with optional barcodes) from a CSV written by the user or
// exported from another tracker. Imported foods become normal custom foods:
// they appear in search, can be scanned by barcode, and can be edited later.
//
// Expected columns (header names are matched loosely):
//   name, brand, barcode, category, kcal, protein, carbs, fat, fiber,
//   sugar, sodium (mg), serving (g), serving label, diet (veg/vegan/nonveg)

import { parseCsv } from './csv.js'

function headerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function numberFrom(value) {
  const raw = String(value ?? '').replace(/[^0-9.,-]/g, '')
  if (!raw) return 0
  const cleaned = /,[0-9]{3}([^0-9]|$)/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(headerKey(alias))
    if (index >= 0) return index
  }
  return -1
}

function dietTags(value) {
  const text = String(value || '').toLowerCase().trim()
  if (!text) return { tags: ['imported'], dietUnknown: true }
  if (text.includes('vegan')) return { tags: ['imported', 'vg', 'v'], dietUnknown: false }
  if (text.includes('veg')) return { tags: ['imported', 'v'], dietUnknown: false }
  if (text.includes('non') || text.includes('meat') || text.includes('egg')) return { tags: ['imported'], dietUnknown: false }
  return { tags: ['imported'], dietUnknown: true }
}

function normalizeCode(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '')
  if (digits.length >= 8 && digits.length <= 14) return digits
  return ''
}

export function readFoodsCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('That file has no food rows.')

  let headerIndex = -1
  let headers = []
  for (let index = 0; index < Math.min(rows.length, 6); index += 1) {
    const candidate = rows[index].map(headerKey)
    const hasName = candidate.some(value => ['name', 'food', 'food name', 'product', 'item', 'description'].includes(value))
    const hasNutrition = candidate.some(value => ['kcal', 'calories', 'energy', 'protein', 'carbs', 'carbohydrates', 'fat'].includes(value))
    if (hasName && hasNutrition) { headerIndex = index; headers = candidate; break }
  }
  if (headerIndex < 0) throw new Error('Could not find a food table. Include a name column and at least one nutrition column.')

  const columns = {
    name: findColumn(headers, ['name', 'food', 'food name', 'product', 'product name', 'item', 'description']),
    brand: findColumn(headers, ['brand', 'brand name', 'manufacturer']),
    code: findColumn(headers, ['barcode', 'code', 'ean', 'ean13', 'upc', 'gtin']),
    cat: findColumn(headers, ['category', 'cat', 'type', 'group']),
    kcal: findColumn(headers, ['kcal', 'calories', 'energy', 'energy kcal', 'calories kcal']),
    p: findColumn(headers, ['protein', 'proteins', 'protein g']),
    c: findColumn(headers, ['carbs', 'carbohydrates', 'carbohydrate', 'carbs g']),
    f: findColumn(headers, ['fat', 'total fat', 'fat g']),
    fib: findColumn(headers, ['fiber', 'fibre', 'dietary fiber', 'fiber g']),
    sug: findColumn(headers, ['sugar', 'sugars', 'sugar g']),
    na: findColumn(headers, ['sodium', 'sodium mg', 'salt', 'salt g']),
    serving: findColumn(headers, ['serving', 'serving size', 'serving g', 'serving weight', 'portion']),
    label: findColumn(headers, ['serving label', 'serving name', 'portion label', 'unit']),
    diet: findColumn(headers, ['diet', 'veg', 'vegetarian', 'food type']),
  }

  const foods = []
  let skipped = 0
  for (const row of rows.slice(headerIndex + 1)) {
    const cell = index => index >= 0 ? String(row[index] ?? '').trim() : ''
    const name = cell(columns.name)
    if (!name) { skipped += 1; continue }

    const p = Math.max(0, numberFrom(cell(columns.p)))
    const c = Math.max(0, numberFrom(cell(columns.c)))
    const f = Math.max(0, numberFrom(cell(columns.f)))
    let kcal = Math.max(0, numberFrom(cell(columns.kcal)))
    if (!kcal) kcal = Math.round(p * 4 + c * 4 + f * 9)
    if (!kcal && !p && !c && !f) { skipped += 1; continue }

    const sodiumHeader = columns.na >= 0 ? headers[columns.na] : ''
    let na = Math.max(0, numberFrom(cell(columns.na)))
    if (sodiumHeader.includes('salt')) na = Math.round(na * 400)

    const servingG = Math.max(1, Math.min(2000, numberFrom(cell(columns.serving)) || 100))
    const diet = dietTags(cell(columns.diet))
    foods.push({
      name: name.slice(0, 80),
      brand: cell(columns.brand).slice(0, 40),
      code: normalizeCode(cell(columns.code)),
      cat: cell(columns.cat).slice(0, 40) || cell(columns.brand).slice(0, 40) || 'Imported',
      kcal: Math.min(900, Math.round(kcal)),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      fib: Math.round(Math.max(0, numberFrom(cell(columns.fib))) * 10) / 10,
      sug: Math.round(Math.max(0, numberFrom(cell(columns.sug))) * 10) / 10,
      na: Math.round(na),
      serving: servingG,
      label: cell(columns.label).slice(0, 40) || `${servingG} g`,
      tags: diet.tags,
      dietUnknown: diet.dietUnknown,
    })
  }

  if (!foods.length) throw new Error('No rows with a name and some nutrition were found.')
  return { foods, skipped }
}

/** Merge parsed rows into custom foods. Call inside update(). */
export function applyFoodImport(foods, { customFoods, saveCustomFood }) {
  const summary = { added: 0, updated: 0, barcodes: 0 }
  const stamp = Date.now()
  foods.forEach((food, index) => {
    const existing = food.code
      ? customFoods.find(item => item.code === food.code)
      : customFoods.find(item => item.name.toLowerCase() === food.name.toLowerCase())
    saveCustomFood({
      id: existing?.id || `custom-import-${stamp}-${index}`,
      name: food.name,
      brand: food.brand || existing?.brand || '',
      cat: food.cat,
      tags: food.tags,
      dietUnknown: food.dietUnknown,
      imported: true,
      per: 100,
      kcal: food.kcal,
      p: food.p,
      c: food.c,
      f: food.f,
      fib: food.fib,
      sug: food.sug,
      na: food.na,
      serving: { g: food.serving, label: food.label },
      ...(food.code ? { code: food.code } : {}),
    })
    if (existing) summary.updated += 1
    else summary.added += 1
    if (food.code) summary.barcodes += 1
  })
  return summary
}
