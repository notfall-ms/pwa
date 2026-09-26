import { restoreChecklist, setComplete, isComplete } from './state/state';
import { renderTasks, renderProgress } from './view/view';
import './checklist.css';
import { setTrackingEnabled } from '../tracking/tracking';

/** 🎯 Initialize the persistent example checklist. */
export const setupChecklist = (): void => {
    restoreChecklist();
    renderProgress();
    const list = document.querySelector<HTMLElement>('[data-checklist]');
    if (!list) return;
    renderTasks(list);
    list.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        const saved =
            input.value === 'tracking'
                ? setTrackingEnabled(input.checked)
                : setComplete(input.value, input.checked);
        renderProgress();
        const reward = document.querySelector('[data-todo-reward]');
        if (!reward) return;
        reward.textContent = input.checked
            ? '✨ Ein Schritt weiter! +10 Fortschrittspunkte'
            : '↩ Wieder auf deiner Liste';
        if (!saved) reward.textContent = '⚠ Nur für diese Sitzung gespeichert';
    });
    window.addEventListener('preparedness:tracking', () => {
        const input = list.querySelector<HTMLInputElement>(
            'input[value="tracking"]'
        );
        if (input) input.checked = isComplete('tracking');
        renderProgress();
    });
    window.addEventListener('storage', (event) => {
        if (event.key !== 'notfall-ms-checklist-v1' && event.key !== null)
            return;
        restoreChecklist();
        renderTasks(list);
        renderProgress();
        window.dispatchEvent(new Event('preparedness:progress'));
    });
};
