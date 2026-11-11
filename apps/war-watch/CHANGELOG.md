# Changelog

## 1.1.0 — installable release

The desktop build can reach the news index again.

### Added
- **Installable app**: web manifest, monochrome app icon, iOS home-screen metadata and a scoped service worker, so the app opens offline after the first visit and installs from the browser menu.
- **Accessibility pass**: a skip-to-content link, a labelled `main` landmark and visible focus rings across the shared shell.
- **Version in the footer** (`v1.1.0`), read from a generated `src/version.js` that stays in step with `package.json` and the worker cache name.

### Changed
- The Pro dialog now closes on Escape and returns focus to the button that opened it.
- Service-worker cleanup is limited to this app's own older caches. Apps that share one origin no longer delete each other's offline copies.

### Fixed
- The desktop build had no network bridge, so the GDELT index — which sends no CORS headers — could never load. Electron now fetches it in the main process through a host-restricted `news:fetch-json` channel.
- A failed refresh now names cross-origin blocking and rate limits instead of only suggesting a connection problem.
- Removed an unused `render` parameter that suggested an append mode the app never had.
