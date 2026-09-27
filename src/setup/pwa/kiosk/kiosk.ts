import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles } from '../files/files';

/** Select the local box client before the PWA build hashes HTML assets. */
export const markKioskPages = (root: string): void => {
    for (const file of listFiles(root).filter((path) => path.endsWith('.html'))) {
        const html = readFileSync(file, 'utf8');
        if (!html.includes('</head>')) throw new Error(`Missing HTML head: ${file}`);
        writeFileSync(file, html.replace('</head>', '<meta name="notfall-ms-kiosk" content="1"></head>'));
    }
};

/** HTTP kiosks expose document metadata without requiring a service worker. */
export const writeKioskInfo = (root: string): void => {
    const line = readFileSync(join(root, 'sw.js'), 'utf8').split('\n')[0];
    if (!line.startsWith('const PWA = ') || !line.endsWith(';')) {
        throw new Error('Missing PWA build metadata');
    }
    const { version, build, cacheName, documents } = JSON.parse(line.slice(12, -1));
    if (!Array.isArray(documents) || !version || !build || !cacheName) {
        throw new Error('Invalid PWA build metadata');
    }
    writeFileSync(join(root, 'kiosk-info.json'), JSON.stringify({
        version, build, cacheName, documents, mode: 'kiosk',
        source: 'https://github.com/notfall-ms/pwa',
    }) + '\n');
};
