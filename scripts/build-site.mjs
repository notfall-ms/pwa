import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '_site');
if (dirname(output) !== root) throw new Error('Unexpected build output path');
rmSync(output, { recursive: true, force: true });
const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path')
);
const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/setup/scripts/build.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: {
        ...environment,
        PATH: resolve(root, 'node_modules/.bin') + delimiter + (process.env.PATH || process.env.Path || ''),
        NODE_ENV: 'production',
        NOTFALLMS_KIOSK: process.argv.includes('--kiosk') ? '1' : '0',
    },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
