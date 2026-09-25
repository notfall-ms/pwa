import './install.css';
import { wasInstalled, rememberInstallation } from './state/state';
import type { InstallPromptEvent } from '../pwa.d';
import { setStatus } from '../status/status';

/** 🎯 Connect browser installation prompts to the install button. */
export const setupInstall = (): void => {
    const button =
        document.querySelector<HTMLButtonElement>('[data-pwa-install]');
    if (!button) return;
    const container = button.closest<HTMLElement>('.pwa-install');
    let isInstalled = false;
    let prompt: InstallPromptEvent | undefined;
    const installed = (): void => {
        isInstalled = true;
        button.disabled = true;
        button.hidden = true;
        if (container) container.hidden = true;
        rememberInstallation(true);
        setStatus('[data-pwa-install-help]', '');
    };
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        isInstalled = false;
        rememberInstallation(false);
        button.hidden = false;
        button.disabled = false;
        if (container) container.hidden = false;
        prompt = event as InstallPromptEvent;
    });
    window.addEventListener('appinstalled', installed);
    const standalone = window.matchMedia('(display-mode: standalone)');
    if (
        wasInstalled() ||
        standalone.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone
    )
        installed();
    standalone.addEventListener('change', (event) => {
        if (event.matches) installed();
    });
    button.addEventListener('click', () => {
        const current = prompt;
        prompt = undefined;
        if (!current) {
            setStatus(
                '[data-pwa-install-help]',
                '⋮ → App installieren · iOS: Teilen → Zum Home-Bildschirm'
            );
            return;
        }
        button.disabled = true;
        void current
            .prompt()
            .then(() => current.userChoice)
            .then(({ outcome }) => {
                setStatus(
                    '[data-pwa-install-help]',
                    outcome === 'accepted' ? '✓ Bestätigt' : '↩ Abgebrochen'
                );
            })
            .catch(() =>
                setStatus('[data-pwa-install-help]', '⚠ Bitte erneut versuchen')
            )
            .finally(() => {
                button.disabled = isInstalled;
            });
    });
};
