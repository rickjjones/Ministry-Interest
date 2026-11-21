// Network-first service worker.
// App files are always fetched fresh when online and fall back to the cache
// when offline, so new deployments reach users without editing this file.
// Bump CACHE_VERSION only when the caching strategy itself changes.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `ministry-interest-tracker-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './utils.js',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './version.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs; let third-party calls (e.g. geocoding) go straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./');
        return Response.error();
      })
  );
});
