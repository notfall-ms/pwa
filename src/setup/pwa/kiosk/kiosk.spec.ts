import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { markKioskPages, writeKioskInfo } from './kiosk';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'notfall-ms-kiosk-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

test('kiosk metadata and document URLs match the generated PWA', () => {
    writeFileSync(join(root, 'index.html'), '<html><head></head><body></body></html>');
    markKioskPages(root);
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toContain('name="notfall-ms-kiosk"');
    const metadata = { version: '2.0.0', build: 'abc123', cacheName: 'notfall-ms-abc123', documents: ['/documents/blackout.pdf'] };
    writeFileSync(join(root, 'sw.js'), `const PWA = ${JSON.stringify(metadata)};\n// worker`);
    writeKioskInfo(root);
    expect(JSON.parse(readFileSync(join(root, 'kiosk-info.json'), 'utf8'))).toEqual({
        ...metadata, mode: 'kiosk', source: 'https://github.com/notfall-ms/pwa',
    });
});

test('invalid build metadata stops the kiosk build', () => {
    writeFileSync(join(root, 'sw.js'), 'const PWA = {};\n');
    expect(() => writeKioskInfo(root)).toThrow('Invalid PWA build metadata');
});
