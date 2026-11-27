const CACHE = 'censorislabs-reading-tracker-v3'
const base = new URL('./', self.location.href)
const fonts = [
  'inter-latin-400-normal.woff2', 'inter-latin-500-normal.woff2', 'inter-latin-600-normal.woff2', 'inter-latin-700-normal.woff2',
  'cinzel-latin-400-normal.woff2', 'cinzel-latin-600-normal.woff2', 'cinzel-latin-700-normal.woff2',
  'jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-latin-500-normal.woff2',
]
const shell = [base.href, new URL('manifest.webmanifest', base).href, new URL('book-mark.svg', base).href, ...fonts.map(font => new URL(`fonts/${font}`, base).href)]
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shell)).then(() => self.skipWaiting())))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())))
// Hashed assets and fonts can come straight from the cache; documents cannot,
// because a cached index.html keeps pointing at asset hashes a later deploy deleted.
const immutable = request => new URL(request.url).pathname.includes('/assets/') || new URL(request.url).pathname.includes('/fonts/')
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate' || !immutable(request)) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && request.mode !== 'navigate') { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)) }
      return response
    }).catch(() => caches.match(request).then(cached => cached || caches.match(base.href))))
    return
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)) }
    return response
  })))
})
