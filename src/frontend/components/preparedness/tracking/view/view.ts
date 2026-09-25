import {
    isTrackingEnabled,
    setTrackingEnabled,
    track,
    consentKey,
} from '../tracking';
import { getMockEvents } from '../mock-client/mock-client';
import { readLocal } from '../../storage/storage';

const render = (): void => {
    const active = isTrackingEnabled();
    const button = document.querySelector<HTMLButtonElement>(
        '[data-tracking-toggle]'
    );
    if (button) {
        button.textContent = active
            ? '◉ Tracking ausschalten'
            : '○ Demo-Tracking aktivieren';
        button.setAttribute('aria-pressed', String(active));
    }
    const status = document.querySelector('[data-tracking-status]');
    if (status)
        status.textContent = active
            ? '◉ Demo aktiv · nur lokal'
            : '○ Tracking aus';
    const summary = document.querySelector('[data-tracking-summary]');
    const latest = getMockEvents().at(-1);
    if (summary)
        summary.textContent =
            active && latest
                ? `Bezirk: ${latest.district || 'nicht angegeben'} · App: ${latest.installed ? 'installiert' : 'Browser'} · Aufgaben: ${latest.completed}/${latest.total}`
                : 'Keine Übermittlung. Keine Koordinaten.';
    const hash = document.querySelector('[data-tracking-hash]');
    if (hash)
        hash.textContent =
            active && latest
                ? `Zufalls-Hash: ${latest.residentHash.slice(0, 12)}…`
                : '';
};

/** 🎯 Wire consent, installation and progress to the local tracking adapter. */
export const setupTracking = (): void => {
    document
        .querySelector('[data-tracking-toggle]')
        ?.addEventListener('click', () => {
            setTrackingEnabled(!isTrackingEnabled());
            if (isTrackingEnabled()) void track('snapshot');
        });
    window.addEventListener('preparedness:tracking', render);
    window.addEventListener('preparedness:tracking-error', () => {
        const status = document.querySelector('[data-tracking-status]');
        if (status)
            status.textContent = '⚠ Demo konnte nicht gespeichert werden';
    });
    window.addEventListener('preparedness:progress', () => {
        void track('progress');
    });
    window.addEventListener('preparedness:location', () => {
        void track('district');
    });
    window.addEventListener('appinstalled', () => {
        void track('installation');
    });
    window.addEventListener('storage', (event) => {
        if (event.key === consentKey || event.key === null) {
            setTrackingEnabled(readLocal<boolean>(consentKey, false) === true);
        }
    });
    render();
    if (isTrackingEnabled()) void track('snapshot');
};
