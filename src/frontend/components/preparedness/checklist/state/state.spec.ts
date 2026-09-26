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
    setComplete('contacts', true);
    setComplete('contacts', true);
    expect(getProgress().completed).toBe(1);
    setComplete('contacts', false);
    expect(getProgress().completed).toBe(0);
    setComplete('contacts', true);
    restoreChecklist();
    expect(isComplete('contacts')).toBe(true);
    expect(getProgress().remaining).toBe(tasks.length - 1);
});

test('handles corrupt storage and excludes unknown task IDs', () => {
    localStorage.setItem('notfall-ms-checklist-v1', '{broken');
    restoreChecklist();
    expect(getProgress().completed).toBe(0);
    localStorage.setItem(
        'notfall-ms-checklist-v1',
        JSON.stringify(['contacts', 'unknown', 'contacts'])
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

test('restores the tracking task from consent rather than a stale checkbox', () => {
    localStorage.setItem('notfall-ms-checklist-v1', '["tracking"]');
    restoreChecklist();
    expect(isComplete('tracking')).toBe(false);
    localStorage.setItem('notfall-ms-tracking-consent-v1', 'true');
    restoreChecklist();
    expect(isComplete('tracking')).toBe(true);
});
