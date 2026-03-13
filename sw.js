// Service Worker — Overtime & Leave Log PWA
const CACHE_NAME = 'ot-log-v4';
const OFFLINE_URL = 'index.html';

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache when offline
self.addEventListener('fetch', event => {
  // For API calls to Apps Script — use network only (no caching)
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', queued: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  // For app shell — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// Background sync — when connectivity returns, flush the offline queue
self.addEventListener('sync', event => {
  if (event.tag === 'sync-ot-entries') {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  // Queue is stored in IndexedDB — handled by the main app
  // This just notifies all clients to trigger sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
}
