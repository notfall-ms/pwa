import { LOG } from '@robert.tools/log';
import { spawn } from 'node:child_process';
import { buildApp, startEleventy, startVite } from './_shared/utils';

LOG.OK('Starting development environment...');
LOG.INFO(`NODE_ENV=${process.env.NODE_ENV}`);

const arg = process.argv.slice(2);
console.log(`Arguments: ${arg.join(' ')}`);

const processes = [
    // ['npm', ['run', 'build_app', '--', 'api']],
    buildApp('api'),
    // ['npm', ['run', 'build:api']],
    // ['npm', ['run', 'build:vite']],
    // ['npm', ['run', 'build:eleventy']],
    startVite('build', 'vite.config.ts'),
    startEleventy(false),
    // ['npm', ['run', 'build:healthcheck']],
    // ['npm', ['run', 'start:healthcheck_wait']],
    // ['npm', ['run', 'watch:healthcheck']],
];

const children = processes.map(([command, args]) =>
    spawn(command as string, args as string[], {
        stdio: 'inherit',
        shell: true,
    })
);

function shutdown() {
    for (const child of children) {
        child.kill();
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
