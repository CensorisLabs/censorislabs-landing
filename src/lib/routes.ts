/**
 * The site's public URLs. Every page has a real path — /apps/arthasetu, not
 * #/apps/arthasetu — so a crawler, a share card and a bookmark all point at
 * one address. The internal route strings keep their old shape so component
 * comparisons stay readable.
 */
export const SITE_ORIGIN = 'https://www.censorislabs.online'

const PAGE_PREFIXES = [
  '/apps',
  '/puffwork',
  '/reviews',
  '/about',
  '/request',
  '/atlas',
  '/game',
  '/donate',
]

export function normalisePath(pathname: string): string {
  let decoded = pathname
  try {
    decoded = decodeURI(pathname)
  } catch {
    decoded = pathname
  }
  const trimmed = decoded.replace(/\/+$/, '')
  return trimmed || '/'
}

export function isPagePath(pathname: string): boolean {
  const path = normalisePath(pathname)
  if (path === '/') return true
  return PAGE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** '/apps/arthasetu' -> '#/apps/arthasetu'; anything unknown -> '' (home). */
export function pathToRoute(pathname: string): string {
  const path = normalisePath(pathname)
  if (path === '/' || !isPagePath(path)) return ''
  return `#${path}`
}

/** '#/apps/arthasetu' -> '/apps/arthasetu'; home -> '/'. */
export function routeToPath(route: string): string {
  if (!route || !route.startsWith('#/')) return '/'
  return route.slice(1)
}

export function canonicalUrl(pathname: string): string {
  return `${SITE_ORIGIN}${normalisePath(pathname)}`
}

/** 'marshmallow-knot' -> 'Marshmallow Knot', for titles that need no data. */
export function humaniseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
