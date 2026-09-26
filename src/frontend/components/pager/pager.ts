import { messages as demoMessages } from '../../assets/pager.json';
import {
    bluetoothAvailable,
    createBluetoothPager,
} from './bluetooth/bluetooth';
import { setupBluetoothDebug } from './bluetooth/debug/debug';
import { createWebSocketPager, defaultSocketUrl } from './websocket/websocket';
import { savedMessages } from './inbox/inbox';
import { renderMessages } from './view/view';
import { readLocal, writeLocal } from '../preparedness/storage/storage';
import type { PagerMessage } from './pager.d';
import './pager.css';

const refreshKey = 'notfall-ms-pager-refresh-seconds-v1';
const socketKey = 'notfall-ms-pager-websocket-url-v1';
const intervals = [0, 15, 30, 60, 300];
type Connection = 'bluetooth' | 'websocket';

/** One active transport, shared inbox, and one configurable polling timer. */
export const setupPager = (): void => {
    const container = document.querySelector<HTMLElement>(
        '[data-pager-messages]'
    );
    const status = document.querySelector('[data-pager-status]');
    if (!container || !status) return;
    const pair = document.querySelector<HTMLButtonElement>('[data-pager-pair]');
    const socketButton = document.querySelector<HTMLButtonElement>(
        '[data-pager-websocket]'
    );
    const refresh = document.querySelector<HTMLButtonElement>(
        '[data-pager-refresh]'
    );
    const connectionStatus = document.querySelector(
        '[data-pager-bluetooth-status]'
    );
    const address = document.querySelector<HTMLInputElement>(
        '[data-pager-socket-url]'
    );
    const storedAddress = readLocal<unknown>(socketKey, '');
    if (address)
        address.value =
            typeof storedAddress === 'string' && storedAddress
                ? storedAddress
                : defaultSocketUrl();
    let active: Connection = 'bluetooth';
    let loading = false;
    const report = setupBluetoothDebug();
    const fallback = (): void => {
        const saved = savedMessages();
        renderMessages(container, saved.length ? saved : demoMessages);
        status.textContent = saved.length
            ? '◌ Lokal gespeicherte Nachrichten'
            : '◌ Beispielnachricht · Demo';
    };
    const disconnected = (source: Connection): void => {
        if (active !== source) return;
        fallback();
        if (connectionStatus)
            connectionStatus.textContent =
                'Verbindung getrennt. Gespeicherte Nachrichten bleiben verfügbar.';
        controls();
    };
    const bluetooth = createBluetoothPager(
        () => disconnected('bluetooth'),
        report
    );
    const websocket = createWebSocketPager(
        (messages) => {
            if (active === 'websocket') show(messages);
        },
        () => disconnected('websocket'),
        report
    );
    const transport = () => (active === 'bluetooth' ? bluetooth : websocket);
    const controls = (): void => {
        if (pair) {
            pair.disabled = loading || !bluetoothAvailable();
            pair.setAttribute(
                'aria-pressed',
                String(active === 'bluetooth' && bluetooth.connected())
            );
            pair.title =
                active === 'bluetooth' && bluetooth.connected()
                    ? 'Bluetooth trennen'
                    : 'Bluetooth koppeln';
        }
        if (socketButton) {
            socketButton.disabled = loading || typeof WebSocket === 'undefined';
            socketButton.setAttribute(
                'aria-pressed',
                String(active === 'websocket' && websocket.connected())
            );
            socketButton.title =
                active === 'websocket' && websocket.connected()
                    ? 'WebSocket trennen'
                    : 'WebSocket verbinden';
        }
        if (refresh) refresh.disabled = loading;
        if (address) address.disabled = loading || websocket.connected();
    };
    const show = (messages: PagerMessage[]): void => {
        if (!transport().connected()) {
            fallback();
            return;
        }
        renderMessages(container, messages);
        status.textContent =
            active === 'bluetooth'
                ? '● Über Bluetooth geladen'
                : '● Über WebSocket geladen';
        if (connectionStatus) {
            const ack = transport().ackStatus();
            connectionStatus.textContent =
                ack === 'pending'
                    ? 'Gespeichert · Empfangsbestätigung wird erneut versucht.'
                    : active === 'websocket'
                      ? 'Gespeichert · ACK zur Übertragung übergeben.'
                      : ack === 'unavailable'
                        ? 'Verbunden · Sender unterstützt keine Empfangsbestätigung.'
                        : 'Gespeichert · Empfang bestätigt.';
        }
        controls();
    };
    const update = async (connect?: Connection): Promise<void> => {
        if (loading) return;
        loading = true;
        controls();
        try {
            if (connect) {
                bluetooth.disconnect();
                websocket.disconnect();
                active = connect;
            } else if (!transport().connected()) {
                fallback();
                return;
            }
            if (connectionStatus)
                connectionStatus.textContent = 'Nachrichten werden geladen …';
            let messages: PagerMessage[];
            if (connect === 'bluetooth') messages = await bluetooth.pair();
            else if (connect === 'websocket') {
                const url = address?.value.trim() || defaultSocketUrl();
                messages = await websocket.connect(url);
                writeLocal(socketKey, url);
            } else messages = await transport().read();
            show(messages);
        } catch (error) {
            transport().disconnect();
            fallback();
            if (connectionStatus)
                connectionStatus.textContent =
                    active === 'websocket' && error instanceof Error
                        ? error.message
                        : 'Verbindung oder Empfang fehlgeschlagen. Details in der Verbindungsdiagnose.';
        } finally {
            loading = false;
            controls();
        }
    };
    const toggle = (source: Connection): void => {
        if (loading) return;
        if (active === source && transport().connected()) {
            transport().disconnect();
            disconnected(source);
        } else void update(source);
    };
    pair?.addEventListener('click', () => toggle('bluetooth'));
    socketButton?.addEventListener('click', () => toggle('websocket'));
    refresh?.addEventListener('click', () => {
        void update();
    });
    const intervalSelect = document.querySelector<HTMLSelectElement>(
        '[data-pager-interval]'
    );
    const savedInterval = readLocal<number>(refreshKey, 60);
    let seconds = intervals.includes(savedInterval) ? savedInterval : 60;
    if (intervalSelect) intervalSelect.value = String(seconds);
    let timer: number | undefined;
    const schedule = (): void => {
        window.clearInterval(timer);
        timer = undefined;
        if (seconds > 0)
            timer = window.setInterval(() => {
                if (!document.hidden && transport().connected()) void update();
            }, seconds * 1000);
    };
    intervalSelect?.addEventListener('change', () => {
        const value = Number(intervalSelect.value);
        if (!intervals.includes(value)) return;
        seconds = value;
        const saved = writeLocal(refreshKey, seconds);
        const help = document.querySelector('[data-pager-interval-help]');
        if (help)
            help.textContent = saved
                ? 'Automatische Abrufe nur bei sichtbarer App. WebSocket empfängt zusätzlich neue Nachrichten vom Sender.'
                : 'Auswahl gilt nur für diese Sitzung. Speichern ist nicht verfügbar.';
        schedule();
    });
    controls();
    schedule();
    fallback();
};
