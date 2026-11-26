import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'

import Ecosystem from './components/Ecosystem'
import Apps, { PRODUCTS } from './components/Apps'
import GamePage from './components/GamePage'
import About from './components/About'
import Donate from './components/Donate'
import Cursor from './components/Cursor'
import Footer from './components/Footer'
import Nav from './components/Nav'
import RequestSoftware from './components/RequestSoftware'
import Reviews from './components/Reviews'
import ReviewModeration from './components/ReviewModeration'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'
import { initReveals, initScrollDrift, initTilt } from './lib/effects'

const Hero = lazy(() => import('./components/Hero'))
const Atlas = lazy(() => import('./components/Atlas'))
const Puffwork = lazy(() => import('./components/Puffwork'))

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return window.location.hash || (path === '/donate' ? '#/donate' : '')
}

const TITLES: Record<string, string> = {
  '#/game': 'Chronicle Frontier',
  '#/atlas': 'World Atlas',
  '#/puffwork': 'Puffwork — inflatable 3D illustrations',
  '#/about': 'About me',
  '#/apps': 'Apps',
  '#/reviews': 'Reviews & comments',
  '#/reviews/moderation': 'Review moderation',
  '#/request': 'Request software',
  '#/donate': 'Donate',
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

  // Keep the address bar in step with the page: /donate is a real path so the
  // URL can be shared, but leaving it otherwise strands later routes on it.
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) {
      canonical.href = `https://www.censorislabs.online${path === '/donate' ? '/donate' : '/'}`
    }
    if (route === '#/donate' && path !== '/donate') {
      window.history.replaceState(null, '', '/donate')
    } else if (route !== '#/donate' && path === '/donate') {
      window.history.replaceState(null, '', `/${route}`)
    }
  }, [route])

  useEffect(() => {
    const title = route.startsWith('#/apps/')
      ? (PRODUCTS.find(product => product.id === route.split('/')[2])?.name ?? TITLES['#/apps'])
      : route.startsWith('#/puffwork/')
        ? 'Puffwork pack'
        : TITLES[route]
    document.title = title ? `${title} · CensorisLabs` : 'CensorisLabs — Independent Software House'
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

      {!isGamePage && !isAtlasPage && <Cursor />}
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
