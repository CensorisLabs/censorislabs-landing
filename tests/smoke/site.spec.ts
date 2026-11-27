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

test('downloads come from the site snapshot, not the visitor\'s GitHub quota', async ({ page, request }) => {
  const snapshot = await request.get('/releases.json')
  expect(snapshot.status(), 'release snapshot is served').toBe(200)
  const data = await snapshot.json()
  expect(Array.isArray(data.assets), 'snapshot has an assets array').toBe(true)
  expect(data.assets.length, 'snapshot lists installers').toBeGreaterThan(0)

  // If anything still reached GitHub from the browser, this counter would move.
  let githubLookups = 0
  await page.route('https://api.github.com/**', (route) => {
    githubLookups += 1
    return route.abort()
  })

  await openAndAudit(page, '/apps/arthasetu')
  const links = page.locator('.suite-downloads a')
  await expect(links.first(), 'a download link is rendered').toBeVisible()
  await expect(links.first()).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/CensorisLabs\/censorislabs-landing\/releases\/download\//,
  )
  expect(githubLookups, 'no GitHub API calls from the browser').toBe(0)
})

test('every catalogue page points at its own share card', async ({ page, request }) => {
  const cards = [
    ['/apps/arthasetu', '/og/apps/arthasetu.jpg'],
    ['/puffwork/velvet-orb', '/og/puffwork/velvet-orb.jpg'],
    ['/puffwork/bundle/soft-start', '/og/puffwork/bundles/soft-start.jpg'],
  ]

  for (const [path, image] of cards) {
    const html = await (await request.get(path)).text()
    expect(html, `prerendered og:image on ${path}`).toContain(
      `content="https://www.censorislabs.online${image}"`,
    )
    const card = await request.get(image)
    expect(card.status(), `status for ${image}`).toBe(200)
    expect(card.headers()['content-type'], `type for ${image}`).toContain('image/jpeg')
  }

  const home = await (await request.get('/')).text()
  expect(home).toContain('/og-cover.jpg')

  // The running app swaps the card on client-side navigation, not just the
  // prerendered HTML a crawler reads.
  await page.goto('/')
  await page.locator('a[href="/apps/arthasetu"]').first().click()
  await expect(page).toHaveURL(/\/apps\/arthasetu$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://www.censorislabs.online/og/apps/arthasetu.jpg',
  )
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

test('a shared atlas link restores its year, place and zoom', async ({ page }) => {
  // The globe loads compressed map data and renders a 3D scene; it is the
  // slowest page in the suite and needs more than the default budget.
  test.setTimeout(60_000)
  await openAndAudit(page, '/atlas?year=1500&lat=30.4&lon=12.6&z=3.4')

  await expect(page.locator('.atlas-timeline-head strong'), 'the shared year is restored').toContainText('1,500 AD')
  const panel = page.locator('.atlas-panel--right')
  await expect(panel, 'the shared place opens its details').toContainText('PLACE SELECTED')
  await expect(panel, 'the shared coordinates are shown').toContainText('30.4°')
  await expect(page, 'the address bar keeps the shared view').toHaveURL(/year=1500/)
})

test('the atlas lists the journeys that cross the chosen year', async ({ page }) => {
  // The globe loads compressed map data and renders a 3D scene; it is the
  // slowest page in the suite and needs more than the default budget.
  test.setTimeout(60_000)
  await openAndAudit(page, '/atlas?year=1500&lat=30.4&lon=12.6')

  const list = page.locator('.atlas-journey-list')
  await expect(list.locator('button', { hasText: 'Hajj road from Cairo' })).toHaveCount(1)
  // The Manila galleon only starts in 1565, so it must not appear for 1500.
  await expect(list).not.toContainText('Manila galleon')

  await list.locator('button').first().click()
  await expect(page.locator('.atlas-journey-card'), 'selecting a journey explains it').not.toBeEmpty()
})

test('a shared atlas link restores its journey', async ({ page }) => {
  test.setTimeout(60_000)
  await openAndAudit(page, '/atlas?year=1600&journey=manila-galleon')

  const card = page.locator('.atlas-journey-card')
  await expect(card, 'the shared route is selected').toContainText('Manila galleon')
  await expect(card, 'its endpoints are shown').toContainText('Acapulco → Manila')

  await page.getByRole('button', { name: 'Next journey' }).click()
  await expect(card, 'stepping moves to the next route').not.toContainText('Manila galleon')
  await expect(page, 'the address bar follows the selected route').toHaveURL(/journey=/)
})

test('the atlas shows an almanac fact for the era on screen', async ({ page }) => {
  // The globe loads compressed map data and renders a 3D scene; it is the
  // slowest page in the suite and needs more than the default budget.
  test.setTimeout(60_000)
  await openAndAudit(page, '/atlas')

  const tag = page.locator('.atlas-almanac__tag')
  const fact = page.locator('.atlas-almanac p')
  // The atlas opens at 801 AD, which is the medieval era.
  await expect(tag, 'the opening year sits in the medieval era').toContainText('MEDIEVAL')
  await expect(fact, 'a fact is shown with the era label').not.toBeEmpty()

  const firstFact = await fact.innerText()
  await page.locator('.atlas-almanac button').click()
  await expect(fact, 'another fact from the same era').not.toHaveText(firstFact)
  await expect(tag, 'cycling facts keeps the era').toContainText('MEDIEVAL')
})
