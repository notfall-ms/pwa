import { renderProgress } from './view';
import { restoreChecklist, setComplete } from '../state/state';
import { tasks } from '../tasks/tasks';

test('turns accents green at full completion, restores after reload and reverses on undo', () => {
    localStorage.clear();
    restoreChecklist();
    renderProgress();
    expect(document.documentElement.dataset.preparedness).toBe('incomplete');
    tasks.forEach((task) => setComplete(task.id, true));
    renderProgress();
    expect(document.documentElement.dataset.preparedness).toBe('complete');
    restoreChecklist();
    renderProgress();
    expect(document.documentElement.dataset.preparedness).toBe('complete');
    setComplete(tasks[0].id, false);
    renderProgress();
    expect(document.documentElement.dataset.preparedness).toBe('incomplete');
});
