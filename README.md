# CensorisLabs · website and app suite

The CensorisLabs GitHub repository contains the public website and the complete source for ArthaSetu plus ten companion apps. The site is a Vite/React app; `apps/` is a set of independent Vite projects sharing local-first UI, offer rules, and license verification.

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

## App directory and downloads

The site publishes an app directory at `#/apps` and one detail page per app. Each detail page checks the latest GitHub Release and enables only real `.exe` and `.apk` assets under 100 MB. The website deploys through Vercel when its connected branch is updated; binaries are served from GitHub Releases.

Every app lives under `apps/<app-id>/`. Shared UI, prices, licenses, coupons, and build scripts live under `apps/shared/` and `apps/scripts/`. See [apps/README.md](apps/README.md) for the complete catalog and build notes.

### Publish installers

Push the source to the GitHub repository, then push a version tag such as `v1.0.0`. The release workflow builds signed Android APKs and portable Windows EXEs for all eleven apps, checks that each file is no larger than 100 MB, and attaches assets named `<app-id>-android.apk` and `<app-id>-windows.exe` to one GitHub Release. The app pages then discover those files automatically.

Before the Android release workflow can succeed, add these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64` — base64 of the release `.jks` keystore
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `LICENSE_PUBLIC_KEY` — public P-256 JWK used to verify suite licenses

Keep the keystore and passwords backed up privately. Losing the keystore prevents signed APK updates from installing over earlier versions. The Windows EXEs are portable but not code-signed; signing them requires a Windows code-signing certificate.

The release workflow publishes files only after every app succeeds and all 22 platform builds pass the size check. An oversized artifact fails the release before it is published.

## Monetization readiness

All apps share the ₹69 monthly, ₹299 yearly, ₹499 early-bird lifetime, and ₹999 standard lifetime plans. The apps count use locally and preview the 10% coupon at 15 actions and the 15% coupon at 30. A shared weekly schedule selects a random eight-hour 10% sale window. The first-1,000-user 30% offer and every coupon are presented as pending checkout verification.

Checkout, customer identity, first-1,000 allocation, recurring billing, refunds, and server-side license issuance are **not connected**. The buttons therefore do not take payment or grant Pro access. Add a payment provider and a private license-issuing service before selling subscriptions or making discount claims redeemable. The app-side public-key verification is already shared; do not put the private signing key in this repository or in a client app.

The movie finder uses TMDB and JustWatch provider data only when configured. Because this app is part of a commercial suite, obtain TMDB's commercial license before enabling provider API mode. Set `VITE_TMDB_COMMERCIAL_LICENSE=true` only after licensing; keep keys and commercial terms in the appropriate secrets/configuration. Until then, the app offers direct JustWatch title searches.

The global conflict brief checks GDELT every two minutes while open. It cannot provide instant push alerts when closed. The social app supports Mastodon-compatible public timelines and posts; it is not an X client.

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
- The 3D scene respects `prefers-reduced-motion`, uses an SVG fallback, and is not loaded in low-end mode.
- Legal notices are **drafts** awaiting counsel review; the modal says so.
- Download buttons stay disabled until a matching GitHub release asset exists and its reported size is under 100 MB.
