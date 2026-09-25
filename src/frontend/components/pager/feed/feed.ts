import { pwaConfig } from '../../../../../pwa.config';
import type { PagerMessage, PagerResult } from '../pager.d';

/** 🎯 Validate the simple JSON pager contract before displaying or caching it. */
export const parseMessages = (data: unknown): PagerMessage[] => {
    if (
        !data ||
        typeof data !== 'object' ||
        !('messages' in data) ||
        !Array.isArray(data.messages)
    )
        throw new Error('Invalid pager feed');
    const ids = new Set<string>();
    return data.messages.map((item: unknown) => {
        if (!item || typeof item !== 'object')
            throw new Error('Invalid message');
        const message = item as PagerMessage;
        if (
            typeof message.id !== 'string' ||
            !message.id ||
            ids.has(message.id) ||
            typeof message.title !== 'string' ||
            typeof message.text !== 'string'
        )
            throw new Error('Invalid message');
        if (
            message.expiresAt !== undefined &&
            (typeof message.expiresAt !== 'string' ||
                !Number.isFinite(Date.parse(message.expiresAt)))
        )
            throw new Error('Invalid expiry');
        if (message.demo !== undefined && typeof message.demo !== 'boolean')
            throw new Error('Invalid demo flag');
        ids.add(message.id);
        return message;
    });
};

const loadCached = async (): Promise<PagerResult> => {
    const cache = await caches.open(pwaConfig.pagerCacheName);
    const response =
        (await cache.match(pwaConfig.pagerPath)) ||
        (await caches.match(pwaConfig.pagerPath));
    if (!response) throw new Error('No cached pager feed');
    return { messages: parseMessages(await response.json()), offline: true };
};

/** 🎯 Prefer fresh messages and keep the last valid feed available offline. */
export const loadMessages = async (): Promise<PagerResult> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(pwaConfig.pagerPath, {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('Pager unavailable');
        const messages = parseMessages(await response.clone().json());
        try {
            const cache = await caches.open(pwaConfig.pagerCacheName);
            await cache.put(pwaConfig.pagerPath, response);
        } catch {
            /* Live messages also work when browser storage is unavailable. */
        }
        return { messages, offline: false };
    } catch {
        return loadCached();
    } finally {
        clearTimeout(timeout);
    }
};
