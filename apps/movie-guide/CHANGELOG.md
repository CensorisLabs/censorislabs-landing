# Changelog

## 1.1.0 — installable release

Provider lookups behave the same whether you open Pro from the card or the meter.

### Added
- **Installable app**: web manifest, monochrome app icon, iOS home-screen metadata and a scoped service worker, so the app opens offline after the first visit and installs from the browser menu.
- **Accessibility pass**: a skip-to-content link, a labelled `main` landmark and visible focus rings across the shared shell.
- **Version in the footer** (`v1.1.0`), read from a generated `src/version.js` that stays in step with `package.json` and the worker cache name.

### Changed
- The Pro dialog now closes on Escape and returns focus to the button that opened it.
- Service-worker cleanup is limited to this app's own older caches. Apps that share one origin no longer delete each other's offline copies.

### Fixed
- “Offer details” ran two listeners, rebuilding the Pro dialog twice per click. The shared paywall now owns that event alone.
