import { todayKey, addDays } from './store.js'

export const ui = {
  view: 'today',
  date: todayKey(),
  search: '',
  filter: 'all',
  sort: 'relevance',
  progressTab: 'weight',
  progressRange: 7,
  planOffset: 0,
  calendarOffset: 0,
  moreTab: null,
  studioTab: 'kitchen',
  compareA: 'chicken-breast',
  compareB: 'paneer',
  recipeCheck: '',
  restaurant: null,
  fingerprint: '',
  searchQuery: '',
  pickerMeal: 'breakfast',
}

let renderer = () => {}
const actions = new Map()
const forms = new Map()

export function bindRenderer(fn) {
  renderer = fn
}

export function on(name, handler) {
  actions.set(name, handler)
}

export function onForm(name, handler) {
  forms.set(name, handler)
}

export function handleAction(name, element, event) {
  const handler = actions.get(name)
  if (!handler) return false
  handler(element, event)
  return true
}

export function handleForm(name, form, event) {
  const handler = forms.get(name)
  if (!handler) return false
  handler(form, event)
  return true
}

export function refresh() {
  renderer()
}

export function go(view) {
  ui.view = view
  renderer()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function setDate(key) {
  ui.date = key
  renderer()
}

export function stepDate(days) {
  setDate(addDays(ui.date, days))
}

export function goToday() {
  setDate(todayKey())
}

export function goProgress(tab = 'weight') {
  ui.progressTab = tab
  go('progress')
}
