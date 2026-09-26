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
    jest.clearAllMocks();
    document.body.innerHTML =
        '<div data-pager-messages></div><span data-pager-status></span><button data-pager-pair></button><p data-pager-bluetooth-status></p><button data-pager-refresh></button>';
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
