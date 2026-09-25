/** 🎯 Read local state without making storage a requirement. */
export const readLocal = <T>(key: string, fallback: T): T => {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
        return fallback;
    }
};

/** 🎯 Persist or remove local state and report storage failures. */
export const writeLocal = (key: string, value: unknown): boolean => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
};
