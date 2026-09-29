// Service worker for cy.my, emitted to dist/sw.js by the cy:service-worker plugin in vite.config.ts,
// which fills in the build id below with a hash of the build's file names.
//
// GitHub Pages serves every file with a 10-minute cache, so repeat visits would re-check about 900 KB
// of scripts, fonts and stills. This keeps them in a per-build cache instead:
// - hashed build output and the unhashed fonts, seals, glyphs and stills: cache first;
// - the page itself: network first, falling back to the cached copy when offline.
// A new deploy gets a new build id, so the old cache is dropped and every file is fetched once more.
// /blog/ and /UOW_INTISubang/ are separate project sites on this origin: never touched.
//
// To switch it off for everyone, deploy a sw.js that calls self.registration.unregister().

const CACHE = 'cy-__BUILD_ID__'
const CACHE_FIRST = /^\/(assets|fonts|seals|glyphs|stills)\//
const OTHER_SITES = /^\/(blog|UOW_INTISubang)(\/|$)/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cy-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || OTHER_SITES.test(url.pathname)) return
  if (request.mode === 'navigate') event.respondWith(networkFirst(request))
  else if (CACHE_FIRST.test(url.pathname)) event.respondWith(cacheFirst(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok && response.status === 200) cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: true })
    if (hit) return hit
    throw error
  }
}
