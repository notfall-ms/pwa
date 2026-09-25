import { resetAppCache } from './cache/cache';
import { setStatus } from '../status/status';

/** 🎯 Rebuild offline resources on explicit request while keeping personal state. */
export const setupCacheReset = (): void => {
    const button =
        document.querySelector<HTMLButtonElement>('[data-cache-reset]');
    if (!button) return;
    let resetting = false;
    const update = (): void => {
        button.disabled =
            resetting ||
            !navigator.onLine ||
            !('caches' in window) ||
            !('serviceWorker' in navigator);
        button.title = navigator.onLine
            ? 'App-Cache löschen und neu laden. Aufgaben bleiben erhalten.'
            : 'Zum Zurücksetzen bitte online gehen.';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    button.addEventListener('click', async () => {
        resetting = true;
        button.disabled = true;
        button.textContent = '◷ Cache …';
        try {
            await resetAppCache();
            window.location.reload();
        } catch {
            setStatus('[data-pwa-offline]', '⚠ Cache-Reset fehlgeschlagen');
            resetting = false;
            button.textContent = '↻ Cache';
            update();
        }
    });
    update();
};
