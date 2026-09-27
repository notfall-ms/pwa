import { webcrypto } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { setupPager } from './pager';
import { saveReceived } from './inbox/inbox';
import {
    bluetoothAvailable,
    createBluetoothPager,
} from './bluetooth/bluetooth';

jest.mock('./pager.css', () => ({}));
jest.mock('./bluetooth/bluetooth');

class Socket {
    static OPEN = 1;
    static instances: Socket[] = [];
    readyState = 0;
    binaryType = '';
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: (event: { code: number }) => void;
    onerror?: () => void;
    send = jest.fn();
    close = jest.fn(() => {
        this.readyState = 3;
    });
    constructor(public url: string) {
        Socket.instances.push(this);
    }
    open() {
        this.readyState = 1;
        this.onopen?.();
    }
    feed(messages: unknown[] = []) {
        this.onmessage?.({ data: JSON.stringify({ messages }) });
    }
    drop() {
        this.readyState = 3;
        this.onclose?.({ code: 1006 });
    }
}
const alert = {
    id: 'current-box',
    title: 'Stromausfall',
    message: 'Die aktuelle Warnung',
    timestamp: '2026-09-26T11:45:00.000Z',
};
const flush = async () => {
    for (let i = 0; i < 6; ++i) await Promise.resolve();
};
const text = (selector: string) =>
    document.querySelector(selector)?.textContent || '';
const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];

beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    localStorage.clear();
    Socket.instances = [];
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
    Object.defineProperty(globalThis, 'WebSocket', {
        configurable: true,
        value: Socket,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: TextDecoder,
    });
    document.head.innerHTML = '<meta name="notfall-ms-kiosk" content="1">';
    document.body.innerHTML =
        '<section><div data-pager-messages></div><span data-pager-status></span><button data-pager-pair></button><button data-pager-websocket></button><p data-pager-bluetooth-status></p><button data-pager-refresh></button><label><select data-pager-interval><option value="60">Minute</option></select></label><details class="pager-connection-settings"><input data-pager-socket-url></details></section>';
    (bluetoothAvailable as jest.Mock).mockReturnValue(false);
    (createBluetoothPager as jest.Mock).mockReturnValue({
        connected: () => false,
        disconnect: jest.fn(),
        ackStatus: () => 'unavailable',
    });
    const add = window.addEventListener.bind(window);
    jest.spyOn(window, 'addEventListener').mockImplementation(
        (type, listener, options) => {
            listeners.push([type, listener]);
            add(type, listener, options);
        }
    );
});
afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    for (const [type, listener] of listeners.splice(0))
        window.removeEventListener(type, listener);
    document.head.innerHTML = '';
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

test('auto-connects to this box, ignores another stored address and clears live content on an empty snapshot', async () => {
    localStorage.setItem(
        'notfall-ms-pager-websocket-url-v1',
        JSON.stringify('ws://other-box.test/ws')
    );
    saveReceived([
        { ...alert, id: 'old-bluetooth', message: 'Alte fremde Meldung' },
    ]);
    setupPager();
    const socket = Socket.instances[0];
    expect(socket.url).toBe(`ws://${location.host}/ws`);
    expect(text('[data-pager-messages]')).not.toMatch(/Demo|Alte fremde/);
    expect(
        document.querySelector<HTMLButtonElement>('[data-pager-pair]')!.hidden
    ).toBe(true);
    expect(
        document.querySelector<HTMLElement>('.pager-connection-settings')!
            .hidden
    ).toBe(true);
    socket.open();
    expect(socket.send).toHaveBeenCalledWith('{"type":"get_messages"}');
    socket.feed([alert]);
    await flush();
    expect(text('[data-pager-messages]')).toContain(alert.message);
    expect(text('[data-pager-status]')).toContain('live über WLAN');
    socket.feed([]);
    expect(text('[data-pager-messages]')).toBe('Keine aktuellen Nachrichten.');
    socket.drop();
    expect(text('[data-pager-messages]')).toBe('Keine aktuellen Nachrichten.');
    expect(text('[data-pager-status]')).toContain('Verbindung unterbrochen');
});

test('reconnects after a dropped link and closes a silent connection after the heartbeat timeout', async () => {
    setupPager();
    const socket = Socket.instances[0];
    socket.open();
    socket.feed([alert]);
    await flush();
    socket.drop();
    expect(text('[data-pager-messages]')).toContain(alert.message);
    jest.advanceTimersByTime(999);
    expect(Socket.instances).toHaveLength(1);
    jest.advanceTimersByTime(1);
    const next = Socket.instances[1];
    next.open();
    next.feed([]);
    await flush();
    jest.advanceTimersByTime(14000); // Original 15-second heartbeat.
    expect(next.send).toHaveBeenCalledTimes(2); // Connect plus heartbeat.
    jest.advanceTimersByTime(10000);
    await flush();
    expect(next.close).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(Socket.instances).toHaveLength(3);
});

test('pagehide stops the socket and retry timers; pageshow reconnects without duplicate clients', async () => {
    setupPager();
    const first = Socket.instances[0];
    first.open();
    first.feed([alert]);
    await flush();
    window.dispatchEvent(new Event('pagehide'));
    expect(first.close).toHaveBeenCalled();
    jest.advanceTimersByTime(60000);
    await flush();
    expect(Socket.instances).toHaveLength(1);
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('pageshow'));
    expect(Socket.instances).toHaveLength(2);
    Socket.instances[1].open();
    Socket.instances[1].feed([]);
    await flush();
    expect(text('[data-pager-messages]')).toBe('Keine aktuellen Nachrichten.');
});

test('storage failure keeps live messages visible without an ACK and manual refresh still works', async () => {
    setupPager();
    const socket = Socket.instances[0];
    socket.open();
    socket.send.mockClear();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Blocked');
    });
    socket.feed([alert]);
    await flush();
    expect(text('[data-pager-messages]')).toContain(alert.message);
    expect(text('[data-pager-bluetooth-status]')).toContain(
        'nur in dieser Sitzung'
    );
    expect(socket.send).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('[data-pager-refresh]')!.click();
    expect(socket.send).toHaveBeenCalledWith('{"type":"get_messages"}');
    socket.feed([]);
    await flush();
    expect(text('[data-pager-messages]')).toBe('Keine aktuellen Nachrichten.');
});

test('the explicit WLAN disconnect stays disconnected until the user reconnects', async () => {
    setupPager();
    const socket = Socket.instances[0];
    socket.open();
    socket.feed([]);
    await flush();
    const button = document.querySelector<HTMLButtonElement>(
        '[data-pager-websocket]'
    )!;
    button.click();
    jest.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
    button.click();
    expect(Socket.instances).toHaveLength(2);
    Socket.instances[1].open();
    Socket.instances[1].feed([]);
    await flush();
});

test('failed reconnects back off from one to fifteen seconds instead of opening overlapping sockets', async () => {
    setupPager();
    for (const delay of [1000, 2000, 4000, 8000, 15000, 15000]) {
        const count = Socket.instances.length;
        Socket.instances[count - 1].drop();
        await flush();
        jest.advanceTimersByTime(delay - 1);
        expect(Socket.instances).toHaveLength(count);
        jest.advanceTimersByTime(1);
        expect(Socket.instances).toHaveLength(count + 1);
    }
    Socket.instances[Socket.instances.length - 1].open();
    Socket.instances[Socket.instances.length - 1].feed([]);
    await flush();
});

test('a suspended initial connection cannot overwrite a new connection after pageshow', async () => {
    setupPager();
    const old = Socket.instances[0];
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    const current = Socket.instances[1];
    current.open();
    current.feed([alert]);
    await flush();
    old.open();
    old.feed([]);
    expect(current.close).not.toHaveBeenCalled();
    expect(text('[data-pager-messages]')).toContain(alert.message);
    expect(text('[data-pager-status]')).toContain('live über WLAN');
});
