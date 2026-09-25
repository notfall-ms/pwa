import { setupInstall } from './install';

jest.mock('./install.css', () => ({}));
jest.mock('../status/status', () => ({ setStatus: jest.fn() }));

let listeners: Record<string, EventListener>;
let standalone: boolean;
const button = (): HTMLButtonElement =>
    document.querySelector('[data-pwa-install]')!;
const render = (): void => {
    document.body.innerHTML =
        '<div class="pwa-install"><button data-pwa-install>Installieren</button></div>';
};

beforeEach(() => {
    localStorage.clear();
    render();
    standalone = false;
    listeners = {};
    jest.spyOn(window, 'addEventListener').mockImplementation(
        (type, listener) => {
            listeners[type] = listener as EventListener;
        }
    );
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: jest.fn(() => ({
            matches: standalone,
            addEventListener: jest.fn(),
        })),
    });
});

afterEach(() => jest.restoreAllMocks());

test('hides installation controls after appinstalled and remembers it across reloads', () => {
    setupInstall();
    listeners.appinstalled(new Event('appinstalled'));
    expect(button().hidden).toBe(true);
    expect(button().closest<HTMLElement>('.pwa-install')?.hidden).toBe(true);
    render();
    setupInstall();
    expect(button().hidden).toBe(true);
});

test('hides the button when launched as an installed app', () => {
    standalone = true;
    setupInstall();
    expect(button().hidden).toBe(true);
});

test('restores installation when the browser offers a fresh prompt after uninstall', () => {
    localStorage.setItem('notfall-ms-installed', 'true');
    setupInstall();
    listeners.beforeinstallprompt(
        new Event('beforeinstallprompt', { cancelable: true })
    );
    expect(button().hidden).toBe(false);
    expect(button().disabled).toBe(false);
    expect(localStorage.getItem('notfall-ms-installed')).toBeNull();
});
