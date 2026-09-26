import type { PagerMessage } from '../pager.d';
import { parseMessages } from '../feed/feed';

export const inboxKey = 'notfall-ms-pager-inbox-v1';
type Inbox = {
    deviceId: string;
    messages: PagerMessage[];
    pendingAcks: string[];
};

/** Read strictly: damaged or inaccessible storage must never trigger an ACK. */
export const readInbox = (): Inbox | null => {
    const raw = localStorage.getItem(inboxKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
        !value ||
        typeof value.deviceId !== 'string' ||
        !/^pwa-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value.deviceId
        ) ||
        !Array.isArray(value.pendingAcks)
    )
        throw new Error('Invalid inbox');
    const messages = parseMessages(value);
    if (
        !value.pendingAcks.every(
            (id: unknown) =>
                typeof id === 'string' &&
                messages.some((message) => message.id === id)
        )
    )
        throw new Error('Invalid pending ACKs');
    return {
        deviceId: value.deviceId,
        messages,
        pendingAcks: [...new Set<string>(value.pendingAcks)],
    };
};

// randomUUID is HTTPS-only; getRandomValues also works on the HTTP WLAN kiosk.
const createDeviceId = (): string => {
    if (typeof crypto.randomUUID === 'function')
        return `pwa-${crypto.randomUUID()}`;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('');
    return `pwa-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Commit messages and their pending ACKs together before any BLE write. */
export const saveReceived = (messages: PagerMessage[]): Inbox => {
    const inbox = readInbox() || {
        deviceId: createDeviceId(),
        messages: [],
        pendingAcks: [],
    };
    const known = new Set(inbox.messages.map((message) => message.id));
    for (const message of messages) {
        if (known.has(message.id)) continue;
        inbox.messages.push(message);
        inbox.pendingAcks.push(message.id);
        known.add(message.id);
    }
    localStorage.setItem(inboxKey, JSON.stringify(inbox));
    return inbox;
};

export const markAcknowledged = (messageId: string, deviceId: string): void => {
    const inbox = readInbox();
    if (!inbox || inbox.deviceId !== deviceId) return;
    inbox.pendingAcks = inbox.pendingAcks.filter((id) => id !== messageId);
    localStorage.setItem(inboxKey, JSON.stringify(inbox));
};

export const savedMessages = (): PagerMessage[] => {
    try {
        return readInbox()?.messages || [];
    } catch {
        return [];
    }
};
