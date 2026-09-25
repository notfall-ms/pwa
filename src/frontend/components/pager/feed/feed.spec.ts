import { loadMessages, parseMessages } from './feed';
import { pwaConfig } from '../../../../../pwa.config';

const feed = {
    messages: [
        {
            id: 'soup',
            title: 'Suppe',
            text: 'Um 19 Uhr am Digitalhub.',
            demo: true,
        },
    ],
};
const response = (data: unknown) => ({
    ok: true,
    clone: () => response(data),
    json: async () => data,
});

test('loads and caches a valid JSON feed', async () => {
    const put = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: jest.fn().mockResolvedValue(response(feed)),
    });
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { open: async () => ({ put }) },
    });
    expect(await loadMessages()).toEqual({
        messages: feed.messages,
        offline: false,
    });
    expect(put).toHaveBeenCalledWith(pwaConfig.pagerPath, expect.anything());
});

test('falls back to the last valid feed for offline or malformed responses', async () => {
    const put = jest.fn();
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
            open: async () => ({ put, match: async () => response(feed) }),
        },
    });
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: jest.fn().mockRejectedValue(new Error('Offline')),
    });
    expect((await loadMessages()).offline).toBe(true);
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: jest.fn().mockResolvedValue(response({ messages: [{}] })),
    });
    expect((await loadMessages()).messages).toEqual(feed.messages);
    expect(put).not.toHaveBeenCalled();
});

test('rejects duplicate IDs and invalid expiration dates', () => {
    expect(() =>
        parseMessages({ messages: [feed.messages[0], feed.messages[0]] })
    ).toThrow();
    expect(() =>
        parseMessages({
            messages: [{ ...feed.messages[0], expiresAt: 'not a date' }],
        })
    ).toThrow();
});
