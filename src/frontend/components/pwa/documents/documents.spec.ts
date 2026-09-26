import { showDocuments } from './documents';

// Normalize the real CommonJS parser for this project's Jest module interop.
jest.mock('./markdown/tabs/tabs.css', () => ({}));

jest.mock('markdown-it', () => ({
    __esModule: true,
    default: jest.requireActual('markdown-it'),
}));

jest.mock('./documents.css', () => ({}));
jest.mock('./markdown/markdown.css', () => ({}));
jest.mock('../status/status', () => ({
    setStatus: (selector: string, text: string) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = text;
    },
}));

const status = {
    version: '1.0.1',
    build: 'test',
    cacheName: 'notfall-ms-test',
    documents: ['/documents/beispiel.txt'],
};

beforeEach(() => {
    document.body.innerHTML =
        '<div data-pwa-documents></div><p data-pwa-documents-status></p><span data-pwa-offline></span>';
});

test('renders cached TXT content as text rather than HTML', async () => {
    const match = jest.fn().mockResolvedValue({
        text: async () => '<script>bad()</script> Sample',
    });
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { open: jest.fn().mockResolvedValue({ match }) },
    });
    await showDocuments(status);
    expect(caches.open).toHaveBeenCalledWith(status.cacheName);
    expect(match).toHaveBeenCalledWith('/documents/beispiel.txt');
    expect(document.querySelector('pre')?.textContent).toContain(
        '<script>bad()</script>'
    );
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[data-pwa-offline]')?.textContent).toBe(
        '✓ 1 offline'
    );
});

test('does not claim offline readiness when a cached document is missing', async () => {
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { open: async () => ({ match: async () => undefined }) },
    });
    await showDocuments(status);
    expect(document.querySelector('[data-pwa-offline]')?.textContent).toBe(
        '⚠ 0/1 offline'
    );
    expect(document.querySelector('a')).toBeNull();
});

test('updates the top bar even without a document list on the page', async () => {
    document.querySelector('[data-pwa-documents]')?.remove();
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
            open: async () => ({
                match: async () => ({ text: async () => 'Sample' }),
            }),
        },
    });
    await showDocuments(status);
    expect(document.querySelector('[data-pwa-offline]')?.textContent).toBe(
        '✓ 1 offline'
    );
});

test.each(['md', 'markdown'])(
    'renders cached .%s documents as formatted Markdown',
    async (extension) => {
        Object.defineProperty(window, 'caches', {
            configurable: true,
            value: {
                open: async () => ({
                    match: async () => ({
                        text: async () => '# Unterlagen\n\n- **Kontaktliste**',
                    }),
                }),
            },
        });
        await showDocuments({
            ...status,
            documents: [`/documents/unterlagen.${extension}`],
        });
        expect(document.querySelector('.pwa-markdown h1')?.textContent).toBe(
            'Unterlagen'
        );
        expect(
            document.querySelector('.pwa-markdown li strong')?.textContent
        ).toBe('Kontaktliste');
        expect(document.querySelector('[data-pwa-offline]')?.textContent).toBe(
            '✓ 1 offline'
        );
    }
);

test('downloads and caches a missing document so it is shown again', async () => {
    const response = {
        ok: true,
        status: 200,
        text: async () => 'Recovered',
        clone: jest.fn(),
    };
    response.clone.mockReturnValue(response);
    const put = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
            open: async () => ({ match: async () => undefined, put }),
        },
    });
    const fetchMock = jest.fn().mockResolvedValue(response);
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: fetchMock,
    });
    await showDocuments(status);
    expect(put).toHaveBeenCalledWith('/documents/beispiel.txt', response);
    expect(document.querySelector('pre')?.textContent).toBe('Recovered');
    expect(document.querySelector('[data-pwa-offline]')?.textContent).toBe(
        '✓ 1 offline'
    );
});
