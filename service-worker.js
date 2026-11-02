const CACHE_NAME = 'growth-gx-v2';

// Static assets that rarely change
const STATIC = ['./', './manifest.json', './icons/icon-144x144.png', './icons/icon-192x192.png', './icons/icon-512x512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Fetch: cache-first for everything. Background update for index.html.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(e.request).then((cached) => {
        const url = new URL(e.request.url);
        const isHtml = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

        // Start network fetch in background
        const network = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            if (isHtml) {
              // Clone and check version before updating cache
              const clone = res.clone();
              clone.text().then((text) => {
                const newVer = (text.match(/<meta name="app-version" content="(\\d+)"/) || [])[1];
                if (newVer) {
                  caches.match(e.request).then((oldRes) => {
                    if (oldRes) {
                      oldRes.text().then((oldText) => {
                        const oldVer = (oldText.match(/<meta name="app-version" content="(\\d+)"/) || [])[1];
                        if (newVer !== oldVer) {
                          cache.put(e.request, res.clone());
                          self.clients.matchAll().then((clients) =>
                            clients.forEach((c) => c.postMessage({ type: 'version-update' }))
                          );
                        }
                      });
                    }
                  });
                }
              });
            } else {
              cache.put(e.request, res.clone());
            }
          }
          return res;
        }).catch(() => {});

        return cached || network;
      })
    )
  );
});
