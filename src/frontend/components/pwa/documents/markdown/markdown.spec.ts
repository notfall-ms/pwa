import { renderMarkdown } from './markdown';

// Normalize the real CommonJS parser for this project's Jest module interop.
jest.mock('markdown-it', () => ({
    __esModule: true,
    default: jest.requireActual('markdown-it'),
}));

jest.mock('./markdown.css', () => ({}));

test('renders tables and code blocks', () => {
    const preview = renderMarkdown(
        '| Name |\n| --- |\n| Beispiel |\n\n```txt\n<sample>\n```',
        '/documents/sample.md'
    );
    expect(preview.querySelector('td')?.textContent).toBe('Beispiel');
    expect(preview.querySelector('pre code')?.textContent).toBe('<sample>\n');
});

test('escapes raw HTML and rejects executable links', () => {
    const preview = renderMarkdown(
        '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))',
        '/documents/sample.md'
    );
    expect(preview.querySelector('script, img, a')).toBeNull();
    expect(preview.textContent).toContain('<script>');
});

test('resolves relative links and images against the source document', () => {
    const preview = renderMarkdown(
        '[Datei](../beispiel.txt)\n\n![Plan](plan.png)',
        '/documents/folder/sample.md'
    );
    expect(preview.querySelector('a')?.pathname).toBe(
        '/documents/beispiel.txt'
    );
    expect(new URL(preview.querySelector('img')!.src).pathname).toBe(
        '/documents/folder/plan.png'
    );
});

test('keeps the preview readable when a document contains a malformed URL', () => {
    expect(() =>
        renderMarkdown('[Broken](http://[)', '/documents/sample.md')
    ).not.toThrow();
});
