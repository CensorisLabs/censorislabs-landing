import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'

import Ecosystem from './components/Ecosystem'
import Apps from './components/Apps'
import About from './components/About'
import Cursor from './components/Cursor'
import Footer from './components/Footer'
import Nav from './components/Nav'
import Reviews from './components/Reviews'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'
import { initReveals, initScrollDrift, initTilt } from './lib/effects'

const Hero = lazy(() => import('./components/Hero'))

const TITLES: Record<string, string> = {
  '#/about': 'About me',
  '#/apps': 'Apps',
  '#/reviews': 'Reviews & comments',
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

  useLayoutEffect(() => {
    const cleanups = [initReveals(), initTilt(), initScrollDrift()]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [route])

  const isAboutPage = route === '#/about'
  const isReviewsPage = route === '#/reviews'
  const isAppPage = route === '#/apps' || route.startsWith('#/apps/')
  const appId = isAppPage ? route.split('/')[2] : undefined

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Cursor />
      <Nav />

      <main id="main">
        {isAboutPage ? <About /> : isReviewsPage ? <Reviews /> : isAppPage ? <Apps appId={appId} /> : <>
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

      <Footer onOpenLegal={setLegalDoc} />

      <LegalDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />
      <div className="page-frame" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}
