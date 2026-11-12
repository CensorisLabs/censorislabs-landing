import { update, state, saveCustomFood } from './store.js'
import { openModal, closeModal, toast, icon, fmt, esc } from './ui.js'
import { refresh } from './runtime.js'
import { applyFoodImport, readFoodsCsv } from './foods-csv.js'

function preview(result) {
  const foods = result.foods
  const withCodes = foods.filter(food => food.code).length
  const rows = foods.slice(0, 8).map(food => `<div class="kc-import-row">
    <span><b>${esc(food.name)}</b><small>${esc(food.brand || 'No brand')}${food.code ? ` · ${food.code}` : ' · no barcode'}</small></span>
    <span class="kc-import-kcal">${fmt(food.kcal)} kcal</span>
  </div>`).join('')
  return `<div class="kc-import-preview">
    <p class="kc-eyebrow">DETECTED</p>
    <h3>${fmt(foods.length)} food${foods.length === 1 ? '' : 's'}${withCodes ? ` · ${fmt(withCodes)} with a barcode` : ''}</h3>
    <div class="kc-import-rows">${rows}${foods.length > 8 ? `<p class="kc-meta">and ${fmt(foods.length - 8)} more…</p>` : ''}</div>
    ${result.skipped ? `<p class="kc-meta">${icon('info')} ${fmt(result.skipped)} row${result.skipped === 1 ? '' : 's'} skipped (no name or no nutrition).</p>` : ''}
    <p class="kc-meta">${icon('info')} Foods are saved locally and appear in search straight away. A matching barcode or name updates the existing food instead of duplicating it.</p>
  </div>`
}

export function openFoodsCsvImport() {
  const body = `<div class="kc-import">
    <label class="kc-file-drop" for="foods-csv-file">
      ${icon('upload')}
      <b>Choose a foods CSV</b>
      <small>Columns: name, brand, barcode, kcal, protein, carbs, fat, fiber, sugar, sodium, serving — only name plus some nutrition is required.</small>
      <input id="foods-csv-file" type="file" accept=".csv,text/csv" hidden>
    </label>
    <div id="foods-csv-preview"></div>
    <div class="kc-form-actions">
      <button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button>
      <button type="button" class="kc-btn" id="foods-csv-import" disabled>${icon('download')} Import foods</button>
    </div>
    <p class="kc-note">${icon('info')} Barcodes with 8–14 digits are kept. Scans check your imported foods before the bundled brand list.</p>
  </div>`

  openModal({
    title: 'Import foods',
    eyebrow: 'CUSTOM FOODS',
    subtitle: 'Bring a product list with barcodes into your offline database',
    body,
    onMount(modal) {
      let parsed = null
      const previewBox = modal.querySelector('#foods-csv-preview')
      const importButton = modal.querySelector('#foods-csv-import')
      const fileInput = modal.querySelector('#foods-csv-file')

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        importButton.disabled = true
        previewBox.innerHTML = '<p class="kc-meta">Reading file…</p>'
        try {
          parsed = readFoodsCsv(await file.text())
          previewBox.innerHTML = preview(parsed)
          importButton.disabled = false
        } catch (error) {
          parsed = null
          previewBox.innerHTML = `<p class="kc-warning">${icon('info')} ${esc(error.message || 'That file could not be read.')}</p>`
        }
      })

      importButton.addEventListener('click', () => {
        if (!parsed) return
        const result = parsed
        let summary = { added: 0, updated: 0, barcodes: 0 }
        update(() => { summary = applyFoodImport(result.foods, { customFoods: state.customFoods, saveCustomFood }) }, { label: 'Import foods' })
        closeModal()
        refresh()
        toast(`Imported ${fmt(summary.added)} new food${summary.added === 1 ? '' : 's'}${summary.updated ? ` · updated ${fmt(summary.updated)}` : ''}${summary.barcodes ? ` · ${fmt(summary.barcodes)} barcode${summary.barcodes === 1 ? '' : 's'}` : ''}`, 'ok')
      })
    },
  })
}
