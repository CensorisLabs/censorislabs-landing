import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'

import Ecosystem from './components/Ecosystem'
import Apps from './components/Apps'
import GamePage from './components/GamePage'
import About from './components/About'
import Cursor from './components/Cursor'
import Footer from './components/Footer'
import Nav from './components/Nav'
import RequestSoftware from './components/RequestSoftware'
import Reviews from './components/Reviews'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'
import { initReveals, initScrollDrift, initTilt } from './lib/effects'

const Hero = lazy(() => import('./components/Hero'))

const TITLES: Record<string, string> = {
  '#/game': 'Chronicle Frontier',
  '#/about': 'About me',
  '#/apps': 'Apps',
  '#/reviews': 'Reviews & comments',
  '#/request': 'Request software',
}

export default function App() {
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null)
  const [route, setRoute] = useState(() => window.location.hash)

  useEffect(() => {
    const syncRoute = () => {
      const next = window.location.hash
      setRoute(next)
      if (next === '' || next.startsWith('#/')) window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const title = route.startsWith('#/apps/') ? 'App details' : TITLES[route]
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
  const isAboutPage = route === '#/about'
  const isReviewsPage = route === '#/reviews'
  const isRequestPage = route === '#/request'
  const isAppPage = route === '#/apps' || route.startsWith('#/apps/')
  const appId = isAppPage ? route.split('/')[2] : undefined

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {!isGamePage && <Cursor />}
      {!isGamePage && <Nav />}

      <main id="main">
        {isGamePage ? <GamePage /> : isAboutPage ? <About /> : isReviewsPage ? <Reviews /> : isRequestPage ? <RequestSoftware /> : isAppPage ? <Apps appId={appId} /> : <>
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

      {!isGamePage && <Footer onOpenLegal={setLegalDoc} />}

      {!isGamePage && <LegalDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />}
      {!isGamePage && <div className="page-frame" aria-hidden="true" />}
      {!isGamePage && <div className="grain" aria-hidden="true" />}
    </>
  )
}
