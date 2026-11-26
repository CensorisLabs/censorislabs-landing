import { expect, test, type Page } from '@playwright/test'

import { PRODUCTS } from '../../src/data/products'
import { ASSETS, BUNDLES } from '../../src/data/puffwork'

/**
 * Every page the site claims to have. Built from the same catalogue data the
 * router and sitemap use, so a new app or pack is covered without editing this
 * file — and a page that stops rendering fails the build.
 */
const ROUTES = [
  '/',
  '/apps',
  '/puffwork',
  '/reviews',
  '/about',
  '/request',
  '/donate',
  '/atlas',
  '/game',
  '/reviews/moderation',
  ...PRODUCTS.map((product) => `/apps/${product.id}`),
  ...ASSETS.map((asset) => `/puffwork/${asset.slug}`),
  ...BUNDLES.map((bundle) => `/puffwork/bundle/${bundle.slug}`),
]

// A page that is still allowed to be quiet; everything else must say something.
const MIN_TEXT = 40

async function openAndAudit(page: Page, path: string) {
  const problems: string[] = []

  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })

  // The reviews API is not part of a static build; answer it so the page can be
  // checked in its normal state instead of its "service offline" state.
  await page.route('**/api/reviews', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [] }) }),
  )

  // Download pages ask GitHub for the latest release. Stub it: an anonymous
  // quota shared by CI runners turns that request into a 403, which is not a
  // fault in the site and would make this suite flaky.
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tag_name: 'smoke', assets: [], body: '', published_at: new Date().toISOString() }),
    }),
  )

  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response?.status(), `HTTP status for ${path}`).toBe(200)

  const main = page.locator('main')
  await expect(main, `main exists on ${path}`).toBeAttached()

  // The game and atlas pages are fixed-position shells, so <main> can report a
  // zero-height box while its content is on screen; text is the honest signal.

  // The About page once threw inside render and React unmounted everything:
  // #root went empty while the HTTP status stayed 200. Text in <main> is the
  // cheapest honest signal that the app actually mounted.
  await expect
    .poll(async () => (await main.innerText()).trim().length, { message: `content on ${path}` })
    .toBeGreaterThan(MIN_TEXT)

  expect(await page.locator('#root > *').count(), `#root has content on ${path}`).toBeGreaterThan(0)

  expect(problems, `console output on ${path}:\n${problems.join('\n')}`).toEqual([])
}

test.describe.configure({ mode: 'parallel' })

for (const route of ROUTES) {
  test(`${route} renders with content and no console errors`, async ({ page }) => {
    await openAndAudit(page, route)
  })
}

test('the About page lists the suite instead of crashing the shell', async ({ page }) => {
  await openAndAudit(page, '/about')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('About me')
  await expect(page.locator('.about-app-card').first()).toBeVisible()
  expect(await page.locator('.about-app-card').count()).toBeGreaterThanOrEqual(10)
  // The navigation is part of the shell; if React unmounts, it disappears too.
  await expect(page.locator('header.nav')).toBeVisible()
})

test('an app page carries its own title and canonical', async ({ page }) => {
  await openAndAudit(page, '/apps/arthasetu')

  await expect(page).toHaveTitle('ArthaSetu · CensorisLabs')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.censorislabs.online/apps/arthasetu',
  )
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ArthaSetu')
})

test('the suite size the copy claims matches the catalogue', async ({ page }) => {
  await openAndAudit(page, '/')
  const ecosystem = await page.locator('#ecosystem').innerText()
  expect(ecosystem).toContain(`${PRODUCTS.length} apps`)

  await openAndAudit(page, '/puffwork')
  const puffwork = await page.locator('main').innerText()
  expect(puffwork).toContain(`${ASSETS.length} packs`)
  expect(puffwork).toContain(`${BUNDLES.length} bundles`)
})

test('old hash links land on the real path', async ({ page }) => {
  await openAndAudit(page, '/#/puffwork/velvet-orb')

  await expect(page).toHaveURL(/\/puffwork\/velvet-orb$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Velvet Orb')
})
