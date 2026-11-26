import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canonicalUrl, humaniseSlug, isPagePath, normalisePath, pathToRoute, routeToPath } from '../src/lib/routes.ts'

test('real paths map to the internal route strings', () => {
  assert.equal(pathToRoute('/apps'), '#/apps')
  assert.equal(pathToRoute('/apps/arthasetu'), '#/apps/arthasetu')
  assert.equal(pathToRoute('/puffwork/marshmallow-knot'), '#/puffwork/marshmallow-knot')
  assert.equal(pathToRoute('/puffwork/bundle/soft-start'), '#/puffwork/bundle/soft-start')
  assert.equal(pathToRoute('/reviews/moderation'), '#/reviews/moderation')
  assert.equal(pathToRoute('/donate'), '#/donate')
  assert.equal(pathToRoute('/'), '')
  assert.equal(pathToRoute('/reading-tracker/'), '')
  assert.equal(pathToRoute('/nonsense'), '')
})

test('routes map back to shareable paths', () => {
  assert.equal(routeToPath('#/apps/arthasetu'), '/apps/arthasetu')
  assert.equal(routeToPath('#/puffwork/jelly-foil'), '/puffwork/jelly-foil')
  assert.equal(routeToPath(''), '/')
  assert.equal(routeToPath('#products'), '/')
})

test('trailing slashes and encodings normalise', () => {
  assert.equal(normalisePath('/apps/'), '/apps')
  assert.equal(normalisePath('/apps///'), '/apps')
  assert.equal(normalisePath(''), '/')
  assert.equal(pathToRoute('/apps/%61rthasetu'), '#/apps/arthasetu')
  assert.equal(normalisePath('/%E0%A4%A'), '/%E0%A4%A')
})

test('only page paths are claimed by the app router', () => {
  for (const path of ['/', '/apps', '/apps/x', '/puffwork/bundle/y', '/reviews', '/about', '/request', '/atlas', '/game', '/donate']) {
    assert.equal(isPagePath(path), true, path)
  }
  for (const path of ['/api/reviews', '/reading-tracker/', '/games/chronicle/', '/robots.txt', '/apps-list']) {
    assert.equal(isPagePath(path), false, path)
  }
})

test('slugs become readable titles', () => {
  assert.equal(humaniseSlug('marshmallow-knot'), 'Marshmallow Knot')
  assert.equal(humaniseSlug('soft-start'), 'Soft Start')
  assert.equal(humaniseSlug(''), '')
})

test('canonical urls never carry a trailing slash or the non-www host', () => {
  assert.equal(canonicalUrl('/'), 'https://www.censorislabs.online/')
  assert.equal(canonicalUrl('/apps/'), 'https://www.censorislabs.online/apps')
  assert.equal(canonicalUrl('/puffwork/velvet-orb'), 'https://www.censorislabs.online/puffwork/velvet-orb')
})
