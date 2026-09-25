import { getProgress } from '../checklist/state/state';
import './reminders.css';

/** 🎯 Show an explicitly simulated in-app reminder for outstanding tasks. */
export const showReminder = (): void => {
    const notification = document.querySelector<HTMLElement>('[data-reminder]');
    const text = document.querySelector('[data-reminder-text]');
    const { remaining } = getProgress();
    if (!notification || !text) return;
    text.textContent = remaining
        ? `Noch ${remaining} Aufgaben offen. Zeit für einen kleinen Schritt?`
        : 'Alles abgehakt – gut gemacht!';
    notification.hidden = false;
};

/** 🎯 Schedule one local demo, with dismissal and no push permission request. */
export const setupReminders = (): void => {
    const notification = document.querySelector<HTMLElement>('[data-reminder]');
    if (!notification) return;
    document
        .querySelector('[data-reminder-demo]')
        ?.addEventListener('click', showReminder);
    document
        .querySelector('[data-reminder-close]')
        ?.addEventListener('click', () => {
            notification.hidden = true;
        });
    document
        .querySelector('[data-reminder-link]')
        ?.addEventListener('click', () => {
            notification.hidden = true;
        });
    window.setTimeout(() => {
        if (getProgress().remaining > 0) showReminder();
    }, 12000);
    window.addEventListener('preparedness:progress', () => {
        if (getProgress().remaining === 0) notification.hidden = true;
        else if (!notification.hidden) showReminder();
    });
};
