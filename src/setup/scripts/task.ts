import { LOG } from '@robert.tools/log';
import { spawn } from 'node:child_process';

LOG.OK('Starting development environment...');
LOG.INFO(`NODE_ENV=${process.env.NODE_ENV}`);
const args = process.argv;
const arg = process.argv.slice(2);
const arg1 = arg[0];
const arg2 = arg[1];
console.log(`Arguments: ${arg.join(' ')}`);

const appFile = `src/setup/scripts/${arg1}.ts`;
const processes = [
    ['tsx', [appFile, arg1]],
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
