// Finhub PWA Service Worker (Network-first + Auto-Evict Stale Caches)
const CACHE_NAME = 'finhub-cache-v7';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((windowClients) => {
        windowClients.forEach((client) => {
          if ('navigate' in client) {
            client.navigate(client.url).catch(() => {});
          }
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
