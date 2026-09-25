const CACHE_NAME = 'XXX-XXX-v1';
const CORE_ASSETS = ['/', '/manifest.webmanifest', '/assets/logo.svg', '/assets/logo.jpg'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .catch((error) => {
                console.warn('[sw] cache install failed', error);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // Don't intercept development infrastructure
    if (
        requestUrl.pathname.startsWith('/browser-sync/') ||
        requestUrl.pathname.startsWith('/__vite')
    ) {
        return;
    }


    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const fallback = await caches.match('/');
                return fallback || new Response('Offline', {
                    status: 503,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                const responseClone = networkResponse.clone();
                caches
                    .open(CACHE_NAME)
                    .then((cache) => cache.put(request, responseClone))
                    .catch((error) => {
                        console.warn('[sw] cache update failed', error);
                    });
                return networkResponse;
            });
        })
    );
});