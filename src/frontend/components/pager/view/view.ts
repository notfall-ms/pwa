import type { PagerMessage } from '../pager.d';

/** 🎯 Render messages as text, keeping remote content out of executable markup. */
export const renderMessages = (
    container: HTMLElement,
    messages: PagerMessage[]
): void => {
    const current = messages.filter(
        (message) =>
            !message.expiresAt || Date.parse(message.expiresAt) > Date.now()
    );
    container.replaceChildren(
        ...current.map((message) => {
            const article = document.createElement('article');
            article.className = 'pager-message';
            const heading = document.createElement('h3');
            heading.textContent = message.title;
            const text = document.createElement('p');
            text.textContent = message.text;
            article.append(heading, text);
            if (message.demo) {
                const badge = document.createElement('small');
                badge.textContent = 'Beispielnachricht';
                article.append(badge);
            }
            return article;
        })
    );
    if (!current.length) container.textContent = 'Keine aktuellen Nachrichten.';
};
