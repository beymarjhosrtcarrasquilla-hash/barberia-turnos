const CACHE_NAME = 'frankbarber-cache-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './barbero.html',
  './comparador.html',
  './styles/main.css',
  './js/config.js',
  './js/storage.js',
  './js/app.js',
  './js/barbero.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
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
  const url = event.request.url;
  // Evitar interceptar LiveReload, métodos distintos de GET o peticiones a Supabase
  if (event.request.method !== 'GET' || url.includes('__live_reload') || url.includes('supabase.co')) {
    return;
  }

  // Navegación (incluye rutas limpias de Cloudflare Pages como /barbero y /)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && !networkResponse.redirected) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const pathname = new URL(url).pathname;
        if (pathname.endsWith('/barbero') || pathname.endsWith('/barbero.html')) {
          return caches.match('./barbero.html');
        }
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
