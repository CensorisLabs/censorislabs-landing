import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'

import Ecosystem from './components/Ecosystem'
import Apps, { PRODUCTS } from './components/Apps'
import GamePage from './components/GamePage'
import About from './components/About'
import Donate from './components/Donate'
import Footer from './components/Footer'
import Nav from './components/Nav'
import RequestSoftware from './components/RequestSoftware'
import Reviews from './components/Reviews'
import ReviewModeration from './components/ReviewModeration'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'
import { initReveals, initScrollDrift, initTilt } from './lib/effects'
import { canonicalUrl, humaniseSlug, isPagePath, pathToRoute, routeToPath } from './lib/routes'
import { shareImageAlt, shareImageUrl } from './lib/share'

const Hero = lazy(() => import('./components/Hero'))
const Atlas = lazy(() => import('./components/Atlas'))
const Puffwork = lazy(() => import('./components/Puffwork'))

function routeFromLocation() {
  const fromPath = pathToRoute(window.location.pathname)
  if (fromPath) return fromPath
  // Old links (#/apps/arthasetu) still resolve; the effect below moves them to
  // their real path so there is one address per page.
  return window.location.hash || ''
}

import { DESCRIPTIONS, TITLES } from './data/meta'

function setMeta(selector: string, value: string, attribute = 'content') {
  const node = document.head.querySelector<HTMLMetaElement>(selector)
  if (node) node.setAttribute(attribute, value)
}

export default function App() {
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null)
  const [route, setRoute] = useState(routeFromLocation)

  useEffect(() => {
    const syncRoute = () => {
      const next = routeFromLocation()
      setRoute(next)
      if (next === '' || next.startsWith('#/')) window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  // One address per page: the path is the source of truth, old hash links are
  // moved over, and the canonical plus og:url follow the visitor.
  useEffect(() => {
    const isAnchor = Boolean(route) && !route.startsWith('#/')
    const path = isAnchor || !route ? '/' : routeToPath(route)
    const hash = isAnchor ? route : ''
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'

    if (currentPath !== path || window.location.hash !== hash) {
      window.history.replaceState(null, '', `${path}${hash}`)
    }

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = canonicalUrl(path)
    setMeta('meta[property="og:url"]', canonicalUrl(path))
  }, [route])

  // Internal links stay real anchors so they can be crawled, then take over the
  // click to avoid a full reload for pages this app already has.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href) return

      const onSubpage = window.location.pathname.replace(/\/+$/, '') !== ''
      if (href.startsWith('#')) {
        // A section anchor used from another page belongs to the home page.
        if (onSubpage) {
          event.preventDefault()
          window.history.pushState(null, '', `/${href}`)
          setRoute(href)
        }
        return
      }
      if (!href.startsWith('/') || anchor.host !== window.location.host) return
      const url = new URL(href, window.location.origin)
      if (!isPagePath(url.pathname)) return
      event.preventDefault()
      window.history.pushState(null, '', href)
      setRoute(routeFromLocation())
      window.scrollTo(0, 0)
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const product = route.startsWith('#/apps/')
      ? PRODUCTS.find(item => item.id === route.split('/')[2])
      : undefined
    const title = product
      ? product.name
      : route.startsWith('#/puffwork/bundle/')
        ? `${humaniseSlug(route.slice('#/puffwork/bundle/'.length))} bundle`
        : route.startsWith('#/puffwork/')
          ? humaniseSlug(route.slice('#/puffwork/'.length))
          : TITLES[route]
    document.title = title ? `${title} · CensorisLabs` : 'CensorisLabs — local-first software'

    const description = product
      ? `${product.name} — ${product.kind}. ${product.description}`
      : DESCRIPTIONS[route]
    if (description) {
      setMeta('meta[name="description"]', description)
      setMeta('meta[property="og:description"]', description)
    }
    if (title) {
      setMeta('meta[property="og:title"]', `${title} · CensorisLabs`)
      setMeta('meta[name="twitter:title"]', `${title} · CensorisLabs`)
    }

    // Client-side navigation keeps the URL, title and description in sync, so
    // the share card follows the page too instead of staying on the cover.
    const sharePath = route.startsWith('#/') ? route.slice(1) : '/'
    setMeta('meta[property="og:image"]', shareImageUrl(sharePath))
    setMeta('meta[name="twitter:image"]', shareImageUrl(sharePath))
    setMeta('meta[property="og:image:alt"]', shareImageAlt(sharePath))
  }, [route])

  // A plain anchor such as #ecosystem is followed before React mounts the
  // section when the link is used from a routed page, which leaves the visitor
  // at the top of the document. Re-anchor once the section exists, clearing the
  // fixed navigation bar.
  useEffect(() => {
    if (!route || route.startsWith('#/')) return
    const target = document.getElementById(route.slice(1))
    if (!target) return
    const top = Math.max(target.getBoundingClientRect().top + window.scrollY - 96, 0)
    window.scrollTo({ top, behavior: 'instant' })
  }, [route])

  useLayoutEffect(() => {
    const cleanups = [initReveals(), initTilt(), initScrollDrift()]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [route])

  const isGamePage = route === '#/game'
  const isAtlasPage = route === '#/atlas'
  const isAboutPage = route === '#/about'
  const isReviewsPage = route === '#/reviews'
  const isModerationPage = route === '#/reviews/moderation'
  const isRequestPage = route === '#/request'
  const isDonatePage = route === '#/donate'
  const isAppPage = route === '#/apps' || route.startsWith('#/apps/')
  const appId = isAppPage ? route.split('/')[2] : undefined
  const isPuffworkPage = route === '#/puffwork' || route.startsWith('#/puffwork/')
  const puffworkPath = route.startsWith('#/puffwork/') ? decodeURIComponent(route.slice('#/puffwork/'.length)) : undefined

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {!isGamePage && !isAtlasPage && <Nav />}

      <main id="main">
        {isGamePage ? <GamePage /> : isAtlasPage ? <Suspense fallback={<div className="hero-loading" aria-hidden="true" />}><Atlas /></Suspense> : isAboutPage ? <About /> : isModerationPage ? <ReviewModeration /> : isReviewsPage ? <Reviews /> : isRequestPage ? <RequestSoftware /> : isDonatePage ? <Donate /> : isPuffworkPage ? <div className="puff"><Suspense fallback={<div className="hero-loading" aria-hidden="true" />}><Puffwork path={puffworkPath} /></Suspense></div> : isAppPage ? <Apps appId={appId} asPage={!appId} /> : <>
          <Suspense fallback={<div className="hero-loading" aria-hidden="true" />}>
            <Hero />
          </Suspense>
          <Ecosystem />
          <Apps />
          <TechnicalLedger />
          <Sovereignty />
          <LegalSection onOpen={setLegalDoc} />
        </>}
      </main>

      {!isGamePage && !isAtlasPage && <Footer onOpenLegal={setLegalDoc} />}

      {!isGamePage && !isAtlasPage && <LegalDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />}
      {!isGamePage && !isAtlasPage && <div className="page-frame" aria-hidden="true" />}
      {!isGamePage && !isAtlasPage && <div className="grain" aria-hidden="true" />}
    </>
  )
}
