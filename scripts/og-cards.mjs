/**
 * Share cards for every catalogue page.
 *
 * Each app, Puffwork pack and bundle gets its own 1392×752 JPEG in the same
 * paper-and-ink language as the site, so a link to /apps/arthasetu no longer
 * previews as the generic home cover. The cards are generated once and
 * committed; run this again after changing names, copy or the catalogue:
 *
 *   npm run og:cards
 *
 * Requires the Playwright Chromium installed for the smoke suite.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

import { PRODUCTS } from '../src/data/products.ts'
import { ASSETS, BUNDLES } from '../src/data/puffwork.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const WIDTH = 1392
const HEIGHT = 752

const font = (file) =>
  readFileSync(join(root, 'public/fonts', file)).toString('base64')

const FONTS = `
@font-face { font-family: 'Cinzel'; font-weight: 600; src: url(data:font/woff2;base64,${font('cinzel-latin-600-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Inter'; font-weight: 400; src: url(data:font/woff2;base64,${font('inter-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url(data:font/woff2;base64,${font('jetbrains-mono-latin-400-normal.woff2')}) format('woff2'); }
`

// One line-art mark per Puffwork shape, drawn in ink on paper.
const SHAPES = {
  blob: '<path d="M150 40c46 0 74 28 74 70 0 34-22 52-44 64 30 8 52 30 52 62 0 46-34 74-82 74-44 0-72-24-72-62 0-30 18-50 44-58-26-10-40-30-40-58 0-52 30-92 68-92Z"/>',
  sphere: '<path d="M170 40a110 110 0 1 1 0 220 110 110 0 0 1 0-220Z"/><path d="M96 114c30-26 78-38 128-24M78 216c34 24 86 32 136 14" fill="none" stroke-linecap="round"/>',
  torus: '<path d="M170 52c66 0 120 34 120 76s-54 76-120 76S50 170 50 128s54-76 120-76Zm0 34c-42 0-76 19-76 42s34 42 76 42 76-19 76-42-34-42-76-42Z"/>',
  pill: '<path d="M110 50h120a80 80 0 0 1 0 160H110a80 80 0 0 1 0-160Zm0 34a46 46 0 0 0 0 92h120a46 46 0 0 0 0-92H110Z"/>',
  cloud: '<path d="M104 210a52 52 0 0 1-4-104 68 68 0 0 1 128-18 46 46 0 0 1 22 122Z"/>',
  ribbon: '<path d="M64 74c40-24 90-24 128 0s84 24 116 4M60 148c40-24 90-24 128 0s84 24 116 4M56 220c40-24 90-24 128 0s84 24 116 4" fill="none" stroke-linecap="round"/>',
  knot: '<g transform="rotate(-26 170 150)"><ellipse cx="170" cy="150" rx="60" ry="96"/></g><g transform="rotate(26 170 150)"><ellipse cx="170" cy="150" rx="60" ry="96"/></g>',
  star: '<path d="M170 30l34 92 96 4-74 62 24 96-80-52-80 52 24-96-74-62 96-4Z"/>',
}

const escape = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const clamp = (value, max) => {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 18)).trimEnd()}…`
}

const firstSentence = (value) => {
  const match = value.match(/^.*?[.!?](\s|$)/)
  return (match ? match[0] : value).trim()
}

function page({ eyebrow, title, meta, body, footer, index, mark, stamp }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
body {
  background: #f7f4ee;
  color: #17130f;
  font-family: 'Inter', sans-serif;
  padding: 56px 64px;
  position: relative;
  overflow: hidden;
  background-image:
    repeating-linear-gradient(0deg, rgba(23,19,15,0.045) 0 1px, transparent 1px 44px),
    radial-gradient(120% 100% at 88% 4%, rgba(23,19,15,0.05), transparent 62%);
}
.frame { position: absolute; inset: 26px; border: 2px solid rgba(23,19,15,0.72); }
.frame::after { content: ''; position: absolute; inset: 6px; border: 1px solid rgba(23,19,15,0.22); }
.tick { position: absolute; width: 16px; height: 16px; border: 2px solid #17130f; }
.tick.tl { left: 18px; top: 18px; border-right: 0; border-bottom: 0; }
.tick.tr { right: 18px; top: 18px; border-left: 0; border-bottom: 0; }
.tick.bl { left: 18px; bottom: 18px; border-right: 0; border-top: 0; }
.tick.br { right: 18px; bottom: 18px; border-left: 0; border-top: 0; }
.inner { position: relative; height: 100%; display: flex; gap: 40px; }
.copy { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 19px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(23,19,15,0.72); display: flex; align-items: center; gap: 12px; }
.eyebrow::before { content: ''; width: 10px; height: 10px; background: #17130f; }
.title { font-family: 'Cinzel', serif; font-weight: 600; line-height: 1.02; letter-spacing: -0.01em; margin-top: 26px; }
.rule { width: 96px; height: 3px; background: #17130f; margin: 24px 0 18px; }
.meta { font-family: 'JetBrains Mono', monospace; font-size: 18px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(23,19,15,0.68); }
.body { font-size: 23px; line-height: 1.46; margin-top: 18px; max-width: 760px; color: #2a2520; }
.footer { margin-top: auto; display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding-top: 18px; border-top: 1px solid rgba(23,19,15,0.28); font-family: 'JetBrains Mono', monospace; font-size: 17px; color: rgba(23,19,15,0.66); }
.index { letter-spacing: 0.08em; }
.art { flex: 0 0 330px; display: flex; align-items: center; justify-content: center; position: relative; }
.art > svg { width: 330px; height: 330px; overflow: visible; }
.numeral { position: absolute; right: 6px; top: 24px; font-family: 'Cinzel', serif; font-weight: 600; font-size: 260px; line-height: 1; color: transparent; -webkit-text-stroke: 2px rgba(23,19,15,0.2); }
.stamp { position: absolute; right: 34px; bottom: 42px; transform: rotate(-7deg); border: 2px solid rgba(23,19,15,0.75); padding: 8px 14px; font-family: 'JetBrains Mono', monospace; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(23,19,15,0.78); }
</style></head><body>
<div class="frame"></div>
<div class="tick tl"></div><div class="tick tr"></div><div class="tick bl"></div><div class="tick br"></div>
<div class="inner">
  <div class="copy">
    <div class="eyebrow">${escape(eyebrow)}</div>
    <div class="title" style="font-size:${title.length > 18 ? 78 : title.length > 13 ? 92 : 112}px">${escape(title)}</div>
    <div class="rule"></div>
    <div class="meta">${escape(meta)}</div>
    <div class="body">${escape(body)}</div>
    <div class="footer"><span>${escape(footer)}</span><span class="index">${escape(index)}</span></div>
  </div>
  <div class="art">
    ${mark}
    ${stamp ? `<div class="stamp">${escape(stamp)}</div>` : ''}
  </div>
</div>
</body></html>`
}

const defs = `
<defs>
  <pattern id="hatch" width="9" height="9" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="9" stroke="#17130f" stroke-width="1.1" stroke-opacity="0.34" />
  </pattern>
</defs>`

const shapeMark = (shape) =>
  `<svg viewBox="0 0 340 300" fill="none">${defs}<g fill="url(#hatch)" stroke="#17130f" stroke-width="3" stroke-linejoin="round">${SHAPES[shape] ?? SHAPES.blob}</g></svg>`

const numeralMark = (index) => `<div class="numeral">${index}</div>`

const pad = (value) => String(value).padStart(2, '0')

const cards = []

PRODUCTS.forEach((product, position) => {
  const index = pad(position + 1)
  cards.push({
    file: `public/og/apps/${product.id}.jpg`,
    html: page({
      eyebrow: 'CensorisLabs · app suite',
      title: product.name,
      meta: product.kind,
      body: clamp(firstSentence(product.description), 132),
      footer: `censorislabs.online/apps/${product.id}`,
      index: `${index} / ${pad(PRODUCTS.length)}`,
      mark: `${numeralMark(index)}<span class="stamp">free · no account</span>`,
    }),
  })
})

ASSETS.forEach((asset, position) => {
  const index = pad(position + 1)
  cards.push({
    file: `public/og/puffwork/${asset.slug}.jpg`,
    html: page({
      eyebrow: 'Puffwork · inflatable library',
      title: asset.name,
      meta: `${asset.material} · ${asset.category}`,
      body: clamp(asset.blurb, 138),
      footer: `censorislabs.online/puffwork/${asset.slug}`,
      index: `${index} / ${pad(ASSETS.length)}`,
      mark: shapeMark(asset.shape),
    }),
  })
})

BUNDLES.forEach((bundle, position) => {
  const index = pad(position + 1)
  const lead = ASSETS.find((item) => item.slug === bundle.assetSlugs[0])
  cards.push({
    file: `public/og/puffwork/bundles/${bundle.slug}.jpg`,
    html: page({
      eyebrow: 'Puffwork · bundle',
      title: bundle.name,
      meta: `${bundle.assetSlugs.length} packs · one licence`,
      body: clamp(bundle.blurb, 138),
      footer: `censorislabs.online/puffwork/bundle/${bundle.slug}`,
      index: `${index} / ${pad(BUNDLES.length)}`,
      mark: `${shapeMark(lead?.shape ?? 'blob')}<span class="stamp">${bundle.assetSlugs.length} packs</span>`,
    }),
  })
})

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
const tab = await context.newPage()
for (const card of cards) {
  const target = join(root, card.file)
  mkdirSync(join(target, '..'), { recursive: true })
  await tab.setContent(card.html, { waitUntil: 'load' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: target, type: 'jpeg', quality: 82 })
}
await browser.close()
console.log(`og: ${cards.length} cards`)
