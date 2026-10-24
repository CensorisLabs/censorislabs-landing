/**
 * Static stand-in for the WebGL depth layer: the same magenta diamonds the
 * scene floats, drawn as SVG. Used while the 3D chunk loads and whenever WebGL
 * (or low-end mode) takes the canvas away, so the hero never changes character.
 */
const DIAMONDS = [
  { x: 210, y: 46, s: 6, o: 1 },
  { x: 136, y: 92, s: 4.5, o: 0.8 },
  { x: 246, y: 124, s: 8, o: 0.9 },
  { x: 96, y: 52, s: 3.5, o: 0.65 },
  { x: 188, y: 150, s: 4.5, o: 0.7 },
  { x: 62, y: 132, s: 3, o: 0.5 },
]

export default function HeroFallback() {
  return (
    <div className="hero__fallback" aria-hidden="true">
      <svg viewBox="0 0 280 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="hero-fallback-diamond">
            <stop offset="0%" stopColor="#ffe1ea" />
            <stop offset="100%" stopColor="#ff2e88" />
          </radialGradient>
        </defs>

        <circle cx="150" cy="90" r="132" fill="none" stroke="#a855f7" strokeOpacity="0.1" />
        <circle cx="150" cy="90" r="164" fill="none" stroke="#a855f7" strokeOpacity="0.07" />

        {DIAMONDS.map((diamond, index) => (
          <g
            key={index}
            transform={`translate(${diamond.x} ${diamond.y}) rotate(45)`}
            opacity={diamond.o}
          >
            <rect
              x={-diamond.s * 2.4}
              y={-diamond.s * 2.4}
              width={diamond.s * 4.8}
              height={diamond.s * 4.8}
              fill="#ff5c8a"
              opacity="0.12"
            />
            <rect
              x={-diamond.s}
              y={-diamond.s}
              width={diamond.s * 2}
              height={diamond.s * 2}
              fill="url(#hero-fallback-diamond)"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
