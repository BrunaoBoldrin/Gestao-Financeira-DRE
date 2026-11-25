const offlineCachePrefix = 'financeiro-dre-offline-';
const offlineCache = offlineCachePrefix + 'v1';
const offlinePage = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(offlineCache).then((cache) => (
    cache.add(new Request(offlinePage, { cache: 'reload' }))
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(offlineCachePrefix) && name !== offlineCache)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { origin, pathname } = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || origin !== self.location.origin ||
      pathname === '/api' || pathname.startsWith('/api/')) return;

  // Keep authenticated requests on the network. Only this generic offline page is cached.
  event.respondWith(fetch(request).catch(async () => (
    await caches.match(offlinePage, { cacheName: offlineCache }) || Response.error()
  )));
});
