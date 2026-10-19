import { lazy, Suspense, useEffect, useState } from 'react'
import HeroFallback from './HeroFallback'

// Three.js is heavy; load the 3D backdrop after the copy has painted. The SVG
// pillar keeps the hero complete while that chunk arrives (and if it fails).
const Monolith = lazy(() => import('./Monolith'))

export default function Hero() {
  const [lowMode, setLowMode] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.performance === 'low')
  useEffect(() => {
    const observer = new MutationObserver(() => setLowMode(document.documentElement.dataset.performance === 'low'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-performance'] })
    return () => observer.disconnect()
  }, [])

  return (
    <section className="hero section--flush" id="top">
      {lowMode ? <HeroFallback /> : <Suspense fallback={<HeroFallback />}><Monolith /></Suspense>}

      <div className="hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">CensorisLabs · Independent software house</p>

          <h1 className="hero__title">
            Architecting
            <br />
            Digital <em>Sovereignty</em>
          </h1>

          <p className="hero__sub">
            Zero telemetry. Offline-first. Complete technical autonomy under
            unified Greco-Roman software engineering.
          </p>

          <div className="hero__actions">
            <a className="btn btn--primary" href="#ecosystem">
              Explore Censoris
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
            <a
              className="btn btn--outline"
              href="https://github.com/censorislabs"
              target="_blank"
              rel="noreferrer noopener"
            >
              View GitHub Org
            </a>
          </div>

          <dl className="hero__meta">
            <div className="hero__stat">
              <dt>Telemetry</dt>
              <dd>0 beacons</dd>
            </div>
            <div className="hero__stat">
              <dt>Data residency</dt>
              <dd>On device</dd>
            </div>
            <div className="hero__stat">
              <dt>Architecture</dt>
              <dd>Local-first</dd>
            </div>
          </dl>
        </div>

        <div className="hero__spacer" aria-hidden="true" />
      </div>

      <a className="scroll-cue" href="#ecosystem" aria-label="Scroll to ecosystem">
        Scroll
      </a>
    </section>
  )
}
