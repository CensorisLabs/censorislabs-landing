# Changelog

## 1.1.0 — installable release

The brief reports its cached state instead of appearing to load forever.

### Added
- **Installable app**: web manifest, monochrome app icon, iOS home-screen metadata and a scoped service worker, so the app opens offline after the first visit and installs from the browser menu.
- **Accessibility pass**: a skip-to-content link, a labelled `main` landmark and visible focus rings across the shared shell.
- **Version in the footer** (`v1.1.0`), read from a generated `src/version.js` that stays in step with `package.json` and the worker cache name.

### Changed
- The Pro dialog now closes on Escape and returns focus to the button that opened it.
- Service-worker cleanup is limited to this app's own older caches. Apps that share one origin no longer delete each other's offline copies.

### Fixed
- Reopening the app within two hours left the status line on “Loading local feed cache…” even though no refresh ran. It now reports the cached headline count and check time.
- A failed refresh now explains that browser builds can be blocked by publisher cross-origin policies, and that the desktop and mobile builds fetch feeds directly.
