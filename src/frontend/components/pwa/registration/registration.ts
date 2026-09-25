import { watchUpdates } from './updates/updates';
import type { PwaStatus } from '../pwa.d';
import { setStatus } from '../status/status';
import { showDocuments } from '../documents/documents';

const readStatus = (worker: ServiceWorker): Promise<PwaStatus> =>
    new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(() => {
            channel.port1.close();
            reject(new Error('Service worker did not respond.'));
        }, 5000);
        channel.port1.onmessage = (event: MessageEvent<PwaStatus>) => {
            clearTimeout(timeout);
            channel.port1.close();
            resolve(event.data);
        };
        worker.postMessage({ type: 'GET_STATUS' }, [channel.port2]);
    });

const refreshStatus = async (
    worker = navigator.serviceWorker.controller
): Promise<boolean> => {
    if (!worker) return false;
    const status = await readStatus(worker);
    setStatus('[data-pwa-version]', `◈ v${status.version}`);
    const version = document.querySelector<HTMLElement>('[data-pwa-version]');
    if (version) version.title = `Build ${status.build}`;
    await showDocuments(status);
    worker.postMessage({ type: 'CLEAN_CACHES' });
    return true;
};

const showError = (): void => {
    setStatus('[data-pwa-offline]', '⚠ Nicht gesichert');
    setStatus('[data-pwa-documents-status]', '↻ Bitte online neu laden');
};

/** 🎯 Register the worker and track its lifecycle. */
export const setupRegistration = async (development = false): Promise<void> => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        showError();
        return;
    }
    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (controlled || development) {
            window.location.reload();
            return;
        }
        controlled = true;
        void refreshStatus().catch(showError);
    });
    let cached = await refreshStatus().catch(() => false);
    const reportError = (): void => {
        if (!cached) showError();
    };
    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            updateViaCache: 'none',
        });
        watchUpdates(registration, reportError);
        void registration.update().catch(() => undefined);
        window.addEventListener('online', () => {
            void registration.update().catch(() => undefined);
        });
        const ready = await navigator.serviceWorker.ready;
        cached = await refreshStatus(
            ready.active || navigator.serviceWorker.controller
        );
    } catch {
        reportError();
    }
};
