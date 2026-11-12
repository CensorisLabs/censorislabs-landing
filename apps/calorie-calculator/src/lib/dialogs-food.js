import {
  foodList,
  findFood,
  getProfile,
  update,
  addFood,
  addEntry,
  addRecipe,
  makeQuickEntry,
  makeEntry,
  findEntry,
  removeEntry,
  duplicateEntry,
  rememberSearch,
  toggleFavorite,
  saveCustomFood,
  deleteCustomFood,
  recipeTotals,
  foodAllowed,
  findFoodByCode,
  allergenWarning,
  state,
  uid,
  MEALS,
  relativeDate,
} from './store.js'
import { barcodeDetectorAvailable, startCameraScan, scanImageFile } from './barcode.js'
import {
  nutrientsForFood,
  nutrientScore,
  proteinPerKcal,
  foodDensity,
  MICRO_TARGETS,
  round,
} from './calc.js'
import { openModal, closeModal, toast, esc, fmt, icon, emptyState, confirmDialog } from './ui.js'
import { refresh, ui } from './runtime.js'
import { FILTERS, FOOD_CATEGORIES, ALLERGEN_TAGS } from '../data/foods.js'

const CATEGORY_LOOK = {
  Breakfast: '🥣',
  'Bread & bakery': '🍞',
  'Dairy & eggs': '🥚',
  'Dals & legumes': '🫘',
  'Indian mains': '🍛',
  'Rice & grains': '🍚',
  Protein: '🍗',
  Vegetables: '🥦',
  Fruits: '🍎',
  'Nuts & seeds': '🥜',
  Sweets: '🍮',
  Drinks: '☕',
  'Fast food': '🍔',
  'Oils & sauces': '🫒',
}

function mealForNow() {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snacks'
}

function mealOptions(selected) {
  return MEALS.map(meal => `<option value="${meal.id}" ${meal.id === selected ? 'selected' : ''}>${meal.name}</option>`).join('')
}

function servingKcal(food) {
  return Math.round(food.kcal * (food.serving?.g || 100) / (food.per || 100))
}

function foodRow(food, profile) {
  const warning = allergenWarning(food, profile)
  return `<button type="button" class="kc-food-row" data-food="${esc(food.id)}">
    <span class="kc-food-avatar" aria-hidden="true">${CATEGORY_LOOK[food.cat] || '🍽️'}</span>
    <span class="kc-food-main"><b>${esc(food.name)}</b><small>${food.brand ? `${esc(food.brand)} · ` : ''}${esc(food.serving?.label || '100 g')} · ${fmt(servingKcal(food))} kcal ${food.dietUnknown || (food.tags || []).includes('branded') ? '· check diet ' : ''}${warning ? `· ⚠ ${esc(warning)}` : ''}</small></span>
    <span class="kc-food-macros"><i>P ${fmt(nutrientsForFood(food, food.serving?.g || 100).p)}</i><i>C ${fmt(nutrientsForFood(food, food.serving?.g || 100).c)}</i><i>F ${fmt(nutrientsForFood(food, food.serving?.g || 100).f)}</i></span>
    <span class="kc-food-add">${icon('plus')}</span>
  </button>`
}

function sortFoods(foods, sort) {
  const list = [...foods]
  if (sort === 'protein') list.sort((a, b) => b.p - a.p)
  else if (sort === 'lowcal') list.sort((a, b) => a.kcal - b.kcal)
  else if (sort === 'kcal') list.sort((a, b) => b.kcal - a.kcal)
  else list.sort((a, b) => a.name.localeCompare(b.name))
  return list
}

export function openFoodPicker({ date = ui.date, meal = null, mode = 'log', planDate = null } = {}) {
  const profile = getProfile()
  let query = ''
  let filter = 'all'
  let sort = 'relevance'
  const targetMeal = meal || mealForNow()
  const isPlan = mode === 'plan'
  const body = `<div class="kc-picker">
    <div class="kc-picker__search">
      <label class="kc-search">${icon('search')}<input id="picker-search" type="search" placeholder="Search 160+ foods, dishes or codes" autocomplete="off" data-autofocus aria-label="Search foods"></label>
      <button class="kc-icon-btn" type="button" id="picker-voice" aria-label="Search by voice" title="Search by voice">${icon('mic')}</button>
      <button class="kc-icon-btn" type="button" id="picker-code" aria-label="Look up a barcode" title="Look up a barcode">${icon('barcode')}</button>
    </div>
    <div class="kc-chips kc-chips--scroll" id="picker-filters">
      ${FILTERS.map(item => `<button type="button" class="kc-chip ${item.id === 'all' ? 'is-active' : ''}" data-filter="${item.id}">${esc(item.label)}</button>`).join('')}
    </div>
    <div class="kc-picker__meta"><span id="picker-count">${foodList().length} foods</span><label class="kc-sort">${icon('sort')}<select id="picker-sort" aria-label="Sort foods"><option value="relevance">Suggested</option><option value="protein">Highest protein</option><option value="lowcal">Lowest calories</option><option value="kcal">Highest calories</option></select></label></div>
    <div id="picker-history" class="kc-history"></div>
    <div id="picker-results" class="kc-food-list" aria-live="polite"></div>
  </div>`
  const footer = `<button type="button" class="kc-btn kc-btn--ghost" id="picker-custom">${icon('plus')} Custom food</button><button type="button" class="kc-btn kc-btn--ghost" id="picker-quick">Quick kcal</button>`
  openModal({
    title: isPlan ? 'Add to your plan' : 'Add food',
    eyebrow: isPlan ? `MEAL PLAN · ${relativeDate(planDate || date)}` : relativeDate(date),
    subtitle: isPlan ? 'Build the meal now; log it whenever you are ready.' : 'Search offline. Everything stays on this device.',
    body,
    footer,
    size: 'lg',
    onMount(modal) {
      const input = modal.querySelector('#picker-search')
      const results = modal.querySelector('#picker-results')
      const count = modal.querySelector('#picker-count')
      const history = modal.querySelector('#picker-history')
      const profileNow = getProfile()

      const renderHistory = () => {
        const searches = getProfile().searches || []
        if (!searches.length || query) { history.innerHTML = ''; return }
        history.innerHTML = `<span class="kc-history__label">${icon('clock')} Recent searches</span>${searches.map(item => `<button type="button" class="kc-chip" data-history="${esc(item)}">${esc(item)}</button>`).join('')}`
        history.querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => {
          input.value = button.dataset.history
          query = input.value
          render()
        }))
      }

      const render = () => {
        query = input.value.trim().toLowerCase()
        let pool = foodList().filter(food => foodAllowed(food, profileNow))
        if (filter === 'favorites') {
          pool = profileNow.favorites.map(id => findFood(id)).filter(Boolean).filter(food => foodAllowed(food, profileNow))
        } else if (filter === 'recent') {
          pool = profileNow.recents.map(id => findFood(id)).filter(Boolean).filter(food => foodAllowed(food, profileNow))
        } else if (filter !== 'all') {
          pool = pool.filter(food => food.tags.includes(filter))
        }
        if (query) {
          const tokens = query.split(/\s+/).filter(Boolean)
          pool = pool.filter(food => {
            const haystack = `${food.name} ${food.brand || ''} ${food.cat} ${(food.tags || []).join(' ')} ${food.code || ''}`.toLowerCase()
            return tokens.every(token => haystack.includes(token)) || food.code === query
          })
        }
        pool = sortFoods(pool, sort)
        count.textContent = `${pool.length} food${pool.length === 1 ? '' : 's'}${filter !== 'all' ? ` · ${FILTERS.find(item => item.id === filter)?.label || ''}` : ''}`
        results.innerHTML = pool.length
          ? pool.slice(0, 80).map(food => foodRow(food, profileNow)).join('')
          : emptyState('search', 'No matches', 'Try a simpler name, another filter, or create a custom food.', '<button type="button" class="kc-btn kc-btn--soft" id="empty-custom">Create a custom food</button>')
        if (!pool.length) results.querySelector('#empty-custom')?.addEventListener('click', () => openCustomFood({ date, meal: targetMeal }))
        renderHistory()
      }

      input.addEventListener('input', render)
      modal.querySelector('#picker-sort').addEventListener('change', event => { sort = event.target.value; render() })
      modal.querySelector('#picker-filters').addEventListener('click', event => {
        const button = event.target.closest('[data-filter]')
        if (!button) return
        filter = button.dataset.filter
        modal.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button))
        render()
      })
      results.addEventListener('click', event => {
        const row = event.target.closest('[data-food]')
        if (!row) return
        const food = findFood(row.dataset.food)
        if (!food) return
        if (query) rememberSearch(query)
        if (isPlan) openPlanPortion(food, planDate || date, targetMeal)
        else openPortion(food, { date, meal: targetMeal })
      })
      modal.querySelector('#picker-custom').addEventListener('click', () => openCustomFood({ date, meal: targetMeal }))
      modal.querySelector('#picker-quick').addEventListener('click', () => openQuickAdd({ date, meal: targetMeal }))
      modal.querySelector('#picker-code').addEventListener('click', () => openCodeLookup({ date, meal: targetMeal, mode, planDate }))
      modal.querySelector('#picker-voice').addEventListener('click', () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Recognition) { toast('Voice search is not available on this device.', 'error'); return }
        try {
          const recognition = new Recognition()
          recognition.lang = 'en-IN'
          recognition.interimResults = false
          recognition.maxAlternatives = 1
          recognition.onresult = event => {
            const transcript = event.results[0][0].transcript
            input.value = transcript
            render()
            toast(`Searching for “${transcript}”`)
          }
          recognition.onerror = () => toast('Voice search could not start. Check the microphone permission.', 'error')
          recognition.start()
          toast('Listening…')
        } catch {
          toast('Voice search is not available on this device.', 'error')
        }
      })
      render()
    },
  })
}

export function openCodeLookup({ date = ui.date, meal = null, mode = 'log', planDate = null } = {}) {
  const targetMeal = meal || mealForNow()
  const canScan = barcodeDetectorAvailable()
  const body = `<div class="kc-code">
    <div class="kc-scan">
      <video id="scan-video" playsinline muted aria-label="Camera preview for barcode scanning"></video>
      <div class="kc-scan__idle" id="scan-idle">${icon('barcode')}<b>Scan a barcode</b><small>${canScan ? 'Point the rear camera at the barcode. Decoding happens on this device.' : 'This browser cannot decode barcodes. Type the number below instead.'}</small></div>
      <div class="kc-scan__reticle" id="scan-reticle" hidden><span></span></div>
    </div>
    <div class="kc-scan-actions">
      ${canScan ? `<button type="button" class="kc-btn kc-btn--soft kc-btn--sm" id="scan-start">${icon('barcode')} Start camera</button><label class="kc-btn kc-btn--ghost kc-btn--sm kc-upload-btn">${icon('upload')} Scan a photo<input id="scan-file" type="file" accept="image/*" hidden></label>` : ''}
      <span class="kc-scan-status" id="scan-status" role="status"></span>
    </div>
    <form id="code-form" class="kc-form">
      <label class="kc-field"><span>Barcode number</span><input id="code-input" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 8901058001011"></label>
      <p class="kc-note">${icon('info')} Packaged foods in this database carry a 13-digit demo code. Scanning and lookup work offline; no product service is contacted.</p>
      <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('search')} Find food</button></div>
    </form>
  </div>`
  openModal({
    title: 'Scan or enter a barcode',
    eyebrow: 'ON-DEVICE SCAN',
    subtitle: 'Camera decoding stays on this device.',
    size: 'sm',
    body,
    onMount(modal) {
      const input = modal.querySelector('#code-input')
      const video = modal.querySelector('#scan-video')
      const idle = modal.querySelector('#scan-idle')
      const reticle = modal.querySelector('#scan-reticle')
      const status = modal.querySelector('#scan-status')
      const backdrop = modal.closest('.kc-modal-backdrop')
      let stopCamera = null
      const observer = new MutationObserver(() => {
        if (document.body.contains(backdrop)) return
        observer.disconnect()
        stopCamera?.()
        stopCamera = null
      })
      observer.observe(document.body, { childList: true })

      const finish = value => {
        const clean = String(value || '').replace(/\\s/g, '')
        if (!clean) return
        input.value = clean
        const food = findFoodByCode(clean)
        if (!food) {
          status.textContent = `No match for ${clean}. Add it as a custom food.`
          status.classList.add('is-warn')
          return
        }
        status.classList.remove('is-warn')
        if (mode === 'plan') openPlanPortion(food, planDate || date, targetMeal)
        else openPortion(food, { date, meal: targetMeal })
      }

      modal.querySelector('#code-form').addEventListener('submit', event => {
        event.preventDefault()
        finish(input.value)
      })

      modal.querySelector('#scan-start')?.addEventListener('click', async () => {
        status.classList.remove('is-warn')
        status.textContent = 'Starting camera…'
        try {
          stopCamera = await startCameraScan(video, value => {
            finish(value)
            toast(`Scanned ${value}`)
          })
          idle.hidden = true
          reticle.hidden = false
          status.textContent = 'Scanning… hold the barcode inside the frame.'
        } catch (error) {
          idle.hidden = false
          reticle.hidden = true
          status.classList.add('is-warn')
          status.textContent = error?.message === 'unsupported'
            ? 'Camera scanning is not supported here. Type the number instead.'
            : 'No camera or camera permission refused. Type the number instead.'
        }
      })

      modal.querySelector('#scan-file')?.addEventListener('change', async event => {
        const file = event.target.files?.[0]
        if (!file) return
        status.classList.remove('is-warn')
        status.textContent = 'Reading photo…'
        try {
          const value = await scanImageFile(file)
          if (value) {
            finish(value)
            toast(`Scanned ${value}`)
          } else {
            status.classList.add('is-warn')
            status.textContent = 'No barcode found in that photo.'
          }
        } catch {
          status.classList.add('is-warn')
          status.textContent = 'That photo could not be read.'
        }
      })
    },
  })
}

function microRows(food, grams) {
  const nutrients = nutrientsForFood(food, grams)
  return MICRO_TARGETS.map(micro => {
    const value = nutrients.micros[micro.key] || 0
    return `<div class="kc-micro"><span>${esc(micro.label)}</span><b>${fmt(value, value < 10 ? 1 : 0)} ${micro.unit}</b><i style="width:${Math.min(100, value / micro.target * 100)}%"></i></div>`
  }).join('')
}

export function openPortion(food, { date = ui.date, meal = null, entry = null, grams = null, onDone = null } = {}) {
  const profile = getProfile()
  const editing = Boolean(entry)
  const targetMeal = meal || entry?.meal || mealForNow()
  const isLiquid = food.tags?.includes('drink')
  const presetGrams = Number(grams) > 0 ? Math.round(Number(grams)) : null
  let unit = editing && entry.portionLabel?.includes('×') ? 'serving' : editing ? 'grams' : presetGrams ? 'grams' : 'serving'
  let amount = editing ? (unit === 'serving' ? entry.qty : entry.grams) : presetGrams || 1
  const servingGrams = food.serving?.g || 100
  const gramsFor = (value = amount) => unit === 'serving' ? Math.max(1, Number(value) || 0) * servingGrams : Math.max(1, Number(value) || 0)
  const warning = allergenWarning(food, profile)

  const body = `<div class="kc-portion">
    <div class="kc-portion__hero">
      <div class="kc-portion__badge" aria-hidden="true">${CATEGORY_LOOK[food.cat] || '🍽️'}</div>
      <div class="kc-portion__meta"><span>${esc(food.cat)}</span><b>${fmt(food.kcal)} kcal per 100 ${isLiquid ? 'ml' : 'g'}</b><small>${esc(food.cat)} · score ${nutrientScore(food)}/100 · ${foodDensity(food)}</small></div>
      <button type="button" class="kc-icon-btn" id="portion-fav" aria-pressed="${profile.favorites.includes(food.id)}" aria-label="Favourite ${esc(food.name)}">${icon('star')}</button>
    </div>
    ${warning ? `<p class="kc-warning">${icon('info')} Contains ${esc(warning)} — matches a profile allergen.</p>` : ''}
    <div class="kc-portion__nutrition" id="portion-nutrition"></div>
    <div class="kc-portion__controls">
      <div class="kc-field"><label for="portion-meal">Meal</label><select id="portion-meal">${mealOptions(targetMeal)}</select></div>
      <div class="kc-field"><label for="portion-amount">Amount</label><div class="kc-amount"><input id="portion-amount" type="number" min="0.1" step="0.5" inputmode="decimal" value="${esc(amount)}" data-autofocus><select id="portion-unit" aria-label="Portion unit"><option value="serving" ${unit === 'serving' ? 'selected' : ''}>servings</option><option value="grams" ${unit === 'grams' ? 'selected' : ''}>${isLiquid ? 'ml' : 'g'}</option></select></div></div>
    </div>
    <div class="kc-presets"><span>Quick portion</span><button type="button" data-preset="0.5">½ ×</button><button type="button" data-preset="1">1 ×</button><button type="button" data-preset="1.5">1½ ×</button><button type="button" data-preset="2">2 ×</button><button type="button" data-preset="100">100 ${isLiquid ? 'ml' : 'g'}</button></div>
    <div class="kc-portion__detail"><div><span>Fibre</span><b>${fmt(nutrientsForFood(food, servingGrams).fib, 1)} g</b></div><div><span>Sugar</span><b>${fmt(nutrientsForFood(food, servingGrams).sug, 1)} g</b></div><div><span>Sodium</span><b>${fmt(nutrientsForFood(food, servingGrams).na)} mg</b></div><div><span>Protein / 100 kcal</span><b>${proteinPerKcal(food)} g</b></div></div>
    <div class="kc-micro-grid">${microRows(food, servingGrams)}</div>
    <p class="kc-note">Values are estimates per ${isLiquid ? '100 ml' : '100 g'}. Portion nutrition scales with your amount.</p>
  </div>`

  const footer = `${editing ? `<button type="button" class="kc-btn kc-btn--danger kc-btn--soft" id="portion-delete">${icon('trash')} Delete</button><button type="button" class="kc-btn kc-btn--ghost" id="portion-copy">${icon('copy')} Duplicate</button>` : `<span class="kc-foot-note">${esc(food.serving?.label || '')}</span>`}<button type="button" class="kc-btn" id="portion-save">${icon(editing ? 'check' : 'plus')} ${editing ? 'Save changes' : 'Add to diary'}</button>`

  openModal({
    title: food.name,
    eyebrow: editing ? 'EDIT ENTRY' : 'PORTION',
    subtitle: `${esc(food.serving?.label || '100 g')} · ${fmt(servingKcal(food))} kcal per serving`,
    body,
    footer,
    size: 'md',
    onMount(modal) {
      const amountInput = modal.querySelector('#portion-amount')
      const unitSelect = modal.querySelector('#portion-unit')
      const nutrition = modal.querySelector('#portion-nutrition')
      const updatePreview = () => {
        const grams = gramsFor(amountInput.value)
        const nutrients = nutrientsForFood(food, grams)
        nutrition.innerHTML = `<div class="kc-portion__kcal"><strong>${fmt(nutrients.kcal)}</strong><span>kcal</span></div><div class="kc-portion__macros"><div><span>Protein</span><b>${fmt(nutrients.p, 1)} g</b></div><div><span>Carbs</span><b>${fmt(nutrients.c, 1)} g</b></div><div><span>Fat</span><b>${fmt(nutrients.f, 1)} g</b></div><div><span>Fibre</span><b>${fmt(nutrients.fib, 1)} g</b></div></div><small>${fmt(grams)} ${isLiquid ? 'ml' : 'g'} · ${unit === 'serving' ? `${fmt(Number(amount) || 0, Number(amount) % 1 ? 1 : 0)} serving${Number(amount) === 1 ? '' : 's'}` : 'custom amount'}</small>`
      }
      updatePreview()
      amountInput.addEventListener('input', updatePreview)
      unitSelect.addEventListener('change', () => {
        const grams = gramsFor(amountInput.value)
        unit = unitSelect.value
        amount = unit === 'serving' ? Math.max(0.5, round(grams / servingGrams, 1)) : Math.round(grams)
        amountInput.value = amount
        amountInput.step = unit === 'serving' ? '0.5' : '1'
        updatePreview()
      })
      modal.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
        const preset = Number(button.dataset.preset)
        if (preset === 100) {
          unit = 'grams'
          unitSelect.value = 'grams'
          amount = 100
        } else {
          unit = 'serving'
          unitSelect.value = 'serving'
          amount = preset
        }
        amountInput.value = amount
        amountInput.step = unit === 'serving' ? '0.5' : '1'
        updatePreview()
      }))
      modal.querySelector('#portion-fav').addEventListener('click', event => {
        update(() => toggleFavorite(food.id), { label: 'Favourite food' })
        const active = getProfile().favorites.includes(food.id)
        event.currentTarget.setAttribute('aria-pressed', String(active))
        event.currentTarget.classList.toggle('is-active', active)
        toast(active ? 'Added to favourites' : 'Removed from favourites')
      })

      modal.querySelector('#portion-save').addEventListener('click', () => {
        const amountValue = Math.max(1, Number(amountInput.value) || 0)
        const grams = unit === 'serving' ? round(amountValue * servingGrams, 0) : Math.round(amountValue)
        if (!grams || grams < 1) { toast('Enter a valid portion.', 'error'); return }
        const label = unit === 'serving'
          ? (amountValue === 1 ? (food.serving?.label || `${grams} g`) : `${fmt(amountValue, amountValue % 1 ? 1 : 0)} × ${food.serving?.label || `${servingGrams} g`}`)
          : `${grams} ${isLiquid ? 'ml' : 'g'}`
        const targetMealValue = modal.querySelector('#portion-meal').value
        update(() => {
          if (editing) removeEntry(date, entry.id)
          addFood(date, targetMealValue, food, grams, unit === 'serving' ? amountValue : 1, label)
        }, { label: editing ? 'Edit food entry' : 'Log food' })
        closeModal()
        refresh()
        toast(editing ? 'Entry updated' : `${food.name} added to ${targetMealValue}`, 'ok')
        onDone?.()
      })

      if (editing) {
        modal.querySelector('#portion-delete').addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'Delete entry?', message: `Remove ${entry.name} from ${date}?`, confirmLabel: 'Delete', danger: true })
          if (!ok) return
          update(() => removeEntry(date, entry.id), { label: 'Delete entry' })
          closeModal(); refresh(); toast('Entry deleted')
        })
        modal.querySelector('#portion-copy').addEventListener('click', () => {
          update(() => duplicateEntry(date, entry.id), { label: 'Duplicate entry' })
          closeModal(); refresh(); toast('Entry duplicated')
        })
      }
    },
  })
}

function openPlanPortion(food, date, meal) {
  const isLiquid = food.tags?.includes('drink')
  const servingGrams = food.serving?.g || 100
  openModal({
    title: food.name,
    eyebrow: `PLAN · ${relativeDate(date)}`,
    subtitle: `${esc(food.serving?.label || '100 g')} · ${fmt(servingKcal(food))} kcal`,
    size: 'sm',
    body: `<form id="plan-portion" class="kc-form"><div class="kc-field"><label for="plan-meal">Meal</label><select id="plan-meal">${mealOptions(meal)}</select></div><div class="kc-field"><label for="plan-grams">Amount (${isLiquid ? 'ml' : 'g'})</label><input id="plan-grams" type="number" min="1" step="5" value="${servingGrams}" data-autofocus></div><div class="kc-plan-preview" id="plan-preview"></div><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('calendar')} Add to plan</button></div></form>`,
    onMount(modal) {
      const amount = modal.querySelector('#plan-grams')
      const preview = modal.querySelector('#plan-preview')
      const updatePreview = () => {
        const nutrients = nutrientsForFood(food, Number(amount.value) || 0)
        preview.innerHTML = `<b>${fmt(nutrients.kcal)} kcal</b><span>P ${fmt(nutrients.p, 1)} · C ${fmt(nutrients.c, 1)} · F ${fmt(nutrients.f, 1)}</span>`
      }
      amount.addEventListener('input', updatePreview)
      updatePreview()
      modal.querySelector('#plan-portion').addEventListener('submit', event => {
        event.preventDefault()
        const grams = Math.max(1, Number(amount.value) || servingGrams)
        const selectedMeal = modal.querySelector('#plan-meal').value
        update(() => {
          const profile = getProfile()
          if (!profile.plan[date]) profile.plan[date] = { breakfast: [], lunch: [], dinner: [], snacks: [] }
          const plan = profile.plan[date]
          if (!plan[selectedMeal]) plan[selectedMeal] = []
          plan[selectedMeal] = plan[selectedMeal].filter(item => item.foodId !== food.id)
          plan[selectedMeal].push({ foodId: food.id, grams, qty: 1 })
        }, { label: 'Add to meal plan' })
        closeModal(); refresh(); toast('Added to your meal plan')
      })
    },
  })
}

export function openQuickAdd({ date = ui.date, meal = null, entry = null } = {}) {
  const editing = Boolean(entry)
  const targetMeal = meal || mealForNow()
  const nutrients = entry?.nutrients || {}
  const body = `<form id="quick-form" class="kc-form">
    <div class="kc-field"><label for="quick-name">What did you eat?</label><input id="quick-name" type="text" value="${esc(entry?.name || '')}" placeholder="e.g. Homemade chilla" maxlength="80" data-autofocus required></div>
    <div class="kc-form-grid">
      <div class="kc-field"><label for="quick-kcal">Calories (kcal)</label><input id="quick-kcal" type="number" min="0" step="1" inputmode="numeric" value="${esc(nutrients.kcal ?? '')}" required></div>
      <div class="kc-field"><label for="quick-meal">Meal</label><select id="quick-meal">${mealOptions(entry?.meal || targetMeal)}</select></div>
    </div>
    <div class="kc-form-grid kc-form-grid--4">
      <div class="kc-field"><label for="quick-p">Protein (g)</label><input id="quick-p" type="number" min="0" step="0.1" value="${esc(nutrients.p ?? '')}"></div>
      <div class="kc-field"><label for="quick-c">Carbs (g)</label><input id="quick-c" type="number" min="0" step="0.1" value="${esc(nutrients.c ?? '')}"></div>
      <div class="kc-field"><label for="quick-f">Fat (g)</label><input id="quick-f" type="number" min="0" step="0.1" value="${esc(nutrients.f ?? '')}"></div>
      <div class="kc-field"><label for="quick-fib">Fibre (g)</label><input id="quick-fib" type="number" min="0" step="0.1" value="${esc(nutrients.fib ?? '')}"></div>
    </div>
    <div class="kc-form-grid">
      <div class="kc-field"><label for="quick-sug">Sugar (g)</label><input id="quick-sug" type="number" min="0" step="0.1" value="${esc(nutrients.sug ?? '')}"></div>
      <div class="kc-field"><label for="quick-na">Sodium (mg)</label><input id="quick-na" type="number" min="0" step="1" value="${esc(nutrients.na ?? '')}"></div>
    </div>
    <div class="kc-form-grid">
      <div class="kc-field"><label for="quick-cost">Cost (₹, optional)</label><input id="quick-cost" type="number" min="0" step="1" value="${esc(entry?.cost || '')}"></div>
      <div class="kc-macro-check" id="quick-check"></div>
    </div>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('plus')} ${editing ? 'Save entry' : 'Add to diary'}</button></div>
  </form>`
  openModal({
    title: editing ? 'Edit entry' : 'Quick add',
    eyebrow: editing ? 'EDIT ENTRY' : 'QUICK ADD',
    subtitle: relativeDate(date),
    body,
    size: 'md',
    onMount(modal) {
      const form = modal.querySelector('#quick-form')
      const check = modal.querySelector('#quick-check')
      const updateCheck = () => {
        const kcal = Number(modal.querySelector('#quick-kcal').value) || 0
        const p = Number(modal.querySelector('#quick-p').value) || 0
        const c = Number(modal.querySelector('#quick-c').value) || 0
        const f = Number(modal.querySelector('#quick-f').value) || 0
        const macroKcal = p * 4 + c * 4 + f * 9
        check.innerHTML = `<span>Macros ≈ ${fmt(macroKcal)} kcal</span><small>${Math.abs(macroKcal - kcal) > 80 ? 'A gap of over 80 kcal often means a missing macro.' : 'Close to the calorie value.'}</small>`
      }
      form.querySelectorAll('input').forEach(input => input.addEventListener('input', updateCheck))
      updateCheck()
      form.addEventListener('submit', event => {
        event.preventDefault()
        const name = form.querySelector('#quick-name').value.trim()
        const kcal = Number(form.querySelector('#quick-kcal').value)
        if (!name || !Number.isFinite(kcal) || kcal < 0) { toast('Enter a name and calories.', 'error'); return }
        const selectedMeal = form.querySelector('#quick-meal').value
        const quick = makeQuickEntry({
          name,
          kcal,
          p: Number(form.querySelector('#quick-p').value) || 0,
          c: Number(form.querySelector('#quick-c').value) || 0,
          f: Number(form.querySelector('#quick-f').value) || 0,
          fib: Number(form.querySelector('#quick-fib').value) || 0,
          sug: Number(form.querySelector('#quick-sug').value) || 0,
          na: Number(form.querySelector('#quick-na').value) || 0,
          cost: Number(form.querySelector('#quick-cost').value) || 0,
        })
        update(() => {
          if (editing) removeEntry(date, entry.id)
          addEntry(date, selectedMeal, quick)
        }, { label: editing ? 'Edit quick entry' : 'Quick add' })
        closeModal(); refresh(); toast(editing ? 'Entry updated' : 'Quick entry added')
      })
    },
  })
}

export function openCustomFood({ date = ui.date, meal = null, food = null } = {}) {
  const editing = Boolean(food)
  const tags = new Set(food?.tags || ['v'])
  const micro = food?.micros || {}
  const body = `<form id="custom-food-form" class="kc-form">
    <div class="kc-field"><label for="cf-name">Food name</label><input id="cf-name" type="text" value="${esc(food?.name || '')}" placeholder="e.g. Grandma's rajma" maxlength="80" data-autofocus required></div>
    <div class="kc-form-grid">
      <div class="kc-field"><label for="cf-cat">Category</label><select id="cf-cat">${FOOD_CATEGORIES.map(cat => `<option ${food?.cat === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}</select></div>
      <div class="kc-field"><label for="cf-code">Barcode (optional)</label><input id="cf-code" type="text" inputmode="numeric" value="${esc(food?.code || '')}" placeholder="13 digits"></div>
    </div>
    <div class="kc-form-grid">
      <div class="kc-field"><label for="cf-serving-label">Serving name</label><input id="cf-serving-label" type="text" value="${esc(food?.serving?.label || '1 serving')}" placeholder="e.g. 1 bowl (200 g)"></div>
      <div class="kc-field"><label for="cf-serving-g">Serving weight (g/ml)</label><input id="cf-serving-g" type="number" min="1" step="1" value="${esc(food?.serving?.g || 100)}"></div>
    </div>
    <p class="kc-form-label">Nutrition per 100 g / 100 ml</p>
    <div class="kc-form-grid kc-form-grid--3">
      <div class="kc-field"><label for="cf-kcal">Calories</label><input id="cf-kcal" type="number" min="0" step="1" value="${esc(food?.kcal ?? '')}" required></div>
      <div class="kc-field"><label for="cf-p">Protein (g)</label><input id="cf-p" type="number" min="0" step="0.1" value="${esc(food?.p ?? '')}"></div>
      <div class="kc-field"><label for="cf-c">Carbs (g)</label><input id="cf-c" type="number" min="0" step="0.1" value="${esc(food?.c ?? '')}"></div>
      <div class="kc-field"><label for="cf-f">Fat (g)</label><input id="cf-f" type="number" min="0" step="0.1" value="${esc(food?.f ?? '')}"></div>
      <div class="kc-field"><label for="cf-fib">Fibre (g)</label><input id="cf-fib" type="number" min="0" step="0.1" value="${esc(food?.fib ?? '')}"></div>
      <div class="kc-field"><label for="cf-sug">Sugar (g)</label><input id="cf-sug" type="number" min="0" step="0.1" value="${esc(food?.sug ?? '')}"></div>
      <div class="kc-field"><label for="cf-na">Sodium (mg)</label><input id="cf-na" type="number" min="0" step="1" value="${esc(food?.na ?? '')}"></div>
      <div class="kc-field"><label for="cf-cost">Cost / 100 g (₹)</label><input id="cf-cost" type="number" min="0" step="0.5" value="${esc(food?.cost ?? '')}"></div>
    </div>
    <p class="kc-form-label">Diet tags</p>
    <div class="kc-check-grid">${[['v', 'Vegetarian'], ['vg', 'Vegan'], ['hp', 'High protein'], ['lc', 'Low calorie'], ['gf', 'Gluten free'], ['in', 'Indian'], ['q', 'Quick']].map(([id, label]) => `<label class="kc-check"><input type="checkbox" value="${id}" ${tags.has(id) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
    <details class="kc-details"><summary>Micronutrients (optional, per 100 g)</summary><div class="kc-form-grid kc-form-grid--3">${MICRO_TARGETS.map(item => `<div class="kc-field"><label for="cf-m-${item.key}">${item.label} (${item.unit})</label><input id="cf-m-${item.key}" type="number" min="0" step="0.1" value="${esc(micro[item.key] ?? '')}"></div>`).join('')}</div></details>
    <div class="kc-form-actions">${editing ? '<button type="button" class="kc-btn kc-btn--danger kc-btn--soft" id="cf-delete">Delete food</button>' : ''}<button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} ${editing ? 'Save food' : 'Create food'}</button></div>
  </form>`

  openModal({
    title: editing ? 'Edit custom food' : 'Create a food',
    eyebrow: 'YOUR FOOD DATABASE',
    subtitle: 'Saved locally. It appears in search straight away.',
    body,
    size: 'lg',
    onMount(modal) {
      const form = modal.querySelector('#custom-food-form')
      form.addEventListener('submit', event => {
        event.preventDefault()
        const name = form.querySelector('#cf-name').value.trim()
        const kcal = Number(form.querySelector('#cf-kcal').value)
        if (!name || !Number.isFinite(kcal)) { toast('Add a name and calories.', 'error'); return }
        const selectedTags = [...form.querySelectorAll('.kc-check input:checked')].map(input => input.value)
        if (!selectedTags.length) selectedTags.push('v')
        const customFood = {
          id: food?.id || `custom-${uid('food')}`,
          name,
          cat: form.querySelector('#cf-cat').value,
          tags: selectedTags,
          per: 100,
          kcal: Math.max(0, kcal),
          p: Math.max(0, Number(form.querySelector('#cf-p').value) || 0),
          c: Math.max(0, Number(form.querySelector('#cf-c').value) || 0),
          f: Math.max(0, Number(form.querySelector('#cf-f').value) || 0),
          fib: Math.max(0, Number(form.querySelector('#cf-fib').value) || 0),
          sug: Math.max(0, Number(form.querySelector('#cf-sug').value) || 0),
          na: Math.max(0, Number(form.querySelector('#cf-na').value) || 0),
          serving: { label: form.querySelector('#cf-serving-label').value.trim() || '1 serving', g: Math.max(1, Number(form.querySelector('#cf-serving-g').value) || 100) },
          micros: Object.fromEntries(MICRO_TARGETS.map(item => [item.key, Math.max(0, Number(form.querySelector(`#cf-m-${item.key}`).value) || 0)])),
          cost: Math.max(0, Number(form.querySelector('#cf-cost').value) || 0),
          code: form.querySelector('#cf-code').value.trim() || undefined,
          custom: true,
        }
        if (editing && customFood.code === '') delete customFood.code
        update(() => saveCustomFood(customFood), { label: editing ? 'Edit custom food' : 'Create custom food' })
        closeModal(); refresh(); toast(editing ? 'Custom food updated' : 'Custom food created')
        openPortion(customFood, { date, meal: meal || mealForNow() })
      })
      modal.querySelector('#cf-delete')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Delete custom food?', message: 'Past diary entries keep their recorded nutrition. This food will disappear from search.', confirmLabel: 'Delete', danger: true })
        if (!ok) return
        update(() => deleteCustomFood(food.id), { label: 'Delete custom food' })
        closeModal(); refresh(); toast('Custom food deleted')
      })
    },
  })
}

export function openRecipeLog(recipe, { date = ui.date, meal = null } = {}) {
  const totals = recipeTotals(recipe)
  openModal({
    title: recipe.name,
    eyebrow: 'LOG A RECIPE',
    subtitle: `${totals.perServing.kcal} kcal per serving · ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} total`,
    size: 'sm',
    body: `<form id="recipe-log" class="kc-form"><div class="kc-form-grid"><div class="kc-field"><label for="rl-meal">Meal</label><select id="rl-meal">${mealOptions(meal || mealForNow())}</select></div><div class="kc-field"><label for="rl-servings">Servings</label><input id="rl-servings" type="number" min="0.5" step="0.5" value="1" data-autofocus></div></div><div class="kc-plan-preview" id="rl-preview"></div><div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('plus')} Add to diary</button></div></form>`,
    onMount(modal) {
      const servings = modal.querySelector('#rl-servings')
      const preview = modal.querySelector('#rl-preview')
      const updatePreview = () => {
        const value = Number(servings.value) || 1
        preview.innerHTML = `<b>${fmt(totals.perServing.kcal * value)} kcal</b><span>P ${fmt(totals.perServing.p * value, 1)} · C ${fmt(totals.perServing.c * value, 1)} · F ${fmt(totals.perServing.f * value, 1)}</span>`
      }
      servings.addEventListener('input', updatePreview)
      updatePreview()
      modal.querySelector('#recipe-log').addEventListener('submit', event => {
        event.preventDefault()
        const value = Math.max(0.5, Number(servings.value) || 1)
        const selectedMeal = modal.querySelector('#rl-meal').value
        update(() => addRecipe(date, selectedMeal, recipe, value), { label: 'Log recipe' })
        closeModal(); refresh(); toast(`${recipe.name} added`)
      })
    },
  })
}

export function openRecipeBuilder(recipe = null) {
  const editing = Boolean(recipe)
  let items = recipe ? recipe.items.map(item => ({ ...item })) : []
  let name = recipe?.name || ''
  let servings = recipe?.servings || 2
  let minutes = recipe?.minutes || 15
  let steps = recipe?.steps?.join('\n') || ''
  const body = `<form id="recipe-form" class="kc-form">
    <div class="kc-form-grid"><div class="kc-field"><label for="recipe-name">Recipe name</label><input id="recipe-name" type="text" value="${esc(name)}" placeholder="e.g. Sunday chicken bowl" maxlength="80" data-autofocus required></div><div class="kc-field"><label for="recipe-servings">Servings</label><input id="recipe-servings" type="number" min="1" max="20" step="1" value="${servings}"></div></div>
    <div class="kc-form-grid"><div class="kc-field"><label for="recipe-minutes">Minutes</label><input id="recipe-minutes" type="number" min="1" max="300" step="1" value="${minutes}"></div><div class="kc-field"><label for="recipe-tag">Style</label><select id="recipe-tag"><option value="balanced">Balanced</option><option value="high protein">High protein</option><option value="vegetarian">Vegetarian</option><option value="quick">Quick</option></select></div></div>
    <p class="kc-form-label">Ingredients</p>
    <div class="kc-ingredient-add"><select id="recipe-food" aria-label="Ingredient">${FOOD_CATEGORIES.map(cat => `<optgroup label="${esc(cat)}">${foodList().filter(food => food.cat === cat).map(food => `<option value="${food.id}">${esc(food.name)}</option>`).join('')}</optgroup>`).join('')}</select><input id="recipe-grams" type="number" min="1" step="5" value="100" aria-label="Ingredient grams"><button type="button" class="kc-btn kc-btn--soft" id="recipe-add">${icon('plus')} Add</button></div>
    <div id="recipe-items" class="kc-recipe-items"></div>
    <div id="recipe-totals" class="kc-recipe-totals"></div>
    <div class="kc-field"><label for="recipe-steps">Method (one step per line)</label><textarea id="recipe-steps" rows="3" placeholder="Mix, cook, serve…">${esc(steps)}</textarea></div>
    <div class="kc-form-actions"><button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button><button class="kc-btn" type="submit">${icon('check')} ${editing ? 'Save recipe' : 'Create recipe'}</button></div>
  </form>`

  openModal({
    title: editing ? 'Edit recipe' : 'Recipe builder',
    eyebrow: 'YOUR KITCHEN',
    subtitle: 'Combine foods once, then log a serving in one tap.',
    body,
    size: 'lg',
    onMount(modal) {
      const nameInput = modal.querySelector('#recipe-name')
      const servingsInput = modal.querySelector('#recipe-servings')
      const itemsRoot = modal.querySelector('#recipe-items')
      const totalsRoot = modal.querySelector('#recipe-totals')
      const foodSelect = modal.querySelector('#recipe-food')
      const gramsInput = modal.querySelector('#recipe-grams')

      const render = () => {
        itemsRoot.innerHTML = items.length ? items.map((item, index) => {
          const food = findFood(item.foodId)
          if (!food) return ''
          const nutrients = nutrientsForFood(food, item.g)
          return `<div class="kc-recipe-item"><span>${esc(food.name)}</span><input type="number" min="1" step="5" value="${item.g}" data-index="${index}" aria-label="${esc(food.name)} grams"><small>${fmt(nutrients.kcal)} kcal</small><button type="button" data-remove="${index}" aria-label="Remove ${esc(food.name)}">${icon('close')}</button></div>`
        }).join('') : '<p class="kc-note">Add at least one ingredient.</p>'
        itemsRoot.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { items.splice(Number(button.dataset.remove), 1); render() }))
        itemsRoot.querySelectorAll('input[data-index]').forEach(input => input.addEventListener('change', () => { items[Number(input.dataset.index)].g = Math.max(1, Number(input.value) || 1); render() }))
        const totals = { kcal: 0, p: 0, c: 0, f: 0, grams: 0 }
        for (const item of items) {
          const food = findFood(item.foodId)
          if (!food) continue
          const nutrients = nutrientsForFood(food, item.g)
          totals.kcal += nutrients.kcal; totals.p += nutrients.p; totals.c += nutrients.c; totals.f += nutrients.f; totals.grams += item.g
        }
        const count = Math.max(1, Number(servingsInput.value) || 1)
        totalsRoot.innerHTML = `<div><span>Whole recipe</span><b>${fmt(totals.kcal)} kcal</b><small>${fmt(totals.grams)} g</small></div><div><span>Per serving</span><b>${fmt(totals.kcal / count)} kcal</b><small>P ${fmt(totals.p / count, 1)} · C ${fmt(totals.c / count, 1)} · F ${fmt(totals.f / count, 1)}</small></div>`
      }

      modal.querySelector('#recipe-add').addEventListener('click', () => {
        const food = findFood(foodSelect.value)
        const grams = Math.max(1, Number(gramsInput.value) || 100)
        if (!food) return
        const existing = items.findIndex(item => item.foodId === food.id)
        if (existing >= 0) items[existing].g += grams
        else items.push({ foodId: food.id, g: grams })
        render()
      })
      servingsInput.addEventListener('input', render)
      render()

      modal.querySelector('#recipe-form').addEventListener('submit', event => {
        event.preventDefault()
        if (!nameInput.value.trim()) { toast('Name your recipe.', 'error'); return }
        if (!items.length) { toast('Add at least one ingredient.', 'error'); return }
        const recipeData = {
          id: recipe?.id || `recipe-${uid('r')}`,
          name: nameInput.value.trim(),
          servings: Math.max(1, Number(servingsInput.value) || 1),
          minutes: Math.max(1, Number(modal.querySelector('#recipe-minutes').value) || 15),
          tags: [modal.querySelector('#recipe-tag').value],
          items: items.map(item => ({ ...item })),
          steps: modal.querySelector('#recipe-steps').value.split('\n').map(step => step.trim()).filter(Boolean),
          custom: true,
        }
        update(() => saveRecipe(recipeData), { label: editing ? 'Edit recipe' : 'Create recipe' })
        closeModal(); refresh(); toast(editing ? 'Recipe updated' : 'Recipe created')
      })
    },
  })
}
