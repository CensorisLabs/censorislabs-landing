import { buildInsights, INSIGHT_GROUPS } from '../lib/insights.js'
import { getProfile, state, todayKey, addDays } from '../lib/store.js'
import { esc, icon, sectionHeading, emptyState, copyText, toast, downloadFile } from '../lib/ui.js'
import { on, refresh } from '../lib/runtime.js'

let lastRows = []

const toneClass = tone => (tone === 'good' ? 'is-good' : tone === 'amber' ? 'is-amber' : tone === 'bad' ? 'is-bad' : '')

export function renderInsights(root) {
  const profile = getProfile()
  const rows = buildInsights(profile)
  lastRows = rows
  const logged = Object.keys(state.logs[profile.id] || {}).length
  root.innerHTML = `
    ${sectionHeading('INSIGHTS', `${rows.length} things your log is telling you`, `<button type="button" class="kc-btn kc-btn--ghost kc-btn--sm" data-action="insights:copy">${icon('copy')} Copy all</button>`)}
    ${logged < 2
      ? emptyState('sparkles', 'Two logged days unlock these', 'Insights are computed from your own diary, weight log and wellbeing entries. Log a couple of days and come back — nothing is uploaded, ever.', '')
      : INSIGHT_GROUPS.map(group => {
        const list = rows.filter(row => row.group === group)
        if (!list.length) return ''
        return `<section class="kc-insight-group">
          <h3 class="kc-calc__group-title">${group}</h3>
          <div class="kc-insight-grid">${list.map(row => `
            <article class="kc-insight ${toneClass(row.tone)}">
              <p class="kc-insight__title">${esc(row.title)}</p>
              <strong>${esc(row.value)}</strong>
              <p class="kc-insight__note">${esc(row.note)}</p>
            </article>`).join('')}</div>
        </section>`
      }).join('')}
    <p class="kc-calc__intro">Computed locally from the last 30 days. Nothing is sent anywhere, and no numbers are stored.</p>
  `
}

function summaryText() {
  const rows = lastRows.length ? lastRows : buildInsights(getProfile())
  const lines = rows.map(row => `${row.group} · ${row.title}: ${row.value}${row.note ? ` — ${row.note}` : ''}`)
  return [`kcal insights — ${todayKey()}`, ...lines].join('\n')
}

on('insights:copy', () => {
  copyText(summaryText())
  toast('Insights copied')
})

on('insights:export', () => {
  downloadFile(`kcal-insights-${todayKey()}.txt`, summaryText(), 'text/plain')
  toast('Insights saved')
})

on('insights:refresh', () => refresh())

// Keep the export action reachable even when the list is short.
export function insightRangeLabel(days = 30) {
  return `${addDays(todayKey(), -(days - 1))} → ${todayKey()}`
}
