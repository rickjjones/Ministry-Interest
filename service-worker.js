const APP_VERSION = '1.0.0';
const CACHE_NAME = `ministry-interest-tracker-${APP_VERSION}`;
const ASSETS = [
  './version.json',
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('./version.json')
      .then((response) => response.json())
      .then((data) => {
        const version = data.version || APP_VERSION;
        const versionedCacheName = `ministry-interest-tracker-${version}`;
        return caches.open(versionedCacheName).then((cache) => cache.addAll(ASSETS));
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    fetch('./version.json')
      .then((response) => response.json())
      .then((data) => {
        const version = data.version || APP_VERSION;
        const currentCacheName = `ministry-interest-tracker-${version}`;
        return caches.keys().then((keys) =>
          Promise.all(
            keys.filter((key) => key !== currentCacheName).map((key) => caches.delete(key))
          )
        );
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        return response;
      }).catch(() => caches.match('./'));
    })
  );
});
