const key = 'notfall-ms-installed';

/** 🎯 Read the installation remembered in this browser. */
export const wasInstalled = (): boolean => {
    try {
        return localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
};

/** 🎯 Remember installation without depending on storage availability. */
export const rememberInstallation = (installed: boolean): void => {
    try {
        if (installed) localStorage.setItem(key, 'true');
        else localStorage.removeItem(key);
    } catch {
        /* Installation still works when browser storage is restricted. */
    }
};
