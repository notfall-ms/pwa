/* Only loaded in development; Vite modules stay fresh and remain available offline. */
const isDevelopmentAsset = (request, url) => {
    if (url.pathname.startsWith('/browser-sync/')) return false;
    if (url.origin === PWA.viteOrigin) {
        return (
            ['script', 'style'].includes(request.destination) ||
            /^\/(src|@vite|@id|@fs|node_modules)\//.test(url.pathname)
        );
    }
    return (
        url.origin === self.location.origin &&
        (request.mode === 'navigate' ||
            PWA.precache.includes(url.pathname) ||
            url.pathname.startsWith(PWA.documentsPath))
    );
};

const developmentResponse = async (request) => {
    const cache = await caches.open(PWA.cacheName);
    const url = new URL(request.url);
    url.searchParams.delete('t');
    const key = url.href;
    try {
        const response = await fetch(request);
        if (response.ok && response.type !== 'opaque') {
            await cache.put(key, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(key);
        if (cached) return cached;
        return new Response('Offline nicht verfügbar', { status: 503 });
    }
};
