import { parseMessages } from '../feed/feed';
import { saveReceived, markAcknowledged } from '../inbox/inbox';
import type { PagerMessage } from '../pager.d';

// The transmitting device must expose this readable UTF-8 JSON characteristic.
export const serviceUuid = '7b183224-9168-443e-a927-7aeea07e1000';
export const messagesUuid = '7b183224-9168-443e-a927-7aeea07e1001';
export const ackUuid = '7b183224-9168-443e-a927-7aeea07e1002';
type Characteristic = {
    readValue(): Promise<DataView>;
    properties?: { write?: boolean };
    writeValueWithResponse?(value: Uint8Array): Promise<void>;
};
type Device = EventTarget & {
    gatt?: {
        connected: boolean;
        connect(): Promise<{
            getPrimaryService(uuid: string): Promise<{
                getCharacteristic(uuid: string): Promise<Characteristic>;
            }>;
        }>;
        disconnect(): void;
    };
};
type Bluetooth = {
    requestDevice(options: {
        filters: { services: string[] }[];
    }): Promise<Device>;
};
const api = (): Bluetooth | undefined =>
    (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;

export const bluetoothAvailable = (): boolean =>
    !!api() && window.isSecureContext;

/** Connect only from a user gesture; reuse the connection for subsequent reads. */
export const createBluetoothPager = (onDisconnect: () => void) => {
    let device: Device | undefined;
    let characteristic: Characteristic | undefined;
    let ack: Characteristic | undefined;
    let ackState: 'unavailable' | 'pending' | 'sent' = 'unavailable';
    let inFlight: Promise<PagerMessage[]> | undefined;
    const disconnected = (): void => {
        characteristic = undefined;
        ack = undefined;
        ackState = 'unavailable';
        onDisconnect();
    };
    const disconnect = (): void => {
        device?.removeEventListener('gattserverdisconnected', disconnected);
        device?.gatt?.disconnect();
        device = undefined;
        characteristic = undefined;
        ack = undefined;
        ackState = 'unavailable';
    };
    const receive = async (): Promise<PagerMessage[]> => {
        if (!characteristic || !device?.gatt?.connected)
            throw new Error('Bluetooth disconnected');
        const value = await characteristic.readValue();
        const messages = parseMessages(
            JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value))
        );
        const inbox = saveReceived(messages);
        // ACK failure must not discard the persisted feed or pending queue.
        const writer = ack;
        ackState = writer ? 'pending' : 'unavailable';
        if (writer) {
            for (const messageId of inbox.pendingAcks) {
                try {
                    if (ack !== writer || !device?.gatt?.connected) break;
                    await writer.writeValueWithResponse!(
                        new TextEncoder().encode(
                            JSON.stringify({
                                messageId,
                                deviceId: inbox.deviceId,
                                status: 'received',
                                timestamp: new Date().toISOString(),
                            })
                        )
                    );
                    markAcknowledged(messageId, inbox.deviceId);
                } catch {
                    return inbox.messages;
                }
            }
            if (ack === writer && device?.gatt?.connected) ackState = 'sent';
        }
        return inbox.messages;
    };
    const read = (): Promise<PagerMessage[]> => {
        if (!inFlight)
            inFlight = receive().finally(() => {
                inFlight = undefined;
            });
        return inFlight;
    };
    return {
        ackStatus: () => ackState,
        disconnect,
        read,
        connected: () => !!characteristic && !!device?.gatt?.connected,
        pair: async (): Promise<PagerMessage[]> => {
            disconnect();
            const bluetooth = api();
            if (!bluetoothAvailable() || !bluetooth)
                throw new Error('Bluetooth unavailable');
            try {
                // device = await bluetooth.requestDevice({
                //     filters: [{ services: [serviceUuid] }],
                // });
                device = await bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [serviceUuid],
                });
                device.addEventListener('gattserverdisconnected', disconnected);
                if (!device.gatt) throw new Error('GATT unavailable');
                const server = await device.gatt.connect();
                const service = await server.getPrimaryService(serviceUuid);
                characteristic = await service.getCharacteristic(messagesUuid);
                try {
                    const candidate = await service.getCharacteristic(ackUuid);
                    // Require WRITE with response so a successful write is observable.
                    if (
                        candidate.writeValueWithResponse &&
                        candidate.properties?.write
                    )
                        ack = candidate;
                } catch {
                    // Sender-v4 has no ACK characteristic yet; reads still work.
                    ack = undefined;
                }
                return await read();
            } catch (error) {
                disconnect();
                throw error;
            }
        },
    };
};
