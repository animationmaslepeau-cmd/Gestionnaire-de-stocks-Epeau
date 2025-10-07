const CACHE_NAME = 'gestion-stock-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-icon-512.png'
];

// On install, pre-cache the static assets.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => {
        console.error("Failed to cache static assets:", err);
      })
  );
  self.skipWaiting();
});

// On activate, clean up old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// On fetch, use a cache-then-network strategy.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // We only want to cache GET requests.
  if (request.method !== 'GET') {
    return;
  }

  // For Supabase API calls, use a network-first strategy to ensure data freshness.
  if (request.url.startsWith('https://zmnwninfuyxmtdczopmq.supabase.co')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request)) // Fallback to cache if network fails
    );
    return;
  }

  // For all other requests (app shell, static assets, scripts), use a stale-while-revalidate strategy.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        // Fetch from network in the background to update the cache.
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            console.warn(`Fetch failed for ${request.url}:`, err);
        });

        // Return the cached response immediately if it exists, otherwise wait for the network response.
        return cachedResponse || fetchPromise;
      });
    })
  );
});