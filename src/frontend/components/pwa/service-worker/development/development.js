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
    const document =
        url.origin === self.location.origin &&
        url.pathname.startsWith(PWA.documentsPath);
    const key = document ? url.origin + url.pathname : url.href;
    try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Network response unavailable');
        if (response.status === 200 && response.type !== 'opaque') {
            try {
                await cache.put(key, response.clone());
            } catch {
                /* Keep live documents readable. */
            }
        }
        return response;
    } catch {
        const cached =
            (await cache.match(key)) ||
            (document && (await cache.match(url.pathname)));
        if (cached) return cached;
        return new Response('Offline nicht verfügbar', { status: 503 });
    }
};
