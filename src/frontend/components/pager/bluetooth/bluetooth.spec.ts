import { TextDecoder, TextEncoder } from 'node:util';
import {
    createBluetoothPager,
    serviceUuid,
    messagesUuid,
    bluetoothAvailable,
} from './bluetooth';

const messages = [{ id: '1', title: 'Nachricht', text: 'Grüße aus Münster' }];
const fixture = (payload: unknown = { messages }) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const characteristic = {
        readValue: jest.fn().mockResolvedValue(new DataView(bytes.buffer)),
    };
    const getCharacteristic = jest.fn().mockResolvedValue(characteristic);
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
    const f = fixture({ messages: [{ id: '1', text: 'incomplete' }] });
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
