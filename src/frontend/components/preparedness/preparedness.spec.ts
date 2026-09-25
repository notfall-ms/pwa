import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { setupPreparedness } from './preparedness';
import { setupInstall } from '../pwa/install/install';
import { track, setTrackingEnabled } from './tracking/tracking';
import { getMockEvents } from './tracking/mock-client/mock-client';

jest.mock('./preparedness.css', () => ({}));
jest.mock('./theme/theme.css', () => ({}));
jest.mock('./checklist/checklist.css', () => ({}));
jest.mock('./reminders/reminders.css', () => ({}));
jest.mock('../pwa/install/install.css', () => ({}));
jest.mock('../pwa/status/status.css', () => ({}));

test('connects checklist, location, install events and opt-out through the mock', async () => {
    jest.useFakeTimers();
    localStorage.clear();
    setTrackingEnabled(false);
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: () => ({ matches: false, addEventListener: jest.fn() }),
    });
    const templates = [
        'checklist/checklist.njk',
        'location/location.njk',
        'tracking/tracking.njk',
        'reminders/reminders.njk',
        '../pwa/install/install.njk',
    ];
    document.body.innerHTML =
        '<span data-todo-count></span>' +
        templates
            .map((file) => readFileSync(join(__dirname, file), 'utf8'))
            .join('');
    setupInstall();
    setupPreparedness();
    expect(document.querySelector('[data-todo-count]')?.textContent).toBe(
        '☐ 6 offen'
    );
    const toggle = document.querySelector<HTMLButtonElement>(
        '[data-tracking-toggle]'
    )!;
    toggle.click();
    const select =
        document.querySelector<HTMLSelectElement>('[data-area-select]')!;
    select.value = '56';
    select.dispatchEvent(new Event('change'));
    document.querySelector<HTMLInputElement>('[data-checklist] input')!.click();
    expect(document.querySelector('[data-todo-count]')?.textContent).toBe(
        '☐ 5 offen'
    );
    window.dispatchEvent(new Event('appinstalled'));
    await track('snapshot');
    expect(
        getMockEvents().some(
            (event) => event.kind === 'installation' && event.installed
        )
    ).toBe(true);
    expect(getMockEvents().at(-1)).toMatchObject({
        completed: 1,
        district: 'Münster-West',
        installed: true,
    });
    expect(
        document.querySelector<HTMLButtonElement>('[data-pwa-install]')?.hidden
    ).toBe(true);
    toggle.click();
    document.querySelector<HTMLInputElement>('[data-checklist] input')!.click();
    await track('snapshot');
    expect(getMockEvents()).toEqual([]);
    expect(document.querySelector('[data-tracking-status]')?.textContent).toBe(
        '○ Tracking aus'
    );
    jest.clearAllTimers();
    jest.useRealTimers();
});
