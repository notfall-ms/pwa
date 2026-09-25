const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const createWorker = (options = {}) => {
    const handlers = {};
    const deleted = [];
    const stored = new Map(options.entries || []);
    const metadata = {
        development: !!options.development,
        viteOrigin: 'http://localhost:3000',
        cacheName: 'notfall-ms-current',
        cachePrefix: 'notfall-ms-',
        pagerPath: '/assets/pager.json',
        pagerCacheName: 'notfall-ms-pager-v1',
        documentsPath: '/documents/',
        documents: ['/documents/beispiel.txt'],
        precache: ['/', '/assets/main.js', '/documents/beispiel.txt'],
    };
    let skipped = false;
    const cache = {
        match: async (url) => stored.get(url),
        put: async (url, response) => stored.set(url, response),
        addAll: async (requests) => {
            assert.equal(requests.length, 3);
            assert.ok(requests.every((request) => request.cache === 'reload'));
            if (options.installFails) throw new Error('Document unavailable');
        },
    };
    const context = {
        PWA: metadata,
        URL,
        Response,
        Request: class extends Request {
            constructor(url, init) {
                super(new URL(url, 'https://example.test'), init);
            }
        },
        fetch:
            options.fetch ||
            (async () => {
                throw new Error('Offline');
            }),
        caches: {
            open: async () => cache,
            keys: async () => [
                'notfall-ms-old',
                metadata.cacheName,
                'another-app',
                metadata.pagerCacheName,
            ],
            delete: async (key) => deleted.push(key),
        },
        self: {
            location: { origin: 'https://example.test' },
            addEventListener: (type, listener) => {
                handlers[type] = listener;
            },
            clients: {
                claim: async () => {},
                matchAll: async () => Array(options.tabs || 1).fill({}),
            },
            skipWaiting: async () => {
                skipped = true;
            },
        },
    };
    context.importScripts = () =>
        runInNewContext(
            readFileSync(__dirname + '/development/development.js', 'utf8'),
            context
        );
    runInNewContext(
        readFileSync(__dirname + '/service-worker.js', 'utf8'),
        context
    );
    const fetch = (path, method = 'GET') => {
        let response;
        handlers.fetch({
            request: new Request(new URL(path, 'https://example.test'), {
                method,
            }),
            respondWith: (result) => {
                response = result;
            },
        });
        return response;
    };
    const message = (type) => {
        let result;
        handlers.message({
            data: { type },
            waitUntil: (promise) => {
                result = promise;
            },
        });
        return result;
    };
    return { handlers, fetch, message, deleted, skipped: () => skipped };
};

test('serves the app shell and document offline, including query strings', async () => {
    const worker = createWorker({
        entries: [
            ['/', new Response('App')],
            ['/documents/beispiel.txt', new Response('Sample')],
        ],
    });
    assert.equal(await (await worker.fetch('/')).text(), 'App');
    assert.equal(
        await (await worker.fetch('/documents/beispiel.txt?download=1')).text(),
        'Sample'
    );
});

test('missing offline documents return 503 instead of app HTML', async () => {
    const response = await createWorker().fetch('/documents/missing.pdf');
    assert.equal(response.status, 503);
});

test('does not intercept APIs, other origins or POST requests', () => {
    const worker = createWorker();
    assert.equal(worker.fetch('/api/example'), undefined);
    assert.equal(
        worker.fetch('https://other.test/documents/sample.txt'),
        undefined
    );
    assert.equal(worker.fetch('/documents/beispiel.txt', 'POST'), undefined);
});

test('rejects installation when a required document cannot be cached', async () => {
    let result;
    const worker = createWorker({ installFails: true });
    worker.handlers.install({
        waitUntil: (promise) => {
            result = promise;
        },
    });
    await assert.rejects(result, /Document unavailable/);
    assert.equal(worker.skipped(), false);
});

test('activates updates only after an explicit message', async () => {
    const worker = createWorker();
    assert.equal(worker.skipped(), false);
    await worker.message('ACTIVATE_UPDATE');
    assert.equal(worker.skipped(), true);
});

test('cleans only obsolete app caches when one tab remains', async () => {
    const worker = createWorker();
    await worker.message('CLEAN_CACHES');
    assert.deepEqual(worker.deleted, ['notfall-ms-old']);
});

test('retains old caches while multiple tabs are open', async () => {
    const worker = createWorker({ tabs: 2 });
    await worker.message('CLEAN_CACHES');
    assert.deepEqual(worker.deleted, []);
});

test('development caches Vite modules and serves them offline after a hot update', async () => {
    let online = true;
    const worker = createWorker({
        development: true,
        fetch: async () => {
            if (!online) throw new Error('Offline');
            return new Response('fresh module');
        },
    });
    assert.equal(
        await (
            await worker.fetch('http://localhost:3000/src/frontend/main.ts?t=1')
        ).text(),
        'fresh module'
    );
    online = false;
    assert.equal(
        await (
            await worker.fetch('http://localhost:3000/src/frontend/main.ts?t=2')
        ).text(),
        'fresh module'
    );
});

test('development prefers changed documents from the network', async () => {
    const worker = createWorker({
        development: true,
        entries: [
            [
                'https://example.test/documents/beispiel.txt',
                new Response('old'),
            ],
        ],
        fetch: async () => new Response('new'),
    });
    assert.equal(
        await (await worker.fetch('/documents/beispiel.txt')).text(),
        'new'
    );
});

test('development bypasses BrowserSync and unrelated endpoints', () => {
    const worker = createWorker({ development: true });
    assert.equal(
        worker.fetch('/browser-sync/browser-sync-client.js'),
        undefined
    );
    assert.equal(worker.fetch('/api/example'), undefined);
    assert.equal(worker.fetch('http://localhost:3000/healthz'), undefined);
});

test('lets the pager validate its own fresh feed in production and development', () => {
    for (const development of [false, true]) {
        assert.equal(
            createWorker({ development }).fetch('/assets/pager.json'),
            undefined
        );
    }
});
