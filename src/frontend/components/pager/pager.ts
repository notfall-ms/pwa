import { messages as demoMessages } from '../../assets/pager.json';
import {
    bluetoothAvailable,
    createBluetoothPager,
} from './bluetooth/bluetooth';
import { renderMessages } from './view/view';
import './pager.css';

/** 🎯 Read paired Bluetooth messages with an explicitly labelled local demo fallback. */
export const setupPager = (): void => {
    const container = document.querySelector<HTMLElement>(
        '[data-pager-messages]'
    );
    const status = document.querySelector('[data-pager-status]');
    const refresh = document.querySelector<HTMLButtonElement>(
        '[data-pager-refresh]'
    );
    if (!container || !status) return;
    const pair = document.querySelector<HTMLButtonElement>('[data-pager-pair]');
    const pairLabel = pair?.querySelector('[data-pager-pair-label]');
    const bluetoothStatus = document.querySelector(
        '[data-pager-bluetooth-status]'
    );
    const fallback = (): void => {
        renderMessages(container, demoMessages);
        status.textContent = '◌ Beispielnachricht · Demo';
    };
    const bluetooth = createBluetoothPager(() => {
        fallback();
        if (pairLabel) pairLabel.textContent = 'Bluetooth koppeln';
        if (bluetoothStatus)
            bluetoothStatus.textContent =
                'Verbindung getrennt. Beispielnachricht wird angezeigt.';
    });
    if (pair) pair.disabled = !bluetoothAvailable();
    if (bluetoothStatus && !bluetoothAvailable())
        bluetoothStatus.textContent =
            'Bluetooth ist in diesem Browser nicht verfügbar. Beispielnachricht wird angezeigt.';
    let loading = false;
    const update = async (pairing = false): Promise<void> => {
        if (loading) return;
        loading = true;
        if (refresh) refresh.disabled = true;
        if (pair) pair.disabled = true;
        try {
            if (!pairing && !bluetooth.connected()) {
                fallback();
                return;
            }
            if (bluetoothStatus)
                bluetoothStatus.textContent =
                    'Bluetooth-Nachrichten werden geladen …';
            const messages = await (pairing
                ? bluetooth.pair()
                : bluetooth.read());
            renderMessages(container, messages);
            status.textContent = '● Über Bluetooth geladen';
            if (pairLabel) pairLabel.textContent = 'Bluetooth trennen';
            if (bluetoothStatus)
                bluetoothStatus.textContent =
                    'Verbunden. Nachrichten werden regelmäßig aktualisiert.';
        } catch {
            bluetooth.disconnect();
            fallback();
            if (pairLabel) pairLabel.textContent = 'Bluetooth koppeln';
            if (bluetoothStatus)
                bluetoothStatus.textContent =
                    'Kopplung abgebrochen oder Nachrichten nicht lesbar. Beispielnachricht wird angezeigt.';
        } finally {
            loading = false;
            if (refresh) refresh.disabled = false;
            if (pair) pair.disabled = !bluetoothAvailable();
        }
    };
    pair?.addEventListener('click', () => {
        if (bluetooth.connected()) {
            bluetooth.disconnect();
            if (pairLabel) pairLabel.textContent = 'Bluetooth koppeln';
            if (bluetoothStatus)
                bluetoothStatus.textContent = 'Verbindung getrennt.';
            fallback();
        } else void update(true);
    });
    refresh?.addEventListener('click', () => {
        void update();
    });
    window.addEventListener('online', () => {
        void update();
    });
    window.setInterval(() => {
        if (!document.hidden) void update();
    }, 60000);
    void update();
};
