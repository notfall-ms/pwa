import { parseMessages } from '../feed/feed';
import { saveReceived } from '../inbox/inbox';
import type { PagerMessage } from '../pager.d';
import type { BluetoothDiagnostic } from '../bluetooth/debug/debug';

export const defaultSocketUrl = (): string =>
    `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

export const validateSocketUrl = (value: string): string => {
    const url = new URL(value);
    if (
        !['ws:', 'wss:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash
    )
        throw new Error(
            'Bitte eine WebSocket-Adresse mit ws:// oder wss:// ohne Zugangsdaten angeben.'
        );
    if (location.protocol === 'https:' && url.protocol !== 'wss:')
        throw new Error(
            'Diese HTTPS-Seite benötigt wss://. Für den HTTP-Kiosk die PWA direkt im Kiosk-WLAN öffnen.'
        );
    return url.href;
};

/** Same feed and ACK payloads as BLE; each WebSocket message is one full JSON feed. */
export const createWebSocketPager = (
    onMessages: (messages: PagerMessage[]) => void,
    onDisconnect: () => void,
    onDiagnostic?: (entry: BluetoothDiagnostic) => void
) => {
    let socket: WebSocket | undefined;
    let pending:
        | {
              promise: Promise<PagerMessage[]>;
              resolve: (messages: PagerMessage[]) => void;
              reject: (error: Error) => void;
              timer: number;
          }
        | undefined;
    let ackState: 'pending' | 'sent' = 'pending';
    const report = (
        state: BluetoothDiagnostic['state'],
        detail: string
    ): void => {
        try {
            onDiagnostic?.({
                timestamp: new Date().toISOString(),
                step: 'WebSocket',
                state,
                detail,
            });
        } catch {
            /* Diagnostics must not interrupt reception. */
        }
    };
    const fail = (error: Error): void => {
        report('error', error.message);
        if (pending) {
            window.clearTimeout(pending.timer);
            pending.reject(error);
            pending = undefined;
        }
    };
    const disconnect = (): void => {
        const old = socket;
        socket = undefined;
        if (pending) fail(new Error('WebSocket-Verbindung beendet.'));
        old?.close();
    };
    const waitForFeed = (): Promise<PagerMessage[]> => {
        if (pending) return pending.promise;
        let resolve!: (messages: PagerMessage[]) => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<PagerMessage[]>((yes, no) => {
            resolve = yes;
            reject = no;
        });
        const timer = window.setTimeout(
            () =>
                fail(
                    new Error('Kein Nachrichtenfeed innerhalb von 10 Sekunden.')
                ),
            10000
        );
        pending = { promise, resolve, reject, timer };
        return promise;
    };
    const request = (): void => {
        if (!socket || socket.readyState !== WebSocket.OPEN)
            throw new Error('WebSocket ist nicht verbunden.');
        socket.send(JSON.stringify({ type: 'get_messages' }));
        report('start', 'Nachrichten angefordert.');
    };
    return {
        disconnect,
        connected: () => socket?.readyState === WebSocket.OPEN,
        ackStatus: () => ackState,
        read: (): Promise<PagerMessage[]> => {
            if (pending) return pending.promise;
            const result = waitForFeed();
            try {
                request();
            } catch (error) {
                fail(error as Error);
            }
            return result;
        },
        connect: (address: string): Promise<PagerMessage[]> => {
            disconnect();
            const url = validateSocketUrl(address);
            const current = new WebSocket(url);
            current.binaryType = 'arraybuffer';
            socket = current;
            const result = waitForFeed();
            report('start', 'Verbindung wird aufgebaut.');
            current.onopen = () => {
                if (socket !== current) return;
                try {
                    request();
                } catch (error) {
                    fail(error as Error);
                }
            };
            current.onmessage = (event: MessageEvent) => {
                if (socket !== current) return;
                try {
                    const text =
                        typeof event.data === 'string'
                            ? event.data
                            : event.data instanceof ArrayBuffer
                              ? new TextDecoder('utf-8', {
                                    fatal: true,
                                }).decode(event.data)
                              : undefined;
                    if (text === undefined)
                        throw new Error('Unbekanntes WebSocket-Datenformat.');
                    const messages = parseMessages(JSON.parse(text));
                    const inbox = saveReceived(messages);
                    ackState = 'pending';
                    try {
                        for (const messageId of inbox.pendingAcks) {
                            if (current.readyState !== WebSocket.OPEN)
                                throw new Error('Verbindung vor ACK getrennt.');
                            current.send(
                                JSON.stringify({
                                    messageId,
                                    deviceId: inbox.deviceId,
                                    status: 'received',
                                    timestamp: new Date().toISOString(),
                                })
                            );
                        }
                        // send() only queues bytes. Retain ACKs for retry; no server receipt is defined.
                        ackState = 'sent';
                    } catch {
                        report(
                            'error',
                            'ACK konnte nicht gesendet werden; Nachricht bleibt gespeichert.'
                        );
                    }
                    report(
                        'ok',
                        `${messages.length} Nachrichten verarbeitet und lokal gespeichert.`
                    );
                    if (pending) {
                        window.clearTimeout(pending.timer);
                        pending.resolve(inbox.messages);
                        pending = undefined;
                    }
                    onMessages(inbox.messages);
                } catch {
                    fail(
                        new Error(
                            'WebSocket-Feed ungültig oder lokale Speicherung fehlgeschlagen.'
                        )
                    );
                }
            };
            current.onerror = () => {
                if (socket !== current) return;
                fail(
                    new Error(
                        'WebSocket-Fehler: Adresse, WLAN, Server und TLS-Zertifikat prüfen.'
                    )
                );
                disconnect();
                onDisconnect();
            };
            current.onclose = (event) => {
                if (socket !== current) return;
                socket = undefined;
                fail(new Error(`WebSocket getrennt (Code ${event.code}).`));
                onDisconnect();
            };
            return result.catch((error) => {
                if (socket === current) disconnect();
                throw error;
            });
        },
    };
};
