import { setupReminders, showReminder } from './reminders';
import { restoreChecklist, setComplete } from '../checklist/state/state';
import { tasks } from '../checklist/tasks/tasks';

jest.mock('./reminders.css', () => ({}));

test('shows a dismissible demo and hides it when all tasks are complete', () => {
    jest.useFakeTimers();
    localStorage.clear();
    restoreChecklist();
    document.body.innerHTML =
        '<aside data-reminder hidden><p data-reminder-text></p><button data-reminder-close></button></aside>';
    setupReminders();
    const notification =
        document.querySelector<HTMLElement>('[data-reminder]')!;
    jest.advanceTimersByTime(12000);
    expect(notification.hidden).toBe(false);
    expect(notification.textContent).toContain('6 Aufgaben');
    document.querySelector<HTMLButtonElement>('[data-reminder-close]')!.click();
    expect(notification.hidden).toBe(true);
    showReminder();
    tasks.forEach((task) => setComplete(task.id, true));
    expect(notification.hidden).toBe(true);
    jest.useRealTimers();
});
