# Decisions

Non-obvious choices made while building Censoris, newest last.

## 2026-10-19 — Phase 1 (Foundation)

- **Expo SDK 58, React 19.3, React Native 0.88, TypeScript strict.** Scaffolded
  with the current stable Expo blank-typescript template, then added Expo
  Router, NativeWind 4 (Tailwind 3), expo-sqlite, expo-secure-store,
  expo-local-authentication, expo-localization, expo-crypto, zustand,
  i18next/react-i18next, jest-expo. All permissively licensed (MIT/Apache/BSD/OFL
  for fonts).
- **Application ID `com.censorislabs.censoris`.** Proposed; must be confirmed by
  the owner before the first Play upload because it can never change after
  publishing.
- **react-dom pinned to 19.3.0** to match react 19.3.0; the newest react-dom
  (19.3.1) breaks npm's peer resolution against the Expo-pinned react.
- **Money is integer paise everywhere.** Indian digit grouping and compact
  (L/Cr) forms are hand-written in `src/domain/money.ts` instead of `Intl`,
  because Intl support varies across Android devices. Splits use largest-
  remainder with index tie-breaks so results are deterministic and always sum
  exactly.
- **Domain layer has no React and no platform imports** (`src/domain`), so it
  is unit-testable with plain Jest and reusable for iOS/desktop later.
- **Dates are stored as `YYYY-MM-DD` strings** and compared lexicographically.
  This avoids all timezone drift in reports and the financial-year selector
  (1 April – 31 March).
- **PIN is stored as salted SHA-256 in expo-secure-store** (Android Keystore /
  iOS Keychain backed). A forgotten PIN means wiping app data — deliberate:
  there is no server to authorize a reset, and we will not fake one. The lock
  screen says this plainly.
- **Lock on backgrounding when a lock is enabled** (not only on the inactivity
  timer): simplest reliable way to hide financial data in the recent-apps
  switcher without extra native code.
- **Fonts bundled via @expo-google-fonts packages** (OFL-licensed): Cinzel for
  headings/wordmark, Inter for body/numbers, and Noto Sans per Indic script.
  Android has no cross-family font fallback, so the body family is selected
  from the active language (`src/ui/fonts.ts`).
- **Six of eight locales are drafts marked `"_needsReview": true`** and English
  is the reference key set. `npm run check-locales` lists missing/unreviewed
  keys; it currently reports all eight locales as key-complete.
- **Jest uses the jest-expo preset without overriding transformIgnorePatterns**;
  a custom pattern broke transformation of `expo-modules-core` (ESM) and
  failed every test at setup.
- **`babel-preset-expo` is a direct devDependency** because Babel must resolve
  it from the project root when a custom `babel.config.js` exists.
- **SQLCipher at-rest encryption: not yet enabled.** `expo-sqlite` in managed
  mode does not expose SQLCipher; enabling it needs a prebuild with a
  SQLCipher-capable library. Planned before release (Phase 7 at the latest);
  tracked here so it is not forgotten. The app lock guards access meanwhile.

## 2026-10-19 — Website (censorislabs.online)

- **The site lives in `/website`** rather than at the repository root. The root
  is the Censoris Expo app; overwriting it would have destroyed the mobile
  project. Two deliverables, one repository.
- **Vite + React 19 + TypeScript, hand-written CSS.** No Tailwind on the site:
  the design is bespoke (Greco-Roman restraint), and plain CSS keeps the build
  small and dependency-light.
- **Three.js + @react-three/fiber for the hero monolith**, lazy-loaded so the
  headline paints before the ~900 kB 3D chunk arrives. Falls back to an inline
  SVG pillar when WebGL is unavailable, and renders a static frame under
  `prefers-reduced-motion`.
- **Fonts are self-hosted** (`public/fonts`, OFL licences included) instead of
  using the Google Fonts CDN. A zero-telemetry brand should not leak visitor
  IPs to a font CDN. `@fontsource` packages were used only as the source of the
  woff2 files and then removed.
- **Vite 8 cannot pre-bundle dependencies when the project path contains `#`**
  (this checkout is `E:\2# project`). `npm run dev` renders a blank page there;
  `npm run build` and `npm run preview` work. Documented in both READMEs;
  renaming the folder or cloning to a `#`-free path fixes dev mode.
- **No `.exe` / `.apk` links are wired** because no signed builds exist yet.
  The cards state that plainly instead of shipping broken download links; the
  owner supplies real URLs at release.
- **Legal texts are clearly labelled drafts** with a banner asking for counsel
  review. They are protective in structure (warranty disclaimer, liability
  limitation, no-advice clause) but not presented as final legal advice. The
  provided spec truncated mid-section, so the set covers ToS, privacy and
  liability — the three documents linked from the nav and footer.
- **Zero analytics/trackers on the site**, consistent with the product doctrine.
  No cookies are set.

## Open questions for the owner

- Confirm the application ID `com.censorislabs.censoris`.
- Decide whether the project gets a LICENSE file (nothing added yet, on
  purpose).
- Database encryption approach preference before release (SQLCipher prebuild vs
  field-level encryption) — recommendation: SQLCipher via prebuild.
