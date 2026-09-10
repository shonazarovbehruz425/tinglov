// Tinglov PWA Service Worker (Network-First for Freshness)
const CACHE_NAME = 'tinglov-v2';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET or range requests (videos/audio streams)
  if (request.method !== 'GET' || request.headers.has('range')) {
    return;
  }

  // API calls, Supabase calls, and OAuth callbacks must NEVER be cached by SW
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co') || url.pathname.includes('/auth/')) {
    return;
  }

  // Network-First Strategy:
  // Try network first to always ensure latest updates, fallback to cache if offline
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }

        // Cache static assets (fonts, icons, css, js) for offline support
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache when offline
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.mode === 'navigate') {
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
        }

        return new Response('Offline rejim — Internet aloqasini tekshiring', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
