const CACHE_NAME = 'essence-shell-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // For navigation requests, serve index.html from cache (app shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(()=> caches.match('/index.html'))
    );
    return;
  }

  // For same-origin assets, use cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        // update cache for GET responses
        if(req.method === 'GET' && resp && resp.ok){
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(()=> cached)
      )
    );
  }
  // For cross-origin (API) let network handle it; no interception
});
