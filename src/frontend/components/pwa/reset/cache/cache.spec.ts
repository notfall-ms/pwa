import { resetAppCache } from './cache';

beforeEach(() => {
    localStorage.clear();
});

test('deletes only app caches and unregisters its worker while preserving user state', async () => {
    localStorage.setItem('notfall-ms-checklist-v1', '["contacts"]');
    const unregister = jest.fn().mockResolvedValue(true);
    const other = jest.fn();
    const remove = jest.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: jest.fn().mockResolvedValue({ ok: true }),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistrations: async () => [
                {
                    active: {
                        scriptURL: new URL('/sw.js', location.origin).href,
                    },
                    unregister,
                },
                {
                    active: {
                        scriptURL: new URL('/other/sw.js', location.origin)
                            .href,
                    },
                    unregister: other,
                },
            ],
        },
    });
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
            keys: async () => [
                'notfall-ms-build',
                'notfall-ms-pager-v1',
                'other-app',
            ],
            delete: remove,
        },
    });
    await resetAppCache();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(remove.mock.calls.flat()).toEqual([
        'notfall-ms-build',
        'notfall-ms-pager-v1',
    ]);
    expect(localStorage.getItem('notfall-ms-checklist-v1')).toBe(
        '["contacts"]'
    );
});

test('does not clear offline data if the server cannot be reached', async () => {
    const remove = jest.fn();
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: jest.fn().mockRejectedValue(new Error('Offline')),
    });
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { delete: remove },
    });
    await expect(resetAppCache()).rejects.toThrow('Offline');
    expect(remove).not.toHaveBeenCalled();
});
