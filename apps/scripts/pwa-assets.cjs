#!/usr/bin/env node
// Generates the installable-app plumbing every companion app needs: a web
// manifest, an icon, a service worker and the matching <head> metadata.
// Idempotent — rerun after a version bump to refresh the cache name and title.
//
//   node scripts/pwa-assets.cjs [app-folder ...]
// With no arguments it refreshes every companion app.

const fs = require('node:fs')
const path = require('node:path')

const APPS = {
  'archive-explorer': { name: 'Archive Explorer', short: 'Archive', mark: 'AE', accent: '#d9a25f', categories: ['education', 'books'] },
  'home-energy-estimator': { name: 'Home Energy Estimator', short: 'Energy', mark: 'HE', accent: '#6fb8ac', categories: ['utilities', 'productivity'] },
  'indian-banking-brief': { name: 'Indian Banking Brief', short: 'Bank Brief', mark: 'IB', accent: '#7ec9a2', categories: ['news', 'finance'] },
  'movie-guide': { name: 'Where to Watch', short: 'Where to Watch', mark: 'WW', accent: '#b78ad9', categories: ['entertainment'] },
  'muslim-companion': { name: 'Nur Companion', short: 'Nur', mark: 'NC', accent: '#7fc9a8', categories: ['lifestyle', 'books'] },
  'offline-arcade': { name: 'Offline Arcade', short: 'Arcade', mark: 'OA', accent: '#e0a05f', categories: ['games'] },
  'pc-part-picker': { name: 'PC Part Picker', short: 'PC Parts', mark: 'PC', accent: '#8fb3d9', categories: ['productivity', 'utilities'] },
  'social-feed': { name: 'Open Social', short: 'Open Social', mark: 'OS', accent: '#8fb8e8', categories: ['social', 'news'] },
  'war-watch': { name: 'World Conflict Brief', short: 'Conflict', mark: 'WC', accent: '#e08f8f', categories: ['news'] },
}

const shellWorker = (id, version) => `const CACHE = '${id}-v${version}'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only this app's older caches: sibling apps may share the origin.
      .then(keys => Promise.all(keys.filter(key => key.startsWith('${id}-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match('./index.html').then(cached => cached || caches.match('./')))
    )
    return
  }
  const url = new URL(request.url)
  // Third-party APIs (news, Qur'an, Mastodon, Archive.org) are never cached here.
  if (url.origin !== self.location.origin) return
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {})
      }
      return response
    }).catch(() => cached))
  )
})
`

const icon = (mark, accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="${mark}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b1e24"/>
      <stop offset="1" stop-color="#101216"/>
    </linearGradient>
    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity="1"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="4"/>
  <text x="50%" y="50%" dy="0.34em" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="196" letter-spacing="6" fill="url(#fg)">${mark}</text>
  <circle cx="256" cy="392" r="7" fill="${accent}" fill-opacity="0.85"/>
</svg>
`

const head = meta => `    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="./icon.svg" />
    <link rel="apple-touch-icon" href="./icon.svg" />
    <meta name="application-name" content="${meta.name}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${meta.short}" />
    <meta name="format-detection" content="telephone=no" />
`

function main() {
  const root = path.resolve(__dirname, '..')
  const requested = process.argv.slice(2)
  const ids = requested.length ? requested : Object.keys(APPS)
  for (const id of ids) {
    const meta = APPS[id]
    if (!meta) { console.warn(`skip ${id}: no PWA metadata defined`); continue }
    const dir = path.join(root, id)
    const pkgPath = path.join(dir, 'package.json')
    if (!fs.existsSync(pkgPath)) { console.warn(`skip ${id}: not an app folder`); continue }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.version = '1.1.0'
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ||
      `${meta.name} from CensorisLabs — local-first, no account required.`

    const manifest = {
      name: `${meta.name} — CensorisLabs`,
      short_name: meta.short,
      description,
      start_url: './',
      scope: './',
      id: './',
      display: 'standalone',
      orientation: 'any',
      background_color: '#101216',
      theme_color: '#16181c',
      categories: meta.categories,
      icons: [
        { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    }

    const publicDir = path.join(dir, 'public')
    fs.mkdirSync(publicDir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'src', 'version.js'), `// Generated by scripts/pwa-assets.cjs - keep in step with package.json.
export const APP_VERSION = '${pkg.version}'
`)
    fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)
    fs.writeFileSync(path.join(publicDir, 'icon.svg'), icon(meta.mark, meta.accent))
    fs.writeFileSync(path.join(publicDir, 'sw.js'), shellWorker(id, pkg.version))

    let next = html
    if (!/rel="manifest"/.test(next)) next = next.replace(/<\/head>/i, `${head(meta)}  </head>`)
    if (!/viewport-fit=cover/.test(next)) {
      next = next.replace(/content="width=device-width[^"]*"/i, 'content="width=device-width,initial-scale=1,viewport-fit=cover"')
    }
    fs.writeFileSync(path.join(dir, 'index.html'), next)
    console.log(`pwa ${id} → v${pkg.version}`)
  }
}

main()
