import MarkdownIt from 'markdown-it';
import './markdown.css';

const parser = new MarkdownIt({ html: false, linkify: false });

/** 🎯 Render cached Markdown with document-relative links and images. */
export const renderMarkdown = (
    source: string,
    documentUrl: string
): HTMLElement => {
    const preview = document.createElement('div');
    preview.className = 'pwa-markdown';
    preview.innerHTML = parser.render(source);
    const base = new URL(documentUrl, window.location.href);
    preview.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
        resolveResource(link, 'href', base);
        link.rel = 'noopener noreferrer';
    });
    preview.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
        resolveResource(image, 'src', base);
        image.loading = 'lazy';
    });
    return preview;
};

const resolveResource = (
    element: Element,
    attribute: string,
    base: URL
): void => {
    try {
        element.setAttribute(
            attribute,
            new URL(element.getAttribute(attribute)!, base).href
        );
    } catch {
        element.removeAttribute(attribute);
    }
};
