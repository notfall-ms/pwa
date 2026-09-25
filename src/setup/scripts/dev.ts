import { LOG } from '@robert.tools/log';
import { spawn } from 'node:child_process';
import {
    startApp,
    checkOldViteProcess,
    startEleventy,
    startVite,
} from './_shared/utils';

LOG.OK('Starting development environment...');
LOG.INFO(`NODE_ENV=${process.env.NODE_ENV}`);

const old = checkOldViteProcess();
if (old.length > 0) {
    LOG.WARN('Old Vite process detected.');
    LOG.DEBUG(`Old Vite process:\n ${old}`);
    // stop script here
    LOG.FAIL('Stopping due to old Vite process.');
    process.exit(1);
}

const processes = [
    // ['npm', ['run', 'start_app', '--', 'api']],
    startApp('api'),
    // ['npm', ['run', 'start:api']],
    // ['npm', ['run', 'watch:api']],
    // ['npm', ['run', 'dev:eleventy']],
    // ['npm', ['run', 'dev:vite']],
    startEleventy(),
    startVite(),
    // ['npm', ['run', 'start:healthcheck_wait']],
    // ['npm', ['run', 'build:healthcheck']],
    ['npm', ['run', 'health']],
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
