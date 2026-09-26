import type { BluetoothDiagnostic } from './debug/debug';
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
export const createBluetoothPager = (
    onDisconnect: () => void,
    onDiagnostic?: (entry: BluetoothDiagnostic) => void
) => {
    const report = (
        step: string,
        state: BluetoothDiagnostic['state'],
        detail?: string
    ): void => {
        try {
            onDiagnostic?.({
                timestamp: new Date().toISOString(),
                step,
                state,
                detail,
            });
        } catch {
            /* Diagnostics must not interfere with reception or ACKs. */
        }
    };
    const step = async <T>(
        name: string,
        action: () => T | Promise<T>
    ): Promise<T> => {
        report(name, 'start');
        try {
            const result = await action();
            report(name, 'ok');
            return result;
        } catch (error) {
            const detail =
                error && typeof error === 'object' && 'message' in error
                    ? `${'name' in error ? String(error.name) : 'Error'}: ${String(error.message)}`
                    : String(error);
            report(name, 'error', detail.slice(0, 1000));
            throw error;
        }
    };
    let device: Device | undefined;
    let characteristic: Characteristic | undefined;
    let ack: Characteristic | undefined;
    let ackState: 'unavailable' | 'pending' | 'sent' = 'unavailable';
    let inFlight: Promise<PagerMessage[]> | undefined;
    const disconnected = (): void => {
        report('GATT-Verbindung', 'error', 'Verbindung zum Sender verloren.');
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
        const reader = await step('Verbindung prüfen', () => {
            if (!characteristic || !device?.gatt?.connected)
                throw new Error('Bluetooth disconnected');
            return characteristic;
        });
        const value = await step(`Nachrichten lesen (${messagesUuid})`, () =>
            reader.readValue()
        );
        report('Read-Größe', 'info', `${value.byteLength} Byte`);
        const text = await step('UTF-8 dekodieren', () =>
            new TextDecoder('utf-8', { fatal: true }).decode(value)
        );
        const data = await step('JSON parsen', () => JSON.parse(text));
        const messages = await step('Nachrichten validieren', () =>
            parseMessages(data)
        );
        const inbox = await step('Nachrichten lokal speichern', () =>
            saveReceived(messages)
        );
        // ACK failure must not discard the persisted feed or pending queue.
        const writer = ack;
        ackState = writer ? 'pending' : 'unavailable';
        if (writer) {
            for (const messageId of inbox.pendingAcks) {
                try {
                    if (ack !== writer || !device?.gatt?.connected) break;
                    await step(`ACK schreiben (${ackUuid})`, () =>
                        writer.writeValueWithResponse!(
                            new TextEncoder().encode(
                                JSON.stringify({
                                    messageId,
                                    deviceId: inbox.deviceId,
                                    status: 'received',
                                    timestamp: new Date().toISOString(),
                                })
                            )
                        )
                    );
                    await step('ACK lokal abschließen', () =>
                        markAcknowledged(messageId, inbox.deviceId)
                    );
                } catch {
                    report(
                        'ACK-Warteschlange',
                        'info',
                        'Bestätigung bleibt offen und wird nach einem erfolgreichen Read erneut versucht.'
                    );
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
            if (!bluetoothAvailable() || !bluetooth) {
                report(
                    'Browser prüfen',
                    'error',
                    `Web Bluetooth verfügbar: ${!!bluetooth}; sicherer Kontext: ${!!window.isSecureContext}`
                );
                throw new Error('Bluetooth unavailable');
            }
            try {
                report(
                    'Gerätefilter',
                    'info',
                    `Service muss im Advertising enthalten sein: ${serviceUuid}`
                );
                device = await step('Geräteauswahl (requestDevice)', () =>
                    bluetooth.requestDevice({
                        filters: [{ services: [serviceUuid] }],
                    })
                );
                device.addEventListener('gattserverdisconnected', disconnected);
                const gatt = device.gatt;
                const server = await step('GATT verbinden', () => {
                    if (!gatt) throw new Error('GATT unavailable');
                    return gatt.connect();
                });
                const service = await step(
                    `Service suchen (${serviceUuid})`,
                    () => server.getPrimaryService(serviceUuid)
                );
                characteristic = await step(
                    `Nachrichten-Characteristic suchen (${messagesUuid})`,
                    () => service.getCharacteristic(messagesUuid)
                );
                try {
                    const candidate = await step(
                        `ACK-Characteristic suchen (${ackUuid})`,
                        () => service.getCharacteristic(ackUuid)
                    );
                    // Require WRITE with response so a successful write is observable.
                    if (
                        candidate.writeValueWithResponse &&
                        candidate.properties?.write
                    )
                        ack = candidate;
                    else
                        report(
                            'ACK-Unterstützung',
                            'info',
                            'WRITE mit Antwort nicht verfügbar. Nachrichtenempfang bleibt aktiv.'
                        );
                } catch {
                    // Sender-v4 has no ACK characteristic yet; reads still work.
                    ack = undefined;
                    report(
                        'ACK-Unterstützung',
                        'info',
                        'ACK nicht verfügbar. Nachrichtenempfang bleibt aktiv.'
                    );
                }
                return await read();
            } catch (error) {
                disconnect();
                throw error;
            }
        },
    };
};
