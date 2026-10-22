import { lazy, Suspense, useEffect, useState } from 'react'
import HeroFallback from './HeroFallback'

const HeroScene = lazy(() => import('./HeroScene'))

const KEYCARDS = [
  { name: 'ArthaSetu', kind: 'FINANCE', tone: 'rose' },
  { name: 'Nur', kind: 'DAILY', tone: 'teal' },
  { name: 'Picker', kind: 'HARDWARE', tone: 'blue' },
  { name: 'Arcade', kind: 'GAMES', tone: 'violet' },
  { name: 'Watch', kind: 'FILM', tone: 'amber' },
]

const SCREEN_LINES = [
  'ArthaSetu — private ledger',
  'Nur Companion — daily',
  'PC Part Picker — builds',
  'Offline Arcade — games',
]

const CITY = [
  [8, 96, 44, 164],
  [58, 60, 38, 200],
  [102, 128, 30, 132],
  [138, 82, 46, 178],
  [190, 40, 34, 220],
  [230, 100, 42, 160],
  [278, 66, 38, 194],
  [322, 118, 30, 142],
  [358, 88, 40, 172],
]

export default function Hero() {
  const [lowMode, setLowMode] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.performance === 'low',
  )

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setLowMode(document.documentElement.dataset.performance === 'low'),
    )
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-performance'] })
    return () => observer.disconnect()
  }, [])

  return (
    <section className="hero section--flush" id="top">
      <div className="hero__stage">
        <div className="room" aria-hidden="true">
          <div className="room__wall" />
          <div className="room__seam room__seam--v" />
          <div className="room__seam room__seam--h" />

          <div className="room__window">
            <div className="window__sky" />
            <svg className="window__city" viewBox="0 0 406 260" preserveAspectRatio="xMidYMax slice">
              <defs>
                <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a3059" />
                  <stop offset="100%" stopColor="#22162e" />
                </linearGradient>
                <pattern id="lit" width="9" height="13" patternUnits="userSpaceOnUse">
                  <rect width="3.4" height="4.6" x="1.6" y="2.4" fill="#ffd8a8" opacity="0.75" />
                  <rect width="3.4" height="4.6" x="5.4" y="7.6" fill="#ffb3c7" opacity="0.45" />
                </pattern>
              </defs>
              {CITY.map(([x, y, w, h]) => (
                <g key={`${x}-${y}`}>
                  <rect x={x} y={y} width={w} height={h} fill="url(#tower)" />
                  <rect x={x} y={y} width={w} height={h} fill="url(#lit)" opacity="0.85" />
                </g>
              ))}
              <g fill="#140d1d" opacity="0.95">
                <path d="M28 260c0-26 6-38 12-44 1 14 2 26 1 44zM40 260c0-22 8-34 14-40 2 12 3 24 2 40z" />
                <path d="M352 260c0-26 6-38 12-44 1 14 2 26 1 44zM364 260c0-22 8-34 14-40 2 12 3 24 2 40z" />
              </g>
            </svg>
            <div className="window__haze" />
            <div className="window__sheen" />
          </div>

          <div className="room__pegboard">
            <div className="pegboard__rail" />
            <div className="pegboard__cards">
              {KEYCARDS.map((card) => (
                <div className={`keycard keycard--${card.tone}`} key={card.name}>
                  <span className="keycard__pin" />
                  <span className="keycard__tab">{card.kind}</span>
                  <span className="keycard__name">{card.name}</span>
                  <span className="keycard__bars" />
                </div>
              ))}
            </div>
            <svg className="pegboard__keys" viewBox="0 0 90 120">
              <g stroke="#cbb9e2" strokeWidth="2" fill="none" opacity="0.7">
                <path d="M14 6v26M14 32a7 7 0 1 0 0.01 0" />
                <path d="M14 46v10M14 50h8" />
                <path d="M62 10v22M62 32a8 8 0 1 0 0.01 0" />
                <path d="M62 48v18M62 56h9M62 62h6" />
              </g>
            </svg>
            <div className="pegboard__glow" />
          </div>

          <div className="room__shelf">
            <div className="shelf__camera">
              <span className="camera__lens" />
              <span className="camera__flash" />
            </div>
            <div className="shelf__board" />
          </div>

          <div className="room__desk" />

          <div className="room__monitor">
            <div className="monitor__screen">
              <p className="monitor__label">PROJECTS</p>
              <ul className="monitor__list">
                {SCREEN_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <span className="monitor__cursor" />
            </div>
            <div className="monitor__stand" />
            <div className="monitor__base" />
          </div>

          <svg className="room__robot" viewBox="0 0 150 190">
            <g>
              <line x1="58" y1="30" x2="50" y2="6" stroke="#f3d9e4" strokeWidth="3" />
              <line x1="92" y1="30" x2="100" y2="6" stroke="#f3d9e4" strokeWidth="3" />
              <circle cx="50" cy="6" r="4.5" fill="#ff5c8a" />
              <circle cx="100" cy="6" r="4.5" fill="#ff5c8a" />
              <rect x="44" y="28" width="62" height="52" rx="8" fill="#efe6f2" />
              <rect x="51" y="36" width="48" height="33" rx="5" fill="#241731" />
              <circle cx="66" cy="52" r="3.4" fill="#ffe7ef" />
              <circle cx="84" cy="52" r="3.4" fill="#ffe7ef" />
              <rect x="64" y="61" width="22" height="2.6" rx="1.3" fill="#ff5c8a" opacity="0.8" />
              <rect x="38" y="80" width="74" height="22" rx="7" fill="#e5d7ea" />
              <rect x="56" y="102" width="38" height="52" rx="7" fill="#f2eaf5" />
              <rect x="62" y="112" width="26" height="12" rx="3" fill="#ff8fb0" opacity="0.85" />
              <rect x="30" y="104" width="14" height="34" rx="6" fill="#e0d0e6" />
              <rect x="106" y="104" width="14" height="34" rx="6" fill="#e0d0e6" />
              <circle cx="37" cy="142" r="7" fill="#2b1b38" />
              <circle cx="113" cy="142" r="7" fill="#2b1b38" />
              <rect x="62" y="154" width="26" height="10" rx="4" fill="#c9b3d6" />
              <rect x="54" y="164" width="42" height="12" rx="5" fill="#3a2647" />
            </g>
          </svg>

          <div className="room__lamp">
            <span className="lamp__dome" />
            <span className="lamp__arm" />
            <span className="lamp__pool" />
          </div>

          <div className="room__scene">
            {lowMode ? <HeroFallback /> : <Suspense fallback={<HeroFallback />}><HeroScene /></Suspense>}
          </div>

          <span className="spark spark--one" />
          <span className="spark spark--two" />
          <span className="spark spark--three" />
          <span className="spark spark--four" />
          <span className="spark spark--five" />

          <div className="room__scrim" />
        </div>

        <div className="hero__copy">
          <div className="hero__tags">
            <span className="hero__tag hero__tag--live">
              <i aria-hidden="true" /> Independent software house
            </span>
            <span className="hero__tag">Karachi · PK</span>
            <span className="hero__tag">Est. 2024</span>
          </div>

          <h1 className="hero__title">CensorisLabs</h1>

          <p className="hero__sub">
            Night-built software that keeps your life on your own device. Zero telemetry,
            no accounts, no rented intelligence — just tools that work with the network off.
          </p>

          <div className="hero__actions">
            <a
              className="btn btn--primary"
              href="#apps"
              onClick={(event) => {
                const target = document.getElementById('apps')
                if (!target) return
                event.preventDefault()
                const top = target.getBoundingClientRect().top + window.scrollY - 96
                window.scrollTo({ top, behavior: 'smooth' })
                window.history.replaceState(null, '', '#apps')
              }}
            >
              Explore more
              <span className="arrow" aria-hidden="true">→</span>
            </a>
            <a className="btn btn--outline" href="#/reviews">
              Reviews &amp; comments
            </a>
            <a
              className="btn btn--ghost"
              href="https://github.com/censorislabs"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </a>
          </div>

          <div className="hero__base">
            <span>Zero telemetry · No cookies · Fonts self-hosted</span>
            <span className="hero__url">censorislabs.online</span>
          </div>
        </div>
      </div>

      <a className="scroll-cue" href="#ecosystem" aria-label="Scroll to the ecosystem">
        Scroll
      </a>
    </section>
  )
}
