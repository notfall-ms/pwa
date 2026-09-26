import { setupPager } from './pager';
import {
    bluetoothAvailable,
    createBluetoothPager,
} from './bluetooth/bluetooth';

jest.mock('./pager.css', () => ({}));
jest.mock('./bluetooth/bluetooth');

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};
const connection = {
    pair: jest.fn(),
    read: jest.fn(),
    connected: jest.fn(),
    disconnect: jest.fn(),
};
beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    localStorage.clear();
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
    });
    document.body.innerHTML =
        '<div data-pager-messages></div><span data-pager-status></span><button data-pager-pair></button><p data-pager-bluetooth-status></p><button data-pager-refresh></button><select data-pager-interval><option value="0">Manuell</option><option value="15">15 Sekunden</option><option value="60">Minute</option></select>';
    (bluetoothAvailable as jest.Mock).mockReturnValue(true);
    (createBluetoothPager as jest.Mock).mockReturnValue(connection);
    connection.connected.mockReturnValue(false);
});
afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test('shows a labelled demo, loads Bluetooth messages and falls back on read failure', async () => {
    setupPager();
    expect(
        document.querySelector('[data-pager-status]')?.textContent
    ).toContain('Demo');
    connection.pair.mockResolvedValue([
        { id: 'live', title: 'Sender', text: 'Live-Nachricht' },
    ]);
    document.querySelector<HTMLButtonElement>('[data-pager-pair]')!.click();
    await flush();
    expect(
        document.querySelector('[data-pager-messages]')?.textContent
    ).toContain('Live-Nachricht');
    connection.connected.mockReturnValue(true);
    connection.read.mockRejectedValue(new Error('Read failed'));
    document.querySelector<HTMLButtonElement>('[data-pager-refresh]')!.click();
    await flush();
    expect(connection.disconnect).toHaveBeenCalled();
    expect(
        document.querySelector('[data-pager-status]')?.textContent
    ).toContain('Demo');
});

test('disables pairing in unsupported browsers and keeps the demo usable', () => {
    (bluetoothAvailable as jest.Mock).mockReturnValue(false);
    setupPager();
    expect(
        document.querySelector<HTMLButtonElement>('[data-pager-pair]')!.disabled
    ).toBe(true);
    expect(
        document.querySelector('[data-pager-messages]')?.textContent
    ).toContain('Beispielnachricht');
});

test('changes the timer, persists the selection and keeps manual refresh available', async () => {
    setupPager();
    connection.connected.mockReturnValue(true);
    connection.read.mockResolvedValue([]);
    jest.advanceTimersByTime(59999);
    expect(connection.read).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(connection.read).toHaveBeenCalledTimes(1);
    const select = document.querySelector<HTMLSelectElement>(
        '[data-pager-interval]'
    )!;
    select.value = '15';
    select.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('notfall-ms-pager-refresh-seconds-v1')).toBe(
        '15'
    );
    jest.advanceTimersByTime(15000);
    await flush();
    expect(connection.read).toHaveBeenCalledTimes(2);
    select.value = '0';
    select.dispatchEvent(new Event('change'));
    jest.advanceTimersByTime(300000);
    expect(connection.read).toHaveBeenCalledTimes(2);
    document.querySelector<HTMLButtonElement>('[data-pager-refresh]')!.click();
    await flush();
    expect(connection.read).toHaveBeenCalledTimes(3);
});

test('restores the interval and skips hidden, disconnected and overlapping reads', async () => {
    localStorage.setItem('notfall-ms-pager-refresh-seconds-v1', '15');
    setupPager();
    expect(
        document.querySelector<HTMLSelectElement>('[data-pager-interval]')!
            .value
    ).toBe('15');
    jest.advanceTimersByTime(15000);
    expect(connection.read).not.toHaveBeenCalled();
    connection.connected.mockReturnValue(true);
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
    });
    jest.advanceTimersByTime(15000);
    expect(connection.read).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
    });
    let resolve!: (messages: []) => void;
    connection.read.mockReturnValue(
        new Promise((done) => {
            resolve = done;
        })
    );
    jest.advanceTimersByTime(45000);
    expect(connection.read).toHaveBeenCalledTimes(1);
    resolve([]);
    await flush();
});
