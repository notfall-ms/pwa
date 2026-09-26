import { parseMessages } from '../feed/feed';
import type { PagerMessage } from '../pager.d';

// The transmitting device must expose this readable UTF-8 JSON characteristic.
export const serviceUuid = '7b183224-9168-443e-a927-7aeea07e1000';
export const messagesUuid = '7b183224-9168-443e-a927-7aeea07e1001';
type Characteristic = { readValue(): Promise<DataView> };
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
    const disconnected = (): void => {
        characteristic = undefined;
        onDisconnect();
    };
    const disconnect = (): void => {
        device?.removeEventListener('gattserverdisconnected', disconnected);
        device?.gatt?.disconnect();
        device = undefined;
        characteristic = undefined;
    };
    const read = async (): Promise<PagerMessage[]> => {
        if (!characteristic || !device?.gatt?.connected)
            throw new Error('Bluetooth disconnected');
        const value = await characteristic.readValue();
        return parseMessages(
            JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value))
        );
    };
    return {
        disconnect,
        read,
        connected: () => !!characteristic && !!device?.gatt?.connected,
        pair: async (): Promise<PagerMessage[]> => {
            disconnect();
            const bluetooth = api();
            if (!bluetoothAvailable() || !bluetooth)
                throw new Error('Bluetooth unavailable');
            try {
                device = await bluetooth.requestDevice({
                    filters: [{ services: [serviceUuid] }],
                });
                device.addEventListener('gattserverdisconnected', disconnected);
                if (!device.gatt) throw new Error('GATT unavailable');
                const server = await device.gatt.connect();
                const service = await server.getPrimaryService(serviceUuid);
                characteristic = await service.getCharacteristic(messagesUuid);
                return await read();
            } catch (error) {
                disconnect();
                throw error;
            }
        },
    };
};
