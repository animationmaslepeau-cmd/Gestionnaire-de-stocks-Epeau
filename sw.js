// sw.js

const CACHE_NAME = 'gestion-stock-cache-v3'; // Cache version incremented
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('Failed to cache app shell:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Supabase API calls: network-first strategy
  if (request.url.startsWith('https://zmnwninfuyxmtdczopmq.supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other requests: stale-while-revalidate strategy
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache the response only if it's successful (e.g., status 200)
    if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log(`Fetch failed for ${request.url}; trying cache.`, error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // If not in cache, let the browser handle the error by re-throwing
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(networkResponse => {
      // Check for a valid response to cache.
      // Opaque responses (from cross-origin CDNs) have type 'opaque' and status 0.
      // We can cache them, but we cannot read their content or status.
      if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn(`Fetch failed for ${request.url}. The user might be offline.`, error);
      // The fetch failed. If we have a cached response, it's already been returned.
      // If not, this error will cause the promise to reject, leading to a browser network error.
      throw error;
    });

  // Return cached response immediately if available, otherwise wait for the network response.
  return cachedResponse || fetchPromise;
}
