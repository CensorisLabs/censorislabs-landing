/**
 * Every page gets its own copy of the built shell with the right <title>,
 * canonical, og:url and description already in the HTML. Crawlers, share-card
 * scrapers and anyone with JavaScript disabled then see the real page identity
 * without waiting for React; the app still hydrates over it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DESCRIPTIONS, TITLES } from '../src/data/meta.ts'
import { PRODUCTS } from '../src/data/products.ts'
import { ASSETS, BUNDLES } from '../src/data/puffwork.ts'
import { SITE_ORIGIN, humaniseSlug } from '../src/lib/routes.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const template = readFileSync(join(root, 'dist/index.html'), 'utf8')

const titleOf = (name) => `${name} · CensorisLabs`

const pages = [
  {
    path: '/',
    title: 'CensorisLabs — Independent Software House',
    description:
      'CensorisLabs builds zero-telemetry, local-first software: a free suite of everyday apps for money, health, reading and more, plus Censoris and Vesper. No accounts, no tracking, no cloud.',
  },
  { path: '/apps', title: titleOf(TITLES['#/apps']), description: DESCRIPTIONS['#/apps'] },
  ...PRODUCTS.map((product) => ({
    path: `/apps/${product.id}`,
    title: titleOf(product.name),
    description: `${product.name} — ${product.kind}. ${product.description}`,
  })),
  { path: '/puffwork', title: titleOf(TITLES['#/puffwork']), description: DESCRIPTIONS['#/puffwork'] },
  ...ASSETS.map((asset) => ({
    path: `/puffwork/${asset.slug}`,
    title: titleOf(asset.name),
    description: `${asset.name} — ${asset.blurb} Part of the Puffwork illustration library from CensorisLabs.`,
  })),
  ...BUNDLES.map((bundle) => ({
    path: `/puffwork/bundle/${bundle.slug}`,
    title: titleOf(`${humaniseSlug(bundle.slug)} bundle`),
    description: `${bundle.name} — ${bundle.blurb} A Puffwork bundle from CensorisLabs.`,
  })),
  { path: '/reviews', title: titleOf(TITLES['#/reviews']), description: DESCRIPTIONS['#/reviews'] },
  { path: '/about', title: titleOf(TITLES['#/about']), description: DESCRIPTIONS['#/about'] },
  { path: '/request', title: titleOf(TITLES['#/request']), description: DESCRIPTIONS['#/request'] },
  { path: '/donate', title: titleOf(TITLES['#/donate']), description: DESCRIPTIONS['#/donate'] },
  { path: '/atlas', title: titleOf(TITLES['#/atlas']), description: DESCRIPTIONS['#/atlas'] },
  { path: '/game', title: titleOf(TITLES['#/game']), description: DESCRIPTIONS['#/game'] },
]

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function setTag(html, matcher, attribute, value) {
  // Tag attributes may be separated by newlines in the built shell.
  const pattern = new RegExp(`<${matcher.trim().replace(/\s+/g, '\\s+')}(?=[\\s/>])[^>]*>`, 's')
  const tag = html.match(pattern)
  if (!tag) return html
  const updated = tag[0].replace(new RegExp(`${attribute}="[^"]*"`), `${attribute}="${escape(value)}"`)
  return html.replace(tag[0], updated)
}

function render(page) {
  const url = `${SITE_ORIGIN}${page.path}`
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
  html = setTag(html, 'link rel="canonical"', 'href', url)
  html = setTag(html, 'meta property="og:url"', 'content', url)
  html = setTag(html, 'meta property="og:title"', 'content', page.title)
  html = setTag(html, 'meta name="twitter:title"', 'content', page.title)
  html = setTag(html, 'meta name="description"', 'content', page.description)
  html = setTag(html, 'meta property="og:description"', 'content', page.description)
  html = setTag(html, 'meta name="twitter:description"', 'content', page.description)
  return html
}

let written = 0
for (const page of pages) {
  if (page.path === '/') {
    writeFileSync(join(root, 'dist/index.html'), render(page))
    written += 1
    continue
  }
  // Written as /apps/arthasetu.html and served by Vercel's cleanUrls at
  // /apps/arthasetu, so the URL has no trailing slash and no redirect.
  const file = join(root, 'dist', `${page.path}.html`)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, render(page))
  written += 1
}

console.log(`prerender: ${written} pages`)
