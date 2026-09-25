if (PWA.development) importScripts('/sw-development.js');
/* PWA metadata is injected by the development or production build. */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(PWA.cacheName)
            .then((cache) =>
                cache.addAll(
                    PWA.precache.map(
                        (url) => new Request(url, { cache: 'reload' })
                    )
                )
            )
            .then(() => {
                if (PWA.development) return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'GET_STATUS') {
        event.ports[0]?.postMessage(PWA);
    }
    if (event.data?.type === 'ACTIVATE_UPDATE') {
        event.waitUntil(self.skipWaiting());
    }
    if (event.data?.type === 'CLEAN_CACHES') {
        event.waitUntil(cleanCaches());
    }
});

// Keep previous versions while another tab may still use their assets.
const cleanCaches = async () => {
    const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    });
    if (clients.length > 1) return;
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter(
                (key) =>
                    key.startsWith(PWA.cachePrefix) && key !== PWA.cacheName
            )
            .map((key) => caches.delete(key))
    );
};

const cachedResponse = async (request) => {
    const cache = await caches.open(PWA.cacheName);
    const url = new URL(request.url);
    // A query string must not prevent offline access to a precached document.
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    try {
        return await fetch(request);
    } catch {
        return new Response('Dieses Dokument ist offline nicht verfügbar.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET') return;
    if (PWA.development && isDevelopmentAsset(request, url)) {
        event.respondWith(developmentResponse(request));
        return;
    }
    if (url.origin !== self.location.origin) return;
    if (
        PWA.precache.includes(url.pathname) ||
        url.pathname.startsWith(PWA.documentsPath)
    ) {
        event.respondWith(cachedResponse(request));
    }
});
