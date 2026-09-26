import { webcrypto } from 'node:crypto';
import { readInbox, inboxKey } from '../inbox/inbox';
import { TextDecoder, TextEncoder } from 'node:util';
import {
    createBluetoothPager,
    serviceUuid,
    messagesUuid,
    ackUuid,
    bluetoothAvailable,
} from './bluetooth';

const messages = [
    {
        id: '1',
        title: 'Nachricht',
        timestamp: '2026-09-26T11:45:00.000Z',
        message: 'Grüße aus Münster',
    },
];
beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        value: TextEncoder,
    });
});
afterEach(() => jest.restoreAllMocks());

const fixture = (payload: unknown = { messages }) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const characteristic = {
        readValue: jest.fn().mockResolvedValue(new DataView(bytes.buffer)),
    };
    const ack = {
        properties: { write: true },
        writeValueWithResponse: jest.fn().mockResolvedValue(undefined),
    };
    const getCharacteristic = jest.fn().mockImplementation(async (uuid) => {
        if (uuid === messagesUuid) return characteristic;
        if (uuid === ackUuid) return ack;
        throw new DOMException('Missing characteristic', 'NotFoundError');
    });
    const getPrimaryService = jest
        .fn()
        .mockResolvedValue({ getCharacteristic });
    const device = Object.assign(new EventTarget(), {
        gatt: {
            connected: true,
            connect: jest.fn().mockResolvedValue({ getPrimaryService }),
            disconnect: jest.fn(),
        },
    });
    const requestDevice = jest.fn().mockResolvedValue(device);
    Object.defineProperty(navigator, 'bluetooth', {
        configurable: true,
        value: { requestDevice },
    });
    Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: true,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: TextDecoder,
    });
    return {
        device,
        requestDevice,
        getPrimaryService,
        getCharacteristic,
        characteristic,
        ack,
    };
};

test('pairs using the message service and reads validated UTF-8 messages again', async () => {
    const f = fixture();
    const pager = createBluetoothPager(jest.fn());
    expect(await pager.pair()).toEqual(messages);
    expect(f.requestDevice).toHaveBeenCalledWith({
        filters: [{ services: [serviceUuid] }],
    });
    expect(f.getCharacteristic).toHaveBeenCalledWith(messagesUuid);
    expect(await pager.read()).toEqual(messages);
    expect(f.requestDevice).toHaveBeenCalledTimes(1);
    pager.disconnect();
    expect(f.device.gatt.disconnect).toHaveBeenCalled();
    expect(pager.connected()).toBe(false);
});

test('rejects invalid messages and closes the connection', async () => {
    const f = fixture({
        messages: [
            {
                id: '1',
                timestamp: '2026-09-26T11:45:00.000Z',
                message: 'incomplete',
            },
        ],
    });
    const pager = createBluetoothPager(jest.fn());
    await expect(pager.pair()).rejects.toThrow('Invalid message');
    expect(f.device.gatt.disconnect).toHaveBeenCalled();
    expect(pager.connected()).toBe(false);
});

test('reports device disconnect and stops subsequent reads', async () => {
    const f = fixture();
    const disconnected = jest.fn();
    const pager = createBluetoothPager(disconnected);
    await pager.pair();
    f.device.dispatchEvent(new Event('gattserverdisconnected'));
    expect(disconnected).toHaveBeenCalledTimes(1);
    await expect(pager.read()).rejects.toThrow('disconnected');
});

test('handles unavailable Bluetooth and cancelled pairing', async () => {
    const f = fixture();
    f.requestDevice.mockRejectedValue(
        new DOMException('Cancelled', 'NotFoundError')
    );
    await expect(createBluetoothPager(jest.fn()).pair()).rejects.toThrow(
        'Cancelled'
    );
    Object.defineProperty(navigator, 'bluetooth', {
        configurable: true,
        value: undefined,
    });
    expect(bluetoothAvailable()).toBe(false);
    await expect(createBluetoothPager(jest.fn()).pair()).rejects.toThrow(
        'unavailable'
    );
});

test('persists before ACK, preserves sender timestamp and does not ACK known IDs again', async () => {
    const f = fixture();
    let payload: any;
    f.ack.writeValueWithResponse.mockImplementation(async (bytes) => {
        const stored = readInbox()!;
        expect(stored.messages).toEqual(messages);
        expect(stored.pendingAcks).toEqual(['1']);
        payload = JSON.parse(new TextDecoder().decode(bytes));
        expect(payload).toEqual({
            messageId: '1',
            deviceId: stored.deviceId,
            status: 'received',
            timestamp: expect.any(String),
        });
        expect(Number.isFinite(Date.parse(payload.timestamp))).toBe(true);
    });
    const pager = createBluetoothPager(jest.fn());
    await pager.pair();
    expect(readInbox()!.pendingAcks).toEqual([]);
    expect(pager.ackStatus()).toBe('sent');
    await pager.read();
    expect(f.ack.writeValueWithResponse).toHaveBeenCalledTimes(1);
    expect(readInbox()!.messages).toEqual(messages);
});

test('retains a failed ACK and retries after reconnect with the same device ID and no duplicates', async () => {
    const f = fixture();
    f.ack.writeValueWithResponse.mockRejectedValueOnce(
        new Error('Write failed')
    );
    const first = createBluetoothPager(jest.fn());
    expect(await first.pair()).toEqual(messages);
    expect(first.ackStatus()).toBe('pending');
    const deviceId = readInbox()!.deviceId;
    expect(readInbox()!.pendingAcks).toEqual(['1']);
    first.disconnect();
    const next = createBluetoothPager(jest.fn());
    // The next feed can be empty; ACKs survive independently of it.
    const bytes = new TextEncoder().encode('{"messages":[]}');
    f.characteristic.readValue.mockResolvedValue(new DataView(bytes.buffer));
    expect(await next.pair()).toEqual(messages);
    expect(readInbox()).toMatchObject({ deviceId, messages, pendingAcks: [] });
    const payload = JSON.parse(
        new TextDecoder().decode(f.ack.writeValueWithResponse.mock.calls[1][0])
    );
    expect(payload.deviceId).toBe(deviceId);
});

test('receives from sender-v4 without an ACK characteristic and queues confirmation', async () => {
    const f = fixture();
    f.getCharacteristic.mockImplementation(async (uuid) => {
        if (uuid === ackUuid)
            throw new DOMException('Missing', 'NotFoundError');
        return f.characteristic;
    });
    const pager = createBluetoothPager(jest.fn());
    expect(await pager.pair()).toEqual(messages);
    expect(pager.ackStatus()).toBe('unavailable');
    expect(readInbox()!.pendingAcks).toEqual(['1']);
    expect(f.ack.writeValueWithResponse).not.toHaveBeenCalled();
});

test('does not ACK when local persistence fails', async () => {
    const f = fixture();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
    });
    await expect(createBluetoothPager(jest.fn()).pair()).rejects.toThrow(
        'Quota exceeded'
    );
    expect(f.ack.writeValueWithResponse).not.toHaveBeenCalled();
});

test.each([
    new Uint8Array([0xff]),
    new TextEncoder().encode('{broken'),
    new TextEncoder().encode(JSON.stringify({ messages: [{ id: 'invalid' }] })),
])('does not store or ACK invalid UTF-8, JSON or messages', async (bytes) => {
    const f = fixture();
    f.characteristic.readValue.mockResolvedValue(new DataView(bytes.buffer));
    await expect(createBluetoothPager(jest.fn()).pair()).rejects.toThrow();
    expect(localStorage.getItem(inboxKey)).toBeNull();
    expect(f.ack.writeValueWithResponse).not.toHaveBeenCalled();
});

test.each(['service', 'messages', 'read'])(
    'handles missing service/characteristic or failed read: %s',
    async (stage) => {
        const f = fixture();
        const failure = new Error('Unavailable');
        if (stage === 'service') f.getPrimaryService.mockRejectedValue(failure);
        if (stage === 'messages')
            f.getCharacteristic.mockRejectedValue(failure);
        if (stage === 'read')
            f.characteristic.readValue.mockRejectedValue(failure);
        await expect(createBluetoothPager(jest.fn()).pair()).rejects.toThrow(
            'Unavailable'
        );
        expect(f.ack.writeValueWithResponse).not.toHaveBeenCalled();
        expect(f.device.gatt.disconnect).toHaveBeenCalled();
    }
);

test('reports the failed pairing step and original browser error', async () => {
    const f = fixture();
    const report = jest.fn();
    f.requestDevice.mockRejectedValue(
        new DOMException(
            'User cancelled the requestDevice chooser.',
            'NotFoundError'
        )
    );
    await expect(
        createBluetoothPager(jest.fn(), report).pair()
    ).rejects.toThrow('User cancelled');
    expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
            step: 'Geräteauswahl (requestDevice)',
            state: 'error',
            detail: 'NotFoundError: User cancelled the requestDevice chooser.',
        })
    );
    expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
            step: 'Gerätefilter',
            detail: expect.stringContaining(serviceUuid),
        })
    );
});

test('diagnoses ACK failures without logging message contents or pseudonymous IDs', async () => {
    const f = fixture();
    const report = jest.fn();
    f.ack.writeValueWithResponse.mockRejectedValue(
        new DOMException('Write failed', 'NetworkError')
    );
    expect(await createBluetoothPager(jest.fn(), report).pair()).toEqual(
        messages
    );
    expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
            step: `ACK schreiben (${ackUuid})`,
            state: 'error',
            detail: 'NetworkError: Write failed',
        })
    );
    const log = JSON.stringify(report.mock.calls);
    expect(log).not.toContain(messages[0].message);
    expect(log).not.toContain(readInbox()!.deviceId);
});
