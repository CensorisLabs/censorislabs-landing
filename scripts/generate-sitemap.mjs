import { writeFileSync } from 'node:fs'

import { PRODUCTS } from '../src/data/products.ts'
import { ASSETS, BUNDLES } from '../src/data/puffwork.ts'

const ORIGIN = 'https://www.censorislabs.online'
const today = new Date().toISOString().slice(0, 10)

const pages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/apps', priority: '0.9', changefreq: 'weekly' },
  ...PRODUCTS.map((product) => ({ path: `/apps/${product.id}`, priority: '0.8', changefreq: 'monthly' })),
  { path: '/puffwork', priority: '0.8', changefreq: 'weekly' },
  ...ASSETS.map((asset) => ({ path: `/puffwork/${asset.slug}`, priority: '0.6', changefreq: 'monthly' })),
  ...BUNDLES.map((bundle) => ({ path: `/puffwork/bundle/${bundle.slug}`, priority: '0.6', changefreq: 'monthly' })),
  { path: '/reviews', priority: '0.6', changefreq: 'weekly' },
  { path: '/about', priority: '0.6', changefreq: 'yearly' },
  { path: '/request', priority: '0.5', changefreq: 'yearly' },
  { path: '/donate', priority: '0.5', changefreq: 'monthly' },
  { path: '/atlas', priority: '0.5', changefreq: 'monthly' },
  { path: '/game', priority: '0.5', changefreq: 'monthly' },
]

const seen = new Set()
const entries = pages
  .filter((page) => (seen.has(page.path) ? false : seen.add(page.path)))
  .map(
    (page) =>
      `  <url>\n    <loc>${ORIGIN}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
  )
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), sitemap)
console.log(`sitemap: ${pages.length} urls`)
