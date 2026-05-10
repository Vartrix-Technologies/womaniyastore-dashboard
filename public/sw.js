/// <reference lib="webworker" />

/**
 * Service Worker for Womaniya Dashboard PWA
 * 
 * Provides:
 * - App shell caching (HTML, CSS, JS)
 * - Offline fallback page
 * - Cache-first strategy for static assets
 * - Network-first strategy for API calls
 * - Background sync support
 */

// Update version number (e.g., 'app-v2') to bust cache on next deploy.
const CACHE_NAME = 'app-v1';
const OFFLINE_URL = '/offline.html';

// Static assets to pre-cache during install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

// ── Install Event ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // NOTE: Don't call self.skipWaiting() here.
  // The client (ServiceWorkerRegistration) controls when to activate
  // the new SW and reload the page to avoid broken CSS/JS references.
});

// ── Activate Event ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ── Fetch Event ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls - let them pass through (handled by app's offline logic)
  if (url.hostname.includes('supabase')) return;

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') return;

  // For navigation requests (HTML pages): Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Try cache first, then offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // For static assets (CSS, images, fonts): Cache-first
  // NOTE: Next.js /_next/ JS bundles use content-hashed filenames, so cache-first is safe.
  // But we use network-first for HTML/navigation (above) to always get fresh pages.
  if (
    url.pathname.match(/\.(css|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Return nothing for failed asset loads
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // For Next.js JS bundles: Network-first with cache fallback
  // This ensures users always get the latest JS after a deployment
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.match(/\.js$/)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response('', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // Default: Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// ── Push Notification Event (future use) ──────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  // WHITE-LABEL: update this fallback title to match your brand
  const title = data.title || 'App';
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Message Event (for update checks) ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
