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
    const kiosk = !!document.querySelector(
        'meta[name="notfall-ms-kiosk"][content="1"]'
    );
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
            !kiosk && typeof storedAddress === 'string' && storedAddress
                ? storedAddress
                : defaultSocketUrl();
    let active: Connection = kiosk ? 'websocket' : 'bluetooth';
    let loading = false;
    let suspended = false;
    let stopped = false;
    let generation = 0;
    let retry: number | undefined;
    let retryDelay = 1000;
    let lastSnapshot: PagerMessage[] | undefined;
    const report = setupBluetoothDebug();
    const fallback = (): void => {
        if (kiosk) {
            if (lastSnapshot !== undefined)
                renderMessages(container, lastSnapshot);
            else
                container.textContent =
                    'Noch keine Meldungen von dieser Box empfangen.';
            status.textContent =
                lastSnapshot !== undefined
                    ? '◌ Verbindung unterbrochen · letzter empfangener Stand'
                    : '◌ Box derzeit nicht erreichbar';
            return;
        }
        const saved = savedMessages();
        renderMessages(container, saved.length ? saved : demoMessages);
        status.textContent = saved.length
            ? '◌ Lokal gespeicherte Nachrichten'
            : '◌ Beispielnachricht · Demo';
    };
    const reconnect = (): void => {
        if (!kiosk || suspended || stopped || retry !== undefined) return;
        retry = window.setTimeout(() => {
            retry = undefined;
            void update('websocket');
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
    };
    const disconnected = (source: Connection): void => {
        if (active !== source) return;
        fallback();
        if (connectionStatus)
            connectionStatus.textContent = kiosk
                ? 'WLAN-Verbindung zur Box unterbrochen. Die Verbindung wird automatisch erneut versucht.'
                : 'Verbindung getrennt. Gespeicherte Nachrichten bleiben verfügbar.';
        controls();
        reconnect();
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
        report,
        { snapshot: kiosk }
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
                    ? kiosk
                        ? 'WLAN-Verbindung trennen'
                        : 'WebSocket trennen'
                    : kiosk
                      ? 'WLAN-Verbindung zur Box herstellen'
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
        if (kiosk) {
            lastSnapshot = messages;
            retryDelay = 1000;
            window.clearTimeout(retry);
            retry = undefined;
        }
        renderMessages(container, messages);
        status.textContent = kiosk
            ? '● Krisenstab · live über WLAN'
            : active === 'bluetooth'
              ? '● Über Bluetooth geladen'
              : '● Über WebSocket geladen';
        if (connectionStatus) {
            const ack = transport().ackStatus();
            connectionStatus.textContent = kiosk
                    ? ack === 'unavailable'
                        ? 'Live empfangen · nur in dieser Sitzung sichtbar. Lokales Speichern ist nicht verfügbar; keine Empfangsbestätigung gesendet.'
                        : 'Live empfangen und lokal gespeichert.'
                : ack === 'pending'
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
        if (loading || (kiosk && (suspended || stopped))) return;
        const currentGeneration = generation;
        loading = true;
        controls();
        try {
            if (connect) {
                bluetooth.disconnect();
                websocket.disconnect();
                active = connect;
            } else if (!transport().connected()) {
                fallback();
                reconnect();
                return;
            }
            if (connectionStatus)
                connectionStatus.textContent = 'Nachrichten werden geladen …';
            let messages: PagerMessage[];
            if (connect === 'bluetooth') messages = await bluetooth.pair();
            else if (connect === 'websocket') {
                const url = kiosk
                    ? defaultSocketUrl()
                    : address?.value.trim() || defaultSocketUrl();
                messages = await websocket.connect(url);
                if (!kiosk) writeLocal(socketKey, url);
            } else messages = await transport().read();
            if (currentGeneration !== generation || suspended) return;
            show(messages);
        } catch (error) {
            if (currentGeneration !== generation || suspended) return;
            transport().disconnect();
            fallback();
            if (connectionStatus)
                connectionStatus.textContent =
                    active === 'websocket' && error instanceof Error
                        ? error.message
                        : 'Verbindung oder Empfang fehlgeschlagen. Details in der Verbindungsdiagnose.';
            reconnect();
        } finally {
            if (currentGeneration === generation) {
                loading = false;
                controls();
            }
        }
    };
    const toggle = (source: Connection): void => {
        if (loading) return;
        if (active === source && transport().connected()) {
            if (kiosk) {
                stopped = true;
                window.clearTimeout(retry);
                retry = undefined;
            }
            transport().disconnect();
            disconnected(source);
            if (kiosk && connectionStatus)
                connectionStatus.textContent =
                    'WLAN-Verbindung zur Box getrennt. Mit „WLAN“ erneut verbinden.';
        } else {
            stopped = false;
            void update(source);
        }
    };
    pair?.addEventListener('click', () => toggle('bluetooth'));
    socketButton?.addEventListener('click', () => toggle('websocket'));
    refresh?.addEventListener('click', () => {
        if (kiosk && !websocket.connected()) {
            stopped = false;
            window.clearTimeout(retry);
            retry = undefined;
            void update('websocket');
        } else void update();
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
        if (kiosk) {
            // A bounded request timeout also detects silently lost WLAN links.
            timer = window.setInterval(() => {
                if (!suspended && !stopped && websocket.connected())
                    void update();
            }, 15000);
        } else if (seconds > 0)
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
    if (kiosk) {
        if (pair) pair.hidden = true;
        if (socketButton) socketButton.textContent = 'WLAN';
        intervalSelect?.closest('label')?.setAttribute('hidden', '');
        const section = container.closest('section') || document;
        section
            .querySelector<HTMLElement>('.pager-connection-settings')
            ?.setAttribute('hidden', '');
        const diagnosticHint = section.querySelector(
            '.pager-bluetooth-debug p:nth-of-type(2)'
        );
        if (diagnosticHint)
            diagnosticHint.textContent =
                'Bei Verbindungsproblemen prüfen, ob dieses Gerät weiterhin mit dem WLAN der Box verbunden ist.';
        status.textContent = '◷ Krisenstab verbinden …';
        window.addEventListener('pagehide', () => {
            suspended = true;
            ++generation;
            loading = false;
            window.clearTimeout(retry);
            retry = undefined;
            window.clearInterval(timer);
            websocket.disconnect();
        });
        window.addEventListener('pageshow', () => {
            if (!suspended) return;
            suspended = false;
            schedule();
            if (!stopped) void update('websocket');
        });
        void update('websocket');
    }
};
