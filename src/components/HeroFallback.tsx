/**
 * Static stand-in for the WebGL layer: a scattering of glowing glass shards and
 * magenta diamonds drawn as SVG. Used while the 3D chunk loads and whenever
 * WebGL (or low-end mode) takes the canvas away.
 */
const SHARDS = [
  { x: 18, y: 22, w: 92, h: 62, r: -14, o: 0.24 },
  { x: 70, y: 58, w: 66, h: 92, r: 9, o: 0.18 },
  { x: 40, y: 12, w: 58, h: 40, r: 6, o: 0.16 },
  { x: 76, y: 20, w: 48, h: 66, r: -7, o: 0.2 },
]

const DIAMONDS = [
  { x: 210, y: 40, s: 7 },
  { x: 160, y: 96, s: 5 },
  { x: 246, y: 118, s: 9 },
  { x: 128, y: 34, s: 4 },
  { x: 198, y: 148, s: 5 },
]

export default function HeroFallback() {
  return (
    <div className="hero__fallback" aria-hidden="true">
      <svg viewBox="0 0 280 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="shard-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff5c8a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="diamond-core">
            <stop offset="0%" stopColor="#ffd7e5" />
            <stop offset="100%" stopColor="#ff2e88" />
          </radialGradient>
        </defs>

        {SHARDS.map((shard, index) => (
          <rect
            key={index}
            x={shard.x}
            y={shard.y}
            width={shard.w}
            height={shard.h}
            rx="4"
            transform={`rotate(${shard.r} ${shard.x + shard.w / 2} ${shard.y + shard.h / 2})`}
            fill="url(#shard-glass)"
            stroke="#ff8fb4"
            strokeOpacity={shard.o}
            strokeWidth="0.7"
          />
        ))}

        {DIAMONDS.map((diamond, index) => (
          <g key={index} transform={`translate(${diamond.x} ${diamond.y}) rotate(45)`}>
            <rect x={-diamond.s} y={-diamond.s} width={diamond.s * 2} height={diamond.s * 2} fill="url(#diamond-core)" />
            <rect
              x={-diamond.s * 2}
              y={-diamond.s * 2}
              width={diamond.s * 4}
              height={diamond.s * 4}
              fill="#ff5c8a"
              opacity="0.12"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
