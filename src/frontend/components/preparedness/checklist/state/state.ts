import { readLocal, writeLocal } from '../../storage/storage';
import { tasks } from '../tasks/tasks';
import type { Progress } from '../checklist.d';

const key = 'notfall-ms-checklist-v1';
let completed = new Set<string>();

/** 🎯 Restore only known task IDs from local storage. */
export const restoreChecklist = (): void => {
    const saved = readLocal<unknown>(key, []);
    completed = new Set(
        tasks
            .filter((task) => Array.isArray(saved) && saved.includes(task.id))
            .map((task) => task.id)
    );
    if (readLocal<boolean>('notfall-ms-tracking-consent-v1', false) === true)
        completed.add('tracking');
    else completed.delete('tracking');
};

/** 🎯 Return a progress snapshot for the UI and aggregate tracking. */
export const getProgress = (): Progress => ({
    completed: completed.size,
    total: tasks.length,
    remaining: tasks.length - completed.size,
    percent: Math.round((completed.size / tasks.length) * 100),
});

/** 🎯 Check whether a task is currently complete. */
export const isComplete = (id: string): boolean => completed.has(id);

/** 🎯 Update one task without accumulating duplicate rewards. */
export const setComplete = (id: string, checked: boolean): boolean => {
    if (!tasks.some((task) => task.id === id)) return false;
    if (checked) completed.add(id);
    else completed.delete(id);
    const saved = writeLocal(key, [...completed]);
    window.dispatchEvent(
        new CustomEvent('preparedness:progress', { detail: getProgress() })
    );
    return saved;
};
