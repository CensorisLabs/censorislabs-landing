import { lazy, Suspense, useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'

import Ecosystem from './components/Ecosystem'
import Apps from './components/Apps'
import About from './components/About'
import Footer from './components/Footer'
import Nav from './components/Nav'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'

const Hero = lazy(() => import('./components/Hero'))

export default function App() {
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null)
  const [route, setRoute] = useState(() => window.location.hash)

  useEffect(() => {
    const syncRoute = () => { setRoute(window.location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const pageTitle = route === '#/about' ? 'About me' : route.startsWith('#/apps/') ? 'App details' : route === '#/apps' ? 'Apps' : null
    document.title = pageTitle ? `${pageTitle} · CensorisLabs` : 'CensorisLabs — Independent Software House'
  }, [route])

  const isAboutPage = route === '#/about'
  const isAppPage = route === '#/apps' || route.startsWith('#/apps/')
  const appId = isAppPage ? route.split('/')[2] : undefined

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Nav />

      <main id="main">
        {isAboutPage ? <About /> : isAppPage ? <Apps appId={appId} /> : <>
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

      <Analytics />
    </>
  )
}
