// Service Worker for Card Benefits Tracker
// Provides offline caching and notification support

const CACHE_NAME = 'card-benefits-v4';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/github-sync.js',
  './js/storage.js',
  './js/benefits.js',
  './js/notifications.js',
  './js/ui.js',
  './js/app.js',
  './data/cards.json',
  './manifest.json'
];

// Files that must NEVER be cached (dynamic user data)
const NO_CACHE = ['my-data.json'];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: never cache my-data.json; serve others from cache with network update
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never cache user data files — always go to network
  if (NO_CACHE.some(f => url.includes(f))) {
    event.respondWith(fetch(event.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Also skip caching for GitHub API calls
  if (url.includes('api.github.com') || url.includes('raw.githubusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
