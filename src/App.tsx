import { useState } from 'react'

import Ecosystem from './components/Ecosystem'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Nav from './components/Nav'
import Sovereignty from './components/Sovereignty'
import TechnicalLedger from './components/TechnicalLedger'
import { LegalDialog, LegalSection, type LegalDocId } from './components/Legal'

export default function App() {
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null)

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <Hero />
        <Ecosystem />
        <TechnicalLedger />
        <Sovereignty />
        <LegalSection onOpen={setLegalDoc} />
      </main>

      <Footer onOpenLegal={setLegalDoc} />

      <LegalDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  )
}
