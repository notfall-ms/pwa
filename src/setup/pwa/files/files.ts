import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 🎯 List regular files recursively without following symlinks. */
export const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return listFiles(path);
        return entry.isFile() ? [path] : [];
    });

/** 🎯 Encode a relative file path as a URL. */
export const toUrl = (path: string): string =>
    '/' + path.split('/').map(encodeURIComponent).join('/');
