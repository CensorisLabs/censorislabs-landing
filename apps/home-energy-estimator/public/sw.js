const CACHE = 'home-energy-estimator-v1.1.0'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only this app's older caches: sibling apps may share the origin.
      .then(keys => Promise.all(keys.filter(key => key.startsWith('home-energy-estimator-') && key !== CACHE).map(key => caches.delete(key))))
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
