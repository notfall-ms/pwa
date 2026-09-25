import { version } from '../../../../../package.json';
import './status.css';

/** 🎯 Update accessible status text. */
export const setStatus = (selector: string, text: string): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
};

/** 🎯 Display the app version and browser network state. */
export const setupStatus = (): void => {
    setStatus('[data-pwa-version]', `◈ v${version}`);
    const updateNetwork = (): void => {
        const element =
            document.querySelector<HTMLElement>('[data-pwa-network]');
        if (!element) return;
        element.textContent = navigator.onLine ? '● Online' : '◌ Offline';
        element.dataset.offline = String(!navigator.onLine);
    };
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    updateNetwork();
};
