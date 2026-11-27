/**
 * One-off site audit: every prerendered page, desktop and phone widths.
 * Reports console errors, broken images, empty links, duplicate ids,
 * horizontal overflow and internal links that do not resolve.
 *
 *   node scripts/audit-pages.mjs [origin]
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const origin = process.argv[2] || 'http://127.0.0.1:5199'

function pages(dir, base = dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'assets' || entry === 'fonts' || entry === 'og' || entry === 'atlas' || entry === 'games' || entry === 'reading-tracker' || entry === 'era-almanac') continue
    if (statSync(full).isDirectory()) found.push(...pages(full, base))
    else if (entry.endsWith('.html')) {
      const rel = relative(base, full).replace(/\\/g, '/')
      found.push(rel === 'index.html' ? '/' : `/${rel.replace(/\.html$/, '')}`)
    }
  }
  return found
}

const routes = pages(join(root, 'dist')).sort()
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

const findings = []
const internalLinks = new Set()

for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 })
  for (const route of routes) {
    const consoleErrors = []
    const failed = []
    const onConsole = (message) => {
      if (message.type() === 'error' && !/503|404 \(Not Found\)|api\/reviews/.test(message.text())) consoleErrors.push(message.text())
    }
    const onFailed = (request) => {
      const reason = request.failure()?.errorText || ''
      // Requests cancelled by the next navigation belong to the previous route.
      if (reason === 'net::ERR_ABORTED') return
      if (!/api\/reviews|github\.com/.test(request.url())) failed.push(`${request.url()} ${reason}`)
    }
    page.on('console', onConsole)
    page.on('requestfailed', onFailed)
    await page.route('**/api/reviews', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"reviews":[]}' }))
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' }).catch(() => null)
    await page.waitForTimeout(250)

    const report = await page.evaluate(() => {
      const images = [...document.querySelectorAll('img')]
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.getAttribute('src'))
      const noAlt = [...document.querySelectorAll('img:not([alt])')].map((img) => img.getAttribute('src'))
      const emptyLinks = [...document.querySelectorAll('a')]
        .filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#' || a.getAttribute('href') === '')
        .map((a) => a.textContent.trim().slice(0, 40))
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
      const nameless = [...document.querySelectorAll('button, a')]
        .filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim() || el.querySelector('img[alt]')))
        .map((el) => el.outerHTML.slice(0, 80))
      return {
        title: document.title,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        images,
        noAlt,
        emptyLinks,
        duplicateIds: [...new Set(duplicateIds)],
        nameless,
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
      }
    })

    for (const link of report.links) internalLinks.add(link.split('#')[0].split('?')[0])
    const problems = []
    if (!response || response.status() !== 200) problems.push(`status ${response?.status()}`)
    if (report.overflow > 1) problems.push(`overflow ${report.overflow}px`)
    if (report.images.length) problems.push(`broken images: ${report.images.join(', ')}`)
    if (report.noAlt.length) problems.push(`img without alt: ${report.noAlt.join(', ')}`)
    if (report.emptyLinks.length) problems.push(`empty links: ${report.emptyLinks.join(' | ')}`)
    if (report.duplicateIds.length) problems.push(`duplicate ids: ${report.duplicateIds.join(', ')}`)
    if (report.nameless.length) problems.push(`nameless controls: ${report.nameless.join(' | ')}`)
    if (consoleErrors.length) problems.push(`console: ${[...new Set(consoleErrors)].slice(0, 3).join(' | ')}`)
    if (failed.length) problems.push(`failed: ${[...new Set(failed)].slice(0, 3).join(' | ')}`)
    if (problems.length) findings.push({ width, route, problems })
    page.off('console', onConsole)
    page.off('requestfailed', onFailed)
  }
}

const brokenLinks = []
for (const link of [...internalLinks].sort()) {
  if (!link || link === '/') continue
  const res = await context.request.get(`${origin}${link}`).catch(() => null)
  if (!res || res.status() >= 400) brokenLinks.push(`${link} → ${res?.status()}`)
}

await browser.close()

console.log(`audited ${routes.length} routes × 2 widths`)
for (const finding of findings) {
  console.log(`\n[${finding.width}] ${finding.route}`)
  for (const problem of finding.problems) console.log(`  - ${problem}`)
}
if (brokenLinks.length) {
  console.log('\nbroken internal links:')
  for (const link of brokenLinks) console.log(`  - ${link}`)
}
if (!findings.length && !brokenLinks.length) console.log('\nno problems found')
