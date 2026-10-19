# CensorisLabs website

Corporate homepage and software-studio showcase for CensorisLabs, featuring
the Censoris finance tracker and Vesper developer tools.

## Stack

- Vite + React 19 + TypeScript (strict via `tsc -b`)
- Three.js via `@react-three/fiber` for the hero monolith (lazy-loaded)
- Hand-written CSS design system (`src/index.css`)
- Self-hosted Cinzel / Inter / JetBrains Mono (OFL) in `public/fonts`
- No analytics, no trackers, no third-party font CDN

## Commands

```powershell
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # production build to dist/
npm run preview    # serve the production build
```

## Structure

```
src/App.tsx                 composition + legal dialog state
src/components/Nav.tsx      sticky nav, mobile menu
src/components/Hero.tsx     headline, CTAs, stats
src/components/Monolith.tsx 3D wireframe pillar (lazy, WebGL fallback)
src/components/Ecosystem.tsx product cards (Censoris, Vesper)
src/components/TechnicalLedger.tsx spec table
src/components/Sovereignty.tsx manifesto
src/components/Legal.tsx    legal section + accessible modal + draft texts
src/components/Footer.tsx
public/fonts                woff2 files + OFL licences
public/favicon.svg          gold monogram
```

## Notes

- **Windows path caveat:** this folder's path contains `#`, which breaks Vite
  8's dependency pre-bundling in `npm run dev` (blank page, console syntax
  error). `npm run build` + `npm run preview` work. Use a `#`-free path for
  hot reload.
- The 3D scene respects `prefers-reduced-motion` and falls back to an SVG
  pillar if WebGL is unavailable.
- Legal notices are **drafts** awaiting counsel review; the modal says so.
- Download buttons are intentionally not links until signed builds exist.
