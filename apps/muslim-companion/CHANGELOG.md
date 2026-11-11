# Changelog

## 1.1.0 — installable release

Reading, prayer times and dhikr now have the same release plumbing as the rest of the suite.

### Added
- **Installable app**: web manifest, monochrome app icon, iOS home-screen metadata and a scoped service worker, so the app opens offline after the first visit and installs from the browser menu.
- **Accessibility pass**: a skip-to-content link, a labelled `main` landmark and visible focus rings across the shared shell.
- **Version in the footer** (`v1.1.0`), read from a generated `src/version.js` that stays in step with `package.json` and the worker cache name.

### Changed
- The Pro dialog now closes on Escape and returns focus to the button that opened it.
- Service-worker cleanup is limited to this app's own older caches. Apps that share one origin no longer delete each other's offline copies.

### Notes
- The Qur’an reader still caches a chapter for up to seven days and keeps translations attributed to their source. Nothing is uploaded; bookmarks and dhikr counts stay on the device.
