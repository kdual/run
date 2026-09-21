const CACHE_NAME = 'run-intel-v1.0.0';
const STATIC_ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'css/responsive.css',
  'config/running-score-config.js',
  'js/utils.js',
  'js/storage.js',
  'js/weather.js',
  'js/air-quality.js',
  'js/running-score.js',
  'js/running-coach.js',
  'js/pace-calculator.js',
  'js/charts.js',
  'js/app.js',
  'manifest.json',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Weather & Air Quality APIs: Always Network-First (Do not cache stale weather in SW)
  if (url.origin.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Let the client code fallback to LocalStorage cache
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate or Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* ignore offline */});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
