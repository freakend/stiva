// stiva PWA, audited & hardened
// DEV (localhost/127.0.0.1): self-destruct, never intercept anything.
// PROD: network-first HTML, stale-while-revalidate same-origin assets.
const CACHE = 'stiva-v3';
const PRECACHE = ['/manifest.webmanifest'];
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (IS_DEV) {
  // Dev kill-switch: purge all caches, unregister self, claim clients.
  // No fetch listener at all. Dev traffic goes straight to Vite.
  self.addEventListener('install', () => self.skipWaiting());

  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'PURGE_AND_RELOAD') {
      e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
    }
  });
} else {
  self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
    // no skipWaiting. User confirms via "Update now" (SKIP_WAITING message)
  });

  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
    if (e.data && e.data.type === 'PURGE_AND_RELOAD') {
      e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
    }
  });

  self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Defensive: never intercept dev origins
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return;
    // Only cache same-origin requests (skip Google Fonts etc.)
    if (url.origin !== self.location.origin) return;
    // Never cache range requests
    if (request.headers.has('range')) return;

    // Navigations (HTML): network-first, cache only ok responses, fallback to cache
    if (request.mode === 'navigate') {
      e.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => caches.match(request))
      );
      return;
    }

    // Assets (JS/CSS/images): stale-while-revalidate
    e.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  });
}
