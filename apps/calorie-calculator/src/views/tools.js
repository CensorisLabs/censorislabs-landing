import { CALCULATORS, CALCULATOR_GROUPS } from '../data/calculators.js'
import { icon, esc, copyText, toast, sectionHeading } from '../lib/ui.js'
import { on, refresh, ui } from '../lib/runtime.js'

if (!ui.calc) ui.calc = {}
if (typeof ui.calcQuery !== 'string') ui.calcQuery = ''

const valuesFor = calculator => {
  const stored = ui.calc[calculator.id] || {}
  return calculator.fields.reduce((values, field) => {
    values[field.key] = stored[field.key] ?? String(field.value)
    return values
  }, {})
}

function fieldMarkup(calculator, field, value) {
  const id = `calc-${calculator.id}-${field.key}`
  const control = field.type === 'select'
    ? `<select id="${id}" data-calc="${calculator.id}" data-calc-key="${field.key}">${field.options.map(option => `<option value="${esc(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>`
    : `<input id="${id}" data-calc="${calculator.id}" data-calc-key="${field.key}" type="number" inputmode="decimal" step="${field.step ?? 'any'}" value="${esc(value)}" aria-label="${esc(field.label)}">`
  return `<label class="kc-field kc-field--calc" for="${id}"><span>${esc(field.label)}${field.unit ? ` <em>${esc(field.unit)}</em>` : ''}</span>${control}</label>`
}

function cardMarkup(calculator) {
  const values = valuesFor(calculator)
  let result = null
  try {
    result = calculator.compute(values)
  } catch {
    result = null
  }
  const rows = result?.rows?.length
    ? `<dl class="kc-calc__rows">${result.rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`
    : ''
  return `<article class="kc-card kc-calc" data-calc-card="${calculator.id}">
    <div class="kc-card__head"><div><h3>${esc(calculator.title)}</h3><p>${esc(calculator.note)}</p></div>
      <button type="button" class="kc-icon-btn" data-action="calc:copy" data-calc-id="${calculator.id}" aria-label="Copy ${esc(calculator.title)} result" title="Copy result">${icon('copy')}</button>
    </div>
    <div class="kc-calc__fields">${calculator.fields.map(field => fieldMarkup(calculator, field, values[field.key])).join('')}</div>
    <div class="kc-calc__result ${result?.tone ? `is-${result.tone}` : ''}">
      <strong>${esc(result?.headline ?? '—')}</strong>
      ${result?.unit ? `<span class="kc-calc__unit">${esc(result.unit)}</span>` : ''}
      <p>${esc(result?.note ?? '')}</p>
    </div>
    ${rows}
  </article>`
}

export function renderTools(root) {
  const query = ui.calcQuery.trim().toLowerCase()
  const matches = CALCULATORS.filter(calculator => !query || `${calculator.title} ${calculator.note} ${calculator.group}`.toLowerCase().includes(query))
  const groups = CALCULATOR_GROUPS.map(group => ({ group, list: matches.filter(calculator => calculator.group === group) })).filter(entry => entry.list.length)
  root.innerHTML = `
    ${sectionHeading('TOOLS', `${CALCULATORS.length} live calculators`, `<input id="kc-calc-search" class="kc-calc__search" type="search" placeholder="Search tools" value="${esc(ui.calcQuery)}" aria-label="Search calculators">`)}
    <p class="kc-calc__intro">Every tool recalculates as you type. Nothing is uploaded and nothing is saved — close the tab and it is gone.</p>
    ${groups.length ? groups.map(entry => `<section class="kc-calc__group"><h3 class="kc-calc__group-title">${entry.group}</h3><div class="kc-calc__grid">${entry.list.map(cardMarkup).join('')}</div></section>`).join('') : ''}
    <div class="kc-card" id="kc-calc-empty" hidden><p>No tool matches that search.</p></div>
  `
  if (query) applyFilter(ui.calcQuery)
}

/** Filters the rendered cards in place so the search field keeps focus. */
function applyFilter(rawQuery) {
  ui.calcQuery = rawQuery
  const needle = rawQuery.trim().toLowerCase()
  let visible = 0
  document.querySelectorAll('.kc-calc').forEach(card => {
    const calculator = CALCULATORS.find(item => item.id === card.dataset.calcCard)
    const match = !needle || (calculator && `${calculator.title} ${calculator.note} ${calculator.group}`.toLowerCase().includes(needle))
    card.hidden = !match
    if (match) visible += 1
  })
  document.querySelectorAll('.kc-calc__group').forEach(section => {
    section.hidden = !section.querySelector('.kc-calc:not([hidden])')
  })
  const empty = document.getElementById('kc-calc-empty')
  if (empty) empty.hidden = visible > 0
}

document.addEventListener('input', event => {
  if (event.target.id === 'kc-calc-search') {
    applyFilter(event.target.value)
    return
  }
  const field = event.target.closest('[data-calc]')
  if (!field) return
  const id = field.dataset.calc
  ui.calc[id] = { ...(ui.calc[id] || {}), [field.dataset.calcKey]: field.value }
  refresh()
})

document.addEventListener('change', event => {
  const field = event.target.closest('[data-calc]')
  if (!field || field.tagName !== 'SELECT') return
  const id = field.dataset.calc
  ui.calc[id] = { ...(ui.calc[id] || {}), [field.dataset.calcKey]: field.value }
  refresh()
})

on('calc:copy', element => {
  const calculator = CALCULATORS.find(item => item.id === element.dataset.calcId)
  if (!calculator) return
  const result = calculator.compute(valuesFor(calculator))
  if (!result) return
  const rows = (result.rows || []).map(([label, value]) => `${label}: ${value}`).join('\n')
  copyText(`${calculator.title}: ${result.headline}${result.unit ? ` ${result.unit}` : ''}${rows ? `\n${rows}` : ''}`)
  toast('Result copied')
})
