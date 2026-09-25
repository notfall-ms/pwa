import { tasks } from '../tasks/tasks';
import { isComplete, getProgress } from '../state/state';

/** 🎯 Render task controls using text nodes. */
export const renderTasks = (container: HTMLElement): void => {
    container.replaceChildren(
        ...tasks.map((task) => {
            const label = document.createElement('label');
            label.className = 'checklist-task';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = task.id;
            checkbox.checked = isComplete(task.id);
            const text = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = `${task.icon} ${task.title}`;
            const hint = document.createElement('small');
            hint.textContent = task.hint;
            text.append(title, hint);
            label.append(checkbox, text);
            return label;
        })
    );
};

/** 🎯 Refresh task counts, score and non-cumulative achievement badges. */
export const renderProgress = (): void => {
    const { completed, total, remaining, percent } = getProgress();
    document.querySelectorAll('[data-todo-count]').forEach((element) => {
        element.textContent = remaining
            ? `☐ ${remaining} offen`
            : '✓ Alles erledigt';
    });
    const progress = document.querySelector<HTMLProgressElement>(
        '[data-todo-progress]'
    );
    if (progress) {
        progress.max = total;
        progress.value = completed;
    }
    const score = document.querySelector('[data-todo-score]');
    if (score)
        score.textContent = `${completed}/${total} · ${percent}% · ★ ${completed * 10} Punkte`;
    const badge = document.querySelector('[data-todo-badge]');
    if (!badge) return;
    badge.textContent = '✦ Dein erster Schritt zählt';
    if (completed > 0) badge.textContent = '🌟 Erster Schritt';
    if (completed >= 3) badge.textContent = '🏅 Drangeblieben';
    if (completed === total) badge.textContent = '🏆 Checkliste geschafft';
};
