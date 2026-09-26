import type { PwaStatus } from '../pwa.d';
import { setStatus } from '../status/status';
import './documents.css';
import { renderMarkdown } from './markdown/markdown';

const renderDocument = async (
    url: string,
    response: Response
): Promise<HTMLElement> => {
    const article = document.createElement('article');
    const link = document.createElement('a');
    link.href = url;
    link.textContent = '📄 ' + decodeURIComponent(url.split('/').pop() || url);
    const badge = document.createElement('span');
    badge.className = 'pwa-document-badge';
    badge.textContent = '✓ Offline';
    article.append(link, badge);
    if (/\.txt$/i.test(url)) {
        const preview = document.createElement('pre');
        preview.textContent = await response.text();
        article.append(preview);
    }
    if (/\.(md|markdown)$/i.test(url)) {
        article.append(renderMarkdown(await response.text(), url));
    }
    return article;
};

/** 🎯 Read and display documents from the active offline cache. */
export const showDocuments = async (status: PwaStatus): Promise<void> => {
    const container = document.querySelector('[data-pwa-documents]');
    const cache = await caches.open(status.cacheName);
    const documents = await Promise.all(
        status.documents.map(async (url) => {
            try {
                let response = await cache.match(url);
                if (!response) {
                    const fresh = await fetch(url);
                    if (!fresh.ok || fresh.status !== 200) return null;
                    await cache.put(url, fresh.clone());
                    response = fresh;
                }
                return await renderDocument(url, response);
            } catch {
                return null;
            }
        })
    );
    container?.replaceChildren(
        ...documents.filter((item): item is HTMLElement => item !== null)
    );
    const count = documents.filter(Boolean).length;
    const complete = count === status.documents.length;
    setStatus(
        '[data-pwa-documents-status]',
        `▤ ${count}/${status.documents.length} gesichert`
    );
    setStatus(
        '[data-pwa-offline]',
        complete
            ? `✓ ${count} offline`
            : `⚠ ${count}/${status.documents.length} offline`
    );
};
