import { pwaConfig } from '../../../../../../pwa.config';

/** 🎯 Remove only this app's worker and caches, preserving user preferences. */
export const resetAppCache = async (): Promise<void> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('/sw.js', {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('App server unavailable');
    } finally {
        clearTimeout(timeout);
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
        registrations
            .filter((registration) => {
                const worker =
                    registration.active ||
                    registration.waiting ||
                    registration.installing;
                return (
                    worker?.scriptURL ===
                    new URL('/sw.js', location.origin).href
                );
            })
            .map((registration) => registration.unregister())
    );
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter((key) => key.startsWith(pwaConfig.cachePrefix))
            .map((key) => caches.delete(key))
    );
};
