# Changelog

## 1.1.0 — installable release

The billing period field now shows the value the estimate actually uses.

### Added
- **Installable app**: web manifest, monochrome app icon, iOS home-screen metadata and a scoped service worker, so the app opens offline after the first visit and installs from the browser menu.
- **Accessibility pass**: a skip-to-content link, a labelled `main` landmark and visible focus rings across the shared shell.
- **Version in the footer** (`v1.1.0`), read from a generated `src/version.js` that stays in step with `package.json` and the worker cache name.

### Changed
- The Pro dialog now closes on Escape and returns focus to the button that opened it.
- Service-worker cleanup is limited to this app's own older caches. Apps that share one origin no longer delete each other's offline copies.

### Fixed
- Typing a billing period outside 1–62 days calculated with the clamped value while the field kept the typed number. The field now shows the clamped value once you leave it.
