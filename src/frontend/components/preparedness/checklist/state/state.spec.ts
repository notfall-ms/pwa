import {
    getProgress,
    restoreChecklist,
    setComplete,
    isComplete,
} from './state';
import { tasks } from '../tasks/tasks';

beforeEach(() => {
    localStorage.clear();
    restoreChecklist();
});

test('persists completion without awarding additional credit for repeated toggles', () => {
    setComplete(tasks[0].id, true);
    setComplete(tasks[0].id, true);
    expect(getProgress().completed).toBe(1);
    setComplete(tasks[0].id, false);
    expect(getProgress().completed).toBe(0);
    setComplete(tasks[0].id, true);
    restoreChecklist();
    expect(isComplete(tasks[0].id)).toBe(true);
    expect(getProgress().remaining).toBe(tasks.length - 1);
});

test('handles corrupt storage and excludes unknown task IDs', () => {
    localStorage.setItem('notfall-ms-checklist-v1', '{broken');
    restoreChecklist();
    expect(getProgress().completed).toBe(0);
    localStorage.setItem(
        'notfall-ms-checklist-v1',
        JSON.stringify([tasks[0].id, 'unknown', tasks[0].id])
    );
    restoreChecklist();
    expect(getProgress().completed).toBe(1);
    expect(setComplete('unknown', true)).toBe(false);
});

test('reaches exactly 100 percent and no open tasks', () => {
    tasks.forEach((task) => setComplete(task.id, true));
    expect(getProgress()).toEqual({
        completed: tasks.length,
        total: tasks.length,
        remaining: 0,
        percent: 100,
    });
});
