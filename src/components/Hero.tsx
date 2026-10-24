import { lazy, Suspense, useEffect, useState } from 'react'
import HeroFallback from './HeroFallback'

const HeroScene = lazy(() => import('./HeroScene'))

/** Night skyline: x, y, width, height — every tower meets the street at y 330. */
const CITY: Array<[number, number, number, number]> = [
  [40, 182, 60, 148],
  [102, 214, 46, 116],
  [150, 152, 56, 178],
  [208, 198, 44, 132],
  [254, 126, 62, 204],
  [318, 172, 50, 158],
  [370, 222, 42, 108],
  [414, 150, 58, 180],
  [474, 196, 44, 134],
  [520, 132, 60, 198],
  [582, 186, 44, 144],
]

const KEYCARDS = [
  { name: 'ARTHA', kind: 'FINANCE', color: '#ff4d6d', tilt: -4 },
  { name: 'NUR', kind: 'DAILY', color: '#2dd4bf', tilt: 2.5 },
  { name: 'PICKER', kind: 'HARDWARE', color: '#4f8bff', tilt: -1.5 },
  { name: 'ARCADE', kind: 'GAMES', color: '#a855f7', tilt: 3 },
  { name: 'WATCH', kind: 'FILM', color: '#f5b23e', tilt: -2.5 },
]

const SCREEN_LINES = [
  'ArthaSetu — private ledger',
  'Nur Companion — daily',
  'PC Part Picker — builds',
  'Offline Arcade — games',
]

function Palm({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#140d1e">
      <path d="M-5 0 C -12 -34 -4 -70 8 -96 L 18 -92 C 6 -68 1 -34 5 0 Z" />
      <path d="M14 -96 C -8 -112 -34 -112 -50 -101 C -28 -103 -6 -94 12 -85 Z" />
      <path d="M14 -96 C 34 -116 60 -114 72 -101 C 52 -103 30 -95 14 -85 Z" />
      <path d="M15 -99 C 0 -124 -18 -135 -34 -133 C -14 -127 2 -112 13 -96 Z" />
      <path d="M16 -99 C 34 -122 52 -129 66 -125 C 46 -119 30 -108 17 -95 Z" />
      <path d="M13 -93 C 7 -76 1 -68 -8 -63 C 1 -60 9 -71 17 -84 Z" />
    </g>
  )
}

function Diamond({ x, y, size = 14 }: { x: number; y: number; size?: number }) {
  const half = size / 2
  return (
    <g transform={`translate(${x} ${y}) rotate(45)`}>
      <rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={1}
        fill="#ff5c8a"
        filter="url(#hero-glow)"
      />
    </g>
  )
}

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
          <svg
            className="room__art"
            viewBox="0 0 1200 840"
            preserveAspectRatio="xMidYMid slice"
            role="presentation"
          >
            <defs>
              <linearGradient id="hero-wall" x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0%" stopColor="#312440" />
                <stop offset="46%" stopColor="#201728" />
                <stop offset="100%" stopColor="#0c0812" />
              </linearGradient>
              <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a1b3d" />
                <stop offset="38%" stopColor="#543361" />
                <stop offset="74%" stopColor="#a06a8b" />
                <stop offset="100%" stopColor="#e5afb6" />
              </linearGradient>
              <linearGradient id="hero-tower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4b3059" />
                <stop offset="100%" stopColor="#241730" />
              </linearGradient>
              <radialGradient id="hero-haze" cx="0.5" cy="1" r="0.75">
                <stop offset="0%" stopColor="#ffc9d3" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ffc9d3" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="hero-desk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a1e36" />
                <stop offset="34%" stopColor="#1a1224" />
                <stop offset="100%" stopColor="#0a0710" />
              </linearGradient>
              <linearGradient id="hero-screen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2b1a3c" />
                <stop offset="70%" stopColor="#171021" />
                <stop offset="100%" stopColor="#120c1a" />
              </linearGradient>
              <pattern id="hero-lit" width="8" height="11" patternUnits="userSpaceOnUse">
                <rect width="3" height="4" x="1.2" y="1.8" fill="#ffd9ab" opacity="0.92" />
                <rect width="3" height="4" x="5" y="6.4" fill="#ffb387" opacity="0.7" />
                <rect width="3" height="4" x="1.2" y="6.4" fill="#ffe9c4" opacity="0.45" />
              </pattern>
              <pattern id="hero-peg" width="13" height="13" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,0.16)" />
              </pattern>
              <filter id="hero-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id="hero-window-clip">
                <rect x="24" y="26" width="630" height="300" rx="8" />
              </clipPath>
            </defs>

            <rect width="1200" height="840" fill="url(#hero-wall)" />
            <g stroke="rgba(255,255,255,0.06)" strokeWidth="1.5">
              <line x1="676" y1="0" x2="676" y2="840" />
              <line x1="1152" y1="0" x2="1152" y2="840" />
              <line x1="676" y1="352" x2="1200" y2="352" />
            </g>

            {/* Window onto the night city */}
            <g clipPath="url(#hero-window-clip)">
              <rect x="24" y="26" width="630" height="300" fill="url(#hero-sky)" />
              {CITY.map(([x, y, w, h]) => (
                <g key={`${x}-${y}`}>
                  <rect x={x} y={y} width={w} height={h} fill="url(#hero-tower)" />
                  <rect x={x + 3} y={y + 5} width={w - 6} height={h - 8} fill="url(#hero-lit)" />
                </g>
              ))}
              <ellipse cx="340" cy="332" rx="340" ry="70" fill="url(#hero-haze)" opacity="0.55" />
              <Palm x={118} y={334} scale={0.95} />
              <Palm x={352} y={334} scale={0.68} />
              <Palm x={566} y={334} scale={0.86} />
              <g fill="#140d1e">
                <rect x="278" y="74" width="4" height="20" />
                <rect x="544" y="76" width="3" height="20" />
                <rect x="176" y="104" width="3" height="16" />
              </g>
            </g>
            <rect
              x="24"
              y="26"
              width="630"
              height="300"
              rx="8"
              fill="none"
              stroke="#0f0a17"
              strokeWidth="9"
            />
            <g fill="#120c1b">
              <rect x="231" y="26" width="6" height="300" />
              <rect x="441" y="26" width="6" height="300" />
              <rect x="24" y="204" width="630" height="5" />
            </g>
            <path
              d="M40 60 L 210 26 L 250 26 L 60 96 Z"
              fill="rgba(255,255,255,0.06)"
            />

            {/* Pegboard with the app keycards */}
            <g>
              <rect
                x="690"
                y="58"
                width="470"
                height="272"
                rx="12"
                fill="#191320"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1.5"
              />
              <rect x="690" y="58" width="470" height="272" rx="12" fill="url(#hero-peg)" />
              <rect
                x="690"
                y="58"
                width="470"
                height="272"
                rx="12"
                fill="none"
                stroke="rgba(255,92,138,0.18)"
                strokeWidth="10"
                opacity="0.5"
              />
              <line x1="712" y1="88" x2="1138" y2="88" stroke="rgba(255,240,246,0.4)" strokeWidth="2" />
              <line x1="712" y1="88" x2="1138" y2="88" stroke="rgba(255,92,138,0.35)" strokeWidth="6" opacity="0.35" />

              {KEYCARDS.map((card, index) => {
                const x = 726 + index * 72
                const cx = x + 28
                return (
                  <g key={card.name} transform={`rotate(${card.tilt} ${cx} 122)`}>
                    <line x1={cx} y1="88" x2={cx} y2="122" stroke="rgba(255,235,243,0.5)" strokeWidth="1.2" />
                    <rect x={x} y="122" width="56" height="88" rx="4" fill="#f6eef3" />
                    <path d={`M${x} 126 a4 4 0 0 1 4 -4 h48 a4 4 0 0 1 4 4 v20 h-56 z`} fill={card.color} />
                    <circle cx={cx} cy="133" r="2.6" fill="rgba(18,9,24,0.5)" />
                    <text
                      x={cx}
                      y="158"
                      textAnchor="middle"
                      fontSize="6"
                      letterSpacing="0.8"
                      fill="rgba(28,14,36,0.62)"
                      style={{ fontFamily: 'var(--mono)' }}
                    >
                      {card.kind}
                    </text>
                    <text
                      x={cx}
                      y="170"
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="600"
                      letterSpacing="0.4"
                      fill="#26162f"
                      style={{ fontFamily: 'var(--mono)' }}
                    >
                      {card.name}
                    </text>
                    <g fill="rgba(38,22,47,0.35)">
                      <rect x={x + 8} y="180" width="40" height="2" rx="1" />
                      <rect x={x + 8} y="186" width="30" height="2" rx="1" />
                      <rect x={x + 8} y="192" width="35" height="2" rx="1" />
                      <rect x={x + 8} y="200" width="40" height="3" rx="1" />
                    </g>
                  </g>
                )
              })}

              <g stroke="#cdb9e0" strokeWidth="2" fill="none" opacity="0.55">
                <path d="M1100 96v26" />
                <path d="M1100 122a7 7 0 1 0 0.01 0" />
                <path d="M1100 136v42M1100 146h10M1100 154h7" />
                <path d="M1132 96v20" />
                <path d="M1132 116a8 8 0 1 0 0.01 0" />
                <path d="M1132 132v34M1132 142h-8M1132 150h-6" />
              </g>
              <Diamond x={925} y={38} size={18} />
            </g>

            <Diamond x={256} y={70} size={13} />
            <Diamond x={664} y={140} size={10} />
            <Diamond x={1180} y={338} size={11} />

            {/* Shelf camera */}
            <g>
              <rect x="1000" y="372" width="118" height="6" rx="3" fill="#2b1e38" />
              <rect
                x="1022"
                y="308"
                width="86"
                height="64"
                rx="7"
                fill="#241a30"
                stroke="rgba(255,255,255,0.13)"
                strokeWidth="1.4"
              />
              <circle cx="1065" cy="340" r="21" fill="#110b19" stroke="rgba(255,157,187,0.5)" strokeWidth="1.6" />
              <circle cx="1065" cy="340" r="10" fill="#1d1429" stroke="rgba(255,92,138,0.45)" strokeWidth="1.2" />
              <rect x="1088" y="318" width="12" height="8" rx="2" fill="#ffe1ea" opacity="0.55" />
              <Diamond x={1065} y={292} size={12} />
            </g>

            {/* Desk */}
            <rect x="0" y="430" width="1200" height="410" fill="url(#hero-desk)" />
            <line x1="0" y1="430" x2="1200" y2="430" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
            <ellipse cx="230" cy="470" rx="330" ry="70" fill="rgba(255,120,160,0.1)" />

            {/* Desk lamp, tucked behind the monitor */}
            <g>
              <ellipse cx="30" cy="206" rx="120" ry="70" fill="rgba(255,120,160,0.16)" />
              <path d="M-18 206 q 0 -48 44 -48 q 44 0 44 48 z" fill="#ff8fb4" />
              <path d="M-18 206 q 0 -48 44 -48 q 44 0 44 48 z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
              <rect x="24" y="206" width="3" height="40" fill="#ffb9cf" opacity="0.85" />
            </g>

            {/* Monitor */}
            <g>
              <rect
                x="58"
                y="196"
                width="340"
                height="204"
                rx="9"
                fill="#191123"
                stroke="rgba(255,255,255,0.17)"
                strokeWidth="2"
              />
              <rect x="66" y="204" width="324" height="188" rx="5" fill="url(#hero-screen)" />
              <text
                x="90"
                y="252"
                fontSize="25"
                fontWeight="700"
                letterSpacing="7"
                fill="#ffdce7"
                style={{ fontFamily: 'var(--sans)' }}
              >
                PROJECTS
              </text>
              {SCREEN_LINES.map((line, index) => (
                <g key={line}>
                  <rect x="90" y={274 + index * 22} width="4" height="4" fill="rgba(255,92,138,0.85)" transform={`rotate(45 92 ${276 + index * 22})`} />
                  <text
                    x="104"
                    y={281 + index * 22}
                    fontSize="9"
                    letterSpacing="0.6"
                    fill="rgba(255,255,255,0.44)"
                    style={{ fontFamily: 'var(--mono)' }}
                  >
                    {line}
                  </text>
                </g>
              ))}
              <rect x="90" y="366" width="42" height="3" fill="#ff9dbb" />
              <rect x="218" y="400" width="26" height="24" fill="#281b35" />
              <rect x="172" y="420" width="118" height="9" rx="4" fill="#2c1e3a" />
            </g>

            {/* Robot with camera */}
            <g>
              <line x1="462" y1="292" x2="452" y2="262" stroke="#f3d9e4" strokeWidth="3" />
              <line x1="516" y1="292" x2="526" y2="262" stroke="#f3d9e4" strokeWidth="3" />
              <circle cx="452" cy="262" r="4.5" fill="#ff5c8a" />
              <circle cx="526" cy="262" r="4.5" fill="#ff5c8a" />
              <rect x="448" y="290" width="82" height="68" rx="10" fill="#efe6f2" />
              <rect x="460" y="302" width="58" height="44" rx="6" fill="#241731" />
              <circle cx="478" cy="322" r="4" fill="#ffe7ef" />
              <circle cx="500" cy="322" r="4" fill="#ffe7ef" />
              <rect x="478" y="332" width="22" height="3" rx="1.5" fill="#ff5c8a" opacity="0.85" />
              <rect x="438" y="358" width="102" height="56" rx="9" fill="#e7dbea" />
              <rect x="472" y="370" width="34" height="16" rx="4" fill="#ff8fb0" opacity="0.85" />
              <rect x="418" y="362" width="20" height="50" rx="8" fill="#ded0e4" />
              <rect x="540" y="362" width="20" height="50" rx="8" fill="#ded0e4" />
              <rect x="452" y="414" width="32" height="16" rx="5" fill="#c9b3d6" />
              <rect x="494" y="414" width="32" height="16" rx="5" fill="#c9b3d6" />
              <g>
                <rect x="462" y="384" width="54" height="38" rx="7" fill="#2b1b38" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
                <circle cx="489" cy="403" r="13" fill="#150e1f" stroke="rgba(255,157,187,0.55)" strokeWidth="1.6" />
                <circle cx="489" cy="403" r="6" fill="#2a1b38" stroke="rgba(255,92,138,0.5)" strokeWidth="1.2" />
                <rect x="504" y="388" width="8" height="6" rx="1.5" fill="#ffe1ea" opacity="0.6" />
              </g>
            </g>

            <rect width="1200" height="840" fill="rgba(255,255,255,0.008)" />
          </svg>

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
