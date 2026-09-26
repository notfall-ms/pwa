import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import {
    createWebSocketPager,
    defaultSocketUrl,
    validateSocketUrl,
} from './websocket';
import { readInbox, saveReceived } from '../inbox/inbox';

class Socket {
    static OPEN = 1;
    static instances: Socket[] = [];
    readyState = 0;
    binaryType = '';
    onopen?: () => void;
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    onclose?: (event: { code: number }) => void;
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
    feed(data: unknown = feed) {
        this.onmessage?.({ data: JSON.stringify(data) });
    }
}
const message = {
    id: 'ws-1',
    title: 'Treffpunkt',
    message: 'Grüße aus Münster',
    timestamp: '2026-09-26T11:45:00.000Z',
};
const feed = { messages: [message] };
beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    Socket.instances = [];
    Object.defineProperty(globalThis, 'WebSocket', {
        configurable: true,
        value: Socket,
    });
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: TextDecoder,
    });
});
afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

test('defaults to this host, requests the feed and stores before sending the unchanged ACK', async () => {
    const received = jest.fn();
    const pager = createWebSocketPager(received, jest.fn());
    const result = pager.connect(defaultSocketUrl());
    const socket = Socket.instances[0];
    expect(socket.url).toBe(`ws://${location.host}/ws`);
    socket.open();
    expect(socket.send).toHaveBeenCalledWith('{"type":"get_messages"}');
    socket.send.mockImplementation((data: string) => {
        const ack = JSON.parse(data);
        expect(readInbox()!.messages).toEqual([message]);
        expect(ack).toEqual({
            messageId: message.id,
            deviceId: readInbox()!.deviceId,
            status: 'received',
            timestamp: expect.any(String),
        });
    });
    socket.feed();
    expect(await result).toEqual([message]);
    expect(received).toHaveBeenCalledWith([message]);
    expect(pager.ackStatus()).toBe('sent');
    // WebSocket send is not a server receipt; retries remain possible.
    expect(readInbox()!.pendingAcks).toEqual([message.id]);
});

test('processes pushed feeds and deduplicates across Bluetooth/local and WebSocket reception', async () => {
    const original = saveReceived([message]);
    const received = jest.fn();
    const pager = createWebSocketPager(received, jest.fn());
    const result = pager.connect(defaultSocketUrl());
    const socket = Socket.instances[0];
    socket.open();
    socket.feed();
    await result;
    socket.feed({ messages: [message, { ...message, id: 'ws-2' }] });
    expect(readInbox()!.messages).toHaveLength(2);
    expect(readInbox()!.deviceId).toBe(original.deviceId);
    expect(received).toHaveBeenCalledTimes(2);
});

test('coalesces manual/poll reads and handles binary UTF-8 feeds with legacy text', async () => {
    const pager = createWebSocketPager(jest.fn(), jest.fn());
    const initial = pager.connect(defaultSocketUrl());
    const socket = Socket.instances[0];
    socket.open();
    socket.feed();
    await initial;
    socket.send.mockClear();
    const read = pager.read();
    expect(pager.read()).toBe(read);
    expect(socket.send).toHaveBeenCalledTimes(1);
    const bytes = new TextEncoder().encode(
        JSON.stringify({
            messages: [
                { ...message, id: 'legacy', message: undefined, text: 'Alt' },
            ],
        })
    );
    socket.onmessage!({ data: new Uint8Array(bytes).buffer });
    expect((await read).find((item) => item.id === 'legacy')!.message).toBe(
        'Alt'
    );
});

test('keeps messages and retries ACKs after send failure and reconnect', async () => {
    const pager = createWebSocketPager(jest.fn(), jest.fn());
    const first = pager.connect(defaultSocketUrl());
    let socket = Socket.instances[0];
    socket.open();
    socket.send.mockImplementation(() => {
        throw new Error('Write failed');
    });
    socket.feed();
    expect(await first).toEqual([message]);
    expect(pager.ackStatus()).toBe('pending');
    const id = readInbox()!.deviceId;
    const next = pager.connect(defaultSocketUrl());
    socket = Socket.instances[1];
    socket.open();
    socket.feed({ messages: [] });
    await next;
    expect(JSON.parse(socket.send.mock.calls[1][0])).toMatchObject({
        deviceId: id,
        messageId: message.id,
    });
});

test.each(['json', 'utf8', 'storage'])(
    'does not ACK invalid or unpersisted feeds: %s',
    async (failure) => {
        const pager = createWebSocketPager(jest.fn(), jest.fn());
        const result = pager.connect(defaultSocketUrl());
        const rejected = expect(result).rejects.toThrow('ungültig');
        const socket = Socket.instances[0];
        socket.open();
        socket.send.mockClear();
        if (failure === 'json') socket.onmessage!({ data: '{broken' });
        if (failure === 'utf8')
            socket.onmessage!({ data: new Uint8Array([255]).buffer });
        if (failure === 'storage') {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('Full');
            });
            socket.feed();
        }
        await rejected;
        expect(socket.send).not.toHaveBeenCalled();
    }
);

test('times out a missing server response and closes an incomplete connection', async () => {
    const pager = createWebSocketPager(jest.fn(), jest.fn());
    const result = pager.connect(defaultSocketUrl());
    const rejected = expect(result).rejects.toThrow('10 Sekunden');
    jest.advanceTimersByTime(10000);
    await rejected;
    expect(Socket.instances[0].close).toHaveBeenCalled();
});

test('rejects outstanding reads on disconnect and ignores messages from replaced connections', async () => {
    const received = jest.fn();
    const disconnected = jest.fn();
    const pager = createWebSocketPager(received, disconnected);
    const first = pager.connect(defaultSocketUrl());
    const rejected = expect(first).rejects.toThrow('beendet');
    const old = Socket.instances[0];
    const second = pager.connect(defaultSocketUrl());
    await rejected;
    old.feed();
    expect(received).not.toHaveBeenCalled();
    const socket = Socket.instances[1];
    socket.open();
    socket.feed();
    await second;
    const read = pager.read();
    const closed = expect(read).rejects.toThrow('1006');
    socket.readyState = 3;
    socket.onclose!({ code: 1006 });
    await closed;
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(readInbox()!.messages).toEqual([message]);
});

test('creates a persistent random device ID on the HTTP kiosk without randomUUID', () => {
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    });
    const inbox = saveReceived([message]);
    expect(inbox.deviceId).toMatch(
        /^pwa-[a-f0-9-]{14}4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
    );
    expect(readInbox()!.deviceId).toBe(inbox.deviceId);
    expect(saveReceived([message]).deviceId).toBe(inbox.deviceId);
});

test('rejects invalid protocols and credentials', () => {
    expect(() => validateSocketUrl('http://example.test/ws')).toThrow();
    expect(() =>
        validateSocketUrl('ws://user:secret@example.test/ws')
    ).toThrow();
    expect(validateSocketUrl('wss://example.test/ws')).toBe(
        'wss://example.test/ws'
    );
});
