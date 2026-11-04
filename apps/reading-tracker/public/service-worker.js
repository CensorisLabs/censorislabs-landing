const CACHE = 'censorislabs-reading-tracker-v2'
const base = new URL('./', self.location.href)
const fonts = [
  'inter-latin-400-normal.woff2', 'inter-latin-500-normal.woff2', 'inter-latin-600-normal.woff2', 'inter-latin-700-normal.woff2',
  'cinzel-latin-400-normal.woff2', 'cinzel-latin-600-normal.woff2', 'cinzel-latin-700-normal.woff2',
  'jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-latin-500-normal.woff2',
]
const shell = [base.href, new URL('manifest.webmanifest', base).href, new URL('book-mark.svg', base).href, ...fonts.map(font => new URL(`fonts/${font}`, base).href)]
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shell)).then(() => self.skipWaiting())))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)) }
    return response
  }).catch(() => caches.match(new URL('./', self.location.href)))))
})
