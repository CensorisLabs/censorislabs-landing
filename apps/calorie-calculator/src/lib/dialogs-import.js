import { update } from './store.js'
import { openModal, closeModal, toast, icon, fmt, esc } from './ui.js'
import { refresh } from './runtime.js'
import { applyImport, importSummary, readCsv } from './importer.js'

const SOURCE_LABEL = {
  mfp: 'MyFitnessPal diary',
  apple: 'Apple Health metrics',
}

function previewMarkup(result) {
  const rows = importSummary(result)
  return `<div class="kc-import-preview">
    <p class="kc-eyebrow">DETECTED</p>
    <h3>${esc(SOURCE_LABEL[result.format] || 'CSV file')}</h3>
    <div class="kc-target-list">${rows.map(([label, value]) => `<div><span>${esc(label)}</span><b>${fmt(value)}</b></div>`).join('')}</div>
    ${result.skipped ? `<p class="kc-meta">${icon('info')} ${fmt(result.skipped)} row${result.skipped === 1 ? '' : 's'} skipped (no date, no food name, or no nutrition).</p>` : ''}
    <p class="kc-meta">${icon('info')} Existing entries are kept. Matching entries are skipped, so importing the same file twice is safe.</p>
  </div>`
}

export function openCsvImport() {
  const body = `<div class="kc-import">
    <label class="kc-file-drop" for="csv-file">
      ${icon('upload')}
      <b>Choose a CSV file</b>
      <small>MyFitnessPal diary export, or Apple Health metrics (Health Auto Export style). Parsed on this device.</small>
      <input id="csv-file" type="file" accept=".csv,text/csv" hidden>
    </label>
    <div id="csv-preview"></div>
    <div class="kc-form-actions">
      <button type="button" class="kc-btn kc-btn--ghost" data-close-modal>Cancel</button>
      <button type="button" class="kc-btn" id="csv-import" disabled>${icon('download')} Import</button>
    </div>
    <p class="kc-note">${icon('info')} Apple Health's native export is XML. In Health, use an exporter such as Health Auto Export to produce CSV metrics; nutrition rows become one daily entry named “Apple Health nutrition”.</p>
  </div>`

  openModal({
    title: 'Import from another app',
    eyebrow: 'CSV IMPORT',
    subtitle: 'Bring your diary or health metrics into kcal',
    body,
    onMount(modal) {
      let parsed = null
      let fileName = ''
      const preview = modal.querySelector('#csv-preview')
      const importButton = modal.querySelector('#csv-import')
      const fileInput = modal.querySelector('#csv-file')

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        fileName = file.name
        importButton.disabled = true
        preview.innerHTML = '<p class="kc-meta">Reading file…</p>'
        try {
          const text = await file.text()
          parsed = readCsv(text)
          preview.innerHTML = previewMarkup(parsed)
          importButton.disabled = false
        } catch (error) {
          parsed = null
          preview.innerHTML = `<p class="kc-warning">${icon('info')} ${esc(error.message || 'That file could not be read.')}</p>`
        }
      })

      importButton.addEventListener('click', () => {
        if (!parsed) return
        const result = parsed
        const summary = applyImportInUpdate(result)
        closeModal()
        refresh()
        toast(`Imported ${fmt(summary.entries)} entr${summary.entries === 1 ? 'y' : 'ies'} across ${fmt(summary.days)} day${summary.days === 1 ? '' : 's'}${summary.steps ? ` · ${fmt(summary.steps)} step day${summary.steps === 1 ? '' : 's'}` : ''}`, summary.entries || summary.steps || summary.weights || summary.sleep || summary.water ? 'ok' : 'error')
      })

      function applyImportInUpdate(result) {
        let summary = null
        update(() => { summary = applyImport(result) }, { label: `Import ${fileName || 'CSV'}` })
        return summary || { entries: 0, days: 0 }
      }
    },
  })
}
