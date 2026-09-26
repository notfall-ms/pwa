import { messages as demoMessages } from '../../assets/pager.json';
import {
    bluetoothAvailable,
    createBluetoothPager,
} from './bluetooth/bluetooth';
import { setupBluetoothDebug } from './bluetooth/debug/debug';
import { savedMessages } from './inbox/inbox';
import { renderMessages } from './view/view';
import './pager.css';
import { readLocal, writeLocal } from '../preparedness/storage/storage';

const refreshKey = 'notfall-ms-pager-refresh-seconds-v1';
const intervals = [0, 15, 30, 60, 300];

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
        const saved = savedMessages();
        renderMessages(container, saved.length ? saved : demoMessages);
        status.textContent = saved.length
            ? '◌ Lokal gespeicherte Nachrichten'
            : '◌ Beispielnachricht · Demo';
    };
    const reportBluetooth = setupBluetoothDebug();
    const bluetooth = createBluetoothPager(() => {
        fallback();
        if (pairLabel) pairLabel.textContent = 'Bluetooth koppeln';
        if (bluetoothStatus)
            bluetoothStatus.textContent =
                'Verbindung getrennt. Gespeicherte Nachrichten oder die Demo werden angezeigt.';
    }, reportBluetooth);
    if (pair) pair.disabled = !bluetoothAvailable();
    if (bluetoothStatus && !bluetoothAvailable())
        bluetoothStatus.textContent =
            'Bluetooth ist in diesem Browser nicht verfügbar. Gespeicherte Nachrichten oder die Demo werden angezeigt.';
    const intervalSelect = document.querySelector<HTMLSelectElement>(
        '[data-pager-interval]'
    );
    const savedInterval = readLocal<number>(refreshKey, 60);
    let seconds = intervals.includes(savedInterval) ? savedInterval : 60;
    if (intervalSelect) intervalSelect.value = String(seconds);
    let timer: number | undefined;
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
            if (!bluetooth.connected()) {
                fallback();
                return;
            }
            renderMessages(container, messages);
            status.textContent = '● Über Bluetooth geladen';
            if (pairLabel) pairLabel.textContent = 'Bluetooth trennen';
            if (bluetoothStatus)
                bluetoothStatus.textContent =
                    bluetooth.ackStatus() === 'unavailable'
                        ? 'Verbunden. Empfangsbestätigung wird von diesem Sender nicht unterstützt.'
                        : bluetooth.ackStatus() === 'pending'
                          ? 'Nachrichten gespeichert. Empfangsbestätigung wird beim nächsten Abruf erneut versucht.'
                          : 'Nachrichten gespeichert und Empfang bestätigt.';
        } catch {
            bluetooth.disconnect();
            fallback();
            if (pairLabel) pairLabel.textContent = 'Bluetooth koppeln';
            if (bluetoothStatus)
                bluetoothStatus.textContent =
                    'Kopplung abgebrochen oder Nachrichten konnten nicht gelesen bzw. gespeichert werden. Gespeicherte Nachrichten oder die Demo werden angezeigt.';
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
    const schedule = (): void => {
        window.clearInterval(timer);
        timer = undefined;
        if (seconds > 0) {
            timer = window.setInterval(() => {
                if (!document.hidden && bluetooth.connected()) void update();
            }, seconds * 1000);
        }
    };
    intervalSelect?.addEventListener('change', () => {
        const value = Number(intervalSelect.value);
        if (!intervals.includes(value)) return;
        seconds = value;
        const saved = writeLocal(refreshKey, seconds);
        const help = document.querySelector('[data-pager-interval-help]');
        if (help)
            help.textContent = saved
                ? 'Automatisch nur bei geöffneter, sichtbarer App und bestehender Bluetooth-Verbindung.'
                : 'Auswahl gilt nur für diese Sitzung. Speichern ist nicht verfügbar.';
        schedule();
    });
    schedule();
    void update();
};
