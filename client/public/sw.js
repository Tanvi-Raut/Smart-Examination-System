/**
 * Smart Examination Management System - Service Worker
 * 
 * Provides Offline Resilience against Mobile Network Jammers:
 * - Pre-caches React Application Shell (HTML, JavaScript, CSS, Icons)
 * - Intercepts navigation requests so the React App opens without internet
 * - Stale-while-revalidate caching strategy for static bundles
 * - Seamless offline fallback when cellular and Wi-Fi networks are blocked
 */

const CACHE_NAME = 'smart-exam-pwa-v1';

// Core assets to pre-cache on Service Worker installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.svg',
  '/favicon.svg'
];

// Installation: Pre-cache app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline application shell...');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activation: Clean up stale caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch Interception: Robust offline strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST /api/attendance is handled by IndexedDB offline queue)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML page loads / reloads in jammed exam hall)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network with a fast timeout (1500ms) to avoid long hanging in jammed zones
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout due to jammer/offline')), 1500)
          );

          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
            return response;
          }
        } catch (err) {
          console.log('[ServiceWorker] In-Hall Jammer / Offline detected. Serving cached index.html shell.');
        }

        // Offline / Network Jammed fallback: Serve cached index.html or root
        const cachedResponse = await caches.match('/index.html') || await caches.match('/');
        if (cachedResponse) {
          return cachedResponse;
        }

        return new Response(
          '<html><body style="background:#020617;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;">' +
          '<h1>Smart Examination System (Offline Mode)</h1>' +
          '<p>The network is blocked by hall jammers. Please ensure the app was opened while connected prior to the exam.</p>' +
          '</body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })()
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images, Fonts, Vite Bundles)
  // Check if request is for static assets
  const isStaticAsset = 
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Cache-First with Stale-While-Revalidate
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => {
          // Network failed (offline / jammed) - ignore since cachedResponse is returned
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Fallback for other GET requests
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request).catch(() => {
        // Silent catch for other failed requests
      });
    })
  );
});

// Communication listener for manual cache purge or skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
