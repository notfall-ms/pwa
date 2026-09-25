/** 🎯 Offer waiting updates and observe installation failures. */
export const watchUpdates = (
    registration: ServiceWorkerRegistration,
    showError: () => void
): void => {
    const button =
        document.querySelector<HTMLButtonElement>('[data-pwa-update]');
    const update = (): void => {
        if (button) button.hidden = !registration.waiting;
    };
    button?.addEventListener('click', () => {
        registration.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
    });
    const observe = (): void => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
            update();
            if (worker.state === 'redundant') showError();
        });
    };
    registration.addEventListener('updatefound', observe);
    observe();
    update();
};
