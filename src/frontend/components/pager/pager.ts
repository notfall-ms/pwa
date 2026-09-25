import { loadMessages } from './feed/feed';
import { renderMessages } from './view/view';
import './pager.css';

/** 🎯 Poll a static JSON pager without requiring a backend or push service. */
export const setupPager = (): void => {
    const container = document.querySelector<HTMLElement>(
        '[data-pager-messages]'
    );
    const status = document.querySelector('[data-pager-status]');
    const refresh = document.querySelector<HTMLButtonElement>(
        '[data-pager-refresh]'
    );
    if (!container || !status) return;
    let loading = false;
    const update = async (): Promise<void> => {
        if (loading) return;
        loading = true;
        if (refresh) refresh.disabled = true;
        try {
            const result = await loadMessages();
            renderMessages(container, result.messages);
            status.textContent = result.offline ? '◌ Gespeichert' : '● Aktuell';
        } catch {
            status.textContent = '⚠ Nicht erreichbar';
        } finally {
            loading = false;
            if (refresh) refresh.disabled = false;
        }
    };
    refresh?.addEventListener('click', () => {
        void update();
    });
    window.addEventListener('online', () => {
        void update();
    });
    window.setInterval(() => {
        if (!document.hidden) void update();
    }, 60000);
    void update();
};
