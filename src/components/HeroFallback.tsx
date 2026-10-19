/**
 * Pure-SVG line-art Roman pillar.
 *
 * Used in two places:
 *  - as the Suspense fallback while the Three.js chunk loads (keeps the hero
 *    composition complete on first paint), and
 *  - as the permanent backdrop when WebGL is unavailable.
 */
export default function HeroFallback() {
  return (
    <div className="hero__fallback" aria-hidden="true">
      <svg
        viewBox="0 0 240 420"
        width="min(46vw, 360px)"
        style={{ opacity: 0.55 }}
      >
        <defs>
          <linearGradient id="pillar-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <g
          fill="none"
          stroke="url(#pillar-fade)"
          strokeWidth="1"
          strokeLinejoin="round"
        >
          <rect x="40" y="340" width="160" height="22" />
          <rect x="58" y="318" width="124" height="22" />
          <path d="M96 318 L92 96 L148 96 L144 318" />
          <path d="M96 318 L92 96 M120 318 L120 96 M144 318 L148 96" />
          <rect x="84" y="74" width="72" height="22" />
          <rect x="72" y="50" width="96" height="24" />
          <ellipse cx="120" cy="196" rx="104" ry="26" strokeOpacity="0.35" />
          <ellipse cx="120" cy="196" rx="86" ry="18" strokeOpacity="0.2" />
        </g>
      </svg>
    </div>
  )
}
