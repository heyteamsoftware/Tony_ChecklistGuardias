/* Service worker: la app abre aunque no haya cobertura. La API nunca se cachea. */
const CACHE = 'guardias-v11';
const BASE = ['./', 'index.html', 'css/app.css?v=11', 'js/config.js?v=11', 'js/app.js?v=11',
  'img/logo.webp', 'img/icono.svg', 'favicon.svg', 'img/icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Red primero (para ver siempre la última versión) y caché si no hay conexión.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.includes('/api/')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && new URL(req.url).origin === location.origin) {
      const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
