import { loadMessages, parseMessages } from './feed';
import { pwaConfig } from '../../../../../pwa.config';

const feed = {
    messages: [
        {
            id: 'soup',
            title: 'Suppe',
            timestamp: '2026-09-26T11:45:00.000Z',
            message: 'Um 19 Uhr am Digitalhub.',
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

test('deduplicates IDs and rejects invalid expiration dates', () => {
    expect(
        parseMessages({ messages: [feed.messages[0], feed.messages[0]] })
    ).toEqual(feed.messages);
    expect(() =>
        parseMessages({
            messages: [{ ...feed.messages[0], expiresAt: 'not a date' }],
        })
    ).toThrow();
});

test('prefers message and accepts legacy text without changing the sender timestamp', () => {
    const original = feed.messages[0];
    expect(
        parseMessages({ messages: [{ ...original, text: 'Legacy' }] })[0]
            .message
    ).toBe(original.message);
    expect(
        parseMessages({
            messages: [{ ...original, message: undefined, text: 'Legacy' }],
        })[0]
    ).toMatchObject({ message: 'Legacy', timestamp: original.timestamp });
    expect(
        parseMessages({
            messages: [{ ...original, message: null, text: 'Legacy' }],
        })[0].message
    ).toBe('Legacy');
});

test.each([
    undefined,
    'invalid',
    '2026-02-30T11:45:00.000Z',
    '2026-09-26T11:45:00+02:00',
])('requires a valid UTC sender timestamp: %s', (timestamp) => {
    expect(() =>
        parseMessages({ messages: [{ ...feed.messages[0], timestamp }] })
    ).toThrow('Invalid timestamp');
});

test.each([
    { message: undefined },
    { message: 42, text: 'Legacy' },
    { message: undefined, text: false },
])('rejects missing or invalid message content', (fields) => {
    expect(() =>
        parseMessages({ messages: [{ ...feed.messages[0], ...fields }] })
    ).toThrow('Invalid message');
});
